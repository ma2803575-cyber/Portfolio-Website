// On-device speech-to-text using Whisper in the browser (transformers.js). No key, no upload.
const CDN='https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';
const pipes={};
export function modelSize(m){return m.includes('base')?'~75MB':'~40MB'}
async function toMono16k(blob){
  const buf=await blob.arrayBuffer();
  const AC=window.AudioContext||window.webkitAudioContext;
  const ac=new AC();
  try{
    const dec=await ac.decodeAudioData(buf);
    const off=new OfflineAudioContext(1,Math.max(1,Math.ceil(dec.duration*16000)),16000);
    const src=off.createBufferSource();src.buffer=dec;src.connect(off.destination);src.start();
    const rendered=await off.startRendering();
    return rendered.getChannelData(0);
  }finally{try{await ac.close()}catch{}}
}
export async function transcribeFile(blob,{model='Xenova/whisper-tiny',onProgress=()=>{},onStage=()=>{}}={}){
  onStage('⏳ تجهيز الصوت…');
  const audio=await toMono16k(blob);
  if(audio.length<1600)throw new Error('الملف قصير جداً');
  const {pipeline,env}=await import(CDN);
  env.allowLocalModels=false;
  if(!pipes[model]){
    onStage('⬇️ تحميل نموذج التحويل ('+modelSize(model)+', أول مرة بس)…');
    pipes[model]=await pipeline('automatic-speech-recognition',model,{quantized:true,
      progress_callback:p=>{if(p.status==='progress'&&p.total)onProgress(p.loaded/p.total)}});
  }
  onStage('👂 بيسمع ويكتب… (ممكن ياخد وقت حسب طول الملف)');
  const out=await pipes[model](audio,{language:'arabic',task:'transcribe',chunk_length_s:30,stride_length_s:5,return_timestamps:false});
  return String(out?.text||'').trim();
}
