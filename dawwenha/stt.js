// On-device speech-to-text using Whisper in the browser (transformers.js). No key, no upload.
const CDN='https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';
const pipes={};
export const MODELS={
  'Xenova/whisper-tiny':'~40MB',
  'Xenova/whisper-base':'~75MB',
  'Xenova/whisper-small':'~250MB'
};
export function modelSize(m){return MODELS[m]||'~75MB'}

// Decode -> mono 16k -> remove DC offset -> peak-normalize (quiet recordings are a top cause of garbled Whisper output)
export async function toMono16k(blob){
  const buf=await blob.arrayBuffer();
  const AC=window.AudioContext||window.webkitAudioContext;
  const ac=new AC();
  let dec;
  try{
    try{dec=await ac.decodeAudioData(buf)}
    catch{throw new Error('الملف ده مش اتفتح كصوت. جرّب mp3 أو m4a أو wav.')}
    const off=new OfflineAudioContext(1,Math.max(1,Math.ceil(dec.duration*16000)),16000);
    const src=off.createBufferSource();src.buffer=dec;src.connect(off.destination);src.start();
    const rendered=await off.startRendering();
    return preprocess(Float32Array.from(rendered.getChannelData(0)));
  }finally{try{await ac.close()}catch{}}
}
export function preprocess(a){
  let mean=0;for(let i=0;i<a.length;i++)mean+=a[i];mean/=a.length||1;
  let peak=0;for(let i=0;i<a.length;i++){a[i]-=mean;const v=Math.abs(a[i]);if(v>peak)peak=v}
  if(peak>1e-4){const g=Math.min(0.95/peak,12);if(Math.abs(g-1)>0.05)for(let i=0;i<a.length;i++)a[i]*=g}
  return a;
}
// Whisper sometimes loops ("كده كده كده ..."). Collapse runs of the same word/phrase beyond 3 repeats.
export function cleanTranscript(t){
  t=String(t||'').replace(/[\u064B-\u0652\u0670\u0640]/g,'').replace(/\s+/g,' ').trim();
  for(let n=4;n>=1;n--){
    const re=new RegExp('((?:\\S+\\s+){'+(n-1)+'}\\S+)(?:\\s+\\1){2,}','g');
    t=t.replace(re,'$1');
  }
  return t.replace(/\s+([،.؟!,?])/g,'$1').trim();
}
export const speechSeconds=a=>a.length/16000;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function withTimeout(p,ms,msg){let t;return Promise.race([p,new Promise((_,j)=>{t=setTimeout(()=>j(new Error(msg)),ms)})]).finally(()=>clearTimeout(t))}
let lib=null;
async function getLib(){
  if(lib)return lib;
  const m=await withTimeout(import(CDN),45000,'مكتبة التحويل ماحمّلتش. اتأكد من النت وجرّب تاني.');
  m.env.allowLocalModels=false;
  // Single thread, no worker proxy: both hung on weak/1-core devices. Threads need cross-origin isolation, which github.io doesn't have anyway.
  try{m.env.backends.onnx.wasm.numThreads=1}catch{}
  lib=m;return m;
}
const LOAD_MS={'Xenova/whisper-tiny':90000,'Xenova/whisper-base':120000,'Xenova/whisper-small':240000};
async function loadPipe(model,onStage,onProgress){
  if(pipes[model])return pipes[model];
  const {pipeline}=await getLib();
  const t0=Date.now();let last=0;
  const iv=setInterval(()=>onStage('⬇️ تحميل نموذج التحويل ('+modelSize(model)+', أول مرة بس)… '+Math.round((Date.now()-t0)/1000)+' ث'),1000);
  try{
    pipes[model]=await withTimeout(pipeline('automatic-speech-recognition',model,{quantized:true,
      progress_callback:p=>{if(p.status==='progress'&&p.total){last=Date.now();onProgress(p.loaded/p.total)}}}),
      LOAD_MS[model]||120000,'تحميل النموذج أخد وقت طويل أوي');
  }finally{clearInterval(iv)}
  return pipes[model];
}
const FALLBACK={'Xenova/whisper-small':'Xenova/whisper-base','Xenova/whisper-base':'Xenova/whisper-tiny'};
export async function transcribeFile(blob,{model='Xenova/whisper-base',onProgress=()=>{},onStage=()=>{},onChunk=()=>{}}={}){
  onStage('⏳ تجهيز الصوت…');
  const audio=await toMono16k(blob);
  if(audio.length<1600)throw new Error('الملف قصير جداً');
  let rms=0;for(let i=0;i<audio.length;i+=7)rms+=audio[i]*audio[i];rms=Math.sqrt(rms/(audio.length/7));
  if(rms<0.003)throw new Error('الصوت في الملف شبه صامت');
  const secs=Math.ceil(audio.length/16000);
  let pipe=null,used=model;
  for(;;){
    try{pipe=await loadPipe(used,onStage,onProgress);break}
    catch(e){
      delete pipes[used];
      const fb=FALLBACK[used];
      if(!fb)throw new Error('نموذج التحويل ماشتغلش على الجهاز ده ('+(e.message||e)+'). الصوت محفوظ وتقدر تكتبه بإيدك.');
      onStage('⚠️ النموذج الأدق تقيل على جهازك، بنجرّب نموذج أخف…');onProgress(0);await wait(800);used=fb;
    }
  }
  onProgress(null);
  const t0=Date.now();
  const iv=setInterval(()=>onStage('👂 بيسمع ويكتب… (الصوت حوالي '+secs+' ثانية) '+Math.round((Date.now()-t0)/1000)+' ث'),1000);
  try{
    const out=await withTimeout(pipe(audio,{language:'arabic',task:'transcribe',chunk_length_s:30,stride_length_s:5,
      return_timestamps:false,no_repeat_ngram_size:4,chunk_callback:()=>onChunk()}),
      Math.max(120000,secs*5000),'التحويل أخد وقت أطول من المتوقع');
    return cleanTranscript(out?.text);
  }finally{clearInterval(iv)}
}
