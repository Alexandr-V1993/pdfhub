'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronDown, FileText, Menu, MoreHorizontal, X } from 'lucide-react';
import { CATEGORIES, getTool, toolsByCat } from '@/lib/tools';
import { CONVERT_FROM, CONVERT_TO, MORE_MENU, QUICK_TOOLS, SITE_NAME } from '@/lib/site';
import Icon from './Icon';

function ToolLink({ slug, onClick }) {
  const t = getTool(slug);
  const cat = CATEGORIES.find((c) => c.id === t.cat);
  return (
    <Link href={`/${slug}`} className="mega__link" style={{ '--c': cat.color }} onClick={onClick}>
      <Icon name={t.icon} size={16} /> {t.title}
    </Link>
  );
}

export default function Header() {
  const [menu, setMenu] = useState(null); // null | 'convert' | 'all' | 'more' | 'mobile'
  const [user, setUser] = useState(undefined);
  const pathname = usePathname();
  const router = useRouter();
  const root = useRef(null);
  const close = useCallback(() => setMenu(null), []);
  const toggle = (name) => setMenu((m) => (m === name ? null : name));

  useEffect(() => { close(); }, [pathname, close]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && close();
    const onClick = (e) => { if (root.current && !root.current.contains(e.target)) close(); };
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => { window.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onClick); };
  }, [close]);

  const loadUser = useCallback(() => {
    fetch('/api/auth/me').then((r) => r.json()).then((d) => setUser(d.user)).catch(() => setUser(null));
  }, []);
  useEffect(() => {
    loadUser();
    window.addEventListener('auth-changed', loadUser);
    return () => window.removeEventListener('auth-changed', loadUser);
  }, [loadUser]);

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    close();
    router.push('/');
  };

  const authLinks = user ? (
    <>
      <Link href="/account" className="header__link" title={user.email}>Аккаунт</Link>
      <button className="header__link header__link--btn" onClick={logout}>Выйти</button>
    </>
  ) : user === null ? (
    <>
      <Link href="/login" className="header__link">Войти</Link>
      <Link href="/register" className="btn btn--sm">Регистрация</Link>
    </>
  ) : null;

  return (
    <header className="header" ref={root}>
      <div className="header__bar">
        <Link href="/" className="brand">
          <span className="brand__logo"><FileText size={18} /></span>
          {SITE_NAME}
        </Link>

        <nav className="header__nav">
          {QUICK_TOOLS.map((slug) => (
            <Link key={slug} href={`/${slug}`} className={pathname === `/${slug}` ? 'active' : ''}>{getTool(slug).title}</Link>
          ))}
          <div className="dd">
            <button className={`dd__btn${menu === 'convert' ? ' open' : ''}`} aria-expanded={menu === 'convert'} onClick={() => toggle('convert')}>
              Конвертировать PDF <ChevronDown size={15} />
            </button>
            {menu === 'convert' && (
              <div className="dd__panel dd__panel--convert">
                <div>
                  <h3>В PDF</h3>
                  {CONVERT_TO.map((s) => <ToolLink key={s} slug={s} onClick={close} />)}
                </div>
                <div>
                  <h3>Из PDF</h3>
                  {CONVERT_FROM.map((s) => <ToolLink key={s} slug={s} onClick={close} />)}
                </div>
              </div>
            )}
          </div>
          <Link href="/convert" className={pathname.startsWith('/convert') ? 'active' : ''}>Конвертеры</Link>
          <button className={`dd__btn${menu === 'all' ? ' open' : ''}`} aria-expanded={menu === 'all'} onClick={() => toggle('all')}>
            Все инструменты <ChevronDown size={15} />
          </button>
        </nav>

        <div className="header__actions">
          <div className="hide-md header__auth">{authLinks}</div>
          <div className="dd">
            <button className="iconbtn" aria-label="Ещё" aria-expanded={menu === 'more'} onClick={() => toggle('more')}>
              <MoreHorizontal size={18} />
            </button>
            {menu === 'more' && (
              <div className="dd__panel dd__panel--more">
                <div>
                  <h3>Решения</h3>
                  {MORE_MENU.solutions.map((i) => <Link key={i.href} href={i.href} className="more__item"><b>{i.title}</b><span>{i.desc}</span></Link>)}
                </div>
                <div>
                  {MORE_MENU.general.map((i) => <Link key={i.href} href={i.href} className="more__plain">{i.title}</Link>)}
                  <h3 style={{ marginTop: 14 }}>Помощь</h3>
                  {MORE_MENU.help.map((i) => <Link key={i.href} href={i.href} className="more__plain">{i.title}</Link>)}
                </div>
              </div>
            )}
          </div>
          <button className="iconbtn show-md" aria-label="Меню" aria-expanded={menu === 'mobile'} onClick={() => toggle('mobile')}>
            {menu === 'mobile' ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {(menu === 'all' || menu === 'mobile') && (
        <div className="mega" role="dialog" aria-label="Все инструменты">
          <div className="mega__inner">
            {menu === 'mobile' && <div className="mega__col mega__auth">{authLinks}</div>}
            {CATEGORIES.map((c) => (
              <div key={c.id} className="mega__col">
                <h3 style={{ '--c': c.color }}>{c.title}</h3>
                {toolsByCat(c.id).map((t) => <ToolLink key={t.slug} slug={t.slug} onClick={close} />)}
              </div>
            ))}
            {menu === 'mobile' && (
              <div className="mega__col">
                <h3 style={{ '--c': '#667085' }}>Сервис</h3>
                {[{ href: '/convert', title: 'Конвертеры' }, ...MORE_MENU.general, ...MORE_MENU.help, ...MORE_MENU.solutions].map((i) => (
                  <Link key={i.href} href={i.href} className="mega__link" onClick={close}>{i.title}</Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
