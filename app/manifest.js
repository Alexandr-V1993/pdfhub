export default function manifest() {
  return {
    name: 'PDFHub',
    short_name: 'PDFHub',
    description: 'Инструменты для работы с PDF',
    start_url: '/',
    display: 'standalone',
    background_color: '#f4f5f8',
    theme_color: '#4c5fd5',
    lang: 'ru',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  };
}
