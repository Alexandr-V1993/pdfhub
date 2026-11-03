import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { existsSync, readdirSync } from 'node:fs';

export const MAX_UPLOAD = (Number(process.env.MAX_UPLOAD_MB) || 50) * 1024 * 1024;
const MAX_JOBS = Number(process.env.MAX_CONCURRENT_JOBS) || 2;

let running = 0;
const queue = [];
export async function withSlot(fn) {
  if (running >= MAX_JOBS) await new Promise((res) => queue.push(res));
  running++;
  try { return await fn(); } finally {
    running--;
    const next = queue.shift();
    if (next) next();
  }
}

export async function withTmp(fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pdfstudio-'));
  try { return await fn(dir); } finally { await fs.rm(dir, { recursive: true, force: true }).catch(() => {}); }
}

// Поиск внешних программ: переменные окружения, PATH, типичные пути Windows
function programDirs() {
  const out = [];
  for (const base of [process.env['ProgramFiles'], process.env['ProgramFiles(x86)'], 'C:\\Program Files', 'C:\\Program Files (x86)']) {
    if (base && !out.includes(base)) out.push(base);
  }
  return out;
}
function winCandidates(name) {
  const res = [];
  for (const base of programDirs()) {
    if (name === 'ffmpeg') res.push(`${base}\\ffmpeg\\bin\\ffmpeg.exe`);
    if (name === 'pandoc') res.push(`${base}\\Pandoc\\pandoc.exe`);
    if (name === 'soffice') res.push(`${base}\\LibreOffice\\program\\soffice.exe`);
    try {
      const prefix = name === 'qpdf' ? 'qpdf' : name === 'gs' ? 'gs' : null;
      if (prefix && existsSync(base)) {
        for (const d of readdirSync(base)) {
          if (!d.toLowerCase().startsWith(prefix)) continue;
          if (name === 'qpdf') res.push(`${base}\\${d}\\bin\\qpdf.exe`);
          else for (const v of readdirSync(`${base}\\${d}`)) res.push(`${base}\\${d}\\${v}\\bin\\gswin64c.exe`);
        }
      }
    } catch { /* ignore */ }
  }
  return res;
}
const ENV_NAMES = { soffice: 'SOFFICE_PATH', qpdf: 'QPDF_PATH', gs: 'GS_PATH', ffmpeg: 'FFMPEG_PATH', 'heif-convert': 'HEIF_CONVERT_PATH', pandoc: 'PANDOC_PATH' };
const resolved = {};
export async function resolveBinary(name) {
  if (!ENV_NAMES[name]) return name;
  if (name in resolved) return resolved[name];
  const list = [process.env[ENV_NAMES[name]], name, ...(name === 'gs' ? ['gswin64c', 'gswin32c'] : []), ...(process.platform === 'win32' ? winCandidates(name) : [])].filter(Boolean);
  for (const c of list) {
    if (path.isAbsolute(c)) { if (existsSync(c)) return (resolved[name] = c); continue; }
    const r = await new Promise((res) => execFile(c, ['-version'], { timeout: 20000, windowsHide: true }, (e) => res(!(e && e.code === 'ENOENT'))));
    if (r) return (resolved[name] = c);
  }
  // ffmpeg, который ставится вместе с сайтом (npm install): отдельная установка не нужна
  if (name === 'ffmpeg') {
    try {
      const mod = await import('@ffmpeg-installer/ffmpeg');
      const p = (mod.default && mod.default.path) || mod.path;
      if (p && existsSync(p)) return (resolved[name] = p);
    } catch { /* пакет не установлен */ }
  }
  return (resolved[name] = null);
}

export async function run(cmd, args, { timeout = 120000, cwd } = {}) {
  const bin = await resolveBinary(cmd);
  if (!bin) return { code: 127, stdout: '', stderr: `${cmd} not found`, timedOut: false, missing: true };
  return new Promise((resolve) => {
    execFile(bin, args, { timeout, cwd, maxBuffer: 20 * 1024 * 1024, windowsHide: true }, (error, stdout, stderr) => {
      resolve({ code: error ? (typeof error.code === 'number' ? error.code : 1) : 0, stdout, stderr, timedOut: !!(error && error.killed), missing: !!(error && error.code === 'ENOENT') });
    });
  });
}

export async function hasBinary(name) {
  return !!(await resolveBinary(name));
}

export const randomName = () => crypto.randomBytes(6).toString('hex');

export function json(error, status = 400) {
  return Response.json({ error }, { status });
}

export function fileResponse(buf, name, mime) {
  return new Response(buf, {
    headers: {
      'Content-Type': mime || 'application/octet-stream',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
      'X-Filename': encodeURIComponent(name),
      'Cache-Control': 'no-store',
    },
  });
}

export async function readUpload(req, max = MAX_UPLOAD) {
  let form;
  try { form = await req.formData(); } catch { throw new Error('Не удалось прочитать загруженный файл'); }
  const file = form.get('file');
  if (!file || typeof file === 'string') throw new Error('Файл не передан');
  if (file.size > max) throw new Error(`Файл слишком большой (максимум ${Math.round(max / 1048576)} МБ)`);
  let params = {};
  try { params = JSON.parse(form.get('params') || '{}'); } catch {}
  return { file, params };
}
