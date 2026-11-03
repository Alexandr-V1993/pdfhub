import { clearCookie } from '@/lib/server/auth';

export const runtime = 'nodejs';

export async function POST(req) {
  return Response.json({ ok: true }, { headers: { 'Set-Cookie': clearCookie(req) } });
}
