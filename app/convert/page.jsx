import { buildMeta } from '@/lib/seo';
import PopularConversions from '@/components/PopularConversions';

export const metadata = buildMeta({
  title: 'Онлайн-конвертеры файлов: документы, изображения, видео, аудио — PDFHub',
  description: 'Бесплатные онлайн-конвертеры: PDF, Word, Excel, JPG, PNG, HEIC, MP4, MP3 и другие форматы. Без регистрации и установки программ.',
  keywords: ['конвертер файлов онлайн', 'конвертер документов', 'конвертер изображений', 'конвертер видео', 'конвертер аудио'],
  path: '/convert',
});

export default function Page() {
  return (
    <div className="container" style={{ paddingTop: 36 }}>
      <PopularConversions title="Все конвертации" startExpanded />
    </div>
  );
}
