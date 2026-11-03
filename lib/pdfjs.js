// Обёртка над pdf.js (только в браузере)
let libPromise;

export function getPdfjs() {
  if (!libPromise) {
    libPromise = import('pdfjs-dist/legacy/build/pdf.mjs').then((lib) => {
      lib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      return lib;
    });
  }
  return libPromise;
}

export async function loadPdfjsDoc(file, password) {
  const pdfjs = await getPdfjs();
  const buf = await file.arrayBuffer();
  try {
    return await pdfjs.getDocument({ data: new Uint8Array(buf), isEvalSupported: false, password }).promise;
  } catch (e) {
    if (e && e.name === 'PasswordException') {
      if (password) throw new Error('Неверный пароль.');
      throw new Error('Файл защищён паролем. Сначала снимите защиту инструментом «Разблокировать PDF».');
    }
    throw e;
  }
}

/** Рендер страницы (номер с 1) в canvas */
export async function renderPageToCanvas(doc, pageNumber, scale = 1) {
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  page.cleanup();
  return canvas;
}

export function canvasToBlob(canvas, type = 'image/jpeg', quality = 0.85) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Не удалось создать изображение'))), type, quality);
  });
}

/** Текст страниц: массив строк */
export async function extractPagesText(doc, onProgress) {
  const out = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    let line = '';
    let lastY = null;
    const lines = [];
    for (const it of tc.items) {
      if (!('str' in it)) continue;
      const y = it.transform[5];
      if (lastY !== null && Math.abs(y - lastY) > 2) {
        lines.push(line);
        line = '';
      }
      line += it.str + (it.hasEOL ? '\n' : '');
      lastY = y;
    }
    if (line) lines.push(line);
    out.push(lines.join('\n').replace(/\n{3,}/g, '\n\n').trim());
    page.cleanup();
    onProgress && onProgress(i / doc.numPages);
  }
  return out;
}
