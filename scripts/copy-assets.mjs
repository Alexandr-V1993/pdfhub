import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const src = path.join(root, 'node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs');
const dst = path.join(root, 'public/pdf.worker.min.mjs');
if (fs.existsSync(src)) { fs.copyFileSync(src, dst); console.log('pdf.js worker copied'); }
else console.warn('pdf.js worker not found, skipping');
