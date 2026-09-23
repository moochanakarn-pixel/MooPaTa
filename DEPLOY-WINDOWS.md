# Deploy MooPaTa on a Windows Server VPS

For a VPS running **Windows Server** (not Linux) — the tooling in `DEPLOY.md`
(apt-get, Nginx, Certbot, systemd/PM2) doesn't apply here. The reverse proxy
in front of the Node process is **IIS** with the URL Rewrite module — see
step 6.

> **Corrected 2026-09-23.** This doc used to say IIS was skipped in favor of
> Caddy — that was wrong. An incident confirmed the live `moopata.mcnkth.com`
> deployment actually routes through IIS (via `IIS/web.config`'s URL Rewrite
> rule straight to `localhost:3000`): deleting that file as presumed dead
> weight took the site down with IIS's own default 500 page, because IIS's
> site config points its physical path directly at the `IIS/` folder in the
> repo checkout, and git doesn't track empty directories — so removing the
> one file inside it removed the whole folder from disk. `nssm status Caddy`
> on the production box returns "service does not exist" — Caddy was never
> actually installed there. **Never delete `IIS/web.config`.**

Replace `moopata.mcnkth.com` and the VPS IP with your own throughout — and
note production itself actually runs from `D:\Projectphp\MooPaTa`, not
`C:\MooPaTa` as used in the steps below (a leftover from when this doc was
first written as a from-scratch guide); adjust the drive/path to taste, just
be consistent about it across every step.

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
- `TOKEN_ENCRYPTION_KEY` / `SESSION_SECRET` — generate each with:
  ```powershell
  -join ((1..32) | ForEach-Object { "{0:x2}" -f (Get-Random -Max 256) })
  ```
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — from an OAuth 2.0 Client ID created in Google Cloud
  Console (APIs & Services → Credentials). Add
  `https://moopata.mcnkth.com/api/auth/google/callback` as an Authorized redirect URI on that
  client. Only needs the basic `email`/`profile`/`openid` scopes, so the OAuth consent screen
  doesn't require Google's manual review.
- `GOOGLE_REDIRECT_URI="https://moopata.mcnkth.com/api/auth/google/callback"`
- `RESEND_API_KEY` — from resend.com (free tier: 100 emails/day, 3,000/month, no card) — needed for
  email/password login's verification + password-reset emails. Optional: if left unset, the app
  doesn't crash, it just logs the verification/reset link to the server console instead of emailing
  it (and echoes it back as `devToken` in the API response) — fine for testing, but real users need
  this set to actually receive their links.
- `EMAIL_FROM="MooPaTa <noreply@yourdomain.com>"` — the domain must be verified in your Resend
  account first.

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

## 6. IIS — reverse proxy in front of the Node process

Confirmed against production (2026-09-23): the live site is an IIS site
named `MooPaTa`, physical path `<repo>\IIS` (the `IIS/` folder inside the
repo checkout — it holds nothing but `web.config`, already committed to the
repo so it comes along with the `git clone` in step 3, nothing to create by
hand), forwarding every request to `http://localhost:3000` via URL Rewrite.
**Never delete `IIS/web.config`** — see the warning at the top of this doc.

```powershell
# IIS itself, plus the URL Rewrite module (not a default IIS feature —
# a separate install)
Install-WindowsFeature -Name Web-Server, Web-Http-Redirect
Invoke-WebRequest -Uri "https://download.microsoft.com/download/1/2/8/128E2E22-C1B9-44A4-BE2A-5859ED1D4592/rewrite_amd64_en-US.msi" -OutFile "$env:TEMP\urlrewrite.msi"
Start-Process msiexec.exe -ArgumentList "/i `"$env:TEMP\urlrewrite.msi`" /quiet" -Wait

Import-Module WebAdministration
New-Website -Name "MooPaTa" -PhysicalPath "C:\MooPaTa\IIS" -Port 80 -HostHeader "moopata.mcnkth.com"
```

`IIS/web.config` (already in the repo — this is its full contents, nothing
more to add) holds the actual rewrite rule:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
    <system.webServer>
        <rewrite>
            <rules>
                <rule name="ReverseProxyInboundRule1" stopProcessing="true">
                    <match url="(.*)" />
                    <action type="Rewrite" url="http://localhost:3000/{R:1}" />
                </rule>
            </rules>
        </rewrite>
    </system.webServer>
</configuration>
```

**HTTPS binding + certificate**: production has an `https *:443:moopata.mcnkth.com`
binding alongside the `http` one, but exactly how that certificate was
issued/renewed hasn't been confirmed — check **IIS Manager → Sites →
MooPaTa → Bindings → edit the `https` entry** to see which certificate is
currently selected before following either option below on a fresh box:

- **win-acme** — the closest Windows/IIS equivalent of what Caddy would've
  done automatically: downloads a free Let's Encrypt certificate and can
  bind it into IIS for you. https://www.win-acme.com/
- **Cloudflare Origin Certificate** — if the domain is proxied through
  Cloudflare (orange cloud), generate one from the Cloudflare dashboard
  (SSL/TLS → Origin Server), import it into IIS's certificate store, then
  select it on the `https` binding — no public ACME validation needed here,
  since Cloudflare is the one presenting a cert to the public internet.

## 7. Open the firewall

Both Windows Firewall on the VPS **and** the VPS provider's own network
firewall/security group (check the ReadyIDC control panel — there may be a
separate "Firewall" section) need ports 80 and 443 open, or nobody outside
can reach the app — and if using win-acme (step 6), it needs inbound HTTP-01
validation on port 80 to issue or renew a certificate at all.

