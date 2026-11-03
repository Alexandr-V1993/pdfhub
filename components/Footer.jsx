import Link from 'next/link';
import { MORE_MENU, SITE_NAME } from '@/lib/site';

export default function Footer() {
  const links = [...MORE_MENU.general, ...MORE_MENU.help];
  return (
    <footer className="footer">
      <div className="container">
        <nav className="footer__links">
          {links.map((l) => <Link key={l.href} href={l.href}>{l.title}</Link>)}
        </nav>
        <p>© {new Date().getFullYear()} {SITE_NAME}. Операции в браузере выполняются локально; серверные инструменты удаляют файлы сразу после обработки.</p>
      </div>
    </footer>
  );
}
