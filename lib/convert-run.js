// Выполнение конвертаций из каталога lib/conversions.js
import { baseName } from './util';
import { callServer, uploadWithProgress } from './client-api';

const prog = (ctx, v, t) => ctx && ctx.onProgress && ctx.onProgress(v, t);
const MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

async function canvasConvert(file, to, isSvg) {
  if (isSvg) {
    const url = URL.createObjectURL(new Blob([await file.text()], { type: 'image/svg+xml' }));
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const k = Math.max(1, 1600 / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
      const w = Math.round((img.naturalWidth || 1024) * k);
      const h = Math.round((img.naturalHeight || 1024) * k);
      return await draw(img, w, h, to);
    } catch (e) {
      if (e && /браузер/.test(e.message || '')) throw e;
      throw new Error('Не удалось открыть SVG. Проверьте, что файл корректный.');
    } finally { URL.revokeObjectURL(url); }
  }
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { throw new Error('Не удалось открыть изображение. Файл повреждён или формат не поддерживается.'); }
  try { return await draw(bmp, bmp.width, bmp.height, to); } finally { bmp.close && bmp.close(); }
}
async function draw(src, w, h, to) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (to === 'jpg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); }
  ctx.drawImage(src, 0, 0, w, h);
  const blob = await new Promise((res) => canvas.toBlob(res, MIME[to], 0.92));
  canvas.width = canvas.height = 0;
  if (!blob || blob.type !== MIME[to]) throw new Error(`Ваш браузер не умеет сохранять в ${to.toUpperCase()}. Попробуйте Chrome или Edge.`);
  return blob;
}

async function decodeCsv(file) {
  const buf = await file.arrayBuffer();
  let text = new TextDecoder('utf-8').decode(buf);
  if (text.includes('�')) text = new TextDecoder('windows-1251').decode(buf); // CSV из русского Excel
  return text.replace(/^﻿/, '');
}

async function one(c, file, ctx, k, n) {
  const base = baseName(file.name);
  const step = (v, t) => prog(ctx, (k + v) / n, t || file.name);
  switch (c.engine) {
    case 'canvas':
    case 'svg':
      step(0.3);
      return [{ name: `${base}.${c.to_ext}`, blob: await canvasConvert(file, c.to_ext, c.engine === 'svg'), note: c.note }];

    case 'img-pdf': {
      const { ops } = await import('./ops');
      const [o] = await ops.images2pdf([file], { pageSize: 'a4', orientation: 'auto', margin: '0', filter: 'none' }, {});
      return [{ name: `${base}.pdf`, blob: o.blob }];
    }
    case 'img-pdf-server': {
      step(0.1, 'Читаю изображение…');
      const dec = await uploadWithProgress('/api/media', file, { to: c.via }, (p) => step(0.1 + p * 0.4));
      const img = new File([dec.blob], `${base}.${c.via}`, { type: MIME[c.via] });
      const { ops } = await import('./ops');
      const [o] = await ops.images2pdf([img], { pageSize: 'a4', orientation: 'auto', margin: '0', filter: 'none' }, {});
      return [{ name: `${base}.pdf`, blob: o.blob, note: c.via === 'png' ? 'Для многостраничных TIFF сохраняется первая страница.' : undefined }];
    }
    case 'heic':
    case 'media': {
      step(0.02, `Загружаю: ${file.name}`);
      const r = await uploadWithProgress('/api/media', file, { to: c.to_ext }, (p) => step(p * 0.5, p < 1 ? `Загружаю: ${file.name}` : 'Конвертирую…'));
      return [{ name: r.name || `${base}.${c.to_ext}`, blob: r.blob, note: c.note }];
    }
    case 'epub': {
      step(0.2, 'Конвертирую книгу…');
      const r = await callServer('/api/convert', file, { target: 'epub-pdf' });
      return [{ name: r.name, blob: r.blob }];
    }
    case 'office': {
      step(0.2, 'Конвертирую…');
      try {
        const r = await callServer('/api/convert', file, { target: 'pdf' });
        return [{ name: r.name, blob: r.blob }];
      } catch (e) {
        if (e.code !== 'NO_SERVER') throw e;
        const { runFallback } = await import('./fallbacks');
        const ext = (file.name.match(/\.([^.]+)$/) || [])[1]?.toLowerCase();
        const slug = ['xls', 'xlsx', 'ods', 'csv'].includes(ext) ? 'excel_to_pdf' : ['ppt', 'pptx', 'odp'].includes(ext) ? 'powerpoint_to_pdf' : 'word_to_pdf';
        return runFallback({ slug }, file, {}, ctx);
      }
    }
    case 'pdf-png': {
      const { ops } = await import('./ops');
      return ops.pdf2img([file], { format: 'png', dpi: '150' }, ctx);
    }
    case 'pdf-txt': {
      const { loadPdfjsDoc, extractPagesText } = await import('./pdfjs');
      const doc = await loadPdfjsDoc(file);
      const pages = await extractPagesText(doc, (v) => step(v));
      const text = pages.join('\n\n').trim();
      if (!text) throw new Error('В PDF нет текстового слоя. Если это скан — сначала примените «OCR PDF».');
      return [{ name: `${base}.txt`, blob: new Blob([text], { type: 'text/plain;charset=utf-8' }) }];
    }
    case 'csv-xlsx': {
      const XLSX = await import('xlsx');
      const wb = XLSX.read(await decodeCsv(file), { type: 'string' });
      const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
      return [{ name: `${base}.xlsx`, blob: new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }) }];
    }
    case 'xlsx-csv': {
      const XLSX = await import('xlsx');
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      return wb.SheetNames.map((name) => ({
        name: wb.SheetNames.length > 1 ? `${base}_${name}.csv` : `${base}.csv`,
        blob: new Blob([`﻿${XLSX.utils.sheet_to_csv(wb.Sheets[name])}`], { type: 'text/csv;charset=utf-8' }),
      }));
    }
    default:
      throw new Error('Неизвестная конвертация');
  }
}

export async function runConversion(c, files, ctx) {
  const outs = [];
  for (let i = 0; i < files.length; i++) outs.push(...(await one(c, files[i], ctx, i, files.length)));
  prog(ctx, 1, 'Готово');
  return outs;
}
