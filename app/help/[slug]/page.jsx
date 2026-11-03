import { notFound } from 'next/navigation';
import InfoPage, { pageMeta } from '@/components/InfoPage';
import { buildMeta } from '@/lib/seo';
import ToolsOverview from '@/components/ToolsOverview';

export const dynamicParams = false;
const SLUGS = { faq: 'faq', security: 'security', about: 'about', legal: 'legal', documentation: 'documentation' };

export function generateStaticParams() {
  return Object.keys(SLUGS).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  if (slug === 'documentation') return buildMeta({ title: 'Все инструменты PDF онлайн — каталог PDFHub', description: 'Полный каталог инструментов PDFHub: объединение, разделение, сжатие, конвертация, редактирование и защита PDF — и где выполняется каждый.', keywords: ['все инструменты pdf', 'каталог инструментов pdf'], path: '/help/documentation' });
  return SLUGS[slug] ? pageMeta(SLUGS[slug]) : {};
}

export default async function HelpPage({ params }) {
  const { slug } = await params;
  if (!SLUGS[slug]) notFound();
  if (slug === 'documentation') return <ToolsOverview />;
  return <InfoPage pageKey={slug} />;
}
