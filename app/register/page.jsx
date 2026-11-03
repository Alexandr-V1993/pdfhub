import { buildMeta } from '@/lib/seo';
import AuthForm from '@/components/AuthForm';
export const metadata = buildMeta({ title: 'Регистрация — PDFHub', description: 'Регистрация в PDFHub: бесплатные онлайн-инструменты для работы с PDF.', path: '/register', noindex: true });
export default function Page() { return <AuthForm mode="register" />; }
