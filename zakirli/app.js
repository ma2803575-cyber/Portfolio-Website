const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const T={ar:{title:'ذاكرلي',sub:'لخّص محاضراتك واتسأل فيها وترجمها',install:'تثبيت',t_in:'📥 المحاضرة',t_sum:'📝 الملخص',t_quiz:'❓ أسئلة',t_tr:'🌐 ترجمة',t_set:'⚙️ الذكاء الاصطناعي',h_in:'حط نص المحاضرة',upload:'📄 رفع ملف (PDF / TXT)',mic:'🎙️ سجّل بالصوت',clear:'مسح',ph_src:'الصق نص المحاضرة هنا، أو ارفع ملف، أو سجّل بالميكروفون...',outlang:'لغة الناتج',o_auto:'نفس لغة المحاضرة',length:'طول الملخص',l_s:'قصير',l_m:'متوسط',l_l:'طويل',qcount:'عدد الأسئلة',go:'لخّص واعمل أسئلة ✨',empty:'لسه مفيش حاجة. روح لتبويب المحاضرة واضغط لخّص.',copy:'نسخ',dl:'تحميل .txt',trsum:'ترجم الملخص',m_mcq:'اختيار من متعدد',m_flash:'بطاقات مراجعة',regen:'أسئلة جديدة',ph_tr:'اكتب أو الصق النص اللي عايز تترجمه...',translate:'ترجم',set_note:'من غير مفتاح: التلخيص والأسئلة بتتعمل على جهازك بطريقة بسيطة (استخراج أهم الجمل)، والترجمة بخدمة مجانية. مع مفتاح Gemini المجاني: ملخص حقيقي وأسئلة أذكى وترجمة أدق.',key:'مفتاح Gemini API (اختياري)',model:'اسم الموديل',save:'حفظ',test:'اختبار',getkey:'اطلب مفتاح مجاني',privacy:'المفتاح بيتحفظ على جهازك بس. النص بيتبعت لجوجل فقط لما تستخدم المفتاح.',
 summary:'الملخص',keypts:'أهم النقاط',terms:'مصطلحات مهمة',working:'جاري الشغل...',done:'تم ✅ شوف تبويب الملخص والأسئلة.',short:'النص قصير، حط محاضرة أطول.',aifail:'فشل الذكاء الاصطناعي، استخدمت الطريقة العادية: ',score:'النتيجة',answer:'الإجابة',chars:'حرف',words:'كلمة',copied:'اتنسخ',saved:'اتحفظ',ok:'المفتاح شغال ✅',pdfread:'جاري قراءة الـPDF...',micno:'المتصفح ده مش بيدعم التسجيل الصوتي، جرب Chrome.',trfail:'فشلت الترجمة: ',cloze:'كمّل الناقص:',what:'يعني إيه',showa:'اضغط لإظهار الإجابة',nokey:'حط مفتاح الأول',trsummary:'ترجمت الملخص في تبويب الترجمة.'},
en:{title:'Zakirli',sub:'Summarize lectures, quiz yourself, translate',install:'Install',t_in:'📥 Lecture',t_sum:'📝 Summary',t_quiz:'❓ Quiz',t_tr:'🌐 Translate',t_set:'⚙️ AI',h_in:'Add the lecture text',upload:'📄 Upload (PDF / TXT)',mic:'🎙️ Record by voice',clear:'Clear',ph_src:'Paste the lecture text here, upload a file, or use the mic...',outlang:'Output language',o_auto:'Same as lecture',length:'Summary length',l_s:'Short',l_m:'Medium',l_l:'Long',qcount:'Questions',go:'Summarize + make quiz ✨',empty:'Nothing yet. Go to the Lecture tab and press Summarize.',copy:'Copy',dl:'Download .txt',trsum:'Translate summary',m_mcq:'Multiple choice',m_flash:'Flashcards',regen:'New questions',ph_tr:'Type or paste text to translate...',translate:'Translate',set_note:'Without a key: summary and quiz run on your device with a simple method (picks the key sentences) and translation uses a free service. With a free Gemini key: a real summary, smarter questions and better translation.',key:'Gemini API key (optional)',model:'Model name',save:'Save',test:'Test',getkey:'Get a free key',privacy:'The key stays on this device. Text is sent to Google only when a key is used.',
 summary:'Summary',keypts:'Key points',terms:'Key terms',working:'Working...',done:'Done ✅ see the Summary and Quiz tabs.',short:'Text is too short, add a longer lecture.',aifail:'AI failed, used the basic method: ',score:'Score',answer:'Answer',chars:'chars',words:'words',copied:'Copied',saved:'Saved',ok:'Key works ✅',pdfread:'Reading PDF...',micno:'This browser does not support voice input, try Chrome.',trfail:'Translation failed: ',cloze:'Fill in the blank:',what:'What is',showa:'Tap to show the answer',nokey:'Add a key first',trsummary:'Summary placed in the Translate tab.'}};
