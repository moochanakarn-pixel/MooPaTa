# MooPaTa

เว็บแอพรวมข้อมูลการออกกำลังกายจากแอพฟิตเนสหลายแหล่งไว้ที่เดียว เริ่มจาก **Strava** (ใช้งานได้แล้ว) และ **Huawei Health** (รอ Health Kit ได้รับอนุมัติ)

## สถาปัตยกรรมคร่าวๆ

- **Next.js 14 (App Router)** + TypeScript + Tailwind
- **MySQL** ผ่าน **Prisma ORM** — เก็บผู้ใช้, token ของแต่ละ provider (เข้ารหัสด้วย AES-256-GCM), และ activity ที่ normalize เป็น schema กลางแล้ว
- Login ทำผ่าน "Login with Strava" (OAuth2) โดยตรง ไม่มีระบบสมัครสมาชิกแยก — เชื่อม Strava ครั้งแรกคือการสร้างบัญชี
- Session เก็บเป็น JWT ใน httpOnly cookie (เซ็นด้วย `SESSION_SECRET`)
- โครง provider adapter (`src/lib/providers/*.ts`) ออกแบบให้ทุก provider คืนข้อมูลรูปแบบเดียวกัน (`NormalizedActivity`) เพื่อให้ต่อ Huawei Health เข้ามาทีหลังโดยไม่ต้องแก้ dashboard/DB schema

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
- `STRAVA_CLIENT_ID` / `STRAVA_CLIENT_SECRET` — สมัครแอพได้ที่ https://www.strava.com/settings/api
  - ตั้ง **Authorization Callback Domain** เป็น `localhost` ตอน dev
- `STRAVA_REDIRECT_URI` — ต้องตรงกับ `APP_BASE_URL` + `/api/auth/strava/callback` เป๊ะๆ

### 4. สร้างตารางในฐานข้อมูล

```bash
npx prisma migrate dev --name init
```

### 5. รัน dev server

```bash
npm run dev
```

เปิด http://localhost:3000 แล้วกด "เชื่อมต่อกับ Strava"

## Deploy จริง

- เปลี่ยน `DATABASE_URL` ไปที่ MySQL ของ production (เช่น PlanetScale, RDS, หรือ MySQL server ของตัวเอง)
- รัน `npx prisma migrate deploy` ตอน deploy แทน `migrate dev`
- อัปเดต `APP_BASE_URL`, `STRAVA_REDIRECT_URI` และ Authorization Callback Domain ในหน้า Strava API settings ให้เป็นโดเมนจริง
- ตั้งค่า sync อัตโนมัติ: เรียก `POST /api/sync/strava` (ต้องมี session cookie ของผู้ใช้) ผ่าน cron หรือ webhook — ดูหัวข้อ "ขั้นต่อไป" ด้านล่าง

## โครงสร้างไฟล์สำคัญ

```
prisma/schema.prisma              โมเดล User / ProviderConnection / Activity (schema กลาง)
src/lib/crypto.ts                 เข้ารหัส/ถอดรหัส token ด้วย AES-256-GCM
src/lib/session.ts                สร้าง/ตรวจสอบ session cookie (JWT)
src/lib/providers/strava.ts       OAuth2 + REST client ของ Strava
src/lib/providers/huawei.ts       placeholder รอ Huawei Health Kit อนุมัติ
src/app/api/auth/strava/connect   redirect ไปหน้า authorize ของ Strava
src/app/api/auth/strava/callback  รับ code, แลก token, สร้าง/ล็อกอิน user
src/app/api/sync/strava           ดึง activity ใหม่จาก Strava มา upsert ลง DB
src/app/dashboard                 หน้าแสดงรายการ activity + ปุ่มซิงค์
```

## ขั้นต่อไป

1. **Huawei Health** — สมัคร Health Kit ที่ HUAWEI Developers (ต้องรออนุมัติ, sandbox จำกัด 100 ผู้ใช้) แล้ว implement `src/lib/providers/huawei.ts` ให้มีรูปแบบเดียวกับ `strava.ts` จากนั้นเพิ่ม branch `HUAWEI_HEALTH` ในหน้า connect/callback/sync
2. **Auto sync** — ตั้ง cron (เช่น Vercel Cron หรือ node-cron) เรียก sync ให้ทุกผู้ใช้ที่เชื่อมต่อไว้เป็นระยะ หรือใช้ Strava webhook (push แจ้งเมื่อมี activity ใหม่) แทนการ poll
3. **Rate limit ของ Strava** — ค่าเริ่มต้นจำกัดที่ 200 requests/15 นาที และ 2,000/วัน ต่อแอพ ถ้าผู้ใช้เยอะขึ้นต้องขอเพิ่มผ่าน Strava Developer Program
4. **Dashboard/สถิติเพิ่มเติม** — ต่อยอดจาก `Activity` table ที่ normalize ไว้แล้ว เช่น กราฟระยะทางรายสัปดาห์, เปรียบเทียบ provider
