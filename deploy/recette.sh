#!/usr/bin/env bash
# Déploiement de la recette CardTrade sur le VPS.
# Prérequis one-time : voir deploy/VPS_SETUP.md
set -euo pipefail

cd /var/www/cardtrade

echo "→ git pull"
git pull origin main

echo "→ pnpm install"
pnpm install --frozen-lockfile

echo "→ build web (Expo export)"
cd apps/mobile-web
npx expo export --platform web --output-dir dist
cd ../..

echo "→ restart pm2"
# Le serveur sert l'API (/trpc) ET le build web (/) sur le même port.
pm2 restart cardtrade || pm2 start "pnpm --filter @cardtrade/server start" --name cardtrade
pm2 save

echo "✅ Recette CardTrade déployée"
