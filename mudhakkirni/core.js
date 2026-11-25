// Pure logic: chunking, JSON parsing, offline generation. No DOM.
export const API='https://text.pollinations.ai/openai';

export function detectLang(t){
  const ar=(t.match(/[\u0600-\u06FF]/g)||[]).length, la=(t.match(/[A-Za-z]/g)||[]).length;
  return ar>la?'ar':'en';
}
export function chunkText(text,max=12000,maxChunks=4){
  text=text.replace(/\r/g,'').replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim();
  if(text.length<=max)return [text];
  const paras=text.split(/\n\s*\n|(?<=[.!؟?۔])\s+/);
  let chunks=[],cur='';
  for(const p of paras){
    if((cur+' '+p).length>max&&cur){chunks.push(cur);cur=p}else cur=cur?cur+'\n'+p:p;
  }
  if(cur)chunks.push(cur);
  // hard-split any oversize piece
  chunks=chunks.flatMap(c=>{const o=[];for(let i=0;i<c.length;i+=max)o.push(c.slice(i,i+max));return o});
  if(chunks.length>maxChunks){ // merge evenly into maxChunks groups by sampling
    const step=chunks.length/maxChunks, out=[];
    for(let i=0;i<maxChunks;i++)out.push(chunks[Math.floor(i*step)]);
    return out;
  }
  return chunks;
}
export function extractJSON(s){
  if(!s)throw new Error('empty');
  s=s.replace(/```json|```/gi,'');
  const a=s.indexOf('{'),b=s.lastIndexOf('}');
  if(a<0||b<=a)throw new Error('no json');
  try{return JSON.parse(s.slice(a,b+1))}catch(e){
    // repair truncated output: cut back to a closing brace and close open arrays/objects
    let t=s.slice(a);
    for(let k=0;k<40;k++){
      const c=t.lastIndexOf('}');if(c<0)break;
      t=t.slice(0,c+1);
      for(const tail of ['','}',']}','}]}',']}}']){try{return JSON.parse(t+tail)}catch{}}
      t=t.slice(0,c);
    }
    throw e;
  }
}
export function normalize(o){
  const arr=x=>Array.isArray(x)?x:[];
  const quiz=arr(o.quiz).map(q=>{
    const options=arr(q.options).map(String).slice(0,4);
    let ans=Number.isInteger(q.answer)?q.answer:options.findIndex(x=>x===String(q.answer));
    if(typeof q.answer==='string'&&/^[A-Da-d]$/.test(q.answer.trim()))ans='abcd'.indexOf(q.answer.trim().toLowerCase());
    return {q:String(q.question||q.q||''),options,answer:ans,why:String(q.explanation||q.why||'')};
  }).filter(q=>q.q&&q.options.length>=2&&q.answer>=0&&q.answer<q.options.length);
  const cards=arr(o.flashcards).map(c=>({f:String(c.front||c.f||''),b:String(c.back||c.b||'')})).filter(c=>c.f&&c.b);
  return {summary:String(o.summary||''),points:arr(o.key_points).map(String).filter(Boolean),quiz,cards};
}
export function promptFor(chunk,lang,nQ,nC,part,total){
  const L=lang==='ar'?'Arabic (clear Modern Standard Arabic, keep technical terms in English in parentheses when helpful)':lang==='en'?'English':'the same language as the source text';
  return [{role:'system',content:'You are an expert study assistant. You output ONLY valid minified JSON, no markdown, no commentary.'},
  {role:'user',content:`Source text (part ${part} of ${total}):\n"""\n${chunk}\n"""\n\nWrite in ${L}. Return JSON with exactly these keys:\n{"title":"short title","summary":"a clear 4-8 sentence study summary","key_points":["5-8 short bullet points"],"quiz":[{"question":"...","options":["A","B","C","D"],"answer":0,"explanation":"one sentence"}],"flashcards":[{"front":"term or question","back":"short answer"}]}\nRules: exactly ${nQ} multiple-choice questions with 4 options each, "answer" is the 0-based index of the correct option, correct options must be placed at varied positions, questions must be answerable from the text only. Exactly ${nC} flashcards. Do not invent facts that are not in the text.`}];
}
export async function callAI(messages,{signal,fetchImpl=fetch,onWait=()=>{}}={}){
  let lastErr;
  for(let attempt=0;attempt<4;attempt++){
    try{
      const r=await fetchImpl(API,{method:'POST',headers:{'content-type':'application/json'},signal,
        body:JSON.stringify({model:'openai',messages,response_format:{type:'json_object'},temperature:0.3,max_tokens:6000})});
      if(!r.ok){const e=new Error('HTTP '+r.status);e.status=r.status;try{const b=await r.json();const m=String(b?.error?.message||'').match(/after (\d+)s/);if(m)e.retry=+m[1]}catch{}throw e}
      const j=await r.json();
      const txt=j.choices?.[0]?.message?.content;
      const raw=extractJSON(txt);return {raw,...normalize(raw)};
    }catch(e){lastErr=e;if(e.name==='AbortError')throw e;if(attempt===3)break;const w=Math.min(50,(e.retry||2*(attempt+1))+1);onWait(w);await new Promise(r=>setTimeout(r,w*1000))}
  }
  throw lastErr;
}
export async function generateAI(text,{lang='auto',nQ=10,onProgress=()=>{},onWait=()=>{},fetchImpl,signal}={}){
  const chunks=chunkText(text);
  const perQ=Math.max(2,Math.ceil(nQ/chunks.length)), perC=Math.max(3,Math.ceil(Math.max(8,nQ)/chunks.length));
  const parts=[];
  for(let i=0;i<chunks.length;i++){
    onProgress(i,chunks.length);
    parts.push(await callAI(promptFor(chunks[i],lang,perQ,perC,i+1,chunks.length),{signal,fetchImpl,onWait}));
    if(i<chunks.length-1)await new Promise(r=>setTimeout(r,(globalThis.__gap??46)*1000));
  }
  onProgress(chunks.length,chunks.length);
  const title=(parts[0].raw.title||'').toString();
  const summary=parts.map((p,i)=>chunks.length>1?`#### ${i+1}\n${p.summary}`:p.summary).join('\n');
  const dedupe=(a,k)=>{const s=new Set();return a.filter(x=>{const v=k(x);if(s.has(v))return false;s.add(v);return true})};
  return {title,summary,points:parts.flatMap(p=>p.points).slice(0,16),
    quiz:dedupe(parts.flatMap(p=>p.quiz),q=>q.q).slice(0,nQ),cards:dedupe(parts.flatMap(p=>p.cards),c=>c.f)};
}