Object.assign(T.ar,{sub:'استوديو المحاضرات: تلخيص، شرح سلايدات، أسئلة وترجمة',t_slides:'🖼️ الشرح بالسلايد',drop1:'ارفع المحاضرة أو السلايدات',drop2:'PPTX أو PDF أو TXT. كل سلايد هتتشرح لوحدها.',upload:'اختار ملف',goslides:'اشرحلي السلايدات واحدة واحدة 🖼️',go:'لخّص واعمل الأسئلة ✨',empty_sl:'ارفع ملف سلايدات (PPTX أو PDF) من تبويب المحاضرة الأول.',dlall:'تحميل كل حاجة',print:'طباعة / PDF',m_essay:'أسئلة مقالية',trlec:'ترجم المحاضرة كلها',slide:'سلايد',slload:'تم تحميل السلايدات',noslides:'مفيش سلايدات. ارفع PPTX أو PDF.',essayhint:'اضغط لإظهار الإجابة النموذجية',mcqh:'اختيار من متعدد',essayh:'أسئلة مقالية',flashh:'بطاقات مراجعة',slidesdone:'تم شرح السلايدات ✅ شوف تبويب الشرح.',slbasic:'من غير مفتاح الشرح بيبقى ملخص للنقاط الأساسية في كل سلايد. للشرح الحقيقي حط مفتاح Gemini المجاني.',discuss:'ناقش دور المفهوم ده في المحاضرة:',explain:'اشرح بالتفصيل:',covers:'السلايد دي بتتكلم عن',points:'النقاط:',trlecdone:'ترجمة المحاضرة'});
Object.assign(T.en,{sub:'Lecture studio: summary, slide explanations, quizzes, translation',t_slides:'🖼️ Slides',drop1:'Upload the lecture or slides',drop2:'PPTX, PDF or TXT. Each slide is explained on its own.',upload:'Choose file',goslides:'Explain slides one by one 🖼️',go:'Summarize + make quiz ✨',empty_sl:'Upload a slides file (PPTX or PDF) in the Lecture tab first.',dlall:'Download everything',print:'Print / PDF',m_essay:'Essay questions',trlec:'Translate whole lecture',slide:'Slide',slload:'Slides loaded',noslides:'No slides. Upload a PPTX or PDF.',essayhint:'Tap to show the model answer',mcqh:'Multiple choice',essayh:'Essay questions',flashh:'Flashcards',slidesdone:'Slides explained ✅ see the Slides tab.',slbasic:'Without a key the explanation is a digest of each slide. For a real explanation add the free Gemini key.',discuss:'Discuss the role of this concept in the lecture:',explain:'Explain in detail:',covers:'This slide covers',points:'Points:',trlecdone:'Lecture translation'});
let L=localStorage.lec_ui||'ar';const t=k=>T[L][k]||k;
function ui(){document.documentElement.lang=L;document.documentElement.dir=L==='ar'?'rtl':'ltr';
 $$('[data-i]').forEach(e=>e.textContent=t(e.dataset.i));$$('[data-ph]').forEach(e=>e.placeholder=t(e.dataset.ph));$('#langBtn').textContent=L==='ar'?'EN':'عربي';meta();}
