import { TOOLS } from '@/lib/tools';
import { ownConversions } from '@/lib/conversions';
import { SITE_URL } from '@/lib/seo';

export default function sitemap() {
  const now = new Date();
  const e = (p, priority, changeFrequency = 'monthly') => ({ url: p ? `${SITE_URL}/${p}` : SITE_URL, lastModified: now, changeFrequency, priority });
  return [
    e('', 1, 'weekly'),
    ...TOOLS.map((t) => e(t.slug, 0.9, 'weekly')),
    e('convert', 0.8, 'weekly'),
    ...ownConversions().map((c) => e(`convert/${c.id}`, 0.8)),
    ...['pricing', 'features', 'business', 'help/faq', 'help/security', 'help/about', 'help/documentation', 'help/legal', 'contact'].map((p) => e(p, 0.5)),
  ];
}
