'use client';
import { useEffect, useState } from 'react';
import { baseName, friendlyError } from '@/lib/util';
import Results from './Results';

export default function FormsTool({ file, onReset }) {
  const [fields, setFields] = useState(null);
  const [values, setValues] = useState({});
  const [flatten, setFlatten] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [outputs, setOutputs] = useState(null);

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const { readFormFields } = await import('@/lib/ops');
        const list = await readFormFields(file);
        if (dead) return;
        setFields(list);
        setValues(Object.fromEntries(list.map((f) => [f.name, f.value])));
      } catch (e) {
        console.error(e);
        if (!dead) { setError(friendlyError(e)); setFields([]); }
      }
    })();
    return () => { dead = true; };
  }, [file]);

  const save = async () => {
    setBusy(true); setError('');
    try {
      const { fillForm } = await import('@/lib/ops');
      const blob = await fillForm(file, values, { flatten });
      setOutputs([{ name: `${baseName(file.name)}_filled.pdf`, blob }]);
    } catch (e) {
      console.error(e);
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  if (outputs) return <Results outputs={outputs} onReset={onReset} />;
  if (!fields) return <p className="center muted">Ищу поля формы…</p>;

  const set = (name, v) => setValues((s) => ({ ...s, [name]: v }));

  return (
    <div className="panel">
      {error && <div className="error">{error}</div>}
      {fields.length === 0 ? (
        <>
          <p>В этом PDF нет интерактивных полей формы. Если нужно просто добавить текст на страницу, воспользуйтесь инструментом «Редактировать PDF».</p>
          <button className="btn btn--ghost" onClick={onReset}>Выбрать другой файл</button>
        </>
      ) : (
        <>
          <div className="formgrid">
            {fields.map((f) => (
              f.type === 'checkbox' ? (
                <label key={f.name} className="check">
                  <input type="checkbox" checked={!!values[f.name]} onChange={(e) => set(f.name, e.target.checked)} /> {f.name}
                </label>
              ) : (
                <div className="field" key={f.name}>
                  <label>{f.name}</label>
                  {f.type === 'text' && (f.multiline
                    ? <textarea rows={3} value={values[f.name] ?? ''} onChange={(e) => set(f.name, e.target.value)} />
                    : <input type="text" value={values[f.name] ?? ''} onChange={(e) => set(f.name, e.target.value)} />)}
                  {(f.type === 'select' || f.type === 'radio') && (
                    <select value={values[f.name] ?? ''} onChange={(e) => set(f.name, e.target.value)}>
                      <option value="">—</option>
                      {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  )}
                </div>
              )
            ))}
          </div>
          <label className="check" style={{ marginTop: 12 }}>
            <input type="checkbox" checked={flatten} onChange={(e) => setFlatten(e.target.checked)} />
            Превратить поля в обычный текст (после этого форму нельзя будет редактировать)
          </label>
          <div className="actions">
            <button className="btn" onClick={save} disabled={busy}>{busy ? 'Сохраняю…' : 'Сохранить PDF'}</button>
            <button className="btn btn--ghost" onClick={onReset}>Отмена</button>
          </div>
        </>
      )}
    </div>
  );
}
