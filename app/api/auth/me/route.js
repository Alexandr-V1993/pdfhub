import { getSessionUser, publicUser } from '@/lib/server/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req) {
  const user = await getSessionUser(req);
  return Response.json({ user: user ? publicUser(user) : null }, { headers: { 'Cache-Control': 'no-store' } });
}
