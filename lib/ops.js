// Операции над PDF, выполняемые в браузере.
// Каждая операция: (files, options, ctx) => Promise<[{ name, blob, note? }]>

import {
  PDFDocument, StandardFonts, degrees, rgb, LineCapStyle,
  PDFTextField, PDFCheckBox, PDFDropdown, PDFRadioGroup, PDFOptionList,
} from 'pdf-lib';
import { embedFonts } from './fonts';
import {
  baseName, hexToRgb01, parseRangeList, selectPages, formatBytes,
} from './util';

const pdfBlob = (bytes) => new Blob([bytes], { type: 'application/pdf' });
const progress = (ctx, v, t) => ctx && ctx.onProgress && ctx.onProgress(v, t);

export async function openPdf(file) {
  const buf = file instanceof Blob ? await file.arrayBuffer() : file;
  return PDFDocument.load(buf); // зашифрованные файлы -> EncryptedPDFError
}

/** Приводит страницы с /Rotate к «видимой» ориентации, чтобы координаты совпадали с экраном */
export async function flattenRotation(src) {
  const pages = src.getPages();
  if (!pages.some((p) => ((p.getRotation().angle % 360) + 360) % 360 !== 0)) return src;
  const out = await PDFDocument.create();
  for (const p of pages) {
    const r = ((p.getRotation().angle % 360) + 360) % 360;
    const { width: w, height: h } = p.getSize();
    const emb = await out.embedPage(p);
    if (r === 0) out.addPage([w, h]).drawPage(emb);
    else if (r === 90) out.addPage([h, w]).drawPage(emb, { x: 0, y: w, rotate: degrees(-90) });
    else if (r === 180) out.addPage([w, h]).drawPage(emb, { x: w, y: h, rotate: degrees(180) });
    else out.addPage([h, w]).drawPage(emb, { x: h, y: 0, rotate: degrees(90) });
  }
  return out;
}

async function copyPagesTo(out, src, indices) {
  const pages = await out.copyPages(src, indices);
  pages.forEach((p) => out.addPage(p));
}

/* ───────────── Объединить ───────────── */
async function merge(files, o, ctx) {
  const out = await PDFDocument.create();
  for (let i = 0; i < files.length; i++) {
    progress(ctx, i / files.length, `Добавляю: ${files[i].name}`);
    const src = await openPdf(files[i]);
    await copyPagesTo(out, src, src.getPageIndices());
  }
  return [{ name: 'merged.pdf', blob: pdfBlob(await out.save()) }];
}

/* ───────────── Разделить ───────────── */
async function split(files, o, ctx) {
  const file = files[0];
  const src = await openPdf(file);
  const total = src.getPageCount();
  const base = baseName(file.name);
  let groups; // [{label, pages}]

  if (o.mode === 'each') {
    groups = src.getPageIndices().map((i) => ({ label: String(i + 1), pages: [i] }));
  } else if (o.mode === 'every') {
    const n = Math.max(1, parseInt(o.n, 10) || 1);
    groups = [];
    for (let s = 0; s < total; s += n) {
      const pages = [];
      for (let i = s; i < Math.min(total, s + n); i++) pages.push(i);
      groups.push({ label: pages.length > 1 ? `${s + 1}-${s + pages.length}` : String(s + 1), pages });
    }
  } else {
    groups = parseRangeList(o.ranges, total);
    if (o.single) groups = [{ label: 'selected', pages: groups.flatMap((g) => g.pages) }];
  }

  const outs = [];
  for (let i = 0; i < groups.length; i++) {
    progress(ctx, i / groups.length, `Файл ${i + 1} из ${groups.length}`);
    const doc = await PDFDocument.create();
    await copyPagesTo(doc, src, groups[i].pages);
    outs.push({ name: `${base}_${groups[i].label}.pdf`, blob: pdfBlob(await doc.save()) });
  }
  return outs;
}

/* ───────────── Страницы: удалить / извлечь / упорядочить ───────────── */
/** pages: [{ index, rotation }] — в нужном порядке; rotation — добавочный поворот */
export async function buildFromPages(file, pages) {
  const src = await openPdf(file);
  const out = await PDFDocument.create();
  const copied = await out.copyPages(src, pages.map((p) => p.index));
  copied.forEach((page, i) => {
    const extra = pages[i].rotation || 0;
    if (extra) page.setRotation(degrees((((page.getRotation().angle + extra) % 360) + 360) % 360));
    out.addPage(page);
  });
  return pdfBlob(await out.save());
}

