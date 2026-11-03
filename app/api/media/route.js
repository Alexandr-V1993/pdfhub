import fs from 'node:fs/promises';
import path from 'node:path';
import { fileResponse, json, randomName, readUpload, run, withSlot, withTmp } from '@/lib/server/run';

export const runtime = 'nodejs';
export const maxDuration = 900;

// Конвертация видео, аудио и «трудных» изображений (HEIC, TIFF) через ffmpeg / heif-convert
const MAX_MEDIA = (Number(process.env.MAX_MEDIA_MB) || 300) * 1024 * 1024;
const IN_EXT = new Set(['.mp4', '.m4v', '.mov', '.avi', '.mkv', '.webm', '.wmv', '.flv', '.gif', '.mp3', '.wav', '.flac', '.m4a', '.ogg', '.oga', '.aac', '.wma', '.tif', '.tiff', '.heic', '.heif']);
const OUT = {
  mp3: { ext: 'mp3', mime: 'audio/mpeg', args: ['-vn', '-c:a', 'libmp3lame', '-q:a', '2'] },
  wav: { ext: 'wav', mime: 'audio/wav', args: ['-vn', '-c:a', 'pcm_s16le'] },
  mp4: { ext: 'mp4', mime: 'video/mp4', args: ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart'] },
  gif: { ext: 'gif', mime: 'image/gif', args: ['-t', '20', '-an', '-vf', "fps=12,scale='min(480,iw)':-2:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse", '-loop', '0'] },
  png: { ext: 'png', mime: 'image/png', args: ['-frames:v', '1'] },
  jpg: { ext: 'jpg', mime: 'image/jpeg', args: ['-frames:v', '1', '-q:v', '2'] },
};
const IMAGE_IN = new Set(['.tif', '.tiff', '.heic', '.heif']);

export async function POST(req) {
  let up;
  try { up = await readUpload(req, MAX_MEDIA); } catch (e) { return json(e.message); }
  const { file, params } = up;
  const ext = path.extname(file.name || '').toLowerCase();
  const out = OUT[String(params.to || '')];
  if (!out) return json('Неизвестный формат результата');
  if (!IN_EXT.has(ext)) return json(`Неподдерживаемый формат файла: ${ext || 'без расширения'}`);
  if (IMAGE_IN.has(ext) && !['png', 'jpg'].includes(out.ext)) return json('Из этого формата можно получить только JPG или PNG');

  try {
    return await withSlot(() => withTmp(async (dir) => {
      const inPath = path.join(dir, `in-${randomName()}${ext}`);
      const outPath = path.join(dir, `out.${out.ext}`);
      await fs.writeFile(inPath, Buffer.from(await file.arrayBuffer()));

      let r;
      if (ext === '.heic' || ext === '.heif') {
        r = await run('heif-convert', ['-q', '92', inPath, outPath], { timeout: 120000 });
        if (r.missing) {
          // программы heif-convert нет — декодируем HEIC на JavaScript (пакет heic-convert, ставится через npm install)
          try {
            const mod = await import('heic-convert');
            const convert = mod.default || mod;
            const buf = await convert({ buffer: await fs.readFile(inPath), format: out.ext === 'png' ? 'PNG' : 'JPEG', quality: 0.92 });
            await fs.writeFile(outPath, Buffer.from(buf));
            r = { code: 0, stderr: '' };
          } catch (e) {
            console.error('heic-convert failed', e);
            return json('Не удалось прочитать HEIC-файл. Возможно, он повреждён.', 422);
          }
        } else {
          // для многокадровых файлов heif-convert добавляет суффикс — берём первый результат
          const produced = (await fs.readdir(dir)).find((n) => /^out(-\d+|_\d+)?\.(jpg|png)$/i.test(n));
          if (produced && produced !== `out.${out.ext}`) await fs.rename(path.join(dir, produced), outPath);
        }
      } else {
        r = await run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', inPath, ...out.args, outPath], { timeout: 800000 });
        if (r.missing) return json('Сервис временно недоступен. Попробуйте чуть позже.', 501);
      }
      if (r.timedOut) return json('Конвертация заняла слишком много времени. Попробуйте файл поменьше.', 504);

      let exists = true;
      await fs.access(outPath).catch(() => { exists = false; });
      if (r.code !== 0 || !exists) {
        console.error('media convert failed', ext, '->', out.ext, r.stderr);
        if (/does not contain any stream|Output file does not contain|Stream map|no audio/i.test(r.stderr || '')) return json('В файле нет звуковой дорожки.', 422);
        return json('Не удалось конвертировать файл. Возможно, он повреждён или формат не поддерживается.', 422);
      }
      const base = path.basename(file.name, ext) || 'result';
      return fileResponse(await fs.readFile(outPath), `${base}.${out.ext}`, out.mime);
    }));
  } catch (e) {
    console.error(e);
    return json('Внутренняя ошибка сервера', 500);
  }
}
