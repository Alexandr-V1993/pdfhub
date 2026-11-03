import Link from 'next/link';
import { TOOLS } from '@/lib/tools';
import { CONVERSIONS } from '@/lib/conversions';

function Illustration() {
  return (
    <svg className="hero2__art" viewBox="0 0 560 440" role="img" aria-label="Документы PDF и инструменты для работы с ними" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="hg-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#dfe4ff" /><stop offset="1" stopColor="#f3e8ff" /></linearGradient>
        <linearGradient id="hg-red" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ff5a52" /><stop offset="1" stopColor="#e5322d" /></linearGradient>
        <linearGradient id="hg-ind" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#6f80ee" /><stop offset="1" stopColor="#4c5fd5" /></linearGradient>
        <linearGradient id="hg-grn" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#3fcf86" /><stop offset="1" stopColor="#1f9d5b" /></linearGradient>
        <filter id="hg-sh" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="10" stdDeviation="12" floodColor="#2b3a74" floodOpacity="0.18" /></filter>
      </defs>
      <rect x="20" y="20" width="520" height="400" rx="36" fill="url(#hg-bg)" />
      <circle cx="470" cy="80" r="70" fill="#fff" opacity=".45" />
      <circle cx="80" cy="370" r="54" fill="#fff" opacity=".4" />

      {/* задняя страница */}
      <g transform="rotate(-9 190 230)" filter="url(#hg-sh)">
        <rect x="90" y="90" width="190" height="250" rx="16" fill="#fff" />
        <rect x="112" y="116" width="90" height="10" rx="5" fill="#cfd5e8" />
        <rect x="112" y="140" width="146" height="8" rx="4" fill="#e3e7f3" />
        <rect x="112" y="158" width="130" height="8" rx="4" fill="#e3e7f3" />
        <rect x="112" y="176" width="146" height="8" rx="4" fill="#e3e7f3" />
        <rect x="112" y="204" width="146" height="70" rx="8" fill="#eef0ff" />
      </g>
      {/* основная страница */}
      <g filter="url(#hg-sh)">
        <rect x="170" y="62" width="220" height="290" rx="18" fill="#fff" />
        <path d="M352 62h6l32 32v6h-26a12 12 0 0 1-12-12z" fill="#e3e7f3" />
        <rect x="192" y="90" width="64" height="26" rx="8" fill="url(#hg-red)" />
        <text x="224" y="108" textAnchor="middle" fontFamily="system-ui,Arial,sans-serif" fontWeight="800" fontSize="15" fill="#fff">PDF</text>
        <rect x="192" y="134" width="150" height="10" rx="5" fill="#cfd5e8" />
        <rect x="192" y="158" width="176" height="8" rx="4" fill="#e3e7f3" />
        <rect x="192" y="176" width="160" height="8" rx="4" fill="#e3e7f3" />
        <rect x="192" y="194" width="176" height="8" rx="4" fill="#e3e7f3" />
        <rect x="192" y="212" width="120" height="8" rx="4" fill="#e3e7f3" />
        <rect x="192" y="240" width="176" height="84" rx="10" fill="#f1f3ff" />
        <polyline points="206,306 238,278 262,294 296,262 354,296" fill="none" stroke="#4c5fd5" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="296" cy="262" r="6" fill="#4c5fd5" />
      </g>

      {/* плавающие «инструменты» */}
      <g filter="url(#hg-sh)">
        <rect x="378" y="132" width="86" height="86" rx="22" fill="url(#hg-ind)" />
        <path d="M404 190l12-26 8 14 8-10 12 22z" fill="#fff" opacity=".95" />
        <circle cx="430" cy="154" r="6" fill="#fff" />
      </g>
      <g filter="url(#hg-sh)">
        <rect x="402" y="250" width="86" height="86" rx="22" fill="url(#hg-grn)" />
        <path d="M424 294l14 14 26-30" fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g filter="url(#hg-sh)">
        <rect x="56" y="250" width="86" height="86" rx="22" fill="#fff" />
        <circle cx="84" cy="313" r="11" fill="none" stroke="#e5322d" strokeWidth="6" />
        <circle cx="114" cy="313" r="11" fill="none" stroke="#e5322d" strokeWidth="6" />
        <path d="M91 304l26-36M107 304L81 268" stroke="#e5322d" strokeWidth="6" strokeLinecap="round" />
      </g>
      <g filter="url(#hg-sh)">
        <rect x="318" y="326" width="74" height="74" rx="20" fill="#fff" />
        <rect x="338" y="352" width="34" height="26" rx="6" fill="#2b3a55" />
        <path d="M344 352v-8a11 11 0 0 1 22 0v8" fill="none" stroke="#2b3a55" strokeWidth="6" strokeLinecap="round" />
      </g>
      <path d="M392 175c24 6 38 26 36 52" fill="none" stroke="#9aa6ee" strokeWidth="3" strokeDasharray="2 9" strokeLinecap="round" />
    </svg>
  );
}

