/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: 'standalone',
  // пакеты с бинарными файлами/wasm не должны попадать в сборку — они подгружаются из node_modules
  serverExternalPackages: ['@ffmpeg-installer/ffmpeg', 'heic-convert', 'jszip'],
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
      ],
    }];
  },
  webpack: (config, { isServer }) => {
    // pdf.js и tesseract.js содержат ветки для Node — в браузерной сборке они не нужны
    config.resolve.alias = { ...config.resolve.alias, canvas: false, encoding: false };
    if (!isServer) config.resolve.fallback = { ...config.resolve.fallback, fs: false, path: false, zlib: false, os: false, net: false, tls: false, child_process: false, crypto: false, http: false, https: false, url: false, stream: false };
    return config;
  },
};
export default nextConfig;
