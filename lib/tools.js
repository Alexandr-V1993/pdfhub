// Реестр инструментов. Одна запись = одна страница сайта (/<slug>).
// kind:
//   simple  — выполняется в браузере (ops из lib/ops.js)
//   server  — отправляется на сервер (/api/convert или /api/qpdf)
//   pages   — миниатюры страниц (organize / remove / extract)
//   editor  — редактор страницы (edit / sign / redact / crop)
//   forms   — заполнение форм
//   compare — сравнение двух файлов
//   ai      — резюме и перевод через Claude API

export const CATEGORIES = [
  { id: 'organize', title: 'Организация PDF', color: '#e8590c' },
  { id: 'optimize', title: 'Оптимизация PDF', color: '#2e9e5b' },
  { id: 'to-pdf', title: 'Конвертация в PDF', color: '#e8a100' },
  { id: 'from-pdf', title: 'Конвертация из PDF', color: '#2f7be5' },
  { id: 'edit', title: 'Редактирование PDF', color: '#8a4fe0' },
  { id: 'security', title: 'Безопасность PDF', color: '#2b3a55' },
  { id: 'ai', title: 'Умные инструменты', color: '#d6409f' },
];

const scopeFields = [
  {
    name: 'scope', label: 'Страницы', type: 'select', default: 'all',
    options: [
      { v: 'all', l: 'Все страницы' },
      { v: 'odd', l: 'Только нечётные' },
      { v: 'even', l: 'Только чётные' },
      { v: 'range', l: 'Указать диапазон' },
    ],
  },
  { name: 'range', label: 'Диапазон', type: 'text', default: '1-3', hint: 'Например: 1-3, 5, 8-', showIf: (o) => o.scope === 'range' },
];

const imageFields = [
  {
    name: 'pageSize', label: 'Размер страницы', type: 'select', default: 'a4',
    options: [
      { v: 'fit', l: 'По размеру изображения' },
      { v: 'a4', l: 'A4' },
      { v: 'letter', l: 'Letter' },
    ],
  },
  {
    name: 'orientation', label: 'Ориентация', type: 'select', default: 'auto',
    options: [
      { v: 'auto', l: 'Автоматически' },
      { v: 'portrait', l: 'Книжная' },
      { v: 'landscape', l: 'Альбомная' },
    ],
    showIf: (o) => o.pageSize !== 'fit',
  },
  {
    name: 'margin', label: 'Поля', type: 'select', default: '0',
    options: [{ v: '0', l: 'Без полей' }, { v: '20', l: 'Маленькие' }, { v: '40', l: 'Большие' }],
    showIf: (o) => o.pageSize !== 'fit',
  },
];

const langOptions = [
  { v: 'ru', l: 'Русский' }, { v: 'en', l: 'Английский' }, { v: 'de', l: 'Немецкий' },
  { v: 'fr', l: 'Французский' }, { v: 'es', l: 'Испанский' }, { v: 'it', l: 'Итальянский' },
  { v: 'pt', l: 'Португальский' }, { v: 'uk', l: 'Украинский' }, { v: 'pl', l: 'Польский' },
  { v: 'tr', l: 'Турецкий' },
];

