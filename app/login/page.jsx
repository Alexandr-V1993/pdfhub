import { buildMeta } from '@/lib/seo';
import AuthForm from '@/components/AuthForm';
export const metadata = buildMeta({ title: 'Вход в аккаунт — PDFHub', description: 'Вход в аккаунт в PDFHub: бесплатные онлайн-инструменты для работы с PDF.', path: '/login', noindex: true });
export default function Page() { return <AuthForm mode="login" />; }
