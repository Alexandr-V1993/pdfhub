import Link from 'next/link';
import { CATEGORIES, toolsByCat } from '@/lib/tools';
import Icon from '@/components/Icon';
import PopularConversions from '@/components/PopularConversions';
import Hero, { HowItWorks } from '@/components/Hero';

export default function Home() {
  return (
    <>
      <Hero />
      <div className="container" id="tools">
        <PopularConversions />
        {CATEGORIES.map((c) => (
          <section key={c.id} className="cat">
            <h2 style={{ '--c': c.color }}>{c.title}</h2>
            <div className="grid">
              {toolsByCat(c.id).map((t) => (
                <Link key={t.slug} href={`/${t.slug}`} className="card" style={{ '--c': c.color }}>
                  <span className="card__icon"><Icon name={t.icon} size={26} /></span>
                  <span className="card__title">{t.title}</span>
                  <span className="card__desc">{t.desc}</span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
      <HowItWorks />
    </>
  );
}
