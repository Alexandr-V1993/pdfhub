// Запасные варианты для серверных инструментов: работают прямо в браузере,
// если на сервере нет LibreOffice / qpdf. Качество ниже, чем у серверных версий.
import { PDFDocument } from 'pdf-lib';
import { baseName } from './util';

const pdfBlob = (bytes) => new Blob([bytes], { type: 'application/pdf' });
const prog = (ctx, v, t) => ctx && ctx.onProgress && ctx.onProgress(v, t);

/* ───── HTML -> PDF (страницы-картинки через html2canvas) ───── */
async function htmlToPdf(html, ctx) {
  const html2canvas = (await import('html2canvas')).default;
  const iframe = document.createElement('iframe');
  iframe.setAttribute('sandbox', 'allow-same-origin'); // скрипты из документа не выполняются
  iframe.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;height:1123px;border:0;background:#fff';
  document.body.appendChild(iframe);
  try {
    iframe.srcdoc = `<!doctype html><meta charset="utf-8"><style>
      body{margin:0;padding:40px;width:714px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.45;color:#000;background:#fff;overflow-wrap:break-word}
      img{max-width:100%;height:auto} table{border-collapse:collapse;max-width:100%} td,th{border:1px solid #999;padding:3px 6px;font-size:12px}
      pre{white-space:pre-wrap} h1,h2,h3{line-height:1.25}</style>${html}`;
    await new Promise((res) => { iframe.onload = res; setTimeout(res, 4000); });
    const doc = iframe.contentDocument;
    await Promise.all([...doc.images].map((im) => (im.complete ? 0 : new Promise((r) => { im.onload = im.onerror = r; setTimeout(r, 3000); }))));
    const h = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight);
    iframe.style.height = `${h}px`;
    const scale = h > 8000 ? 1 : 1.6;
    prog(ctx, 0.3, 'Рисую страницы…');
    const canvas = await html2canvas(doc.body, { scale, backgroundColor: '#fff', useCORS: true, windowWidth: 794, width: 794, height: h });
    const pageH = Math.floor((canvas.width * 842) / 595);
    const out = await PDFDocument.create();
    for (let y = 0, n = 0; y < canvas.height; y += pageH, n++) {
      const part = document.createElement('canvas');
      part.width = canvas.width;
      part.height = Math.min(pageH, canvas.height - y);
      const c = part.getContext('2d');
      c.fillStyle = '#fff'; c.fillRect(0, 0, part.width, pageH);
      c.drawImage(canvas, 0, y, canvas.width, part.height, 0, 0, canvas.width, part.height);
      const blob = await new Promise((r) => part.toBlob(r, 'image/jpeg', 0.9));
      const img = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()));
      const page = out.addPage([595, 842]);
      page.drawImage(img, { x: 0, y: 842 - (part.height * 595) / part.width, width: 595, height: (part.height * 595) / part.width });
      prog(ctx, 0.3 + 0.7 * Math.min(1, (y + pageH) / canvas.height), `Страница ${n + 1}`);
    }
    return pdfBlob(await out.save());
  } finally {
    iframe.remove();
  }
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const NOTE_IMG = 'Выполнено в браузере: текст в PDF — картинкой (его нельзя выделить).';

async function wordToPdf(file, ctx) {
  const ext = (file.name.match(/\.[^.]+$/) || [''])[0].toLowerCase();
  let html;
  if (ext === '.txt') html = `<pre>${esc(await file.text())}</pre>`;
  else if (ext === '.docx') {
    const mammoth = (await import('mammoth/mammoth.browser')).default || (await import('mammoth/mammoth.browser'));
    html = (await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() })).value;
  } else throw new Error('Формат не поддерживается. Сохраните документ как DOCX.');
  return [{ name: `${baseName(file.name)}.pdf`, blob: await htmlToPdf(html, ctx), note: NOTE_IMG }];
}

async function excelToPdf(file, ctx) {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const html = wb.SheetNames.map((n) => `<h2>${esc(n)}</h2>${XLSX.utils.sheet_to_html(wb.Sheets[n], { header: '', footer: '' })}`).join('');
  return [{ name: `${baseName(file.name)}.pdf`, blob: await htmlToPdf(html, ctx), note: NOTE_IMG }];
}

