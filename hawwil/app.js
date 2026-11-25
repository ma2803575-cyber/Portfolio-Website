const {PDFDocument}=PDFLib;
const $=s=>document.querySelector(s);
const fmt=n=>'\u2066'+(n>1048576?(n/1048576).toFixed(2)+' MB':Math.max(1,Math.round(n/1024))+' KB')+'\u2069';
const stEl=$('#status');
function status(t,err){stEl.hidden=!t;stEl.textContent=t||'';stEl.className='status'+(err?' err':'')}
const sleep=()=>new Promise(r=>setTimeout(r,0));

// tabs
document.querySelectorAll('#tabs button').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('#tabs button').forEach(x=>x.classList.toggle('active',x===b));
  document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('active',p.id==='tab-'+b.dataset.tab));
  status('');
});

// lists
const lists={img:[],merge:[]};
function renderList(k){
  const box=$('#l-'+k);box.innerHTML='';
  lists[k].forEach((it,i)=>{
    const d=document.createElement('div');d.className='item';
    if(k==='img'){const im=document.createElement('img');im.src=it.url;d.append(im)}
    else{const s=document.createElement('span');s.textContent='📄';s.style.fontSize='1.6rem';d.append(s)}
    const nm=document.createElement('div');nm.className='nm';nm.textContent=it.file.name;
    const sm=document.createElement('small');sm.textContent=fmt(it.file.size)+(it.pages?` · ${it.pages} صفحة`:'');nm.append(sm);d.append(nm);
    const mk=(t,fn,c)=>{const b=document.createElement('button');b.textContent=t;b.onclick=fn;if(c)b.className=c;d.append(b)};
    mk('▲',()=>{if(i>0){[lists[k][i-1],lists[k][i]]=[lists[k][i],lists[k][i-1]];renderList(k)}});
    mk('▼',()=>{if(i<lists[k].length-1){[lists[k][i+1],lists[k][i]]=[lists[k][i],lists[k][i+1]];renderList(k)}});
    mk('✕',()=>{lists[k].splice(i,1);renderList(k)},'x');
    box.append(d);
  });
}
async function addFiles(k,files){
  for(const f of files){
    const it={file:f};
    if(k==='img'){if(!f.type.startsWith('image/'))continue;it.url=URL.createObjectURL(f)}
    else{
      if(!/pdf$/i.test(f.name)&&f.type!=='application/pdf')continue;
      try{it.pages=(await PDFDocument.load(await f.arrayBuffer(),{ignoreEncryption:true})).getPageCount()}catch(e){status('الملف '+f.name+' مش PDF سليم أو متشفّر.',true);continue}
    }
    lists[k].push(it);
  }
  renderList(k);
}
for(const k of ['img','merge']){
  const inp=$('#f-'+k);inp.onchange=async()=>{await addFiles(k,[...inp.files]);inp.value=''};
}
document.querySelectorAll('.drop').forEach(d=>{
  d.ondragover=e=>{e.preventDefault();d.classList.add('over')};d.ondragleave=()=>d.classList.remove('over');
  d.ondrop=e=>{e.preventDefault();d.classList.remove('over');const inp=d.querySelector('input');
    const dt=new DataTransfer();[...e.dataTransfer.files].forEach(f=>dt.items.add(f));inp.files=dt.files;inp.dispatchEvent(new Event('change'))};
});

// single-file tools
const single={split:null,compress:null};
for(const k of ['split','compress']){
  $('#f-'+k).onchange=async e=>{
    const f=e.target.files[0];if(!f)return;
    try{const d=await PDFDocument.load(await f.arrayBuffer(),{ignoreEncryption:true});single[k]={file:f,pages:d.getPageCount()};
      $('#i-'+k).textContent=`${f.name} · ${fmt(f.size)} · ${d.getPageCount()} صفحة`;
      if(k==='split'&&!$('#o-range').value)$('#o-range').placeholder='1-'+d.getPageCount();
    }catch(err){single[k]=null;$('#i-'+k).textContent='';status('الملف مش PDF سليم أو متشفّر.',true)}
  };
}
$('#o-splitmode').onchange=e=>$('#rangeWrap').style.display=e.target.value==='range'?'':'none';

