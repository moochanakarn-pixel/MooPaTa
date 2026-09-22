# Deploy MooPaTa on your own VPS

Assumes Ubuntu/Debian with root or sudo access. Replace `yourdomain.com` and
`moopata` (Linux user) with your own values throughout.

## 1. Point a domain at the VPS

Add an A record for `yourdomain.com` (or a subdomain like `moopata.yourdomain.com`)
pointing at the VPS's public IP. Google's OAuth callback needs a real HTTPS
domain — it will not work against a bare IP or `localhost`.

**If the domain is on Cloudflare**, two things matter or step 6 (Certbot) breaks:

- **SSL/TLS mode**: Cloudflare dashboard → SSL/TLS → set it to **Full** (or
  **Full (strict)** once Certbot has issued a cert). Leaving it on the default
  **Flexible** makes Cloudflare talk plain HTTP to the VPS while Nginx/Certbot
  force-redirects HTTP→HTTPS — the two fight and browsers see an infinite
  redirect loop.
- **Proxy status**: while running `certbot --nginx` in step 6, set the DNS
  record to **DNS only** (grey cloud, not orange) so Certbot's domain
  validation reaches the VPS directly. Switch it back to **Proxied** (orange
  cloud) afterward if you want Cloudflare's CDN/DDoS protection in front —
  Certbot's auto-renewal still works either way since it renews against the
  VPS, not through Cloudflare.

## 2. Mobile access

No extra setup — MooPaTa is already a PWA. Once the domain above serves over
real HTTPS, open it in a phone browser and use "Add to Home Screen" (Safari:
Share → Add to Home Screen; Chrome: menu → Install app). It installs as a
normal-looking home screen icon, no App Store involved.

## 3. Install Node.js and MySQL

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs mysql-server nginx

sudo mysql -e "CREATE DATABASE moopata CHARACTER SET utf8mb4;"
sudo mysql -e "CREATE USER 'moopata'@'localhost' IDENTIFIED BY 'CHANGE_ME';"
sudo mysql -e "GRANT ALL PRIVILEGES ON moopata.* TO 'moopata'@'localhost';"
```

(Already have MySQL running from local dev? Just create the `moopata` database/user on that instance instead.)

## 4. Clone and configure the app

```bash
sudo adduser --disabled-password moopata
sudo su - moopata

git clone https://github.com/moochanakarn-pixel/MooPaTa.git
cd MooPaTa
git checkout claude/moopta-strava-huawei-integration-nlcpb5   # or main, once merged

cp .env.example .env
nano .env
```

Fill in `.env` for production:

- `DATABASE_URL="mysql://moopata:CHANGE_ME@localhost:3306/moopata"`
- `APP_BASE_URL="https://yourdomain.com"` (real HTTPS domain, no trailing slash)
- `TOKEN_ENCRYPTION_KEY` / `SESSION_SECRET` — new values, `openssl rand -hex 32` each (don't reuse the ones from local dev)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` — from an OAuth 2.0 Client ID
  created in Google Cloud Console (APIs & Services → Credentials)

## 5. Build and run with PM2

```bash
npm install
npx prisma migrate deploy   # applies the migrations already committed to the repo
npm run build

sudo npm install -g pm2
pm2 start npm --name moopata -- start
pm2 save
pm2 startup   # follow the printed command (run it as root) so PM2 survives reboots
```

## 6. Nginx reverse proxy + HTTPS

```bash
sudo tee /etc/nginx/sites-available/moopata > /dev/null <<'EOF'
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/moopata /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

Certbot rewrites the Nginx config for HTTPS and sets up auto-renewal.

## 7. Push notifications — removed

Water/whey/weekly-summary push reminders (and their `/api/cron/*` routes,
`CRON_SECRET`, `VAPID_*` env vars) were removed entirely — see CLAUDE.md.
If you set up any crontab entries polling those routes, remove them; the
routes now 404.

## 8. Deploying updates later

```bash
sudo su - moopata
cd MooPaTa
git pull origin claude/moopta-strava-huawei-integration-nlcpb5
npm install
npx prisma migrate deploy
npm run build
pm2 restart moopata
```

## Troubleshooting

- **Google redirects back with `error=invalid_state`**: `APP_BASE_URL` / `GOOGLE_REDIRECT_URI`
  don't match what's configured in the Google Cloud Console OAuth client, or you're mixing http/https.
- **502 from Nginx**: check `pm2 logs moopata` — usually a missing/wrong env var.
- **Cloudflare shows "too many redirects"**: SSL/TLS mode is on **Flexible** —
  switch it to **Full** (see step 1).
- **"Today" starts/ends at the wrong time**: the server's OS timezone isn't
  Thai time and `TZ` isn't set in `.env` — every "today" boundary runs on the
  server process's own local time, with no per-user timezone anywhere. Set
  `TZ="Asia/Bangkok"` in `.env` (see `.env.example`) and restart PM2. To
  confirm it's taking effect: `TZ=Asia/Bangkok node -e "console.log(new Date().toString())"`
  should print a `GMT+0700` offset matching Thai time right now.
