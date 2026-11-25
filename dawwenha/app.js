import {organizeAI,organizeOffline,renderNote} from './ai.js';
import {transcribeFile,cleanTranscript} from './stt.js';

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

// ---------- Flow UI ----------
const flow={ctl:null,busy:false};
function step(n,state){['st1','st2','st3'].forEach((id,i)=>{$(id).className=i+1<n?'done':i+1===n?'now':''});if(state)$('flowTxt').textContent=state}
function flowShow(on){$('flow').classList.toggle('hidden',!on)}
function flowBar(p){$('sttBar').classList.toggle('hidden',p==null);if(p!=null)$('sttFill').style.width=Math.round(p*100)+'%'}
function lockHome(b){$('recBtn').disabled=b;$('fileIn').disabled=b;$('writeBtn').disabled=b}

// ---------- The one pipeline: text (live or Whisper) -> organize -> save ----------
async function pipeline({blob=null,raw='',duration=0,fallbackRaw=''}){
  if(flow.busy)return;flow.busy=true;lockHome(true);flowShow(true);$('flow').scrollIntoView({behavior:'smooth'});
  const id=uid();
  let audioSaved=false;
  // Save the audio FIRST so a failed/slow transcription can never lose it
  if(blob){try{await idb.put(id,blob);audioSaved=true}catch{}}
  try{
    if(!raw.trim()&&blob){
      step(1,'⏳ بنجهّز الصوت…');flowBar(0);
      raw=await transcribeFile(blob,{model:$('modelSel').value,
        onProgress:p=>{flowBar(p)},
        onStage:t=>{$('flowTxt').textContent=t;if(t.startsWith('👂'))flowBar(null)}}).catch(e=>{if(fallbackRaw.trim())return fallbackRaw;throw e});
    }else step(1,'✅ النص جاهز');
    raw=(raw||'').trim();
    if(raw.length<3)throw new Error('مفيش كلام اتسمع. تأكد إن الصوت واضح وقرّب من المايك.');
    flowBar(null);
    let org=null,note='';
    if(raw.length>=25){
      step(2,'✨ بننظّم الملاحظات…');
      flow.ctl=new AbortController();$('skipBtn').classList.remove('hidden');
      try{
        org=await organizeAI(raw,{signal:flow.ctl.signal,
          onWait:w=>{$('flowTxt').textContent='⏳ الخدمة المجانية بتسمح بطلب كل ~45 ثانية. مستنيين '+w+' ثانية…'},
          onProgress:(i,n)=>{$('flowTxt').textContent=n>1?('✨ بنظّم الجزء '+(i+1)+' من '+n+'…'):'✨ بننظّم الملاحظات…'}});
      }catch(e){
        org=organizeOffline(raw);
        note=e&&e.name==='AbortError'?'اتخطّى التنظيم الذكي، اتنظّمت محلياً. تقدر تدوس "نظّم بالذكاء الاصطناعي" بعدين.':'التنظيم الذكي مش متاح دلوقتي (الخدمة المجانية مشغولة)، فاتنظّمت محلياً بشكل أبسط. تقدر تدوس "نظّم بالذكاء الاصطناعي" بعدين.';
      }finally{$('skipBtn').classList.add('hidden');flow.ctl=null}
    }
    step(3,'💾 بنحفظ…');
    const n={id,date:new Date().toISOString(),duration:duration||0,
      title:(org&&org.title)||raw.split(' ').slice(0,8).join(' ')||'تسجيل صوتي',
      text:org?renderNote(org,raw):raw,raw,tags:(org&&org.tags)||[],hasAudio:audioSaved,aiDone:!note&&!!org};
    notes.unshift(n);persist();renderList();
    flowShow(false);
    openNote(id,note||'اتحفظت ✅ راجع النص وعدّل أي كلمة غلط من زرار "تعديل".');
    $('fileIn').value='';$('writeTxt').value='';
  }catch(e){
    flowShow(false);
    const t=(e&&e.message)||String(e);
    if(blob&&!raw.trim()){
      try{if(!audioSaved)await idb.put(id,blob);notes.unshift({id,date:new Date().toISOString(),duration:duration||0,title:'تسجيل صوتي (من غير نص)',text:'',raw:'',tags:[],hasAudio:true,aiDone:false});persist();renderList();
        msg('مشكلة في التحويل لنص: '+t+' الصوت اتحفظ في "ملاحظاتي" ومش هيضيع.',1)}catch{msg('مشكلة: '+t,1)}
    }else msg('مشكلة: '+t,1);
  }finally{flow.busy=false;lockHome(false);$('fileIn').value=''}
}
$('skipBtn').onclick=()=>{if(flow.ctl)flow.ctl.abort()};