// results
function result(box,blob,name,note,warn){
  const url=URL.createObjectURL(blob);
  const d=document.createElement('div');d.className='res'+(warn?' warn':'');
  const t=document.createElement('div');t.textContent=`✅ ${name} · ${fmt(blob.size)}`+(note?' · '+note:'');d.append(t);
  const a=document.createElement('a');a.className='dl';a.href=url;a.download=name;a.textContent='⬇️ تحميل';d.append(a);
  const file=new File([blob],name,{type:'application/pdf'});
  if(navigator.canShare&&navigator.canShare({files:[file]})){
    const b=document.createElement('button');b.className='sh';b.textContent='📤 مشاركة';b.onclick=()=>navigator.share({files:[file],title:name}).catch(()=>{});d.append(b);
  }
  box.append(d);
}
const pdfBlob=bytes=>new Blob([bytes],{type:'application/pdf'});
const baseName=f=>f.name.replace(/\.pdf$/i,'');
async function run(btn,box,fn){
  box.innerHTML='';btn.disabled=true;
  try{await fn()}catch(e){console.error(e);status('حصلت مشكلة: '+(e.message||e),true);btn.disabled=false;return}
  btn.disabled=false;status('');
}

// images -> pdf
async function imgToBytes(file){
  const bmp=await createImageBitmap(file,{imageOrientation:'from-image'});
  const max=2600,sc=Math.min(1,max/Math.max(bmp.width,bmp.height));
  const w=Math.round(bmp.width*sc),h=Math.round(bmp.height*sc);
  const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');
  const png=file.type==='image/png';
  if(!png){x.fillStyle='#fff';x.fillRect(0,0,w,h)}
  x.drawImage(bmp,0,0,w,h);bmp.close&&bmp.close();
  const blob=await new Promise(r=>c.toBlob(r,png?'image/png':'image/jpeg',0.9));
  return {bytes:new Uint8Array(await blob.arrayBuffer()),png,w,h};
}
$('#go-img').onclick=()=>run($('#go-img'),$('#r-img'),async()=>{
  if(!lists.img.length)return status('اختار صورة واحدة على الأقل.',true);
  const doc=await PDFDocument.create();const m=+$('#o-margin').value,fit=$('#o-size').value==='fit';
  let i=0;
  for(const it of lists.img){
    status(`جاري معالجة الصورة ${++i} من ${lists.img.length}...`);await sleep();
    const r=await imgToBytes(it.file);
    const im=r.png?await doc.embedPng(r.bytes):await doc.embedJpg(r.bytes);
    let pw,ph,dw,dh;
    if(fit){const s=842/Math.max(r.w,r.h);dw=r.w*s;dh=r.h*s;pw=dw+2*m;ph=dh+2*m}
    else{pw=595;ph=842;if(r.w>r.h&&false){}const s=Math.min((pw-2*m)/r.w,(ph-2*m)/r.h);dw=r.w*s;dh=r.h*s}
    const p=doc.addPage([pw,ph]);p.drawImage(im,{x:(pw-dw)/2,y:(ph-dh)/2,width:dw,height:dh});
  }
  const b=pdfBlob(await doc.save());
  result($('#r-img'),b,'images.pdf',`${lists.img.length} صورة`);
});

// merge
$('#go-merge').onclick=()=>run($('#go-merge'),$('#r-merge'),async()=>{
  if(lists.merge.length<2)return status('اختار ملفين PDF على الأقل.',true);
  const out=await PDFDocument.create();let i=0,n=0;
  for(const it of lists.merge){
    status(`جاري دمج الملف ${++i} من ${lists.merge.length}...`);await sleep();
    const d=await PDFDocument.load(await it.file.arrayBuffer(),{ignoreEncryption:true});
    const pgs=await out.copyPages(d,d.getPageIndices());pgs.forEach(p=>out.addPage(p));n+=pgs.length;
  }
  result($('#r-merge'),pdfBlob(await out.save()),'merged.pdf',`${n} صفحة`);
});

