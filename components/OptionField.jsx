'use client';

export default function OptionField({ f, value, onChange }) {
  if (f.type === 'checkbox') {
    return (
      <label className="check">
        <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
        {f.label}
      </label>
    );
  }
  return (
    <div className="field">
      <label>{f.label}{f.required ? ' *' : ''}</label>
      {f.type === 'select' && (
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          {f.options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
        </select>
      )}
      {(f.type === 'text' || f.type === 'password') && (
        <input type={f.type} value={value} autoComplete="off" onChange={(e) => onChange(e.target.value)} />
      )}
      {f.type === 'number' && (
        <input type="number" value={value} min={f.min} max={f.max} step={f.step || 1} onChange={(e) => onChange(e.target.value)} />
      )}
      {f.type === 'color' && <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />}
      {f.type === 'range' && (
        <input type="range" value={value} min={f.min} max={f.max} step={f.step || 0.05} onChange={(e) => onChange(Number(e.target.value))} />
      )}
      {f.type === 'file' && (
        <input type="file" accept={f.accept} onChange={(e) => onChange(e.target.files[0] || null)} />
      )}
      {f.hint && <div className="hint">{f.hint}</div>}
    </div>
  );
}
