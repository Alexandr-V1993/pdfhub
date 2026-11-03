'use client';
import { useState } from 'react';
import { Download, RotateCcw } from 'lucide-react';
import { downloadBlob, formatBytes } from '@/lib/util';

export default function Results({ outputs, onReset, title = 'Готово!' }) {
  const [zipping, setZipping] = useState(false);

  const downloadZip = async () => {
    setZipping(true);
    try {
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();
      const used = new Set();
      for (const o of outputs) {
        let name = o.name;
        let k = 1;
        while (used.has(name)) name = o.name.replace(/(\.[^.]+)?$/, `_${k++}$1`);
        used.add(name);
        zip.file(name, o.blob);
      }
      downloadBlob(await zip.generateAsync({ type: 'blob' }), 'pdfhub-result.zip');
    } finally {
      setZipping(false);
    }
  };

  return (
    <div className="panel">
      <h2 className="done-title">{title}</h2>
      <div className="results">
        {outputs.map((o, i) => (
          <div key={i} className="result">
            <div className="result__info">
              <div className="result__name">{o.name}</div>
              <div className="result__meta">{formatBytes(o.blob.size)}{o.note ? ` · ${o.note}` : ''}</div>
            </div>
            <button className="btn btn--sm" onClick={() => downloadBlob(o.blob, o.name)}>
              <Download size={15} /> Скачать
            </button>
          </div>
        ))}
      </div>
      <div className="actions">
        {outputs.length > 1 && (
          <button className="btn btn--green" onClick={downloadZip} disabled={zipping}>
            <Download size={18} /> {zipping ? 'Пакую…' : 'Скачать всё в ZIP'}
          </button>
        )}
        {outputs.length === 1 && (
          <button className="btn btn--green" onClick={() => downloadBlob(outputs[0].blob, outputs[0].name)}>
            <Download size={18} /> Скачать файл
          </button>
        )}
        <button className="btn btn--ghost" onClick={onReset}>
          <RotateCcw size={16} /> Обработать другие файлы
        </button>
      </div>
    </div>
  );
}
