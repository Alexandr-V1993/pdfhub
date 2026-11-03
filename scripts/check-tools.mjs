// Предупреждает при запуске, если на машине нет программ для серверных инструментов.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
const win = process.platform === 'win32';
const has = (cmds) => cmds.some((c) => {
  if (c && (c.includes('\\') || c.includes('/'))) return fs.existsSync(c);
  try { execFileSync(c, ['--version'], { stdio: 'ignore', timeout: 20000 }); return true; } catch (e) { return e.code !== 'ENOENT' && !!e.status !== undefined && e.code !== 'ENOENT' ? true : false; }
});
const pf = [process.env.ProgramFiles, process.env['ProgramFiles(x86)']].filter(Boolean);
const checks = [
  ['LibreOffice', [process.env.SOFFICE_PATH, 'soffice', ...pf.map((p) => `${p}\\LibreOffice\\program\\soffice.exe`)]],
  ['qpdf', [process.env.QPDF_PATH, 'qpdf', ...pf.flatMap((p) => { try { return fs.readdirSync(p).filter((d) => /^qpdf/i.test(d)).map((d) => `${p}\\${d}\\bin\\qpdf.exe`); } catch { return []; } })]],
  ['Ghostscript', [process.env.GS_PATH, 'gs', 'gswin64c']],
];
const missing = checks.filter(([, c]) => !has(c.filter(Boolean))).map(([n]) => n);
if (missing.length) {
  console.warn(`\n⚠ Не найдены программы: ${missing.join(', ')}. Часть инструментов (Word/PowerPoint/Excel → PDF, PDF → Word/PDF/A, пароли) не будет работать как нужно.`);
  console.warn(win ? '  Запустите setup-windows.ps1 или используйте Docker (docker compose up -d --build).\n' : '  Выполните: sudo bash setup-linux.sh или используйте Docker (docker compose up -d --build).\n');
}