$('#langBtn').onclick=()=>{L=L==='ar'?'en':'ar';localStorage.lec_ui=L;ui()};
$$('#tabs button').forEach(b=>b.onclick=()=>show(b.dataset.tab));
function show(n){$$('#tabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===n));$$('.panel').forEach(p=>p.classList.toggle('active',p.id==='tab-'+n))}
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const isAr=s=>{const a=(s.match(/[\u0600-\u06FF]/g)||[]).length,e=(s.match(/[A-Za-z]/g)||[]).length;return a>e};
const src=$('#src');src.value=localStorage.lec_src||'';
function meta(){const v=src.value.trim();$('#srcMeta').textContent=v?`${v.split(/\s+/).length} ${t('words')} · ${v.length} ${t('chars')}`:''}
src.oninput=()=>{localStorage.lec_src=src.value;meta()};
const st=(el,m,c)=>{el.textContent=m;el.className='status '+(c||'')};
// ---- file input
let SL=[];try{SL=JSON.parse(localStorage.lec_slides||'[]')}catch(e){}
function slInfo(){$('#slideInfo').innerHTML=SL.length?`<span class="tag">${t('slload')}: ${SL.length}</span>`:''}
function saveSL(){try{localStorage.lec_slides=JSON.stringify(SL)}catch(e){}slInfo()}
async function inflate(u8){const ds=new DecompressionStream('deflate-raw');const w=ds.writable.getWriter();w.write(u8);w.close();return new Uint8Array(await new Response(ds.readable).arrayBuffer())}
async function readPptx(buf){const u=new Uint8Array(buf),dv=new DataView(buf);let e=u.length-22;while(e>=0&&dv.getUint32(e,true)!==0x06054b50)e--;if(e<0)throw new Error('bad pptx');
 const n=dv.getUint16(e+10,true);let p=dv.getUint32(e+16,true);const files={};
 for(let i=0;i<n;i++){const m=dv.getUint16(p+10,true),cs=dv.getUint32(p+20,true),nl=dv.getUint16(p+28,true),el=dv.getUint16(p+30,true),cl=dv.getUint16(p+32,true),lo=dv.getUint32(p+42,true);
  const name=new TextDecoder().decode(u.subarray(p+46,p+46+nl));p+=46+nl+el+cl;
  if(!/^ppt\/(slides|notesSlides)\/(slide|notesSlide)\d+\.xml$/.test(name))continue;
  const ls=lo+30+dv.getUint16(lo+26,true)+dv.getUint16(lo+28,true);const raw=u.subarray(ls,ls+cs);files[name]=new TextDecoder().decode(m===8?await inflate(raw):raw)}
 const dec=x=>x.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&#(\d+);/g,(_,c)=>String.fromCharCode(c)).replace(/&amp;/g,'&');
 const txt=x=>(x.match(/<a:p[ >][\s\S]*?<\/a:p>/g)||[]).map(pp=>dec((pp.match(/<a:t[^>]*>([^<]*)<\/a:t>/g)||[]).map(z=>z.replace(/<[^>]+>/g,'')).join(''))).map(z=>z.trim()).filter(Boolean).join('\n');
 const idx=Object.keys(files).filter(k=>k.startsWith('ppt/slides/')).map(k=>+k.match(/(\d+)\.xml/)[1]).sort((a,b)=>a-b);
 return idx.map((k,i)=>({n:i+1,text:txt(files[`ppt/slides/slide${k}.xml`]),notes:txt(files[`ppt/notesSlides/notesSlide${k}.xml`]||'')}))}
async function readPdf(f){const pdfjs=await import('./vendor/pdf.min.mjs');pdfjs.GlobalWorkerOptions.workerSrc='./vendor/pdf.worker.min.mjs';
 const pdf=await pdfjs.getDocument({data:await f.arrayBuffer()}).promise;const out=[];for(let i=1;i<=pdf.numPages;i++){const pg=await pdf.getPage(i);const c=await pg.getTextContent();out.push({n:i,text:c.items.map(x=>x.str+(x.hasEOL?'\n':' ')).join('').replace(/[ \t]+\n/g,'\n').trim(),notes:''})}return out}
async function loadFile(f){const s=$('#status');
 try{let txt='';st(s,t('working'));
  if(/\.pdf$/i.test(f.name)||/\.pptx$/i.test(f.name)){SL=/\.pdf$/i.test(f.name)?await readPdf(f):await readPptx(await f.arrayBuffer());SL=SL.filter(x=>x.text||x.notes);saveSL();const fix=z=>z.split('\n').map(l=>l.trim()).filter(Boolean).map(l=>/[.!?؟:]$/.test(l)?l:l+'.').join('\n');txt=SL.map(x=>fix(x.text+(x.notes?'\n'+x.notes:''))).join('\n\n')}
  else{txt=await f.text();if(/\.(srt|vtt)$/i.test(f.name))txt=txt.replace(/WEBVTT/g,'').replace(/^\d+\s*$/gm,'').replace(/[\d:.,]+ --> [\d:.,]+.*/g,'')}
  src.value=(src.value?src.value+'\n\n':'')+txt.trim();src.oninput();st(s,'')}catch(err){st(s,String(err),'err')}}
$('#file').onchange=async e=>{if(e.target.files[0])await loadFile(e.target.files[0]);e.target.value=''};
const dz=$('#drop');['dragover','dragenter'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.add('over')}));['dragleave','drop'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.remove('over')}));dz.addEventListener('drop',e=>{if(e.dataTransfer.files[0])loadFile(e.dataTransfer.files[0])});
$('#clearBtn').onclick=()=>{src.value='';localStorage.lec_src='';SL=[];saveSL();S=null;SX=null;localStorage.removeItem('lec_state');localStorage.removeItem('lec_sx');meta()};
// ---- mic
let rec=null;$('#micBtn').onclick=()=>{const SR=window.SpeechRecognition||window.webkitSpeechRecognition;const b=$('#micBtn');
 if(!SR)return st($('#status'),t('micno'),'err');if(rec){rec.stop();return}
 rec=new SR();rec.lang=$('#micLang').value;rec.continuous=true;rec.interimResults=false;b.classList.add('rec');
 rec.onresult=e=>{for(let i=e.resultIndex;i<e.results.length;i++)if(e.results[i].isFinal)src.value+=(src.value&&!/\s$/.test(src.value)?' ':'')+e.results[i][0].transcript;src.oninput()};
 rec.onend=()=>{rec=null;b.classList.remove('rec')};rec.start()};
