# Установка программ для серверных инструментов на Windows.
# Запуск: правый клик по файлу -> "Выполнить с помощью PowerShell" (лучше от имени администратора)
$ErrorActionPreference = 'Continue'
if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
  Write-Host 'winget не найден. Установите вручную: LibreOffice (libreoffice.org), qpdf (github.com/qpdf/qpdf/releases), Ghostscript (ghostscript.com).' -ForegroundColor Yellow
  exit 1
}
$apps = @(
  @{ id = 'TheDocumentFoundation.LibreOffice'; name = 'LibreOffice' },
  @{ id = 'QPDF.QPDF'; name = 'qpdf' },
  @{ id = 'ArtifexSoftware.GhostScript'; name = 'Ghostscript' },
  @{ id = 'Gyan.FFmpeg'; name = 'FFmpeg (видео и аудио)' },
  @{ id = 'JohnMacFarlane.Pandoc'; name = 'Pandoc (EPUB)' }
)
foreach ($a in $apps) {
  Write-Host "Устанавливаю $($a.name)..." -ForegroundColor Cyan
  winget install --id $a.id -e --accept-package-agreements --accept-source-agreements
}
Write-Host 'Готово. Перезапустите сайт (npm run dev / npm start) и откройте /api/health — программы должны быть true (HEIC на Windows без Docker не поддерживается).' -ForegroundColor Green
