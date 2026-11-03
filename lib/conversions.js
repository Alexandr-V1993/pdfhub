// Каталог конвертаций. Если задан href — это отдельный инструмент сайта, иначе открывается /convert/<id>.
// engine: office | canvas | svg | img-pdf | img-pdf-server | media | heic | epub | pdf-txt | pdf-png | csv-xlsx | xlsx-csv

const IMG_ACCEPT = { jpg: '.jpg,.jpeg', png: '.png', webp: '.webp', bmp: '.bmp', gif: '.gif', svg: '.svg', jpeg: '.jpg,.jpeg' };
const VIDEO_IN = '.mp4,.m4v,.mov,.avi,.mkv,.webm,.wmv,.flv';

export const CONVERSION_CATEGORIES = [
  { id: 'all', title: 'Все' },
  { id: 'documents', title: 'Документы' },
  { id: 'images', title: 'Изображения' },
  { id: 'video', title: 'Видео' },
  { id: 'audio', title: 'Аудио' },
];

const L = (from, to) => `${from} → ${to}`;
const link = (id, from, to, cat, href, label) => ({ id, from, to, cat, href, label: label || L(from, to) });
const conv = (id, from, to, cat, engine, accept, extra = {}) => ({ id, from, to, cat, engine, accept, label: L(from, to), ...extra });

export const CONVERSIONS = [
  link('pdf-word', 'PDF', 'DOCX', 'documents', '/pdf_to_word', 'PDF → Word'),
  link('word-pdf', 'WORD', 'PDF', 'documents', '/word_to_pdf', 'Word → PDF'),
  link('jpg-pdf', 'JPG', 'PDF', 'images', '/jpg_to_pdf'),
  link('compress-pdf', 'СЖАТЬ PDF', 'PDF', 'documents', '/compress_pdf', 'Сжать PDF'),
  conv('mp4-mp3', 'MP4', 'MP3', 'video', 'media', `${VIDEO_IN}`, { to_ext: 'mp3' }),
  conv('heic-jpg', 'HEIC', 'JPG', 'images', 'heic', '.heic,.heif', { to_ext: 'jpg' }),
  link('pdf-jpg', 'PDF', 'JPG', 'documents', '/pdf_to_jpg'),
  link('merge-pdf', 'ОБЪЕДИНИТЬ PDF', 'PDF', 'documents', '/merge_pdf', 'Объединить PDF'),
  link('excel-pdf', 'EXCEL', 'PDF', 'documents', '/excel_to_pdf', 'Excel → PDF'),
  conv('png-jpg', 'PNG', 'JPG', 'images', 'canvas', IMG_ACCEPT.png, { to_ext: 'jpg' }),
  conv('png-pdf', 'PNG', 'PDF', 'images', 'img-pdf', IMG_ACCEPT.png),
  conv('pdf-png', 'PDF', 'PNG', 'documents', 'pdf-png', '.pdf'),
  link('pptx-pdf', 'PPTX', 'PDF', 'documents', '/powerpoint_to_pdf'),
  link('pdf-pptx', 'PDF', 'PPTX', 'documents', '/pdf_to_powerpoint'),
  conv('webp-jpg', 'WEBP', 'JPG', 'images', 'canvas', IMG_ACCEPT.webp, { to_ext: 'jpg' }),
  conv('jpg-png', 'JPG', 'PNG', 'images', 'canvas', IMG_ACCEPT.jpg, { to_ext: 'png' }),
  conv('png-webp', 'PNG', 'WEBP', 'images', 'canvas', IMG_ACCEPT.png, { to_ext: 'webp' }),
  conv('webp-png', 'WEBP', 'PNG', 'images', 'canvas', IMG_ACCEPT.webp, { to_ext: 'png' }),
  conv('heic-pdf', 'HEIC', 'PDF', 'images', 'img-pdf-server', '.heic,.heif', { via: 'jpg' }),
  conv('svg-png', 'SVG', 'PNG', 'images', 'svg', '.svg', { to_ext: 'png' }),
  conv('bmp-jpg', 'BMP', 'JPG', 'images', 'canvas', IMG_ACCEPT.bmp, { to_ext: 'jpg' }),
  conv('tiff-pdf', 'TIFF', 'PDF', 'images', 'img-pdf-server', '.tif,.tiff', { via: 'png' }),
  conv('gif-png', 'GIF', 'PNG', 'images', 'canvas', IMG_ACCEPT.gif, { to_ext: 'png', note: 'Сохраняется первый кадр анимации.' }),
  conv('txt-pdf', 'TXT', 'PDF', 'documents', 'office', '.txt'),
  conv('rtf-pdf', 'RTF', 'PDF', 'documents', 'office', '.rtf'),
  conv('odt-pdf', 'ODT', 'PDF', 'documents', 'office', '.odt'),
  conv('pdf-txt', 'PDF', 'TXT', 'documents', 'pdf-txt', '.pdf'),
  conv('csv-xlsx', 'CSV', 'XLSX', 'documents', 'csv-xlsx', '.csv'),
  conv('xlsx-csv', 'XLSX', 'CSV', 'documents', 'xlsx-csv', '.xlsx,.xls'),
  link('html-pdf', 'HTML', 'PDF', 'documents', '/html-to-pdf'),
  conv('epub-pdf', 'EPUB', 'PDF', 'documents', 'epub', '.epub'),
  conv('mov-mp4', 'MOV', 'MP4', 'video', 'media', '.mov', { to_ext: 'mp4' }),
  conv('wav-mp3', 'WAV', 'MP3', 'audio', 'media', '.wav', { to_ext: 'mp3' }),
  conv('flac-mp3', 'FLAC', 'MP3', 'audio', 'media', '.flac', { to_ext: 'mp3' }),
  conv('m4a-mp3', 'M4A', 'MP3', 'audio', 'media', '.m4a', { to_ext: 'mp3' }),
  conv('mp3-wav', 'MP3', 'WAV', 'audio', 'media', '.mp3', { to_ext: 'wav' }),
  conv('avi-mp4', 'AVI', 'MP4', 'video', 'media', '.avi', { to_ext: 'mp4' }),
  conv('mkv-mp4', 'MKV', 'MP4', 'video', 'media', '.mkv', { to_ext: 'mp4' }),
  conv('mp4-gif', 'MP4', 'GIF', 'video', 'media', '.mp4,.mov,.webm,.m4v', { to_ext: 'gif', note: 'В GIF попадают первые 20 секунд, ширина до 480 px.' }),
  conv('gif-mp4', 'GIF', 'MP4', 'video', 'media', '.gif', { to_ext: 'mp4' }),
  link('pdf-xlsx', 'PDF', 'XLSX', 'documents', '/pdf_to_excel'),
  conv('xls-pdf', 'XLS', 'PDF', 'documents', 'office', '.xls'),
  conv('ppt-pdf', 'PPT', 'PDF', 'documents', 'office', '.ppt'),
  conv('doc-pdf', 'DOC', 'PDF', 'documents', 'office', '.doc'),
  conv('jpeg-webp', 'JPEG', 'WEBP', 'images', 'canvas', IMG_ACCEPT.jpeg, { to_ext: 'webp' }),
  conv('svg-jpg', 'SVG', 'JPG', 'images', 'svg', '.svg', { to_ext: 'jpg' }),
  conv('odp-pdf', 'ODP', 'PDF', 'documents', 'office', '.odp'),
  conv('ods-pdf', 'ODS', 'PDF', 'documents', 'office', '.ods'),
  conv('webm-mp4', 'WEBM', 'MP4', 'video', 'media', '.webm', { to_ext: 'mp4' }),
  conv('wmv-mp4', 'WMV', 'MP4', 'video', 'media', '.wmv', { to_ext: 'mp4' }),
  conv('ogg-mp3', 'OGG', 'MP3', 'audio', 'media', '.ogg,.oga', { to_ext: 'mp3' }),
  conv('aac-mp3', 'AAC', 'MP3', 'audio', 'media', '.aac', { to_ext: 'mp3' }),
];