async function powerpointToPdf(file, ctx) {
  if (!/\.pptx$/i.test(file.name)) throw new Error('Формат не поддерживается. Сохраните презентацию как PPTX.');
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const names = Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => parseInt(a.match(/\d+/)[0], 10) - parseInt(b.match(/\d+/)[0], 10));
  let html = '';
  for (let i = 0; i < names.length; i++) {
    const xml = await zip.file(names[i]).async('string');
    const paras = [...xml.matchAll(/<a:p[ >][\s\S]*?<\/a:p>/g)]
      .map((m) => [...m[0].matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((t) => t[1]).join(''))
      .filter(Boolean);
    html += `<h2>Слайд ${i + 1}</h2>${paras.map((p) => `<p>${p}</p>`).join('')}<hr>`;
  }
  return [{ name: `${baseName(file.name)}.pdf`, blob: await htmlToPdf(html, ctx), note: 'Выполнено в браузере: перенесён только текст слайдов, без оформления и картинок.' }];
}

/* ───── Восстановление / пароли ───── */
async function repair(file) {
  const src = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: false, throwOnInvalidObject: false });
  const out = await PDFDocument.create();
  (await out.copyPages(src, src.getPageIndices())).forEach((p) => out.addPage(p));
  return [{ name: `${baseName(file.name)}_repaired.pdf`, blob: pdfBlob(await out.save()), note: 'Страницы перенесены в новый файл. Сильно повреждённые файлы так не восстановить.' }];
}

async function unlock(file, opts, ctx) {
  const { loadPdfjsDoc, renderPageToCanvas, canvasToBlob } = await import('./pdfjs');
  const doc = await loadPdfjsDoc(file, opts.password || '');
  const out = await PDFDocument.create();
  for (let i = 1; i <= doc.numPages; i++) {
    prog(ctx, (i - 1) / doc.numPages, `Страница ${i} из ${doc.numPages}`);
    const page = await doc.getPage(i);
    const vp = page.getViewport({ scale: 1 });
    const canvas = await renderPageToCanvas(doc, i, 2);
    const img = await out.embedJpg(new Uint8Array(await (await canvasToBlob(canvas, 'image/jpeg', 0.88)).arrayBuffer()));
    out.addPage([vp.width, vp.height]).drawImage(img, { x: 0, y: 0, width: vp.width, height: vp.height });
    canvas.width = canvas.height = 0;
  }
  return [{ name: `${baseName(file.name)}_unlocked.pdf`, blob: pdfBlob(await out.save()), note: 'Выполнено в браузере: страницы стали изображениями (текст не выделяется).' }];
}

async function protect(file, opts) {
  const { PDFDocument: EncDoc } = await import('pdf-lib-plus-encrypt');
  const doc = await EncDoc.load(await file.arrayBuffer());
  const rnd = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join('');
  doc.encrypt({
    userPassword: opts.password,
    ownerPassword: rnd,
    permissions: {
      printing: opts.noPrint ? false : 'highResolution',
      copying: !opts.noCopy,
      modifying: !opts.noModify,
      annotating: !opts.noModify,
      fillingForms: !opts.noModify,
      documentAssembly: !opts.noModify,
      contentAccessibility: true,
    },
  });
  return [{ name: `${baseName(file.name)}_protected.pdf`, blob: pdfBlob(await doc.save()) }];
}

