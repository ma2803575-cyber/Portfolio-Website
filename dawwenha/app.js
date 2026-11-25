import {organizeAI,organizeOffline,renderNote} from './ai.js';
import {transcribeFile} from './stt.js';

const $=id=>document.getElementById(id);
const LS='dawwenha.notes.v1';
let notes=[];try{notes=JSON.parse(localStorage.getItem(LS))||[]}catch{}
const persist=()=>localStorage.setItem(LS,JSON.stringify(notes));
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const fmtDur=s=>{s=Math.round(s||0);return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')};
const fmtDate=iso=>new Date(iso).toLocaleString('ar-EG',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'});

function msg(t,err){const m=$('msg');m.textContent=t;m.classList.remove('hidden');m.classList.toggle('err',!!err);clearTimeout(m._t);if(!err)m._t=setTimeout(()=>m.classList.add('hidden'),6000)}
function busy(t){msg(t)}

// ---------- IndexedDB for audio blobs ----------
const idb={db:null,
 open(){return new Promise((res,rej)=>{if(this.db)return res(this.db);
   const r=indexedDB.open('dawwenha',1);
   r.onupgradeneeded=()=>r.result.createObjectStore('audio');
   r.onsuccess=()=>{this.db=r.result;res(this.db)};r.onerror=()=>rej(r.error)})},
 async put(id,blob){const db=await this.open();return new Promise((res,rej)=>{const tx=db.transaction('audio','readwrite');tx.objectStore('audio').put(blob,id);tx.oncomplete=res;tx.onerror=()=>rej(tx.error)})},
 async get(id){const db=await this.open();return new Promise((res,rej)=>{const q=db.transaction('audio').objectStore('audio').get(id);q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)})},
 async del(id){const db=await this.open();return new Promise((res,rej)=>{const tx=db.transaction('audio','readwrite');tx.objectStore('audio').delete(id);tx.oncomplete=res;tx.onerror=()=>rej(tx.error)})}
};

// ---------- Tabs ----------
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===b));
  document.querySelectorAll('main > section.panel').forEach(s=>{if(s.id.startsWith('tab-'))s.classList.add('hidden')});
  $('tab-'+b.dataset.tab).classList.remove('hidden');
});

// ---------- Draft (shared by record/upload/write) ----------
let draft=null; // {id,blob,duration,raw,org,source}
function showDraft(){
  const d=$('draft');if(!draft){d.classList.add('hidden');return}
  d.classList.remove('hidden');
  $('draftTxt').value=draft.raw||'';
  const au=$('draftAudio');
  if(draft.blob){au.src=URL.createObjectURL(draft.blob);au.classList.remove('hidden')}else{au.removeAttribute('src');au.classList.add('hidden')}
  $('sttDraftBtn').classList.toggle('hidden',!draft.blob);
  $('orgOut').classList.add('hidden');
  d.scrollIntoView({behavior:'smooth'});
}
$('discardBtn').onclick=()=>{draft=null;showDraft();msg('اتمسحت المسودة')};
$('draftTxt').oninput=()=>{if(draft)draft.raw=$('draftTxt').value};

// ---------- Recording (MediaRecorder + live Web Speech when available) ----------
let mr=null,chunks=[],recStart=0,tick=null,sr=null,liveFinal='',stream=null;
function liveSR(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR)return null;
  const r=new SR();r.lang='ar-EG';r.continuous=true;r.interimResults=true;
  let alive=true;
  r.onresult=e=>{let interim='';for(let i=e.resultIndex;i<e.results.length;i++){const t=e.results[i][0].transcript;if(e.results[i].isFinal)liveFinal+=(liveFinal?' ':'')+t.trim();else interim=t}
    $('liveBox').innerHTML=esc(liveFinal)+(interim?' <span class="interim">'+esc(interim)+'</span>':'')};
  r.onend=()=>{if(alive){try{r.start()}catch{}}};
  r.onerror=()=>{};
  try{r.start()}catch{return null}
  return {stop(){alive=false;try{r.stop()}catch{}}};
}
const esc=s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));

