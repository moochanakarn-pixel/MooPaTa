# MooPaTa

เว็บแอพบันทึกกิจกรรมออกกำลังกาย อาหาร น้ำ น้ำหนัก และอาหารเสริมไว้ที่เดียว

## สถาปัตยกรรมคร่าวๆ

- **Next.js 14 (App Router)** + TypeScript + Tailwind
- **MySQL** ผ่าน **Prisma ORM** — เก็บผู้ใช้, token ของแต่ละ provider (เข้ารหัสด้วย AES-256-GCM), และ activity ที่ normalize เป็น schema กลาง
- Login ทำได้ 2 ทาง: "Sign in with Google" (OAuth2) หรืออีเมล+รหัสผ่านของตัวเอง — ทั้งสองทางผูกกับ
  `userId` เดียวกันได้จากหน้าตั้งค่า (ดูรายละเอียดที่ CLAUDE.md's "### 0. ระบบ login")
- Session เก็บเป็น JWT ใน httpOnly cookie (เซ็นด้วย `SESSION_SECRET`)
- โครง provider adapter (`src/lib/providers/*.ts`) ให้ Google คืนข้อมูลผ่าน type กลาง
  (`NormalizedActivity`/`OAuthTokenSet`) แยกจาก dashboard/DB schema — กิจกรรมออกกำลังกายทั้งหมด
  บันทึกเองที่ `/dashboard/log-activity` (`provider: MANUAL`); Strava sync เคยมีแต่ถูกลบออกแล้ว
  (กิจกรรมเก่าที่เคย sync มายังอยู่ครบ แค่ไม่มีทาง sync ใหม่ — ดู CLAUDE.md)

## เริ่มต้นใช้งาน (local dev)

### 1. เตรียม MySQL

ต้องใช้ MySQL 5.7+ (แนะนำ 8.x) สร้างฐานข้อมูลเปล่าไว้ก่อน:

```sql
CREATE DATABASE moopata CHARACTER SET utf8mb4;
```

> หมายเหตุ: โปรเจกต์นี้ใช้ Prisma ซึ่งรองรับ MySQL อย่างเป็นทางการตั้งแต่ 5.6/5.7 ขึ้นไป — MySQL 5.1 (EOL ตั้งแต่ปี 2013) ไม่รองรับและไม่ได้ทดสอบ
>
> ถ้ารัน MySQL 8.x คู่กับ instance เก่าบนเครื่องเดียวกัน (เช่น ลง MySQL 8.4 แยก service/port ไม่ให้ชนกับ 5.1 ที่มีอยู่แล้ว) อย่าลืมระบุ **port ที่ไม่ใช่ 3306** ใน `DATABASE_URL` ให้ตรงกับ instance ใหม่ และถ้าใช้ client ที่ยังไม่รองรับ `caching_sha2_password` (เช่น SQLyog รุ่นเก่า) ต้องเปลี่ยน root ให้ใช้ `mysql_native_password` ก่อน ไม่งั้น Prisma/mysql2 ก็จะต่อไม่ติดเหมือนกัน

### 2. ติดตั้ง dependency

```bash
npm install
```

### 3. ตั้งค่า environment variables

```bash
cp .env.example .env
```

แล้วแก้ค่าต่อไปนี้ใน `.env`:

- `DATABASE_URL` — connection string ไปยัง MySQL ที่สร้างไว้ เช่น `mysql://root:password@localhost:3306/moopata` (เปลี่ยน port ตามที่ instance ของคุณรันจริง เช่น `3308` ถ้ามี MySQL ตัวอื่นครอง 3306/3307 อยู่แล้ว)
- `TOKEN_ENCRYPTION_KEY` และ `SESSION_SECRET` — สร้างด้วย `openssl rand -hex 32` (คนละค่ากัน)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — สร้าง OAuth 2.0 Client ID ได้ที่ Google Cloud Console
  (APIs & Services → Credentials)
- `GOOGLE_REDIRECT_URI` — ต้องตรงกับ `APP_BASE_URL` + `/api/auth/google/callback` เป๊ะๆ และตั้งเป็น
  Authorized redirect URI บน OAuth client นั้นด้วย
- `RESEND_API_KEY` / `EMAIL_FROM` — สำหรับอีเมลยืนยัน/รีเซ็ตรหัสผ่าน (ไม่ตั้งไว้ก็ไม่ crash — แค่ log
  ลิงก์ลง console แทน ดู CLAUDE.md's "### 0. ระบบ login")

### 4. สร้างตารางในฐานข้อมูล

```bash
npx prisma migrate dev --name init
```

### 5. รัน dev server

```bash
npm run dev
```

เปิด http://localhost:3000 แล้วกด "เข้าสู่ระบบด้วย Google" หรือสมัครด้วยอีเมล

## Deploy จริง

ดูขั้นตอนละเอียดสำหรับ deploy ขึ้น VPS ของตัวเอง — [DEPLOY-WINDOWS.md](./DEPLOY-WINDOWS.md) (Windows
Server ผ่าน nssm, ที่ใช้งานจริงตอนนี้) หรือ [DEPLOY.md](./DEPLOY.md) (ฉบับ Linux/Nginx/PM2 เดิม)

สรุปคร่าวๆ:
- เปลี่ยน `DATABASE_URL` ไปที่ MySQL ของ production
- รัน `npx prisma migrate deploy` ตอน deploy แทน `migrate dev`
- อัปเดต `APP_BASE_URL`, `GOOGLE_REDIRECT_URI` และ Authorized redirect URI บน Google Cloud Console
  ให้เป็นโดเมนจริง (ต้องเป็น HTTPS)
- ตั้ง `CRON_SECRET` สำหรับ endpoint แจ้งเตือนน้ำ/อาหารเสริม (`/api/cron/water-reminder`,
  `/api/cron/whey-reminder`) — ดูตัวอย่าง scheduled task ใน DEPLOY-WINDOWS.md/DEPLOY.md

## โครงสร้างไฟล์สำคัญ

```
prisma/schema.prisma              โมเดล User / ProviderConnection / Activity (schema กลาง)
src/lib/crypto.ts                 เข้ารหัส/ถอดรหัส token ด้วย AES-256-GCM
src/lib/session.ts                สร้าง/ตรวจสอบ session cookie (JWT)
src/lib/providers/google.ts       OAuth2 + userinfo client ของ Google Sign-In
src/app/api/auth/google/connect   redirect ไปหน้า authorize ของ Google
src/app/api/auth/google/callback  รับ code, แลก token, สร้าง/ล็อกอิน user
src/app/dashboard                 หน้าแสดงรายการ activity
src/app/dashboard/log-activity    บันทึกกิจกรรมเอง (provider: MANUAL)
```

## ขั้นต่อไป

1. **Dashboard/สถิติเพิ่มเติม** — ต่อยอดจาก `Activity` table ที่ normalize ไว้แล้ว เช่น กราฟระยะทางรายสัปดาห์เพิ่มเติม
2. **เชื่อมบัญชี Google เข้ากับ session ที่ล็อกอินอยู่** — ตอนนี้ Google connect/callback ทำ
   find-or-create by `providerAccountId` เสมอ ไม่สนใจ session ที่เปิดอยู่ ถ้าอยากให้ "เชื่อมบัญชี
   Google เพิ่ม" จากบัญชีอีเมลที่ล็อกอินอยู่ได้แบบเดียวกับ set-password ต้องแก้ flow นี้เพิ่ม