// ---- NLP basics
const SW_EN=new Set('a an the and or but if then so of to in on at by for with from as is are was were be been being this that these those it its they them their we our you your he she his her i me my not no can could will would should may might do does did have has had about into over under than also such which who whom what when where how there here very more most other some any each both just only one two use used using'.split(' '));
const SW_AR=new Set('في من على الى إلى عن مع هذا هذه ذلك تلك هو هي هم هن انا نحن انت التي الذي الذين كان كانت يكون تكون ان أن إن لا لم لن ما ماذا هل او أو ثم قد كل بعض اي أي بين حتى عند عندما هناك هنا كما لكن غير بعد قبل خلال أيضا ايضا فقط جدا وهو وهي'.split(' '));
const normAr=w=>w.replace(/[\u064B-\u0652\u0640]/g,'').replace(/[إأآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه');
const words=s=>(s.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu)||[]);
const stop=w=>SW_EN.has(w)||SW_AR.has(w)||w.length<3||/^\d+$/.test(w);
function sents(txt){return txt.replace(/\r/g,'').split(/(?<=[.!?؟۔])\s+|\n{2,}|\n(?=\s*[-•*\d])/).map(s=>s.replace(/\s+/g,' ').trim()).filter(s=>s.split(' ').length>=4&&s.length<420)}
function tfOf(ss){const f={};ss.forEach(s=>words(s).forEach(w=>{if(!stop(w)){const k=normAr(w);f[k]=(f[k]||0)+1}}));return f}
function rank(ss,f){return ss.map((s,i)=>{const ws=words(s).filter(w=>!stop(w));let sc=ws.reduce((a,w)=>a+(f[normAr(w)]||0),0)/Math.sqrt(ws.length+3);if(i<3)sc*=1.15;return{s,i,sc}})}
function topTerms(f,n){return Object.entries(f).sort((a,b)=>b[1]-a[1]).slice(0,n).map(x=>x[0])}
function localSummary(txt,len){const ss=sents(txt);if(ss.length<3)return null;const f=tfOf(ss);const n={s:5,m:8,l:12}[len];const pick=rank(ss,f).sort((a,b)=>b.sc-a.sc).slice(0,Math.min(n,ss.length)).sort((a,b)=>a.i-b.i).map(x=>x.s);
 const orig={};words(txt).forEach(w=>{orig[normAr(w)]=orig[normAr(w)]||w});return{summary:pick.slice(0,Math.ceil(pick.length/3)).join(' '),points:pick,terms:topTerms(f,10).map(k=>orig[k]||k)}}
function shuffle(a){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]]}return a}
function localQuiz(txt,n){const ss=sents(txt);if(ss.length<3)return{mcq:[],flash:[],essay:[]};const f=tfOf(ss);const pool=topTerms(f,60);const r=rank(ss,f).sort((a,b)=>b.sc-a.sc);
 const mcq=[],flash=[];const defRe=/^([A-Z\u0600-\u06FF][^,.:;]{2,45}?)\s+(is|are|refers to|means|is defined as|هو|هي|هم|يعني|يُعرّف|تعريف[^\s]*)\s+(.{12,})$/;
 for(const x of shuffle(r.slice(0,Math.max(n*3,20)))){
  const d=x.s.match(defRe);if(d&&!/^(what|why|how|when|where|who|which)\b/i.test(d[1])&&flash.length<n)flash.push({q:isAr(x.s)?`يعني إيه ${d[1].trim()}؟`:`What is ${d[1].trim()}?`,a:x.s});
  if(mcq.length>=n)continue;const ws=words(x.s).filter(w=>!stop(w));if(!ws.length)continue;
  const ans=ws.sort((a,b)=>(f[normAr(b)]||0)-(f[normAr(a)]||0))[0];
  const re=new RegExp('(^|[^\\p{L}\\p{N}])('+ans.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')(?![\\p{L}\\p{N}])','iu');if(!re.test(x.s))continue;
  const ds=shuffle(pool.filter(w=>normAr(w)!==normAr(ans)&&Math.abs(w.length-ans.length)<=4&&isAr(w)===isAr(ans))).slice(0,3);if(ds.length<3)continue;
  const opts=shuffle([ans,...ds]);mcq.push({q:x.s.replace(re,'$1_____'),options:opts,answer:opts.indexOf(ans),explanation:x.s})}
 if(!flash.length)r.slice(0,n).forEach(x=>flash.push({q:x.s.split(' ').slice(0,8).join(' ')+' ...؟',a:x.s}));
 const essay=[];const used=new Set();
 flash.filter(f=>/^(What is|يعني إيه)/.test(f.q)).slice(0,Math.ceil(n/2)).forEach(f=>{essay.push({q:(isAr(f.a)?'اشرح بالتفصيل: ':'Explain in detail: ')+f.q.replace(/^(What is |يعني إيه )/,'').replace(/[?؟]$/,''),a:f.a});used.add(f.a)});
 const tm=topTerms(f,12);for(const k of tm){if(essay.length>=Math.ceil(n/2))break;const rel=r.filter(x=>normAr(x.s).includes(k)&&!used.has(x.s)).slice(0,3);if(rel.length<1)continue;rel.forEach(x=>used.add(x.s));essay.push({q:(isAr(rel[0].s)?'اشرح بالتفصيل وناقش دور: ':'Explain and discuss the role of: ')+k,a:rel.map(x=>x.s).join(' ')})}
 return{mcq,flash,essay}}