/* ───── PDF -> Word / PowerPoint ───── */
async function pdfParagraphs(file, ctx) {
  const { loadPdfjsDoc } = await import('./pdfjs');
  const doc = await loadPdfjsDoc(file);
  const pages = [];
  const sizes = [];
  for (let p = 1; p <= doc.numPages; p++) {
    prog(ctx, (p - 1) / doc.numPages, `Страница ${p} из ${doc.numPages}`);
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const rows = [];
    for (const it of tc.items) {
      if (!('str' in it) || !it.str.trim()) continue;
      const size = Math.hypot(it.transform[2], it.transform[3]) || 10;
      const y = it.transform[5];
      let row = rows.find((r) => Math.abs(r.y - y) < size * 0.4);
      if (!row) { row = { y, items: [], size: 0 }; rows.push(row); }
      row.items.push({ x: it.transform[4], str: it.str, w: it.width });
      row.size = Math.max(row.size, size);
    }
    rows.sort((a, b) => b.y - a.y);
    const paras = [];
    let prev = null;
    for (const r of rows) {
      r.items.sort((a, b) => a.x - b.x);
      let text = ''; let end = null;
      for (const it of r.items) {
        if (end !== null && it.x - end > r.size * 0.15 && !text.endsWith(' ')) text += ' ';
        text += it.str; end = it.x + it.w;
      }
      text = text.replace(/\s+/g, ' ').trim();
      if (!text) continue;
      sizes.push(r.size);
      const gap = prev ? prev.y - r.y : 0;
      if (prev && gap < r.size * 1.7 && Math.abs(prev.size - r.size) < 1 && prev.paras === paras) paras[paras.length - 1].text += ` ${text}`;
      else paras.push({ text, size: r.size });
      prev = { y: r.y, size: r.size, paras };
    }
    pages.push(paras);
    page.cleanup();
  }
  sizes.sort((a, b) => a - b);
  return { pages, body: sizes[Math.floor(sizes.length / 2)] || 10 };
}

async function pdfToWord(file, ctx) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, PageBreak } = await import('docx');
  const { pages, body } = await pdfParagraphs(file, ctx);
  const children = [];
  pages.forEach((paras, i) => {
    if (i > 0) children.push(new Paragraph({ children: [new PageBreak()] }));
    for (const p of paras) {
      const heading = p.size > body * 1.5 ? HeadingLevel.HEADING_1 : p.size > body * 1.2 ? HeadingLevel.HEADING_2 : undefined;
      children.push(new Paragraph({ heading, spacing: { after: 120 }, children: [new TextRun({ text: p.text, size: Math.round(Math.min(p.size, 40) * 2) })] }));
    }
  });
  const blob = await Packer.toBlob(new Document({ sections: [{ children }] }));
  return [{ name: `${baseName(file.name)}.docx`, blob, note: 'Выполнено в браузере: перенесён только текст (без картинок и таблиц). Сканы сначала прогоните через OCR.' }];
}

async function pdfToPowerpoint(file, ctx) {
  const pm = await import('pptxgenjs');
  const PptxGenJS = pm.default || pm;
  const { loadPdfjsDoc, renderPageToCanvas } = await import('./pdfjs');
  const doc = await loadPdfjsDoc(file);
  const first = await doc.getPage(1);
  const vp = first.getViewport({ scale: 1 });
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'PDF', width: vp.width / 72, height: vp.height / 72 });
  pptx.layout = 'PDF';
  for (let i = 1; i <= doc.numPages; i++) {
    prog(ctx, (i - 1) / doc.numPages, `Страница ${i} из ${doc.numPages}`);
    const canvas = await renderPageToCanvas(doc, i, 2);
    pptx.addSlide().addImage({ data: canvas.toDataURL('image/jpeg', 0.85), x: 0, y: 0, w: '100%', h: '100%' });
    canvas.width = canvas.height = 0;
  }
  const blob = await pptx.write({ outputType: 'blob' });
  return [{ name: `${baseName(file.name)}.pptx`, blob, note: 'Выполнено в браузере: каждая страница — картинка на слайде (текст не редактируется).' }];
}

export async function runFallback(tool, file, opts, ctx) {
  switch (tool.slug) {
    case 'html-to-pdf': return [{ name: `${baseName(file.name)}.pdf`, blob: await htmlToPdf(await file.text(), ctx), note: NOTE_IMG }];
    case 'word_to_pdf': return wordToPdf(file, ctx);
    case 'excel_to_pdf': return excelToPdf(file, ctx);
    case 'powerpoint_to_pdf': return powerpointToPdf(file, ctx);
    case 'repair-pdf': return repair(file);
    case 'unlock_pdf': return unlock(file, opts, ctx);
    case 'protect-pdf': return protect(file, opts);
    case 'pdf_to_word': return pdfToWord(file, ctx);
    case 'pdf_to_powerpoint': return pdfToPowerpoint(file, ctx);
    case 'convert-pdf-to-pdfa':
      throw new Error('Сервис конвертации временно недоступен. Попробуйте чуть позже.');
    default:
      throw new Error('Сервис временно недоступен. Попробуйте чуть позже.');
  }
}