/* ───────────── Повернуть ───────────── */
async function rotate(files, o, ctx) {
  const angle = parseInt(o.angle, 10) || 90;
  const outs = [];
  for (let i = 0; i < files.length; i++) {
    progress(ctx, i / files.length, files[i].name);
    const doc = await openPdf(files[i]);
    const idx = selectPages(o, doc.getPageCount());
    const pages = doc.getPages();
    for (const k of idx) {
      const cur = pages[k].getRotation().angle;
      pages[k].setRotation(degrees((((cur + angle) % 360) + 360) % 360));
    }
    outs.push({ name: `${baseName(files[i].name)}_rotated.pdf`, blob: pdfBlob(await doc.save()) });
  }
  return outs;
}

/* ───────────── Номера страниц ───────────── */
async function pagenumbers(files, o, ctx) {
  const file = files[0];
  let doc = await openPdf(file);
  doc = await flattenRotation(doc);
  const { regular } = await embedFonts(doc);
  const pages = doc.getPages();
  const total = pages.length;
  const size = Number(o.size) || 11;
  const margin = Number(o.margin) || 0;
  const from = Math.max(1, parseInt(o.from, 10) || 1);
  const start = parseInt(o.start, 10);
  const c = hexToRgb01(o.color);
  const pos = o.position || 'bc';

  for (let i = from - 1; i < total; i++) {
    const n = (Number.isNaN(start) ? 1 : start) + (i - (from - 1));
    const text = String(o.format || '{n}').replace('{n}', n).replace('{total}', total);
    const page = pages[i];
    const { width, height } = page.getSize();
    const tw = regular.widthOfTextAtSize(text, size);
    let x;
    if (pos.endsWith('l')) x = margin;
    else if (pos.endsWith('r')) x = width - margin - tw;
    else x = (width - tw) / 2;
    const y = pos.startsWith('t') ? height - margin - size : margin;
    page.drawText(text, { x, y, size, font: regular, color: rgb(c.r, c.g, c.b) });
    if (i % 10 === 0) progress(ctx, i / total, 'Нумерация…');
  }
  return [{ name: `${baseName(file.name)}_numbered.pdf`, blob: pdfBlob(await doc.save()) }];
}

/* ───────────── Водяной знак ───────────── */
async function watermark(files, o, ctx) {
  const file = files[0];
  let doc = await openPdf(file);
  doc = await flattenRotation(doc);
  const pages = doc.getPages();
  const idx = selectPages(o, pages.length);
  const opacity = Number(o.opacity) || 0.25;
  const rotDeg = Number(o.rotation) || 0;
  const th = (rotDeg * Math.PI) / 180;
  const cos = Math.cos(th);
  const sin = Math.sin(th);

  let drawAt; // (page, cx, cy) => void
  let boxW; let boxH;

  if (o.type === 'image') {
    if (!o.image) throw new Error('Выберите изображение для водяного знака');
    const bytes = new Uint8Array(await o.image.arrayBuffer());
    const isPng = o.image.type === 'image/png' || /\.png$/i.test(o.image.name);
    const img = isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
    const ratio = img.height / img.width;
    drawAt = (page, cx, cy, w) => {
      const h = w * ratio;
      page.drawImage(img, {
        x: cx + (-w / 2) * cos - (-h / 2) * sin,
        y: cy + (-w / 2) * sin + (-h / 2) * cos,
        width: w, height: h, rotate: degrees(rotDeg), opacity,
      });
    };
    boxW = (page) => (page.getSize().width * (Number(o.scale) || 50)) / 100;
    boxH = (page) => boxW(page) * ratio;
  } else {
    const text = String(o.text || '').trim();
    if (!text) throw new Error('Введите текст водяного знака');
    const { bold } = await embedFonts(doc, { bold: true });
    const size = Number(o.size) || 64;
    const c = hexToRgb01(o.color);
    const tw = bold.widthOfTextAtSize(text, size);
    const hc = size * 0.35; // примерная половина высоты заглавных
    drawAt = (page, cx, cy) => {
      page.drawText(text, {
        x: cx + (-tw / 2) * cos + hc * sin,
        y: cy + (-tw / 2) * sin - hc * cos,
        size, font: bold, color: rgb(c.r, c.g, c.b), rotate: degrees(rotDeg), opacity,
      });
    };
    boxW = () => tw;
    boxH = () => size;
  }

  for (let n = 0; n < idx.length; n++) {
    const page = pages[idx[n]];
    const { width, height } = page.getSize();
    const w = boxW(page);
    if (o.layout === 'tile') {
      const stepX = Math.max(w, 40) * 1.6;
      const stepY = Math.max(boxH(page), 20) * 3.2;
      let row = 0;
      for (let y = -height * 0.2; y < height * 1.2; y += stepY, row++) {
        for (let x = -width * 0.2 + (row % 2 ? stepX / 2 : 0); x < width * 1.2; x += stepX) {
          drawAt(page, x, y, w);
        }
      }
    } else {
      drawAt(page, width / 2, height / 2, w);
    }
    progress(ctx, (n + 1) / idx.length, 'Накладываю знак…');
  }
  return [{ name: `${baseName(file.name)}_watermark.pdf`, blob: pdfBlob(await doc.save()) }];
}