// ---- Gemini
const cfg=()=>({key:localStorage.lec_key||'',model:localStorage.lec_model||'gemini-flash-latest'});
async function gem(prompt,json){const {key,model}=cfg();const body={contents:[{parts:[{text:prompt}]}],generationConfig:json?{responseMimeType:'application/json',temperature:.4}:{temperature:.2}};
 const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify(body)});
 const j=await r.json();if(!r.ok)throw new Error(j.error?.message||r.status);return j.candidates?.[0]?.content?.parts?.map(p=>p.text).join('')||''}
function aiPrompt(txt,lang,len,n){const L2=lang==='ar'?'Arabic (keep technical terms also in English in parentheses)':'English';
 return `You are a study assistant. Read the lecture text and answer ONLY with JSON of this shape: {"summary":"short paragraph","points":["key point",...],"terms":["term: short definition",...],"mcq":[{"q":"question","options":["a","b","c","d"],"answer":0,"explanation":"why"}],"essay":[{"q":"essay/discussion question","a":"model answer, 3-5 sentences"}],"flash":[{"q":"question","a":"answer"}]}. Write everything in ${L2}. points: ${{s:5,m:8,l:14}[len]} items. mcq: exactly ${n} questions with 4 options, answer is the 0-based index of the correct option, vary the correct position. essay: ${Math.ceil(n/2)} essay questions that need explanation or discussion. flash: ${n} items. Base everything strictly on the lecture text.\n\nLECTURE:\n${txt.slice(0,60000)}`}
