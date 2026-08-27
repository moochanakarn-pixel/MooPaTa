# Deploy MooPaTa on a Windows Server VPS

For a VPS running **Windows Server** (not Linux) — the tooling in `DEPLOY.md`
(apt-get, Nginx, Certbot, systemd/PM2) doesn't apply here. This uses Windows-
native equivalents instead: IIS is skipped entirely in favor of **Caddy**,
which gets automatic HTTPS with about 5 lines of config and no separate
certificate step.

Replace `moopata.mcnkth.com` and the VPS IP with your own throughout.

## 1. Connect to the VPS

On your local Windows PC: `Win + R` → type `mstsc` → Enter. In the Remote
Desktop Connection window, enter the VPS's IP address, then sign in with the
Administrator username/password from your VPS provider's control panel
(ReadyIDC: Services → your VPS → Overview → Username/Password shown there).

Everything below runs **inside that Remote Desktop window** — this is a
second, separate Windows machine, not your own PC.

## 2. Install Node.js, Git, and MySQL

Inside the RDP session, open **PowerShell as Administrator** (right-click
Start → "Windows PowerShell (Admin)") and run:

```powershell
# Node.js LTS
Invoke-WebRequest -Uri "https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi" -OutFile "$env:TEMP\node.msi"
Start-Process msiexec.exe -ArgumentList "/i `"$env:TEMP\node.msi`" /quiet" -Wait

# Git
Invoke-WebRequest -Uri "https://github.com/git-for-windows/git/releases/download/v2.47.0.windows.2/Git-2.47.0.2-64-bit.exe" -OutFile "$env:TEMP\git.exe"
Start-Process "$env:TEMP\git.exe" -ArgumentList "/VERYSILENT /NORESTART" -Wait
```

Close and reopen PowerShell (Admin) so `node`, `npm`, and `git` are on PATH,
then verify: `node -v` and `git --version` should both print a version.

**MySQL**: install MySQL Community Server for Windows from
https://dev.mysql.com/downloads/installer/ (pick "Server only", set a root
password when prompted, remember it). Or skip this if you'd rather point
`DATABASE_URL` at a MySQL instance running elsewhere.

Create the database:

```powershell
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p -e "CREATE DATABASE moopata CHARACTER SET utf8mb4;"
```

## 3. Clone and configure the app

```powershell
cd C:\
git clone https://github.com/moochanakarn-pixel/MooPaTa.git
cd MooPaTa
git checkout claude/moopta-strava-huawei-integration-nlcpb5

Copy-Item .env.example .env
notepad .env
```

Fill in `.env` (same values as the Linux guide):

- `DATABASE_URL="mysql://root:YOUR_MYSQL_PASSWORD@localhost:3306/moopata"`
- `APP_BASE_URL="https://moopata.mcnkth.com"`
- `TOKEN_ENCRYPTION_KEY` / `SESSION_SECRET` / `CRON_SECRET` — generate each with:
  ```powershell
  -join ((1..32) | ForEach-Object { "{0:x2}" -f (Get-Random -Max 256) })
  ```
- `STRAVA_CLIENT_ID` / `STRAVA_CLIENT_SECRET` — from strava.com/settings/api
- `STRAVA_REDIRECT_URI="https://moopata.mcnkth.com/api/auth/strava/callback"`
- `VAPID_PUBLIC_KEY` / `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (same value, both vars) / `VAPID_PRIVATE_KEY` — needed for the
  water-reminder push notifications. Generate once with:
  ```powershell
  npx web-push generate-vapid-keys
  ```
  `VAPID_SUBJECT` can stay `mailto:` + whatever email you want push services to be able to reach you at.

Then in the Strava API app settings, set **Authorization Callback Domain**
to `moopata.mcnkth.com`.

## 4. Build the app

```powershell
npm install
npx prisma migrate deploy
npm run build
```

## 5. Run the app as a Windows service (NSSM)

