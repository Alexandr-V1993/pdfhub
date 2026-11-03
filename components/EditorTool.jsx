'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft, ChevronRight, ImagePlus, MousePointer2, Pencil, PenLine, Square, Trash2, Type, Undo2,
} from 'lucide-react';
import { loadPdfjsDoc } from '@/lib/pdfjs';
import { baseName, friendlyError, uid } from '@/lib/util';
import Results from './Results';
import SignatureModal from './SignatureModal';

const MAX_W = 820;

function fileToImageItem(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Не удалось прочитать изображение'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Не удалось открыть изображение'));
      img.onload = () => {
        let dataUrl = reader.result;
        if (!/^data:image\/(png|jpeg)/.test(dataUrl)) {
          const c = document.createElement('canvas');
          c.width = img.naturalWidth; c.height = img.naturalHeight;
          c.getContext('2d').drawImage(img, 0, 0);
          dataUrl = c.toDataURL('image/png');
        }
        resolve({ dataUrl, aspect: img.naturalHeight / img.naturalWidth });
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function EditorTool({ tool, file, onReset }) {
  const mode = tool.mode; // edit | sign | redact | crop
  const [doc, setDoc] = useState(null);
  const [pageNo, setPageNo] = useState(0);
  const [nat, setNat] = useState(null);
  const [boxW, setBoxW] = useState(MAX_W);
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [focusId, setFocusId] = useState(null);
  const [active, setActive] = useState(mode === 'redact' || mode === 'crop' ? 'rect' : mode === 'sign' ? 'select' : 'text');
  const [color, setColor] = useState(mode === 'redact' ? '#000000' : mode === 'edit' ? '#d62828' : '#111111');
  const [textSize, setTextSize] = useState(18);
  const [penWidth, setPenWidth] = useState(3);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [outputs, setOutputs] = useState(null);
  const [sigOpen, setSigOpen] = useState(false);
  const [signatures, setSignatures] = useState([]);
  const [cropAll, setCropAll] = useState(true);
  const [query, setQuery] = useState('');
  const [searchInfo, setSearchInfo] = useState('');

  const canvasRef = useRef(null);
  const boxRef = useRef(null);
  const overlayRef = useRef(null);
  const taskRef = useRef(null);
  const drawRef = useRef(null);
  const dragRef = useRef(null);
  const imgInputRef = useRef(null);

  /* загрузка документа */
  useEffect(() => {
    let dead = false;
    loadPdfjsDoc(file).then((d) => { if (!dead) setDoc(d); }).catch((e) => { console.error(e); setError(friendlyError(e)); });
    return () => { dead = true; };
  }, [file]);

  /* рендер страницы */
  useEffect(() => {
    if (!doc) return undefined;
    let cancelled = false;
    (async () => {
      const page = await doc.getPage(pageNo + 1);
      const vp1 = page.getViewport({ scale: 1 });
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const scale = Math.min(3, (MAX_W * dpr) / vp1.width);
      const vp = page.getViewport({ scale });
      const c = canvasRef.current;
      if (!c || cancelled) return;
      c.width = Math.ceil(vp.width);
      c.height = Math.ceil(vp.height);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, c.width, c.height);
      if (taskRef.current) { try { taskRef.current.cancel(); } catch {} }
      const task = page.render({ canvasContext: ctx, viewport: vp });
      taskRef.current = task;
      try {
        await task.promise;
        if (!cancelled) setNat({ w: vp1.width, h: vp1.height });
      } catch { /* отменён */ }
    })();
    return () => { cancelled = true; };
  }, [doc, pageNo]);

  /* ширина страницы на экране -> масштаб шрифта */
  useEffect(() => {
    if (!boxRef.current) return undefined;
    const ro = new ResizeObserver(([e]) => setBoxW(e.contentRect.width));
    ro.observe(boxRef.current);
    return () => ro.disconnect();
  }, []);
  const k = nat ? boxW / nat.w : 1;

  const pageItems = useMemo(() => items.filter((i) => i.page === pageNo), [items, pageNo]);
  const selected = items.find((i) => i.id === selectedId) || null;

  const patchItem = useCallback((id, ch) => setItems((arr) => arr.map((i) => (i.id === id ? { ...i, ...ch } : i))), []);
  const removeItem = useCallback((id) => { setItems((arr) => arr.filter((i) => i.id !== id)); setSelectedId(null); }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Delete' && selectedId && document.activeElement?.tagName !== 'TEXTAREA' && document.activeElement?.tagName !== 'INPUT') {
        removeItem(selectedId);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, removeItem]);

  // пустые текстовые блоки убираем, когда пользователь выбрал что-то другое
  useEffect(() => {
    setItems((arr) => (arr.some((i) => i.type === 'text' && !i.text.trim() && i.id !== selectedId)
      ? arr.filter((i) => !(i.type === 'text' && !i.text.trim() && i.id !== selectedId)) : arr));
  }, [selectedId, active, pageNo]);

  const frac = (e) => {
    const r = overlayRef.current.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    };
  };

  /* рисование по оверлею */
  const onOverlayDown = (e) => {
    if (e.target !== overlayRef.current || !nat) return;
    const p = frac(e);
    if (active === 'text') {
      e.preventDefault();
      const id = uid();
      setItems((a) => [...a, { id, type: 'text', page: pageNo, x: p.x, y: p.y, text: '', size: textSize, color }]);
      setSelectedId(id);
      setFocusId(id);
      return;
    }
    if (active === 'rect' || active === 'pen') {
      overlayRef.current.setPointerCapture(e.pointerId);
      drawRef.current = { kind: active, x0: p.x, y0: p.y, pts: [[p.x, p.y]] };
      setDraft(active === 'rect' ? { x: p.x, y: p.y, w: 0, h: 0 } : { points: [[p.x, p.y]] });
      return;
    }
    setSelectedId(null);
  };
  const onOverlayMove = (e) => {
    const d = drawRef.current;
    if (!d) return;
    const p = frac(e);
    if (d.kind === 'rect') {
      setDraft({ x: Math.min(d.x0, p.x), y: Math.min(d.y0, p.y), w: Math.abs(p.x - d.x0), h: Math.abs(p.y - d.y0) });
    } else {
      d.pts.push([p.x, p.y]);
      setDraft({ points: [...d.pts] });
    }
  };
  const onOverlayUp = () => {
    const d = drawRef.current;
    drawRef.current = null;
    if (!d || !draft) { setDraft(null); return; }
    if (d.kind === 'rect' && draft.w > 0.004 && draft.h > 0.004) {
      const base = { id: uid(), type: 'rect', page: pageNo, x: draft.x, y: draft.y, w: draft.w, h: draft.h };
      if (mode === 'crop') {
        setItems([{ ...base, color: '#000000', opacity: 1, crop: true }]);
      } else if (mode === 'redact') {
        setItems((a) => [...a, { ...base, color: '#000000', opacity: 1 }]);
      } else {
        setItems((a) => [...a, { ...base, color, opacity: 0.85 }]);
      }
    } else if (d.kind === 'pen' && d.pts.length > 1) {
      setItems((a) => [...a, { id: uid(), type: 'pen', page: pageNo, points: d.pts, color, width: penWidth }]);
    }
    setDraft(null);
  };

  /* перетаскивание готовых элементов */
  const startDrag = (e, it) => {
    e.stopPropagation();
    setSelectedId(it.id);
    if (active !== 'select' && it.type !== 'text') return;
    const r = overlayRef.current.getBoundingClientRect();
    dragRef.current = { id: it.id, sx: e.clientX, sy: e.clientY, ox: it.x, oy: it.y, r };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const moveDrag = (e) => {
    const d = dragRef.current;
    if (!d) return;
    patchItem(d.id, {
      x: Math.min(1, Math.max(0, d.ox + (e.clientX - d.sx) / d.r.width)),
      y: Math.min(1, Math.max(0, d.oy + (e.clientY - d.sy) / d.r.height)),
    });
  };
  const endDrag = () => { dragRef.current = null; };

  /* изображения и подписи */
  const addImageItem = (img, w = 0.25) => {
    const id = uid();
    setItems((a) => [...a, { id, type: 'image', page: pageNo, x: Math.max(0, 0.5 - w / 2), y: 0.6, w, aspect: img.aspect, dataUrl: img.dataUrl }]);
    setSelectedId(id);
    setActive('select');
  };
  const onPickImage = async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try { addImageItem(await fileToImageItem(f), 0.3); } catch (err) { setError(err.message); }
  };
  const onSignature = (img) => {
    setSignatures((s) => [img, ...s].slice(0, 6));
    addImageItem(img, 0.28);
    setSigOpen(false);
  };

  /* поиск текста для скрытия */
  const doSearch = async () => {
    setSearchInfo('Ищу…');
    try {
      const { findTextRects } = await import('@/lib/redact');
      const rects = await findTextRects(file, query);
      if (!rects.length) { setSearchInfo('Ничего не найдено'); return; }
      setItems((a) => [...a, ...rects.map((r) => ({ ...r, id: uid(), type: 'rect', color: '#000000', opacity: 1 }))]);
      setSearchInfo(`Закрыто фрагментов: ${rects.length}. Проверьте результат на страницах.`);
    } catch (e) {
      setSearchInfo('');
      setError(friendlyError(e));
    }
  };

  /* экспорт */
  const apply = async () => {
    setError('');
    if (!items.length) {
      setError(mode === 'crop' ? 'Выделите область, которую нужно оставить.' : mode === 'redact' ? 'Выделите данные, которые нужно скрыть.' : 'Добавьте на страницу хотя бы один элемент.');
      return;
    }
    setBusy(true);
    try {
      let blob; let suffix;
      if (mode === 'crop') {
        const { exportCropped } = await import('@/lib/ops');
        const r = items[0];
        blob = await exportCropped(file, r, { allPages: cropAll, pageIndex: r.page });
        suffix = 'cropped';
      } else if (mode === 'redact') {
        const { exportRedacted } = await import('@/lib/redact');
        blob = await exportRedacted(file, items.filter((i) => i.type === 'rect'));
        suffix = 'redacted';
      } else {
        const { exportWithItems } = await import('@/lib/ops');
        blob = await exportWithItems(file, items.filter((i) => !(i.type === 'text' && !i.text.trim())));
        suffix = mode === 'sign' ? 'signed' : 'edited';
      }
      setOutputs([{ name: `${baseName(file.name)}_${suffix}.pdf`, blob }]);
    } catch (e) {
      console.error(e);
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  if (outputs) return <Results outputs={outputs} onReset={onReset} />;

  const toolBtn = (id, label, Icon) => (
    <button key={id} className={`btn btn--sm btn--ghost${active === id ? ' btn--active' : ''}`} onClick={() => setActive(id)}>
      <Icon size={15} /> {label}
    </button>
  );
  const cropRect = mode === 'crop' ? items.find((i) => i.crop) : null;
  const cursorClass = active === 'rect' || active === 'pen' ? 'overlay--draw' : active === 'text' ? 'overlay--text' : '';

  return (
    <div className="editor">
      <aside className="editor__side panel">
        {mode === 'edit' && (
          <>
            <div className="toolbtns">
              {toolBtn('select', 'Выбор', MousePointer2)}
              {toolBtn('text', 'Текст', Type)}
              {toolBtn('rect', 'Фигура', Square)}
              {toolBtn('pen', 'Рисунок', Pencil)}
            </div>
            <button className="btn btn--sm btn--ghost" onClick={() => imgInputRef.current.click()}><ImagePlus size={15} /> Изображение</button>
            <input ref={imgInputRef} type="file" accept="image/*" className="sr-only" onChange={onPickImage} />
          </>
        )}
        {mode === 'sign' && (
          <>
            <button className="btn" onClick={() => setSigOpen(true)}><PenLine size={16} /> Создать подпись</button>
            {signatures.length > 0 && (
              <div className="muted" style={{ fontSize: 13 }}>Ранее созданные — нажмите, чтобы добавить:</div>
            )}
            {signatures.map((s, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={s.dataUrl} alt="Подпись" style={{ maxWidth: '100%', border: '1px solid #e3e6ee', borderRadius: 8, cursor: 'pointer', background: '#fff' }} onClick={() => addImageItem(s, 0.28)} />
            ))}
            <div className="toolbtns">
              {toolBtn('select', 'Выбор', MousePointer2)}
              {toolBtn('text', 'Текст', Type)}
            </div>
            <div className="muted" style={{ fontSize: 12 }}>Текст — для ФИО и даты рядом с подписью.</div>
          </>
        )}
        {mode === 'redact' && (
          <>
            <div className="muted" style={{ fontSize: 13 }}>Выделяйте мышью области, которые нужно скрыть. Или найдите текст по всему документу:</div>
            <input className="field" style={{ padding: 9, border: '1px solid #cfd5e3', borderRadius: 9 }} placeholder="Например: 1234 567890" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && doSearch()} />
            <button className="btn btn--sm btn--dark" onClick={doSearch} disabled={!query.trim()}>Найти и закрыть</button>
            {searchInfo && <div className="muted" style={{ fontSize: 12 }}>{searchInfo}</div>}
            <div className="note" style={{ margin: 0 }}>Страницы с чёрными блоками превращаются в изображения — скрытый текст удаляется из файла безвозвратно.</div>
          </>
        )}
        {mode === 'crop' && (
          <>
            <div className="muted" style={{ fontSize: 13 }}>Выделите мышью область, которую нужно оставить.</div>
            <label className="check"><input type="checkbox" checked={cropAll} onChange={(e) => setCropAll(e.target.checked)} /> Применить ко всем страницам</label>
          </>
        )}

        {(mode === 'edit' || (mode === 'sign' && active === 'text')) && (
          <div>
            <div className="field">
              <label>Цвет</label>
              <input type="color" value={selected && selected.color ? selected.color : color} onChange={(e) => { setColor(e.target.value); if (selected && selected.color) patchItem(selected.id, { color: e.target.value }); }} />
            </div>
            {(active === 'text' || selected?.type === 'text') && (
              <div className="field">
                <label>Размер текста, pt</label>
                <input type="number" min={6} max={120} value={selected?.type === 'text' ? selected.size : textSize} onChange={(e) => { const v = Number(e.target.value) || 12; setTextSize(v); if (selected?.type === 'text') patchItem(selected.id, { size: v }); }} />
              </div>
            )}
            {active === 'pen' && (
              <div className="field">
                <label>Толщина линии</label>
                <input type="range" min={1} max={12} value={penWidth} onChange={(e) => setPenWidth(Number(e.target.value))} />
              </div>
            )}
          </div>
        )}

        {selected?.type === 'image' && (
          <div className="field">
            <label>Размер изображения</label>
            <input type="range" min={0.05} max={0.9} step={0.01} value={selected.w} onChange={(e) => patchItem(selected.id, { w: Number(e.target.value) })} />
          </div>
        )}

        <div className="toolbtns">
          <button className="btn btn--sm btn--ghost" disabled={!items.length} onClick={() => setItems((a) => a.slice(0, -1))}><Undo2 size={15} /> Отменить</button>
          <button className="btn btn--sm btn--ghost" disabled={!selectedId} onClick={() => selectedId && removeItem(selectedId)}><Trash2 size={15} /> Удалить</button>
        </div>

        {error && <div className="error" style={{ margin: 0 }}>{error}</div>}
        <button className="btn btn--green" onClick={apply} disabled={busy || !doc}>
          {busy ? 'Обрабатываю…' : mode === 'crop' ? 'Обрезать PDF' : mode === 'redact' ? 'Скрыть и сохранить' : mode === 'sign' ? 'Подписать PDF' : 'Сохранить PDF'}
        </button>
        <button className="btn btn--ghost" onClick={onReset}>Отмена</button>
      </aside>

      <section>
        {doc && (
          <div className="pager">
            <button className="iconbtn" disabled={pageNo === 0} onClick={() => { setPageNo(pageNo - 1); setSelectedId(null); }}><ChevronLeft size={16} /></button>
            <span>Страница {pageNo + 1} из {doc.numPages}</span>
            <button className="iconbtn" disabled={pageNo >= doc.numPages - 1} onClick={() => { setPageNo(pageNo + 1); setSelectedId(null); }}><ChevronRight size={16} /></button>
          </div>
        )}
        <div className="stage">
          {!doc && !error && <p className="center muted">Загружаю документ…</p>}
          <div className="pagebox" ref={boxRef} style={{ display: doc ? 'block' : 'none' }}>
            <canvas ref={canvasRef} />
            <div
              ref={overlayRef}
              className={`overlay ${cursorClass}`}
              onPointerDown={onOverlayDown}
              onMouseDown={(e) => { if (active === 'text' && e.target === overlayRef.current) e.preventDefault(); }}
              onPointerMove={onOverlayMove}
              onPointerUp={onOverlayUp}
              onPointerCancel={onOverlayUp}
            >
              {nat && (
                <svg viewBox={`0 0 ${nat.w} ${nat.h}`} preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                  {pageItems.filter((i) => i.type === 'pen').map((i) => (
                    <polyline key={i.id} fill="none" stroke={i.color} strokeWidth={i.width} strokeLinecap="round" strokeLinejoin="round"
                      points={i.points.map(([x, y]) => `${x * nat.w},${y * nat.h}`).join(' ')} />
                  ))}
                  {draft?.points && (
                    <polyline fill="none" stroke={color} strokeWidth={penWidth} strokeLinecap="round" strokeLinejoin="round"
                      points={draft.points.map(([x, y]) => `${x * nat.w},${y * nat.h}`).join(' ')} />
                  )}
                </svg>
              )}

              {pageItems.filter((i) => i.type === 'rect' && !i.crop).map((i) => (
                <div
                  key={i.id}
                  className={`item item--rect${selectedId === i.id ? ' item--sel' : ''}`}
                  style={{ left: `${i.x * 100}%`, top: `${i.y * 100}%`, width: `${i.w * 100}%`, height: `${i.h * 100}%`, background: i.color, opacity: mode === 'redact' ? 0.92 : i.opacity, cursor: active === 'select' ? 'move' : 'default', pointerEvents: active === 'select' ? 'auto' : 'none' }}
                  onPointerDown={(e) => startDrag(e, i)} onPointerMove={moveDrag} onPointerUp={endDrag}
                />
              ))}

              {pageItems.filter((i) => i.type === 'image').map((i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i.id} src={i.dataUrl} alt="" draggable={false}
                  className={`item${selectedId === i.id ? ' item--sel' : ''}`}
                  style={{ left: `${i.x * 100}%`, top: `${i.y * 100}%`, width: `${i.w * 100}%`, cursor: 'move', pointerEvents: active === 'select' ? 'auto' : 'none', touchAction: 'none' }}
                  onPointerDown={(e) => startDrag(e, i)} onPointerMove={moveDrag} onPointerUp={endDrag}
                />
              ))}

              {pageItems.filter((i) => i.type === 'text').map((i) => (
                <div key={i.id} className={`item${selectedId === i.id ? ' item--sel' : ''}`} style={{ left: `${i.x * 100}%`, top: `${i.y * 100}%` }}>
                  <div className="item__handle" onPointerDown={(e) => startDrag(e, i)} onPointerMove={moveDrag} onPointerUp={endDrag}>⠿ переместить</div>
                  <textarea
                    ref={(el) => { if (el && focusId === i.id) { setFocusId(null); setTimeout(() => el.focus(), 30); } }}
                    value={i.text}
                    rows={Math.max(1, i.text.split('\n').length)}
                    placeholder="Текст"
                    style={{ fontSize: `${i.size * k}px`, color: i.color }}
                    onPointerDown={(e) => { e.stopPropagation(); setSelectedId(i.id); }}
                    onChange={(e) => patchItem(i.id, { text: e.target.value })}
                  />
                </div>
              ))}

              {draft && !draft.points && (
                <div className="item" style={{ left: `${draft.x * 100}%`, top: `${draft.y * 100}%`, width: `${draft.w * 100}%`, height: `${draft.h * 100}%`, background: mode === 'crop' ? 'transparent' : mode === 'redact' ? '#000' : color, opacity: 0.6, border: mode === 'crop' ? '2px dashed #fff' : 'none', pointerEvents: 'none' }} />
              )}

              {cropRect && cropRect.page === pageNo && (
                <>
                  <div className="cropmask" style={{ left: 0, top: 0, width: '100%', height: `${cropRect.y * 100}%` }} />
                  <div className="cropmask" style={{ left: 0, top: `${(cropRect.y + cropRect.h) * 100}%`, width: '100%', bottom: 0 }} />
                  <div className="cropmask" style={{ left: 0, top: `${cropRect.y * 100}%`, width: `${cropRect.x * 100}%`, height: `${cropRect.h * 100}%` }} />
                  <div className="cropmask" style={{ left: `${(cropRect.x + cropRect.w) * 100}%`, top: `${cropRect.y * 100}%`, right: 0, height: `${cropRect.h * 100}%` }} />
                  <div className="item" style={{ left: `${cropRect.x * 100}%`, top: `${cropRect.y * 100}%`, width: `${cropRect.w * 100}%`, height: `${cropRect.h * 100}%`, border: '2px dashed #fff', outline: '1px solid #2f7be5', pointerEvents: 'none' }} />
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {sigOpen && <SignatureModal onClose={() => setSigOpen(false)} onDone={onSignature} />}
    </div>
  );
}
