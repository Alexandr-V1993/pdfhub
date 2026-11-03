import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileResponse, json, randomName, readUpload, run, withSlot, withTmp } from '@/lib/server/run';

export const runtime = 'nodejs';
export const maxDuration = 180;

const IN_EXT = {
  pdf: ['.pdf'],
  'pdf-html': ['.html', '.htm'],
  docx: ['.pdf'], pptx: ['.pdf'], pdfa: ['.pdf'],
  'epub-pdf': ['.epub'],
};
const PDF_SOURCES = ['.doc', '.docx', '.odt', '.rtf', '.txt', '.ppt', '.pptx', '.odp', '.xls', '.xlsx', '.ods', '.csv'];

const MIME = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

// target -> аргументы LibreOffice
function loArgs(target) {
  switch (target) {
    case 'pdf': return { out: 'pdf', args: ['--convert-to', 'pdf'] };
    case 'epub-pdf': return { out: 'pdf', args: ['--convert-to', 'pdf:writer_web_pdf_Export'] };
    case 'pdf-html': return { out: 'pdf', args: ['--convert-to', 'pdf:writer_web_pdf_Export'] };
    case 'docx': return { out: 'docx', args: ['--infilter=writer_pdf_import', '--convert-to', 'docx:MS Word 2007 XML'] };
    case 'pptx': return { out: 'pptx', args: ['--infilter=impress_pdf_import', '--convert-to', 'pptx:Impress MS PowerPoint 2007 XML'] };
    case 'pdfa': return { out: 'pdf', args: ['--convert-to', 'pdf:draw_pdf_Export:{"SelectPdfVersion":{"type":"long","value":"2"}}'] };
    default: return null;
  }
}

// Минимальный разбор EPUB: порядок глав из OPF (spine), текст и разметка глав склеиваются в один HTML
async function epubToHtml(buf) {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(buf);
  const container = await zip.file('META-INF/container.xml').async('string');
  const opfPath = (container.match(/full-path="([^"]+)"/) || [])[1];
  if (!opfPath) throw new Error('no opf');
  const opf = await zip.file(opfPath).async('string');
  const dir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
  const manifest = {};
  for (const m of opf.matchAll(/<item\b[^>]*>/g)) {
    const id = (m[0].match(/\bid="([^"]+)"/) || [])[1];
    const href = (m[0].match(/\bhref="([^"]+)"/) || [])[1];
    if (id && href) manifest[id] = decodeURIComponent(href);
  }
  const title = ((opf.match(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/) || [])[1] || '').trim();
  let body = title ? `<h1>${title}</h1>` : '';
  for (const m of opf.matchAll(/<itemref\b[^>]*idref="([^"]+)"/g)) {
    const href = manifest[m[1]];
    const f = href && zip.file(dir + href);
    if (!f) continue;
    const html = await f.async('string');
    const inner = (html.match(/<body[^>]*>([\s\S]*?)<\/body>/i) || [null, html])[1];
    body += inner.replace(/<img\b[^>]*>/gi, '').replace(/<script[\s\S]*?<\/script>/gi, '');
  }
  if (!body.trim()) throw new Error('empty');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body>${body}</body></html>`;
}

export async function POST(req) {
  let up;
  try { up = await readUpload(req); } catch (e) { return json(e.message); }
  const { file, params } = up;
  const target = String(params.target || 'pdf');
  const cfg = loArgs(target);
  if (!cfg) return json('Неизвестный тип конвертации');

  const ext = path.extname(file.name || '').toLowerCase();
  const allowed = target === 'pdf' ? PDF_SOURCES : IN_EXT[target];
  if (!allowed.includes(ext)) return json(`Неподходящий формат файла: ${ext || 'без расширения'}`);

  try {
    return await withSlot(() => withTmp(async (dir) => {
      const inName = `in-${randomName()}${ext}`;
      const inPath = path.join(dir, inName);
      const outDir = path.join(dir, 'out');
      const profile = path.join(dir, 'profile');
      await fs.mkdir(outDir);
      await fs.writeFile(inPath, Buffer.from(await file.arrayBuffer()));

      let srcPath = inPath;
      if (target === 'epub-pdf') {
        // EPUB -> HTML (pandoc), затем HTML -> PDF (LibreOffice)
        const htmlPath = path.join(dir, 'book.html');
        const p = await run('pandoc', [inPath, '-f', 'epub', '-t', 'html5', '-s', '--extract-media=media', '-o', htmlPath], { cwd: dir, timeout: 90000 });
        if (p.missing) {
          // pandoc не установлен — разбираем EPUB сами (архив с XHTML-главами)
          try { await fs.writeFile(htmlPath, await epubToHtml(await fs.readFile(inPath))); } catch (e) {
            console.error('epub parse failed', e);
            return json('Не удалось прочитать EPUB. Возможно, файл повреждён или защищён.', 422);
          }
        } else if (p.code !== 0) { console.error('pandoc failed', p.stderr); return json('Не удалось прочитать EPUB. Возможно, файл повреждён или защищён.', 422); }
        srcPath = htmlPath;
      }
      const r = await run('soffice', [
        '--headless', '--norestore', '--nologo', '--nodefault', '--nolockcheck',
        `-env:UserInstallation=${pathToFileURL(profile).href}`,
        ...cfg.args, '--outdir', outDir, srcPath,
      ], { timeout: 150000 });

      if (r.missing) return json('Сервис временно недоступен. Попробуйте чуть позже.', 501);
      if (r.timedOut) return json('Конвертация заняла слишком много времени. Попробуйте файл поменьше.', 504);

      const produced = (await fs.readdir(outDir)).find((n) => n.toLowerCase().endsWith(`.${cfg.out}`));
      if (!produced) {
        console.error('soffice failed', r.code, r.stderr);
        return json('Не удалось конвертировать файл. Возможно, он повреждён или защищён паролем.', 422);
      }
      const buf = await fs.readFile(path.join(outDir, produced));
      const base = path.basename(file.name, ext) || 'result';
      const suffix = target === 'pdfa' ? '_pdfa' : '';
      return fileResponse(buf, `${base}${suffix}.${cfg.out}`, MIME[cfg.out]);
    }));
  } catch (e) {
    console.error(e);
    return json('Внутренняя ошибка сервера', 500);
  }
}