`npm start` needs to keep running even after you log out of the RDP session
— [NSSM](https://nssm.cc/) wraps it as a proper Windows service.

```powershell
Invoke-WebRequest -Uri "https://nssm.cc/release/nssm-2.24.zip" -OutFile "$env:TEMP\nssm.zip"
Expand-Archive "$env:TEMP\nssm.zip" -DestinationPath "$env:TEMP\nssm"
Copy-Item "$env:TEMP\nssm\nssm-2.24\win64\nssm.exe" "C:\Windows\System32\"

nssm install MooPaTa "C:\Program Files\nodejs\npm.cmd" "start"
nssm set MooPaTa AppDirectory "C:\MooPaTa"
nssm start MooPaTa
```

Check it's up: `Invoke-WebRequest http://localhost:3000` should return status 200.

## 6. Caddy — reverse proxy with automatic HTTPS

Caddy replaces Nginx + Certbot: point it at a domain and it gets a real
Let's Encrypt certificate on its own, no separate steps.

```powershell
Invoke-WebRequest -Uri "https://github.com/caddyserver/caddy/releases/download/v2.8.4/caddy_2.8.4_windows_amd64.zip" -OutFile "$env:TEMP\caddy.zip"
Expand-Archive "$env:TEMP\caddy.zip" -DestinationPath "C:\Caddy"

@"
moopata.mcnkth.com {
    reverse_proxy localhost:3000
}
"@ | Out-File -Encoding utf8 "C:\Caddy\Caddyfile"

nssm install Caddy "C:\Caddy\caddy.exe" "run --config C:\Caddy\Caddyfile"
nssm set Caddy AppDirectory "C:\Caddy"
nssm start Caddy
```

## 7. Open the firewall

Both Windows Firewall on the VPS **and** the VPS provider's own network
firewall/security group (check the ReadyIDC control panel — there may be a
separate "Firewall" section) need ports 80 and 443 open, or Caddy can't
reach Let's Encrypt to issue the cert and nobody outside can reach the app.

```powershell
New-NetFirewallRule -DisplayName "HTTP" -Direction Inbound -LocalPort 80 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "HTTPS" -Direction Inbound -LocalPort 443 -Protocol TCP -Action Allow
```

## 8. Cloudflare

Same as the Linux guide: while Caddy is issuing its first certificate, keep
the DNS record on **DNS only** (grey cloud) so Let's Encrypt's validation
reaches the VPS directly. Once `https://moopata.mcnkth.com` loads with a
valid padlock, switch SSL/TLS mode to **Full (strict)** and, if wanted,
flip the DNS record back to **Proxied** (orange cloud).

## 9. Auto-sync — Windows Task Scheduler (crontab equivalent)

```powershell
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument '-Command "Invoke-RestMethod -Method Post -Uri https://moopata.mcnkth.com/api/cron/sync -Headers @{Authorization=''Bearer YOUR_CRON_SECRET''}"'
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 30) -RepetitionDuration ([TimeSpan]::MaxValue)
Register-ScheduledTask -TaskName "MooPaTaSync" -Action $action -Trigger $trigger -RunLevel Highest
```

Use the same value as `CRON_SECRET` in `.env`.

## 9b. Water reminder — two more scheduled tasks

Two check-ins a day, each hitting `/api/cron/water-reminder` with a
`checkpoint` telling it how far along the daily water target a user should
be by then (`afternoon` = 40%, `evening` = 75% — see that route's comment).
Only users who've turned reminders on (the toggle on the food page) get a
push; anyone already on pace at that checkpoint is skipped. Adjust the
`-At` times below to whatever your server's local time considers early/late
afternoon and evening.

```powershell
$secret = "YOUR_CRON_SECRET"

$afternoonAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-Command `"Invoke-RestMethod -Method Post -Uri 'https://moopata.mcnkth.com/api/cron/water-reminder?checkpoint=afternoon' -Headers @{Authorization='Bearer $secret'}`""
$afternoonTrigger = New-ScheduledTaskTrigger -Daily -At "2:00 PM"
Register-ScheduledTask -TaskName "MooPaTaWaterReminderAfternoon" -Action $afternoonAction -Trigger $afternoonTrigger -RunLevel Highest

$eveningAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-Command `"Invoke-RestMethod -Method Post -Uri 'https://moopata.mcnkth.com/api/cron/water-reminder?checkpoint=evening' -Headers @{Authorization='Bearer $secret'}`""
$eveningTrigger = New-ScheduledTaskTrigger -Daily -At "6:00 PM"
Register-ScheduledTask -TaskName "MooPaTaWaterReminderEvening" -Action $eveningAction -Trigger $eveningTrigger -RunLevel Highest
```

## 10. Deploying updates later

```powershell
cd C:\MooPaTa
git pull origin claude/moopta-strava-huawei-integration-nlcpb5
npm install
npx prisma migrate deploy
npm run build
nssm restart MooPaTa
```

## Troubleshooting

- **Caddy won't get a certificate**: almost always port 80/443 blocked
  somewhere — check both Windows Firewall (step 7) and the VPS provider's
  own network firewall panel. Check `nssm status Caddy` and look in
  `C:\Caddy` for a log file.
- **Site loads but app is broken (500s)**: `nssm status MooPaTa`, then check
  the Windows Event Viewer (Application log) or run `npm start` directly in
  a PowerShell window (not via the service) to see errors live.
- **Cloudflare "too many redirects"**: SSL/TLS mode is on Flexible — switch
  to Full, same as the Linux guide.
