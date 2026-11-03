'use client';
import { useRef, useState } from 'react';

function matches(file, accept) {
  if (!accept) return true;
  return accept.split(',').map((s) => s.trim().toLowerCase()).some((a) => {
    if (a.startsWith('.')) return file.name.toLowerCase().endsWith(a);
    if (a.endsWith('/*')) return file.type.startsWith(a.slice(0, -1));
    return file.type === a;
  });
}

export default function FileDrop({ accept, multiple, capture, onFiles, label, hint, compact }) {
  const ref = useRef(null);
  const [over, setOver] = useState(false);
  const [warn, setWarn] = useState('');

  const handle = (list) => {
    const all = [...list];
    let ok = all.filter((f) => matches(f, accept));
    if (ok.length < all.length) setWarn('Часть файлов пропущена: неподходящий формат.');
    else setWarn('');
    if (!multiple) ok = ok.slice(0, 1);
    if (ok.length) onFiles(ok);
  };

  return (
    <div
      className={`drop${over ? ' drop--over' : ''}`}
      style={compact ? { padding: '28px 16px' } : undefined}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); handle(e.dataTransfer.files); }}
    >
      <button type="button" className={compact ? 'btn' : 'btn btn--lg'} onClick={() => ref.current && ref.current.click()}>
        {label || (multiple ? 'Выбрать файлы' : 'Выбрать файл')}
      </button>
      <p>или перетащите {multiple ? 'файлы' : 'файл'} сюда</p>
      {hint && <small>{hint}</small>}
      {warn && <small style={{ color: '#a3150f' }}>{warn}</small>}
      <input
        ref={ref}
        type="file"
        className="sr-only"
        accept={accept}
        multiple={multiple}
        capture={capture ? 'environment' : undefined}
        onChange={(e) => { handle(e.target.files); e.target.value = ''; }}
      />
    </div>
  );
}
