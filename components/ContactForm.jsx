'use client';
import { useState } from 'react';
import { postJson } from '@/lib/client-api';

export default function ContactForm() {
  const [f, setF] = useState({ name: '', email: '', message: '', website: '' });
  const [state, setState] = useState({ busy: false, ok: false, error: '' });
  const set = (k) => (e) => setF((v) => ({ ...v, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setState({ busy: true, ok: false, error: '' });
    try {
      await postJson('/api/contact', f);
      setState({ busy: false, ok: true, error: '' });
      setF({ name: '', email: '', message: '', website: '' });
    } catch (err) {
      setState({ busy: false, ok: false, error: err.message });
    }
  };

  return (
    <form className="panel" onSubmit={submit}>
      {state.error && <div className="error">{state.error}</div>}
      {state.ok && <div className="note" style={{ marginTop: 0, marginBottom: 14, background: '#effaf3', borderColor: '#c4ebd2', color: '#1d6b3c' }}>Спасибо! Сообщение отправлено.</div>}
      <div className="field"><label htmlFor="c-name">Имя</label><input id="c-name" type="text" value={f.name} onChange={set('name')} maxLength={100} /></div>
      <div className="field"><label htmlFor="c-email">Почта для ответа *</label><input id="c-email" type="text" inputMode="email" value={f.email} onChange={set('email')} required /></div>
      <div className="field"><label htmlFor="c-msg">Сообщение *</label><textarea id="c-msg" rows={6} value={f.message} onChange={set('message')} required maxLength={5000} /></div>
      <input type="text" name="website" value={f.website} onChange={set('website')} tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: 'absolute', left: '-9999px' }} />
      <button className="btn" disabled={state.busy}>{state.busy ? 'Отправляю…' : 'Отправить'}</button>
    </form>
  );
}
