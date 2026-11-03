import { clientIp, loginUser, normalizeEmail, publicUser, rateLimited, readJson, sessionCookie } from '@/lib/server/auth';

export const runtime = 'nodejs';

export async function POST(req) {
  const body = await readJson(req);
  const email = normalizeEmail(body && body.email);
  const password = String((body && body.password) || '');
  if (rateLimited(`login:${clientIp(req)}`, 20, 15 * 60 * 1000) || rateLimited(`login:${email}`, 8, 15 * 60 * 1000)) {
    return Response.json({ error: 'Слишком много попыток входа. Подождите 15 минут.' }, { status: 429 });
  }
  if (!email || !password || password.length > 200) return Response.json({ error: 'Введите почту и пароль' }, { status: 400 });
  try {
    const user = await loginUser(email, password);
    if (!user) return Response.json({ error: 'Неверная почта или пароль' }, { status: 401 });
    return Response.json({ user: publicUser(user) }, { headers: { 'Set-Cookie': await sessionCookie(user, req) } });
  } catch (e) {
    console.error(e);
    return Response.json({ error: 'Не удалось выполнить вход' }, { status: 500 });
  }
}
