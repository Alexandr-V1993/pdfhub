# ── сборка ──
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build

# ── рабочий образ: Node + LibreOffice + qpdf + Ghostscript + шрифты ──
FROM node:22-bookworm-slim
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 HOME=/home/app DATA_DIR=/app/data NEXT_TELEMETRY_DISABLED=1
RUN apt-get update && apt-get install -y --no-install-recommends \
      libreoffice-writer libreoffice-calc libreoffice-impress libreoffice-draw \
      qpdf ghostscript curl ffmpeg libheif-examples pandoc \
      fonts-dejavu fonts-liberation fonts-noto-core fonts-noto-cjk fonts-crosextra-carlito fonts-crosextra-caladea \
    && rm -rf /var/lib/apt/lists/* \
    && useradd -m -d /home/app -s /bin/sh app \
    && mkdir -p /app/data && chown -R app:app /app /home/app
WORKDIR /app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
USER app
VOLUME ["/app/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD curl -fs http://localhost:3000/api/health || exit 1
CMD ["node", "server.js"]