/* ───────────── Изображения -> PDF ───────────── */
async function loadBitmap(file) {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return await createImageBitmap(file);
  }
}

async function imageToEmbeddable(file, filter) {
  const isPng = file.type === 'image/png';
  if (isPng && filter === 'none') {
    return { bytes: new Uint8Array(await file.arrayBuffer()), kind: 'png' };
  }
  const bmp = await loadBitmap(file);
  const maxSide = 4200;
  const k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * k));
  const h = Math.max(1, Math.round(bmp.height * k));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close && bmp.close();

  if (filter === 'gray' || filter === 'bw') {
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    if (filter === 'gray') {
      for (let i = 0; i < d.length; i += 4) {
        const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        d[i] = d[i + 1] = d[i + 2] = g;
      }
    } else {
      // «скан»: растягиваем контраст по гистограмме и применяем мягкий порог
      const hist = new Array(256).fill(0);
      for (let i = 0; i < d.length; i += 4) hist[Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2])]++;
      const px = d.length / 4;
      let acc = 0; let lo = 0; let hi = 255;
      for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc > px * 0.01) { lo = v; break; } }
      acc = 0;
      for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc > px * 0.08) { hi = v; break; } }
      const span = Math.max(30, hi - lo);
      for (let i = 0; i < d.length; i += 4) {
        const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        let v = ((g - lo) / span) * 255;
        v = v > 255 ? 255 : v < 0 ? 0 : v;
        v = v > 170 ? 255 : v * 0.75; // фон — белый, текст — тёмный
        d[i] = d[i + 1] = d[i + 2] = v;
      }
    }
    ctx.putImageData(img, 0, 0);
  }
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.9));
  return { bytes: new Uint8Array(await blob.arrayBuffer()), kind: 'jpg' };
}

async function images2pdf(files, o, ctx) {
  const doc = await PDFDocument.create();
  const filter = o.filter || 'none';
  for (let i = 0; i < files.length; i++) {
    progress(ctx, i / files.length, `Обработка: ${files[i].name}`);
    const { bytes, kind } = await imageToEmbeddable(files[i], filter);
    const img = kind === 'png' ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
    if (o.pageSize === 'fit') {
      doc.addPage([img.width, img.height]).drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
      continue;
    }
    let [pw, ph] = o.pageSize === 'letter' ? [612, 792] : [595.28, 841.89];
    const landscape = o.orientation === 'landscape' || (o.orientation !== 'portrait' && img.width > img.height);
    if (landscape) [pw, ph] = [ph, pw];
    const m = Number(o.margin) || 0;
    const k = Math.min((pw - 2 * m) / img.width, (ph - 2 * m) / img.height, o.margin === '0' ? Infinity : 1);
    const w = img.width * k;
    const h = img.height * k;
    doc.addPage([pw, ph]).drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
  }
  return [{ name: 'images.pdf', blob: pdfBlob(await doc.save()) }];
}

/* ───────────── PDF -> изображения ───────────── */
async function pdf2img(files, o, ctx) {
  const { loadPdfjsDoc, renderPageToCanvas, canvasToBlob } = await import('./pdfjs');
  const doc = await loadPdfjsDoc(files[0]);
  const base = baseName(files[0].name);
  const scale = (parseInt(o.dpi, 10) || 150) / 72;
  const png = o.format === 'png';
  const outs = [];
  for (let i = 1; i <= doc.numPages; i++) {
    progress(ctx, (i - 1) / doc.numPages, `Страница ${i} из ${doc.numPages}`);
    const canvas = await renderPageToCanvas(doc, i, scale);
    const blob = await canvasToBlob(canvas, png ? 'image/png' : 'image/jpeg', 0.92);
    const pad = String(i).padStart(String(doc.numPages).length, '0');
    outs.push({ name: `${base}_${pad}.${png ? 'png' : 'jpg'}`, blob });
    canvas.width = canvas.height = 0;
  }
  return outs;
}

