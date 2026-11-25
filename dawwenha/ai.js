// Organize Arabic text into notes. AI via keyless Pollinations; offline fallback local.
export const API='https://text.pollinations.ai/openai';

export function chunkText(text,max=12000,maxChunks=4){
  text=text.replace(/\r/g,'').replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim();
  if(text.length<=max)return [text];
  const parts=text.split(/(?<=[.!؟?۔])\s+/);
  let chunks=[],cur='';
  for(const p of parts){
    if((cur+' '+p).length>max&&cur){chunks.push(cur);cur=p}else cur=cur?cur+' '+p:p;
  }
  if(cur)chunks.push(cur);
  chunks=chunks.flatMap(c=>{const o=[];for(let i=0;i<c.length;i+=max)o.push(c.slice(i,i+max));return o});
  if(chunks.length>maxChunks){const step=chunks.length/maxChunks,out=[];for(let i=0;i<maxChunks;i++)out.push(chunks[Math.floor(i*step)]);return out}
  return chunks;
}
export function extractJSON(s){
  if(!s)throw new Error('empty');
  s=s.replace(/```json|```/gi,'');
  const a=s.indexOf('{'),b=s.lastIndexOf('}');
  if(a<0||b<=a)throw new Error('no json');
  try{return JSON.parse(s.slice(a,b+1))}catch(e){
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
function promptFor(chunk,part,total){
  return [{role:'system',content:'You are an expert Arabic note-taking assistant. You output ONLY valid minified JSON, no markdown, no commentary.'},
  {role:'user',content:`هذا نص مفرّغ من تسجيل صوتي (جزء ${part} من ${total}):\n"""\n${chunk}\n"""\n\nنظّمه كملاحظات. أعد JSON بالمفاتيح التالية فقط:\n{"title":"عنوان قصير مناسب","cleaned":"النص بعد تنقيحه من الحشو والتكرار وتنسيقه في فقرات واضحة بالعربية الفصحى المبسطة، مع الحفاظ على كل المعلومات","key_points":["أهم النقاط في سطور قصيرة"],"tags":["كلمات مفتاحية للتصنيف"]}\nالقواعد: لا تخترع معلومات غير موجودة في النص. key_points من 3 إلى 8 نقاط. tags من 2 إلى 5 كلمات.`}];
}
async function callAI(messages,{signal,onWait=()=>{}}={}){
  let lastErr;
  for(let attempt=0;attempt<4;attempt++){
    try{
      const r=await fetch(API,{method:'POST',headers:{'content-type':'application/json'},signal,
        body:JSON.stringify({model:'openai',messages,response_format:{type:'json_object'},temperature:0.3,max_tokens:6000})});
      if(!r.ok){const e=new Error('HTTP '+r.status);e.status=r.status;try{const b=await r.json();const m=String(b?.error?.message||'').match(/after (\d+)s/);if(m)e.retry=+m[1]}catch{}throw e}
      const j=await r.json();
      return extractJSON(j.choices?.[0]?.message?.content);
    }catch(e){lastErr=e;if(e.name==='AbortError')throw e;if(attempt===3)break;const w=Math.min(50,(e.retry||2*(attempt+1))+1);onWait(w);await new Promise(r=>setTimeout(r,w*1000))}
  }
  throw lastErr;
}
export async function organizeAI(text,{onProgress=()=>{},onWait=()=>{},signal}={}){
  const chunks=chunkText(text);
  const parts=[];
  for(let i=0;i<chunks.length;i++){
    onProgress(i,chunks.length);
    parts.push(await callAI(promptFor(chunks[i],i+1,chunks.length),{signal,onWait}));
    if(i<chunks.length-1)await new Promise(r=>setTimeout(r,46000));
  }
  onProgress(chunks.length,chunks.length);
  const tags=[...new Set(parts.flatMap(p=>Array.isArray(p.tags)?p.tags.map(String):[]))].slice(0,6);
  const points=parts.flatMap(p=>Array.isArray(p.key_points)?p.key_points.map(String):[]).slice(0,12);
  const cleaned=parts.map(p=>String(p.cleaned||'')).join('\n\n');
  return {title:String(parts[0].title||'').trim(),cleaned,points,tags};
}

// Offline structuring fallback
const STOP=new Set('من في على إلى الى عن هو هي هذا هذه ذلك التي الذي الذين أن ان إن كان كانت يكون تكون ما لا لم لن قد كل أي او أو ثم مع بين حتى عند كما لكن هناك وهو وهي ده دي عشان كده بردو بس ايه ليه فيه'.split(' '));
export function organizeOffline(text){
  const sents=text.replace(/\s+/g,' ').split(/(?<=[.!؟?۔])\s+/).map(s=>s.trim()).filter(s=>s.length>15);
  const freq={};
  for(const s of sents)for(const w of new Set((s.match(/[\u0600-\u06FF]{3,}/g)||[]).map(x=>x.toLowerCase())))if(!STOP.has(w))freq[w]=(freq[w]||0)+1;
  const tags=Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,5).map(x=>x[0]);
  const paras=[];
  for(let i=0;i<sents.length;i+=3)paras.push(sents.slice(i,i+3).join('. '));
  const score=s=>(s.match(/[\u0600-\u06FF]{3,}/g)||[]).reduce((a,w)=>a+(freq[w.toLowerCase()]||0),0);
  const points=[...sents].sort((a,b)=>score(b)-score(a)).slice(0,Math.min(6,sents.length));
  const title=(sents[0]||text).split(' ').slice(0,8).join(' ');
  return {title,cleaned:paras.join('\n\n'),points,tags};
}
export function renderNote(org,raw){
  let t=org.cleaned||raw;
  if(org.points&&org.points.length)t+='\n\n⭐ أهم النقاط:\n'+org.points.map(p=>'• '+p).join('\n');
  return t;
}
