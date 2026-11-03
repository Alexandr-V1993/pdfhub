'use client';
import { useEffect, useRef, useState } from 'react';
import { diffWordsWithSpace } from 'diff';
import { friendlyError } from '@/lib/util';
import FileDrop from './FileDrop';

export default function CompareTool({ tool, onReset }) {
  const [a, setA] = useState(null);
  const [b, setB] = useState(null);
  const [tab, setTab] = useState('text');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [res, setRes] = useState(null); // { parts, pagesA, pagesB, same }
  const [pageNo, setPageNo] = useState(1);
  const [docs, setDocs] = useState(null);
  const canvasRef = useRef(null);
  const [visInfo, setVisInfo] = useState('');

  const run = async () => {
    setBusy(true); setError('');
    try {
      const { loadPdfjsDoc, extractPagesText } = await import('@/lib/pdfjs');
      const [da, db] = await Promise.all([loadPdfjsDoc(a), loadPdfjsDoc(b)]);
      const [ta, tb] = await Promise.all([extractPagesText(da), extractPagesText(db)]);
      const parts = diffWordsWithSpace(ta.join('\n\n'), tb.join('\n\n'));
      const changed = parts.filter((p) => p.added || p.removed).length;
      setRes({ parts, pagesA: da.numPages, pagesB: db.numPages, same: changed === 0 });
      setDocs({ da, db });
      setPageNo(1);
    } catch (e) {
      console.error(e);
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  /* визуальное сравнение выбранной страницы */
  useEffect(() => {
    if (tab !== 'visual' || !docs) return undefined;
    let dead = false;
    (async () => {
      const { renderPageToCanvas } = await import('@/lib/pdfjs');
      const max = Math.min(docs.da.numPages, docs.db.numPages);
      if (pageNo > max) { setVisInfo(`На странице ${pageNo} нет пары: в одном из документов меньше страниц.`); return; }
      const [ca, cb] = await Promise.all([renderPageToCanvas(docs.da, pageNo, 1.2), renderPageToCanvas(docs.db, pageNo, 1.2)]);
      if (dead) return;
      const w = Math.max(ca.width, cb.width);
      const h = Math.max(ca.height, cb.height);
      const out = canvasRef.current;
      out.width = w; out.height = h;
      const g = out.getContext('2d');
      const get = (c) => {
        const t = document.createElement('canvas'); t.width = w; t.height = h;
        const tg = t.getContext('2d'); tg.fillStyle = '#fff'; tg.fillRect(0, 0, w, h); tg.drawImage(c, 0, 0);
        return tg.getImageData(0, 0, w, h);
      };
      const ia = get(ca); const ib = get(cb);
      const o = g.createImageData(w, h);
      let diff = 0;
      for (let i = 0; i < o.data.length; i += 4) {
        const da = Math.abs(ia.data[i] - ib.data[i]) + Math.abs(ia.data[i + 1] - ib.data[i + 1]) + Math.abs(ia.data[i + 2] - ib.data[i + 2]);
        if (da > 60) {
          diff++;
          o.data[i] = 229; o.data[i + 1] = 50; o.data[i + 2] = 45; o.data[i + 3] = 255;
        } else {
          const gray = 255 - (255 - (ia.data[i] + ia.data[i + 1] + ia.data[i + 2]) / 3) * 0.35;
          o.data[i] = o.data[i + 1] = o.data[i + 2] = gray; o.data[i + 3] = 255;
        }
      }
      g.putImageData(o, 0, 0);
      setVisInfo(diff === 0 ? 'Страницы визуально совпадают.' : `Отличающихся пикселей: ${diff.toLocaleString('ru-RU')} (красным).`);
    })().catch((e) => { console.error(e); setVisInfo('Не удалось сравнить страницу.'); });
    return () => { dead = true; };
  }, [tab, docs, pageNo]);

  return (
    <div className="panel">
      {error && <div className="error">{error}</div>}
      {!res && (
        <>
          <div className="two">
            <div>
              <h3 style={{ marginBottom: 8 }}>Исходная версия</h3>
              {a ? <div className="file"><span className="file__name">{a.name}</span><button className="btn btn--sm btn--ghost" onClick={() => setA(null)}>Убрать</button></div>
                : <FileDrop compact accept=".pdf" onFiles={(l) => setA(l[0])} label="Выбрать файл" />}
            </div>
            <div>
              <h3 style={{ marginBottom: 8 }}>Новая версия</h3>
              {b ? <div className="file"><span className="file__name">{b.name}</span><button className="btn btn--sm btn--ghost" onClick={() => setB(null)}>Убрать</button></div>
                : <FileDrop compact accept=".pdf" onFiles={(l) => setB(l[0])} label="Выбрать файл" />}
            </div>
          </div>
          <div className="actions">
            <button className="btn" disabled={!a || !b || busy} onClick={run}>{busy ? 'Сравниваю…' : 'Сравнить'}</button>
          </div>
        </>
      )}

      {res && (
        <>
          <div className="tabs">
            <button className={`btn btn--sm btn--ghost${tab === 'text' ? ' btn--active' : ''}`} onClick={() => setTab('text')}>Текст</button>
            <button className={`btn btn--sm btn--ghost${tab === 'visual' ? ' btn--active' : ''}`} onClick={() => setTab('visual')}>Визуально</button>
            <span className="muted" style={{ alignSelf: 'center', marginLeft: 8 }}>Страниц: {res.pagesA} → {res.pagesB}</span>
            <button className="btn btn--sm btn--ghost" style={{ marginLeft: 'auto' }} onClick={onReset}>Сравнить другие файлы</button>
          </div>
          {tab === 'text' && (
            <>
              <p className="muted" style={{ marginTop: 0 }}>
                {res.same ? 'Текст в документах совпадает.' : <><span style={{ background: '#d8f5e1', padding: '0 4px' }}>добавлено</span> и <span style={{ background: '#ffe0de', padding: '0 4px', textDecoration: 'line-through' }}>удалено</span> относительно исходной версии.</>}
              </p>
              <div className="diff">
                {res.parts.map((p, i) => (
                  <span key={i} className={p.added ? 'add' : p.removed ? 'del' : ''}>{p.value}</span>
                ))}
              </div>
            </>
          )}
          {tab === 'visual' && (
            <div className="visual-diff">
              <div className="pager">
                <button className="iconbtn" disabled={pageNo <= 1} onClick={() => setPageNo(pageNo - 1)}>‹</button>
                <span>Страница {pageNo} из {Math.max(res.pagesA, res.pagesB)}</span>
                <button className="iconbtn" disabled={pageNo >= Math.max(res.pagesA, res.pagesB)} onClick={() => setPageNo(pageNo + 1)}>›</button>
              </div>
              <p className="muted center">{visInfo}</p>
              <div className="center"><canvas ref={canvasRef} /></div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