/* ───────────── Сжатие ───────────── */
async function rasterCompress(file, { scale, quality }, ctx) {
  const { loadPdfjsDoc, renderPageToCanvas, canvasToBlob } = await import('./pdfjs');
  const doc = await loadPdfjsDoc(file);
  const out = await PDFDocument.create();
  for (let i = 1; i <= doc.numPages; i++) {
    progress(ctx, (i - 1) / doc.numPages, `${file.name}: страница ${i} из ${doc.numPages}`);
    const page = await doc.getPage(i);
    const vp = page.getViewport({ scale: 1 });
    const canvas = await renderPageToCanvas(doc, i, scale);
    const blob = await canvasToBlob(canvas, 'image/jpeg', quality);
    const img = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()));
    out.addPage([vp.width, vp.height]).drawImage(img, { x: 0, y: 0, width: vp.width, height: vp.height });
    canvas.width = canvas.height = 0;
  }
  return pdfBlob(await out.save());
}

async function compress(files, o, ctx) {
  const { callServer } = await import('./client-api');
  const outs = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    ctx && ctx.onProgress && ctx.onProgress(i / files.length, `Сжимаю: ${f.name}`);
    let blob;
    if (o.level === 'light') {
      try {
        blob = (await callServer('/api/qpdf', f, { op: 'compress' })).blob;
      } catch (e) {
        if (e.code !== 'NO_SERVER') throw e;
        const doc = await openPdf(f);
        blob = pdfBlob(await doc.save({ useObjectStreams: true }));
      }
    } else {
      const preset = o.level === 'extreme' ? { scale: 1.0, quality: 0.5 } : { scale: 1.4, quality: 0.7 };
      blob = await rasterCompress(f, preset, ctx);
    }
    const name = `${baseName(f.name)}_compressed.pdf`;
    if (blob.size >= f.size) {
      outs.push({ name, blob: f, note: `Файл уже оптимален (${formatBytes(f.size)}) — сжать сильнее не удалось, возвращён оригинал.` });
    } else {
      const pct = Math.round((1 - blob.size / f.size) * 100);
      outs.push({ name, blob, note: `${formatBytes(f.size)} → ${formatBytes(blob.size)} (−${pct}%)` });
    }
  }
  return outs;
}

/* ───────────── OCR ───────────── */
async function ocr(files, o, ctx) {
  const { loadPdfjsDoc, renderPageToCanvas } = await import('./pdfjs');
  const { createWorker } = await import('tesseract.js');
  const doc = await loadPdfjsDoc(files[0]);
  const total = doc.numPages;
  let page = 1;
  const worker = await createWorker(o.lang || 'rus+eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') progress(ctx, (page - 1 + m.progress) / total, `Распознаю страницу ${page} из ${total}`);
      else if (m.status && /load|initial/i.test(m.status)) progress(ctx, 0, 'Загружаю языковые данные…');
    },
  });
  const SCALE = 2;
  const out = await PDFDocument.create();
  const texts = [];
  try {
    for (page = 1; page <= total; page++) {
      const canvas = await renderPageToCanvas(doc, page, SCALE);
      const { data } = await worker.recognize(canvas, {}, { pdf: true });
      texts.push(data.text || '');
      const pdf = await PDFDocument.load(new Uint8Array(data.pdf));
      const [p] = await out.copyPages(pdf, [0]);
      p.scale(1 / SCALE, 1 / SCALE);
      out.addPage(p);
      canvas.width = canvas.height = 0;
    }
  } finally {
    await worker.terminate();
  }
  const base = baseName(files[0].name);
  return [
    { name: `${base}_ocr.pdf`, blob: pdfBlob(await out.save()), note: 'PDF с текстовым слоем: текст можно искать и копировать.' },
    { name: `${base}_ocr.txt`, blob: new Blob([texts.join('\n\n')], { type: 'text/plain;charset=utf-8' }) },
  ];
}