const FEATURES = [
  { t: 'Файлы остаются у вас', d: 'Большинство операций выполняется прямо в браузере — документ никуда не отправляется. Серверные инструменты удаляют файл сразу после обработки.', c: '#2e9e5b', i: 'M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6z M9 12l2 2 4-4' },
  { t: 'Всё в одном месте', d: '__TOOLS__ инструментов для PDF и __CONV__ конвертаций: объединение, сжатие, OCR, подпись, защита, Word, Excel, видео, аудио.', c: '#4c5fd5', i: 'M4 5h7v7H4z M13 5h7v7h-7z M4 14h7v6H4z M13 14h7v6h-7z' },
  { t: 'Бесплатно и без регистрации', d: 'Без подписок, лимитов на число файлов и водяных знаков на результате. Аккаунт нужен только если вы хотите его создать.', c: '#e8590c', i: 'M12 3v18 M16.5 7.5c-1-1.2-2.6-2-4.5-2-2.6 0-4.5 1.4-4.5 3.4 0 4.6 9.5 2.2 9.5 7 0 2-2 3.4-5 3.4-2 0-3.8-.8-4.8-2.2' },
  { t: 'Работает на любом устройстве', d: 'Удобный интерфейс на компьютере, планшете и телефоне. Сканируйте документы камерой и сразу получайте готовый PDF.', c: '#8a4fe0', i: 'M8 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z M11 18h2' },
];

const STEPS = [
  { n: 1, t: 'Выберите инструмент', d: 'Найдите нужную операцию в меню или на этой странице.' },
  { n: 2, t: 'Загрузите файл', d: 'Перетащите документ в окно или выберите его на устройстве.' },
  { n: 3, t: 'Скачайте результат', d: 'Готовый файл сохранится на ваше устройство в один клик.' },
];

export default function Hero() {
  return (
    <>
      <section className="hero2">
        <div className="hero2__inner">
          <div className="hero2__text">
            <span className="hero2__badge">Онлайн-сервис PDFHub</span>
            <h1>Все инструменты для работы с PDF — в одном месте</h1>
            <p>
              Объединяйте, разделяйте, сжимайте, распознавайте, подписывайте и конвертируйте документы.
              Быстро, бесплатно и без установки программ: открыли страницу, загрузили файл, скачали результат.
            </p>
            <div className="hero2__cta">
              <Link href="/merge_pdf" className="btn btn--lg">Объединить PDF</Link>
              <a href="#tools" className="btn btn--lg btn--ghost">Все инструменты</a>
            </div>
            <ul className="hero2__chips">
              <li>Бесплатно</li><li>Без регистрации</li><li>Файлы под защитой</li>
            </ul>
          </div>
          <div className="hero2__pic"><Illustration /></div>
        </div>
      </section>

      <section className="container about" aria-labelledby="about-title">
        <h2 id="about-title" className="about__title">Почему PDFHub</h2>
        <p className="about__lead">
          PDFHub — сервис для тех, кому регулярно нужно что-то сделать с документом: собрать отчёт из нескольких файлов,
          уменьшить размер перед отправкой, достать текст из скана или превратить презентацию в PDF.
        </p>
        <div className="about__grid">
          {FEATURES.map((f) => (
            <div key={f.t} className="about__card" style={{ '--c': f.c }}>
              <span className="about__icon">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={f.i} /></svg>
              </span>
              <h3>{f.t}</h3>
              <p>{f.d.replace('__TOOLS__', String(TOOLS.length)).replace('__CONV__', String(CONVERSIONS.length))}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

export function HowItWorks() {
  return (
    <section className="container how" aria-labelledby="how-title">
      <h2 id="how-title" className="about__title">Как это работает</h2>
      <ol className="how__list">
        {STEPS.map((s) => (
          <li key={s.n} className="how__item">
            <span className="how__n">{s.n}</span>
            <h3>{s.t}</h3>
            <p>{s.d}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
