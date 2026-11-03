'use client';
import { useState } from 'react';
import { Copy } from 'lucide-react';
import { LANGUAGES } from '@/lib/tools';
import { baseName, friendlyError, formatBytes } from '@/lib/util';
import Results from './Results';
import ProgressPanel from './ProgressPanel';

export default function AiTool({ tool, file, onReset }) {
  const action = tool.action; // summarize | translate
  const [length, setLength] = useState('medium');
  const [lang, setLang] = useState(action === 'translate' ? 'en' : 'ru');
  const [busy, setBusy] = useState(false);
  const [prog, setProg] = useState({ v: 0, t: '' });
  const [error, setError] = useState('');
  const [summary, setSummary] = useState('');
  const [outputs, setOutputs] = useState(null);

  const run = async () => {
    setBusy(true); setError(''); setSummary('');
    try {
      const { loadPdfjsDoc, extractPagesText } = await import('@/lib/pdfjs');
      const { postJson } = await import('@/lib/client-api');
      setProg({ v: 0.02, t: 'Извлекаю текст…' });
      const doc = await loadPdfjsDoc(file);
      const pages = await extractPagesText(doc, (v) => setProg({ v: v * 0.2, t: 'Извлекаю текст…' }));
      const full = pages.join('\n\n').trim();
      if (full.length < 20) throw new Error('В документе нет текстового слоя. Если это скан — сначала примените «OCR PDF».');

      // разбиваем на куски по границам абзацев
      const chunks = [];
      let cur = '';
      const limit = action === 'translate' ? 5000 : 14000;
      for (const para of full.split(/\n{2,}/)) {
        if (cur.length + para.length > limit && cur) { chunks.push(cur); cur = ''; }
        if (para.length > limit) {
          for (let i = 0; i < para.length; i += limit) chunks.push(para.slice(i, i + limit));
        } else cur += (cur ? '\n\n' : '') + para;
      }
      if (cur) chunks.push(cur);
      if (chunks.length > 60) throw new Error('Документ слишком большой для обработки. Разделите его на части.');

      const results = [];
      for (let i = 0; i < chunks.length; i++) {
        setProg({ v: 0.2 + (0.8 * i) / chunks.length, t: `Обрабатываю часть ${i + 1} из ${chunks.length}…` });
        const r = await postJson('/api/ai', { action, text: chunks[i], lang, length });
        results.push(r.result);
      }

      if (action === 'summarize') {
        let text = results.join('\n\n');
        if (chunks.length > 1) {
          setProg({ v: 0.95, t: 'Собираю итоговое резюме…' });
          text = (await postJson('/api/ai', { action: 'summarize', text, lang, length, final: true })).result;
        }
        setSummary(text);
      } else {
        const text = results.join('\n\n');
        const { PDFDocument } = await import('pdf-lib');
        const { embedFonts } = await import('@/lib/fonts');
        const out = await PDFDocument.create();
        const { regular } = await embedFonts(out);
        const size = 11; const margin = 56; const W = 595.28; const H = 841.89; const lh = size * 1.45;
        let page = out.addPage([W, H]); let y = H - margin;
        const wrap = (line) => {
          const words = line.split(/\s+/); const lines = []; let l = '';
          for (const w of words) {
            const t = l ? `${l} ${w}` : w;
            if (regular.widthOfTextAtSize(t, size) > W - 2 * margin && l) { lines.push(l); l = w; } else l = t;
          }
          lines.push(l);
          return lines;
        };
        for (const para of text.split('\n')) {
          for (const line of (para.trim() ? wrap(para) : [''])) {
            if (y < margin) { page = out.addPage([W, H]); y = H - margin; }
            if (line) {
              try { page.drawText(line, { x: margin, y, size, font: regular }); }
              catch { page.drawText(line.replace(/[^\u0000-ӿ]/g, '?'), { x: margin, y, size, font: regular }); }
            }
            y -= lh;
          }
        }
        const base = baseName(file.name);
        setOutputs([
          { name: `${base}_${lang}.pdf`, blob: new Blob([await out.save()], { type: 'application/pdf' }), note: 'Текст без исходной вёрстки' },
          { name: `${base}_${lang}.txt`, blob: new Blob([text], { type: 'text/plain;charset=utf-8' }) },
        ]);
      }
      setProg({ v: 1, t: 'Готово' });
    } catch (e) {
      console.error(e);
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  if (outputs) return <Results outputs={outputs} onReset={onReset} />;

  return (
    <div className="panel">
      {error && <div className="error">{error}</div>}
      <div className="file" style={{ marginBottom: 16 }}>
        <span className="file__name">{file.name}</span><span className="file__size">{formatBytes(file.size)}</span>
      </div>
      {action === 'summarize' ? (
        <div className="two">
          <div className="field"><label>Подробность</label>
            <select value={length} onChange={(e) => setLength(e.target.value)} disabled={busy}>
              <option value="short">Коротко (3–5 пунктов)</option>
              <option value="medium">Средне</option>
              <option value="long">Подробно</option>
            </select>
          </div>
          <div className="field"><label>Язык резюме</label>
            <select value={lang} onChange={(e) => setLang(e.target.value)} disabled={busy}>
              {LANGUAGES.map((l) => <option key={l.v} value={l.v}>{l.l}</option>)}
            </select>
          </div>
        </div>
      ) : (
        <div className="field"><label>Перевести на</label>
          <select value={lang} onChange={(e) => setLang(e.target.value)} disabled={busy}>
            {LANGUAGES.map((l) => <option key={l.v} value={l.v}>{l.l}</option>)}
          </select>
        </div>
      )}
      <div className="note" style={{ marginTop: 0 }}>
        Текст документа (не сам файл) отправляется на сервер и в сервис обработки текста. Не используйте инструмент для данных, которые нельзя передавать третьим сторонам.
      </div>
      {busy && (
        <ProgressPanel value={prog.v} text={prog.t} />
      )}
      {summary && (
        <>
          <h3 style={{ margin: '20px 0 10px' }}>Резюме</h3>
          <div className="summary">{summary}</div>
          <div className="actions">
            <button className="btn btn--ghost" onClick={() => navigator.clipboard.writeText(summary)}><Copy size={15} /> Скопировать</button>
          </div>
        </>
      )}
      <div className="actions">
        <button className="btn" onClick={run} disabled={busy}>
          {busy ? 'Обрабатываю…' : action === 'summarize' ? (summary ? 'Сделать заново' : 'Сделать резюме') : 'Перевести'}
        </button>
        <button className="btn btn--ghost" onClick={onReset}>Другой файл</button>
      </div>
    </div>
  );
}
