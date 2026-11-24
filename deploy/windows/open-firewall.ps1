# Відкриває вхідний TCP-порт у брандмауері Windows, щоб до сервера можна було зайти
# з телефона в локальній мережі або з інтернету (разом із пробросом порту на роутері).
#
# Запуск (PowerShell від імені адміністратора):
#   powershell -ExecutionPolicy Bypass -File deploy\windows\open-firewall.ps1 -Port 3000
#
# Видалити правило:
#   Remove-NetFirewallRule -DisplayName "AI server (TCP 3000)"

param(
  [int]$Port = 3000
)

$ErrorActionPreference = "Stop"

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).
  IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
  Write-Error "Запустіть PowerShell від імені адміністратора."
}

$name = "AI server (TCP $Port)"
if (Get-NetFirewallRule -DisplayName $name -ErrorAction SilentlyContinue) {
  Write-Host "Правило '$name' вже існує."
} else {
  New-NetFirewallRule -DisplayName $name -Direction Inbound -Protocol TCP -LocalPort $Port -Action Allow -Profile Any | Out-Null
  Write-Host "Відкрито вхідний порт $Port."
}

Write-Host ""
Write-Host "Локальні IP цього комп'ютера (для телефона в тій самій Wi-Fi мережі):"
Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" } |
  ForEach-Object { Write-Host ("  http://{0}:{1}" -f $_.IPAddress, $Port) }
