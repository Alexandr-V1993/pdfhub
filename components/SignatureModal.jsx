'use client';
import { useEffect, useRef, useState } from 'react';

const FONTS = [
  { v: '"Segoe Script", "Bradley Hand", "Brush Script MT", "Lucida Handwriting", cursive', l: 'Рукописный 1' },
  { v: '"Snell Roundhand", "Apple Chancery", "Zapfino", "URW Chancery L", cursive', l: 'Рукописный 2' },
  { v: 'italic 1em Georgia, "Times New Roman", serif', l: 'Курсив' },
];
const COLORS = ['#111111', '#1b3fa0', '#0b6b3a'];

function trim(canvas) {
  const { width: w, height: h } = canvas;
  const d = canvas.getContext('2d').getImageData(0, 0, w, h).data;
  let x0 = w; let y0 = h; let x1 = -1; let y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] > 10) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < x0) return null;
  const pad = 8;
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad);
  x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
  const out = document.createElement('canvas');
  out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
  out.getContext('2d').drawImage(canvas, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

export default function SignatureModal({ onClose, onDone }) {
  const [tab, setTab] = useState('draw');
  const [color, setColor] = useState(COLORS[0]);
  const [name, setName] = useState('');
  const [font, setFont] = useState(FONTS[0].v);
  const [error, setError] = useState('');
  const padRef = useRef(null);
  const drawing = useRef(false);
  const last = useRef(null);

  useEffect(() => {
    const c = padRef.current;
    if (!c) return;
    c.width = 1000; c.height = 320;
  }, [tab]);

  const pos = (e) => {
    const c = padRef.current;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  };
  const down = (e) => { drawing.current = true; last.current = pos(e); padRef.current.setPointerCapture(e.pointerId); };
  const move = (e) => {
    if (!drawing.current) return;
    const g = padRef.current.getContext('2d');
    const p = pos(e);
    g.strokeStyle = color; g.lineWidth = 6; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(last.current.x, last.current.y); g.lineTo(p.x, p.y); g.stroke();
    last.current = p;
  };
  const up = () => { drawing.current = false; };
  const clear = () => { const c = padRef.current; c.getContext('2d').clearRect(0, 0, c.width, c.height); };

  const finish = (canvas) => {
    const t = trim(canvas);
    if (!t) { setError('Подпись пустая — нарисуйте или введите её.'); return; }
    onDone({ dataUrl: t.toDataURL('image/png'), aspect: t.height / t.width });
  };

  const done = () => {
    setError('');
    if (tab === 'draw') return finish(padRef.current);
    if (tab === 'type') {
      if (!name.trim()) { setError('Введите имя.'); return; }
      const c = document.createElement('canvas');
      c.width = 1400; c.height = 360;
      const g = c.getContext('2d');
      g.fillStyle = color;
      g.textBaseline = 'middle';
      let size = 200;
      const fam = font.startsWith('italic') ? font.replace('italic 1em', '').trim() : font;
      const style = font.startsWith('italic') ? 'italic ' : '';
      do { g.font = `${style}${size}px ${fam}`; size -= 8; } while (g.measureText(name).width > c.width - 40 && size > 30);
      g.fillText(name, 20, c.height / 2);
      return finish(c);
    }
    return undefined;
  };

  const onUpload = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      // белый фон фотографии подписи -> прозрачный
      const data = g.getImageData(0, 0, c.width, c.height);
      for (let i = 0; i < data.data.length; i += 4) {
        const lum = 0.299 * data.data[i] + 0.587 * data.data[i + 1] + 0.114 * data.data[i + 2];
        if (lum > 225) data.data[i + 3] = 0;
        else if (lum > 160) data.data[i + 3] = Math.round(255 * (225 - lum) / 65);
      }
      g.putImageData(data, 0, 0);
      finish(c);
    };
    img.onerror = () => setError('Не удалось открыть изображение.');
    img.src = URL.createObjectURL(f);
  };

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal__box" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginBottom: 14 }}>Создать подпись</h2>
        <div className="tabs">
          {[['draw', 'Нарисовать'], ['type', 'Ввести'], ['upload', 'Загрузить']].map(([id, l]) => (
            <button key={id} className={`btn btn--sm btn--ghost${tab === id ? ' btn--active' : ''}`} onClick={() => { setTab(id); setError(''); }}>{l}</button>
          ))}
        </div>
        {error && <div className="error">{error}</div>}

        {tab !== 'upload' && (
          <div className="field">
            <label>Цвет</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {COLORS.map((c) => (
                <button key={c} onClick={() => setColor(c)} aria-label={c}
                  style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: color === c ? '3px solid #e5322d' : '2px solid #fff', outline: '1px solid #cfd5e3', cursor: 'pointer' }} />
              ))}
            </div>
          </div>
        )}

        {tab === 'draw' && (
          <>
            <canvas ref={padRef} className="sigpad" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
            <button className="btn btn--sm btn--ghost" style={{ marginTop: 8 }} onClick={clear}>Очистить</button>
          </>
        )}
        {tab === 'type' && (
          <>
            <div className="field"><label>Ваше имя</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="field">
              <label>Стиль</label>
              <select value={font} onChange={(e) => setFont(e.target.value)}>
                {FONTS.map((f) => <option key={f.l} value={f.v}>{f.l}</option>)}
              </select>
            </div>
          </>
        )}
        {tab === 'upload' && (
          <div className="field">
            <label>Фото или скан подписи на белом фоне</label>
            <input type="file" accept="image/*" onChange={onUpload} />
            <div className="hint">Белый фон будет убран автоматически.</div>
          </div>
        )}

        <div className="actions">
          {tab !== 'upload' && <button className="btn" onClick={done}>Добавить на страницу</button>}
          <button className="btn btn--ghost" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  );
}
