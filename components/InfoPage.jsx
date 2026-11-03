import Link from 'next/link';
import { PAGES } from '@/lib/site';

import { buildMeta } from '@/lib/seo';
const PATHS = { pricing: '/pricing', features: '/features', business: '/business', faq: '/help/faq', security: '/help/security', about: '/help/about', legal: '/help/legal' };

export function pageMeta(key) {
  const p = PAGES[key];
  return buildMeta({ title: `${p.title} — PDFHub`, description: `${p.lead} PDFHub — бесплатные онлайн-инструменты для работы с PDF.`, keywords: [p.title.toLowerCase(), `${p.title.toLowerCase()} pdfhub`], path: PATHS[key] || `/${key}` });
}

export default function InfoPage({ pageKey, children }) {
  const p = PAGES[pageKey];
  return (
    <div className="tool" style={{ maxWidth: 820 }}>
      <div className="tool__head">
        <h1>{p.title}</h1>
        <p>{p.lead}</p>
      </div>
      <div className="prose panel">
        {p.blocks.map((b) => (
          <section key={b.h}>
            <h2>{b.h}</h2>
            {b.p && <p>{b.p}</p>}
            {b.items && <ul>{b.items.map((i) => <li key={i}>{i}</li>)}</ul>}
          </section>
        ))}
        {children}
      </div>
      <p className="center muted" style={{ marginTop: 22 }}>
        <Link href="/" className="btn btn--ghost">К инструментам</Link>
      </p>
    </div>
  );
}