/* ───────────── PDF -> Markdown ───────────── */
async function pdf2md(files, o, ctx) {
  const { loadPdfjsDoc } = await import('./pdfjs');
  const doc = await loadPdfjsDoc(files[0]);
  const allLines = []; // { text, size, y, page, gapBefore }
  const sizes = [];

  for (let p = 1; p <= doc.numPages; p++) {
    progress(ctx, (p - 1) / doc.numPages, `Страница ${p} из ${doc.numPages}`);
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const rows = [];
    for (const it of tc.items) {
      if (!('str' in it) || !it.str.trim()) continue;
      const size = Math.hypot(it.transform[2], it.transform[3]) || it.height || 10;
      const y = it.transform[5];
      const x = it.transform[4];
      let row = rows.find((r) => Math.abs(r.y - y) < size * 0.4);
      if (!row) { row = { y, items: [], size: 0 }; rows.push(row); }
      row.items.push({ x, str: it.str, w: it.width });
      row.size = Math.max(row.size, size);
    }
    rows.sort((a, b) => b.y - a.y);
    let prevY = null;
    for (const r of rows) {
      r.items.sort((a, b) => a.x - b.x);
      let text = '';
      let endX = null;
      for (const it of r.items) {
        if (endX !== null && it.x - endX > r.size * 0.15 && !text.endsWith(' ')) text += ' ';
        text += it.str;
        endX = it.x + it.w;
      }
      text = text.replace(/\s+/g, ' ').trim();
      if (!text) continue;
      const gap = prevY === null ? 0 : prevY - r.y;
      allLines.push({ text, size: r.size, gap, firstOnPage: prevY === null });
      sizes.push(r.size);
      prevY = r.y;
    }
    page.cleanup();
  }

  sizes.sort((a, b) => a - b);
  const body = sizes[Math.floor(sizes.length / 2)] || 10;
  const bullet = /^([•●▪■◦‣\-–—*])\s+/;
  const numbered = /^(\d+[.)])\s+/;
  let md = '';
  let prevKind = '';
  for (const l of allLines) {
    let kind = 'p';
    let out = l.text;
    if (l.size > body * 1.55) { kind = 'h1'; out = `# ${out}`; }
    else if (l.size > body * 1.25) { kind = 'h2'; out = `## ${out}`; }
    else if (l.size > body * 1.1 && out.length < 90) { kind = 'h3'; out = `### ${out}`; }
    else if (bullet.test(out)) { kind = 'li'; out = out.replace(bullet, '- '); }
    else if (numbered.test(out)) { kind = 'li'; out = out.replace(numbered, (m) => `${m.trim()} `); }

    const newPara = l.firstOnPage || l.gap > l.size * 1.7 || kind !== prevKind || kind.startsWith('h');
    if (md && kind === 'li' && prevKind === 'li') md += `\n${out}`;
    else if (md && newPara) md += `\n\n${out}`;
    else md += md ? ` ${out}` : out;
    prevKind = kind;
  }
  const base = baseName(files[0].name);
  return [{ name: `${base}.md`, blob: new Blob([`${md.trim()}\n`], { type: 'text/markdown;charset=utf-8' }) }];
}

/* ───────────── PDF -> Excel ───────────── */
async function pdf2xlsx(files, o, ctx) {
  const { loadPdfjsDoc } = await import('./pdfjs');
  const { default: JSZip } = await import('jszip');
  const { buildXlsx, itemsToRows, toCellValue } = await import('./xlsx');
  const doc = await loadPdfjsDoc(files[0]);
  const sheets = [];
  for (let p = 1; p <= doc.numPages; p++) {
    progress(ctx, (p - 1) / doc.numPages, `Страница ${p} из ${doc.numPages}`);
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const items = tc.items
      .filter((it) => 'str' in it)
      .map((it) => ({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width, h: Math.hypot(it.transform[2], it.transform[3]) || it.height }));
    const rows = itemsToRows(items).map((r) => r.map(toCellValue));
    sheets.push({ name: `Стр. ${p}`, rows: rows.length ? rows : [['(на странице нет текста)']] });
    page.cleanup();
  }
  const bytes = await buildXlsx(sheets, JSZip);
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  return [{ name: `${baseName(files[0].name)}.xlsx`, blob, note: 'Таблицы определяются автоматически; сканы без текстового слоя сначала прогоните через OCR.' }];
}

