import {generateAI,generateOffline,detectLang} from './core.js';
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let current=null, srcText='';
const KEY='mudhakkirni.sets.v1';
const loadLib=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return[]}};
const saveLib=l=>localStorage.setItem(KEY,JSON.stringify(l.slice(0,30)));

// tabs
function show(tab){
  document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
  document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('active',p.id==='tab-'+tab));
  if(tab==='library')renderLib();
  scrollTo(0,0);
}
$('#tabs').addEventListener('click',e=>{const b=e.target.closest('button');if(b&&!b.disabled)show(b.dataset.tab)});
function status(msg,err){const s=$('#status');s.hidden=!msg;s.textContent=msg||'';s.classList.toggle('err',!!err)}

// file reading
async function readPDF(file){
  const pdfjs=await import('./vendor/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdf.worker.min.mjs',import.meta.url).href;
  const pdf=await pdfjs.getDocument({data:await file.arrayBuffer()}).promise;
  let out='';
  for(let i=1;i<=pdf.numPages;i++){
    status(`جاري قراءة الصفحة ${i} من ${pdf.numPages}...`);
    const pg=await pdf.getPage(i);const c=await pg.getTextContent();
    let line='',lastY=null;
    for(const it of c.items){
      if(lastY!==null&&Math.abs(it.transform[5]-lastY)>4)line+='\n';
      line+=it.str+(it.hasEOL?'\n':' ');lastY=it.transform[5];
    }
    out+=line+'\n\n';
  }
  return {text:out,pages:pdf.numPages};
}
async function handleFile(f){
  if(!f)return;
  try{
    status('جاري قراءة الملف...');
    let t='';
    if(/pdf$/i.test(f.name)||f.type==='application/pdf'){const r=await readPDF(f);t=r.text}
    else t=await f.text();
    t=t.trim();
    if(t.length<50){status('مقدرتش أستخرج نص من الملف. لو ده PDF صور (مسكان) انسخ النص والصقه يدوي.',true);return}
    $('#text').value=t;$('#text').dataset.name=f.name;
    status('');updateMeta();
  }catch(e){console.error(e);status('حصل خطأ في قراءة الملف: '+e.message,true)}
}
$('#file').addEventListener('change',e=>handleFile(e.target.files[0]));
const drop=$('#drop');
['dragover','dragenter'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('over')}));
['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('over')}));
drop.addEventListener('drop',e=>handleFile(e.dataTransfer.files[0]));
function updateMeta(){const t=$('#text').value;$('#meta').textContent=t?`${t.length.toLocaleString('ar-EG')} حرف · حوالي ${t.split(/\s+/).length.toLocaleString('ar-EG')} كلمة`+($('#text').dataset.name?` · ${$('#text').dataset.name}`:''):''}
$('#text').addEventListener('input',()=>{delete $('#text').dataset.name;updateMeta()});
$('#sample').addEventListener('click',()=>{
  $('#text').value=`التمثيل الضوئي هو العملية التي تحول بها النباتات الخضراء الطاقة الضوئية إلى طاقة كيميائية مخزنة في الجلوكوز. تحدث هذه العملية في البلاستيدات الخضراء التي تحتوي على صبغة الكلوروفيل. يمتص الكلوروفيل الضوء الأحمر والأزرق ويعكس الضوء الأخضر، ولذلك تبدو الأوراق خضراء. تحتاج العملية إلى ثاني أكسيد الكربون الذي يدخل عبر الثغور، وإلى الماء الذي تمتصه الجذور. ينتج عن التمثيل الضوئي الجلوكوز والأكسجين. تنقسم العملية إلى مرحلتين: التفاعلات الضوئية التي تحدث في أغشية الثايلاكويد وتنتج ATP وNADPH، ودورة كالفن التي تحدث في الستروما وتستخدم الطاقة المخزنة لتثبيت ثاني أكسيد الكربون وتكوين السكر. تتأثر سرعة التمثيل الضوئي بشدة الإضاءة وتركيز ثاني أكسيد الكربون ودرجة الحرارة. يعتمد معظم الغذاء على الأرض بشكل مباشر أو غير مباشر على هذه العملية، كما أنها المصدر الرئيسي للأكسجين في الغلاف الجوي.`;
  delete $('#text').dataset.name;updateMeta();
});

// generate
$('#go').addEventListener('click',async()=>{
  const text=$('#text').value.trim();
  if(text.length<80){status('ضيف نص أو ملف الأول (80 حرف على الأقل).',true);return}
  const nQ=+$('#qcount').value;let lang=$('#lang').value;if(lang==='auto')lang=detectLang(text);
  const btn=$('#go');btn.disabled=true;
  try{
    let res;
    if($('#mode').value==='offline'||!navigator.onLine){
      if($('#mode').value!=='offline')status('مفيش إنترنت، هستخدم الوضع المبسّط...');
      res=generateOffline(text,{nQ});
    }else{
      status('⏳ الذكاء الاصطناعي بيذاكر الملف...');
      try{
        res=await generateAI(text,{lang,nQ,onProgress:(i,n)=>status(`⏳ جاري التحليل... (${Math.min(i+1,n)}/${n})`+(n>1?' الملفات الكبيرة بتاخد دقيقة أو أكتر لأن الخدمة المجانية بتسمح برد كل 45 ثانية':'')),onWait:w=>status(`الخدمة المجانية مشغولة، هحاول تاني بعد ${w} ثانية...`)});
        if(!res.quiz.length&&!res.cards.length)throw new Error('empty result');
      }catch(e){
        console.error(e);
        status('الخدمة مشغولة دلوقتي. هستخدم الوضع المبسّط بدل ما تستنى...');
        res=generateOffline(text,{nQ});res.offline=true;
      }
    }
    const name=$('#text').dataset.name||'';
    current={id:Date.now(),title:res.title||name.replace(/\.[^.]+$/,'')||text.slice(0,30).replace(/\s+/g,' ')+'...',date:new Date().toLocaleDateString('ar-EG'),lang,...res,known:[]};
    const lib=loadLib();lib.unshift(current);saveLib(lib);
    open(current);status('');
  }catch(e){console.error(e);status(e.message||'حصل خطأ',true)}
  finally{btn.disabled=false}
});

function renderSummary(s){
  $('#setTitle').textContent=s.title;
  const html=esc(s.summary).replace(/#### (\d+)\n/g,'<h4>الجزء $1</h4>').split(/\n/).map(l=>l.startsWith('<h4>')?l:`<p>${l}</p>`).join('');
  $('#summaryBox').innerHTML=(s.offline?'<div class="status">ده ملخص مبسّط (بدون ذكاء اصطناعي).</div>':'')+html;
  $('#points').innerHTML=s.points.map(p=>`<li>${esc(p)}</li>`).join('');
}
function renderQuiz(s){
  const box=$('#quizBox');
  if(!s.quiz.length){box.innerHTML='<p>مفيش أسئلة كفاية من النص ده.</p>';return}
  let score=0,done=0;
  box.innerHTML=`<h2>اختبر نفسك (${s.quiz.length} سؤال)</h2><div id="qs"></div><div id="score"></div><button class="ghost" id="retry">إعادة الاختبار</button>`;
  const qs=box.querySelector('#qs');
  s.quiz.forEach((q,qi)=>{
    const d=document.createElement('div');d.className='q';
    d.innerHTML=`<div class="qt">${qi+1}. ${esc(q.q)}</div>`+q.options.map((o,i)=>`<button class="opt" data-i="${i}">${esc(o)}</button>`).join('')+'<div class="expl" hidden></div>';
    d.addEventListener('click',e=>{
      const b=e.target.closest('.opt');if(!b||d.dataset.done)return;d.dataset.done=1;done++;
      const i=+b.dataset.i;d.querySelectorAll('.opt')[q.answer].classList.add('right');
      if(i===q.answer)score++;else b.classList.add('wrong');
      const ex=d.querySelector('.expl');if(q.why){ex.hidden=false;ex.textContent='💡 '+q.why}
      if(done===s.quiz.length)box.querySelector('#score').innerHTML=`<div class="score">نتيجتك: ${score} / ${s.quiz.length} ${score/s.quiz.length>=.8?'🔥 ممتاز':score/s.quiz.length>=.5?'👍 كويس، راجع الغلط':'📖 محتاج مراجعة تانية'}</div>`;
    });
    qs.appendChild(d);
  });
  box.querySelector('#retry').onclick=()=>renderQuiz(s);
}
function renderCards(s){
  const box=$('#cardBox');
  if(!s.cards.length){box.innerHTML='<p>مفيش بطاقات.</p>';return}
  let i=0;const known=new Set(s.known||[]);
  const draw=()=>{
    const c=s.cards[i];
    box.innerHTML=`<h2>بطاقات المراجعة</h2><div class="hint">بطاقة ${i+1} من ${s.cards.length} · حفظت ${known.size}</div>
    <div class="card3d"><div class="card" id="card"><div class="face">${esc(c.f)}</div><div class="face back">${esc(c.b).replace(/\n/g,'<br>')}</div></div></div>
    <div class="cardnav"><button id="prev">→ السابق</button><button class="no" id="no">لسه ❌</button><button class="ok" id="ok">حافظها ✅</button><button id="next">التالي ←</button></div>
    <div class="cardnav"><button id="shuf">🔀 خلط</button></div>`;
    const card=box.querySelector('#card');card.onclick=()=>card.classList.toggle('flip');
    const go=d=>{i=(i+d+s.cards.length)%s.cards.length;draw()};
    box.querySelector('#prev').onclick=()=>go(-1);box.querySelector('#next').onclick=()=>go(1);
    box.querySelector('#ok').onclick=()=>{known.add(i);persistKnown();go(1)};
    box.querySelector('#no').onclick=()=>{known.delete(i);persistKnown();go(1)};
    box.querySelector('#shuf').onclick=()=>{s.cards.sort(()=>Math.random()-.5);i=0;known.clear();draw()};
  };
  const persistKnown=()=>{s.known=[...known];const l=loadLib();const x=l.find(y=>y.id===s.id);if(x){x.known=s.known;saveLib(l)}};
  draw();
}
function open(s){
  current=s;
  ['summary','quiz','cards'].forEach(t=>document.querySelector(`[data-tab=${t}]`).disabled=false);
  renderSummary(s);renderQuiz(s);renderCards(s);show('summary');
}
$('#copySummary').onclick=async()=>{try{await navigator.clipboard.writeText(current.summary.replace(/#### \d+\n/g,'')+'\n\n'+current.points.map(p=>'- '+p).join('\n'));$('#copySummary').textContent='اتنسخ ✅'}catch{}};
function renderLib(){
  const l=loadLib(),box=$('#libBox');
  if(!l.length){box.innerHTML='<p class="hint">لسه مفيش حاجة محفوظة. أي ملف تذاكره بيتحفظ هنا على جهازك.</p>';return}
  box.innerHTML=l.map(s=>`<div class="lib"><div><strong>${esc(s.title)}</strong><br><small>${esc(s.date)} · ${s.quiz.length} سؤال · ${s.cards.length} بطاقة</small></div><div><button class="ghost" data-open="${s.id}">فتح</button> <button class="ghost" data-del="${s.id}">🗑</button></div></div>`).join('');
}
$('#libBox').addEventListener('click',e=>{
  const o=e.target.closest('[data-open]'),d=e.target.closest('[data-del]');
  if(o){const s=loadLib().find(x=>x.id==o.dataset.open);if(s)open(s)}
  if(d){saveLib(loadLib().filter(x=>x.id!=d.dataset.del));renderLib()}
});

// PWA
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
let dp;addEventListener('beforeinstallprompt',e=>{e.preventDefault();dp=e;$('#installBtn').hidden=false});
$('#installBtn').onclick=async()=>{if(dp){dp.prompt();await dp.userChoice;dp=null;$('#installBtn').hidden=true}};