// ---------- Offline (no AI) ----------
const STOP=new Set('the a an of to in and or is are was were be been for on with as by at from that this it its which can will has have had not but if then than so such these those into also more most other some any their there they we you he she his her our your i من في على إلى الى عن هو هي هذا هذه ذلك التي الذي الذين أن ان إن كان كانت يكون تكون ما لا لم لن قد كل أي او أو ثم مع بين حتى عند كما لكن هناك وهو وهي'.split(' '));
const words=s=>(s.toLowerCase().match(/[\u0600-\u06FFA-Za-z0-9]{3,}/g)||[]).filter(w=>!STOP.has(w));
export function sentences(text){
  return text.replace(/\s+/g,' ').split(/(?<=[.!؟?۔])\s+/).map(s=>s.trim()).filter(s=>s.length>=30&&s.length<=320);
}
export function generateOffline(text,{nQ=10}={}){
  const sents=sentences(text);
  if(sents.length<3)throw new Error('النص قصير جداً. ضيف نص أكتر.');
  const freq={};for(const s of sents)for(const w of new Set(words(s)))freq[w]=(freq[w]||0)+1;
  const score=s=>{const w=words(s);return w.reduce((a,x)=>a+(freq[x]||0),0)/(Math.sqrt(w.length)||1)};
  const ranked=sents.map((s,i)=>({s,i,sc:score(s)})).sort((a,b)=>b.sc-a.sc);
  const pick=ranked.slice(0,Math.min(6,Math.ceil(sents.length/4)||3)).sort((a,b)=>a.i-b.i).map(x=>x.s);
  const pts=ranked.slice(0,Math.min(Math.max(nQ,8),sents.length)).sort((a,b)=>a.i-b.i).map(x=>x.s);
  const keywords=Object.entries(freq).filter(([w])=>w.length>3).sort((a,b)=>b[1]-a[1]).map(x=>x[0]);
  const quiz=[],cards=[];
  for(const {s} of ranked){
    if(quiz.length>=nQ&&cards.length>=nQ)break;
    const ws=s.match(/[\u0600-\u06FFA-Za-z0-9]{4,}/g)||[];
    const target=ws.filter(w=>!STOP.has(w.toLowerCase())).sort((a,b)=>(freq[b.toLowerCase()]||0)-(freq[a.toLowerCase()]||0))[0];
    if(!target)continue;
    const blank=s.replace(target,'_____');
    if(quiz.length<nQ){
      const distract=keywords.filter(k=>k!==target.toLowerCase()&&Math.abs(k.length-target.length)<=4).sort(()=>Math.random()-.5).slice(0,3);
      if(distract.length===3){
        const options=[...distract,target];options.sort(()=>Math.random()-.5);
        quiz.push({q:'أكمل الجملة: '+blank,options,answer:options.indexOf(target),why:s});
      }
    }
    if(cards.length<nQ)cards.push({f:blank,b:target+'\n\n'+s});
  }
  return {title:'',summary:pick.join(' '),points:pts,quiz,cards};
}
