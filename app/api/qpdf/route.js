import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileResponse, hasBinary, json, readUpload, run, withSlot, withTmp } from '@/lib/server/run';

export const runtime = 'nodejs';
export const maxDuration = 120;

// qpdf возвращает 3, если файл открыт с предупреждениями — результат при этом корректен
const okCode = (c) => c === 0 || c === 3;

export async function POST(req) {
  let up;
  try { up = await readUpload(req); } catch (e) { return json(e.message); }
  const { file, params } = up;
  if (!/\.pdf$/i.test(file.name || '')) return json('Нужен файл PDF');
  const op = String(params.op || '');
  const base = path.basename(file.name, path.extname(file.name)) || 'document';

  try {
    return await withSlot(() => withTmp(async (dir) => {
      const inPath = path.join(dir, 'in.pdf');
      const outPath = path.join(dir, 'out.pdf');
      await fs.writeFile(inPath, Buffer.from(await file.arrayBuffer()));

      let r; let suffix;
      if (op === 'unlock') {
        const pw = String(params.password || '');
        r = await run('qpdf', [`--password=${pw}`, '--decrypt', inPath, outPath]);
        suffix = '_unlocked';
        if (r.missing) return json('Сервис временно недоступен. Попробуйте чуть позже.', 501);
        if (r.code === 2 && /password/i.test(r.stderr)) return json('Неверный пароль или файл требует пароль для открытия.', 422);
      } else if (op === 'protect') {
        const pw = String(params.password || '');
        if (!pw) return json('Укажите пароль');
        const owner = crypto.randomBytes(12).toString('hex');
        const args = ['--encrypt', pw, owner, '256'];
        if (params.noPrint) args.push('--print=none');
        if (params.noCopy) args.push('--extract=n');
        if (params.noModify) args.push('--modify=none', '--annotate=n', '--assemble=n', '--form=n');
        args.push('--', inPath, outPath);
        r = await run('qpdf', args);
        suffix = '_protected';
        if (r.missing) return json('Сервис временно недоступен. Попробуйте чуть позже.', 501);
      } else if (op === 'repair') {
        r = await run('qpdf', [inPath, outPath]);
        suffix = '_repaired';
        if (r.missing) return json('Сервис временно недоступен. Попробуйте чуть позже.', 501);
      } else if (op === 'compress') {
        suffix = '_compressed';
        const gs = await hasBinary('gs');
        if (gs) {
          r = await run('gs', ['-sDEVICE=pdfwrite', '-dCompatibilityLevel=1.5', '-dPDFSETTINGS=/ebook', '-dNOPAUSE', '-dQUIET', '-dBATCH', `-sOutputFile=${outPath}`, inPath], { timeout: 110000 });
        } else {
          r = await run('qpdf', ['--object-streams=generate', '--recompress-flate', '--compression-level=9', '--remove-unreferenced-resources=yes', inPath, outPath]);
          if (r.missing) return json('Сервис временно недоступен. Попробуйте чуть позже.', 501);
        }
      } else {
        return json('Неизвестная операция');
      }

      if (r.timedOut) return json('Обработка заняла слишком много времени', 504);
      let exists = true;
      await fs.access(outPath).catch(() => { exists = false; });
      if (!okCode(r.code) || !exists) {
        console.error('qpdf failed', op, r.code, r.stderr);
        return json(op === 'repair' ? 'Не удалось восстановить файл — он повреждён слишком сильно.' : 'Не удалось обработать файл. Возможно, он повреждён или защищён паролем.', 422);
      }
      return fileResponse(await fs.readFile(outPath), `${base}${suffix}.pdf`, 'application/pdf');
    }));
  } catch (e) {
    console.error(e);
    return json('Внутренняя ошибка сервера', 500);
  }
}
