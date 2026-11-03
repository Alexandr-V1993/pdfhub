import { hasBinary } from '@/lib/server/run';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Проверка работоспособности: какие серверные программы доступны
export async function GET() {
  const [soffice, qpdf, gs, ffmpeg, heif, pandoc] = await Promise.all(['soffice', 'qpdf', 'gs', 'ffmpeg', 'heif-convert', 'pandoc'].map(hasBinary));
  return Response.json({ ok: true, tools: { libreoffice: soffice, qpdf, ghostscript: gs, ffmpeg, heif: heif, pandoc }, ai: process.env.ANTHROPIC_API_KEY ? 'claude' : 'built-in' });
}
