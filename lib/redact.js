// Безвозвратное скрытие: страницы с чёрными блоками растеризуются,
// поэтому текст под блоками физически исчезает из файла.
import { PDFDocument } from 'pdf-lib';
import { openPdf } from './ops';
import { loadPdfjsDoc, renderPageToCanvas, canvasToBlob, getPdfjs } from './pdfjs';

/** rects: [{ page, x, y, w, h }] в долях страницы (y сверху) */
export async function exportRedacted(file, rects, ctx = {}) {
  const src = await openPdf(file);
  const jsDoc = await loadPdfjsDoc(file);
  const out = await PDFDocument.create();
  const redactedPages = new Set(rects.map((r) => r.page));
  const total = src.getPageCount();
  const SCALE = 2.5;

  for (let i = 0; i < total; i++) {
    ctx.onProgress && ctx.onProgress(i / total, `Страница ${i + 1} из ${total}`);
    if (!redactedPages.has(i)) {
      const [p] = await out.copyPages(src, [i]);
      out.addPage(p);
      continue;
    }
    const page = await jsDoc.getPage(i + 1);
    const vp = page.getViewport({ scale: 1 });
    const canvas = await renderPageToCanvas(jsDoc, i + 1, SCALE);
    const g = canvas.getContext('2d');
    g.fillStyle = '#000';
    for (const r of rects.filter((q) => q.page === i)) {
      g.fillRect(r.x * canvas.width, r.y * canvas.height, r.w * canvas.width, r.h * canvas.height);
    }
    const blob = await canvasToBlob(canvas, 'image/png');
    const img = await out.embedPng(new Uint8Array(await blob.arrayBuffer()));
    out.addPage([vp.width, vp.height]).drawImage(img, { x: 0, y: 0, width: vp.width, height: vp.height });
    canvas.width = canvas.height = 0;
  }
  return new Blob([await out.save()], { type: 'application/pdf' });
}

/** Поиск строки в тексте PDF -> прямоугольники (доли страницы) */
export async function findTextRects(file, query, onProgress) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [];
  const pdfjs = await getPdfjs();
  const doc = await loadPdfjsDoc(file);
  const rects = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const vp = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    for (const it of tc.items) {
      if (!('str' in it) || !it.str) continue;
      const lower = it.str.toLowerCase();
      let pos = lower.indexOf(q);
      if (pos < 0) continue;
      const t = pdfjs.Util.transform(vp.transform, it.transform);
      const fontH = Math.hypot(t[2], t[3]);
      const charW = (it.width * vp.scale) / it.str.length;
      while (pos >= 0) {
        const x = t[4] + pos * charW;
        const y = t[5] - fontH * 0.95;
        rects.push({
          page: p - 1,
          x: Math.max(0, (x - 1) / vp.width),
          y: Math.max(0, y / vp.height),
          w: Math.min(1, (q.length * charW + 2) / vp.width),
          h: Math.min(1, (fontH * 1.25) / vp.height),
        });
        pos = lower.indexOf(q, pos + q.length);
      }
    }
    page.cleanup();
    onProgress && onProgress(p / doc.numPages);
  }
  return rects;
}
