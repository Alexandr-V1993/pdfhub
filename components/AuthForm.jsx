'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { postJson } from '@/lib/client-api';

export default function AuthForm({ mode }) {
  const router = useRouter();
  const reg = mode === 'register';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await postJson(reg ? '/api/auth/register' : '/api/auth/login', { email, password });
      window.dispatchEvent(new Event('auth-changed'));
      router.push('/account');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="tool" style={{ maxWidth: 440 }}>
      <div className="tool__head">
        <h1>{reg ? 'Регистрация' : 'Вход'}</h1>
        <p>{reg ? 'Аккаунт не обязателен — все инструменты работают и без него.' : 'Войдите в свой аккаунт.'}</p>
      </div>
      <form className="panel" onSubmit={submit}>
        {error && <div className="error">{error}</div>}
        <div className="field">
          <label htmlFor="email">Почта</label>
          <input id="email" type="text" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="password">Пароль</label>
          <input id="password" type="password" autoComplete={reg ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={reg ? 8 : undefined} />
          {reg && <div className="hint">Не короче 8 символов</div>}
        </div>
        <button className="btn" style={{ width: '100%' }} disabled={busy}>{busy ? 'Подождите…' : reg ? 'Создать аккаунт' : 'Войти'}</button>
        <p className="muted center" style={{ marginBottom: 0 }}>
          {reg ? <>Уже есть аккаунт? <Link href="/login"><u>Войти</u></Link></> : <>Нет аккаунта? <Link href="/register"><u>Зарегистрироваться</u></Link></>}
        </p>
      </form>
    </div>
  );
}
