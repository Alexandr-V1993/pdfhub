// Единый генератор SEO-метаданных: title, description, keywords, canonical, robots,
// authors/creator/publisher, Open Graph, Twitter и JSON-LD.
import { SITE_NAME } from '@/lib/site';

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://pdfhub.ru').replace(/\/$/, '');
export const OG_IMAGE = '/og.png';
export const BASE_KEYWORDS = ['pdf', 'pdf онлайн', 'работа с pdf', 'инструменты pdf', 'pdfhub', 'бесплатно', 'без регистрации'];

const cut = (s, n) => (s.length <= n ? s : s.slice(0, n - 1).replace(/[\s,.;:—-]+\S*$/, '') + '…');
const uniq = (a) => [...new Set(a.map((x) => x.trim()).filter(Boolean))];

export function buildMeta({ title, description, keywords = [], path = '/', noindex = false, type = 'website' }) {
  const url = path === '/' ? '/' : path.replace(/\/$/, '');
  const desc = cut(description, 165);
  const kw = uniq([...keywords, ...BASE_KEYWORDS]).slice(0, 14);
  return {
    title,
    description: desc,
    keywords: kw,
    authors: [{ name: SITE_NAME, url: SITE_URL }],
    creator: SITE_NAME,
    publisher: SITE_NAME,
    alternates: { canonical: url },
    robots: noindex
      ? { index: false, follow: false, nocache: true }
      : { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 } },
    openGraph: { type, siteName: SITE_NAME, locale: 'ru_RU', url, title, description: desc, images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: title }] },
    twitter: { card: 'summary_large_image', title, description: desc, images: [OG_IMAGE] },
  };
}

// ───── Инструменты ─────
export function toolMeta(t) {
  const name = t.title;
  const low = name.toLowerCase();
  return buildMeta({
    title: `${name} онлайн бесплатно — PDFHub`,
    description: `${name} онлайн: ${t.desc} Бесплатно, без регистрации и установки программ — PDFHub.`,
    keywords: [low, `${low} онлайн`, `${low} бесплатно`, `${low} без регистрации`, `как ${low}`],
    path: `/${t.slug}`,
  });
}

// ───── Конвертеры ─────
const fmt = (s) => s.replace(/^WORD$/, 'Word').replace(/^EXCEL$/, 'Excel');
export function convMeta(c) {
  const a = fmt(c.from), b = fmt(c.to);
  return buildMeta({
    title: `Конвертер ${a} в ${b} онлайн бесплатно — PDFHub`,
    description: `Конвертируйте ${a} в ${b} онлайн за пару секунд: загрузите файл и скачайте готовый ${b}. Бесплатно, без регистрации и установки программ — PDFHub.`,
    keywords: [`${a} в ${b}`, `конвертер ${a} в ${b}`, `${a} в ${b} онлайн`, `перевести ${a} в ${b}`, `как конвертировать ${a} в ${b}`],
    path: `/convert/${c.id}`,
  });
}

// ───── JSON-LD ─────
export function toolLd(t, path) {
  return [
    { '@context': 'https://schema.org', '@type': 'WebApplication', name: t.title, description: t.desc, url: SITE_URL + path, applicationCategory: 'UtilitiesApplication', operatingSystem: 'Any', inLanguage: 'ru', offers: { '@type': 'Offer', price: '0', priceCurrency: 'RUB' }, provider: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL } },
    crumbs([['Главная', '/'], [t.title, path]]),
  ];
}
export function crumbs(items) {
  return { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map(([name, p], i) => ({ '@type': 'ListItem', position: i + 1, name, item: SITE_URL + (p === '/' ? '' : p) })) };
}
export const siteLd = [
  { '@context': 'https://schema.org', '@type': 'Organization', name: SITE_NAME, url: SITE_URL, logo: SITE_URL + '/icon-512.png' },
  { '@context': 'https://schema.org', '@type': 'WebSite', name: SITE_NAME, url: SITE_URL, inLanguage: 'ru' },
];
