import Link from 'next/link';
import { CATEGORIES, toolsByCat } from '@/lib/tools';

const where = (t) => (t.kind === 'server' || t.op === 'compress' ? 'сервер' : t.kind === 'ai' ? 'ИИ (текст уходит на сервер)' : 'браузер');

export default function ToolsOverview() {
  return (
    <div className="tool" style={{ maxWidth: 900 }}>
      <div className="tool__head">
        <h1>Все инструменты</h1>
        <p>Что умеет сервис и где выполняется каждая операция.</p>
      </div>
      {CATEGORIES.map((c) => (
        <section key={c.id} className="panel" style={{ marginBottom: 16 }}>
          <h2 style={{ color: c.color, fontSize: 15, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>{c.title}</h2>
          <table className="table">
            <tbody>
              {toolsByCat(c.id).map((t) => (
                <tr key={t.slug}>
                  <td><Link href={`/${t.slug}`}><b>{t.title}</b></Link></td>
                  <td className="muted">{t.desc}</td>
                  <td className="muted nowrap">{where(t)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