// ---- state/render
let S=JSON.parse(localStorage.lec_state||'null');let mode='mcq';
function lang(){const o=$('#outLang').value;return o==='auto'?(isAr(src.value)?'ar':'en'):o}
function renderSum(){const o=$('#sumOut');if(!S)return;const d=lang()==='ar'||isAr(S.summary||'')?'rtl':'ltr';o.className='out';o.dir='auto';
 o.innerHTML=`<h3>${t('summary')}</h3><p dir="auto">${esc(S.summary)}</p><h3>${t('keypts')}</h3><ul>${S.points.map(p=>`<li dir="auto">${esc(p)}</li>`).join('')}</ul>${S.terms?.length?`<h3>${t('terms')}</h3><ul>${S.terms.map(p=>`<li dir="auto">${esc(p)}</li>`).join('')}</ul>`:''}`}
function renderQuiz(){const o=$('#quizOut');if(!S)return;o.className='out';o.innerHTML='';
 if(mode==='mcq'){let right=0,done=0;const sc=document.createElement('div');sc.className='score';o.append(sc);
  (S.mcq||[]).forEach((q,qi)=>{const d=document.createElement('div');d.className='q';d.innerHTML=`<p dir="auto">${qi+1}. ${esc(q.q)}</p>`;
   q.options.forEach((op,oi)=>{const b=document.createElement('button');b.className='opt';b.dir='auto';b.textContent=op;b.onclick=()=>{if(d.dataset.done)return;d.dataset.done=1;done++;
    const ok=oi===q.answer;if(ok)right++;b.classList.add(ok?'ok':'bad');d.querySelectorAll('.opt')[q.answer].classList.add('ok');
    if(q.explanation){const e=document.createElement('div');e.className='exp';e.dir='auto';e.textContent=q.explanation;d.append(e)}sc.textContent=`${t('score')}: ${right}/${done} (${S.mcq.length})`};d.append(b)});o.append(d)});
  if(!S.mcq?.length)o.innerHTML=`<p>${t('short')}</p>`}
 else if(mode==='essay'){(S.essay||[]).forEach((q,i)=>{const d=document.createElement('div');d.className='q essay';d.innerHTML=`<p dir="auto">${i+1}. ${esc(q.q)}</p><div class="meta">${t('essayhint')}</div><div class="a" dir="auto">${esc(q.a)}</div>`;d.onclick=()=>d.classList.toggle('open');o.append(d)});if(!S.essay?.length)o.innerHTML=`<p>${t('short')}</p>`}
 else{(S.flash||[]).forEach((q,i)=>{const d=document.createElement('div');d.className='q flash';d.innerHTML=`<p dir="auto">${i+1}. ${esc(q.q)}</p><div class="meta">${t('showa')}</div><div class="a" dir="auto">${esc(q.a)}</div>`;d.onclick=()=>d.classList.toggle('open');o.append(d)})}}
$$('.mode').forEach(b=>b.onclick=()=>{mode=b.dataset.mode;$$('.mode').forEach(x=>x.classList.toggle('active',x===b));renderQuiz()});
const save=()=>localStorage.lec_state=JSON.stringify(S);
async function run(onlyQuiz){const txt=src.value.trim(),s=$('#status');if(txt.split(/\s+/).length<30)return st(s,t('short'),'err');st(s,t('working'));$('#goBtn').disabled=true;
 const n=+$('#qn').value,len=$('#len').value,lg=lang();let res=null;
 if(cfg().key){try{res=JSON.parse((await gem(aiPrompt(txt,lg,len,n),true)).replace(/^```json|```$/g,''));res.points=res.points||[];res.mcq=(res.mcq||[]).filter(q=>q.options?.length>1&&q.answer<q.options.length);res.flash=res.flash||[];res.essay=res.essay||[]}catch(e){res=null;st(s,t('aifail')+e.message,'err')}}
 if(!res){const a=localSummary(txt,len),q=localQuiz(txt,n);if(!a){$('#goBtn').disabled=false;return st(s,t('short'),'err')}res={...a,...q}}
 S=res;save();renderSum();renderQuiz();$('#goBtn').disabled=false;if(s.className.indexOf('err')<0)st(s,t('done'),'ok');show('sum')}
