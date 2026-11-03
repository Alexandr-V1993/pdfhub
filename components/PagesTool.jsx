'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, RotateCw, Trash2 } from 'lucide-react';
import { loadPdfjsDoc, renderPageToCanvas } from '@/lib/pdfjs';
import { baseName, friendlyError } from '@/lib/util';
import Results from './Results';

// mode: remove | extract | organize
export default function PagesTool({ tool, file, onReset }) {
  const mode = tool.mode;
  const [pages, setPages] = useState([]); // { id, index, thumb, rotation, selected, deleted }
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [outputs, setOutputs] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    (async () => {
      try {
        const doc = await loadPdfjsDoc(file);
        const base = Array.from({ length: doc.numPages }, (_, i) => ({
          id: i, index: i, thumb: null, rotation: 0, selected: false, deleted: false,
        }));
        if (!alive.current) return;
        setPages(base);
        setLoading(false);
        for (let i = 0; i < doc.numPages && alive.current; i++) {
          const c = await renderPageToCanvas(doc, i + 1, 0.35);
          const url = c.toDataURL('image/jpeg', 0.7);
          c.width = c.height = 0;
          if (!alive.current) return;
          setPages((prev) => prev.map((p) => (p.id === i ? { ...p, thumb: url } : p)));
        }
      } catch (e) {
        console.error(e);
        setError(friendlyError(e));
        setLoading(false);
      }
    })();
    return () => { alive.current = false; };
  }, [file]);

  const selectedCount = useMemo(() => pages.filter((p) => p.selected).length, [pages]);
  const deletedCount = useMemo(() => pages.filter((p) => p.deleted).length, [pages]);

  const patch = (id, ch) => setPages((prev) => prev.map((p) => (p.id === id ? { ...p, ...ch } : p)));
  const onClickPage = (p) => {
    if (mode === 'organize') return;
    patch(p.id, { selected: !p.selected });
  };

  const drop = (targetId) => {
    if (dragId === null || dragId === targetId) return;
    setPages((prev) => {
      const a = [...prev];
      const from = a.findIndex((p) => p.id === dragId);
      const to = a.findIndex((p) => p.id === targetId);
      const [m] = a.splice(from, 1);
      a.splice(to, 0, m);
      return a;
    });
  };

  const run = async () => {
    setError('');
    let list;
    if (mode === 'remove') {
      list = pages.filter((p) => !p.selected);
      if (!list.length) return setError('Нельзя удалить все страницы документа.');
      if (list.length === pages.length) return setError('Отметьте страницы, которые нужно удалить.');
    } else if (mode === 'extract') {
      list = pages.filter((p) => p.selected);
      if (!list.length) return setError('Отметьте страницы, которые нужно извлечь.');
    } else {
      list = pages.filter((p) => !p.deleted);
      if (!list.length) return setError('Нельзя удалить все страницы документа.');
    }
    setBusy(true);
    try {
      const { buildFromPages } = await import('@/lib/ops');
      const blob = await buildFromPages(file, list.map((p) => ({ index: p.index, rotation: p.rotation })));
      const suffix = { remove: 'removed', extract: 'extracted', organize: 'organized' }[mode];
      setOutputs([{ name: `${baseName(file.name)}_${suffix}.pdf`, blob }]);
    } catch (e) {
      console.error(e);
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  if (outputs) return <Results outputs={outputs} onReset={onReset} />;
  if (loading) return <p className="center muted">Читаю документ…</p>;

  const hint = {
    remove: 'Нажмите на страницы, которые нужно удалить.',
    extract: 'Нажмите на страницы, которые нужно сохранить в новый файл.',
    organize: 'Перетаскивайте страницы, чтобы изменить порядок. Наведите на страницу — появятся кнопки поворота и удаления.',
  }[mode];
  const cta = { remove: 'Удалить выбранные', extract: 'Извлечь выбранные', organize: 'Сохранить PDF' }[mode];
  const status = mode === 'organize'
    ? `Страниц: ${pages.length - deletedCount}${deletedCount ? ` (удалено: ${deletedCount})` : ''}`
    : `Выбрано: ${selectedCount} из ${pages.length}`;

  return (
    <div className="panel">
      {error && <div className="error">{error}</div>}
      <p className="muted" style={{ marginTop: 0 }}>{hint}</p>
      <div className="thumbs">
        {pages.map((p) => (
          <div
            key={p.id}
            className={`thumb${p.selected ? ' thumb--sel' : ''}${p.deleted ? ' thumb--del' : ''}${dragId === p.id ? ' thumb--drag' : ''}${overId === p.id && dragId !== p.id ? ' thumb--over' : ''}`}
            draggable={mode === 'organize'}
            onClick={() => onClickPage(p)}
            onDragStart={() => setDragId(p.id)}
            onDragOver={(e) => { if (mode === 'organize') { e.preventDefault(); setOverId(p.id); } }}
            onDragLeave={() => setOverId(null)}
            onDrop={(e) => { e.preventDefault(); drop(p.id); setDragId(null); setOverId(null); }}
            onDragEnd={() => { setDragId(null); setOverId(null); }}
          >
            {p.selected && <span className="thumb__check"><Check size={15} /></span>}
            <div className="thumb__img">
              {p.thumb
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={p.thumb} alt={`Страница ${p.index + 1}`} draggable={false} style={{ transform: `rotate(${p.rotation}deg)` }} />
                : <span className="muted">…</span>}
            </div>
            <div className="thumb__num">{p.index + 1}</div>
            {mode === 'organize' && (
              <div className="thumb__tools">
                <button className="iconbtn" title="Повернуть" onClick={(e) => { e.stopPropagation(); patch(p.id, { rotation: (p.rotation + 90) % 360 }); }}><RotateCw size={15} /></button>
                <button className="iconbtn" title={p.deleted ? 'Вернуть' : 'Удалить'} onClick={(e) => { e.stopPropagation(); patch(p.id, { deleted: !p.deleted }); }}><Trash2 size={15} /></button>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="sticky-bar">
        <span className="grow muted">{status}</span>
        {mode !== 'organize' && (
          <>
            <button className="btn btn--ghost btn--sm" onClick={() => setPages((ps) => ps.map((p) => ({ ...p, selected: true })))}>Выбрать все</button>
            <button className="btn btn--ghost btn--sm" onClick={() => setPages((ps) => ps.map((p) => ({ ...p, selected: false })))}>Снять выбор</button>
          </>
        )}
        <button className="btn btn--ghost" onClick={onReset}>Отмена</button>
        <button className="btn" onClick={run} disabled={busy}>{busy ? 'Работаю…' : cta}</button>
      </div>
    </div>
  );
}
