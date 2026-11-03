import { json } from '@/lib/server/run';
import { summarize as extractiveSummary } from '@/lib/server/extractive';

export const runtime = 'nodejs';
export const maxDuration = 120;

const LANG = {
  ru: 'русский', en: 'английский', de: 'немецкий', fr: 'французский', es: 'испанский',
  it: 'итальянский', pt: 'португальский', uk: 'украинский', pl: 'польский', tr: 'турецкий',
};
const MAX_CHARS = 40000;

// простой лимит запросов по IP (в памяти процесса)
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const window = 60 * 60 * 1000;
  const max = Number(process.env.AI_REQUESTS_PER_HOUR) || 120;
  const arr = (hits.get(ip) || []).filter((t) => now - t < window);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > max;
}

function prompts(action, lang, length, final) {
  const L = LANG[lang] || 'русский';
  if (action === 'translate') {
    return {
      system: `Ты профессиональный переводчик. Переведи текст пользователя на ${L} язык. Сохраняй абзацы, списки и числа. Не добавляй комментариев и пояснений — верни только перевод.`,
      max: 8000,
    };
  }
  const size = { short: 'в 3–5 кратких пунктах', medium: 'на 150–300 слов', long: 'подробно, с разделами и ключевыми цифрами' }[length] || 'на 150–300 слов';
  return {
    system: `Ты помощник, который делает точные резюме документов. Напиши резюме ${size} на ${L} языке. Передавай только то, что есть в тексте; не выдумывай факты. ${final ? 'Ниже — резюме отдельных частей одного документа: объедини их в одно связное резюме без повторов.' : ''} Не используй markdown-разметку (звёздочки, решётки) — только обычный текст и дефисы для списков.`,
    max: 2500,
  };
}

export async function POST(req) {
  const key = process.env.ANTHROPIC_API_KEY;

  const ip = (req.headers.get('x-forwarded-for') || 'local').split(',')[0].trim();
  if (limited(ip)) return json('Слишком много запросов. Попробуйте позже.', 429);

  let body;
  try { body = await req.json(); } catch { return json('Неверный запрос'); }
  const { action, text, lang, length, final } = body || {};
  if (!['summarize', 'translate'].includes(action)) return json('Неизвестное действие');
  if (typeof text !== 'string' || !text.trim()) return json('Нет текста для обработки');
  if (text.length > MAX_CHARS) return json('Слишком длинный фрагмент текста');

  // Без ключа ИИ: резюме — встроенный алгоритм, перевод — собственный сервер LibreTranslate
  if (!key) {
    if (action === 'summarize') return Response.json({ result: extractiveSummary(text, length) });
    return translateFree(text, lang);
  }
  const { system, max } = prompts(action, lang, length, final);
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
        max_tokens: max,
        system,
        messages: [{ role: 'user', content: text }],
      }),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      console.error('Anthropic API error', r.status, t.slice(0, 500));
      return json(r.status === 401 ? 'Неверный ключ ANTHROPIC_API_KEY' : r.status === 429 ? 'Лимит запросов к ИИ исчерпан, попробуйте позже' : 'Ошибка сервиса ИИ', 502);
    }
    const data = await r.json();
    const out = (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
    return Response.json({ result: out.trim() });
  } catch (e) {
    console.error(e);
    return json('Не удалось связаться с сервисом ИИ', 502);
  }
}

// ───────── Перевод без ключа Claude: цепочка запасных вариантов ─────────
// 1) собственный LibreTranslate (если задан LIBRETRANSLATE_URL и он отвечает)
// 2) бесплатная веб-служба Google Translate (без ключа)
// 3) MyMemory (бесплатный API, короткие фрагменты)
async function viaLibre(text, lang) {
  const base = (process.env.LIBRETRANSLATE_URL || '').replace(/\/$/, '');
  if (!base) throw new Error('LibreTranslate не настроен');
  const r = await fetch(`${base}/translate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ q: text, source: 'auto', target: lang, format: 'text', api_key: process.env.LIBRETRANSLATE_API_KEY || undefined }),
    signal: AbortSignal.timeout(45000),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || typeof data.translatedText !== 'string') throw new Error(`LibreTranslate ${r.status}: ${data.error || ''}`);
  return data.translatedText;
}

async function viaGoogle(text, lang) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(lang)}&dt=t&ie=UTF-8&oe=UTF-8`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8', 'user-agent': 'Mozilla/5.0 (compatible; PDFHub)' },
    body: `q=${encodeURIComponent(text)}`,
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) throw new Error(`Google ${r.status}`);
  const data = await r.json();
  if (!Array.isArray(data) || !Array.isArray(data[0])) throw new Error('Google: неожиданный ответ');
  return data[0].map((s) => (s && s[0]) || '').join('');
}

function guessSource(text) {
  const sample = text.slice(0, 2000);
  const cyr = (sample.match(/[\u0400-\u04FF]/g) || []).length;
  const lat = (sample.match(/[A-Za-z]/g) || []).length;
  if (cyr > lat) return /[іїєґ]/i.test(sample) ? 'uk' : 'ru';
  return 'en';
}

async function viaMyMemory(text, lang) {
  const src = guessSource(text);
  if (src === lang) return text;
  const parts = [];
  let cur = '';
  for (const piece of text.split(/(?<=[.!?\n])/)) {
    if ((cur + piece).length > 450 && cur) { parts.push(cur); cur = ''; }
    if (piece.length > 450) { for (let i = 0; i < piece.length; i += 450) parts.push(piece.slice(i, i + 450)); } else cur += piece;
  }
  if (cur) parts.push(cur);
  const out = [];
  for (let i = 0; i < parts.length; i += 4) {
    const batch = await Promise.all(parts.slice(i, i + 4).map(async (p) => {
      if (!p.trim()) return p;
      const u = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(p)}&langpair=${src}|${lang}${process.env.MYMEMORY_EMAIL ? `&de=${encodeURIComponent(process.env.MYMEMORY_EMAIL)}` : ''}`;
      const r = await fetch(u, { signal: AbortSignal.timeout(20000) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d.responseStatus !== 200 || !d.responseData) throw new Error(`MyMemory ${d.responseStatus || r.status}`);
      return d.responseData.translatedText;
    }));
    out.push(...batch);
  }
  return out.join('');
}

async function translateFree(text, lang) {
  const providers = [['LibreTranslate', viaLibre], ['Google', viaGoogle], ['MyMemory', viaMyMemory]];
  const errors = [];
  for (const [name, fn] of providers) {
    try {
      const res = String(await fn(text, lang)).trim();
      if (res) return Response.json({ result: res });
      errors.push(`${name}: пустой ответ`);
    } catch (e) {
      errors.push(`${name}: ${e.message}`);
    }
  }
  console.error('translate failed:', errors.join(' | '));
  return json('Сервис перевода сейчас недоступен. Попробуйте чуть позже.', 502);
}
