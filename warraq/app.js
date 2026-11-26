import * as pdfjsLib from './vendor/pdf.min.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.min.mjs', import.meta.url).href;
const { PDFDocument, degrees } = PDFLib;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const LS = { get: (k, d) => { try { const v = localStorage.getItem('wq:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set: (k, v) => { try { localStorage.setItem('wq:' + k, JSON.stringify(v)); } catch { } } };

/* ---------- state ---------- */
const S = {
  bytes: null, pdf: null, name: 'document.pdf', n: 0, scale: 1, zoom: 1, fitW: 600,
  views: [], annots: [], texts: [], ocr: {}, mode: 'read', tab: 'read', color: '#e11d48', width: 3, size: 18,
  sel: null, hist: [], redo: [], key: '', encrypted: false, rendered: new Set(), query: '', night: 'none', pwd: null
};

/* ---------- helpers ---------- */
function toast(t, ms = 2600) { const e = $('#toast'); e.textContent = t; e.classList.remove('hidden'); clearTimeout(toast.t); toast.t = setTimeout(() => e.classList.add('hidden'), ms); }
function busy(on, t) { $('#busy').classList.toggle('hidden', !on); if (t) $('#busyTxt').textContent = t; }
const tick = () => new Promise(r => setTimeout(r, 0));
function dl(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000); }
const fmtSize = b => b > 1048576 ? (b / 1048576).toFixed(2) + ' MB' : Math.round(b / 1024) + ' KB';
const isAr = t => { const a = (t.match(/[\u0600-\u06FF]/g) || []).length, l = (t.match(/[A-Za-z]/g) || []).length; return a > l; };
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function ask(title, { value = '', area = false, type = 'text', note = '' } = {}) {
  return new Promise(res => {
    const d = $('#dlg'); $('#dlgTitle').textContent = title;
    $('#dlgBody').innerHTML = (note ? `<p style="color:var(--mut);font-size:13px">${note}</p>` : '') + (area ? `<textarea id="dlgIn"></textarea>` : `<input id="dlgIn" type="${type}">`);
    $('#dlgIn').value = value; d.onclose = () => res(d.returnValue === 'ok' ? $('#dlgIn').value : null); d.showModal(); setTimeout(() => $('#dlgIn').focus(), 50);
  });
}
function form(title, html, read) {
  return new Promise(res => { const d = $('#dlg'); $('#dlgTitle').textContent = title; $('#dlgBody').innerHTML = html; d.onclose = () => res(d.returnValue === 'ok' ? read($('#dlgBody')) : null); d.showModal(); });
}
function sheet(title, html, acts = []) {
  $('#sheetTitle').textContent = title; $('#sheetBody').innerHTML = html; $('#sheet').classList.remove('hidden');
  const a = $('#sheetActs'); a.innerHTML = ''; acts.forEach(([l, f]) => { const b = document.createElement('button'); b.textContent = l; b.onclick = f; a.appendChild(b); });
  $('#sheetBody').scrollTop = 0;
}
$('#sheetClose').onclick = () => { $('#sheet').classList.add('hidden'); stopSpeak(); };
const copyTxt = async t => { try { await navigator.clipboard.writeText(t); toast('اتنسخ ✅'); } catch { toast('مقدرتش أنسخ'); } };
const curPage = () => { const v = $('#viewer'), mid = v.scrollTop + v.clientHeight * .35; for (let i = 0; i < S.views.length; i++) { const e = S.views[i].el; if (e.offsetTop + e.offsetHeight > mid) return i; } return Math.max(0, S.views.length - 1); };

/* ---------- open / load ---------- */
$('#btnOpen').onclick = $('#btnOpen2').onclick = () => $('#fileIn').click();
$('#fileIn').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (f) openFile(f); };
['dragover', 'drop'].forEach(ev => document.addEventListener(ev, e => { e.preventDefault(); if (ev === 'drop') { const f = [...e.dataTransfer.files].find(x => /pdf$/i.test(x.type) || /\.pdf$/i.test(x.name)); if (f) openFile(f); } }));
async function openFile(f) {
  busy(true, 'بفتح الملف...');
  try { S.name = f.name; await loadBytes(new Uint8Array(await f.arrayBuffer()), true); } catch (e) { console.error(e); toast('الملف ده مش اتفتح: ' + (e.message || e)); }
  busy(false);
}
async function loadBytes(bytes, fresh) {
  const task = pdfjsLib.getDocument({ data: bytes.slice(), password: S.pwd || undefined });
  task.onPassword = async (cb, reason) => { const p = await ask(reason === 2 ? 'الباسورد غلط، جرب تاني' : 'الملف محمي بباسورد', { type: 'password' }); if (p == null) { busy(false); return; } S.pwd = p; cb(p); };
  const pdf = await task.promise;
  S.pdf = pdf; S.bytes = bytes; S.n = pdf.numPages; S.texts = []; S.rendered = new Set();
  if (fresh) { S.annots = []; S.ocr = {}; S.hist = []; S.redo = []; S.encrypted = false; S.key = 'doc:' + S.name + ':' + bytes.length; }
  try { await PDFDocument.load(bytes); S.encrypted = false; } catch { S.encrypted = true; }
  await buildViews();
  $('#empty').classList.add('hidden'); $('#statusbar').classList.remove('hidden'); $('#btnSave').disabled = false; $('#pageTotal').textContent = S.n; $('#pageNo').max = S.n;
  histBtns();
  if (fresh) { const p = LS.get('pos:' + S.key, null); if (p && p.page > 0) setTimeout(() => { goPage(p.page); toast('كملت من صفحة ' + (p.page + 1)); }, 300); }
  if (S.encrypted && fresh) toast('الملف محمي: القراءة والترجمة شغالين. للحفظ استخدم "فك الحماية" من الأدوات.', 5000);
}
async function buildViews() {
  const box = $('#pages'); box.innerHTML = ''; S.views = [];
  const first = await S.pdf.getPage(1); const w0 = first.getViewport({ scale: 1 }).width;
  S.fitW = Math.max(280, Math.min($('#viewer').clientWidth - 16, 900)); S.scale = S.fitW / w0 * S.zoom;
  for (let i = 0; i < S.n; i++) {
    const page = await S.pdf.getPage(i + 1); const vp1 = page.getViewport({ scale: 1 }), vp = page.getViewport({ scale: S.scale });
    const el = document.createElement('div'); el.className = 'pg'; el.style.width = vp.width + 'px'; el.style.height = vp.height + 'px'; el.dataset.i = i;
    box.appendChild(el); S.views.push({ el, page, w: vp1.width, h: vp1.height, vp, done: false });
  }
  io.disconnect(); S.views.forEach(v => io.observe(v.el));
}
const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) renderPage(+e.target.dataset.i); }), { root: null, rootMargin: '900px 0px' });
async function renderPage(i) {
  const v = S.views[i]; if (!v || v.done || v.busy) return; v.busy = true;
  const { el, page } = v; const dpr = Math.min(window.devicePixelRatio || 1, 2); const vp = page.getViewport({ scale: S.scale });
  const c = document.createElement('canvas'); c.className = 'base'; c.width = Math.floor(vp.width * dpr); c.height = Math.floor(vp.height * dpr); c.style.width = vp.width + 'px'; c.style.height = vp.height + 'px';
  await page.render({ canvasContext: c.getContext('2d'), viewport: vp, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null }).promise;
  const ov = document.createElement('canvas'); ov.className = 'ov'; ov.width = Math.floor(vp.width * dpr); ov.height = Math.floor(vp.height * dpr); ov.style.width = vp.width + 'px'; ov.style.height = vp.height + 'px';
  const tl = document.createElement('div'); tl.className = 'tl';
  el.innerHTML = ''; el.append(c, ov, tl); v.c = c; v.ov = ov; v.tl = tl; v.dpr = dpr; v.done = true; v.busy = false;
  bindDraw(i); drawOv(i);
  buildTextLayer(i);
}
async function buildTextLayer(i) {
  const v = S.views[i]; const tc = await v.page.getTextContent(); const frag = document.createDocumentFragment(); const spans = [];
  for (const it of tc.items) {
    if (!it.str || !it.str.trim()) continue;
    const tx = pdfjsLib.Util.transform(v.vp.transform, it.transform); const fh = Math.hypot(tx[2], tx[3]) || 10;
    const s = document.createElement('span'); s.textContent = it.str; s.style.left = tx[4] + 'px'; s.style.top = (tx[5] - fh * .9) + 'px'; s.style.fontSize = fh + 'px';
    if (it.dir === 'rtl') s.dir = 'rtl'; s._w = it.width * S.scale; frag.appendChild(s); spans.push(s);
  }
  v.items=tc.items.filter(it=>it.str&&it.str.trim()).map(it=>{const tx=pdfjsLib.Util.transform(v.vp.transform,it.transform);const fh=Math.hypot(tx[2],tx[3])||10;return{x:tx[4]/S.scale,y:(tx[5]-fh*.95)/S.scale,w:it.width,h:fh*1.2/S.scale,fs:fh/S.scale,str:it.str,rtl:it.dir==='rtl'}});
  v.tl.appendChild(frag);
  spans.forEach(s => { s._n = s.getBoundingClientRect().width || 1; });
  spans.forEach(s => { const k = s._w / s._n; if (isFinite(k) && k > 0.05 && k < 20) s.style.transform = `scaleX(${k})`; });
  v.spans = spans; markHits(i);
}
function markHits(i) { const v = S.views[i]; if (!v || !v.spans) return; const q = S.query.toLowerCase(); v.spans.forEach(s => s.classList.toggle('hit', !!q && s.textContent.toLowerCase().includes(q))); }
function goPage(i) { i = Math.max(0, Math.min(S.n - 1, i)); const v = S.views[i]; if (v) $('#viewer').scrollTo({ top: v.el.offsetTop - 8, behavior: 'smooth' }); }
$('#prevP').onclick = () => goPage(curPage() - 1); $('#nextP').onclick = () => goPage(curPage() + 1);
$('#pageNo').onchange = e => goPage(+e.target.value - 1);
async function setZoom(z) { S.zoom = Math.max(.4, Math.min(4, z)); $('#zoomLbl').textContent = Math.round(S.zoom * 100) + '%'; if (!S.pdf) return; const p = curPage(); await buildViews(); goPage(p); }
$('#zoomIn').onclick = () => setZoom(S.zoom + .25); $('#zoomOut').onclick = () => setZoom(S.zoom - .25); $('#fitW').onclick = () => setZoom(1);
let savePosT; $('#viewer').addEventListener('scroll', () => { if (!S.pdf) return; const p = curPage(); $('#pageNo').value = p + 1; clearTimeout(savePosT); savePosT = setTimeout(() => LS.set('pos:' + S.key, { page: p }), 600); }, { passive: true });
$('#newBlank').onclick = async e => { e.preventDefault(); const d = await PDFDocument.create(); d.addPage([595.28, 841.89]); S.name = 'ملف-جديد.pdf'; await loadBytes(await d.save(), true); };
$('#imgToPdf').onclick = e => { e.preventDefault(); $('#fileMulti').dataset.mode = 'new'; $('#fileMulti').click(); };

