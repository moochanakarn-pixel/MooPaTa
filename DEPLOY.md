# Deploy MooPaTa on your own VPS

Assumes Ubuntu/Debian with root or sudo access. Replace `yourdomain.com` and
`moopata` (Linux user) with your own values throughout.

## 1. Point a domain at the VPS

Add an A record for `yourdomain.com` (or a subdomain like `moopata.yourdomain.com`)
pointing at the VPS's public IP. Strava's OAuth callback needs a real HTTPS
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
- `STRAVA_CLIENT_ID` / `STRAVA_CLIENT_SECRET` — same as local dev, or a separate Strava API app if you want dev/prod isolated
- `STRAVA_REDIRECT_URI="https://yourdomain.com/api/auth/strava/callback"`
- `CRON_SECRET` — new value, `openssl rand -hex 32`

Then in the Strava API app settings (strava.com/settings/api), set
**Authorization Callback Domain** to `yourdomain.com` (no `https://`, no path).

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

## 7. Auto-sync via crontab

`/api/cron/sync` re-syncs every connected user's Strava activities. Trigger
it periodically with a crontab entry (as the `moopata` user):

```bash
crontab -e
```

Add (every 30 minutes here — adjust to taste, mind Strava's 200 req/15min limit
if you end up with many users):

```
*/30 * * * * curl -s -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" https://yourdomain.com/api/cron/sync >> /home/moopata/cron-sync.log 2>&1
```

Use the same value you put in `.env` as `CRON_SECRET`.

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

- **Strava redirects back with `error=invalid_state`**: `APP_BASE_URL` / `STRAVA_REDIRECT_URI`
  don't match what's configured in the Strava API app, or you're mixing http/https.
- **502 from Nginx**: check `pm2 logs moopata` — usually a missing/wrong env var.
- **Cron sync doing nothing**: check `cat /home/moopata/cron-sync.log`; a 401 means
  `CRON_SECRET` doesn't match between the crontab command and `.env`.
- **Cloudflare shows "too many redirects"**: SSL/TLS mode is on **Flexible** —
  switch it to **Full** (see step 1).