export const getConversion = (id) => CONVERSIONS.find((c) => c.id === id);
export const hrefOf = (c) => c.href || `/convert/${c.id}`;
export const ownConversions = () => CONVERSIONS.filter((c) => !c.href);

// Цвета «плитки» исходного формата
const PALETTE = [
  [['PDF', 'СЖАТЬ PDF', 'ОБЪЕДИНИТЬ PDF'], ['#ff3a42', '#f00023']],
  [['DOC', 'DOCX', 'WORD', 'RTF', 'ODT'], ['#00bcff', '#0070f0']],
  [['XLS', 'XLSX', 'EXCEL', 'CSV', 'ODS'], ['#15d775', '#00aa60']],
  [['PPT', 'PPTX', 'ODP'], ['#ffab23', '#fb7200']],
  [['JPG', 'JPEG', 'HEIC', 'BMP', 'TIFF', 'GIF'], ['#ffa438', '#ff6900']],
  [['PNG', 'SVG'], ['#15b9ff', '#0086f6']],
  [['WEBP'], ['#15d57c', '#00aa64']],
  [['MP4', 'MOV', 'AVI', 'MKV', 'WEBM', 'WMV'], ['#a882ff', '#7444d4']],
  [['WAV', 'FLAC', 'M4A', 'MP3', 'OGG', 'AAC'], ['#ffb268', '#d77a2d']],
];
export function colorOf(fmt) {
  const hit = PALETTE.find(([names]) => names.includes(fmt));
  return hit ? hit[1] : ['#8ca1bf', '#60758f'];
}