// ---------- Recording ----------
let mr=null,chunks=[],recStart=0,tick=null,sr=null,liveFinal='',stream=null;
let srErr='';
function liveSR(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR||$('liveSel').value==='off')return null;
  const r=new SR();r.lang=$('langSel').value||'ar-EG';r.continuous=true;r.interimResults=true;r.maxAlternatives=1;
  let alive=true,fails=0;srErr='';
  r.onresult=e=>{fails=0;let interim='';for(let i=e.resultIndex;i<e.results.length;i++){const t=e.results[i][0].transcript;if(e.results[i].isFinal)liveFinal+=(liveFinal?' ':'')+t.trim();else interim=t}
    $('liveBox').innerHTML=esc(liveFinal)+(interim?' <span class="interim">'+esc(interim)+'</span>':'')};
  r.onend=()=>{if(alive&&fails<6){try{r.start()}catch{}}};
  r.onerror=e=>{
    const c=e.error;
    if(c==='no-speech'||c==='aborted')return;
    if(c==='audio-capture'){srErr='النص اللحظي مش شغال مع المايك على جهازك. التسجيل شغال عادي وهنكتبه بعد ما توقف.';alive=false;$('liveBox').textContent='ℹ️ '+srErr;return}
    fails++;
    if(c==='not-allowed'||c==='service-not-allowed'){srErr='النص اللحظي مش متاح. مفيش مشكلة، هنكتب الصوت بعد ما توقف.';alive=false}
    else if(c==='network'){srErr='النص اللحظي محتاج إنترنت. مفيش مشكلة، هنكتب الصوت بعد ما توقف.';alive=false}
    else if(c==='language-not-supported'){srErr='اللهجة دي مش مدعومة، هنكتب الصوت بعد ما توقف.';alive=false}
    if(srErr)$('liveBox').textContent='ℹ️ '+srErr;
  };
  try{r.start()}catch{return null}
  return {stop(){alive=false;try{r.stop()}catch{}}};
}
const esc=s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));

$('recBtn').onclick=async()=>{
  if(flow.busy)return;
  if(mr&&mr.state==='recording'){mr.stop();return}
  try{
    stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
  }catch(e){msg('محتاج إذن المايك عشان نسجل. اسمح بالمايك من إعدادات المتصفح (علامة القفل جنب العنوان).',1);return}
  const types=['audio/webm;codecs=opus','audio/webm','audio/mp4','audio/ogg;codecs=opus'];
  const mime=types.find(t=>window.MediaRecorder&&MediaRecorder.isTypeSupported(t))||'';
  chunks=[];liveFinal='';
  mr=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);
  mr.onerror=()=>msg('حصلت مشكلة في التسجيل. اضغط إيقاف عشان نحفظ اللي اتسجل.',1);
  mr.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
  mr.onstop=()=>{
    clearInterval(tick);stream.getTracks().forEach(t=>t.stop());
    if(sr){sr.stop();sr=null}
    $('recBtn').classList.remove('on');$('recLabel').textContent='اضغط وسجّل';
    $('recTimer').classList.add('hidden');$('liveBox').classList.add('hidden');
    const blob=new Blob(chunks,{type:mr.mimeType||'audio/webm'});
    const dur=(Date.now()-recStart)/1000;
    if(dur<1.5){msg('التسجيل قصير أوي. جرّب تاني.',1);return}
    if(!blob.size){msg('التسجيل طلع فاضي. جرّب تاني، ولو المشكلة مستمرة اقفل "النص اللحظي" من الإعدادات.',1);return}
    // Live text is used only if it looks complete; otherwise Whisper transcribes the saved audio (live text stays as backup)
    const live=liveFinal.trim(),sparse=live.length<dur*2.5;
    pipeline({blob,raw:sparse?'':live,fallbackRaw:live,duration:dur});
  };
  mr.start(1000);recStart=Date.now();
  try{sr=liveSR()}catch{sr=null}
  setTimeout(()=>{if(mr&&mr.state==='recording'&&!chunks.length){msg('المايك مش بيدّي صوت. لو مفيش صوت، اقفل "النص اللحظي" من الإعدادات وجرّب تاني.',1)}},4000);
  $('recBtn').classList.add('on');$('recLabel').textContent='⏹ خلّصت (اضغط للإيقاف)';
  $('recTimer').classList.remove('hidden');$('liveBox').classList.remove('hidden');
  $('liveBox').textContent=sr?'بيسمعك... النص هيظهر هنا وانت بتتكلم':'🎙️ بيسجّل... هنكتب الصوت أول ما توقف';
  tick=setInterval(()=>{$('recTimer').textContent=fmtDur((Date.now()-recStart)/1000)},250);
};