/* ---------- annotations ---------- */
const uid = () => Math.random().toString(36).slice(2);
function pushA(a) { S.annots.push(a); S.redo = []; histBtns(); drawOv(a.p); }
function histBtns() { $('#btnUndo').disabled = !(S.annots.length || S.hist.length); $('#btnRedo').disabled = !(S.redo.length); }
$('#btnUndo').onclick = async () => { if (S.annots.length) { const a = S.annots.pop(); S.redo.push({ t: 'a', a }); drawOv(a.p); S.sel = null; ctxbar(); } else if (S.hist.length) { const h = S.hist.pop(); S.redo.push({ t: 'b', bytes: S.bytes, annots: S.annots }); S.annots = h.annots; await loadBytes(h.bytes); } histBtns(); };
$('#btnRedo').onclick = async () => { const r = S.redo.pop(); if (!r) return; if (r.t === 'a') { S.annots.push(r.a); drawOv(r.a.p); } else { S.hist.push({ bytes: S.bytes, annots: S.annots }); S.annots = r.annots; await loadBytes(r.bytes); } histBtns(); };
function bbox(a) {
  if (a.t === 'ink') { const xs = a.pts.map(p => p[0]), ys = a.pts.map(p => p[1]); return [Math.min(...xs) - 4, Math.min(...ys) - 4, Math.max(...xs) + 4, Math.max(...ys) + 4]; }
  if (a.t === 'line' || a.t === 'arrow') return [Math.min(a.x, a.x2) - 4, Math.min(a.y, a.y2) - 4, Math.max(a.x, a.x2) + 4, Math.max(a.y, a.y2) + 4];
  if (a.t === 'text') { const m = measureText(a); return [a.x, a.y, a.x + m.w, a.y + m.h]; }
  return [a.x, a.y, a.x + a.w, a.y + a.h];
}
function measureText(a) { const c = document.createElement('canvas').getContext('2d'); c.font = `${a.size}px Tahoma, Arial, sans-serif`; const ls = a.text.split('\n'); return { w: Math.max(...ls.map(l => c.measureText(l).width)) + 6, h: ls.length * a.size * 1.35 + 4, ls }; }
function paint(ctx, a, k) {
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const X = v => v * k;
  if (a.t === 'ink') { ctx.globalAlpha = a.alpha || 1; ctx.strokeStyle = a.color; ctx.lineWidth = X(a.w); ctx.beginPath(); a.pts.forEach((p, i) => i ? ctx.lineTo(X(p[0]), X(p[1])) : ctx.moveTo(X(p[0]), X(p[1]))); if (a.pts.length === 1) ctx.lineTo(X(a.pts[0][0] + .1), X(a.pts[0][1])); ctx.stroke(); }
  else if (a.t === 'hl') { ctx.globalAlpha = .38; ctx.fillStyle = a.color; ctx.fillRect(X(a.x), X(a.y), X(a.w), X(a.h)); }
  else if (a.t === 'white') { ctx.fillStyle = '#fff'; ctx.fillRect(X(a.x), X(a.y), X(a.w), X(a.h)); }
  else if (a.t === 'redact') { ctx.fillStyle = '#000'; ctx.fillRect(X(a.x), X(a.y), X(a.w), X(a.h)); }
  else if (a.t === 'rect') { ctx.strokeStyle = a.color; ctx.lineWidth = X(a.lw); ctx.strokeRect(X(a.x), X(a.y), X(a.w), X(a.h)); }
  else if (a.t === 'ell') { ctx.strokeStyle = a.color; ctx.lineWidth = X(a.lw); ctx.beginPath(); ctx.ellipse(X(a.x + a.w / 2), X(a.y + a.h / 2), Math.abs(X(a.w / 2)), Math.abs(X(a.h / 2)), 0, 0, 7); ctx.stroke(); }
  else if (a.t === 'line' || a.t === 'arrow') {
    ctx.strokeStyle = a.color; ctx.fillStyle = a.color; ctx.lineWidth = X(a.lw); ctx.beginPath(); ctx.moveTo(X(a.x), X(a.y)); ctx.lineTo(X(a.x2), X(a.y2)); ctx.stroke();
    if (a.t === 'arrow') { const ang = Math.atan2(a.y2 - a.y, a.x2 - a.x), L = 10 + a.lw * 2; ctx.beginPath(); ctx.moveTo(X(a.x2), X(a.y2)); ctx.lineTo(X(a.x2 - L * Math.cos(ang - .45)), X(a.y2 - L * Math.sin(ang - .45))); ctx.lineTo(X(a.x2 - L * Math.cos(ang + .45)), X(a.y2 - L * Math.sin(ang + .45))); ctx.closePath(); ctx.fill(); }
  }
  else if (a.t === 'text') { const m = measureText(a); ctx.fillStyle = a.color; ctx.font = `${X(a.size)}px Tahoma, Arial, sans-serif`; ctx.textBaseline = 'top'; m.ls.forEach((l, i) => ctx.fillText(l, X(a.x + 2), X(a.y + 2 + i * a.size * 1.35))); }
  else if (a.t === 'img') { if (!a._img) { a._img = new Image(); a._img.onload = () => drawOv(a.p); a._img.src = a.data; } if (a._img.complete && a._img.naturalWidth) ctx.drawImage(a._img, X(a.x), X(a.y), X(a.w), X(a.h)); }
  ctx.restore();
}
function drawOv(i) {
  const v = S.views[i]; if (!v || !v.ov) return; const c = v.ov.getContext('2d'); c.clearRect(0, 0, v.ov.width, v.ov.height);
  const k = S.scale * v.dpr; S.annots.filter(a => a.p === i).forEach(a => paint(c, a, k));
  if (v.tmp) paint(c, v.tmp, k);
  if (S.sel && S.sel.p === i) { const b = bbox(S.sel); c.save(); c.strokeStyle = '#6d5ef3'; c.setLineDash([6, 4]); c.lineWidth = 2; c.strokeRect(b[0] * k, b[1] * k, (b[2] - b[0]) * k, (b[3] - b[1]) * k); c.restore(); }
}
function ctxbar() {
  const e = $('#ctx'); if (!S.sel) { e.classList.add('hidden'); return; }
  e.classList.remove('hidden'); e.innerHTML = '<button data-a="del">🗑 حذف</button><button data-a="big">＋ أكبر</button><button data-a="small">− أصغر</button><button data-a="dup">⧉ نسخ</button>';
  e.onclick = ev => {
    const a = ev.target.dataset.a; const s = S.sel; if (!s) return;
    if (a === 'del') { S.annots = S.annots.filter(x => x !== s); S.sel = null; }
    else if (a === 'dup') { const c = { ...s, id: uid(), x: s.x + 14, y: s.y + 14 }; delete c._img; if (s.pts) c.pts = s.pts.map(p => [p[0] + 14, p[1] + 14]); if (s.x2 != null) { c.x2 = s.x2 + 14; c.y2 = s.y2 + 14; } S.annots.push(c); S.sel = c; }
    else { const f = a === 'big' ? 1.15 : 1 / 1.15; if (s.t === 'text') s.size *= f; else if (s.w != null) { s.w *= f; s.h *= f; } else if (s.pts) { const b = bbox(s); s.pts = s.pts.map(p => [b[0] + (p[0] - b[0]) * f, b[1] + (p[1] - b[1]) * f]); } else if (s.x2 != null) { s.x2 = s.x + (s.x2 - s.x) * f; s.y2 = s.y + (s.y2 - s.y) * f; } }
    drawOv(s.p); if (S.sel) drawOv(S.sel.p); ctxbar(); histBtns();
  };
}
function bindDraw(i) {
  const v = S.views[i], ov = v.ov; let down = null;
  const pos = e => { const r = ov.getBoundingClientRect(); return [(e.clientX - r.left) / S.scale, (e.clientY - r.top) / S.scale]; };
  ov.onpointerdown = async e => {
    if (S.mode === 'read') return; e.preventDefault(); ov.setPointerCapture(e.pointerId); const [x, y] = pos(e); const m = S.mode;
    if (m === 'select') {
      const hit = [...S.annots].reverse().find(a => a.p === i && (b => x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3])(bbox(a)));
      const old = S.sel; S.sel = hit || null; if (old) drawOv(old.p); drawOv(i); ctxbar(); if (hit) down = { m: 'move', x, y, a: hit, o: JSON.parse(JSON.stringify({ ...hit, _img: 0 })) }; return;
    }
    if (m === 'text') { const t = await ask('اكتب النص', { area: true }); if (t && t.trim()) pushA({ id: uid(), p: i, t: 'text', x, y, text: t, size: S.size, color: S.color }); return; }
    if (m === 'sign') { if (!S.sigPending) return; const w = 150, h = w * S.sigPending.r; pushA({ id: uid(), p: i, t: 'img', x: x - w / 2, y: y - h / 2, w, h, data: S.sigPending.data }); S.sigPending = null; setMode('select'); S.sel = S.annots[S.annots.length - 1]; drawOv(i); ctxbar(); return; }
    if (m === 'stamp') { if (!S.stampText) return; pushA({ id: uid(), p: i, t: 'text', x, y, text: S.stampText, size: S.size + 6, color: S.stampColor || S.color }); return; }
    if (m === 'edit') { const it = (v.items || []).find(t => x >= t.x - 2 && x <= t.x + t.w + 2 && y >= t.y - 2 && y <= t.y + t.h + 2); if (!it) return toast('اضغط على سطر نص (لو الملف صور، استخدم OCR الأول)'); const nt = await ask('عدّل النص', { value: it.str, area: true }); if (nt == null || nt === it.str) return; pushA({ id: uid(), p: i, t: 'white', x: it.x - 1, y: it.y - 1, w: it.w + 2, h: it.h + 2 }); if (nt.trim()) { const a = { id: uid(), p: i, t: 'text', text: nt, size: Math.max(6, it.fs * .92), color: '#000000', x: it.x, y: it.y }; const mw = measureText(a).w; if (isAr(nt)) a.x = it.x + it.w - mw + 2; pushA(a); } return; }
    if (m === 'eraser') { down = { m: 'erase' }; eraseAt(i, x, y); return; }
    down = { m, x, y, pts: [[x, y]] };
  };
  ov.onpointermove = e => {
    if (!down) return; const [x, y] = pos(e);
    if (down.m === 'erase') return eraseAt(i, x, y);
    if (down.m === 'move') { const a = down.a, o = down.o, dx = x - down.x, dy = y - down.y; if (a.pts) a.pts = o.pts.map(p => [p[0] + dx, p[1] + dy]); else { a.x = o.x + dx; a.y = o.y + dy; if (a.x2 != null) { a.x2 = o.x2 + dx; a.y2 = o.y2 + dy; } } drawOv(i); return; }
    const m = down.m, lw = S.width;
    if (m === 'pen') { down.pts.push([x, y]); v.tmp = { t: 'ink', pts: down.pts, color: S.color, w: lw }; }
    else if (m === 'hlpen') { down.pts.push([x, y]); v.tmp = { t: 'ink', pts: down.pts, color: S.hlColor || '#facc15', w: 16, alpha: .38 }; }
    else if (m === 'line' || m === 'arrow') v.tmp = { t: m, x: down.x, y: down.y, x2: x, y2: y, color: S.color, lw };
    else { const r = { x: Math.min(down.x, x), y: Math.min(down.y, y), w: Math.abs(x - down.x), h: Math.abs(y - down.y) }; const t = { rect: 'rect', ell: 'ell', white: 'white', redact: 'redact', hlbox: 'hl' }[m]; v.tmp = { t, ...r, color: m === 'hlbox' ? (S.hlColor || '#facc15') : S.color, lw }; }
    drawOv(i);
  };
  ov.onpointerup = ov.onpointercancel = () => {
    if (!down) return; const d = down; down = null;
    if (d.m === 'move') { histBtns(); return; }
    if (v.tmp) { const t = v.tmp; v.tmp = null; t.id = uid(); t.p = i; if ((t.w != null && t.w < 3 && t.h < 3)) { drawOv(i); return; } if (t.t === 'hl') t.text = ''; pushA(t); } drawOv(i);
  };
}
function eraseAt(i, x, y) { const hit = S.annots.find(a => a.p === i && (b => x >= b[0] - 3 && x <= b[2] + 3 && y >= b[1] - 3 && y <= b[3] + 3)(bbox(a))); if (hit) { S.annots = S.annots.filter(a => a !== hit); drawOv(i); histBtns(); } }
function setMode(m) { S.mode = m; document.body.classList.toggle('drawing', m !== 'read'); if (m !== 'select') { const o = S.sel; S.sel = null; if (o) drawOv(o.p); ctxbar(); } $$('#panel [data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === m)); }
function highlightSelection(color) {
  const sel = getSelection(); if (!sel || sel.isCollapsed) return toast('حدد نص الأول بصباعك');
  const txt = sel.toString().trim(); let n = 0;
  for (const r of sel.getRangeAt(0).getClientRects()) {
    for (let i = 0; i < S.views.length; i++) {
      const v = S.views[i]; if (!v.ov) continue; const b = v.el.getBoundingClientRect();
      if (r.bottom > b.top && r.top < b.bottom && r.right > b.left && r.left < b.right && r.width > 2) { S.annots.push({ id: uid(), p: i, t: 'hl', x: (r.left - b.left) / S.scale, y: (r.top - b.top) / S.scale, w: r.width / S.scale, h: r.height / S.scale, color, text: n === 0 ? txt : '' }); drawOv(i); n++; break; }
    }
  }
  sel.removeAllRanges(); S.redo = []; histBtns(); toast(n ? 'اتظلل ✅' : 'مقدرتش أظلل');
}

/* ---------- export / flatten ---------- */
async function renderRaster(i, scale, withAnnots, fmt = 'image/jpeg', q = .85) {
  const v = S.views[i] || {}; const page = await S.pdf.getPage(i + 1); const vp = page.getViewport({ scale });
  const c = document.createElement('canvas'); c.width = Math.floor(vp.width); c.height = Math.floor(vp.height); const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  await page.render({ canvasContext: g, viewport: vp }).promise;
  if (withAnnots) await paintAll(g, i, scale);
  return c;
}
async function paintAll(g, i, k) { const list = S.annots.filter(a => a.p === i); for (const a of list) { if (a.t === 'img' && !(a._img && a._img.complete)) { a._img = new Image(); a._img.src = a.data; await new Promise(r => { a._img.onload = r; a._img.onerror = r; }); } paint(g, a, k); } }
const blobOf = (c, type, q) => new Promise(r => c.toBlob(r, type, q));
const bufOf = async (c, type, q) => new Uint8Array(await (await blobOf(c, type, q)).arrayBuffer());
async function exportBytes(onlyIfAnnots) {
  const hasA = S.annots.length > 0; if (!hasA && onlyIfAnnots) return S.bytes; if (!hasA) return S.bytes;
  if (S.encrypted) throw new Error('الملف محمي. استخدم "فك الحماية" الأول.');
  const doc = await PDFDocument.load(S.bytes); const pages = [...new Set(S.annots.map(a => a.p))].sort((a, b) => a - b);
  const rasterSet = new Set(); const done = [];
  for (const i of pages) {
    const pg = doc.getPage(i); const rot = pg.getRotation().angle; const hasRed = S.annots.some(a => a.p === i && a.t === 'redact');
    if (rot || hasRed) { rasterSet.add(i); continue; }
    const { width, height } = pg.getSize(); const k = Math.min(3, 2400 / S.views[i].w);
    const c = document.createElement('canvas'); c.width = Math.round(S.views[i].w * k); c.height = Math.round(S.views[i].h * k); await paintAll(c.getContext('2d'), i, k);
    const img = await doc.embedPng(await bufOf(c, 'image/png')); pg.drawImage(img, { x: 0, y: 0, width, height });
  }
  for (const i of rasterSet) {
    const k = Math.min(2.5, 2200 / S.views[i].w); const c = await renderRaster(i, k, true); const img = await doc.embedJpg(await bufOf(c, 'image/jpeg', .9));
    const { width, height } = S.views[i].page.getViewport({ scale: 1 }); const np = doc.insertPage(i, [width, height]); np.drawImage(img, { x: 0, y: 0, width, height }); doc.removePage(i + 1);
  }
  return await doc.save();
}
async function flatten() { // bake annotations into S.bytes
  if (!S.annots.length) return;
  busy(true, 'بثبّت التعديلات...'); await tick();
  const nb = await exportBytes(); S.hist.push({ bytes: S.bytes, annots: S.annots }); S.annots = []; await loadBytes(nb); histBtns(); busy(false);
}
async function applyOp(fn, msg = 'بنفذ...') {
  if (!S.pdf) return toast('افتح ملف الأول');
  if (S.encrypted) return toast('الملف محمي. استخدم "فك الحماية" من الأدوات الأول.');
  busy(true, msg); await tick();
  try {
    const base = await exportBytes(); const doc = await PDFDocument.load(base); const keep = S.annots; const r = await fn(doc);
    if (r === false) { busy(false); return; }
    const nb = await doc.save(); S.hist.push({ bytes: S.bytes, annots: keep }); S.annots = []; S.redo = []; S.ocr = {}; await loadBytes(nb); histBtns();
  } catch (e) { console.error(e); toast('حصلت مشكلة: ' + (e.message || e)); }
  busy(false);
}
$('#btnSave').onclick = async () => {
  if (!S.pdf) return; busy(true, 'بجهز الملف...'); await tick();
  try {
    const nb = await exportBytes(); const base = S.name.replace(/\.pdf$/i, ''); const blob = new Blob([nb], { type: 'application/pdf' });
    busy(false);
    if (navigator.canShare && navigator.canShare({ files: [new File([blob], base + '-edited.pdf', { type: 'application/pdf' })] }) && matchMedia('(pointer:coarse)').matches) {
      const go = await form('حفظ الملف', '<p>عايز تحفظه ولا تشاركه؟</p>', () => 1); if (go === null) return;
    }
    dl(blob, base + '-edited.pdf'); toast('اتحفظ: ' + fmtSize(nb.length));
  } catch (e) { busy(false); toast(e.message || 'مقدرتش أحفظ'); }
};
async function shareFile() { const nb = await exportBytes(); const f = new File([nb], S.name.replace(/\.pdf$/i, '') + '-edited.pdf', { type: 'application/pdf' }); if (navigator.canShare && navigator.canShare({ files: [f] })) navigator.share({ files: [f], title: S.name }).catch(() => { }); else { dl(f, f.name); } }

/* ---------- text extraction ---------- */
async function pageText(i) {
  if (S.ocr[i]) return S.ocr[i]; if (S.texts[i] != null) return S.texts[i];
  const tc = await (await S.pdf.getPage(i + 1)).getTextContent(); let t = '';
  for (const it of tc.items) { t += it.str; t += it.hasEOL ? '\n' : ' '; }
  return S.texts[i] = t.replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').trim();
}
async function allText(prog) { const o = []; for (let i = 0; i < S.n; i++) { o.push(await pageText(i)); if (prog) prog(i + 1); } return o; }
const words = t => (t.match(/[\p{L}\p{N}]+/gu) || []);
const STOP = new Set('في من على الى إلى عن مع هذا هذه ذلك التي الذي التى التي كان كانت يكون هو هي هم ان أن إن او أو ثم لا ما لم لن قد كل بعد قبل بين حتى عند كما اذا إذا ايضا أيضا the of and to in a is that for it as with was on are be by this an at from or which have has had not but they their will can been were more than its also into other these such'.split(' '));
const norm = w => w.toLowerCase().replace(/[\u064B-\u0652\u0640]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
function sentences(t) { return t.replace(/\n{2,}/g, '. ').replace(/([.!?؟۔])\s+/g, '$1\u0001').replace(/\n/g, ' ').split('\u0001').map(s => s.trim()).filter(s => s.length > 25 && s.length < 500); }
function keywords(t, n = 12) { const f = {}; words(t).forEach(w => { const k = norm(w); if (k.length > 2 && !STOP.has(k) && !/^\d+$/.test(k)) f[k] = (f[k] || 0) + 1; }); return Object.entries(f).sort((a, b) => b[1] - a[1]).slice(0, n); }
function summarize(t, n = 6) {
  const ss = sentences(t); if (ss.length <= n) return ss; const f = Object.fromEntries(keywords(t, 400)); const mx = Math.max(1, ...Object.values(f));
  const sc = ss.map((s, i) => { const ws = words(s).map(norm).filter(w => f[w]); const v = ws.reduce((a, w) => a + f[w] / mx, 0) / Math.pow(Math.max(ws.length, 8), .6); return { s, i, v: v * (i < 3 ? 1.15 : 1) }; });
  return sc.sort((a, b) => b.v - a.v).slice(0, n).sort((a, b) => a.i - b.i).map(x => x.s);
}

/* ---------- translate ---------- */
const LANGS = { ar: 'العربية', en: 'English', fr: 'Français', de: 'Deutsch', es: 'Español', tr: 'Türkçe', it: 'Italiano', ru: 'Русский', 'zh-CN': '中文', hi: 'हिन्दी', ur: 'اردو', fa: 'فارسی', pt: 'Português', ja: '日本語', ko: '한국어' };
const langOpts = sel => Object.entries(LANGS).map(([k, v]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${v}</option>`).join('');
S.tl = LS.get('tl', 'ar');
function chunk(t, max = 1400) { const out = []; let cur = ''; for (const p of t.split(/(?<=[.!?؟\n])\s*/)) { if ((cur + p).length > max && cur) { out.push(cur); cur = ''; } if (p.length > max) { for (let i = 0; i < p.length; i += max) out.push(p.slice(i, i + max)); } else cur += (cur ? ' ' : '') + p; } if (cur) out.push(cur); return out; }
const tfetch = async (u, ms = 7000) => { const c = new AbortController(); const t = setTimeout(() => c.abort(), ms); try { const r = await fetch(u, { signal: c.signal }); if (!r.ok) throw new Error('http ' + r.status); return r; } finally { clearTimeout(t); } };
async function trChunk(q, tl) {
  const sl = isAr(q) ? 'ar' : 'en'; if (sl === tl.slice(0, 2)) return q;
  const eq = encodeURIComponent(q); const tries = [
    async () => { const j = await (await tfetch('https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=' + tl + '&dt=t&q=' + eq)).json(); return j[0].map(x => x[0]).join(''); },
    async () => { const j = await (await tfetch(`https://lingva.ml/api/v1/${sl}/${tl.slice(0, 2)}/${eq}`)).json(); return j.translation; },
    async () => { const j = await (await tfetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(q.slice(0, 480))}&langpair=${sl}|${tl}`)).json(); const t = j.responseData && j.responseData.translatedText; if (!t || /^\[|QUERY LENGTH|MYMEMORY/i.test(t)) throw new Error('bad'); return t; },
  ];
  for (const f of tries) { try { const r = await f(); if (r && r.trim()) return r; } catch { } }
  throw new Error('الترجمة مش متاحة دلوقتي، اتأكد من النت');
}
async function translate(text, tl, prog) { const cs = chunk(text.trim()); const out = []; for (let i = 0; i < cs.length; i++) { out.push(await trChunk(cs[i], tl)); prog && prog(i + 1, cs.length); } return out.join('\n'); }
async function doTranslate(text, title) {
  if (!text || !text.trim()) return toast('مفيش نص. جرب OCR لو الصفحة صورة');
  busy(true, 'بترجم...');
  try { const out = await translate(text, S.tl); busy(false); sheet(title, `<div class="row"><select id="trLang">${langOpts(S.tl)}</select></div><div class="card" dir="${S.tl === 'ar' || S.tl === 'ur' || S.tl === 'fa' ? 'rtl' : 'ltr'}">${esc(out)}</div><div class="card" style="opacity:.75" dir="auto">${esc(text)}</div>`, [['نسخ', () => copyTxt(out)], ['🔊', () => speak(out, S.tl)]]); $('#trLang').onchange = e => { S.tl = e.target.value; LS.set('tl', S.tl); doTranslate(text, title); }; }
  catch (e) { busy(false); toast(e.message || 'فشلت الترجمة، تأكد من النت'); }
}
const selText = () => (getSelection() || '').toString().trim();

/* ---------- AI (Gemini, optional key) ---------- */
const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest'];
async function gemini(prompt, json) {
  const key = LS.get('gkey', ''); if (!key) throw new Error('NOKEY');
  let last; for (const m of [LS.get('gmodel', null), ...MODELS].filter(Boolean)) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${encodeURIComponent(key)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: json ? { responseMimeType: 'application/json' } : {} }) });
      const j = await r.json(); if (!r.ok) { last = j.error && j.error.message || r.status; if (r.status === 404) continue; throw new Error(last); }
      LS.set('gmodel', m); return j.candidates[0].content.parts.map(p => p.text).join('');
    } catch (e) { last = e.message; if (!/not found|404|models\//i.test(String(last))) throw e; }
  } throw new Error(last || 'Gemini error');
}
async function setKey() { const k = await ask('مفتاح Gemini المجاني', { value: LS.get('gkey', ''), type: 'password', note: 'من aistudio.google.com/apikey . بيتخزن على جهازك بس.' }); if (k != null) { LS.set('gkey', k.trim()); toast(k.trim() ? 'اتحفظ ✅' : 'اتمسح'); } }
function needKey(e) { if (e.message === 'NOKEY') { toast('محتاج مفتاح Gemini (أداة "مفتاح AI")'); return true; } toast('AI: ' + e.message, 4000); return false; }
async function aiSummary() {
  if (!S.pdf) return; busy(true, 'بقرا الملف...'); const t = (await allText()).join('\n\n'); const lang = LANGS[S.tl];
  try { busy(true, 'AI بيلخص...'); const out = await gemini(`لخّص النص التالي بلغة ${lang} في نقاط واضحة مرتبة مع عنوان لكل قسم، وأذكر أهم المفاهيم في النهاية:\n\n${t.slice(0, 180000)}`); busy(false); sheet('ملخص AI', esc(out), [['نسخ', () => copyTxt(out)], ['🔊', () => speak(out, S.tl)]]); }
  catch (e) { busy(false); if (!needKey(e)) return; offlineSummary(); }
}
async function offlineSummary() {
  if (!S.pdf) return; busy(true, 'بلخص...'); const parts = await allText(); busy(false); const t = parts.join('\n\n'); if (t.trim().length < 80) return toast('النص قليل أو الملف صور. جرب OCR.');
  const n = Math.min(10, Math.max(4, Math.round(sentences(t).length / 12))); const ss = summarize(t, n); const kw = keywords(t, 14);
  const txt = '• ' + ss.join('\n• ');
  sheet('ملخص سريع (بدون نت)', `<div class="card" dir="auto">${esc(txt)}</div><b>الكلمات المفتاحية</b><div>${kw.map(([w, c]) => `<span class="chip">${esc(w)} · ${c}</span>`).join('')}</div>`, [['نسخ', () => copyTxt(txt)], ['ترجم', () => doTranslate(txt, 'ترجمة الملخص')], ['🔊', () => speak(txt)]]);
}
async function askDoc() {
  if (!S.pdf) return; const q = await ask('اسأل الملف'); if (!q) return; busy(true, 'بدور في الملف...'); const parts = await allText();
  const qs = new Set(words(q).map(norm).filter(w => w.length > 2 && !STOP.has(w))); const cands = [];
  parts.forEach((t, p) => sentences(t).forEach(s => { const ws = new Set(words(s).map(norm)); let sc = 0; qs.forEach(w => { if (ws.has(w)) sc++; }); if (sc) cands.push({ p, s, sc }); }));
  cands.sort((a, b) => b.sc - a.sc); const top = cands.slice(0, 5);
  try {
    const ctx = parts.map((t, p) => `[صفحة ${p + 1}]\n${t}`).join('\n').slice(0, 150000); const out = await gemini(`أجب عن السؤال بالاعتماد على نص الملف فقط وبنفس لغة السؤال، واذكر رقم الصفحة. لو الإجابة مش موجودة قل كده.\nالسؤال: ${q}\n\nالملف:\n${ctx}`); busy(false); sheet('إجابة AI', esc(out), [['نسخ', () => copyTxt(out)]]);
  } catch (e) {
    busy(false); if (e.message !== 'NOKEY') toast('AI: ' + e.message, 3500);
    sheet('أقرب فقرات للسؤال (بحث بدون AI)', top.length ? top.map(x => `<div class="card"><b>صفحة ${x.p + 1}</b>\n${esc(x.s)}<div class="row"><button data-go="${x.p}">اذهب للصفحة</button></div></div>`).join('') : 'مفيش نتيجة. حط مفتاح Gemini لإجابات أذكى.'); $$('#sheetBody [data-go]').forEach(b => b.onclick = () => { $('#sheet').classList.add('hidden'); goPage(+b.dataset.go); });
  }
}

/* ---------- OCR ---------- */
let tessP;
function loadTess() { return tessP || (tessP = new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js'; s.onload = () => res(window.Tesseract); s.onerror = () => { tessP = null; rej(new Error('محتاج نت لتحميل OCR أول مرة')); }; document.head.appendChild(s); })); }
async function ocrPages(list) {
  busy(true, 'بحمّل محرك OCR (أول مرة بياخد وقت)...'); try {
    const T = await loadTess(); const w = await T.createWorker('ara+eng'); let n = 0;
    for (const i of list) { busy(true, `OCR صفحة ${i + 1} (${++n}/${list.length})`); const c = await renderRaster(i, 2.2, false); const { data } = await w.recognize(c); S.ocr[i] = data.text.trim(); }
    await w.terminate(); busy(false); return true;
  } catch (e) { busy(false); toast(e.message || 'فشل OCR'); return false; }
}
async function ocrAndShow(list) { if (!S.pdf) return; if (await ocrPages(list)) { const t = list.map(i => `— صفحة ${i + 1} —\n${S.ocr[i]}`).join('\n\n'); sheet('نص OCR', esc(t), [['نسخ', () => copyTxt(t)], ['ترجم', () => doTranslate(t, 'ترجمة نص OCR')], ['تحميل txt', () => dl(new Blob([t], { type: 'text/plain' }), S.name + '-ocr.txt')]]); } }

/* ---------- speech ---------- */
function stopSpeak() { try { speechSynthesis.cancel(); } catch { } }
function speak(t, lang) {
  if (!('speechSynthesis' in window)) return toast('المتصفح ما بيدعمش القراءة'); stopSpeak(); lang = lang || (isAr(t) ? 'ar' : 'en');
  const parts = chunk(t, 180); const rate = LS.get('rate', 1); toast('بقرا... (✕ لإيقاف القراءة)');
  parts.forEach(p => { const u = new SpeechSynthesisUtterance(p); u.lang = { ar: 'ar-SA', en: 'en-US', 'zh-CN': 'zh-CN' }[lang] || lang; u.rate = rate; speechSynthesis.speak(u); });
}

/* ---------- search ---------- */
async function searchDoc() {
  if (!S.pdf) return; const q = await ask('ابحث في الملف', { value: S.query }); if (q == null) return; S.query = q.trim(); S.views.forEach((_, i) => markHits(i));
  if (!S.query) return; busy(true, 'بدور...'); const parts = await allText(); busy(false); const res = []; const ql = S.query.toLowerCase();
  parts.forEach((t, p) => { const tl = t.toLowerCase(); let k = 0; while ((k = tl.indexOf(ql, k)) >= 0 && res.length < 300) { res.push({ p, s: t.slice(Math.max(0, k - 40), k + ql.length + 60).replace(/\n/g, ' '), k }); k += ql.length; } });
  sheet(`${res.length} نتيجة لـ "${S.query}"`, res.map((r, i) => `<div class="card" data-go="${r.p}" style="cursor:pointer"><b>ص ${r.p + 1}</b> ${esc(r.s)}</div>`).join('') || 'مفيش نتائج', [['مسح التمييز', () => { S.query = ''; S.views.forEach((_, i) => markHits(i)); }]]);
  $$('#sheetBody [data-go]').forEach(b => b.onclick = () => { $('#sheet').classList.add('hidden'); goPage(+b.dataset.go); });
}

/* ---------- signature ---------- */
async function drawSignature() {
  const html = '<canvas id="sigpad"></canvas><div class="row" style="display:flex;gap:6px;margin-top:6px"><button type="button" id="sigClr" class="ghost">مسح</button><input type="color" id="sigCol" value="#1d2b8f" style="width:40px"></div>';
  const p = form('ارسم توقيعك بصباعك', html, () => { const c = $('#sigpad'); return c.hasInk ? trimCanvas(c) : null; });
  const c = $('#sigpad'); c.width = 600; c.height = 240; const g = c.getContext('2d'); let on = false, last;
  const pt = e => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) * c.width / r.width, (e.clientY - r.top) * c.height / r.height]; };
  c.onpointerdown = e => { on = true; c.setPointerCapture(e.pointerId); last = pt(e); }; c.onpointerup = () => on = false;
  c.onpointermove = e => { if (!on) return; const q = pt(e); g.strokeStyle = $('#sigCol').value; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(...last); g.lineTo(...q); g.stroke(); last = q; c.hasInk = true; };
  $('#sigClr').onclick = () => { g.clearRect(0, 0, c.width, c.height); c.hasInk = false; };
  const r = await p; if (r) { const list = LS.get('sigs', []); list.unshift(r); LS.set('sigs', list.slice(0, 6)); useSignature(r); }
}
function trimCanvas(c) { const g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height).data; let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0; for (let y = 0; y < c.height; y++)for (let x = 0; x < c.width; x++)if (d[(y * c.width + x) * 4 + 3] > 20) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } const w = x1 - x0 + 1, h = y1 - y0 + 1, o = document.createElement('canvas'); o.width = w; o.height = h; o.getContext('2d').drawImage(c, x0, y0, w, h, 0, 0, w, h); return o.toDataURL('image/png'); }
function useSignature(data) { const im = new Image(); im.onload = () => { S.sigPending = { data, r: im.naturalHeight / im.naturalWidth }; setMode('sign'); toast('اضغط على المكان اللي عايز التوقيع فيه'); }; im.src = data; }
function pickSignature() { const l = LS.get('sigs', []); if (!l.length) return drawSignature(); sheet('توقيعاتي', `<div class="thumbs">${l.map((d, i) => `<div class="th" data-i="${i}"><img src="${d}" style="max-width:100%;background:#fff"><div class="b"><button data-del="${i}">🗑</button></div></div>`).join('')}</div>`); $$('#sheetBody .th').forEach(t => t.onclick = e => { const i = +t.dataset.i; if (e.target.dataset.del != null) { l.splice(i, 1); LS.set('sigs', l); pickSignature(); return; } $('#sheet').classList.add('hidden'); useSignature(l[i]); }); }
async function sigFromPhoto(file) {
  const im = await createImageBitmap(file); const c = document.createElement('canvas'); const k = Math.min(1, 700 / im.width); c.width = im.width * k; c.height = im.height * k; const g = c.getContext('2d'); g.drawImage(im, 0, 0, c.width, c.height);
  const d = g.getImageData(0, 0, c.width, c.height), px = d.data; for (let i = 0; i < px.length; i += 4) { const l = .3 * px[i] + .59 * px[i + 1] + .11 * px[i + 2]; if (l > 170) px[i + 3] = 0; else { px[i + 3] = Math.min(255, (170 - l) * 3); px[i] = px[i + 1] = 20; px[i + 2] = 90; } } g.putImageData(d, 0, 0);
  const r = trimCanvas(c); const list = LS.get('sigs', []); list.unshift(r); LS.set('sigs', list.slice(0, 6)); useSignature(r);
}
function stamp(text, color) { S.stampText = text; S.stampColor = color; setMode('stamp'); toast('اضغط مكان الختم'); }

/* ---------- page management ---------- */
async function pageManager() {
  if (!S.pdf) return toast('افتح ملف الأول'); await flatten(); const sel = new Set();
  sheet('إدارة الصفحات', '<div class="thumbs" id="thg"></div>', [['استخراج المحدد', () => extractPages([...sel])], ['حذف المحدد', () => { if (sel.size) { const l = [...sel].sort((a, b) => b - a); $('#sheet').classList.add('hidden'); applyOp(d => { if (l.length >= d.getPageCount()) { toast('مينفعش تحذف كل الصفحات'); return false; } l.forEach(i => d.removePage(i)); }); } }]]);
  const g = $('#thg');
  for (let i = 0; i < S.n; i++) {
    const w = document.createElement('div'); w.className = 'th'; const c = await renderRaster(i, 120 / S.views[i].w, false); w.appendChild(c);
    const b = document.createElement('div'); b.className = 'b'; b.innerHTML = `<span>${i + 1}</span><button data-a="rot">↻</button><button data-a="rotl">↺</button><button data-a="del">🗑</button><button data-a="dup">⧉</button><button data-a="up">▶</button><button data-a="dn">◀</button><button data-a="blank">＋</button>`; w.appendChild(b); g.appendChild(w);
    c.onclick = () => { sel.has(i) ? sel.delete(i) : sel.add(i); w.classList.toggle('sel'); };
    b.onclick = e => { const a = e.target.dataset.a; if (!a) return; $('#sheet').classList.add('hidden'); applyOp(d => {
      const pg = d.getPage(i);
      if (a === 'rot' || a === 'rotl') pg.setRotation(degrees((pg.getRotation().angle + (a === 'rot' ? 90 : 270)) % 360));
      else if (a === 'del') { if (d.getPageCount() < 2) { toast('دي آخر صفحة'); return false; } d.removePage(i); }
      else if (a === 'dup') return d.copyPages(d, [i]).then(([p]) => d.insertPage(i + 1, p));
      else if (a === 'blank') { const { width, height } = pg.getSize(); d.insertPage(i + 1, [width, height]); }
      else { const j = a === 'up' ? i - 1 : i + 1; if (j < 0 || j >= d.getPageCount()) return false; return d.copyPages(d, [i]).then(([p]) => { d.removePage(i); d.insertPage(j, p); }); }
    }).then(() => setTimeout(pageManager, 100)); };
  }
}
async function extractPages(list) { if (!list.length) return toast('حدد صفحات الأول (دوس على الصورة)'); busy(true, 'بستخرج...'); const d = await PDFDocument.load(S.bytes), n = await PDFDocument.create(); (await n.copyPages(d, list.sort((a, b) => a - b))).forEach(p => n.addPage(p)); const b = await n.save(); busy(false); dl(new Blob([b], { type: 'application/pdf' }), S.name.replace(/\.pdf$/i, '') + '-pages.pdf'); }
function parseRanges(s, n) { const out = []; s.split(/[,،]/).forEach(p => { const m = p.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/); if (m) { const a = +m[1], b = +(m[2] || m[1]); for (let i = Math.max(1, a); i <= Math.min(n, b); i++)out.push(i - 1); } }); return out; }
async function splitDoc() {
  if (!S.pdf) return toast('افتح ملف الأول'); const r = await ask('تقسيم / استخراج', { value: '1-' + Math.min(S.n, 3), note: 'اكتب الصفحات، مثال: 1-3, 5, 8-10. هيتحفظ ملف جديد بالصفحات دي.' }); if (!r) return; const l = parseRanges(r, S.n); if (!l.length) return toast('مدى غير صحيح'); await flatten(); extractPages(l);
}
async function imagesToDoc(files, doc) {
  for (const f of files) {
    const im = await createImageBitmap(f); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0);
    const k = Math.min(1, 2200 / Math.max(c.width, c.height)); const o = document.createElement('canvas'); o.width = c.width * k; o.height = c.height * k; o.getContext('2d').drawImage(c, 0, 0, o.width, o.height);
    const img = await doc.embedJpg(await bufOf(o, 'image/jpeg', .88)); const W = 595.28, H = 841.89; const sc = Math.min(W / img.width, H / img.height, 1.0); const pw = Math.max(img.width * sc, 200), ph = Math.max(img.height * sc, 200); const pg = doc.addPage([pw, ph]); pg.drawImage(img, { x: 0, y: 0, width: pw, height: ph });
  }
}
$('#fileMulti').onchange = async e => {
  const files = [...e.target.files]; const mode = e.target.dataset.mode; e.target.value = ''; if (!files.length) return;
  const run = async d => {
    for (const f of files) { if (/pdf$/i.test(f.type) || /\.pdf$/i.test(f.name)) { const src = await PDFDocument.load(await f.arrayBuffer(), { ignoreEncryption: false }); (await d.copyPages(src, src.getPageIndices())).forEach(p => d.addPage(p)); } else await imagesToDoc([f], d); }
  };
  if (mode === 'new' || !S.pdf) { busy(true, 'بجمع الملفات...'); try { const d = await PDFDocument.create(); await run(d); S.name = 'ملف-مجمّع.pdf'; await loadBytes(await d.save(), true); } catch (er) { toast('مشكلة: ' + er.message); } busy(false); }
  else applyOp(run, 'بدمج...').then(() => toast('اتضاف في آخر الملف ✅'));
};
function mergeFiles() { $('#fileMulti').dataset.mode = S.pdf ? 'append' : 'new'; $('#fileMulti').click(); }
async function pageNumbers() {
  const r = await form('أرقام الصفحات', `<label>الموضع</label><select id="pnPos"><option value="bc">أسفل المنتصف</option><option value="br">أسفل يمين</option><option value="bl">أسفل يسار</option></select><label>الصيغة</label><select id="pnFmt"><option value="n">1</option><option value="nN">1 / 10</option></select><label>يبدأ من</label><input type="text" id="pnStart" value="1">`, b => ({ pos: $('#pnPos', b).value, fmt: $('#pnFmt', b).value, st: +$('#pnStart', b).value || 1 })); if (!r) return;
  applyOp(async d => { const f = await d.embedFont(PDFLib.StandardFonts.Helvetica); d.getPages().forEach((p, i) => { const { width } = p.getSize(); const t = r.fmt === 'n' ? '' + (i + r.st) : `${i + r.st} / ${d.getPageCount() + r.st - 1}`; const w = f.widthOfTextAtSize(t, 10); const x = r.pos === 'bc' ? (width - w) / 2 : r.pos === 'br' ? width - w - 28 : 28; p.drawText(t, { x, y: 20, size: 10, font: f, color: PDFLib.rgb(.25, .25, .25) }); }); });
}
async function watermark() {
  const r = await form('علامة مائية', `<label>النص</label><input type="text" id="wmT" value="سري"><label>الشفافية</label><select id="wmO"><option value=".15">خفيفة</option><option value=".28" selected>متوسطة</option><option value=".45">قوية</option></select>`, b => ({ t: $('#wmT', b).value, o: +$('#wmO', b).value })); if (!r || !r.t) return;
  applyOp(async d => { const c = document.createElement('canvas'); c.width = 1400; c.height = 1400; const g = c.getContext('2d'); g.translate(700, 700); g.rotate(-Math.PI / 5); g.fillStyle = '#888'; g.font = 'bold 190px Tahoma, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(r.t, 0, 0); const img = await d.embedPng(await bufOf(c, 'image/png')); d.getPages().forEach(p => { const { width, height } = p.getSize(); const s = Math.min(width, height) * .95; p.drawImage(img, { x: (width - s) / 2, y: (height - s) / 2, width: s, height: s, opacity: r.o }); }); });
}
async function rasterDoc(scale, q, msg) {
  const d = await PDFDocument.create(); const flat = S.annots; for (let i = 0; i < S.n; i++) { busy(true, `${msg} ${i + 1}/${S.n}`); await tick(); const c = await renderRaster(i, scale, true); const img = await d.embedJpg(await bufOf(c, 'image/jpeg', q)); const v = S.views[i].page.getViewport({ scale: 1 }); d.addPage([v.width, v.height]).drawImage(img, { x: 0, y: 0, width: v.width, height: v.height }); } return d;
}
async function compress() {
  if (!S.pdf) return toast('افتح ملف الأول'); const lv = await form('ضغط الملف', `<p>الحجم الحالي: ${fmtSize(S.bytes.length)}</p><label>الجودة</label><select id="cq"><option value="1.6|.7">عالية (ضغط خفيف)</option><option value="1.3|.55" selected>متوسطة</option><option value="1|.4">قوية (أصغر حجم)</option></select><p style="font-size:12px;color:var(--mut)">الضغط بيحوّل الصفحات لصور، فالنص مش هيبقى قابل للتحديد (تقدر تعمل OCR بعدها).</p>`, b => $('#cq', b).value); if (!lv) return;
  const [sc, q] = lv.split('|').map(Number); busy(true, 'بضغط...'); try { const d = await rasterDoc(sc, q, 'ضغط صفحة'); const b = await d.save(); busy(false); if (b.length >= S.bytes.length) toast('الملف مكانش محتاج ضغط (الناتج مش أصغر)'); else { S.hist.push({ bytes: S.bytes, annots: S.annots }); S.annots = []; const old = S.bytes.length; await loadBytes(b); toast(`قبل ${fmtSize(old)} ← بعد ${fmtSize(b.length)} ✅`, 5000); } } catch (e) { busy(false); toast(e.message); }
}
async function unlockDoc() { if (!S.pdf) return; if (!S.encrypted) return toast('الملف مش محمي'); busy(true, 'بفك الحماية...'); try { const d = await rasterDoc(2, .85, 'صفحة'); const nb = await d.save(); S.hist.push({ bytes: S.bytes, annots: S.annots }); S.annots = []; S.pwd = null; await loadBytes(nb); busy(false); toast('اتفكت الحماية (نسخة صور). اتأكد إنك تملك الملف.', 5000); } catch (e) { busy(false); toast(e.message); } }
async function pageAsImage() { if (!S.pdf) return; const i = curPage(); const c = await renderRaster(i, 2.5, true); dl(await blobOf(c, 'image/png'), `${S.name.replace(/\.pdf$/i, '')}-p${i + 1}.png`); }
async function exportText() { if (!S.pdf) return; busy(true, 'باستخرج النص...'); const p = await allText(); busy(false); const t = p.map((x, i) => `--- صفحة ${i + 1} ---\n${x}`).join('\n\n'); if (t.replace(/---.*---|\s/g, '').length < 10) return toast('مفيش نص. استخدم OCR.'); dl(new Blob([t], { type: 'text/plain;charset=utf-8' }), S.name.replace(/\.pdf$/i, '') + '.txt'); }
async function metaEdit() { if (!S.pdf) return; const d = await PDFDocument.load(S.bytes); const r = await form('بيانات الملف', `<label>العنوان</label><input type="text" id="mT" value="${esc(d.getTitle() || '')}"><label>المؤلف</label><input type="text" id="mA" value="${esc(d.getAuthor() || '')}">`, b => [$('#mT', b).value, $('#mA', b).value]); if (r) applyOp(x => { x.setTitle(r[0]); x.setAuthor(r[1]); }); }
async function stripMeta() { applyOp(d => { d.setTitle(''); d.setAuthor(''); d.setSubject(''); d.setKeywords([]); d.setProducer(''); d.setCreator(''); }).then(() => toast('اتمسحت بيانات الملف (المؤلف/البرنامج)')); }
async function docStats() {
  if (!S.pdf) return; busy(true, 'بحسب...'); const parts = await allText(); busy(false); const t = parts.join('\n'); const wc = words(t).length; const kw = keywords(t, 15); const ar = isAr(t);
  sheet('معلومات الملف', `الاسم: ${esc(S.name)}\nالصفحات: ${S.n}\nالحجم: ${fmtSize(S.bytes.length)}\nعدد الكلمات: ${wc}\nوقت القراءة تقريبًا: ${Math.max(1, Math.round(wc / (ar ? 180 : 230)))} دقيقة\nاللغة الغالبة: ${wc < 5 ? 'غير معروف (ممكن صور)' : ar ? 'العربية' : 'إنجليزية/لاتينية'}\nصفحات بدون نص: ${parts.filter(x => x.length < 5).length}\n\n<b>أهم الكلمات</b>\n${kw.map(([w, c]) => `<span class="chip">${esc(w)} · ${c}</span>`).join('')}`);
}

/* ---------- privacy: auto redact ---------- */
const PATS = { email: /[\w.+-]+@[\w-]+\.[\w.-]+/g, phone: /(?:\+?\d[\d\s\-()]{7,}\d)/g, digits: /\d{6,}/g, card: /\b(?:\d[ -]?){13,19}\b/g };
async function scanSensitive(kinds, custom) {
  const hits = []; for (let i = 0; i < S.n; i++) {
    const v = S.views[i]; let items = v.items; if (!items) { await renderPage(i); await new Promise(r => setTimeout(r, 120)); items = v.items; } if (!items) continue;
    for (const it of items) { const rs = [...kinds.map(k => PATS[k]), ...(custom ? [new RegExp(custom.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')] : [])]; const seen = []; for (const re of rs) { re.lastIndex = 0; let m; while ((m = re.exec(it.str))) { const a = m.index, b = a + m[0].length; if (seen.some(x => a < x[1] && b > x[0])) continue; seen.push([a, b]); const L = it.str.length; const fx = it.rtl ? (L - b) / L : a / L, fw = (b - a) / L; hits.push({ p: i, x: it.x + it.w * fx - 4 - it.w * fw * .04, y: it.y, w: it.w * fw * 1.08 + 8, h: it.h, k: m[0] }); } } }
  } return hits;
}
async function autoRedact() {
  if (!S.pdf) return toast('افتح ملف الأول');
  const r = await form('حجب البيانات الحساسة تلقائيًا', `<label><input type="checkbox" id="rE" checked> إيميلات</label><label><input type="checkbox" id="rP" checked> أرقام تليفون</label><label><input type="checkbox" id="rD" checked> أرقام طويلة (رقم قومي/حساب)</label><label><input type="checkbox" id="rC"> أرقام كروت</label><label>كلمة أو اسم معين (اختياري)</label><input type="text" id="rW">`, b => ({ kinds: [$('#rE', b).checked && 'email', $('#rP', b).checked && 'phone', $('#rD', b).checked && 'digits', $('#rC', b).checked && 'card'].filter(Boolean), w: $('#rW', b).value.trim() })); if (!r) return;
  busy(true, 'بدور على البيانات...'); const hits = await scanSensitive(r.kinds, r.w); busy(false);
  if (!hits.length) return toast('معلقتش على حاجة');
  hits.forEach(h => S.annots.push({ id: uid(), p: h.p, t: 'redact', x: h.x, y: h.y, w: h.w, h: h.h })); S.redo = []; S.views.forEach((_, i) => drawOv(i)); histBtns(); goPage(hits[0].p);
  toast(`حجبت ${hits.length} مكان. راجعهم ✋ (تحديد/حذف) وبعدين 💾 حفظ. الصفحات المحجوبة بتتحول لصور عشان النص ميبقاش تحتها.`, 7000);
}

/* ---------- study ---------- */
const HL = { yellow: '#facc15', green: '#4ade80', pink: '#f472b6', blue: '#60a5fa' };
function highlightList() { return S.annots.filter(a => a.t === 'hl' && a.text); }
function showHighlights() {
  const l = highlightList(); if (!l.length) return toast('ظلل نصوص الأول (حدد النص ثم لون)');
  const md = '# تظليلاتي: ' + S.name + '\n\n' + l.map(a => `- (ص ${a.p + 1}) ${a.text}`).join('\n');
  sheet(`تظليلاتي (${l.length})`, l.map(a => `<div class="card" style="border-inline-start:6px solid ${a.color}"><b>ص ${a.p + 1}</b>\n${esc(a.text)}<div class="row"><button data-go="${a.p}">اذهب</button><button data-tr="${a.id}">ترجم</button></div></div>`).join(''), [['نسخ الكل', () => copyTxt(md)], ['تحميل md', () => dl(new Blob([md], { type: 'text/markdown;charset=utf-8' }), 'highlights.md')], ['بطاقات', flashFromHighlights]]);
  $$('#sheetBody [data-go]').forEach(b => b.onclick = () => { $('#sheet').classList.add('hidden'); goPage(+b.dataset.go); }); $$('#sheetBody [data-tr]').forEach(b => b.onclick = () => doTranslate(l.find(a => a.id === b.dataset.tr).text, 'ترجمة تظليل'));
}
function runCards(cards, title) {
  if (!cards.length) return toast('مفيش مادة كفاية'); let i = 0, back = false;
  const draw = () => { const c = cards[i]; $('#sheetBody').innerHTML = `<div class="row" style="justify-content:space-between"><span>${i + 1} / ${cards.length}</span><span>دوس على البطاقة لقلبها</span></div><div class="card flash" id="fc" dir="auto">${esc(back ? c.a : c.q)}</div><div class="row"><button id="fPrev">السابق</button><button id="fNext" class="primary">التالي</button><button id="fShuf">خلط</button></div>`; $('#fc').onclick = () => { back = !back; draw(); }; $('#fNext').onclick = () => { i = (i + 1) % cards.length; back = false; draw(); }; $('#fPrev').onclick = () => { i = (i - 1 + cards.length) % cards.length; back = false; draw(); }; $('#fShuf').onclick = () => { cards.sort(() => Math.random() - .5); i = 0; back = false; draw(); }; };
  sheet(title, ''); draw();
}
function clozeFrom(s, kw) { const ws = s.split(/\s+/); const pick = ws.find(w => kw.has(norm(w.replace(/[^\p{L}\p{N}]/gu, '')))); if (!pick) return null; return { q: s.replace(pick, '_____'), a: pick.replace(/[.,;:!?؟،]/g, '') + '\n\n' + s }; }
function flashFromHighlights() { runCards(highlightList().map(a => { const k = new Set(keywords(a.text, 3).map(x => x[0])); return clozeFrom(a.text, k) || { q: a.text.slice(0, 60) + '...؟', a: a.text }; }), 'بطاقات من تظليلاتي'); }
async function quizDoc() {
  if (!S.pdf) return; busy(true, 'بجهز الأسئلة...'); const parts = await allText(); const t = parts.join('\n\n');
  try { const out = await gemini(`اعمل 12 بطاقة مذاكرة (سؤال وجواب مختصر) بلغة ${LANGS[S.tl]} من النص التالي. رجّع JSON فقط: [{"q":"..","a":".."}]\n\n${t.slice(0, 120000)}`, true); busy(false); const arr = JSON.parse(out.replace(/^```json|```$/g, '')); return runCards(arr, 'اختبار من AI'); }
  catch (e) { busy(false); if (e.message !== 'NOKEY') toast('AI مش متاح، هعمل أسئلة بسيطة بدون AI'); }
  const kw = new Set(keywords(t, 40).map(x => x[0])); const cards = summarize(t, 20).map(s => clozeFrom(s, kw)).filter(Boolean).slice(0, 14); runCards(cards, 'اختبار (املأ الفراغ)');
}
async function bookmark() { const i = curPage(); const b = LS.get('bm:' + S.key, []); if (b.includes(i)) { LS.set('bm:' + S.key, b.filter(x => x !== i)); toast('اتشالت العلامة'); } else { b.push(i); b.sort((a, c) => a - c); LS.set('bm:' + S.key, b); toast('علامة على صفحة ' + (i + 1) + ' 🔖'); } }
function showBookmarks() { const b = LS.get('bm:' + S.key, []); sheet('علاماتي', b.length ? b.map(i => `<div class="card" data-go="${i}" style="cursor:pointer">🔖 صفحة ${i + 1}</div>`).join('') : 'مفيش علامات'); $$('#sheetBody [data-go]').forEach(e => e.onclick = () => { $('#sheet').classList.add('hidden'); goPage(+e.dataset.go); }); }
let autoT; function autoScroll() { if (autoT) { clearInterval(autoT); autoT = null; toast('وقف التمرير'); return; } const sp = LS.get('asp', 1); autoT = setInterval(() => { $('#viewer').scrollBy(0, sp); }, 30); toast('تمرير تلقائي. دوس تاني للإيقاف'); }
function focusMode() { const on = $('#focusBar').classList.contains('hidden'); ['focusTop', 'focusBot', 'focusBar'].forEach(id => $('#' + id).classList.toggle('hidden', !on)); if (!on) return; let y = innerHeight * .45; const H = 90; const set = () => { $('#focusTop').style.height = y + 'px'; $('#focusBot').style.height = Math.max(0, innerHeight - y - H) + 'px'; $('#focusBar').style.top = y + H / 2 - 13 + 'px'; }; set(); const bar = $('#focusBar'); bar.onpointerdown = e => { bar.setPointerCapture(e.pointerId); bar.dragging = true; }; bar.onpointerup = () => bar.dragging = false; bar.onpointermove = e => { if (!bar.dragging) return; y = Math.max(0, Math.min(innerHeight - H, e.clientY - H / 2)); set(); }; }
function setNight(m) { S.night = m; document.body.classList.toggle('night', m === 'night'); document.body.classList.toggle('sepia', m === 'sepia'); LS.set('night', m); }
function setUI(dark) { document.body.classList.toggle('dark', dark); LS.set('dark', dark); $('meta[name=theme-color]').content = dark ? '#14141f' : '#4338ca'; }
async function readAloud() { if (!S.pdf) return; const t = selText() || await pageText(curPage()); if (!t) return toast('مفيش نص في الصفحة (جرب OCR)'); speak(t); }
async function bilingual() {
  if (!S.pdf) return; const t = await pageText(curPage()); if (!t) return toast('مفيش نص. جرب OCR'); busy(true, 'بترجم فقرة فقرة...');
  try { const paras = t.split(/\n+/).filter(x => x.trim().length > 1); const joined = []; let cur = ''; for (const p of paras) { cur += (cur ? ' ' : '') + p; if (/[.!?؟:]$/.test(p) || cur.length > 260) { joined.push(cur); cur = ''; } } if (cur) joined.push(cur); const out = []; for (const p of joined.slice(0, 40)) out.push(await trChunk(p, S.tl)); busy(false); sheet('ترجمة ثنائية اللغة (صفحة ' + (curPage() + 1) + ')', joined.map((p, i) => `<div class="card"><div dir="auto" style="opacity:.7">${esc(p)}</div><hr style="border:0;border-top:1px solid var(--line)"><div dir="auto"><b>${esc(out[i])}</b></div></div>`).join(''), [['نسخ', () => copyTxt(joined.map((p, i) => p + '\n' + out[i]).join('\n\n'))]]); }
  catch (e) { busy(false); toast('فشلت الترجمة'); }
}
async function translateWholeDoc() {
  if (!S.pdf) return; busy(true, 'بقرا الملف...'); const parts = await allText(); const out = [];
  try { for (let i = 0; i < parts.length; i++) { busy(true, `بترجم صفحة ${i + 1} / ${parts.length}`); out.push(parts[i].trim() ? await translate(parts[i], S.tl) : ''); } busy(false);
    const txt = out.map((x, i) => `--- صفحة ${i + 1} ---\n${x}`).join('\n\n'); const html = `<!doctype html><meta charset=utf-8><body dir="${['ar', 'ur', 'fa'].includes(S.tl) ? 'rtl' : 'ltr'}" style="font-family:Tahoma,Arial;line-height:1.9;max-width:760px;margin:auto;padding:20px">${out.map((x, i) => `<h4>صفحة ${i + 1}</h4><p>${esc(x).replace(/\n/g, '<br>')}</p>`).join('')}</body>`;
    sheet('ترجمة الملف كله', esc(txt.slice(0, 20000)) + (txt.length > 20000 ? '\n...' : ''), [['نسخ', () => copyTxt(txt)], ['txt', () => dl(new Blob([txt], { type: 'text/plain;charset=utf-8' }), S.name + '-translated.txt')], ['html', () => dl(new Blob([html], { type: 'text/html;charset=utf-8' }), S.name + '-translated.html')]]);
  } catch (e) { busy(false); toast(e.message || 'فشلت الترجمة'); }
}

/* ---------- tap to translate + selection bar ---------- */
S.tap = LS.get('tap', true); const trCache = new Map();
async function trCached(q, tl) { const k = tl + '|' + q; if (trCache.has(k)) return trCache.get(k); const r = await trChunk(q, tl); trCache.set(k, r); return r; }
function wordAt(x, y) {
  let node, off; if (document.caretPositionFromPoint) { const p = document.caretPositionFromPoint(x, y); if (p) { node = p.offsetNode; off = p.offset; } } else if (document.caretRangeFromPoint) { const r = document.caretRangeFromPoint(x, y); if (r) { node = r.startContainer; off = r.startOffset; } }
  if (!node || node.nodeType !== 3) return null; const t = node.textContent; let a = Math.min(off, t.length), b = a; const ok = c => /[\p{L}\p{N}'’\-]/u.test(c || '');
  while (a > 0 && ok(t[a - 1])) a--; while (b < t.length && ok(t[b])) b++; const w = t.slice(a, b).replace(/^[-'’]+|[-'’]+$/g, ''); return w ? { word: w, line: t } : null;
}
function popup(x, y, html) { let p = $('#tpop'); if (!p) { p = document.createElement('div'); p.id = 'tpop'; document.body.appendChild(p); } p.innerHTML = html; p.style.display = 'block'; const w = Math.min(320, innerWidth - 16); p.style.width = w + 'px'; p.style.left = Math.max(8, Math.min(innerWidth - w - 8, x - w / 2)) + 'px'; const h = p.offsetHeight; p.style.top = (y + 18 + h > innerHeight - 70 ? Math.max(60, y - h - 18) : y + 18) + 'px'; return p; }
const closePop = () => { const p = $('#tpop'); if (p) p.style.display = 'none'; };
document.addEventListener('click', async e => {
  if (e.target.closest('#tpop')) return; closePop();
  if (!S.tap || S.mode !== 'read' || !e.target.closest('.tl') || !S.pdf) return; if (selText()) return;
  const w = wordAt(e.clientX, e.clientY); if (!w) return; const x = e.clientX, y = e.clientY;
  const p = popup(x, y, `<div class="pw" dir="auto"><b>${esc(w.word)}</b></div><div class="pt" dir="auto">...</div>`);
  try {
    const tr = await trCached(w.word, S.tl); if (p.style.display === 'none') return;
    p.innerHTML = `<div class="pw" dir="auto"><b>${esc(w.word)}</b> ← <span dir="auto">${esc(tr)}</span></div><div class="pb"><button data-a="line">ترجم السطر</button><button data-a="say">🔊</button><button data-a="copy">نسخ</button><button data-a="x">✕</button></div><div class="pt" id="ptl"></div>`;
    p.onclick = async ev => { const a = ev.target.dataset.a; if (!a) return; if (a === 'x') closePop(); else if (a === 'say') speak(w.word, isAr(w.word) ? 'ar' : 'en'); else if (a === 'copy') copyTxt(tr); else if (a === 'line') { $('#ptl').textContent = '...'; try { $('#ptl').textContent = await trCached(w.line, S.tl); $('#ptl').dir = 'auto'; } catch { $('#ptl').textContent = 'فشلت الترجمة'; } } };
  } catch { p.innerHTML = '<div class="pt">الترجمة مش متاحة دلوقتي. تأكد من النت.</div>'; }
});
let selT; document.addEventListener('selectionchange', () => { clearTimeout(selT); selT = setTimeout(() => { const t = selText(); const sel = getSelection(); let bar = $('#selbar'); const inPages = sel && sel.anchorNode && $('#pages').contains(sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentNode : sel.anchorNode); if (!t || !inPages || S.mode !== 'read') { if (bar) bar.style.display = 'none'; return; } closePop();
  if (!bar) { bar = document.createElement('div'); bar.id = 'selbar'; document.body.appendChild(bar); bar.innerHTML = Object.entries(HL).map(([k, c]) => `<i data-c="${c}" style="background:${c}"></i>`).join('') + '<button data-a="tr">ترجم</button><button data-a="say">🔊</button><button data-a="copy">نسخ</button>'; bar.addEventListener('pointerdown', e => e.preventDefault()); bar.onclick = e => { const c = e.target.dataset.c, a = e.target.dataset.a; const t = selText(); if (c) { highlightSelection(c); bar.style.display = 'none'; } else if (a === 'tr') { bar.style.display = 'none'; doTranslate(t, 'ترجمة النص المحدد'); } else if (a === 'say') speak(t); else if (a === 'copy') copyTxt(t); }; }
  bar.style.display = 'flex'; }, 250); });

/* ---------- tabs / panels ---------- */
const B = (label, fn, extra = '') => ({ label, fn, extra });
function colorBox() { return `<input type="color" id="pcol" value="${S.color}"><select id="pw"><option value="2">رفيع</option><option value="3" selected>وسط</option><option value="6">سميك</option></select><select id="psz"><option value="12">خط 12</option><option value="16">خط 16</option><option value="18" selected>خط 18</option><option value="24">خط 24</option><option value="32">خط 32</option></select>`; }
function modeBtn(m, label) { return `<button data-mode="${m}" class="${S.mode === m ? 'on' : ''}">${label}</button>`; }
const ACT = {
  open: () => $('#fileIn').click(), search: searchDoc, readaloud: readAloud, hlsel: () => highlightSelection(S.hlColor || HL.yellow), bm: bookmark, bms: showBookmarks, focus: focusMode, auto: autoScroll, stats: docStats,
  tapt: () => { S.tap = !S.tap; LS.set('tap', S.tap); toast(S.tap ? 'ترجمة بالضغط: شغالة' : 'ترجمة بالضغط: مقفولة'); renderPanel(); },
  night: () => { setNight(S.night === 'none' ? 'night' : S.night === 'night' ? 'sepia' : 'none'); }, ui: () => setUI(!document.body.classList.contains('dark')),
  sigdraw: drawSignature, sigpick: pickSignature, sigphoto: () => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.onchange = () => i.files[0] && sigFromPhoto(i.files[0]); i.click(); },
  date: () => stamp(new Date().toLocaleDateString('en-GB'), '#111111'), ok: () => stamp('✔', '#15803d'), no: () => stamp('✘', '#b91c1c'), approved: () => stamp('موافق', '#15803d'), paid: () => stamp('مدفوع', '#b91c1c'), customStamp: async () => { const t = await ask('نص الختم'); if (t) stamp(t, S.color); },
  pm: pageManager, merge: mergeFiles, split: splitDoc, pn: pageNumbers, wm: watermark, i2p: () => { $('#fileMulti').dataset.mode = S.pdf ? 'append' : 'new'; $('#fileMulti').click(); },
  compress, unlock: unlockDoc, pimg: pageAsImage, txt: exportText, meta: metaEdit, strip: stripMeta, share: shareFile,
  trpage: async () => { if (!S.pdf) return; const t = selText() || await pageText(curPage()); doTranslate(t, selText() ? 'ترجمة النص المحدد' : 'ترجمة صفحة ' + (curPage() + 1)); }, trdoc: translateWholeDoc, bi: bilingual, sum: offlineSummary, aisum: aiSummary, askdoc: askDoc, ocrp: () => ocrAndShow([curPage()]), ocra: () => ocrAndShow([...Array(S.n).keys()]), key: setKey,
  hls: showHighlights, cards: flashFromHighlights, quiz: quizDoc, redact: autoRedact,
  lang: async () => { const r = await form('لغة الترجمة', `<select id="lg">${langOpts(S.tl)}</select>`, b => $('#lg', b).value); if (r) { S.tl = r; LS.set('tl', r); toast('لغة الترجمة: ' + LANGS[r]); } },
  rate: async () => { const r = await form('سرعة القراءة بصوت', `<select id="rt">${[.7, .85, 1, 1.2, 1.5].map(x => `<option ${x === LS.get('rate', 1) ? 'selected' : ''}>${x}</option>`).join('')}</select>`, b => +$('#rt', b).value); if (r) LS.set('rate', r); },
};
const TABS = {
  read: () => [['open', '📂 فتح'], ['search', '🔎 بحث'], ['tapt', S.tap ? '👆 ترجمة بالضغط ✅' : '👆 ترجمة بالضغط'], ['lang', '🌐 اللغة: ' + LANGS[S.tl]], 'sep', ['readaloud', '🔊 اقرأ'], ['bm', '🔖 علامة'], ['bms', 'علاماتي'], 'sep', ['night', '🌙 ليلي/سيبيا'], ['ui', '🎨 مظهر التطبيق'], ['focus', '🎯 تركيز'], ['auto', '⏬ تمرير تلقائي'], ['stats', 'ℹ️ معلومات']],
  mark: () => ['<span class="lbl">ظلّل:</span>' + Object.values(HL).map(c => `<button data-hl="${c}" style="background:${c};width:34px;padding:6px"></button>`).join(''), 'sep', modeBtn('select', '✋ تحديد'), modeBtn('pen', '✏️ قلم'), modeBtn('hlpen', '🖍 ماركر'), modeBtn('hlbox', '▭ تظليل مربع'), modeBtn('text', '𝐓 نص'), modeBtn('edit', '✏️ عدّل نص موجود'), modeBtn('rect', '▢'), modeBtn('ell', '◯'), modeBtn('line', '╱'), modeBtn('arrow', '➜'), modeBtn('white', '⬜ تغطية'), modeBtn('eraser', '🧽 ممحاة'), modeBtn('read', '📖 قراءة'), 'sep', colorBox()],
  sign: () => [['sigdraw', '✍️ ارسم توقيع'], ['sigpick', '📋 توقيعاتي'], ['sigphoto', '📷 توقيع من صورة'], 'sep', ['date', '📅 تاريخ'], ['ok', '✔'], ['no', '✘'], ['approved', 'موافق'], ['paid', 'مدفوع'], ['customStamp', 'ختم نص']],
  pages: () => [['pm', '📑 ترتيب/تدوير/حذف'], ['merge', '➕ دمج ملفات'], ['i2p', '🖼 صور → PDF'], ['split', '✂️ تقسيم/استخراج'], ['pn', '🔢 أرقام صفحات'], ['wm', '💧 علامة مائية']],
  tools: () => [['compress', '🗜 ضغط'], ['pimg', '🖼 الصفحة كصورة'], ['txt', '📝 استخراج النص'], ['ocrp', '🔤 OCR صفحة'], ['ocra', 'OCR الكل'], ['unlock', '🔓 فك الحماية'], ['meta', 'بيانات الملف'], ['share', '📤 مشاركة'], ['stats', 'ℹ️ معلومات']],
  ai: () => [['trpage', '🌐 ترجم الصفحة/المحدد'], ['bi', '↔️ ثنائي اللغة'], ['trdoc', '📚 ترجم الملف كله'], 'sep', ['sum', '⚡ تلخيص سريع'], ['aisum', '✨ تلخيص AI'], ['askdoc', '💬 اسأل الملف'], 'sep', ['ocrp', '🔤 OCR'], ['readaloud', '🔊 اقرأ'], ['rate', 'سرعة الصوت'], ['key', '🔑 مفتاح AI']],
  study: () => ['<span class="lbl">ظلّل المحدد:</span>' + Object.values(HL).map(c => `<button data-hl="${c}" style="background:${c};width:34px;padding:6px"></button>`).join(''), 'sep', ['hls', '📒 تظليلاتي'], ['cards', '🃏 بطاقات'], ['quiz', '🧠 اختبرني'], ['bm', '🔖 علامة'], ['bms', 'علاماتي'], ['focus', '🎯 تركيز'], ['auto', '⏬ تمرير']],
  privacy: () => [['redact', '🛡 حجب بيانات حساسة تلقائيًا'], modeBtn('redact', '⬛ حجب يدوي'), ['strip', '🧹 مسح بيانات الملف'], ['unlock', '🔓 فك الحماية']],
};
function renderPanel() {
  const p = $('#panel'); p.innerHTML = ''; $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === S.tab));
  for (const it of TABS[S.tab]()) {
    if (it === 'sep') { p.insertAdjacentHTML('beforeend', '<span class="sep"></span>'); continue; }
    if (typeof it === 'string') { p.insertAdjacentHTML('beforeend', it); continue; }
    const b = document.createElement('button'); b.textContent = it[1]; b.onclick = () => ACT[it[0]](); p.appendChild(b);
  }
  $$('#panel [data-mode]').forEach(b => b.onclick = () => setMode(b.dataset.mode));
  $$('#panel [data-hl]').forEach(b => b.onclick = () => { S.hlColor = b.dataset.hl; if (selText()) highlightSelection(b.dataset.hl); else if (S.tab === 'mark') { setMode('hlbox'); toast('اسحب على المكان، أو حدد نص ثم لون'); } else toast('حدد النص الأول ثم دوس اللون'); });
  const pc = $('#pcol'); if (pc) { pc.oninput = () => S.color = pc.value; $('#pw').value = S.width; $('#psz').value = S.size; $('#pw').onchange = e => S.width = +e.target.value; $('#psz').onchange = e => S.size = +e.target.value; }
}
$$('#tabs button').forEach(b => b.onclick = () => { S.tab = b.dataset.tab; if (!['mark', 'sign', 'privacy'].includes(S.tab) && S.mode !== 'read') setMode('read'); renderPanel(); if (S.tab === 'mark' && S.mode === 'read') { setMode('select'); renderPanel(); } });

/* ---------- boot ---------- */
setNight(LS.get('night', 'none')); setUI(LS.get('dark', matchMedia('(prefers-color-scheme: dark)').matches)); renderPanel();
let ip; addEventListener('beforeinstallprompt', e => { e.preventDefault(); ip = e; $('#btnInstall').classList.remove('hidden'); }); $('#btnInstall').onclick = async () => { if (ip) { ip.prompt(); ip = null; $('#btnInstall').classList.add('hidden'); } };
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => { });
addEventListener('resize', () => { clearTimeout(addEventListener.t); addEventListener.t = setTimeout(() => { if (S.pdf && Math.abs($('#viewer').clientWidth - 16 - S.fitW) > 40 && S.fitW < 900) { const p = curPage(); buildViews().then(() => goPage(p)); } }, 400); });
document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); $('#btnUndo').click(); } if (e.key === 'Delete' && S.sel) $('#ctx button[data-a=del]')?.click(); });
const qp = new URLSearchParams(location.search).get('pdf'); if (qp) fetch(qp).then(r => r.arrayBuffer()).then(b => { S.name = qp.split('/').pop() || 'file.pdf'; return loadBytes(new Uint8Array(b), true); }).catch(() => toast('مقدرتش أفتح الرابط'));
window.__wq = { S, ACT, exportBytes, scanSensitive };
