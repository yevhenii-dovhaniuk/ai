# Реєструє задачу в Планувальнику завдань Windows: сервер стартує при вході в систему
# і перезапускається, якщо впав.
#
# Запуск (звичайний PowerShell, з кореня репозиторію):
#   powershell -ExecutionPolicy Bypass -File deploy\windows\register-autostart.ps1
#
# Керування:
#   Start-ScheduledTask -TaskName "AI server"
#   Stop-ScheduledTask  -TaskName "AI server"
#   Unregister-ScheduledTask -TaskName "AI server" -Confirm:$false

param(
  [string]$TaskName = "AI server"
)

$ErrorActionPreference = "Stop"

$repo = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) {
  Write-Error "node не знайдено в PATH. Встановіть Node.js 24+ (winget install OpenJS.NodeJS.LTS)."
}

# Перед автозапуском веб-клієнт має бути зібраний
Push-Location $repo
try { npm run build:web } finally { Pop-Location }

$action = New-ScheduledTaskAction -Execute $node `
  -Argument "--env-file-if-exists=.env src/server/index.ts" `
  -WorkingDirectory $repo
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet `
  -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) `
  -ExecutionTimeLimit ([TimeSpan]::Zero) `
  -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
Start-ScheduledTask -TaskName $TaskName
Write-Host "Задачу '$TaskName' зареєстровано і запущено. Сервер: $repo"