$('#goBtn').onclick=()=>run();
$('#regen').onclick=()=>{if(!src.value.trim())return;const n=+$('#qn').value;if(cfg().key)return run();const q=localQuiz(src.value,n);S={...(S||{summary:'',points:[],terms:[]}),...q};save();renderQuiz()};
const sumText=()=>S?`${S.summary}\n\n${S.points.map(p=>'- '+p).join('\n')}${S.terms?.length?'\n\n'+S.terms.map(p=>'* '+p).join('\n'):''}`:'';
const allText=()=>{let o=sumText();if(SX)o+='\n\n=== '+t('t_slides')+' ===\n'+SX.map(x=>`[${x.n}] ${x.title}\n${x.explanation}`).join('\n\n');if(S?.mcq?.length)o+='\n\n=== MCQ ===\n'+S.mcq.map((q,i)=>`${i+1}. ${q.q}\n${q.options.map((x,j)=>(j===q.answer?'  * ':'    ')+x).join('\n')}`).join('\n');if(S?.essay?.length)o+='\n\n=== Essay ===\n'+S.essay.map((q,i)=>`${i+1}. ${q.q}\n   ${q.a}`).join('\n\n');return o};
const _unused=()=>S?`${S.summary}\n\n${S.points.map(p=>'- '+p).join('\n')}${S.terms?.length?'\n\n'+S.terms.map(p=>'* '+p).join('\n'):''}`:'';
$('#copySum').onclick=async()=>{await navigator.clipboard.writeText(sumText());$('#copySum').textContent=t('copied');setTimeout(()=>$('#copySum').textContent=t('copy'),1200)};
$('#dlSum').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([allText()],{type:'text/plain'}));a.download='zakirli-study-pack.txt';a.click()};
$('#printBtn').onclick=()=>{const w=window.open('','_blank');if(!w)return;w.document.write(`<meta charset=utf-8><body dir=auto style="font-family:system-ui;max-width:760px;margin:30px auto;line-height:1.7"><pre style="white-space:pre-wrap;font:inherit">${esc(allText())}</pre>`);w.document.close();w.print()};
$('#trSum').onclick=()=>{if(!S)return;$('#trIn').value=sumText();$('#trDir').value=isAr(S.summary)?'ar|en':'en|ar';show('tr');doTr()};
// ---- translate
function chunks(txt,max=420){const out=[];let cur='';for(const p of txt.split(/(?<=[.!?؟\n])\s*/)){if((cur+p).length>max&&cur){out.push(cur);cur=''}cur+=p+' ';while(cur.length>max){out.push(cur.slice(0,max));cur=cur.slice(max)}}if(cur.trim())out.push(cur);return out.map(x=>x.trim()).filter(Boolean)}
async function translate(txt,from,to){
 if(cfg().key){try{return (await gem(`Translate the following text from ${from==='ar'?'Arabic':'English'} to ${to==='ar'?'Arabic':'English'}. Keep line breaks and bullet marks. Output only the translation.\n\n${txt}`)).trim()}catch(e){}}
 if(window.Translator){try{const tr=await window.Translator.create({sourceLanguage:from,targetLanguage:to});return await tr.translate(txt)}catch(e){}}
 const outp=[];for(const c of chunks(txt)){const r=await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(c)}&langpair=${from}|${to}`);const j=await r.json();if(j.responseStatus!=200)throw new Error(j.responseDetails||j.responseStatus);outp.push(j.responseData.translatedText)}return outp.join(' ')}
async function doTr(){const v=$('#trIn').value.trim();if(!v)return;const [f,to]=$('#trDir').value.split('|');const s=$('#trStatus');st(s,t('working'));
 try{const r=await translate(v,f,to);$('#trOut').textContent=r;st(s,'')}catch(e){st(s,t('trfail')+e.message,'err')}}
$('#trBtn').onclick=doTr;
$('#trIn').oninput=()=>{$('#trDir').value=isAr($('#trIn').value)?'ar|en':'en|ar'};
// ---- settings
$('#key').value=cfg().key;$('#model').value=cfg().model;
$('#saveKey').onclick=()=>{localStorage.lec_key=$('#key').value.trim();localStorage.lec_model=$('#model').value.trim()||'gemini-flash-latest';st($('#keyStatus'),t('saved'),'ok')};
$('#testKey').onclick=async()=>{$('#saveKey').click();if(!cfg().key)return st($('#keyStatus'),t('nokey'),'err');try{await gem('Reply with OK');st($('#keyStatus'),t('ok'),'ok')}catch(e){st($('#keyStatus'),e.message,'err')}};
// ---- pwa
let dp;addEventListener('beforeinstallprompt',e=>{e.preventDefault();dp=e;$('#installBtn').hidden=false});$('#installBtn').onclick=async()=>{if(dp){dp.prompt();dp=null;$('#installBtn').hidden=true}};
if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js');
ui();if(S){renderSum();renderQuiz()}
window.__lec={localSummary,localQuiz,sents,chunks};
// ---- slides
let SX=null;try{SX=JSON.parse(localStorage.lec_sx||'null')}catch(e){}
function localSlides(){const f=tfOf(sents(src.value));return SL.map(x=>{const lines=(x.text||'').split('\n').map(z=>z.trim()).filter(Boolean);const title=lines[0]||`${t('slide')} ${x.n}`;const body=lines.slice(1);const ar=isAr(x.text||'');
  const expl=(ar?'الشريحة دي بتتكلم عن ':'This slide covers ')+title.replace(/[.:?؟]+$/,'')+(body.length?(ar?'. النقاط:\n':'. Points:\n')+body.map(b=>'• '+b).join('\n'):'')+(x.notes?'\n\n'+x.notes:'');
  const tm=topTerms(tfOf(lines.map(z=>z.length>4?z+'.':z)),4);return{n:x.n,title,explanation:expl,terms:tm,raw:x.text}})}
async function runSlides(){const s=$('#status');if(!SL.length){st(s,t('noslides'),'err');show('in');return}st(s,t('working'));const lg=lang();let out=null;
 if(cfg().key){try{out=[];const L2=lg==='ar'?'Arabic (keep technical terms in English in parentheses)':'English';
  for(let i=0;i<SL.length;i+=12){const part=SL.slice(i,i+12);const r=JSON.parse((await gem(`You are a university teacher. Explain each slide below to a student who sees it for the first time. For every slide give a title, a clear explanation in 3-6 sentences (what it means, why it matters, an example if useful) and up to 4 key terms. Write in ${L2}. Answer ONLY with JSON: [{"n":number,"title":"","explanation":"","terms":[""]}]. Keep the n values given.\n\nSLIDES:\n${JSON.stringify(part.map(x=>({n:x.n,text:x.text,notes:x.notes})))}`,true)).replace(/^```json|```$/g,''));out.push(...r)}
  const m={};SL.forEach(x=>m[x.n]=x.text);out.forEach(x=>x.raw=m[x.n]||'')}catch(e){out=null;st(s,t('aifail')+e.message,'err')}}
 if(!out)out=localSlides();SX=out;try{localStorage.lec_sx=JSON.stringify(SX)}catch(e){}renderSlides();if(!s.className.includes('err'))st(s,t('slidesdone')+(cfg().key?'':' '+t('slbasic')),'ok');show('slides')}
function renderSlides(){const o=$('#slidesOut');if(!SX)return;o.className='out';o.innerHTML=SX.map(x=>`<div class="sl"><div class="h"><span class="n">${x.n}</span><span dir="auto">${esc(x.title||'')}</span></div><div class="b"><div dir="auto" style="white-space:pre-wrap">${esc(x.explanation||'')}</div>${x.terms?.length?`<div class="chipline" style="margin-top:8px">${x.terms.map(k=>`<span class="tag">${esc(k)}</span>`).join('')}</div>`:''}${x.raw?`<div class="raw" dir="auto">${esc(x.raw)}</div>`:''}</div></div>`).join('')}
$('#goSlides').onclick=runSlides;$('#goSlides2').onclick=runSlides;slInfo();if(SX)renderSlides();
// ---- translate whole lecture
$('#trLec').onclick=async()=>{const v=src.value.trim();if(!v)return;const f=isAr(v)?'ar':'en',to=f==='ar'?'en':'ar';$('#trDir').value=f+'|'+to;$('#trIn').value=v;const s=$('#trStatus');st(s,t('working'));$('#trLec').disabled=true;
 try{const parts=cfg().key?v.match(/[\s\S]{1,6000}(?:\s|$)/g):[v];const res=[];for(const p of parts)res.push(await translate(p,f,to));$('#trOut').textContent=res.join('\n');st(s,'')}catch(e){st(s,t('trfail')+e.message,'err')}$('#trLec').disabled=false};
