'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import { getConversion } from '@/lib/conversions';
import { formatBytes, friendlyError } from '@/lib/util';
import FileDrop from './FileDrop';
import Results from './Results';
import ProgressPanel from './ProgressPanel';

export default function ConvertRunner({ id }) {
  const c = getConversion(id);
    const [files, setFiles] = useState([]);
  const [phase, setPhase] = useState('pick'); // pick | config | run | done
  const [outputs, setOutputs] = useState([]);
  const [error, setError] = useState('');
  const [prog, setProg] = useState({ v: 0, t: '' });

  const reset = () => { setFiles([]); setOutputs([]); setError(''); setPhase('pick'); setProg({ v: 0, t: '' }); };
  const add = (list) => { setError(''); setFiles((p) => [...p, ...list]); setPhase('config'); };
  const remove = (i) => setFiles((p) => { const a = p.filter((_, k) => k !== i); if (!a.length) setPhase('pick'); return a; });

  const run = async () => {
    setError(''); setPhase('run'); setProg({ v: 0, t: 'Начинаю…' });
    try {
      const { runConversion } = await import('@/lib/convert-run');
      const outs = await runConversion(c, files, { onProgress: (v, t) => setProg((p) => ({ v: Math.max(0, Math.min(1, v)), t: t ?? p.t })) });
      setOutputs(outs); setPhase('done');
    } catch (e) {
      console.warn(e);
      setError(friendlyError(e)); setPhase('config');
    }
  };

  return (
    <div className="tool">
      <div className="tool__head">
        <h1>{c.label}</h1>
        <p>Конвертируйте {c.from} в {c.to} онлайн и бесплатно. {c.note || ''}</p>
      </div>
      {error && <div className="error">{error}</div>}

      {phase === 'pick' && <FileDrop accept={c.accept} multiple onFiles={add} hint={`Формат: ${c.accept.replace(/\./g, '').replace(/,/g, ', ').toUpperCase()}`} />}

      {phase === 'config' && (
        <div className="panel">
          <div className="files">
            {files.map((f, i) => (
              <div className="file" key={`${f.name}-${i}`}>
                <span className="file__name" title={f.name}>{f.name}</span>
                <span className="file__size">{formatBytes(f.size)}</span>
                <button className="iconbtn" onClick={() => remove(i)} aria-label="Убрать"><X size={15} /></button>
              </div>
            ))}
          </div>
          <div className="actions">
            <button className="btn btn--lg" onClick={run}>Конвертировать в {c.to}</button>
            <label className="btn btn--ghost" style={{ cursor: 'pointer' }}>
              <Plus size={15} /> Добавить файлы
              <input type="file" className="sr-only" accept={c.accept} multiple onChange={(e) => { add([...e.target.files]); e.target.value = ''; }} />
            </label>
            <button className="btn btn--ghost" onClick={reset}>Отмена</button>
          </div>
        </div>
      )}

      {phase === 'run' && (
        <ProgressPanel title="Конвертирую…" value={prog.v} text={prog.t} />
      )}

      {phase === 'done' && <Results outputs={outputs} onReset={reset} />}

      <p className="center muted" style={{ marginTop: 24 }}><Link href="/convert"><u>Все конвертации</u></Link></p>
    </div>
  );
}
