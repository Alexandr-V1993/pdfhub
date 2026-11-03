import fs from 'node:fs/promises';
import path from 'node:path';
import { DATA_DIR, clientIp, rateLimited, readJson, validEmail } from '@/lib/server/auth';

export const runtime = 'nodejs';

// Сообщения складываются в data/messages.jsonl (одна JSON-запись на строку).
// Если задан CONTACT_WEBHOOK_URL — дополнительно отправляются POST-запросом на этот адрес (например, Slack/Telegram-прокси).
export async function POST(req) {
  if (rateLimited(`contact:${clientIp(req)}`, 5, 60 * 60 * 1000)) {
    return Response.json({ error: 'Слишком много сообщений. Попробуйте позже.' }, { status: 429 });
  }
  const b = await readJson(req);
  if (!b) return Response.json({ error: 'Неверный запрос' }, { status: 400 });
  if (b.website) return Response.json({ ok: true }); // ловушка для ботов
  const name = String(b.name || '').trim().slice(0, 100);
  const email = String(b.email || '').trim().toLowerCase();
  const message = String(b.message || '').trim();
  if (!validEmail(email)) return Response.json({ error: 'Введите корректный адрес почты' }, { status: 400 });
  if (message.length < 5) return Response.json({ error: 'Напишите сообщение' }, { status: 400 });
  if (message.length > 5000) return Response.json({ error: 'Сообщение слишком длинное (максимум 5000 символов)' }, { status: 400 });

  const record = { at: new Date().toISOString(), name, email, message };
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.appendFile(path.join(DATA_DIR, 'messages.jsonl'), `${JSON.stringify(record)}\n`, { mode: 0o600 });
    if (process.env.CONTACT_WEBHOOK_URL) {
      await fetch(process.env.CONTACT_WEBHOOK_URL, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: `Новое сообщение от ${name || email} <${email}>:\n${message}` }),
      }).catch((e) => console.error('webhook failed', e));
    }
    return Response.json({ ok: true });
  } catch (e) {
    console.error(e);
    return Response.json({ error: 'Не удалось отправить сообщение' }, { status: 500 });
  }
}
