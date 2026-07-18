# Installation one-time de la recette CardTrade sur le VPS

La **version web est l'environnement de recette** : un seul process Node sert
l'API tRPC (`/trpc`) et le site web statique (`/`) sur le port 3002.
Les apps iOS/Android seront buildées (EAS) et publiées au dernier moment.

## 1. Sur le VPS (une seule fois)

```bash
# Node 20+ et pnpm doivent être présents (déjà le cas pour Loqato)
npm install -g pnpm

sudo mkdir -p /var/www/cardtrade
sudo chown "$USER" /var/www/cardtrade
git clone https://github.com/kaizen2025/Lbc.git /var/www/cardtrade
cd /var/www/cardtrade

cp .env.example .env
nano .env
#   DATABASE_URL   → postgres://postgres:<MDP>@db.znxijeqxfofzmiuamdzc.supabase.co:5432/postgres
#   PORT           → 3002        (3001 peut être pris par Loqato)
#   WEB_DIST       → /var/www/cardtrade/apps/mobile-web/dist
#   PRICE_SYNC_INTERVAL_HOURS → 24   (cotes mises à jour chaque jour)
#   NODE_ENV       → production

chmod +x deploy/recette.sh
bash deploy/recette.sh          # premier déploiement complet
```

> Le serveur charge automatiquement le `.env` de la racine du monorepo (dotenv) —
> aucune configuration pm2 supplémentaire n'est nécessaire.

## 2. Nginx (reverse proxy + domaine)

```nginx
server {
    server_name recette.cardtrade.example;   # ← ton (sous-)domaine
    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Puis `sudo certbot --nginx -d recette.cardtrade.example` pour le HTTPS.

## 3. Secrets GitHub (repo kaizen2025/Lbc → Settings → Secrets → Actions)

Mêmes noms que Loqato (copier les valeurs existantes) :

| Secret | Rôle |
|---|---|
| `VPS_SSH_KEY` | clé privée SSH de déploiement |
| `VPS_HOST` | 51.91.8.241 |
| `VPS_PORT` | port SSH |
| `VPS_USER` | ubuntu |

## 4. Fonctionnement ensuite

- Chaque **push sur `main`** (ou déclenchement manuel du workflow
  « Deploy recette web to VPS ») → `deploy/recette.sh` sur le VPS :
  `git pull` → `pnpm install` → build web Expo → `pm2 restart cardtrade`.
- Vérification : `https://<domaine>/health` doit répondre `{"ok":true}`.