$('recBtn').onclick=async()=>{
  if(mr&&mr.state==='recording'){mr.stop();return}
  try{
    stream=await navigator.mediaDevices.getUserMedia({audio:true});
  }catch(e){msg('محتاج إذن المايك عشان نسجل. اسمح بالمايك من إعدادات المتصفح.',1);return}
  const types=['audio/webm;codecs=opus','audio/webm','audio/mp4','audio/ogg;codecs=opus'];
  const mime=types.find(t=>window.MediaRecorder&&MediaRecorder.isTypeSupported(t))||'';
  chunks=[];liveFinal='';
  mr=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);
  mr.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
  mr.onstop=()=>{
    clearInterval(tick);stream.getTracks().forEach(t=>t.stop());
    if(sr){sr.stop();sr=null}
    $('recBtn').classList.remove('on');$('recLabel').textContent='ابدأ التسجيل';
    $('recTimer').classList.add('hidden');$('liveBox').classList.add('hidden');
    const blob=new Blob(chunks,{type:mr.mimeType||'audio/webm'});
    const dur=(Date.now()-recStart)/1000;
    draft={id:uid(),blob,duration:dur,raw:liveFinal,org:null,source:'rec'};
    showDraft();
    if(!liveFinal)msg('اتسجل الصوت ('+fmtDur(dur)+'). المتصفح ده مش بيدعم نص لحظي، دوس "حوّل الصوت لنص" أو "نظّم" بعدها.');
    else msg('اتسجل ('+fmtDur(dur)+'). راجع النص ودوس نظّم أو حفظ.');
  };
  mr.start(1000);recStart=Date.now();
  sr=liveSR();
  if(!sr)$('recHint').textContent='المتصفح ده مش بيدعم التعرف اللحظي على الكلام. سجّل عادي وبعد الوقف دوس "حوّل الصوت لنص" وهيتحول على جهازك.';
  $('recBtn').classList.add('on');$('recLabel').textContent='⏹ إيقاف';
  $('recTimer').classList.remove('hidden');$('liveBox').classList.remove('hidden');$('liveBox').textContent='بيسمعك...';
  tick=setInterval(()=>{$('recTimer').textContent=fmtDur((Date.now()-recStart)/1000)},250);
};

// ---------- Upload + Whisper ----------
$('fileIn').onchange=()=>{
  const f=$('fileIn').files[0];
  $('fileInfo').textContent=f?('📄 '+f.name+' — '+(f.size/1048576).toFixed(1)+' ميجا'):'';
  $('sttBtn').disabled=!f;
};
async function runSTT(blob,model){
  $('sttBar').classList.remove('hidden');
  const txt=await transcribeFile(blob,{model,
    onProgress:p=>{$('sttFill').style.width=Math.round(p*100)+'%'},
    onStage:s=>busy(s)});
  $('sttBar').classList.add('hidden');$('sttFill').style.width='0';
  return txt;
}
$('sttBtn').onclick=async()=>{
  const f=$('fileIn').files[0];if(!f)return;
  $('sttBtn').disabled=true;
  try{
    const txt=await runSTT(f,$('modelSel').value);
    if(!txt)throw new Error('مفيش كلام اتسمع في الملف');
    draft={id:uid(),blob:f,duration:0,raw:txt,org:null,source:'upload'};
    showDraft();msg('اتحوّل لنص ✅ راجعه ودوس نظّم أو حفظ.');
  }catch(e){msg('مشكلة في التحويل: '+(e.message||e),1)}
  finally{$('sttBtn').disabled=false}
};
$('sttDraftBtn').onclick=async()=>{
  if(!draft?.blob)return;
  $('sttDraftBtn').disabled=true;
  try{
    const txt=await runSTT(draft.blob,$('modelSel').value);
    if(!txt)throw new Error('مفيش كلام اتسمع');
    draft.raw=(draft.raw?draft.raw+' ':'')+txt;$('draftTxt').value=draft.raw;
    msg('اتحوّل لنص ✅');
  }catch(e){msg('مشكلة في التحويل: '+(e.message||e),1)}
  finally{$('sttDraftBtn').disabled=false}
};

// ---------- Write tab ----------
$('writeBtn').onclick=()=>{
  const t=$('writeTxt').value.trim();
  if(t.length<10){msg('اكتب نص أطول شوية',1);return}
  draft={id:uid(),blob:null,duration:0,raw:t,org:null,source:'write'};
  showDraft();doOrganize();
};

// ---------- Organize ----------
let organizing=false;
async function doOrganize(){
  if(!draft||organizing)return;
  const text=(draft.raw||'').trim();
  if(text.length<10){msg('مفيش نص كفاية يتنظّم',1);return}
  organizing=true;$('organizeBtn').disabled=true;
  try{
    const org=await organizeAI(text,{onWait:w=>busy('الخدمة المجانية مشغولة، مستني '+w+' ثانية…'),onProgress:(i,n)=>busy(n>1?('بيظبط الجزء '+(i+1)+' من '+n+'…'):'بيظبط الملاحظات…')});
    draft.org=org;showOrg(org);msg('اتنظّمت ✅ دوس حفظ.');
  }catch(e){
    try{const org=organizeOffline(text);draft.org=org;showOrg(org);msg('خدمة الذكاء الاصطناعي مش متاحة دلوقتي، فنظّمناها محلياً (أبسط). دوس حفظ.');}
    catch(e2){msg('حصلت مشكلة في التنظيم: '+(e.message||e),1)}
  }finally{organizing=false;$('organizeBtn').disabled=false}
}
$('organizeBtn').onclick=doOrganize;
function showOrg(org){
  $('orgOut').classList.remove('hidden');
  $('orgTitle').textContent=org.title||'بدون عنوان';
  $('orgTags').innerHTML=(org.tags||[]).map(t=>'<span class="tag">'+esc(t)+'</span>').join('');
  $('orgText').textContent=renderNote(org,'');
}

