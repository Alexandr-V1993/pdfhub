// Минимальный генератор XLSX (без внешних библиотек, кроме JSZip)
// и эвристика «текст PDF -> таблица».

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  // eslint-disable-next-line no-control-regex
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

export function colName(n) { // 0 -> A
  let s = '';
  for (let i = n + 1; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
  return s;
}

/** sheets: [{ name, rows: (string|number|null)[][] }] -> Uint8Array/Blob через JSZip */
export async function buildXlsx(sheets, JSZip) {
  const zip = new JSZip();
  const names = sheets.map((s, i) => String(s.name || `Лист ${i + 1}`).replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || `Лист ${i + 1}`);

  zip.file('[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    + '<Default Extension="xml" ContentType="application/xml"/>'
    + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
    + sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')
    + '</Types>');
  zip.file('_rels/.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
    + '</Relationships>');
  zip.file('xl/workbook.xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'
    + names.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')
    + '</sheets></workbook>');
  zip.file('xl/_rels/workbook.xml.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')
    + '</Relationships>');

  sheets.forEach((s, i) => {
    let xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>';
    s.rows.forEach((row, r) => {
      xml += `<row r="${r + 1}">`;
      row.forEach((v, c) => {
        if (v === null || v === undefined || v === '') return;
        const ref = `${colName(c)}${r + 1}`;
        if (typeof v === 'number' && Number.isFinite(v)) xml += `<c r="${ref}"><v>${v}</v></c>`;
        else xml += `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
      });
      xml += '</row>';
    });
    xml += '</sheetData></worksheet>';
    zip.file(`xl/worksheets/sheet${i + 1}.xml`, xml);
  });

  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

/**
 * items: [{ str, x, y, w, h }] в координатах PDF (y растёт вверх).
 * Возвращает строки таблицы: string[][]
 */
export function itemsToRows(items) {
  const clean = items.filter((it) => it.str && it.str.trim());
  if (!clean.length) return [];

  // 1. строки по вертикальной близости
  const lines = [];
  for (const it of [...clean].sort((a, b) => b.y - a.y)) {
    const tol = Math.max(2, (it.h || 10) * 0.45);
    const line = lines.find((l) => Math.abs(l.y - it.y) <= tol);
    if (line) line.items.push(it);
    else lines.push({ y: it.y, items: [it], h: it.h || 10 });
  }
  lines.sort((a, b) => b.y - a.y);

  // 2. в строке склеиваем близкие фрагменты в «ячейки»
  const rows = lines.map((l) => {
    l.items.sort((a, b) => a.x - b.x);
    const cells = [];
    for (const it of l.items) {
      const last = cells[cells.length - 1];
      const gapLimit = Math.max(l.h, it.h || 10) * 1.1;
      if (last && it.x - last.end <= gapLimit) {
        const space = it.x - last.end > (it.h || 10) * 0.12 && !last.text.endsWith(' ') ? ' ' : '';
        last.text += space + it.str;
        last.end = it.x + it.w;
      } else {
        cells.push({ x: it.x, end: it.x + it.w, text: it.str });
      }
    }
    return cells.map((c) => ({ ...c, text: c.text.replace(/\s+/g, ' ').trim() })).filter((c) => c.text);
  }).filter((r) => r.length);

  // 3. колонки: кластеризация левых границ ячеек
  const xs = rows.flatMap((r) => r.map((c) => c.x)).sort((a, b) => a - b);
  const anchors = [];
  const tol = 8;
  for (const x of xs) {
    const a = anchors[anchors.length - 1];
    if (a && x - a.max <= tol) { a.max = x; a.sum += x; a.n += 1; }
    else anchors.push({ min: x, max: x, sum: x, n: 1 });
  }
  const centers = anchors.map((a) => a.sum / a.n);

  // если колонок слишком много (обычный текст, а не таблица) — оставляем каждую строку одной ячейкой
  const multi = rows.filter((r) => r.length > 1).length;
  if (multi < rows.length * 0.25 || centers.length > 40) {
    return rows.map((r) => [r.map((c) => c.text).join(' ')]);
  }

  return rows.map((r) => {
    const out = new Array(centers.length).fill('');
    for (const c of r) {
      let best = 0;
      for (let i = 0; i < centers.length; i++) {
        if (Math.abs(centers[i] - c.x) < Math.abs(centers[best] - c.x)) best = i;
      }
      out[best] = out[best] ? `${out[best]} ${c.text}` : c.text;
    }
    while (out.length && out[out.length - 1] === '') out.pop();
    return out;
  });
}

/** "1234", "-12.5", "12,5" -> число; всё остальное остаётся строкой */
export function toCellValue(s) {
  if (typeof s !== 'string') return s;
  const t = s.trim();
  if (/^-?\d{1,15}([.,]\d+)?$/.test(t) && !/^0\d/.test(t)) return Number(t.replace(',', '.'));
  return s;
}
