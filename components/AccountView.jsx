'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AccountView() {
  const router = useRouter();
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    fetch('/api/auth/me').then((r) => r.json()).then((d) => setUser(d.user)).catch(() => setUser(null));
  }, []);

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.dispatchEvent(new Event('auth-changed'));
    router.push('/');
  };

  return (
    <div className="tool" style={{ maxWidth: 520 }}>
      <div className="tool__head"><h1>Аккаунт</h1></div>
      <div className="panel">
        {user === undefined && <p className="muted center">Загрузка…</p>}
        {user === null && (
          <p className="center">Вы не вошли. <Link href="/login"><u>Войти</u></Link> или <Link href="/register"><u>зарегистрироваться</u></Link>.</p>
        )}
        {user && (
          <>
            <p><b>Почта:</b> {user.email}</p>
            <p><b>Дата регистрации:</b> {new Date(user.created).toLocaleDateString('ru-RU')}</p>
            <div className="actions">
              <Link href="/" className="btn">К инструментам</Link>
              <button className="btn btn--ghost" onClick={logout}>Выйти</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
