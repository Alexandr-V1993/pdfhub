'use client';
import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import { getTool, defaultOptions } from '@/lib/tools';
import { formatBytes, friendlyError } from '@/lib/util';
import FileDrop from './FileDrop';
import OptionField from './OptionField';
import Results from './Results';
import ProgressPanel from './ProgressPanel';

const PagesTool = dynamic(() => import('./PagesTool'), { ssr: false, loading: () => <p className="center muted">Загрузка…</p> });
const EditorTool = dynamic(() => import('./EditorTool'), { ssr: false, loading: () => <p className="center muted">Загрузка…</p> });
const FormsTool = dynamic(() => import('./FormsTool'), { ssr: false, loading: () => <p className="center muted">Загрузка…</p> });
const CompareTool = dynamic(() => import('./CompareTool'), { ssr: false, loading: () => <p className="center muted">Загрузка…</p> });
const AiTool = dynamic(() => import('./AiTool'), { ssr: false, loading: () => <p className="center muted">Загрузка…</p> });

const SERVER_NOTE = 'Этот инструмент работает на сервере: файл передаётся по защищённому соединению и удаляется сразу после обработки.';

export default function ToolRunner({ slug }) {
  const tool = getTool(slug);
  const [files, setFiles] = useState([]);
  const [opts, setOpts] = useState(() => defaultOptions(tool));
  const [phase, setPhase] = useState('pick'); // pick | config | run | done
  const [outputs, setOutputs] = useState([]);
  const [error, setError] = useState('');
  const [prog, setProg] = useState({ v: 0, t: '' });
  const [pasted, setPasted] = useState('');

  const reset = () => {
    setFiles([]); setOutputs([]); setError(''); setPhase('pick'); setProg({ v: 0, t: '' });
    setOpts(defaultOptions(tool));
  };

  const visibleFields = useMemo(() => (tool.options || []).filter((f) => !f.showIf || f.showIf(opts)), [tool, opts]);

  const addFiles = (list) => {
    setError('');
    setFiles((prev) => (tool.multiple ? [...prev, ...list] : list));
    setPhase('config');
  };
  const move = (i, d) => setFiles((prev) => {
    const a = [...prev];
    const j = i + d;
    if (j < 0 || j >= a.length) return a;
    [a[i], a[j]] = [a[j], a[i]];
    return a;
  });
  const remove = (i) => setFiles((prev) => {
    const a = prev.filter((_, k) => k !== i);
    if (!a.length) setPhase('pick');
    return a;
  });

  const run = async (inputFiles = files) => {
    setError('');
    if (tool.minFiles && inputFiles.length < tool.minFiles) {
      setError(`Нужно выбрать минимум файлов: ${tool.minFiles}`);
      return;
    }
    const missing = (tool.options || []).find((f) => f.required && (!f.showIf || f.showIf(opts)) && !String(opts[f.name] || '').trim());
    if (missing) { setError(`Заполните поле «${missing.label}»`); return; }

    setPhase('run');
    setProg({ v: 0, t: 'Начинаю…' });
    const ctx = { onProgress: (v, t) => setProg((p) => ({ v: Math.max(0, Math.min(1, v)), t: t ?? p.t })) };
    try {
      let outs;
      if (tool.kind === 'server') {
        const { runServerTool } = await import('@/lib/client-api');
        outs = await runServerTool(tool, inputFiles, opts, ctx);
      } else {
        const { ops } = await import('@/lib/ops');
        outs = await ops[tool.op](inputFiles, opts, ctx);
      }
      setOutputs(outs);
      setPhase('done');
    } catch (e) {
      console.warn(e);
      setError(friendlyError(e));
      setPhase(inputFiles.length ? 'config' : 'pick');
    }
  };

  const runPasted = () => {
    const ti = tool.textInput;
    const file = new File([pasted], ti.filename, { type: ti.mime });
    setFiles([file]);
    run([file]);
  };

  const head = (
    <div className="tool__head">
      <h1>{tool.title}</h1>
      <p>{tool.desc}</p>
    </div>
  );

  /* ── Сложные инструменты со своим интерфейсом ── */
  if (['pages', 'editor', 'forms', 'compare', 'ai'].includes(tool.kind)) {
    const Comp = { pages: PagesTool, editor: EditorTool, forms: FormsTool, compare: CompareTool, ai: AiTool }[tool.kind];
    return (
      <div className="tool" style={tool.kind === 'editor' || tool.kind === 'pages' ? { maxWidth: 1240 } : undefined}>
        {head}
        {error && <div className="error">{error}</div>}
        {tool.kind === 'compare' ? (
          <Comp tool={tool} onReset={reset} />
        ) : files.length === 0 ? (
          <FileDrop accept={tool.accept} onFiles={(l) => setFiles(l)} label="Выбрать PDF-файл" />
        ) : (
          <Comp tool={tool} file={files[0]} onReset={reset} />
        )}
      </div>
    );
  }

  /* ── Простые инструменты: файлы + параметры ── */
  return (
    <div className="tool">
      {head}
      {error && <div className="error">{error}</div>}

      {phase === 'pick' && (
        <>
          <FileDrop
            accept={tool.accept}
            multiple={tool.multiple}
            capture={tool.capture}
            onFiles={addFiles}
            label={tool.capture ? 'Сфотографировать или выбрать' : undefined}
          />
          {tool.textInput && (
            <div className="panel" style={{ marginTop: 18 }}>
              <div className="field">
                <label>{tool.textInput.label}</label>
                <textarea className="mono" value={pasted} placeholder={tool.textInput.placeholder} onChange={(e) => setPasted(e.target.value)} />
              </div>
              <button className="btn" disabled={!pasted.trim()} onClick={runPasted}>{tool.cta}</button>
            </div>
          )}
          {tool.kind === 'server' && <div className="note">{SERVER_NOTE}</div>}
        </>
      )}

      {phase === 'config' && (
        <div className="layout">
          <div className="panel">
            <div className="files">
              {files.map((f, i) => (
                <div className="file" key={`${f.name}-${i}`}>
                  {files.length > 1 && <span className="file__idx">{i + 1}</span>}
                  <span className="file__name" title={f.name}>{f.name}</span>
                  <span className="file__size">{formatBytes(f.size)}</span>
                  {tool.sortable && files.length > 1 && (
                    <>
                      <button className="iconbtn" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Выше"><ArrowUp size={15} /></button>
                      <button className="iconbtn" disabled={i === files.length - 1} onClick={() => move(i, 1)} aria-label="Ниже"><ArrowDown size={15} /></button>
                    </>
                  )}
                  <button className="iconbtn" onClick={() => remove(i)} aria-label="Убрать"><X size={15} /></button>
                </div>
              ))}
            </div>
            {tool.multiple && (
              <div style={{ marginTop: 14 }}>
                <label className="btn btn--ghost btn--sm" style={{ cursor: 'pointer' }}>
                  <Plus size={15} /> Добавить файлы
                  <input
                    type="file" className="sr-only" accept={tool.accept} multiple
                    onChange={(e) => { addFiles([...e.target.files]); e.target.value = ''; }}
                  />
                </label>
              </div>
            )}
          </div>

          <div className="panel opts">
            {visibleFields.length > 0 && <h3>Параметры</h3>}
            {visibleFields.map((f) => (
              <OptionField key={f.name} f={f} value={opts[f.name]} onChange={(v) => setOpts((o) => ({ ...o, [f.name]: v }))} />
            ))}
            {tool.kind === 'server' && <div className="note" style={{ marginTop: 0 }}>{SERVER_NOTE}</div>}
            <div className="actions">
              <button className="btn" onClick={() => run()}>{tool.cta}</button>
              <button className="btn btn--ghost" onClick={reset}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      {phase === 'run' && (
        <ProgressPanel value={prog.v} text={prog.t} />
      )}

      {phase === 'done' && <Results outputs={outputs} onReset={reset} />}
    </div>
  );
}
