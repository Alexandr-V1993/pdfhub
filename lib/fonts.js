import fontkit from '@pdf-lib/fontkit';

const cache = {};
let loader = async (name) => {
  const r = await fetch(`/fonts/${name}`);
  if (!r.ok) throw new Error('Не удалось загрузить шрифт');
  return new Uint8Array(await r.arrayBuffer());
};

/** Для тестов в Node */
export function setFontLoader(fn) { loader = fn; }

async function bytes(name) {
  if (!cache[name]) cache[name] = await loader(name);
  return cache[name];
}

/** Встраивает DejaVu Sans (есть кириллица) в документ */
export async function embedFonts(doc, { bold = false, subset = true } = {}) {
  doc.registerFontkit(fontkit);
  const regular = await doc.embedFont(await bytes('DejaVuSans.ttf'), { subset });
  const boldFont = bold ? await doc.embedFont(await bytes('DejaVuSans-Bold.ttf'), { subset }) : null;
  return { regular, bold: boldFont };
}