/* ───────────── Экспорт из редактора ───────────── */
/** items: [{ type, page, x, y, w, h, ... }] — координаты в долях страницы, y сверху */
export async function exportWithItems(file, items) {
  let doc = await openPdf(file);
  doc = await flattenRotation(doc);
  const pages = doc.getPages();
  const needFont = items.some((it) => it.type === 'text');
  const fonts = needFont ? await embedFonts(doc) : null;
  const imageCache = new Map();

  for (const it of items) {
    const page = pages[it.page];
    if (!page) continue;
    const { width: W, height: H } = page.getSize();

    if (it.type === 'text') {
      const c = hexToRgb01(it.color);
      const lines = String(it.text || '').split('\n');
      lines.forEach((line, i) => {
        if (!line) return;
        page.drawText(line, {
          x: it.x * W,
          y: H - it.y * H - it.size * 0.946 - i * it.size * 1.2,
          size: it.size, font: fonts.regular, color: rgb(c.r, c.g, c.b),
        });
      });
    } else if (it.type === 'rect') {
      const c = hexToRgb01(it.color);
      page.drawRectangle({
        x: it.x * W, y: H - (it.y + it.h) * H, width: it.w * W, height: it.h * H,
        color: rgb(c.r, c.g, c.b), opacity: it.opacity ?? 1,
      });
    } else if (it.type === 'pen') {
      const c = hexToRgb01(it.color);
      const pts = it.points || [];
      for (let i = 1; i < pts.length; i++) {
        page.drawLine({
          start: { x: pts[i - 1][0] * W, y: H - pts[i - 1][1] * H },
          end: { x: pts[i][0] * W, y: H - pts[i][1] * H },
          thickness: it.width, color: rgb(c.r, c.g, c.b), lineCap: LineCapStyle.Round,
        });
      }
    } else if (it.type === 'image') {
      let img = imageCache.get(it.dataUrl);
      if (!img) {
        const bin = atob(it.dataUrl.split(',')[1]);
        const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
        img = it.dataUrl.startsWith('data:image/png') ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
        imageCache.set(it.dataUrl, img);
      }
      const w = it.w * W;
      const h = w * it.aspect;
      page.drawImage(img, { x: it.x * W, y: H - it.y * H - h, width: w, height: h });
    }
  }
  return pdfBlob(await doc.save());
}

/** rect: {x,y,w,h} в долях; allPages — применить ко всем, иначе только к pageIndex */
export async function exportCropped(file, rect, { allPages = true, pageIndex = 0 } = {}) {
  let doc = await openPdf(file);
  doc = await flattenRotation(doc);
  doc.getPages().forEach((page, i) => {
    if (!allPages && i !== pageIndex) return;
    const { width: W, height: H } = page.getSize();
    const x = rect.x * W;
    const y = H - (rect.y + rect.h) * H;
    const w = rect.w * W;
    const h = rect.h * H;
    page.setMediaBox(x, y, w, h);
    page.setCropBox(x, y, w, h);
  });
  return pdfBlob(await doc.save());
}

/* ───────────── Формы ───────────── */
export async function readFormFields(file) {
  const doc = await openPdf(file);
  const form = doc.getForm();
  return form.getFields().map((f) => {
    const name = f.getName();
    if (f instanceof PDFTextField) return { name, type: 'text', value: f.getText() || '', multiline: f.isMultiline() };
    if (f instanceof PDFCheckBox) return { name, type: 'checkbox', value: f.isChecked() };
    if (f instanceof PDFDropdown) return { name, type: 'select', value: f.getSelected()[0] || '', options: f.getOptions() };
    if (f instanceof PDFRadioGroup) return { name, type: 'radio', value: f.getSelected() || '', options: f.getOptions() };
    if (f instanceof PDFOptionList) return { name, type: 'select', value: f.getSelected()[0] || '', options: f.getOptions() };
    return null;
  }).filter(Boolean);
}

export async function fillForm(file, values, { flatten = false } = {}) {
  const doc = await openPdf(file);
  const { regular } = await embedFonts(doc, { subset: false });
  const form = doc.getForm();
  for (const [name, value] of Object.entries(values)) {
    let f;
    try { f = form.getField(name); } catch { continue; }
    try {
      if (f instanceof PDFTextField) f.setText(value || undefined);
      else if (f instanceof PDFCheckBox) (value ? f.check() : f.uncheck());
      else if (f instanceof PDFDropdown) { if (value) f.select(value); else f.clear(); }
      else if (f instanceof PDFRadioGroup) { if (value) f.select(value); }
      else if (f instanceof PDFOptionList) { if (value) f.select(value); else f.clear(); }
    } catch { /* пропускаем поля, которые не удалось заполнить */ }
  }
  form.updateFieldAppearances(regular);
  if (flatten) form.flatten({ updateFieldAppearances: false });
  return pdfBlob(await doc.save());
}

export const ops = {
  merge, split, rotate, pagenumbers, watermark, images2pdf, pdf2img, compress, ocr, pdf2md, pdf2xlsx,
};
