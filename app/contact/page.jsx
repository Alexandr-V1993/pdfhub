import { buildMeta } from '@/lib/seo';
import ContactForm from '@/components/ContactForm';
export const metadata = buildMeta({ title: 'Контакты и обратная связь — PDFHub', description: 'Напишите команде PDFHub: вопросы по инструментам, предложения, сообщения об ошибках. Отвечаем по электронной почте.', keywords: ['контакты pdfhub', 'обратная связь', 'поддержка pdfhub'], path: '/contact' });
export default function Page() {
  return (
    <div className="tool" style={{ maxWidth: 620 }}>
      <div className="tool__head">
        <h1>Контакты</h1>
        <p>Вопросы, предложения, сообщения об ошибках — напишите нам.</p>
      </div>
      <ContactForm />
    </div>
  );
}
