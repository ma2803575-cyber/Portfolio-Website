(function () {
  const $ = id => document.getElementById(id);
  const I18N = {
    ar: { hero: 'حوّل أي ملف لامتحان جاهز في ثواني', sub: 'ارفع ملف (PDF / Word / نص) أو الصق المحتوى، اختار نوع الأسئلة والصعوبة، واطبع الامتحان مع نموذج الإجابة.', s1: 'المحتوى', drop: '📄 اضغط لرفع ملف أو اسحبه هنا (PDF, DOCX, TXT)', s2: 'الإعدادات', title: 'عنوان الامتحان', school: 'المدرسة / الكلية', teacher: 'المدرّس', date: 'التاريخ', mcq: 'اختيار من متعدد', tf: 'صح / خطأ', essay: 'مقالي', diff: 'الصعوبة', easy: 'سهل', medium: 'متوسط', hard: 'صعب', qlang: 'لغة الأسئلة', auto: 'نفس لغة الملف', ai: 'استخدم الذكاء الاصطناعي (أفضل جودة، النص بيتبعت لخدمة مجانية خارجية)', gen: 'ولّد الأسئلة', s3: 'راجع وعدّل', shuffle: '🔀 اخلط الترتيب', withKey: 'أضف نموذج الإجابة', print: '🖨️ اطبع / احفظ PDF', hint: 'نصيحة: في نافذة الطباعة اختار "Save as PDF" / "حفظ كـ PDF".', foot: 'مجاني. الملف بيتقرا على جهازك. مراجعة الأسئلة قبل الاستخدام مسؤوليتك.', paste: 'أو الصق النص هنا...',
      chars: 'حرف', reading: 'جاري قراءة الملف...', noText: 'اكتب أو ارفع محتوى الأول (على الأقل 100 حرف).', noType: 'اختار نوع أسئلة واحد على الأقل.', aiTry: 'جاري توليد الأسئلة بالذكاء الاصطناعي...', aiFail: 'الذكاء الاصطناعي مش متاح دلوقتي، استخدمت التوليد المحلي (جودة أقل، راجع الأسئلة).', done: 'تم توليد {n} سؤال.', del: 'حذف', ans: 'الإجابة', correct: 'صح', wrong: 'خطأ', section: { mcq: 'اختر الإجابة الصحيحة', tf: 'ضع علامة (صح) أو (خطأ)', essay: 'أجب عن الأسئلة التالية' }, name: 'الاسم', cls: 'الفصل', score: 'الدرجة', key: 'نموذج الإجابة', model: 'إجابة نموذجية', total: 'عدد الأسئلة', scanned: 'الملف ده شكله صور (ممسوح ضوئياً) ومفيهوش نص، الصق النص يدوياً.', badFile: 'مقدرتش أقرأ الملف، جرب ملف تاني أو الصق النص.' },
    en: { hero: 'Turn any file into a ready exam in seconds', sub: 'Upload a PDF / Word / text file or paste content, pick question types and difficulty, then print the exam with its answer key.', s1: 'Content', drop: '📄 Tap to upload a file or drop it here (PDF, DOCX, TXT)', s2: 'Settings', title: 'Exam title', school: 'School / College', teacher: 'Teacher', date: 'Date', mcq: 'Multiple choice', tf: 'True / False', essay: 'Essay', diff: 'Difficulty', easy: 'Easy', medium: 'Medium', hard: 'Hard', qlang: 'Question language', auto: 'Same as the file', ai: 'Use AI (best quality; the text is sent to a free external service)', gen: 'Generate questions', s3: 'Review and edit', shuffle: '🔀 Shuffle order', withKey: 'Include answer key', print: '🖨️ Print / Save PDF', hint: 'Tip: in the print dialog choose "Save as PDF".', foot: 'Free. Files are read on your device. Review questions before use.', paste: 'Or paste text here...',
      chars: 'chars', reading: 'Reading file...', noText: 'Add or upload content first (at least 100 characters).', noType: 'Pick at least one question type.', aiTry: 'Generating questions with AI...', aiFail: 'AI is unavailable right now, used local generation instead (lower quality, review the questions).', done: 'Generated {n} questions.', del: 'Delete', ans: 'Answer', correct: 'True', wrong: 'False', section: { mcq: 'Choose the correct answer', tf: 'Mark True or False', essay: 'Answer the following' }, name: 'Name', cls: 'Class', score: 'Score', key: 'Answer key', model: 'Model answer', total: 'Questions', scanned: 'This file looks scanned (images only, no text). Paste the text manually.', badFile: 'Could not read the file. Try another or paste the text.' }
  };
  let L = 'ar';
  let questions = [];
  const S = () => I18N[L];
  function applyLang() {
    document.documentElement.lang = L; document.documentElement.dir = L === 'ar' ? 'rtl' : 'ltr';
    document.querySelectorAll('[data-i]').forEach(e => { const v = S()[e.dataset.i]; if (typeof v === 'string') e.textContent = v; });
    document.querySelectorAll('[data-ph]').forEach(e => e.placeholder = S()[e.dataset.ph]);
    $('langBtn').textContent = L === 'ar' ? 'English' : 'العربية';
    updateCount(); if (questions.length) renderList();
  }
  function updateCount() { $('count').textContent = $('text').value.length + ' ' + S().chars; }
  function status(msg, cls) { const s = $('status'); s.textContent = msg; s.className = 'status ' + (cls || ''); }

  // ---- file reading
  async function readFile(f) {
    const name = f.name.toLowerCase();
    if (name.endsWith('.pdf')) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
      const doc = await pdfjsLib.getDocument({ data: await f.arrayBuffer() }).promise;
      let out = '';
      for (let p = 1; p <= doc.numPages && out.length < 60000; p++) {
        const c = await (await doc.getPage(p)).getTextContent();
        let line = '', lastY = null;
        for (const it of c.items) { if (lastY !== null && Math.abs(it.transform[5] - lastY) > 4) line += '\n'; line += it.str + ' '; lastY = it.transform[5]; }
        out += line + '\n';
      }
      return out;
    }
    if (name.endsWith('.docx')) return (await mammoth.extractRawText({ arrayBuffer: await f.arrayBuffer() })).value;
    let t = await f.text(); if (name.endsWith('.html')) t = new DOMParser().parseFromString(t, 'text/html').body.textContent; return t;
  }
  async function onFile(f) {
    if (!f) return;
    $('fname').textContent = f.name; status(S().reading);
    try {
      const t = (await readFile(f)).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
      if (t.length < 20) { status(S().scanned, 'err'); return; }
      $('text').value = t; updateCount(); status('');
    } catch (e) { console.error(e); status(S().badFile, 'err'); }
  }

  // ---- generation
  function cfg() {
    return { mcq: $('useMcq').checked ? +$('nMcq').value || 0 : 0, tf: $('useTf').checked ? +$('nTf').value || 0 : 0, essay: $('useEssay').checked ? +$('nEssay').value || 0 : 0, diff: $('diff').value, lang: $('qlang').value };
  }
  async function genAI(text, c) {
    const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 60000);
    try {
      const r = await fetch('https://text.pollinations.ai/openai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctl.signal,
        body: JSON.stringify({ model: 'openai', messages: [{ role: 'user', content: EG.aiPrompt(text, c) }], response_format: { type: 'json_object' } }) });
      if (!r.ok) throw new Error('http ' + r.status);
      const j = await r.json();
      const qs = EG.parseAI(j.choices[0].message.content);
      if (qs.length < 1) throw new Error('empty');
      return qs;
    } finally { clearTimeout(to); }
  }
  async function generate() {
    const text = $('text').value.trim(); const c = cfg();
    if (text.length < 100) return status(S().noText, 'err');
    if (c.mcq + c.tf + c.essay === 0) return status(S().noType, 'err');
    const btn = $('gen'); btn.disabled = true; let note = '', qs = null;
    try {
      if ($('useAI').checked) { status(S().aiTry); try { qs = await genAI(text, c); } catch (e) { console.warn(e); note = S().aiFail; } }
      if (!qs) qs = EG.genOffline(text, c);
      // order: mcq, tf, essay
      const ord = { mcq: 0, tf: 1, essay: 2 }; qs.sort((a, b) => ord[a.type] - ord[b.type]);
      questions = qs; renderList(); $('step3').classList.remove('hidden');
      status(S().done.replace('{n}', qs.length) + (note ? ' ' + note : ''), note ? 'err' : 'ok');
      $('step3').scrollIntoView({ behavior: 'smooth' });
    } finally { btn.disabled = false; }
  }

  // ---- editor
  function el(tag, props, ...kids) { const e = document.createElement(tag); Object.assign(e, props || {}); kids.forEach(k => e.append(k)); return e; }
  function renderList() {
    const box = $('list'); box.textContent = '';
    questions.forEach((q, i) => {
      const card = el('div', { className: 'q' });
      const del = el('button', { className: 'del ghost', type: 'button', textContent: '✕', title: S().del }); del.onclick = () => { questions.splice(i, 1); renderList(); };
      card.append(el('div', { className: 'qh' }, el('span', { className: 'badge', textContent: (i + 1) + ' · ' + S()[q.type] }), del));
      const ta = el('textarea', { value: q.q, rows: 2 }); ta.oninput = () => q.q = ta.value; card.append(ta);
      if (q.type === 'mcq') q.options.forEach((o, k) => {
        const r = el('input', { type: 'radio', name: 'q' + i, checked: q.answer === k }); r.onchange = () => q.answer = k;
        const t = el('input', { type: 'text', value: o }); t.oninput = () => q.options[k] = t.value;
        card.append(el('div', { className: 'opt' }, r, t));
      });
      if (q.type === 'tf') {
        const sel = el('select', {}); [[true, S().correct], [false, S().wrong]].forEach(([v, l]) => sel.append(el('option', { value: v, textContent: l, selected: q.answer === v })));
        sel.onchange = () => q.answer = sel.value === 'true'; card.append(el('div', { className: 'opt' }, el('span', { className: 'ans', textContent: S().ans + ': ' }), sel));
      }
      if (q.type === 'essay') { const a = el('textarea', { value: q.answer || '', rows: 2, placeholder: S().model }); a.oninput = () => q.answer = a.value; card.append(a); }
      box.append(card);
    });
  }

  // ---- paper
  const LET_AR = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'], LET_EN = ['A', 'B', 'C', 'D', 'E', 'F'];
  function buildPaper() {
    const p = $('paper'), s = S(), key = $('withKey').checked, lets = L === 'ar' ? LET_AR : LET_EN;
    p.textContent = ''; p.dir = document.documentElement.dir;
    const meta = el('div', { className: 'meta' }, el('span', { textContent: $('school').value }), el('span', { textContent: $('teacher').value ? s.teacher + ': ' + $('teacher').value : '' }), el('span', { textContent: $('date').value }));
    p.append(el('h1', { textContent: $('examTitle').value || (L === 'ar' ? 'امتحان' : 'Exam') }), meta,
      el('div', { className: 'stu' }, el('span', { textContent: s.name + ': ____________________' }), el('span', { textContent: s.cls + ': ________' }), el('span', { textContent: s.score + ': ____ / ' + questions.length })));
    let n = 0;
    ['mcq', 'tf', 'essay'].forEach(type => {
      const qs = questions.filter(q => q.type === type); if (!qs.length) return;
      p.append(el('h3', { textContent: s[type] + ' - ' + s.section[type] }));
      qs.forEach(q => {
        n++; const d = el('div', { className: 'pq' }); d.append(el('div', { style: 'white-space:pre-wrap', textContent: n + '. ' + q.q + (type === 'tf' ? '   ( ' + '\u00A0\u00A0\u00A0\u00A0' + ' )' : '') }));
        if (type === 'mcq') q.options.forEach((o, k) => d.append(el('div', { className: 'po', textContent: lets[k] + ') ' + o })));
        if (type === 'essay') for (let k = 0; k < 4; k++) d.append(el('div', { className: 'lines' }));
        p.append(d);
      });
    });
    if (key) {
      const k = el('div', { className: 'key' }); k.append(el('h1', { textContent: s.key }), el('div', { className: 'meta' }, el('span', { textContent: $('examTitle').value }), el('span', { textContent: s.total + ': ' + questions.length })));
      let m = 0;
      ['mcq', 'tf', 'essay'].forEach(type => questions.filter(q => q.type === type).forEach(q => {
        m++; let a = type === 'mcq' ? lets[q.answer] + ') ' + q.options[q.answer] : type === 'tf' ? (q.answer ? s.correct : s.wrong) : (q.answer || '');
        k.append(el('div', { className: 'pq', style: 'white-space:pre-wrap', textContent: m + '. ' + a }));
      }));
      p.append(k);
    }
  }
  function doPrint() { if (!questions.length) return; buildPaper(); const t = document.title; document.title = ($('examTitle').value || 'exam'); window.print(); document.title = t; }

  // ---- wiring
  $('langBtn').onclick = () => { L = L === 'ar' ? 'en' : 'ar'; applyLang(); };
  $('file').onchange = e => onFile(e.target.files[0]);
  const drop = $('drop');
  ['dragover', 'dragenter'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => onFile(e.dataTransfer.files[0]));
  $('text').oninput = updateCount;
  $('gen').onclick = generate;
  $('shuffle').onclick = () => { const g = t => EG.shuffle(questions.filter(q => q.type === t)); questions = [...g('mcq'), ...g('tf'), ...g('essay')]; renderList(); };
  $('print').onclick = doPrint;
  $('date').valueAsDate = new Date();
  applyLang();
  window.__eg = { get questions() { return questions; }, buildPaper };
})();
