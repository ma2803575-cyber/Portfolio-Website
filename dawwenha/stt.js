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
export async function transcribeFile(blob,{model='Xenova/whisper-base',onProgress=()=>{},onStage=()=>{},onChunk=()=>{}}={}){
  onStage('⏳ تجهيز الصوت…');
  const audio=await toMono16k(blob);
  if(audio.length<1600)throw new Error('الملف قصير جداً');
  let rms=0;for(let i=0;i<audio.length;i+=7)rms+=audio[i]*audio[i];rms=Math.sqrt(rms/(audio.length/7));
  if(rms<0.003)throw new Error('الصوت في الملف شبه صامت');
  const {pipeline,env}=await import(CDN);
  env.allowLocalModels=false;
  try{env.backends.onnx.wasm.numThreads=window.__threads||(navigator.hardwareConcurrency>4?2:1)}catch{}
  try{if(!window.__noProxy)env.backends.onnx.wasm.proxy=true}catch{} // run inference in a worker so the page doesn't freeze
  if(!pipes[model]){
    onStage('⬇️ تحميل نموذج التحويل ('+modelSize(model)+', أول مرة بس)…');
    pipes[model]=await pipeline('automatic-speech-recognition',model,{quantized:true,
      progress_callback:p=>{if(p.status==='progress'&&p.total)onProgress(p.loaded/p.total)}});
  }
  const total=Math.max(1,Math.ceil(audio.length/16000/25));
  let done=0;
  onStage('👂 بيسمع ويكتب… (الصوت حوالي '+Math.ceil(audio.length/16000)+' ثانية)');
  const out=await pipes[model](audio,{language:'arabic',task:'transcribe',chunk_length_s:30,stride_length_s:5,
    return_timestamps:false,...(window.__noNgram?{}:{no_repeat_ngram_size:4}),
    chunk_callback:()=>{done++;onChunk(done,total)}});
  return cleanTranscript(out?.text);
}