export const TOOLS = [
  // ───────── Организация ─────────
  {
    slug: 'merge_pdf', title: 'Объединить PDF', cat: 'organize', icon: 'Combine',
    desc: 'Склейте несколько PDF-файлов в один документ в нужном порядке.',
    kind: 'simple', op: 'merge', accept: '.pdf', multiple: true, sortable: true, minFiles: 2,
    cta: 'Объединить PDF', nav: true,
  },
  {
    slug: 'split_pdf', title: 'Разделить PDF', cat: 'organize', icon: 'Scissors',
    desc: 'Разделите документ по диапазонам, по N страниц или на отдельные страницы.',
    kind: 'simple', op: 'split', accept: '.pdf', cta: 'Разделить PDF', nav: true,
    options: [
      {
        name: 'mode', label: 'Режим', type: 'select', default: 'ranges',
        options: [
          { v: 'ranges', l: 'По диапазонам' },
          { v: 'every', l: 'Каждые N страниц' },
          { v: 'each', l: 'Каждая страница отдельно' },
        ],
      },
      { name: 'ranges', label: 'Диапазоны', type: 'text', default: '1-3, 5, 8-', hint: 'Каждый диапазон станет отдельным файлом', showIf: (o) => o.mode === 'ranges' },
      { name: 'single', label: 'Собрать выбранные диапазоны в один файл', type: 'checkbox', default: false, showIf: (o) => o.mode === 'ranges' },
      { name: 'n', label: 'Количество страниц в файле', type: 'number', default: 2, min: 1, showIf: (o) => o.mode === 'every' },
    ],
  },
  {
    slug: 'remove-pages', title: 'Удалить страницы', cat: 'organize', icon: 'Trash2',
    desc: 'Отметьте ненужные страницы на миниатюрах и удалите их.',
    kind: 'pages', mode: 'remove', accept: '.pdf',
  },
  {
    slug: 'extract-pages', title: 'Извлечь страницы', cat: 'organize', icon: 'FileOutput',
    desc: 'Выберите страницы на миниатюрах и сохраните их в новый PDF.',
    kind: 'pages', mode: 'extract', accept: '.pdf',
  },
  {
    slug: 'organize-pdf', title: 'Упорядочить PDF', cat: 'organize', icon: 'LayoutGrid',
    desc: 'Меняйте порядок страниц перетаскиванием, поворачивайте и удаляйте их.',
    kind: 'pages', mode: 'organize', accept: '.pdf',
  },
  {
    slug: 'scan-pdf', title: 'Сканировать в PDF', cat: 'organize', icon: 'ScanLine',
    desc: 'Сфотографируйте документы камерой или загрузите снимки — получите чистый PDF.',
    kind: 'simple', op: 'images2pdf', accept: 'image/*', multiple: true, sortable: true, capture: true,
    cta: 'Создать PDF', defaults: { filter: 'bw', pageSize: 'a4' },
    options: [
      ...imageFields,
      {
        name: 'filter', label: 'Обработка', type: 'select', default: 'bw',
        options: [
          { v: 'none', l: 'Без обработки' },
          { v: 'gray', l: 'Оттенки серого' },
          { v: 'bw', l: 'Чёрно-белый скан' },
        ],
      },
    ],
  },

  // ───────── Оптимизация ─────────
  {
    slug: 'compress_pdf', title: 'Сжать PDF', cat: 'optimize', icon: 'FileDown',
    desc: 'Уменьшите размер PDF. Лёгкое сжатие сохраняет текст, сильное — превращает страницы в картинки.',
    kind: 'simple', op: 'compress', accept: '.pdf', multiple: true, cta: 'Сжать PDF', nav: true,
    options: [
      {
        name: 'level', label: 'Уровень сжатия', type: 'select', default: 'strong',
        options: [
          { v: 'light', l: 'Лёгкое — текст остаётся текстом (эффект небольшой)' },
          { v: 'strong', l: 'Сильное — страницы станут изображениями' },
          { v: 'extreme', l: 'Максимальное — низкое качество' },
        ],
      },
    ],
  },
  {
    slug: 'repair-pdf', title: 'Восстановить PDF', cat: 'optimize', icon: 'Wrench',
    desc: 'Попытка починить повреждённый PDF и восстановить его структуру.',
    kind: 'server', accept: '.pdf', multiple: true, cta: 'Восстановить PDF',
    server: { endpoint: '/api/qpdf', params: { op: 'repair' } },
  },
  {
    slug: 'ocr-pdf', title: 'OCR PDF', cat: 'optimize', icon: 'ScanText',
    desc: 'Распознайте текст в сканах: получите PDF с поиском и копированием текста, плюс .txt.',
    kind: 'simple', op: 'ocr', accept: '.pdf', cta: 'Распознать текст',
    options: [
      {
        name: 'lang', label: 'Язык документа', type: 'select', default: 'rus+eng',
        options: [
          { v: 'rus+eng', l: 'Русский + английский' },
          { v: 'eng', l: 'Английский' },
          { v: 'rus', l: 'Русский' },
          { v: 'deu+eng', l: 'Немецкий + английский' },
          { v: 'fra+eng', l: 'Французский + английский' },
          { v: 'spa+eng', l: 'Испанский + английский' },
          { v: 'ukr+eng', l: 'Украинский + английский' },
        ],
      },
    ],
  },

  // ───────── В PDF ─────────
  {
    slug: 'jpg_to_pdf', title: 'JPG в PDF', cat: 'to-pdf', icon: 'FileImage',
    desc: 'Превратите изображения (JPG, PNG, WebP…) в PDF. Порядок можно менять.',
    kind: 'simple', op: 'images2pdf', accept: 'image/*', multiple: true, sortable: true, cta: 'Создать PDF', nav: true,
    options: [
      ...imageFields,
      { name: 'filter', label: 'Обработка', type: 'select', default: 'none', options: [{ v: 'none', l: 'Без обработки' }, { v: 'gray', l: 'Оттенки серого' }, { v: 'bw', l: 'Чёрно-белый скан' }] },
    ],
  },
  {
    slug: 'word_to_pdf', title: 'WORD в PDF', cat: 'to-pdf', icon: 'FileText',
    desc: 'Конвертация документов DOC, DOCX, ODT, RTF в PDF.',
    kind: 'server', accept: '.doc,.docx,.odt,.rtf,.txt', multiple: true, cta: 'Конвертировать в PDF',
    server: { endpoint: '/api/convert', params: { target: 'pdf' } },
  },
  {
    slug: 'powerpoint_to_pdf', title: 'POWERPOINT в PDF', cat: 'to-pdf', icon: 'Presentation',
    desc: 'Конвертация презентаций PPT, PPTX, ODP в PDF.',
    kind: 'server', accept: '.ppt,.pptx,.odp', multiple: true, cta: 'Конвертировать в PDF',
    server: { endpoint: '/api/convert', params: { target: 'pdf' } },
  },
  {
    slug: 'excel_to_pdf', title: 'EXCEL в PDF', cat: 'to-pdf', icon: 'Sheet',
    desc: 'Конвертация таблиц XLS, XLSX, ODS, CSV в PDF.',
    kind: 'server', accept: '.xls,.xlsx,.ods,.csv', multiple: true, cta: 'Конвертировать в PDF',
    server: { endpoint: '/api/convert', params: { target: 'pdf' } },
  },
  {
    slug: 'html-to-pdf', title: 'HTML в PDF', cat: 'to-pdf', icon: 'Code',
    desc: 'Загрузите HTML-файл или вставьте код — получите PDF.',
    kind: 'server', accept: '.html,.htm', multiple: false, cta: 'Конвертировать в PDF',
    server: { endpoint: '/api/convert', params: { target: 'pdf-html' } },
    textInput: { label: 'Или вставьте HTML-код', filename: 'page.html', mime: 'text/html', placeholder: '<h1>Привет!</h1><p>Это мой документ.</p>' },
  },

  // ───────── Из PDF ─────────
  {
    slug: 'pdf_to_jpg', title: 'PDF в JPG', cat: 'from-pdf', icon: 'Image',
    desc: 'Сохраните каждую страницу PDF как изображение.',
    kind: 'simple', op: 'pdf2img', accept: '.pdf', cta: 'Конвертировать в изображения', nav: true,
    options: [
      { name: 'format', label: 'Формат', type: 'select', default: 'jpeg', options: [{ v: 'jpeg', l: 'JPG' }, { v: 'png', l: 'PNG' }] },
      { name: 'dpi', label: 'Качество (DPI)', type: 'select', default: '150', options: [{ v: '72', l: '72 — для экрана' }, { v: '150', l: '150 — обычное' }, { v: '200', l: '200 — хорошее' }, { v: '300', l: '300 — для печати' }] },
    ],
  },
  {
    slug: 'pdf_to_word', title: 'PDF в WORD', cat: 'from-pdf', icon: 'FileText',
    desc: 'Конвертация PDF в редактируемый DOCX. Сложная вёрстка может сместиться.',
    kind: 'server', accept: '.pdf', multiple: true, cta: 'Конвертировать в WORD',
    server: { endpoint: '/api/convert', params: { target: 'docx' } },
  },
  {
    slug: 'pdf_to_powerpoint', title: 'PDF в POWERPOINT', cat: 'from-pdf', icon: 'Presentation',
    desc: 'Конвертация PDF в презентацию PPTX.',
    kind: 'server', accept: '.pdf', multiple: true, cta: 'Конвертировать в POWERPOINT',
    server: { endpoint: '/api/convert', params: { target: 'pptx' } },
  },
  {
    slug: 'pdf_to_excel', title: 'PDF в EXCEL', cat: 'from-pdf', icon: 'Sheet',
    desc: 'Извлечение таблиц и текста из PDF в XLSX: по листу на страницу. Лучше всего работает с простыми таблицами.',
    kind: 'simple', op: 'pdf2xlsx', accept: '.pdf', cta: 'Конвертировать в EXCEL',
  },
  {
    slug: 'convert-pdf-to-pdfa', title: 'PDF в PDF/A', cat: 'from-pdf', icon: 'FileCheck',
    desc: 'Преобразуйте PDF в формат архивного хранения PDF/A.',
    kind: 'server', accept: '.pdf', multiple: true, cta: 'Конвертировать в PDF/A',
    server: { endpoint: '/api/convert', params: { target: 'pdfa' } },
  },

  // ───────── Редактирование ─────────
  {
    slug: 'rotate_pdf', title: 'Повернуть PDF', cat: 'edit', icon: 'RotateCw',
    desc: 'Поверните все или выбранные страницы на 90°, 180° или 270°.',
    kind: 'simple', op: 'rotate', accept: '.pdf', multiple: true, cta: 'Повернуть PDF',
    options: [
      {
        name: 'angle', label: 'Поворот', type: 'select', default: '90',
        options: [{ v: '90', l: 'По часовой стрелке на 90°' }, { v: '180', l: 'На 180°' }, { v: '270', l: 'Против часовой стрелки на 90°' }],
      },
      ...scopeFields,
    ],
  },
  {
    slug: 'add_pdf_page_number', title: 'Номера страниц', cat: 'edit', icon: 'ListOrdered',
    desc: 'Добавьте нумерацию страниц: положение, формат, размер и цвет.',
    kind: 'simple', op: 'pagenumbers', accept: '.pdf', cta: 'Добавить номера',
    options: [
      {
        name: 'position', label: 'Положение', type: 'select', default: 'bc',
        options: [
          { v: 'bc', l: 'Внизу по центру' }, { v: 'br', l: 'Внизу справа' }, { v: 'bl', l: 'Внизу слева' },
          { v: 'tc', l: 'Вверху по центру' }, { v: 'tr', l: 'Вверху справа' }, { v: 'tl', l: 'Вверху слева' },
        ],
      },
      {
        name: 'format', label: 'Формат', type: 'select', default: '{n}',
        options: [{ v: '{n}', l: '1, 2, 3…' }, { v: '{n} / {total}', l: '1 / 10' }, { v: 'Страница {n} из {total}', l: 'Страница 1 из 10' }],
      },
      { name: 'from', label: 'Начать со страницы', type: 'number', default: 1, min: 1 },
      { name: 'start', label: 'Первый номер', type: 'number', default: 1 },
      { name: 'size', label: 'Размер шрифта', type: 'number', default: 11, min: 6, max: 72 },
      { name: 'color', label: 'Цвет', type: 'color', default: '#000000' },
      { name: 'margin', label: 'Отступ от края, pt', type: 'number', default: 24, min: 0, max: 200 },
    ],
  },
  {
    slug: 'pdf_add_watermark', title: 'Водяной знак', cat: 'edit', icon: 'Droplets',
    desc: 'Наложите текст или изображение на страницы PDF.',
    kind: 'simple', op: 'watermark', accept: '.pdf', cta: 'Добавить водяной знак',
    options: [
      { name: 'type', label: 'Тип', type: 'select', default: 'text', options: [{ v: 'text', l: 'Текст' }, { v: 'image', l: 'Изображение' }] },
      { name: 'text', label: 'Текст', type: 'text', default: 'КОНФИДЕНЦИАЛЬНО', showIf: (o) => o.type === 'text' },
      { name: 'size', label: 'Размер шрифта', type: 'number', default: 64, min: 8, max: 300, showIf: (o) => o.type === 'text' },
      { name: 'color', label: 'Цвет', type: 'color', default: '#e5322d', showIf: (o) => o.type === 'text' },
      { name: 'image', label: 'Изображение (PNG или JPG)', type: 'file', accept: 'image/png,image/jpeg', showIf: (o) => o.type === 'image' },
      { name: 'scale', label: 'Ширина изображения, % от страницы', type: 'number', default: 50, min: 5, max: 100, showIf: (o) => o.type === 'image' },
      { name: 'opacity', label: 'Прозрачность', type: 'range', default: 0.25, min: 0.05, max: 1, step: 0.05 },
      { name: 'rotation', label: 'Поворот, °', type: 'number', default: 45, min: -180, max: 180 },
      { name: 'layout', label: 'Расположение', type: 'select', default: 'center', options: [{ v: 'center', l: 'По центру' }, { v: 'tile', l: 'Мозаикой по всей странице' }] },
      ...scopeFields,
    ],
  },
  {
    slug: 'crop-pdf', title: 'Обрезать PDF', cat: 'edit', icon: 'Crop',
    desc: 'Выделите область на странице — всё остальное будет обрезано.',
    kind: 'editor', mode: 'crop', accept: '.pdf',
  },
  {
    slug: 'edit-pdf', title: 'Редактировать PDF', cat: 'edit', icon: 'Pencil',
    desc: 'Добавляйте текст, фигуры, рисунки и изображения поверх страниц.',
    kind: 'editor', mode: 'edit', accept: '.pdf',
  },
  {
    slug: 'pdf-forms', title: 'Формы PDF', cat: 'edit', icon: 'ClipboardList',
    desc: 'Заполните интерактивные поля PDF-формы и при желании «запеките» их в документ.',
    kind: 'forms', accept: '.pdf',
  },

  // ───────── Безопасность ─────────
  {
    slug: 'unlock_pdf', title: 'Разблокировать PDF', cat: 'security', icon: 'Unlock',
    desc: 'Снимите защиту паролем и ограничения на печать и копирование.',
    kind: 'server', accept: '.pdf', multiple: true, cta: 'Разблокировать PDF',
    server: { endpoint: '/api/qpdf', params: { op: 'unlock' } },
    options: [{ name: 'password', label: 'Пароль (если он нужен для открытия файла)', type: 'password', default: '' }],
  },
  {
    slug: 'protect-pdf', title: 'Защитить PDF', cat: 'security', icon: 'Lock',
    desc: 'Зашифруйте PDF паролем (AES-256) и ограничьте печать, копирование и правку.',
    kind: 'server', accept: '.pdf', multiple: true, cta: 'Защитить PDF',
    server: { endpoint: '/api/qpdf', params: { op: 'protect' } },
    options: [
      { name: 'password', label: 'Пароль для открытия', type: 'password', default: '', required: true },
      { name: 'noPrint', label: 'Запретить печать', type: 'checkbox', default: false },
      { name: 'noCopy', label: 'Запретить копирование текста', type: 'checkbox', default: false },
      { name: 'noModify', label: 'Запретить редактирование', type: 'checkbox', default: false },
    ],
  },
  {
    slug: 'sign-pdf', title: 'Подписать PDF', cat: 'security', icon: 'PenTool',
    desc: 'Нарисуйте подпись, наберите её или загрузите картинку и поставьте на страницу.',
    kind: 'editor', mode: 'sign', accept: '.pdf',
  },
  {
    slug: 'redact-pdf', title: 'Скрыть данные в PDF', cat: 'security', icon: 'EyeOff',
    desc: 'Закрасьте конфиденциальные данные безвозвратно — текст под чёрными блоками удаляется.',
    kind: 'editor', mode: 'redact', accept: '.pdf',
  },
  {
    slug: 'compare-pdf', title: 'Сравнить PDF', cat: 'security', icon: 'GitCompare',
    desc: 'Найдите различия между двумя версиями документа — по тексту и визуально.',
    kind: 'compare', accept: '.pdf',
  },

  // ───────── Умные инструменты ─────────
  {
    slug: 'pdf-summarize', title: 'ИИ-резюме PDF', cat: 'ai', icon: 'Sparkles',
    desc: 'Краткое изложение документа: главные мысли, выводы и цифры.',
    kind: 'ai', action: 'summarize', accept: '.pdf',
  },
  {
    slug: 'translate-pdf', title: 'Перевести PDF', cat: 'ai', icon: 'Languages',
    desc: 'Перевод текста документа на другой язык (результат — PDF и TXT без исходной вёрстки).',
    kind: 'ai', action: 'translate', accept: '.pdf',
  },
  {
    slug: 'pdf-to-markdown', title: 'PDF в Markdown', cat: 'ai', icon: 'FileCode',
    desc: 'Извлеките текст со структурой: заголовки, списки и абзацы.',
    kind: 'simple', op: 'pdf2md', accept: '.pdf', cta: 'Конвертировать в Markdown',
  },
];

export const LANGUAGES = langOptions;

export const getTool = (slug) => TOOLS.find((t) => t.slug === slug);
export const toolsByCat = (cat) => TOOLS.filter((t) => t.cat === cat);
export const catOf = (tool) => CATEGORIES.find((c) => c.id === tool.cat);
export const defaultOptions = (tool) => {
  const o = {};
  for (const f of tool.options || []) o[f.name] = f.default ?? (f.type === 'checkbox' ? false : '');
  return { ...o, ...(tool.defaults || {}) };
};
