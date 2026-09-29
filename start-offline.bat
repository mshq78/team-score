@echo off
REM Teamkeshi - offline mode on this laptop (no internet needed).
REM Phones join this laptop's Wi-Fi hotspot and scan the judge QR cards.
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo [!] Node.js is not installed. Install it from https://nodejs.org BEFORE the event.
  pause
  exit /b 1
)
if not exist "dist-server\server.mjs" (
  echo [!] The app is not built yet. Run "npm install" and "npm run build:all" while you have internet.
  pause
  exit /b 1
)
echo If Windows Firewall asks, click "Allow access" (Private networks) so phones can connect.
node dist-server\server.mjs --offline --open
pause