// ---------- Upload: pick a file -> everything runs by itself ----------
$('fileIn').onchange=()=>{
  const f=$('fileIn').files[0];if(!f)return;
  if(f.size>200*1048576){msg('الملف كبير أوي (أكتر من 200 ميجا). جرّب ملف أصغر.',1);return}
  pipeline({blob:f,raw:'',duration:0});
};
$('writeBtn').onclick=()=>{
  const t=$('writeTxt').value.trim();
  if(t.length<10){msg('اكتب نص أطول شوية',1);return}
  pipeline({blob:null,raw:t});
};
try{const m=localStorage.getItem('dawwenha.model');if(m)$('modelSel').value=m;const l=localStorage.getItem('dawwenha.lang');if(l)$('langSel').value=l;const lv=localStorage.getItem('dawwenha.live');if(lv)$('liveSel').value=lv}catch{}
$('modelSel').onchange=()=>localStorage.setItem('dawwenha.model',$('modelSel').value);
$('liveSel').onchange=()=>localStorage.setItem('dawwenha.live',$('liveSel').value);
$('langSel').onchange=()=>localStorage.setItem('dawwenha.lang',$('langSel').value);

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
async function openNote(id,note){
  cur=notes.find(n=>n.id===id);if(!cur)return;
  $('vTitle').textContent=cur.title;
  $('vMeta').textContent=fmtDate(cur.date)+(cur.duration?' · '+fmtDur(cur.duration):'')+(cur.tags.length?' · '+cur.tags.join('، '):'');
  $('vText').textContent=cur.text||'(مفيش نص. الصوت محفوظ، جرّب تكتبه بإيدك من "تعديل".)';
  $('vText').classList.remove('hidden');$('vEdit').classList.add('hidden');$('vEditBtn').textContent='✏️ تعديل';
  $('vNote').textContent=note||'';$('vNote').classList.toggle('hidden',!note);
  $('vReorg').classList.toggle('hidden',!cur.raw||cur.raw.length<25||!!cur.aiDone);
  if(cur.raw&&cur.raw!==cur.text){$('vRaw').textContent=cur.raw;$('vRawWrap').classList.remove('hidden')}else $('vRawWrap').classList.add('hidden');
  const au=$('vAudio');au.classList.add('hidden');au.removeAttribute('src');
  if(cur.hasAudio){const b=await idb.get(id);if(b){au.src=URL.createObjectURL(b);au.classList.remove('hidden')}}
  $('viewer').classList.remove('hidden');
}
$('vEditBtn').onclick=()=>{
  if(!cur)return;
  if($('vEdit').classList.contains('hidden')){$('vEdit').value=cur.text;$('vEdit').classList.remove('hidden');$('vText').classList.add('hidden');$('vEditBtn').textContent='💾 حفظ التعديل'}
  else{cur.text=$('vEdit').value;cur.raw=cur.raw||cur.text;persist();renderList();$('vText').textContent=cur.text;$('vText').classList.remove('hidden');$('vEdit').classList.add('hidden');$('vEditBtn').textContent='✏️ تعديل';msg('اتحفظ التعديل ✅')}
};
$('vReorg').onclick=async()=>{
  if(!cur)return;const n=cur;$('vReorg').disabled=true;
  try{
    const org=await organizeAI(n.raw,{onWait:w=>{$('vNote').classList.remove('hidden');$('vNote').textContent='⏳ مستنيين '+w+' ثانية (حد الخدمة المجانية)…'}});
    n.text=renderNote(org,n.raw);n.title=org.title||n.title;n.tags=org.tags||[];n.aiDone=true;persist();renderList();openNote(n.id,'اتنظّمت بالذكاء الاصطناعي ✅');
  }catch{$('vNote').classList.remove('hidden');$('vNote').textContent='الخدمة لسه مش متاحة. جرّب بعد دقيقة.'}
  finally{$('vReorg').disabled=false}
};
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
