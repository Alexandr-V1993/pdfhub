import { clientIp, normalizeEmail, publicUser, rateLimited, readJson, registerUser, sessionCookie, validEmail } from '@/lib/server/auth';

export const runtime = 'nodejs';

export async function POST(req) {
  if (rateLimited(`reg:${clientIp(req)}`, 10, 60 * 60 * 1000)) {
    return Response.json({ error: 'Слишком много попыток. Попробуйте позже.' }, { status: 429 });
  }
  const body = await readJson(req);
  const email = normalizeEmail(body && body.email);
  const password = String((body && body.password) || '');
  if (!validEmail(email)) return Response.json({ error: 'Введите корректный адрес почты' }, { status: 400 });
  if (password.length < 8) return Response.json({ error: 'Пароль должен быть не короче 8 символов' }, { status: 400 });
  if (password.length > 200) return Response.json({ error: 'Пароль слишком длинный' }, { status: 400 });
  try {
    const user = await registerUser(email, password);
    return Response.json({ user: publicUser(user) }, { headers: { 'Set-Cookie': await sessionCookie(user, req) } });
  } catch (e) {
    if (e.code === 'EXISTS') return Response.json({ error: e.message }, { status: 409 });
    console.error(e);
    return Response.json({ error: 'Не удалось создать аккаунт' }, { status: 500 });
  }
}
