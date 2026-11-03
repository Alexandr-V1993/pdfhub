import { buildMeta } from '@/lib/seo';
import AccountView from '@/components/AccountView';
export const metadata = buildMeta({ title: 'Личный кабинет — PDFHub', description: 'Личный кабинет в PDFHub: бесплатные онлайн-инструменты для работы с PDF.', path: '/account', noindex: true });
export default function Page() { return <AccountView />; }