```powershell
New-NetFirewallRule -DisplayName "HTTP" -Direction Inbound -LocalPort 80 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "HTTPS" -Direction Inbound -LocalPort 443 -Protocol TCP -Action Allow
```

## 8. Cloudflare

If issuing a certificate with win-acme (step 6): same as the Linux guide,
keep the DNS record on **DNS only** (grey cloud) while it's validating, so
the HTTP-01 challenge reaches the VPS directly. Once
`https://moopata.mcnkth.com` loads with a valid padlock, switch SSL/TLS
mode to **Full (strict)** and, if wanted, flip the DNS record back to
**Proxied** (orange cloud).

If using a Cloudflare Origin Certificate instead, this doesn't apply the
same way — Cloudflare's proxy is what presents a certificate to the public
internet in that setup, so the DNS record can stay **Proxied** the whole
time; just make sure SSL/TLS mode is **Full (strict)**.

## 9. Strava auto-sync — removed

Strava sync (OAuth connect, `/api/sync/strava`, `/api/cron/sync`) was
removed entirely — see CLAUDE.md. If you still have the old `MooPaTaSync`
scheduled task from before this change, remove it (it now points at a
route that no longer exists):

```powershell
Unregister-ScheduledTask -TaskName "MooPaTaSync" -Confirm:$false
```

Historical Strava-synced activities are unaffected and keep displaying —
only the connect flow and the periodic re-sync are gone. Activities are
logged manually going forward (`/dashboard/log-activity`).

## 9b. Push notifications (water/whey/weekly-summary reminders) — removed

All three push-notification features (water-intake reminder, post-workout
whey reminder, weekly recap) were removed entirely — see CLAUDE.md. That
means `/api/cron/water-reminder`, `/api/cron/whey-reminder`, and
`/api/cron/weekly-summary` no longer exist (they now 404), and the
`PushSubscription` table + related `User`/`Activity` columns are gone from
the DB after this update's migration runs. If you have the three scheduled
tasks from before this change, remove them (they now point at routes that
no longer exist):

```powershell
Unregister-ScheduledTask -TaskName "MooPaTaWaterReminder" -Confirm:$false
Unregister-ScheduledTask -TaskName "MooPaTaWheyReminder" -Confirm:$false
Unregister-ScheduledTask -TaskName "MooPaTaWeeklySummary" -Confirm:$false
```

`CRON_SECRET`/`VAPID_PUBLIC_KEY`/`NEXT_PUBLIC_VAPID_PUBLIC_KEY`/
`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT` in `.env` are no longer read by anything
— safe to leave them there (harmless unused vars) or delete them, either way.

## 10. Deploying updates later

```powershell
cd C:\MooPaTa
nssm stop MooPaTa
git checkout -- package-lock.json
git pull origin claude/moopta-strava-huawei-integration-nlcpb5
npm install
npx prisma migrate deploy
npm run build
nssm start MooPaTa
```

Two Windows-specific gotchas this sequence works around:

- **`nssm stop` before `npm install`**: the running service keeps Prisma's
  query engine DLL open, so `npm install`'s `prisma generate` postinstall
  step fails with `EPERM: operation not permitted, rename ... query_engine-windows.dll.node`
  if the service is still running. Stop it first, start it again only
  after the build finishes.
- **`git checkout -- package-lock.json` before every pull**: `npm install`
  on Windows re-resolves Windows-only optional dependencies (Next.js's
  `@next/swc-win32-x64-msvc`, Prisma's Windows query engine, etc.) into
  `package-lock.json`, which differs from the Linux-generated lockfile
  committed to the repo — so it re-diverges after every single
  `npm install` on this machine, and the next `git pull` fails with
  `Your local changes to the following files would be overwritten by
  merge: package-lock.json` unless it's discarded first. This is expected
  and harmless to discard — `npm install` immediately regenerates it to
  match this machine either way.

## Troubleshooting

- **win-acme won't get a certificate**: almost always port 80/443 blocked
  somewhere — check both Windows Firewall (step 7) and the VPS provider's
  own network firewall panel.
- **Site loads but app is broken (500s)**: check whether it's IIS's own
  default error page (`IIS/web.config` missing or the `MooPaTa` site's
  physical path pointing at a folder that doesn't exist — see the warning
  at the top of this doc) versus the Node app itself erroring — `nssm
  status MooPaTa`, then check the Windows Event Viewer (Application log) or
  run `npm start` directly in a PowerShell window (not via the service) to
  see Node's own errors live.
- **Cloudflare "too many redirects"**: SSL/TLS mode is on Flexible — switch
  to Full, same as the Linux guide.
- **"Today" starts/ends at the wrong time, or water/whey reminders fire at
  the wrong hour**: every "today" boundary and reminder-schedule check runs
  on the server process's own local time — there's no per-user timezone
  anywhere in the app. Set `TZ="Asia/Bangkok"` in `.env` (see
  `.env.example`) and restart the `MooPaTa` service (`nssm restart MooPaTa`)
  — this works regardless of the Windows Server's own "Date & Time" setting
  (Settings → Time & language). To confirm it's taking effect, run
  `$env:TZ="Asia/Bangkok"; node -e "console.log(new Date().toString())"` in
  PowerShell — it should print a `GMT+0700` offset matching Thai time now.
