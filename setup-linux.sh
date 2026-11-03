#!/usr/bin/env bash
# Установка программ для серверных инструментов (Debian/Ubuntu). Запуск: sudo bash setup-linux.sh
set -e
apt-get update
apt-get install -y --no-install-recommends libreoffice-writer libreoffice-calc libreoffice-impress libreoffice-draw \
  qpdf ghostscript ffmpeg libheif-examples pandoc fonts-dejavu fonts-liberation fonts-noto-core fonts-crosextra-carlito fonts-crosextra-caladea
echo "Готово. Проверьте: curl http://localhost:3000/api/health"