// ---------- Save ----------
$('saveBtn').onclick=async()=>{
  if(!draft)return;
  const raw=(draft.raw||'').trim();
  if(!raw&&!draft.blob){msg('مفيش حاجة تتحفظ',1);return}
  const org=draft.org;
  const note={
    id:draft.id,date:new Date().toISOString(),duration:draft.duration||0,
    title:(org&&org.title)||raw.split(' ').slice(0,8).join(' ')||'تسجيل صوتي',
    text:org?renderNote(org,raw):raw,
    raw,tags:(org&&org.tags)||[],hasAudio:!!draft.blob
  };
  if(draft.blob)await idb.put(note.id,draft.blob);
  notes.unshift(note);persist();renderList();
  draft=null;showDraft();$('writeTxt').value='';$('fileIn').value='';$('fileInfo').textContent='';$('sttBtn').disabled=true;
  msg('اتحفظت ✅');
};

// ---------- Library ----------
function renderList(){
  const q=($('search').value||'').trim();
  const list=$('notes');list.innerHTML='';
  const arr=notes.filter(n=>!q||(n.title+' '+n.text+' '+n.tags.join(' ')).includes(q));
  $('count').textContent=notes.length?('('+notes.length+')'):'';
  if(!arr.length){list.innerHTML='<div class="empty">مفيش ملاحظات لسه. سجّل أول واحدة فوق ☝️</div>';return}
  for(const n of arr){
    const el=document.createElement('div');el.className='note';
    el.innerHTML='<div class="ic">'+(n.hasAudio?'🎧':'📝')+'</div><div class="ti"><b></b><small></small></div>';
    el.querySelector('b').textContent=n.title;
    el.querySelector('small').textContent=fmtDate(n.date)+(n.duration?' · '+fmtDur(n.duration):'')+(n.tags.length?' · '+n.tags.slice(0,3).join('، '):'');
    el.onclick=()=>openNote(n.id);
    list.appendChild(el);
  }
}
$('search').oninput=renderList;

// ---------- Viewer ----------
let cur=null;
async function openNote(id){
  cur=notes.find(n=>n.id===id);if(!cur)return;
  $('vTitle').textContent=cur.title;
  $('vMeta').textContent=fmtDate(cur.date)+(cur.duration?' · '+fmtDur(cur.duration):'')+(cur.tags.length?' · '+cur.tags.join('، '):'');
  $('vText').textContent=cur.text;
  if(cur.raw&&cur.raw!==cur.text){$('vRaw').textContent=cur.raw;$('vRawWrap').classList.remove('hidden')}else $('vRawWrap').classList.add('hidden');
  const au=$('vAudio');au.classList.add('hidden');au.removeAttribute('src');
  if(cur.hasAudio){const b=await idb.get(id);if(b){au.src=URL.createObjectURL(b);au.classList.remove('hidden')}}
  $('viewer').classList.remove('hidden');
}
$('closeV').onclick=()=>{$('viewer').classList.add('hidden');cur=null};
$('vCopy').onclick=async()=>{try{await navigator.clipboard.writeText(cur.text);msg('اتنسخت 📋')}catch{msg('النسخ مش متاح',1)}};
$('vShare').onclick=async()=>{
  if(navigator.share){try{await navigator.share({title:cur.title,text:cur.text})}catch{}}
  else{try{await navigator.clipboard.writeText(cur.text);msg('المشاركة مش متاحة هنا، فاتنسخت 📋')}catch{}}
};
$('vDl').onclick=()=>{
  const b=new Blob([cur.title+'\n\n'+cur.text],{type:'text/plain;charset=utf-8'});
  const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=(cur.title||'note').slice(0,40)+'.txt';a.click();
};
$('vDel').onclick=async()=>{
  if(!confirm('تمسح الملاحظة دي؟'))return;
  notes=notes.filter(n=>n.id!==cur.id);persist();
  try{await idb.del(cur.id)}catch{}
  $('viewer').classList.add('hidden');cur=null;renderList();msg('اتمسحت');
};

// ---------- PWA ----------
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
renderList();
