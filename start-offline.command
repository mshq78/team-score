#!/bin/sh
# Teamkeshi - offline mode on this laptop (no internet needed).
# Phones join this laptop's Wi-Fi hotspot and scan the judge QR cards.
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "[!] Node.js is not installed. Install it from https://nodejs.org BEFORE the event."
  read -r _
  exit 1
fi
if [ ! -f dist-server/server.mjs ]; then
  echo "[!] The app is not built yet. Run 'npm install' and 'npm run build:all' while you have internet."
  read -r _
  exit 1
fi
node dist-server/server.mjs --offline --open
