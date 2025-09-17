#!/usr/bin/env bash
set -euo pipefail

PORT="${1:-4173}"

if ! command -v npm >/dev/null 2>&1; then
  echo "Fehler: npm wurde nicht gefunden. Bitte installiere Node.js inklusive npm."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "Installiere Projektabhängigkeiten (npm install)..."
  npm install
else
  echo "Abhängigkeiten bereits installiert – überspringe npm install."
fi

if [ ! -f .env.local ]; then
  echo "Hinweis: Es wurde keine .env.local gefunden. Falls ein GEMINI_API_KEY benötigt wird, lege die Datei vor dem Start an."
fi

echo "Starte Entwicklungsserver auf Port ${PORT}."

echo "Öffne anschließend http://localhost:${PORT}/ in deinem Browser, sobald der Build fertig ist."

echo "Beende den Server mit STRG+C."

npm run dev -- --host 0.0.0.0 --port "${PORT}"