// split
function parseRange(s,max){
  const set=[];
  for(const part of s.replace(/[،;\s]+/g,',').split(',').filter(Boolean)){
    const m=part.match(/^(\d+)(?:-(\d+))?$/);if(!m)throw new Error('صيغة الصفحات غلط: '+part);
    let a=+m[1],b=m[2]?+m[2]:a;if(a>b)[a,b]=[b,a];
    if(a<1||b>max)throw new Error(`الصفحات لازم تكون بين 1 و ${max}`);
    for(let i=a;i<=b;i++)set.push(i-1);
  }
  if(!set.length)throw new Error('اكتب أرقام الصفحات.');
  return set;
}
$('#go-split').onclick=()=>run($('#go-split'),$('#r-split'),async()=>{
  const s=single.split;if(!s)return status('اختار ملف PDF الأول.',true);
  const src=await PDFDocument.load(await s.file.arrayBuffer(),{ignoreEncryption:true});
  if($('#o-splitmode').value==='range'){
    const idx=parseRange($('#o-range').value||('1-'+s.pages),s.pages);
    const out=await PDFDocument.create();(await out.copyPages(src,idx)).forEach(p=>out.addPage(p));
    result($('#r-split'),pdfBlob(await out.save()),baseName(s.file)+'-pages.pdf',`${idx.length} صفحة`);
  }else{
    if(s.pages>60)return status('الملف كبير (أكتر من 60 صفحة). استخدم "استخرج صفحات" لأجزاء أصغر.',true);
    for(let i=0;i<s.pages;i++){
      status(`جاري تجهيز الصفحة ${i+1} من ${s.pages}...`);await sleep();
      const out=await PDFDocument.create();out.addPage((await out.copyPages(src,[i]))[0]);
      result($('#r-split'),pdfBlob(await out.save()),`${baseName(s.file)}-p${i+1}.pdf`,'');
    }
  }
});

// compress
const LV={high:{scale:1.0,q:0.5},mid:{scale:1.4,q:0.65},low:{scale:1.8,q:0.8}};
$('#go-compress').onclick=()=>run($('#go-compress'),$('#r-compress'),async()=>{
  const s=single.compress;if(!s)return status('اختار ملف PDF الأول.',true);
  if(s.pages>150)return status('الملف كبير جدًا (أكتر من 150 صفحة) للضغط على الموبايل. قسّمه الأول.',true);
  const lv=LV[$('#o-level').value];
  const pdfjs=await import('./vendor/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdf.worker.min.mjs',import.meta.url).href;
  const data=await s.file.arrayBuffer();
  const pdf=await pdfjs.getDocument({data:data.slice(0)}).promise;
  const out=await PDFDocument.create();
  for(let i=1;i<=pdf.numPages;i++){
    status(`جاري ضغط الصفحة ${i} من ${pdf.numPages}...`);await sleep();
    const pg=await pdf.getPage(i);const base=pg.getViewport({scale:1});
    const vp=pg.getViewport({scale:lv.scale});
    const c=document.createElement('canvas');c.width=Math.ceil(vp.width);c.height=Math.ceil(vp.height);
    const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);
    await pg.render({canvasContext:x,viewport:vp}).promise;
    const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',lv.q));
    const im=await out.embedJpg(new Uint8Array(await blob.arrayBuffer()));
    const p=out.addPage([base.width,base.height]);p.drawImage(im,{x:0,y:0,width:base.width,height:base.height});
    c.width=c.height=0;pg.cleanup();
  }
  const bytes=await out.save();const name=baseName(s.file)+'-small.pdf';
  if(bytes.length>=s.file.size*0.95){
    const d=document.createElement('div');d.className='res warn';
    d.textContent=`الملف أصلاً مضغوط كويس (الحجم ${fmt(s.file.size)} والناتج ${fmt(bytes.length)}). الأفضل تستخدم الملف الأصلي. جرّب مستوى "قوي" لو لسه عايز أصغر.`;
    $('#r-compress').append(d);
  }else{
    const pct=Math.round((1-bytes.length/s.file.size)*100);
    result($('#r-compress'),pdfBlob(bytes),name,`كان ${fmt(s.file.size)} (وفّرت ${pct}%)`);
  }
});

// PWA
let dp;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();dp=e;$('#installBtn').hidden=false});
$('#installBtn').onclick=async()=>{if(dp){dp.prompt();await dp.userChoice;dp=null;$('#installBtn').hidden=true}};
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
