'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { CONVERSIONS, CONVERSION_CATEGORIES, colorOf, hrefOf } from '@/lib/conversions';

const COLLAPSED = 12;

export function ConvTile({ c }) {
  const [a, b] = colorOf(c.from);
  const small = c.from.length > 4;
  return (
    <span className="conv__symbol" aria-hidden="true">
      <span className="conv__file" style={{ '--a': a, '--b': b, fontSize: small ? 8 : 11 }}>{small ? c.from.split(' ')[0].slice(0, 6) : c.from}</span>
      <span className="conv__dest">{small ? '' : c.to}</span>
    </span>
  );
}

export default function PopularConversions({ title = 'Популярные конвертации', startExpanded = false }) {
  const [cat, setCat] = useState('all');
  const [open, setOpen] = useState(startExpanded);
  const list = useMemo(() => CONVERSIONS.filter((c) => cat === 'all' || c.cat === cat), [cat]);
  const shown = open ? list : list.slice(0, COLLAPSED);

  return (
    <section id="conversions" className="cat">
      <h2 className="conv__title">{title}</h2>
      <div className="conv__tabs" role="tablist" aria-label="Категории конвертаций">
        {CONVERSION_CATEGORIES.map((t) => (
          <button key={t.id} role="tab" aria-selected={cat === t.id} className={cat === t.id ? 'active' : ''} onClick={() => setCat(t.id)}>{t.title}</button>
        ))}
      </div>
      <div role="tabpanel" className="conv__grid">
        {shown.map((c) => (
          <Link key={c.id} href={hrefOf(c)} className="conv__card">
            <ConvTile c={c} />
            <span className="conv__label">{c.label}</span>
            <ChevronRight size={18} className="conv__chev" aria-hidden="true" />
          </Link>
        ))}
      </div>
      {list.length > COLLAPSED && (
        <button className="btn btn--ghost conv__more" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {open ? 'Свернуть' : `Показать все (${list.length})`}
          <ChevronRight size={16} style={{ transform: `rotate(${open ? -90 : 90}deg)` }} />
        </button>
      )}
    </section>
  );
}
