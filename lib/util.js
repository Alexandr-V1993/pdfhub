export const uid = () => Math.random().toString(36).slice(2, 10);

export const baseName = (name) => String(name || 'file').replace(/\.[^.]+$/, '');

export function formatBytes(b) {
  if (b < 1024) return `${b} Б`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} КБ`;
  return `${(b / 1048576).toFixed(2)} МБ`;
}

export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}

export function hexToRgb01(hex) {
  let h = String(hex || '#000000').replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16) || 0;
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

/** "1-3, 5, 8-" -> [{label:'1-3', pages:[0,1,2]}, ...] (индексы с нуля) */
export function parseRangeList(str, total) {
  const out = [];
  const parts = String(str || '').split(/[,;\s]+/).filter(Boolean);
  if (!parts.length) throw new Error('Укажите номера страниц, например: 1-3, 5, 8-');
  for (const part of parts) {
    let a, b;
    const m = part.match(/^(\d*)-(\d*)$/);
    if (m && (m[1] || m[2])) {
      a = m[1] ? +m[1] : 1;
      b = m[2] ? +m[2] : total;
    } else if (/^\d+$/.test(part)) {
      a = b = +part;
    } else {
      throw new Error(`Не удалось разобрать «${part}». Пример: 1-3, 5, 8-`);
    }
    if (a < 1 || b > total || a > b) {
      throw new Error(`Диапазон «${part}» не подходит: в документе страниц — ${total}`);
    }
    const pages = [];
    for (let i = a; i <= b; i++) pages.push(i - 1);
    out.push({ label: a === b ? String(a) : `${a}-${b}`, pages });
  }
  return out;
}

/** Выбор страниц по опциям scope/range -> массив индексов */
export function selectPages(o, total) {
  const all = Array.from({ length: total }, (_, i) => i);
  switch (o.scope) {
    case 'odd': return all.filter((i) => i % 2 === 0);
    case 'even': return all.filter((i) => i % 2 === 1);
    case 'range': return [...new Set(parseRangeList(o.range, total).flatMap((r) => r.pages))].sort((x, y) => x - y);
    default: return all;
  }
}

export function friendlyError(e) {
  const msg = (e && e.message) || String(e);
  if (/encrypted/i.test(msg)) {
    return 'Файл защищён паролем. Сначала снимите защиту инструментом «Разблокировать PDF».';
  }
  if (/Failed to parse PDF|Invalid PDF|No PDF header/i.test(msg)) {
    return 'Не удалось прочитать PDF. Попробуйте сначала инструмент «Восстановить PDF».';
  }
  return msg;
}
