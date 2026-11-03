import './globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import JsonLd from '@/components/JsonLd';
import { buildMeta, SITE_URL, siteLd } from '@/lib/seo';

const verification = {};
if (process.env.GOOGLE_SITE_VERIFICATION) verification.google = process.env.GOOGLE_SITE_VERIFICATION;
if (process.env.YANDEX_VERIFICATION) verification.yandex = process.env.YANDEX_VERIFICATION;

export const metadata = {
  ...buildMeta({
    title: 'PDFHub — бесплатные онлайн-инструменты для работы с PDF',
    description: 'Объединяйте, разделяйте, сжимайте, конвертируйте, подписывайте и редактируйте PDF онлайн бесплатно. Без регистрации, файлы под защитой.',
    keywords: ['объединить pdf', 'разделить pdf', 'сжать pdf', 'pdf в word', 'word в pdf', 'конвертер pdf'],
    path: '/',
  }),
  metadataBase: new URL(SITE_URL),
  applicationName: 'PDFHub',
  category: 'utilities',
  formatDetection: { telephone: false, email: false, address: false },
  verification,
};

export const viewport = { themeColor: '#4c5fd5', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body>
        <JsonLd data={siteLd} />
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
