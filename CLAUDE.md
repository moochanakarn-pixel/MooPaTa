# MooPaTa — project memory

เอกสารนี้สรุปว่าแต่ละส่วนของแอพทำงานยังไง เขียนไว้ให้ Claude (หรือคนอื่น) เปิดงานต่อได้เร็ว
โดยไม่ต้องไล่อ่านโค้ดทั้งหมดใหม่ทุกครั้ง — เน้น "ตอนนี้ทำงานยังไง" ไม่ใช่ประวัติการแก้ (ดู `git log`
ถ้าอยากรู้ลำดับเหตุการณ์)

อัปเดตไฟล์นี้เมื่อเพิ่ม/เปลี่ยนฟีเจอร์ใหญ่ — ถ้าเอกสารไม่ตรงกับโค้ดจริง ให้เชื่อโค้ดจริงและแก้เอกสารให้ตรง

## ภาพรวม stack

- Next.js 14.2 (App Router) + TypeScript (strict) + Tailwind
- MySQL/MariaDB ผ่าน Prisma ORM (`prisma/schema.prisma` คือ source of truth ของ schema)
- Session เป็น JWT ใน httpOnly cookie ชื่อ `moopata_session` (เซ็น/ตรวจด้วย `SESSION_SECRET`,
  ดู `src/lib/session.ts`) — **`SESSION_SECRET` ใน `.env` มีเครื่องหมาย `"` ครอบอยู่** ถ้าจะ decode
  ค่า hex เองนอก Next.js (เช่น สคริปต์ทดสอบ) ต้อง strip quote ออกก่อน ไม่งั้น `Buffer.from(hex,"hex")`
  จะได้ length ผิดและ verify token ไม่ผ่าน
- Login มี 2 ทาง: "Sign in with Google" (OAuth2 ผ่าน `ProviderConnection`, `provider: GOOGLE`)
  หรืออีเมล+รหัสผ่านของตัวเอง (`User.email`/`passwordHash`) — ดู "ระบบ login" ด้านล่าง ทั้งสองทาง
  ผูกกับ `userId` เดียวกันได้ (เพิ่มอีเมล+รหัสผ่านทีหลังจากหน้าตั้งค่าได้ ไม่ว่าจะเริ่มบัญชีด้วยวิธีไหน)
  แต่ Google ยังไม่รองรับการ "เชื่อมเพิ่ม" แบบนั้น — กด Sign in with Google ตอน login ด้วยอีเมลอยู่จะ
  สลับ/สร้างบัญชีใหม่ตาม Google identity แทนที่จะผูกเข้าบัญชีที่ล็อกอินอยู่ (ถ้าเผลอสร้างบัญชีซ้ำแบบนี้
  ใช้ `scripts/list-accounts-2026-09-13.mjs` + `merge-accounts-2026-09-13.mjs` รวมกลับเป็นบัญชีเดียว) —
  **Strava sync ถูกลบออกจากแอพทั้งหมดแล้ว** (ดู "### 0. ระบบ login" ด้านล่าง) เหลือแค่ 2 ทางนี้
- Deploy: VPS ของผู้ใช้เอง — local dev/test ใช้ Linux + MariaDB (`service mariadb start/stop`),
  production รันบน **Windows Server** ผ่าน `nssm` เป็น Windows service ชื่อ `MooPaTa` ที่
  `D:\Projectphp\MooPaTa` (ดู `DEPLOY-WINDOWS.md`; `DEPLOY.md` คือฉบับ Linux/Nginx เดิม)
- ธีมสี: warm cream/light — Tailwind scale `neutral` ถูก invert ไว้ใน `tailwind.config.ts` ดังนั้น
  class ชื่อ `neutral-900`, `bg-neutral-950` ฯลฯ ในโค้ดที่ดู "มืด" จริง ๆ render ออกมาสว่าง/ครีม —
  อย่าตกใจว่าทำไม dark class ถึงได้ผลลัพธ์เป็นธีมสว่าง

## Data model (`prisma/schema.prisma`)

| Model | ใช้ทำอะไร |
|---|---|
| `User` | โปรไฟล์ + เป้าหมายโภชนาการ + ตั้งค่าแจ้งเตือนต่าง ๆ ทั้งหมดอยู่ในตารางเดียว (ไม่มี email; auth ผูกกับ `ProviderConnection`) |
| `Food` | เทมเพลตอาหารของผู้ใช้แต่ละคน (per-100g macros) — มา ได้จากแคตตาล็อกในตัว/บาร์โค้ด(ปิดใช้แล้ว)/label/พิมพ์เอง ดู "ระบบอาหาร/ไดอารี่" ด้านล่าง |
| `FoodLog` | หนึ่งรายการที่กินจริง (อ้าง `Food` + grams + เวลา + มื้อ) — ไม่เคยถูกลบทิ้งเวลาลบอาหารออกจากคลัง |
| `ProviderConnection` | OAuth token ของ Google sign-in (เข้ารหัส AES-256-GCM ด้วย `src/lib/crypto.ts`) — แถว `provider: STRAVA` เก่ายังอยู่ในข้อมูลของบัญชีที่เคยเชื่อมไว้ แต่ไม่มีการเชื่อมใหม่/sync ใหม่แล้ว |
| `Activity` / `ActivityDetail` / `Exercise` / `ExerciseSet` | กิจกรรมออกกำลังกาย — ของเก่า normalize มาจาก Strava (`provider: STRAVA`, เก็บไว้เฉย ๆ ไม่ sync ต่อแล้ว), ของใหม่ทั้งหมดเป็น `provider: MANUAL` ที่ผู้ใช้พิมพ์เอง + รายละเอียดเก่าที่เคยโหลดแบบ lazy จาก Strava (splits/streams/weather, เฉพาะ activity เก่า) + ท่าเวทสำหรับ activity แบบ manual (`Exercise` = ชื่อท่า, แต่ละท่ามี `ExerciseSet[]` เก็บ reps/น้ำหนัก/RPE แยกทีละเซ็ท รองรับพีระมิด/drop set ที่แต่ละเซ็ทไม่เท่ากัน) — `Activity.rpe` กับ `ExerciseSet.rpe` เป็น RPE คนละความหมายกัน (ดู "### 6. อื่น ๆ" ด้านล่าง) |
| `WaterLog` / `WeightLog` | บันทึกน้ำ/น้ำหนักรายครั้ง — log น้ำหนักใหม่จะอัปเดต `User.weightKg` ด้วย |
| `BodyCompositionLog` | ผลตรวจ InBody/เครื่องวัดองค์ประกอบร่างกายแบบเป็นครั้ง ๆ (ไม่ใช่ทุกวัน) — เฉพาะ `weightKg` บังคับ ที่เหลือ optional ตาม field ที่เครื่องแต่ละรุ่นมี |
| `PushSubscription` | Web Push subscription ต่ออุปกรณ์ (มีแถว = เปิดแจ้งเตือนสำหรับเครื่องนั้น) |
| `Supplement` / `SupplementLog` | รายการอาหารเสริมที่ต้องกินประจำ + เช็คว่ากินไปหรือยันแต่ละวัน |
| `AuthToken` | ลิงก์ยืนยันอีเมล/รีเซ็ตรหัสผ่านแบบใช้ครั้งเดียว เก็บแค่ hash ของ token ไม่เก็บตัวจริง (ดู "ระบบ login" ด้านล่าง) |

## ฟีเจอร์หลัก แยกตามส่วน

### 0. ระบบ login (Google OAuth + อีเมล/รหัสผ่าน) — Strava sync ถูกลบออกแล้ว
เดิมมีแค่ "Login with Strava" ทางเดียว แต่ Strava API จำกัดจำนวนนักกีฬาที่เชื่อมต่อได้ต่อแอพ
(เริ่มต้น 1, self-upgrade ฟรีได้ถึง 10, เกินนั้นต้องผ่านการรีวิว) และตั้งแต่กลางปี 2026 ต้องมี
Strava subscription ถึงจะใช้ API ได้ต่อ — เลยเพิ่มอีเมล+รหัสผ่านและ Google sign-in เป็นทางเลือกก่อน
แล้วภายหลัง**ตัด Strava sync ออกจากแอพทั้งหมด** (OAuth connect/callback, `/api/sync/strava`,
`/api/cron/sync`, ปุ่มซิงค์, ปุ่มยกเลิกการเชื่อมต่อในหน้าตั้งค่า — ลบไฟล์และ route ทั้งหมดแล้ว
ไม่ใช่แค่ซ่อน UI) เพราะเจ้าของแอพเลิกจ่าย Strava subscription — **กิจกรรมเก่าที่เคย sync มาจาก
Strava (`Activity.provider === "STRAVA"`) ยังอยู่ครบและแสดงผลได้ปกติทุกหน้า** (รวมถึง
`ActivityDetail` ที่เคยโหลด splits/streams/weather ไว้แล้ว — เก็บ type ไว้ที่
`src/lib/activity-detail-types.ts`) แค่ไม่มีทาง sync ใหม่/เชื่อมต่อใหม่อีกต่อไป กิจกรรมทั้งหมด
นับจากนี้บันทึกเองที่ `/dashboard/log-activity` (`provider: MANUAL`) — auth ทุกทางไปสู่
`createSession(userId)` เดียวกัน (`src/lib/session.ts`) engine คำนวณโภชนาการ
(`computeTargets`/`applyActivityBonus` ใน `src/lib/nutrition.ts`) ไม่เคยพึ่งข้อมูลจาก Strava
โดยตรงอยู่แล้ว (ใช้แค่ผลรวม `durationSec` ของ Activity ไม่ว่าจะมาจากไหน) เลยไม่กระทบอะไรเลย
- `src/app/api/auth/signup` — สร้าง `User` (ยังไม่ล็อกอิน) + ส่งอีเมลยืนยันผ่าน Resend
  (`src/lib/email.ts`) — ไม่ login จนกว่าจะกดลิงก์ยืนยัน
- `src/app/api/auth/verify-email` (GET, ปลายทางของลิงก์ในอีเมล) — ยืนยัน + login ให้เลย
- `src/app/api/auth/login` — ปฏิเสธถ้ายังไม่ยืนยันอีเมล หรือ login ผิดเกิน 8 ครั้งติด (ล็อก 15 นาที,
  เก็บนับที่ `User.failedLoginCount`/`lockedUntil`)
- `src/app/api/auth/forgot-password` + `reset-password` — ตอบกลับข้อความเดียวกันเสมอไม่ว่าอีเมลจะมี
  บัญชีจริงหรือไม่ (กันการเดาว่าอีเมลไหนมีบัญชี)
- `src/app/api/settings/set-password` — ให้ผู้ใช้ Google/บัญชีเดิมเพิ่มอีเมล+รหัสผ่านเข้าบัญชีเดิมได้
  (ไม่ใช่สร้างบัญชีใหม่) เปลี่ยน/เพิ่มอีเมลจริง ๆ ต้องยืนยันอีเมลก่อนถึงจะ login ด้วยได้ เหมือน
  signup ปกติ — **แต่ถ้าส่งอีเมลเดิมที่ยืนยันแล้วมาซ้ำ (แค่อยากเปลี่ยนรหัสผ่านอย่างเดียว) จะไม่รีเซ็ต
  สถานะยืนยันและไม่ต้องกดลิงก์ใหม่** (แก้บั๊กที่เจอ: เดิมทุกครั้งที่กดบันทึกจะรีเซ็ต
  `emailVerifiedAt` เป็น null เสมอแม้อีเมลจะเหมือนเดิมเป๊ะ ทำให้ login ด้วยรหัสผ่านใช้ไม่ได้ชั่วคราว
  จนกว่าจะกดลิงก์ยืนยันใหม่ ทั้งที่แค่เปลี่ยนรหัสผ่าน) `SetPasswordForm` เอง pre-fill ช่องอีเมลด้วย
  อีเมลปัจจุบันไว้ให้แล้ว (ไม่ใช่ช่องว่างเปล่า) กันเผลอพิมพ์อีเมลผิดตอนแก้ไข แล้วเปลี่ยนอีเมลบัญชี
  ไปโดยไม่ตั้งใจ
- **RESEND_API_KEY ไม่ตั้งไว้ = ไม่ crash** — `src/lib/email.ts` แค่ log ลิงก์ลง console แทนการส่งจริง
  แล้ว API response จะมี `devToken` แนบมาด้วย (เอาไว้ทดสอบ flow ได้โดยไม่ต้องมี Resend account จริง)
  พอตั้ง `RESEND_API_KEY`/`EMAIL_FROM` (ต้องเป็นโดเมนที่ verify กับ Resend แล้ว) จริงเมื่อไหร่
  จะส่งอีเมลจริงทันทีและ `devToken` จะหายไปจาก response เอง ไม่ต้องแก้โค้ด
- ต้องมี env vars: `RESEND_API_KEY`, `EMAIL_FROM`, `APP_BASE_URL`
- **Google Sign-In** (`src/lib/providers/google.ts`, `src/app/api/auth/google/connect|callback`) —
  redirect → callback → find-or-create `User` by `providerAccountId` → `createSession`, ใช้ตาราง
  `ProviderConnection` (`provider: GOOGLE`) — ขอ profile จาก Google userinfo endpoint (ไม่ได้
  decode/verify id_token JWT เอง) ต้องมี `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_REDIRECT_URI`
  — นี่คือทาง OAuth เดียวที่เหลืออยู่ในแอพ
- **ชื่อ/รูปโปรไฟล์สำหรับบัญชีอีเมล** — `User.name`/`avatarUrl` มาจาก Google profile อัตโนมัติตอน
  connect เท่านั้น บัญชีอีเมล+รหัสผ่านเลยไม่มีทั้งคู่ (โชว์ "นักวิ่ง"/ตัวอักษร "?" แทน) — เพิ่ม
  `src/app/api/settings/profile` (POST, ตั้งชื่อ) กับ `src/app/api/avatar` (POST/GET/DELETE, อัปโหลด/โชว์/ลบ
  รูปส่วนตัว เก็บไฟล์แบบเดียวกับ progress photos ที่ `src/lib/avatar-storage.ts`, field `User.avatarPath`)
  หน้าตั้งค่ามีฟอร์มให้แก้ทั้งสองอย่าง — `avatarPath` (ถ้ามี) จะโชว์ก่อน `avatarUrl` เสมอในหน้าแรก
  ใช้ได้กับบัญชี Google ด้วย (override ชื่อ/รูปที่ Google ให้มาได้ถ้าอยากเปลี่ยน)
- **บัญชีแยกกันเพราะ login คนละทาง (กด "Sign in with Google" ตรง ๆ)** — ปุ่ม Google ที่หน้าแรกยังทำ
  find-or-create by `providerAccountId` เสมอเหมือนเดิม ไม่สนใจ session ที่ล็อกอินอยู่ตอนนั้น (ตั้งใจ
  ให้เป็นทาง "เข้าสู่ระบบ" ไม่ใช่ทาง "เชื่อมบัญชี") เผลอกดตอน login ด้วยอีเมลอยู่จะได้บัญชีคนละใบ
  เหมือนเดิม — `scripts/list-accounts-2026-09-13.mjs` (ดูว่าบัญชีไหนเป็นบัญชีไหน) +
  `scripts/merge-accounts-2026-09-13.mjs` (ย้ายข้อมูลทั้งหมดจากบัญชีหนึ่งไปอีกบัญชี) +
  `scripts/identify-google-connections-2026-09-13.mjs` (ถอดรหัส token ถามอีเมลจริงจาก Google
  เพราะ DB ไม่เก็บอีเมลของ OAuth ไว้) + `scripts/split-google-connection-2026-09-13.mjs` (แยก
  connection ที่ merge ผิดคนออกกลับเป็นบัญชีใหม่) ใช้แก้เคสนี้ได้ — **ทางที่ตั้งใจเชื่อมบัญชีตอนนี้คือ
  ปุ่ม "เชื่อมบัญชี Google" ในหน้าตั้งค่า** (`/api/auth/google/connect?link=1`) ซึ่งเก็บ userId ของ
  session ปัจจุบันไว้ใน cookie ชั่วคราว (`google_oauth_link_user`) แล้วให้ callback แนบ
  `ProviderConnection` เข้ากับ user นั้นแทนที่จะ find-or-create ใหม่ — ถ้า Google identity นั้นเชื่อม
  กับบัญชีอื่นอยู่แล้วจะปฏิเสธ (ไม่ reassign ให้อัตโนมัติ ต้องใช้สคริปต์ merge ด้านบนแทนถ้าต้องการรวม
  จริง ๆ)

### 1. ระบบอาหาร/ไดอารี่ (`/dashboard/food` = ไดอารี่, `/dashboard/food/library` = คลังอาหารส่วนตัว)
- **หน่วยอาหาร (unit system)** — `src/lib/food.ts`: `Food.unitLabel` เป็น `"ก."` (default) แปลว่า
  เป็นอาหารแบบชั่งน้ำหนัก, ค่าอื่น (เช่น `"ชิ้น"`, `"ถ้วย"`) แปลว่านับเป็นหน่วย/ชิ้น — การคำนวณ per-100
  ทั้งหมด (`macrosForGrams`, `per100gFromTotal`) เป็น ratio ล้วน ๆ ไม่สนว่าหน่วยคืออะไร
- **Soft delete** — `Food.deletedAt`: ลบอาหารออกจากคลังจะ set field นี้แทนการ hard-delete
  (`DELETE /api/food/[id]`) เพราะ `FoodLog` ทุกแถวยังอ้างถึง `Food` แถวเดิมและคำนวณ macro สดทุกครั้ง —
  ลบจริงจะทำให้ประวัติวันก่อน ๆ พังไปด้วย ทุก query "ดึงรายการอาหารในคลัง" ต้อง filter
  `deletedAt: null`
- **กันอาหารซ้ำ** — `POST /api/food/log` เช็คชื่อซ้ำเป๊ะ (`db.food.findFirst({ userId, deletedAt:
  null, name })`) ก่อนสร้างแถวใหม่เสมอ ไม่ว่าจะมาจากแคตตาล็อก/label/พิมพ์เอง (ยกเว้น MySQL
  collation เป็น case-insensitive อยู่แล้ว) — ป้องกันคลังบวมจากการคีย์ชื่อเดิมซ้ำ ๆ — **ถ้าเจอชื่อซ้ำแต่
  `unitLabel` ที่ส่งมาใหม่ไม่ตรงกับของเดิม จะ `update` ค่าโภชนาการ+unitLabel ของแถวเดิมด้วยค่าที่ส่งมาใหม่
  แทนที่จะเชื่อแถวเดิมเงียบ ๆ** (แก้บั๊กที่เจอจริง: import จาก AI ครั้งแรกให้ "ปริมาณ" มาในรูปแบบที่ parser
  จับไม่ได้ว่าเป็นกรัม เมนูนั้นเลยถูกสร้างเป็นอาหารแบบ "หน่วย" ที่ `caloriesPer100g` จริง ๆ คือยอดรวมทั้งจาน
  พอ import รอบสองด้วยข้อความที่ parse กรัมได้ถูกต้อง (`unitLabel: "ก."`) ชื่อไปชนกับแถวเดิมที่เป็น "หน่วย"
  พอดี ระบบเดิมจะ reuse แถว "หน่วย" เก่านั้นตรง ๆ แล้วเอา `grams` ก้อนใหม่ (เช่น 450) ไปคูณกับ
  caloriesPer100g แบบ per-หน่วย เดิม ทำให้แคลอรี่พองขึ้นเป็นร้อยเท่า (380 kcal → 171,000 kcal) — เช็คแค่
  `unitLabel` mismatch เป็นสัญญาณว่าข้อมูลเดิมกับใหม่คนละฐานหน่วยกันแน่ ๆ ไม่ใช่แค่ตัวเลขต่างกันเล็กน้อย
  (กรณีตัวเลขต่างกันแต่ unit เดิมเหมือนกัน เช่น log ซ้ำเมนูเดิมแต่สูตรเปลี่ยนไปนิดหน่อย ยังคงพฤติกรรมเดิม
  ไม่แตะค่าที่มีอยู่แล้ว เพื่อรักษากติกาที่ตั้งใจไว้ว่า "แก้ค่าโภชนาการได้แค่ที่คลังอาหารเท่านั้น" — ดูข้อ
  ถัดไป)
- **รวมของซ้ำที่มีอยู่แล้ว** — `POST /api/food/merge-duplicates` ใช้แก้ของเก่าที่ซ้ำอยู่ก่อนมีเช็คด้านบน
  (กลุ่มตามชื่อ normalize แล้ว, เก็บแถวที่มี log เยอะสุดไว้เป็นตัวหลัก, ย้าย `FoodLog` ทั้งหมดไปอ้างแถวนั้น,
  soft-delete ที่เหลือ) — ปุ่ม "รวมเมนูซ้ำทั้งหมด" อยู่ในหน้าคลังอาหาร (banner จะโชว์เองถ้าเจอของซ้ำ)
- **แก้ค่าโภชนาการ** — แก้ได้แค่ที่คลังอาหารส่วนตัวเท่านั้น (มีผลย้อนหลังกับทุกวันที่เคยบันทึกเมนูนั้น
  เพราะ macro คำนวณสดจาก `Food` เสมอ) หน้าไดอารี่แก้ได้แค่ปริมาณ/มื้อของรายการนั้น ๆ — ปุ่มดินสอในไดอารี่
  มีลิงก์ deep-link ไปเปิดฟอร์มแก้ที่คลังอาหาร (`/dashboard/food/library?edit=<foodId>`) — `PATCH
  /api/food/log/[id]` (แก้ปริมาณ/มื้อ) ปฏิเสธ request ที่ไม่มีทั้ง `grams`/`mealType` เลย (`400
  nothing_to_update`) กันยิง `db.foodLog.update({ data: {} })` เปล่า ๆ แบบ no-op เสีย DB roundtrip ฟรี
- **"คัดลอกเมื่อวานทั้งหมด"** (`POST /api/food/log/copy-day`) ปฏิเสธถ้า `fromDate`/`toDate` เป็นวันเดียวกัน
  (`400 same_date`) กันบันทึกอาหารวันนั้นซ้ำเป็น 2 เท่าโดยไม่ตั้งใจ — UI เองเรียกด้วย `fromDate =
  prevDateKey(viewDate)` เสมอ (ชนกับ `toDate` ไม่ได้อยู่แล้วผ่านหน้าจริง) เช็คนี้เป็น defensive ที่ระดับ
  API เผื่อมีจุดเรียกอื่นในอนาคตหรือยิง API ตรง ๆ
- **คำแนะนำเมนู ("เมนูโปรด" + "เมนูที่กินบ่อย")** — ทั้งคู่อยู่ในแผงเพิ่มอาหาร (ไม่โชว์ก่อนกดเพิ่มอาหาร,
  แค่ตอนช่องค้นหายังว่างอยู่ — พิมพ์คำค้นแล้วจะเปลี่ยนไปโชว์ผลค้นหาแทน) เรียงเป็น 2 section แยกกัน
  "เมนูโปรด" ก่อนเสมอ (ถ้ามี) ตามด้วย "เมนูที่กินบ่อย":
  - **"เมนูโปรด"** — มาจาก `Food.isFavorite` (ติดดาวได้ที่หน้าคลังอาหาร) เรียงตามชื่อ (`localeCompare`
    แบบไทย) ไม่กรองตามแคลอรี่ที่เหลือวันนี้เลย เพราะเป็นลิสต์ที่ผู้ใช้ตั้งใจ curate เองไว้แล้ว ไม่ใช่ระบบ
    แนะนำอัตโนมัติ — ต่างจาก "เมนูที่กินบ่อย" ตรงที่โผล่ได้ทันทีที่ติดดาว แม้ยังไม่เคยกินเลยสักครั้ง
    (`logCount === 0` ก็โผล่) เพราะ "เมนูที่กินบ่อย" กรองเอาเฉพาะ `logCount > 0` เท่านั้น ทำให้เมนูที่เพิ่ง
    สร้าง/ติดดาวไว้ล่วงหน้าไม่มีทางโผล่ในนั้นได้เลยถ้าไม่ผ่าน section นี้ก่อน
  - **"เมนูที่กินบ่อย"** — จัดอันดับด้วย `PersonalFood.logCount` (นับจาก `FoodLog.groupBy`
    server-side จริง ๆ ไม่ได้ persist เป็น field) **ไม่รวมเมนูที่ติดดาวไว้แล้ว** (กรอง `!isFavorite`
    ออกจากลิสต์นี้) กันไม่ให้เมนูที่ทั้งติดดาวและกินบ่อยโผล่ซ้ำ 2 ที่ในแผงเดียวกัน — ถ้ายังไม่มีประวัติกิน
    เลยจะ fallback ไปโชว์จาก `THAI_FOOD_CATALOG` แทน (`src/lib/thai-food-catalog.ts`)
  ดู `src/app/dashboard/food/food-log-view.tsx` — เดิม `Food.isFavorite` เป็นแค่ toggle ที่คลังอาหาร
  ไม่มีผลอะไรนอกจากนั้น (เคยมี comment ในโค้ดบอกว่า "แทนที่ isFavorite-driven list เดิมด้วย logCount"
  จากตอนที่ตัดออกไปรอบก่อน) ตอนนี้กลับมามีผลอีกครั้งแบบข้างบน

### 2. เชิงลึก / โภชนาการ (`/dashboard/nutrition` — bottom-nav label คือ "เชิงลึก")
รวมสถิติ/เป้าหมายระยะยาวที่ไม่ใช่การบันทึกรายวัน:
- BMI gauge, กราฟน้ำหนัก (`WeightLogCard`), รูปถ่ายความคืบหน้า (`ProgressPhotosCard`) — เก็บเป็นประวัติ
  ตามวันที่ (`ProgressPhotoLog`, ดูรายละเอียดด้านล่าง) ไม่ใช่ช่องเดียวที่เขียนทับ
- แคลอรี่วันนี้เทียบเป้า (BMR/TDEE จาก `src/lib/nutrition.ts`), แมโครที่ควรได้ต่อวัน
- กราฟแนวโน้มแคลอรี่ 14 วัน (`CalorieTrendChart`), เทียบสัปดาห์นี้กับสัปดาห์ก่อน
  (`NutritionPeriodComparison`)
- เป้าหมายน้ำวันนี้
- **สถิติบันทึกต่อเนื่อง** (`LoggingStreakCard`, `src/app/dashboard/nutrition/logging-streak-card.tsx`)
  — ย้ายมาจากหน้าไดอารี่ในรอบนี้ เพราะเข้ากับสถิติระยะยาวอื่น ๆ มากกว่า ไม่เกี่ยวกับการบันทึกวันนี้
  โดยตรง คำนวณจาก `buildDayCounts`/`computeStreak` ใน `src/lib/streak.ts` (window 60 วันย้อนหลัง)
- คำนวณเป้าหมาย/BMR/TDEE ทั้งหมดต้องมีโปรไฟล์ครบ (`isProfileComplete`) ไม่งั้นหน้านี้จะโชว์ CTA
  ให้ไปกรอกโปรไฟล์แทน
- **โบนัสแคลอรี่/แมโครจากกิจกรรมวันนี้ ("เพิ่มจากกิจกรรมวันนี้")** — `applyActivityBonus`
  (`src/lib/nutrition.ts`) ปรับเป้าหมายแคลอรี่/คาร์บ/โปรตีน/น้ำของวันนั้นขึ้นเมื่อมีกิจกรรมบันทึกไว้ —
  ฐานยังเป็น**เวลาออกกำลังกายรวมทั้งวัน** เหมือนเดิม (ทุก 30 นาทีสะสมทุกประเภทกิจกรรมรวมกัน = +15g
  คาร์บ +5g โปรตีน, สูงสุด 90g/30g ที่ 3 ชม.) แต่ตอนนี้แต่ละบล็อกถูกคูณด้วย **intensity multiplier**
  ที่มาจากแคลอรี่ที่กรอกไว้ต่อกิจกรรม ไม่ใช่แค่เวลาล้วน ๆ แบบเดิมอีกต่อไป — ผ่านการทำงานร่วมกันมา 2 รอบ:
  รอบแรกลองแบบ **บวกเพิ่มทางเดียวเท่านั้น** (`activityCalorieBonusKcal`, คืน 30% ของแคลอรี่ที่กรอก
  เพดาน 250 kcal, พับเป็นคาร์บเพิ่ม) แต่ผู้ใช้ชี้ว่ายังไม่พอ เพราะบวกได้อย่างเดียวไม่มีทางลดต่ำกว่า floor
  เดิมของเวลาได้เลย ทำให้ "วิ่ง 30 นาที" กับ "เดินช้า 30 นาที" ได้โบนัสเท่ากันเป๊ะถ้าไม่กรอกแคลอรี่ต่างกัน
  มากพอ ไม่สะท้อนความหนักเบาจริง — รอบสองเลย**เปลี่ยนเป็นตัวคูณสองทาง (ปรับขึ้นหรือลงได้) แทนที่การบวกเพิ่ม
  ทางเดียวไปเลย**:
  - **`activityIntensityMultiplier(durationSec, calories)`** — คำนวณ kcal/นาทีของกิจกรรมนั้นเทียบกับ
    `BASELINE_KCAL_PER_MIN = 5` (จุด calibrate แยกต่างหาก **ไม่ใช่**อัตรา ~2.67 kcal/นาทีที่บล็อกโบนัส
    เดิมให้ เพราะอัตรานั้นตั้งใจสื่อ "โบนัสควรใจกว้างแค่ไหน" ไม่เคยตั้งใจสื่อ "เผาแคลอรี่จริงเท่าไหร่"
    เอามาใช้เป็น baseline เทียบความหนักตรง ๆ จะเรียกเดินช้า ๆ ว่า "หนัก" ผิด ๆ) ได้ตัวคูณ clamp อยู่
    ระหว่าง **0.75x–1.5x** (`INTENSITY_MULTIPLIER_MIN/MAX`) — ไม่ใช่ 0x เพราะกิจกรรมเบาแค่ไหนก็ยังควร
    ได้โบนัสส่วนใหญ่ของ floor เดิมอยู่ (ตัวคูณนี้เป็นตัวปรับ ไม่ใช่ประตูเปิด-ปิดโบนัส) ไม่ใช่ unbounded
    เพราะแคลอรี่จากนาฬิกามักประเมินสูงเกินจริง เชื่อ 1:1 ไม่ได้ — กิจกรรมที่ไม่มีแคลอรี่/แคลอรี่เป็น 0/
    สั้นกว่า `MIN_DURATION_FOR_INTENSITY_SEC` (5 นาที, กัน kcal/นาที เพี้ยนจากกิจกรรมสั้นเกินไป) ได้
    multiplier = 1 เสมอ (เท่ากับ floor เดิมเป๊ะ ไม่มีทาง regression ต่ำกว่าของเดิมจากการไม่มีข้อมูล)
  - **ระดับวัน** — เฉลี่ย multiplier ของทุกกิจกรรมวันนั้นแบบถ่วงน้ำหนักตามเวลาของกิจกรรมนั้น ๆ เอง
    (กิจกรรม 5 นาทีที่ตัวเลขเพี้ยนไม่ควรมีน้ำหนักเท่ากิจกรรม 55 นาทีข้าง ๆ กัน) — **ตั้งใจคำนวณ multiplier
    แยกทีละกิจกรรมก่อนค่อยถ่วงน้ำหนักรวม ไม่ใช่เอาแคลอรี่ทุกกิจกรรมของวันมาบวกรวมเป็นก้อนเดียวก่อนหาร**
    เพราะจะทำให้กิจกรรมสั้นความหนักสูงกับกิจกรรมยาวความหนักต่ำเบลอกันเป็นค่าเฉลี่ยที่ไม่มีความหมาย
  - Multiplier ที่ได้คูณเข้ากับสูตรบล็อกเดิมตรง ๆ: `activityMacroBonus(totalDurationSec,
    intensityMultiplier)` (เพิ่ม argument ตัวที่ 2 ให้ฟังก์ชันเดิม, default `1` กัน call site เก่าพัง) —
    ผลลัพธ์ยังถูก cap ที่ 90g/30g เหมือนเดิมหลังคูณเสร็จ (ไม่ต้องมี cap kcal แยกอีกชั้น เพราะ cap กรัมเดิม
    ก็ครอบเพดาน kcal ไว้อยู่แล้วแม้ที่ multiplier สูงสุด 1.5x) — **โบนัสน้ำ (`activityWaterBonusMl`)
    ไม่เปลี่ยนเลย** ยังคิดจากเวลารวมล้วน ๆ เหมือนเดิม ไม่ผ่าน multiplier (สเปกตั้งใจให้ intensity
    มีผลแค่คาร์บ/โปรตีนเท่านั้น)
  - **แทนที่ (ไม่ใช่ต่อยอด) `activityCalorieBonusKcal`/`calorieBonusKcal` ของรอบแรกไปเลย** — ฟิลด์
    `TodayTargets.calorieBonusKcal` ถูกถอดออก แทนด้วย **`TodayTargets.intensityMultiplier`** (ค่าเฉลี่ย
    ระดับวันที่อธิบายไว้ข้างบน, `1` เมื่อไม่มีกิจกรรม/ไม่มีแคลอรี่) หน้าเชิงลึกโชว์ต่อท้ายบรรทัดโบนัสเดิม
    เป็น "(ปรับตามความหนักจากแคลอรี่ที่บันทึกไว้ — หนักกว่าปกติ/เบากว่าปกติ ×N.NN)" เฉพาะตอนต่างจาก 1
    เกิน 0.01 เท่านั้น (ซ่อนไปเลยถ้าไม่มีผลต่าง เหมือน pattern เดิมที่ไม่โชว์ "+0 kcal" ที่ไม่มีความหมาย)
  - **`applyActivityBonus` เปลี่ยน signature เป็นรับ array ของกิจกรรมรายตัวแทน scalar sum 2 ตัวเดิม**
    (`activities: { durationSec: number; calories: number | null }[]`) เพราะต้องคำนวณ multiplier
    แยกทีละกิจกรรมก่อนถ่วงน้ำหนักตามที่อธิบายไว้ข้างบน — **ทุกจุดที่เรียกต้องส่ง array ของกิจกรรมวันนั้น
    เข้าไปด้วยเสมอ** (เหมือนกติกาเดียวกับ body composition/macro prefs ด้านบน): หน้าแรก
    (`dashboard/page.tsx`, เปลี่ยน query จาก `aggregate` เป็น `findMany` เอา `durationSec`/`calories`
    ราย activity), หน้าไดอารี่ (`food/page.tsx`, เปลี่ยนแบบเดียวกัน), หน้าเชิงลึก (`nutrition/page.tsx`,
    มี `activitiesByDay: Map<string, {durationSec, calories}[]>` แทน `durationByDay`/
    `activityCaloriesByDay` เดิมที่เป็น sum ต่อวัน — ตั้งใจแยกชื่อจาก `caloriesByDay` เดิมที่หมายถึง
    แคลอรี่ที่ "กิน" ไม่ใช่ "เผาผลาญ" อยู่แล้ว ระวังอย่าสับสน), การ์ดสรุปผลประจำวัน
    (`daily-summary/route.tsx`, มี `activities` แบบ full row อยู่แล้วแค่ `.map()` เอา 2 field) — ส่วน
    `cron/water-reminder` ส่ง array 1 element ที่มีแค่ `durationSec` (`calories: null`) เพราะใช้แค่
    `.waterMl` ที่ไม่ขึ้นกับ multiplier เลย
  - เทสอยู่ที่ `nutrition.test.ts` describe block "activity-based bonuses" — ครอบคลุมทั้ง clamp บน/ล่าง,
    guard เวลาขั้นต่ำ, กิจกรรมไม่มีแคลอรี่ได้ multiplier เป็นกลาง (1), ถ่วงน้ำหนักตามเวลาไม่ใช่ค่าเฉลี่ย
    ธรรมดา, โบนัสน้ำไม่ขึ้นกับ multiplier — โดยเฉพาะเทสที่ยืนยัน**กรณีที่เป็นเหตุผลหลักที่เปลี่ยนสูตรรอบนี้**:
    กิจกรรมความหนักต่ำได้โบนัสน้อยกว่า floor เดิมของเวลาอย่างเดียวจริง ๆ (ไม่ใช่แค่บวกเพิ่มแบบรอบแรก)
  - **`activityMacroBonus`/`activityWaterBonusMl` เปลี่ยนจาก "ปัดลงเป็นบล็อก 30 นาทีเต็ม" เป็น
    "คิดตามสัดส่วนเวลาต่อเนื่อง" แล้ว** — ผู้ใช้รายงานว่าวิ่ง 4 กม. 29 นาทีแล้วแถบ "เพิ่มจากกิจกรรมวันนี้"
    ทั้งแถบไม่โผล่มาเลยสักนิด (ไม่ใช่แค่ตัวเลขน้อย — หายไปทั้งแถบ เพราะหน้าเชิงลึกซ่อนแถบนี้ทิ้งเมื่อ
    `carbBonusG`/`proteinBonusG` เป็น 0 ทั้งคู่ ดู "เพิ่มจากกิจกรรมวันนี้" ด้านบน) — root cause: เดิมทั้งสอง
    ฟังก์ชันคำนวณ `blocks = Math.floor(durationSec / 1800)` ก่อนคูณ ทำให้เป็น all-or-nothing ที่ขอบ 30
    นาทีพอดี (29 นาที = 0 บล็อก = โบนัส 0 เป๊ะ, 30 นาที = 1 บล็อก = โบนัสเต็มบล็อกทันที) กระโดดชันข้าม
    ขอบแค่ 1 นาทีต่าง ทั้งที่ตั้งใจแค่กันกิจกรรมสั้นจริง ๆ (2-5 นาที) ไม่ให้ได้โบนัสเกินจริง ไม่ได้ตั้งใจ
    ให้ 29 นาทีเท่ากับ "ไม่ได้ออกกำลังกายเลย" — แก้โดยเปลี่ยนจาก `Math.floor(durationSec / blockSec)`
    เป็น `durationSec / blockSec` ตรง ๆ (เศษส่วนต่อเนื่อง ไม่ปัดลง) ก่อนคูณด้วยค่าต่อบล็อกแล้ว
    `Math.round()` ผลลัพธ์สุดท้ายทีเดียว — 29 นาทีตอนนี้ได้ ~14.5g คาร์บ/~4.8g โปรตีน (ปัดเป็น 15g/5g
    เกือบเท่าบล็อกเต็มพอดี) แทนที่จะเป็น 0 เป๊ะ, น้ำได้ ~483ml (ปัดแสดงผลเป็น 0.5 ลิตร) แทนที่จะเป็น
    0 — ตรวจสอบจริงด้วยการ seed กิจกรรมวิ่ง 4 กม./29 นาทีของวันนี้แล้วเปิดหน้าเชิงลึกจริง ยืนยันเห็นแถบ
    "ปรับเพิ่มจากกิจกรรมวันนี้ (29 นาที): คาร์บ +15 ก. · โปรตีน +5 ก." (+80 kcal) และ "+ เพิ่ม 0.5 ลิตร"
    ที่การ์ดน้ำ ขึ้นจริง แก้ครั้งนี้ **ไม่กระทบพฤติกรรมที่ตัวเลขลงตัวพอดีที่ขอบบล็อก** (30/60/90 นาที ฯลฯ
    ยังได้ผลลัพธ์เท่าเดิมเป๊ะ เพราะ blockFraction เป็นจำนวนเต็มพอดีที่จุดเหล่านั้น) เปลี่ยนแค่ค่าระหว่างขอบ
    บล็อกให้ไล่ระดับต่อเนื่องแทนกระโดดเป็นขั้นบันได — เทสเดิมที่ผูกกับพฤติกรรมเดิมตรง ๆ
    (`expect(activityWaterBonusMl(29 * 60)).toBe(0)`) ต้องแก้ค่าคาดหวังตาม เพิ่มเทสใหม่ยืนยันทั้งเคส
    29 นาที (เกือบเต็มบล็อก) และเคสสั้นจริง ๆ 5 นาที (ยังได้แค่เศษเสี้ยวเล็ก ๆ ไม่ใช่เต็มบล็อก — ยืนยันว่า
    เจตนาเดิมกันกิจกรรมสั้นจริงยังคงอยู่ ไม่ได้หายไปพร้อมกับ cliff ที่แก้)
- **ปรับสัดส่วนแมโครเอง (โปรตีน/ไขมัน)** — `MacroPreferencesForm`
  (`src/app/dashboard/settings/macro-preferences-form.tsx`, อยู่ในหน้าตั้งค่า ไม่ใช่หน้าเชิงลึก)
  ให้ผู้ใช้ปรับได้แค่ 2 อย่าง: โปรตีน (ก./กก. น้ำหนักตัวหรือ lean body mass ถ้ามี InBody) กับไขมัน
  (% ของแคลอรี่เป้าหมาย) — **คาร์บไม่มีช่องให้ปรับเลย เป็นส่วนที่เหลือจากแคลอรี่เป้าหมายเสมอ** (ดู
  `computeTargets`) ทำให้ยังไงก็รวมได้ 100% เองโดยไม่ต้อง validate ว่าผลรวมครบมั้ย เก็บที่
  `User.proteinGPerKg`/`fatPercentOfCalories` (nullable, `null` = ใช้ค่า default เดิม 1.8 ก./กก.
  หรือ 2.4 ก./กก. LBM และ 25%) ช่วงที่ปรับได้ถูก clamp ไว้ทั้งฝั่ง UI (slider min/max) และใน
  `computeTargets` เอง (`PROTEIN_G_PER_KG(_LBM)_MIN/MAX`, `FAT_PERCENT_MIN/MAX` ใน `nutrition.ts`)
  กันไม่ให้ค่าที่ค้างอยู่ก่อนเปลี่ยนช่วง หรือแก้ตรง DB เอง ดันตัวเลขออกนอกเกณฑ์ที่ฟอร์มอนุญาต — ทุกจุด
  ที่เรียก `computeTargets` (เหมือน body composition) ต้องส่ง `{ proteinGPerKg, fatPercentOfCalories }`
  ของ user เข้าไปด้วย ยกเว้น `cron/water-reminder` ที่ใช้แค่ `.waterMl` ซึ่งไม่ขึ้นกับค่านี้เลย
- **คำอธิบายเป้าหมายแคลอรี่แบบเจาะจงตัวเอง** — `explainCalorieTarget(profile, targets)`
  (`src/lib/nutrition.ts`) คืนประโยคเดียวอธิบายว่าทำไมเป้าหมายแคลอรี่ของ**ผู้ใช้คนนี้**ถึงเป็นตัวเลขนี้
  โดยเอา TDEE/เป้าหมาย/อัตราจริงของ user ไปแทนค่าในสูตร (เช่น "TDEE ของคุณคือ 2,556 kcal/วัน — เป้าหมาย
  ตอนนี้คือ 'ลดน้ำหนัก 0.5 กก./สัปดาห์' ต้องขาดดุลวันละ 550 kcal … เป้าหมายแคลอรี่เลยเท่ากับ 2,556 − 550 =
  2,006 kcal") ต่างจากหน้า **"ตัวเลขนี้มาจากไหน"** (`/dashboard/knowledge`, ลิงก์อยู่ใต้หัวข้อหน้า
  โภชนาการ) ที่อธิบายสูตรแบบทั่วไปไม่มีตัวเลขจริงของใครคนใดคนหนึ่ง — เกิดจากผู้ใช้ที่ตั้งเป้าหมายเป็น
  "คงน้ำหนัก"/"เพิ่มน้ำหนัก" (ไม่ได้ขาดดุลเหมือนคนลดน้ำหนักส่วนใหญ่) มองว่าคำอธิบายทั่วไปไม่ได้บอกตรง ๆ
  ว่าทำไมตัวเลขของตัวเองถึงออกมาแบบนี้ — แสดงอยู่ใต้ BMR/TDEE ในการ์ดแคลอรี่วันนี้ที่หน้าเชิงลึก
  (`nutrition/page.tsx`) โดยส่ง `baseTargets` (เป้าหมายจากสูตรอย่างเดียว ก่อนบวก activity bonus ของ
  วันนี้) ไม่ใช่ `targets` (ที่บวก bonus แล้ว) เข้าไป เพราะ bonus จากกิจกรรมมีแถวอธิบายแยกอยู่แล้ว
  ("เพิ่มจากกิจกรรมวันนี้") ไม่อยากให้ตัวเลขในประโยคปนกับ bonus จนเลขไม่ตรงกับสูตรที่อธิบาย —
  ฟังก์ชันแยกกรณี MAINTAIN (ไม่มี deficit/surplus เลย) ออกจาก LOSE/GAIN (มีส่วนต่างรายวันจากอัตรา
  กก./สัปดาห์ × 7,700 ÷ 7) และถ้าค่าที่คำนวณได้จริง (`targets.targetCalories`) ไม่ตรงกับค่าดิบจากสูตร
  (เช่น โดน floor ที่ 1,200 kcal ขั้นต่ำ หรือโปรตีน+ไขมันเป้าหมายรวมกันเกินค่าดิบไปแล้ว — ดู
  `computeTargets`'s comment) จะต่อท้ายประโยคอธิบายว่าโดนปรับขึ้นเพราะอะไร แทนที่จะโชว์เลขที่ไม่ตรงกับ
  สูตรที่อธิบายไปแบบเงียบ ๆ
- **องค์ประกอบร่างกาย (InBody)** — `BodyCompositionCard` (`src/app/dashboard/nutrition/body-composition-card.tsx`)
  ให้กรอกผลตรวจ InBody เองแบบ manual form (weightKg บังคับ, %ไขมัน/มวลกล้ามเนื้อ/ไขมันช่องท้อง/BMR
  ที่เครื่องรายงานเป็น optional) — ฟีเจอร์นี้ optional เต็มรูปแบบ: ใครไม่มีข้อมูลแอพทำงานปกติด้วยสูตร
  Mifflin-St Jeor (น้ำหนัก/ส่วนสูง/อายุ/เพศ) เหมือนเดิม `src/lib/nutrition.ts`'s `computeTargets(profile,
  bodyComposition?)` รับ body-composition เป็น optional argument ตัวที่สอง — ถ้ามีสแกนล่าสุดที่มี
  `bodyFatPercent` จะสลับไปใช้สูตร Katch-McArdle (`computeBmrKatchMcArdle`, อิง lean body mass =
  weightKg × (1 - bodyFat%/100)) แทน และคำนวณโปรตีนจาก lean body mass (2.4 g/kg, `PROTEIN_G_PER_KG_LBM`
  — ปลายบนของช่วง 2.0-2.4 g/kg ที่แนะนำกัน) แทน total bodyweight (1.8 g/kg) — ทุกจุดในแอพที่เรียก
  `computeTargets` (หน้าแรก/ไดอารี่/เชิงลึก/share card/cron water-reminder) ต้องดึง body composition
  ล่าสุดผ่าน `getLatestBodyComposition(userId)` (`src/lib/body-composition.ts`) มาส่งเข้าไปด้วยเสมอ
  ไม่งั้นตัวเลขจะไม่ตรงกันระหว่างหน้าต่าง ๆ (หลักการเดียวกับที่ `applyActivityBonus`'s comment อธิบายไว้
  สำหรับ activity bonus) — ฟังก์ชันนี้คืน `null` ถ้ายังไม่มีสแกน หรือสแกนล่าสุดไม่มี `bodyFatPercent`
  (แค่มี weightKg อย่างเดียวไม่พอคำนวณ lean body mass ได้)
- **นำเข้าผลตรวจ InBody จาก AI** — `BodyCompositionCard` มีโหมด "นำเข้าจาก AI" คู่กับ "กรอกเอง"
  (แถบ tab ในฟอร์มเดียวกัน) แพทเทิลเดียวกับ "นำเข้าจาก AI" ของอาหาร (`ImportMealPanel`) — ไม่เรียก
  vision/OCR API ใด ๆ เลย แค่ให้ผู้ใช้คัดลอก prompt สำเร็จรูปไปถาม Claude/ChatGPT เอง (แนบรูป InBody
  เข้าไปในแชทเอง) แล้ววางคำตอบ 5 บรรทัด "label: value" กลับมาให้ `parseBodyCompositionText`
  (`src/lib/body-composition-import-parse.ts`) อ่านแทนเข้าไปเติมฟิลด์ฟอร์มเดิม (ไม่ได้บันทึกตรง —
  ผู้ใช้ยังต้องกดกด "บันทึกผลตรวจ" อีกทีหลังตรวจดูค่าที่เติมมาให้)
- **กราฟเทรนด์ %ไขมัน/มวลกล้ามเนื้อ** — `BodyCompositionCard` มีกราฟเส้นเล็ก ๆ ต่อจากบล็อก "ตัวเลข
  ล่าสุด"/ก่อนถึงฟอร์มเพิ่มรายการ ใช้ `BodyMetricTrendChart`
  (`src/app/dashboard/nutrition/body-composition-trend-chart.tsx`) — component ทั่วไปดัดแปลงจาก
  `WeightTrendChart` (`weight-trend-chart.tsx`, ภาษาภาพเดียวกัน: gradient fill, hover crosshair,
  delta ต้น-ท้าย) แค่รับ field ไหนก็ได้แทนที่จะผูกกับ `weightKg` ตายตัว — **ตั้งใจแยกเป็น 2 กราฟ ไม่ทำ
  dual-axis กราฟเดียว** เพราะ %ไขมันกับมวลกล้ามเนื้อ(กก.) คนละสเกลกัน ยัดแกน Y เดียวกัน (หรือปลอมแกนที่
  สอง) จะทำให้เส้นใดเส้นหนึ่งอ่านไม่ออกเลย ขัดกับจุดประสงค์ของกราฟเล็ก ๆ แบบนี้ — แต่ละกราฟกรอง entries
  เฉพาะที่มีค่านั้นจริง (`bodyFatPercent`/`skeletalMuscleMassKg` เป็น optional ต่อครั้งตรวจ ไม่ใช่ทุกครั้ง
  จะมีครบ) และโชว์แค่ตอนมี ≥2 จุดข้อมูล — `entries` ที่ page.tsx ส่งมาเป็น newest-first (ใช้กับบล็อก
  ล่าสุด/แถวชิป-ลบด้วย) เลย reverse เป็น oldest-first ก่อนป้อนกราฟ (pattern เดียวกับ `WeightLogCard`) —
  **`higherIsBetter` prop กลับทิศสี delta**: ค่า default (false, ใช้กับ %ไขมัน) ให้ลดลง=เขียว(lime)/
  เพิ่มขึ้น=เหลือง(amber) เหมือน `WeightTrendChart` เดิม แต่มวลกล้ามเนื้อความหมายกลับกัน (เพิ่มขึ้นคือ
  ดี) เลยส่ง `higherIsBetter` ให้กราฟมวลกล้ามเนื้อโดยเฉพาะ — **พบบั๊กนี้เองตอนเทสจริง** (ไม่ใช่ user
  report): ตอนแรกก็อปสีจาก `WeightTrendChart` มาตรง ๆ ทั้งสองกราฟ พอ seed ข้อมูลมวลกล้ามเนื้อเพิ่มขึ้น
  จริง (30→31→32 กก.) แล้วเปิดหน้าเชิงลึกจริง เห็น delta "+2.0 กก." ขึ้นเป็นสีเหลือง (amber) ทั้งที่ควร
  เป็นเรื่องดี แก้เป็น prop นี้แล้วทดสอบซ้ำเห็นเปลี่ยนเป็นเขียวถูกต้อง — ทดสอบจริงด้วยการ seed สแกน 3
  ครั้ง (%ไขมัน 22→20→18, มวลกล้ามเนื้อ 30→31→32 กก.) เปิดหน้าเชิงลึกจริง ตรวจ SVG path ตรง ๆ ยืนยันเส้น
  ทั้งสองกราฟเรียงถูกทิศทาง (ลง/ขึ้นตามข้อมูลจริง) และสี delta ถูกทั้งคู่
- **รูปติดตามรูปร่าง (front/side/back)** — `ProgressPhotosCard`
  (`src/app/dashboard/nutrition/progress-photos-card.tsx`) เก็บเป็นประวัติแบบมีวันที่
  (`ProgressPhotoLog`, ตารางแยก ไม่ใช่ field เดียวบน `User` แบบเดิม) อัปโหลดใหม่แต่ละครั้งคือแถวใหม่
  ไม่เขียนทับของเก่า — การ์ดแสดงรูปล่าสุดของแต่ละมุมเป็นช่องหลัก (แตะเพื่ออัปโหลดรูปใหม่) บวก 2
  ส่วนเสริมที่โผล่มาเมื่อมีประวัติพอ: "เปรียบเทียบก่อน-หลัง" (รูปแรกสุด vs ล่าสุดของแต่ละมุม เทียบ
  side-by-side พร้อมนับจำนวนวันห่างกัน โผล่เมื่อมุมนั้นมี ≥2 รูป) และ "ดูประวัติรูปทั้งหมด" (แถบเลื่อน
  แนวนอนของทุกรูปตามมุม พร้อมลบทีละรูปได้) ไฟล์เก็บนอก `public/` เหมือนเดิม อ่านได้ผ่าน
  `GET /api/progress-photo/[id]` ที่เช็ค ownership จาก `ProgressPhotoLog.userId` เท่านั้น (ไม่ใช่
  `/[angle]` แบบเดิมที่ผูกกับ field เดียวบน User) — ลบบัญชี (`/api/settings/delete-account`) ต้อง
  query `ProgressPhotoLog` ทั้งหมดของ user มาลบไฟล์ทีละอันเองก่อน (cascade ลบแค่แถว DB ไม่ลบไฟล์บนดิสก์)
  — **ลบไฟล์ (progress photo + avatar) ก่อนลบแถว `User` เสมอ ไม่ใช่หลัง** (แก้บั๊กที่เจอจาก audit:
  เดิมลบ `User` ก่อนแล้วค่อยวนลบไฟล์ทีหลัง ถ้า request ตายกลางทางระหว่างนั้นไฟล์จะรั่วค้างบนดิสก์ตลอดไป
  เพราะไม่มี user id เหลือให้ trace กลับมาลบทีหลังได้อีกแล้ว) ทั้ง `deleteAvatarFile`/
  `deleteProgressPhotoFile` (`src/lib/{avatar,progress-photo}-storage.ts`) ถือว่าไฟล์ที่ไม่มีอยู่แล้ว
  เป็น "ลบสำเร็จ" เงียบ ๆ อยู่แล้ว เลย retry ได้ปลอดภัยถ้า request รอบก่อนตายกลางทาง (จะเหลือแค่ `User`
  row ที่ยังไม่ถูกลบ ไม่ใช่ไฟล์ที่ลอยไม่มีใครอ้างถึง)
  — แต่ละมุมมีปุ่ม "ถ่ายรูปพร้อมไกด์" เปิดกล้องในแอพเอง (`getUserMedia`, component แยกที่
  `pose-guide-camera.tsx`) ทับด้วยเส้น silhouette โปร่งแสง (SVG, คนละแบบสำหรับ FRONT/BACK ที่หันหน้า
  เข้ากล้องเหมือนกันทั้งคู่ vs SIDE ที่เป็นมุมข้าง) ให้ยืนตำแหน่ง/ระยะห่างจากกล้องใกล้เคียงกันทุกครั้ง
  ที่ถ่าย เพราะระยะห่างจากกล้องที่ต่างกันทำให้เทียบก่อน-หลังดูเข้าใจผิดได้ง่าย (ยืนใกล้ขึ้นนิดเดียว
  ดูเหมือนผอมลงทั้งที่ตัวไม่ได้เปลี่ยน) — พรีวิวกล้องไม่ mirror เลย (ต่างจากกล้องเซลฟี่ทั่วไป) เพราะ
  frame ที่ capture มาจาก canvas วาดจาก video element ตรง ๆ ต้องให้สิ่งที่เห็นในพรีวิวตรงกับไฟล์ที่
  บันทึกจริงเป๊ะ ไม่งั้นเส้นไกด์จะเทียบกับภาพที่ไม่ตรงกับที่ถ่ายจริง — ถ้าเปิดกล้องไม่ได้ (ไม่มีกล้อง/
  ปฏิเสธสิทธิ์/เบราว์เซอร์ไม่รองรับ) จะโชว์ error พร้อมให้ปิด แล้วกลับไปใช้ปุ่มอัปโหลดจากคลังภาพเดิม
  (ปุ่มเดิมยังอยู่ ไม่ได้ถูกแทนที่) — ไม่มีระบบแจ้งเตือนอัตโนมัติให้ถ่ายรูป (ตั้งใจไม่ทำเพราะรบกวนเกินไป)
  มีแค่ข้อความแนะนำสั้น ๆ ใต้การ์ดว่าถ่ายเป็นระยะเพื่อเทียบกับตัวเองได้

### 3. Bottom nav (`src/app/dashboard/bottom-nav.tsx`)
4 แท็บ: หน้าแรก (`/dashboard`) / ไดอารี่ (`/dashboard/food`) / เชิงลึก (`/dashboard/nutrition`,
ครอบคลุม `/dashboard/knowledge` ด้วย) / บัญชี (`/dashboard/settings`) + ปุ่ม [+] กลางเปิด sheet
ทางลัด 6 อัน (เพิ่มอาหาร/บันทึกกิจกรรม/อาหารเสริม/บันทึกน้ำหนัก/ถ่ายรูปติดตามรูปร่าง/บันทึกผลตรวจ
InBody) — 2 อันหลังลิงก์ไป `/dashboard/nutrition?quick=photo|inbody`: หน้า nutrition อ่าน
`searchParams.quick` แล้วส่ง `autoOpenAngle="FRONT"`/`autoOpen` ลงไปให้ `ProgressPhotosCard`/
`BodyCompositionCard` เปิดกล้อง (หรือฟอร์ม) ให้เองทันทีพร้อม scroll ไปหาเลย ไม่ต้องกดหาการ์ดเอง
เหมือนเข้าหน้าเชิงลึกแบบธรรมดา หน้าที่ไม่มีแท็บของตัวเอง (records, compare,
achievements, activity detail) เข้าถึงผ่านลิงก์จากหน้าแรกเท่านั้น

### 4. Share cards (Satori/`next/og`) — จริง ๆ คือ "ดาวน์โหลด" ไม่ใช่ "แชร์"
- `src/app/api/share/{daily-summary,nutrition,period,[id]}/route.tsx` — สร้างรูปสรุปเป็น PNG ให้
  ดาวน์โหลด (`[id]` = การ์ดกิจกรรมเดี่ยว เปิดจากปุ่มที่หน้ารายละเอียดกิจกรรม) — **ไม่มีการเรียก
  `navigator.share`/OS share sheet ที่ไหนในแอพเลย** ทุกปุ่มจบที่ดาวน์โหลดไฟล์ตรง ๆ (`<a download>`)
  เพราะงั้นข้อความ UI ทุกจุดที่เกี่ยวกับฟีเจอร์นี้เลยใช้คำว่า "ดาวน์โหลด" ("Download") ไม่ใช่ "แชร์"
  ("Share") — เดิมตั้งชื่อ/ปุ่มว่า "แชร์" มาตั้งแต่แรกสร้างฟีเจอร์ (ยังเหลือร่องรอยที่ชื่อไฟล์/component
  `share-activity-button.tsx`/`ShareActivityButton`, `src/app/api/share/*` เป็นชื่อ route เดิมที่ไม่ได้
  เปลี่ยนตาม เพราะเปลี่ยน route path จะ breaking การ์ดเก่าที่แชร์ไปแล้ว) แก้แค่ข้อความที่ผู้ใช้เห็น
  ไม่ได้ไล่ rename ไฟล์/ตัวแปรทั้งหมด
- สไตล์การ์ดร่วมกันอยู่ที่ `src/lib/share-card-styles.ts` (`cardStyle`, `rowCardStyle`, `titleStyle`,
  `iconCircleStyle`) — ใช้ทั้ง period/nutrition (โทนเข้มเดิม navy/green) และ daily-summary
- **หัวการ์ด period/nutrition ใช้โลโก้ mascot แล้วเหมือน `[id]`/`daily-summary`** — เดิม 2 route นี้ยังเป็น
  ไอคอนสี่เหลี่ยม "M" ตัวอักษรตายตัว (`linear-gradient` + ข้อความ "M") ค้างมาจากก่อนที่ `[id]/route.tsx`
  จะเปลี่ยนไปใช้ mascot logo (ดูบล็อก "หัวการ์ด = โลโก้ mascot เดี่ยว ๆ" ด้านล่าง) — ตกหล่นไม่ได้ตามไปแก้
  ตอนนั้น พบจาก audit ตรวจโค้ดหน้าดาวน์โหลดทั้งหมด (เทียบรูป render จริงของทั้ง 4 การ์ดแล้วเห็นชัดว่า
  "M" ดูเหมือน placeholder ข้างโลโก้จริง) — แก้ด้วยการเรียก `loadMascotLogoDataUri()`
  (`src/lib/share-logo.ts`) คู่กับ `loadShareFonts()` ใน `Promise.all` เดียวกัน (แพทเทิร์นเดียวกับ
  `[id]/route.tsx`) แล้วแทนที่ `<div>M</div>` ด้วย `<img src={mascotLogo} width={56} height={56}
  style={{ borderRadius: 14 }} />` — **คงขนาด 56×56 เดิม + คงข้อความ "MooPaTa"/วันที่ไว้ข้าง ๆ เหมือนเดิม
  ทุกอย่าง ไม่ได้ redesign เป็นโลโก้เดี่ยว ๆ 96×96 แบบ `[id]`** เพราะ 2 route นี้ไม่มีระบบ `?pos` จัด
  ตำแหน่งบล็อกรายละเอียดแบบ `[id]` การย้ายข้อความ/วันที่ออกจากแถวโลโก้จะเป็นการ redesign ใหญ่เกินขอบเขต
  ของแค่ "เปลี่ยนไอคอนที่ดูล้าสมัย" ตามที่ตรวจพบ — เปลี่ยนแค่ไอคอนโดยไม่แตะ layout ที่เหลือเลย
- **`Cache-Control: private, max-age=120`** ทั้ง 4 route (เดิมเป็น `no-cache, no-store`) — ผู้ใช้บ่นว่า
  พรีวิวในชีทดาวน์โหลดช้า เพราะทุกครั้งที่เปลี่ยนตัวเลือก (style/bg/lang/pos ฯลฯ) ต้อง query DB +
  render ผ่าน Satori ใหม่ทั้งหมดไม่มี cache เลยสักนิด แก้ด้วยการให้ browser cache ตาม URL เต็ม (ซึ่งมี
  query param ครบทุกตัวที่มีผลต่อรูปอยู่แล้ว) สั้น ๆ 120 วิ — สลับกลับไปดูตัวเลือกที่เพิ่งพรีวิวไปแล้วจะ
  ได้รูปทันทีไม่ต้อง render ซ้ำ แต่ตัวเลือกใหม่ที่ไม่เคยเจอยังคงช้าเท่าเดิม (แก้ไม่ได้ด้วยวิธีนี้ ต้องลด
  ความซับซ้อนของการ์ดเองถึงจะเร็วขึ้นจริง) — `private` (ไม่ใช่ `public`) เพราะเป็นข้อมูลหลัง auth
  เฉพาะคนเฉพาะ session กันไม่ให้ shared/CDN cache เก็บไว้ — 120 วิสั้นพอที่จะไม่เจอปัญหารูป cache ค้าง
  ถ้าแก้ไข/ลบกิจกรรมระหว่างนั้นพอดี (โอกาสน้อยมากเพราะเป็นช่วงเวลาสั้น ๆ ตอนกำลังเลือกตัวเลือกอยู่)
- ข้อจำกัดของ Satori ที่เจอแล้ว: ไม่รองรับ `conic-gradient()`, `justify-content: space-evenly`
  (ใช้ `"space-around"` แทน), ตัวอักษร "ล" ท้ายคำที่โดดเดี่ยว render เพี้ยน (เลี่ยงด้วยการใช้คำเต็ม)
- **`?lang=th|en` — เลือกภาษาของเนื้อหาในรูปได้ ไม่ผูกกับภาษา UI ของแอพ** ทั้ง 4 route รองรับเหมือนกัน
  (default `"th"` ถ้าไม่ส่งมา หรือส่งค่าอื่นที่ไม่ใช่ `"th"`/`"en"` มา) — ตั้งใจแยกจาก
  `resolveLocale()`/`User.locale` ที่คุมภาษา UI (ดู "### 5. ภาษา (i18n)") เพราะเป็นคนละการตัดสินใจกัน:
  ผู้ใช้เปิดแอพเป็นไทยอาจอยากดาวน์โหลดการ์ดเป็นอังกฤษไปโพสต์ก็ได้ (หรือกลับกัน) — ค่า default ที่ปุ่ม/sheet
  ทุกจุดเลือกไว้ให้คือภาษา UI ปัจจุบันของผู้ใช้ (`resolveLocale()`/`useLocale()` แล้วแต่ context) แต่ผู้ใช้
  เปลี่ยนได้เองทุกครั้งก่อนกดดาวน์โหลด ไม่ persist ข้ามครั้ง (ไม่มี field ใน DB เก็บ "ภาษาการ์ดที่เลือกล่าสุด")
  — โครงสร้าง:
  - **`src/lib/share-card-i18n.ts`** — ดิกชันนารีข้อความของทั้ง 4 การ์ด แยกจาก `messages/th.json`/
    `messages/en.json` (แคตตาล็อกของ UI แอพเอง) เพราะ route handler พวกนี้ไม่ได้อยู่ใต้ React tree ที่
    `NextIntlClientProvider` ห่อไว้ และเป็นคนละแนวคิดกับ locale ของ session ตามที่อธิบายข้างบน —
    `parseShareLang(searchParams, fallback)` อ่าน `?lang=` แล้ว fallback ถ้าค่าไม่ใช่ `"th"`/`"en"`,
    `shareT(lang)` คืน object ข้อความ/ฟังก์ชันสร้างข้อความ (เช่น `t.prBadge(name, weightKg)`,
    `t.daysOfLabel(logged, total)`) ให้แต่ละ route เรียกใช้
  - **`src/lib/format.ts` เพิ่ม optional param ตัวสุดท้าย `lang: FormatLang = "th"`** ให้
    `formatDuration`/`formatDistanceKm`/`formatDistanceParts`/`formatSpeedKmh`/`formatPace`/
    `formatSwimPace`/`activitySpeedValue`/`formatElevationM`/`formatActivityDate`/`activityTypeLabel`
    (หน่วย: กม./ไมล์/กม.ต่อชม./นาทีต่อกม./ชม./นาที ฯลฯ ล้วนสลับ TH/EN ได้ตามนี้) — **ค่า default
    `"th"` ทำให้ทุกจุดเรียกเดิมในแอพ (หน้าสถิติสูงสุด/เปรียบเทียบ/รายละเอียดกิจกรรม/month-highlights
    ฯลฯ ที่ไม่ได้ส่ง `lang` มา) พฤติกรรมเหมือนเดิมทุกอย่าง ไม่กระทบเลย** — เฉพาะ 4 share route
    เท่านั้นที่ส่ง `lang` (มาจาก `parseShareLang`) เข้าไปจริง ๆ — `formatSigned*`/`cadenceUnitLabel`
    ไม่ได้แก้ (ตัวแรกไม่ได้ใช้ในการ์ดแชร์เลย, ตัวหลัง "rpm"/"spm" เหมือนกันทั้ง 2 ภาษาอยู่แล้ว)
  - **ปุ่มดาวน์โหลดที่มี sheet ให้ปรับตัวเลือกอื่นอยู่แล้ว** (`ShareActivityButton`
    ที่หน้ารายละเอียดกิจกรรม, `SummaryConfigurator` ที่ `/dashboard/summary`) — เพิ่มแถบเลือกภาษา
    (ไทย/English) เข้าไปในฟอร์ม/sheet เดิมตรง ๆ ต่อ query param `lang=` เข้า href เดียวกับตัวเลือกอื่น
    ที่มีอยู่แล้ว (style/bg/pos สำหรับกิจกรรม, fields/bg สำหรับสรุปประจำวัน) — คนละ state เดี่ยว ๆ
    ไม่ผูกกับตัวเลือกอื่นเลย
  - **ปุ่มดาวน์โหลดที่เดิมเป็นลิงก์ตรง ไม่มี sheet เลย** (ดาวน์โหลดสรุปสัปดาห์นี้/เดือนนี้ที่หน้าแรก,
    ดาวน์โหลดสรุปเดือนนี้ที่หน้าเชิงลึก) — ต้องสร้าง sheet ใหม่ให้ แทนที่จะทำ 3 sheet แยกกันซ้ำโค้ดเกือบ
    เป๊ะ ๆ (พรีวิวแบบ debounce, checkerboard backdrop, ปุ่มดาวน์โหลด) ดึงออกมาเป็น
    **`src/app/dashboard/quick-download-sheet.tsx`'s `QuickDownloadSheet`** — component เดียว รับ
    label/ข้อความทุกอย่างเป็น prop (ไม่เรียก `useTranslations` เองข้างใน เพราะต้องใช้ได้ทั้งจากหน้าที่
    แปลแล้วอย่างหน้าแรก/เชิงลึกที่ส่ง label ผ่าน `t()` มาให้ และในอนาคตอาจมีหน้านอกขอบเขต i18n เรียกด้วย)
    รับแค่ `hrefBase: string` (URL ของ route ตัวเอง ไม่รวม `lang`, เช่น `/api/share/period?range=week`)
    ให้ caller คุม query param อื่นที่ route ของตัวเองต้องการเอง แล้ว component เติม `&lang=`/`?lang=`
    ต่อท้ายเองตอน build href จริง — **เดิมเป็น `buildHref: (lang) => string` (callback function) แต่
    พังจริงบน production**: `dashboard/nutrition/page.tsx` เป็น Server Component (ต้องเรียก Prisma/
    session ตรง ๆ ไม่มีทางเป็น `"use client"` ได้) เรียก `<QuickDownloadSheet buildHref={(lang) => ...} />`
    ตรง ๆ — ส่ง function เป็น prop ข้าม server→client boundary ไม่ได้ (React error "Functions cannot be
    passed directly to Client Components") ทำให้หน้าเชิงลึกพังทั้งหน้า (500, error digest เฉย ๆ ไม่มี
    stack ให้ดูฝั่ง client) เปลี่ยนเป็น string เพราะ serialize ข้าม boundary ได้ตรง ๆ ไม่ต้องพึ่ง function
    เลย — ระหว่างแก้เจอบั๊กที่สองคู่กัน: `dashboard/period-comparison.tsx` เรียก `useTranslations()`
    (client-only hook) โดยไม่มี `"use client"` เลยทั้งที่ import มาจาก `dashboard/page.tsx` (Server
    Component) ตรง ๆ — เพิ่ม `"use client"` ให้ไฟล์นี้ด้วย (จำเป็นอยู่แล้วเพราะ hook, ไม่ใช่แค่เพราะ
    `hrefBase`) — `ShareActivityButton`/`SummaryConfigurator` ไม่โดนบั๊กนี้เพราะรับแค่ prop primitive
    (`activityId`/`defaultLang`) แล้ว build href เองข้างในทั้งหมด ไม่มี caller ไหนส่ง function เข้ามาเลย
    — ปุ่ม "ภาษา"/"ดาวน์โหลดรูปภาพ (PNG)"/"กำลังโหลดตัวอย่าง..." ที่ใช้ร่วมกันบ่อย ย้ายไปอยู่ namespace
    `common` ใน `messages/th.json`/`messages/en.json` แทนที่จะประกาศซ้ำในแต่ละ namespace ของ component
  - **ปิด sheet ได้ 3 ทางแล้ว: แตะพื้นหลัง (เดิม), ปุ่ม X มุมขวาหัว sheet, กด Esc** — เดิม
    `ShareActivityButton`/`QuickDownloadSheet` (2 ตัวที่เป็น sheet จริง — `SummaryConfigurator` เป็น
    หน้าเต็มที่ `/dashboard/summary` ไม่ใช่ sheet เลยไม่เข้าเกณฑ์นี้) ปิดได้ทางเดียวคือแตะพื้นหลัง พบจาก
    audit ตรวจหน้าดาวน์โหลด — เพิ่ม `useEffect` ฟัง `keydown` เรียก `setOpen(false)` เมื่อ
    `e.key === "Escape"` (ผูกเฉพาะตอน `open === true` และ cleanup listener ตอน unmount/ปิด) กับปุ่ม X
    (`aria-label` เท่านั้น ไม่มีข้อความโชว์) วางไว้แถวเดียวกับหัวข้อ sheet (`flex justify-between`) —
    `ShareActivityButton` hardcode `aria-label="ปิด"` ตรง ๆ (หน้ารายละเอียดกิจกรรมยังไม่อยู่ในขอบเขต
    i18n อยู่แล้ว) ส่วน `QuickDownloadSheet` เพิ่ม prop `closeLabel: string` ให้ caller ส่งมา (ตาม
    แพทเทิร์นเดียวกับ `languageLabel`/`downloadLabel`/`previewLoadingLabel` เดิม) เพิ่ม key
    `common.close` ใน `messages/th.json`/`messages/en.json` ให้ 3 caller (`period-comparison.tsx`,
    `trend-chart.tsx`, `nutrition/page.tsx`) เรียก `tc("close")` ส่งเข้าไปเหมือน common label อื่น ๆ —
    ทดสอบจริงด้วย Playwright (เปิดหน้าจริงผ่าน session cookie, viewport มือถือ 390×844 เพราะ default
    viewport ทำให้ปุ่มอยู่นอกจอ `outside of the viewport` คลิกไม่ได้) คลิกปุ่ม X และกด Esc ยืนยันว่า
    sheet ปิดจริงทั้ง `ShareActivityButton` (หน้ารายละเอียดกิจกรรม) และ `QuickDownloadSheet` (ปุ่ม
    ดาวน์โหลดสรุปสัปดาห์นี้ที่หน้าแรก) ครบทั้ง 2 ทางปิดใหม่
  - **ปุ่มดาวน์โหลดทั้งหมด (`ShareActivityButton`/`QuickDownloadSheet`/`SummaryConfigurator`) เคยกด
    แล้วเงียบไปพักนึง เข้าใจผิดว่าไม่ทำงาน แล้วกดซ้ำจะได้ไฟล์ซ้ำ 2 ไฟล์** — ผู้ใช้แจ้งเจอเองระหว่างเทส
    `?style=list` (ดูข้อด้านบน) — สาเหตุคือทั้ง 3 ปุ่มเดิมเป็น `<a href={href} download>` ธรรมดา
    (`ShareActivityButton` ยัง `onClick={() => setOpen(false)}` ปิด sheet ทันทีด้วย) ซึ่งเป็นแค่
    navigation ไปโหลดไฟล์ ไม่มีทาง hook JS event ใด ๆ มาบอกได้เลยว่า "กำลังโหลดอยู่" หรือ "โหลดเสร็จแล้ว"
    — พอ route เบื้องหลังใช้เวลานาน (ดู perf comment ด้านบน: render จริงหลาย ๆ วิ, แถม `ImageResponse`
    บล็อก event loop ทั้ง process ถ้ามี render ใหญ่อื่นค้างอยู่พอดี) ผู้ใช้เห็นแค่ sheet ปิดไปเฉย ๆ
    ไม่มี indicator อะไรเลย เข้าใจว่าไม่ทำงานเลยกดปุ่ม "ดาวน์โหลด" ซ้ำ → ยิง request ที่สองที่เป็นอิสระ
    จากอันแรกเต็มตัว พอทั้งสอง request เสร็จ (ไม่ว่าจะช้าแค่ไหน) browser จะเซฟเป็น 2 ไฟล์คนละชื่อ (เช่น
    "moopata-activity(1).png") เพราะ `<a download>` ไม่มีกลไกกันขอซ้ำในตัวเลย — แก้โดยเปลี่ยนทั้ง 3 จุด
    จาก `<a download>` เป็น `<button>` ที่ `fetch(href)` เอง แล้วค่อยสร้าง `Blob`/`URL.createObjectURL`
    + `<a>` สังเคราะห์คลิกเองเพื่อเซฟไฟล์ (pattern เดียวกันทั้ง 3 จุด, มี state `downloading`/
    `downloadFailed` ของตัวเอง) — **`if (downloading) return` ที่ต้นฟังก์ชัน + ปุ่ม `disabled={downloading}`
    ร่วมกันกันไม่ให้กดซ้ำยิง request ที่สองได้เลยระหว่างรอ** (ต่างจาก `<a>` เดิมที่กดกี่ทีก็ fire ใหม่ได้
    ทุกครั้งไม่มีทางกัน) ระหว่างรอปุ่มโชว์สปินเนอร์ + "กำลังสร้างรูป..." แทนข้อความปกติ ให้เห็นชัดว่ากำลัง
    ทำงานอยู่จริง ไม่ใช่ค้าง — ปิด sheet เฉพาะตอนโหลดสำเร็จแล้วเท่านั้น (ไม่ปิดทันทีที่กดแบบเดิมอีกต่อไป
    ยกเว้น `SummaryConfigurator` ที่เป็นหน้าเต็มอยู่แล้วไม่มี sheet ให้ปิด) ถ้า fetch fail (เช่น 500/
    network error) โชว์ข้อความ "สร้างรูปไม่สำเร็จ ลองใหม่อีกครั้ง" ใต้ปุ่มแทนที่จะเงียบแล้วปล่อยให้ผู้ใช้
    งงต่อว่าทำไมไม่มีไฟล์ลงมา — ชื่อไฟล์: `ShareActivityButton` hardcode `"moopata-activity.png"` ตรง ๆ
    (มีแค่ route เดียว ชื่อไม่มีทางเปลี่ยน) ส่วน `QuickDownloadSheet`/`SummaryConfigurator` **อ่านชื่อไฟล์
    จาก response header `Content-Disposition` ของ route เอง** (`disposition.match(/filename="([^"]+)"/)`)
    แทนที่จะ hardcode ซ้ำในฝั่ง client เพราะ `QuickDownloadSheet` ตัวเดียวหน้าหลายจุดเรียกไป 2 route ที่
    ตั้งชื่อไฟล์ไม่เหมือนกัน (`period` มี `range=week|month` ในชื่อ, `nutrition` ชื่อคงที่) — อ่านจาก
    header เป็นจุดเดียวที่ชื่อไฟล์ไม่มีวันไม่ตรงกับที่ route ตั้งใจจริง ๆ ไม่ต้อง sync สองที่ — เพิ่ม key
    `common.generatingImage`/`common.downloadFailed` ใน `messages/th.json`/`messages/en.json` ให้ 3
    caller ของ `QuickDownloadSheet` (`period-comparison.tsx`, `trend-chart.tsx`, `nutrition/page.tsx`)
    ส่งเข้าไปเหมือน `closeLabel` ก่อนหน้า — ทดสอบจริงด้วย Playwright ทั้ง `ShareActivityButton`
    (เลือกสไตล์ `list` เพื่อให้ render ช้าจริง ตามสถานการณ์ที่ผู้ใช้เจอ) และ `QuickDownloadSheet`
    (ปุ่มดาวน์โหลดสรุปสัปดาห์นี้ที่หน้าแรก): ยืนยันว่ากดครั้งแรกปุ่มเปลี่ยนเป็น "กำลังสร้างรูป..." +
    `disabled` ทันที, กดซ้ำระหว่างนั้นไม่ทำให้จำนวน network request ไปที่ route เพิ่มขึ้นเลย (นับจาก
    `page.on("request")`), ได้ `download` event แค่ครั้งเดียวพร้อมชื่อไฟล์ถูกต้อง, และ sheet ปิดเองหลัง
    โหลดสำเร็จ — **หมายเหตุที่พบระหว่างเทสแต่ไม่ใช่บั๊กที่แก้รอบนี้**: preview `<img>` เดิม (ก่อนแก้ปุ่ม
    ดาวน์โหลด) fire request ไปที่ route เดียวกัน **2 ครั้ง** ตอนสลับ style/bg (เห็นจาก
    `page.on("request")` เหมือนกัน) — น่าจะเป็น artifact ของ service worker (แอพเป็น PWA มี service
    worker) ที่ intercept แล้ว forward request ต่อ ทำให้ Playwright เห็นเป็น 2 request layer แยกกันทั้งที่
    เป็น network round-trip เดียว ไม่ใช่ preview เรียก Satori render จริง 2 รอบ — ไม่กระทบไฟล์ที่ดาวน์โหลด
    เลย (คนละกลไกกับปุ่มดาวน์โหลดที่แก้ในข้อนี้) ยังไม่ได้ไล่ยืนยัน root cause ให้ชัดเจน 100% เก็บไว้เป็น
    จุดสังเกตเผื่อมีใครเจอปัญหาที่เกี่ยวข้องในอนาคต
  - **ข้อความ "สร้างรูปไม่สำเร็จ" ค้างข้ามการปิด-เปิด sheet ใหม่** — บั๊กที่พบจาก code review รอบ audit
    หน้าดาวน์โหลดทั้งหมด (ไม่ใช่ user report) ของ `ShareActivityButton`/`QuickDownloadSheet` — `downloading`/
    `downloadFailed` เป็น state ของ component หลัก (`ShareActivityButton`/`QuickDownloadSheet` เอง) ไม่ใช่
    state ของ sheet ที่ mount/unmount ตาม `open` ปิด sheet (แตะพื้นหลัง/ปุ่ม X/Esc) แล้วไม่ได้รีเซ็ตค่านี้เลย
    — พอมีการดาวน์โหลดล้มเหลวครั้งหนึ่ง (network error/500) แล้วผู้ใช้ปิด sheet ไปโดยยังไม่ได้ลองใหม่ให้สำเร็จ
    ครั้งถัดไปที่กดปุ่ม "ดาวน์โหลด" เปิด sheet ขึ้นมาใหม่จะเห็นข้อความ "สร้างรูปไม่สำเร็จ ลองใหม่อีกครั้ง"
    โผล่ขึ้นมาทันที**ก่อน**กดปุ่มดาวน์โหลดจริงด้วยซ้ำ ทำให้เข้าใจผิดว่า sheet ที่เพิ่งเปิดใหม่พังไปแล้ว
    ทั้งที่จริง ๆ เป็นข้อความค้างจากความพยายามครั้งก่อน — ยืนยันจริงด้วย Playwright: บล็อค request
    `/api/share/**` ด้วย `route.abort()` ให้ดาวน์โหลดล้มเหลวจริง → ปิด sheet ด้วย Esc → เปิดใหม่โดยยัง
    ไม่กดดาวน์โหลดอีก → เห็นข้อความ error ค้างอยู่ทันที — แก้โดยรีเซ็ต `setDownloadFailed(false)` ที่ปุ่ม
    trigger ("ดาวน์โหลด") ตอนกด**เปิด** sheet ทั้งสองจุด (ไม่ใช่ตอนปิด เพราะปิดได้หลายทาง เช็คจุดเดียวที่
    เปิดง่ายกว่า) — `SummaryConfigurator` ไม่โดนบั๊กนี้เพราะเป็นหน้าเต็มที่ `/dashboard/summary` ไม่ใช่
    sheet ที่ปิด-เปิดซ้ำได้ ออกจากหน้าแล้วกลับมาใหม่คือ mount รอบใหม่ state เริ่มจาก default เสมออยู่แล้ว
  - **`ShareActivityButton` ไม่ hardcode `"moopata-activity.png"` แล้ว** — เปลี่ยนเป็น
    `moopata-${typeSlug}-${dateSlug}.png` (เช่น `moopata-weighttraining-2026-09-19.png`) ตอนกด
    "บันทึกไฟล์" ในโค้ด `handleDownload()`, `typeSlug` มาจาก `Activity.type` ดิบ (เป็น ASCII identifier
    อยู่แล้ว เช่น `"Run"`/`"WeightTraining"` ไม่ต้อง map เป็นภาษาแสดงผล) lowercase แล้ว replace อักขระที่
    ไม่ใช่ `a-z0-9` เป็น `-`, `dateSlug` มาจาก `activity.startedAt` (วันที่ของกิจกรรมเอง ไม่ใช่ "วันนี้"
    ที่กดดาวน์โหลด — สำคัญตอนกลับมาโหลดซ้ำกิจกรรมเก่าหลังผ่านไปนาน) — component รับ prop ใหม่
    `activityType`/`startedAtMs` เพิ่มจากเดิม (`activityId`/`defaultLang`/`hasExercises`), caller เดียว
    (`activity/[id]/page.tsx`) ส่ง `activity.type`/`activity.startedAt.getTime()` เข้าไป — แค่เปลี่ยน
    ชื่อไฟล์ที่เซฟ ไม่กระทบ route/`Content-Disposition` ของ `/api/share/[id]` เอง (route ไม่เคยตั้งชื่อไฟล์
    มาก่อน ฝั่ง client hardcode เองมาตลอด) ทดสอบจริงด้วย Playwright: กดดาวน์โหลดกิจกรรม WeightTraining ที่
    บันทึกวันที่ 2026-09-19 ได้ `download.suggestedFilename()` เป็น `"moopata-weighttraining-2026-09-19.png"`
    — **`dateSlug` ต้องมาจาก `localDateKey()` (`src/lib/streak.ts`, วันปฏิทินท้องถิ่น) ไม่ใช่
    `toISOString().slice(0, 10)` (วันแบบ UTC)** — บั๊กที่พบจาก code-review รอบตรวจของฟีเจอร์นี้เอง
    (ไม่ใช่ user report): เดิมใช้ `toISOString()` ตรง ๆ ซึ่งเป็นบั๊กคลาสเดียวกับที่ `localDateKey()`'s
    comment เตือนไว้อยู่แล้ว (ดู "### 1." ด้านบน) — กิจกรรมที่เริ่มไม่นานหลังเที่ยงคืนตามเวลาท้องถิ่น
    (เช่น ไทย UTC+7) จะยังเป็น "เมื่อวาน" ในโซนเวลา UTC ทำให้ชื่อไฟล์ลงวันที่ผิดไปหนึ่งวันจากวันที่ที่
    แสดงผลจริงทุกจุดอื่นในแอพ (`formatActivityDate()` ใช้ `toLocaleDateString()` ตามเวลาท้องถิ่นเสมอ) —
    ยืนยันจริงด้วยการ seed กิจกรรมที่ `startedAt` = 2026-09-18 18:00 UTC (= 2026-09-19 01:00 เวลาไทย)
    แล้วเปิดด้วย Playwright context ที่ตั้ง `timezoneId: "Asia/Bangkok"` — ก่อนแก้ได้ชื่อไฟล์ลงท้าย
    `-2026-09-18` (ผิด) หลังแก้ได้ `-2026-09-19` (ถูก ตรงกับวันที่แสดงผลบนหน้า)
  - **หน้ารายละเอียดกิจกรรม (`ActivityDetailPage`) เข้าขอบเขตแปล UI แล้ว (ดูหัวข้อ "### 5." ด้านบน)**
    — เดิมตั้งใจปล่อยไว้นอกขอบเขต เรียก `resolveLocale()` ตรง ๆ แทน `next-intl`'s `getLocale()` เพราะ
    ตอนนั้นยังไม่ได้แปลข้อความ UI ของหน้านี้เลยสักจุด ตอนนี้หน้านี้แปลครบแล้วจึงเปลี่ยนมาเรียก `getLocale()`/
    `getTranslations()` จาก `next-intl/server` ตรง ๆ เหมือนหน้าหลักอื่น ๆ (ผลลัพธ์ locale ที่ได้เหมือนเดิม
    ทุกอย่าง เพราะ `getLocale()` ก็เรียก `resolveLocale()` อยู่ข้างใน แค่เปลี่ยนจุดที่ import มาให้ตรงกับ
    การใช้งานจริงของหน้านี้)
- **ปุ่ม "แชร์" (Web Share API) คู่กับปุ่มดาวน์โหลดเดิม** — ทั้ง 3 จุด (`ShareActivityButton`,
  `QuickDownloadSheet`, `SummaryConfigurator`) ตรวจ `"share" in navigator && "canShare" in navigator`
  ผ่าน `useEffect` (client-only, กัน SSR mismatch) เก็บเป็น state `canWebShare` — ถ้าเบราว์เซอร์รองรับ
  โชว์ปุ่ม "แชร์" เป็นปุ่มหลัก (เขียว, มีไอคอน share) คู่กับปุ่ม "ดาวน์โหลด" ที่ลดเป็นปุ่มรองแบบ outline
  ข้อความสั้นลง แทนที่ปุ่ม "ดาวน์โหลดรูปภาพ (PNG)" เต็มความกว้างเดิม (ถ้าไม่รองรับ ยังคงเห็นแค่ปุ่ม
  ดาวน์โหลดเดิมเป๊ะ ไม่มีอะไรเปลี่ยน) — **เช็ค `navigator.canShare({ files: [file] })` อีกรอบตอนกดแชร์จริง
  เสมอ ไม่เชื่อแค่ `"share" in navigator` ตอน feature-detect** เพราะเบราว์เซอร์บางตัวมี `navigator.share`
  แต่ไม่รองรับแชร์ไฟล์ (เช่น รองรับแค่แชร์ข้อความ/URL) ถ้า `canShare` ปฏิเสธจะ fallback ไปเซฟไฟล์แบบเดิม
  (`saveBlob()`) แทนที่จะโยน error ให้ผู้ใช้เจอ — `handleShare()`: `fetch(href)` → `blob()` → ห่อเป็น
  `File` (ชื่อไฟล์เดียวกับที่ดาวน์โหลดใช้ — `ShareActivityButton`/`QuickDownloadSheet` ดึงมาจาก
  `buildFilename()`/`Content-Disposition` header ที่มีอยู่แล้ว) → `canShare` ผ่านค่อย `navigator.share()`
  ไม่ผ่านค่อย `saveBlob()` — **`AbortError` (ผู้ใช้กดยกเลิก share sheet ของ OS เอง) จับแล้วเงียบ ไม่ใช่
  ความล้มเหลว** ต่างจาก error อื่นที่ยัง `setDownloadFailed(true)` โชว์ข้อความ "สร้างรูปไม่สำเร็จ" เหมือนเดิม
  — ปุ่มแชร์มี busy-guard ร่วมกับปุ่มดาวน์โหลด (`if (downloading || sharing) return`) กันกดสองปุ่มพร้อมกัน
  ยิง fetch ซ้อนสองรอบ — `SummaryConfigurator` (หน้าเต็ม ไม่ใช่ sheet) ไม่มี `setOpen(false)` ในทั้งสอง
  handler เหมือนเดิม (ไม่เคยมีอะไรให้ปิด)
- **`ShareActivityButton` จำตัวเลือกสไตล์/พื้นหลัง/ตำแหน่งข้ามการเปิดปุ่มแชร์ครั้งใหม่แล้ว** (`localStorage`
  key `moopata_activity_share_config_v1`, per-device) — เดิมทุกครั้งที่เปิด sheet ใหม่ (แม้จะปิด-เปิดในหน้า
  เดียวกัน หรือกลับมาดูกิจกรรมอื่นทีหลัง) เริ่มจาก `style=grid`/`bg=opaque`/`pos=center` ค่า default เสมอ
  ทั้งที่คนน่าจะมีชุดที่ชอบใช้ซ้ำ (เช่น ชอบ `hero`+`transparent` ไว้แปะ IG story) — ตาม pattern เดียวกับ
  `SummaryConfigurator`'s `moopata_summary_config_v1` ที่มีอยู่ก่อนแล้ว (อ่านเฉพาะใน `useEffect` ไม่ใช่
  lazy `useState` initializer กัน SSR crash, เขียนใน `useEffect` แยกอีกตัวคีย์ด้วยค่าที่จะ persist,
  ทั้งอ่าน/เขียนห่อ `try/catch` เงียบ ๆ) — **ตั้งใจไม่จำ `lang`** เหมือนกติกาเดิมของทั้ง 4 share route
  ทั้งหมด (ภาษาการ์ดไม่ persist ข้ามครั้งอยู่แล้ว ดู `?lang=` ด้านบน) — ตอน restore เช็คว่าค่าที่เก็บไว้ยัง
  valid กับตัวเลือกปัจจุบันก่อนใช้ (`style`/`bg`/`pos` เทียบกับ array ตัวเลือกจริง กัน localStorage ค้าง
  ค่าเก่าจาก version ก่อนที่ตัวเลือกอาจเปลี่ยนชื่อ) และ **clamp `style` จาก `"list"` กลับเป็น `"grid"` ถ้า
  กิจกรรมปัจจุบัน `!hasExercises`** (เผื่อจำค่า `list` มาจากกิจกรรมเวทเทรนนิ่งก่อนหน้า แล้วมาเปิดกิจกรรม
  ที่ไม่มีท่าเวทเลย — ปุ่ม "รายการท่า" ไม่โชว์ให้เลือกอยู่แล้วสำหรับกิจกรรมนี้ ถ้าไม่ clamp จะค้างเลือก
  style ที่กดเลือกไม่ได้จริงในหน้านี้)
- **การ์ดสรุปผลประจำวัน** (`/dashboard/summary`, `daily-summary/route.tsx`) มีธีมของตัวเอง แยกจาก
  period/nutrition — พื้นหลัง gradient ส้ม/น้ำตาลอุ่นแทนโทนเข้ม navy/green เดิม, หัวการ์ดโชว์
  avatar+ชื่อผู้ใช้จริง (`avatarPath` self-upload อ่านไฟล์แล้ว embed เป็น data URI เพราะ
  `/api/avatar` เป็น route ที่ auth-gated next/og ดึง URL ตรงไม่ได้ ส่วน `avatarUrl` จาก Google
  ดึงตรงได้เลยเพราะเป็น URL public) แทนโลโก้ "M" เฉย ๆ, ตัวเลขแคลอรี่ใหญ่ขึ้น (76px)
  — เพิ่ม 2 หัวข้อใหม่ที่เลือกโชว์ได้ (เหมือนหัวข้ออื่นในหน้า configurator):
  - `goal` — ความคืบหน้าเป้าหมายระยะทางเดือนนี้ (`User.monthlyGoalKm` เทียบผลรวม
    `distanceMeters` ตั้งแต่ต้นเดือนถึงวันที่เลือก) โชว์แค่ถ้าตั้งเป้าไว้
  - `heatmap` — จุดสี่เหลี่ยม 7 อัน แทนความสม่ำเสมอบันทึกอาหาร 7 วันล่าสุด **นับถอยหลังจากวันที่เลือก
    ในหน้า configurator ไม่ใช่จาก "วันนี้" เสมอไป** (`buildWeekDots` แยกจาก `buildDayCounts` ใน
    `src/lib/streak.ts` เพราะอันนั้น anchor ที่ "วันนี้" เสมอ ใช้กับ streak card/heatmap ในหน้า
    เชิงลึกที่เป็นปัจจุบันเท่านั้น — การ์ดนี้เลือกดูวันในอดีตได้ด้วยจาก date picker)
  - **`?bg=transparent` เหมือนการ์ดแชร์กิจกรรมเดี่ยว** — เพิ่มตามคำขอผู้ใช้ในรอบถัดมา (เดิมมีแค่การ์ด
    กิจกรรมเดี่ยวที่ทำได้) เลือกได้จากแถบ "พื้นหลัง" (ทึบ/โปร่งใส) ในหน้า configurator
    (`summary-configurator.tsx`, เก็บ state `transparent` แยกจาก `fields`, ต่อ query param
    `bg=transparent` เข้า href เดียวกับที่ preview/ปุ่มดาวน์โหลดใช้อยู่แล้ว) พรีวิวใช้ checkerboard
    backdrop (`repeating-conic-gradient`, browser CSS ธรรมดา ไม่ใช่ satori เลยไม่ติดข้อจำกัด
    conic-gradient ของ satori ด้านบน) แบบเดียวกับที่ `ShareActivityButton` ใช้อยู่แล้วสำหรับการ์ด
    กิจกรรมเดี่ยว แทนที่จะเป็น `bg-neutral-900` ทึบเดิมซึ่งมองไม่เห็นความโปร่งใสจริง — ที่ route เอง
    element ที่มีตัวอักษรทุกจุด (header ชื่อ+วันที่, badge "สรุปผลประจำวัน", ทุก label/ตัวเลขในแต่ละ
    บล็อก, footer domain) ต้องมี `textShadow` ตามกฎเดียวกับการ์ดกิจกรรมเดี่ยว (ค่าคงที่
    `0 2px 10px rgba(0,0,0,0.85)` ตอน transparent, `"none"` ตอนปกติ — **ห้าม `undefined`** เจอ satori
    crash แบบเดียวกันมาแล้วที่การ์ดกิจกรรมเดี่ยว) — บล็อกที่ห่อด้วย `cardStyle`/`rowCardStyle`
    (`src/lib/share-card-styles.ts`) มีพื้นหลังโปร่งแสงของตัวเองอยู่แล้ว (`rgba(255,255,255,0.045)`)
    เลยยังคงใส่ shadow ให้ตัวอักษรข้างในด้วยเผื่อกรณีพื้นหลังนั้นไม่พอคอนทราสต์กับรูปที่วางทับ
    (สอดคล้องกับสิ่งที่การ์ดกิจกรรมเดี่ยวทำ ไม่ได้พึ่งพื้นหลังการ์ดอย่างเดียว)
  - **`SummaryConfigurator` จำหัวข้อที่เปิด/ปิด, ลำดับที่ลากจัด, และพื้นหลัง (ทึบ/โปร่งใส) ข้ามครั้งแล้ว**
    (`localStorage` key `moopata_summary_config_v1`, per-device เท่านั้นไม่ใช่ DB เพราะเป็นความสะดวก
    ส่วนตัว ไม่ต้อง sync ข้ามเครื่อง) — เดิมทุกครั้งที่เข้าหน้า `/dashboard/summary` เริ่มจาก
    `DEFAULT_FIELDS`/`transparent=false` ใหม่หมด ทั้งที่คนน่าจะมีชุดที่ใช้ซ้ำทุกวัน พบจาก audit ตรวจ
    หน้าดาวน์โหลด — **ตั้งใจไม่จำ `dateMode`/`lang`**: วันที่ควร default เป็น "วันนี้" เสมอทุกครั้งที่เข้า
    หน้า (จำวันที่ไว้จะพาไปเจอวันเก่าที่ไม่ตั้งใจได้ถ้าไม่ได้เข้ามาหลายวัน) ส่วนภาษาการ์ดตั้งใจไม่ persist
    ข้ามครั้งอยู่แล้วตามกติกาเดิมของทั้ง 4 share route (ดู `?lang=` ด้านบน) — เก็บแค่ `id`+`enabled` ของ
    แต่ละหัวข้อ (ไม่เก็บ `label` เพราะเป็น string ที่อาจเปลี่ยนได้ภายหลัง เก็บไว้จะค้างข้อความเก่า)
    `applyStoredFields()` merge ค่าที่ persist ไว้เข้ากับ `DEFAULT_FIELDS` ปัจจุบันเสมอ — ตัดหัวข้อที่ถูก
    persist ไว้แต่ไม่มีในนิยามปัจจุบันแล้วทิ้งไป (เผื่อลบหัวข้อออกในอนาคต) และเติมหัวข้อใหม่ที่ยังไม่เคย
    persist ต่อท้ายลิสต์ให้อัตโนมัติ (เผื่อเพิ่มหัวข้อใหม่ในอนาคต) กันทั้งสองทิศไม่ให้หัวข้อหายไปเงียบ ๆ
    หรือหัวข้อเก่าที่ลบไปแล้วค้างอยู่ — **อ่าน `localStorage` เฉพาะใน `useEffect` เท่านั้น ไม่ใช่ lazy
    `useState` initializer** เพราะ component นี้ render บน server ก่อน (SSR) ที่ที่ `localStorage`/
    `window` ไม่มีอยู่จะ crash ทันทีถ้าอ่านตรงนั้น ยอมรับเฟรมแรกกระพริบจาก default ไปเป็นค่าที่ persist ไว้
    หลัง mount แทน (เร็วมากจนแทบไม่สังเกตเห็น) — ทั้งอ่านและเขียนห่อด้วย `try/catch` เงียบ ๆ (private
    browsing/localStorage ถูกบล็อก/JSON เพี้ยน แค่ fallback ไปใช้ default ไม่ error ให้เห็น เพราะเป็นแค่
    ความสะดวก ไม่ใช่ requirement) — ทดสอบจริงด้วย Playwright: ปิดหัวข้อ "น้ำดื่ม" + เปิดพื้นหลังโปร่งใส
    → reload หน้าใหม่ทั้งหน้า → ยืนยันทั้งสองค่ายังคงอยู่ (อ่าน `aria-checked`/class ของปุ่มโดยตรง ไม่ใช่
    แค่เช็ค `localStorage` เฉย ๆ)
- **การ์ดแชร์กิจกรรมเดี่ยว** (`/api/share/[id]/route.tsx`, ปุ่ม "แชร์" ที่หน้ารายละเอียดกิจกรรม เปิด
  `ShareActivityButton` เป็น bottom sheet ให้เลือกก่อนดาวน์โหลด แทนที่จะดาวน์โหลดทันทีแบบเดิม):
  - **`?bg=transparent`** — next/og คืน PNG แบบมี alpha channel ในตัวอยู่แล้ว (ไม่ต้องพึ่ง lib เพิ่ม)
    แค่ไม่ set `background` บน div รากก็ได้ PNG โปร่งใส เอาไปวางทับรูปพื้นหลังอื่นต่อได้ (สไตล์เดียวกับ
    "Transparent" template ของ Strava) — element ที่มีตัวอักษรทุกจุดต้องมี `textShadow` (`"none"` ตอนปกติ,
    ดูค่าตอน transparent ด้านล่าง) กันอ่านไม่ออกเวลาไปทับรูปสว่าง ๆ — **ห้าม set `textShadow: undefined`**
    (ต้องเป็น string เสมอ อย่างน้อย `"none"`) เจอแล้วว่า satori (ที่ next/og ใช้ข้างใน) crash "Cannot read
    properties of undefined (reading 'toString')" ถ้า style object มี key `textShadow` โผล่มาแต่ value
    เป็น `undefined` — error message ไม่บอกเลยว่าปัญหาอยู่ตรง field ไหน กว่าจะรู้ต้องไล่ดูว่า mode ไหน
    error มีค่า string จริงถึงผ่าน
  - **ค่า `textShadow`/พื้นหลัง badge ตอน transparent ต้องเข้มพอจะอ่านออกบนพื้นหลังสว่าง ไม่ใช่แค่บนพื้นเข้ม
    แบบธีมปกติของแอพ** — ค่าเดิม (`0 2px 10px rgba(0,0,0,0.85)`, blur กว้างค่าเดียว) ผู้ใช้แจ้งว่า
    "โหมดโปร่งใส...มีปัญหา...เอาไปใช้วางทับภาพ" ตรวจด้วยการ render PNG จริงแล้วเอาไป composite ทับพื้นขาว/
    ดำ/checkerboard ด้วย Pillow (นอกแอพ แค่ debug เฉพาะตอนนั้น) พบว่าตัวอักษร (รวมถึงเลข hero 180px ตัวหนา)
    อ่านออกชัดเจนบนพื้นดำ (เพราะสีตัวอักษรเป็นขาว/เทาอ่อนอยู่แล้ว ไม่ง้อ shadow มากก็พอไหว) แต่แทบมองไม่เห็น
    เลยบนพื้นขาว เพราะ blur กว้างแต่บาง กระจาย opacity ของเงาจนไม่เหลือขอบทึบพอจะกันสีตัวอักษรอ่อน ๆ ให้
    ต่างจากพื้นหลังสว่าง ๆ — ปัญหานี้เกิดกับ "การ์ดวางทับภาพ" โดยตรงเพราะรูปพื้นหลังจริงมีทั้งโทนสว่างและเข้ม
    ปนกัน ไม่ใช่แค่พื้นเข้มแบบธีมเดิมของแอพเสมอไป — แก้โดยเปลี่ยน `textShadow` ตอน transparent เป็นเงาซ้อน
    5 ชั้น (4 ทิศทแยงมุม blur แคบ ๆ ทำหน้าที่เหมือนเส้น outline รอบตัวอักษร + glow กว้างอีกชั้นแทรกลึกกว่า)
    แทนเงาเบลอกว้างค่าเดียว — satori ไม่รองรับ `-webkit-text-stroke` เลยใช้ trick ซ้อน shadow หลายทิศทาง
    แทน (poor-man's text-stroke) — พร้อมกันนั้นพื้นหลัง badge pill (type badge/PR badge ที่การ์ดกิจกรรมเดี่ยว,
    badge "สรุปผลประจำวัน" ที่การ์ดสรุปประจำวัน) เดิม alpha แค่ 0.15 ตายตัวไม่ว่า transparent หรือไม่ ก็โดน
    ปัญหาเดียวกัน (pill จางจนแทบไม่เหลือรูปทรงบนพื้นหลังที่ไม่ใช่ธีมเข้มของแอพเอง) เพิ่มฟังก์ชัน
    `badgeBg(rgb)` (นิยามซ้ำในทั้ง `[id]/route.tsx` และ `daily-summary/route.tsx` — ไม่คุ้มดึงออกมาเป็น
    shared lib แค่ 2 จุดใช้) คืน alpha 0.55 ตอน transparent, 0.15 ตอนปกติเหมือนเดิม — ทั้งสองจุดที่แก้เป็น
    การปรับค่าคงที่ตอน transparent เท่านั้น ไม่กระทบรูปลักษณ์ตอนไม่ใช่ transparent เลย (ตอนปกติ `textShadow`
    ยังเป็น `"none"`, badge ยังเป็น alpha 0.15 เท่าเดิม) — ตรวจสอบจริงด้วยการ composite PNG ที่ fix แล้วทับ
    พื้นขาว/ดำ/checkerboard ซ้ำอีกรอบ ยืนยันว่าตัวอักษร+badge อ่านออกชัดเจนทั้งสองโทนพื้นหลัง —
    **`period`/`nutrition` ก็รองรับ `?bg=transparent` แล้วเช่นกัน** (เดิมพบจาก audit ตรวจหน้าดาวน์โหลด
    ว่าไม่รองรับเลย ทั้งที่ comment เดิมของ `Cache-Control` header ในไฟล์ทั้งสองบอกไว้ว่า "keyed by the
    full URL (range/bg/lang)" อยู่แล้ว — แปลว่าตั้งใจไว้แต่ตกหล่นไม่ได้ทำจริง) เพิ่ม `transparent`
    param + `textShadow`/`badgeBg` แบบเดียวกับ `[id]`/`daily-summary` เป๊ะ ๆ (ก็อป pattern เดียวกันตรง ๆ
    ไม่ได้ดึงออกมาเป็น shared helper เพราะแค่ 4 จุดใช้ ยังไม่คุ้มสร้าง abstraction ใหม่) ทั้งสองไฟล์เพิ่ม
    element ที่มี `background: typeColor(...)`/`m.color` (แถบ/จุดสีประเภทกิจกรรม, แถบ macro) **ไม่ต้องแตะ
    เลย** เพราะเป็นสีทึบอิ่มตัวอยู่แล้ว ไม่ใช่ translucent overlay ที่จะจางหายแบบ badge pill — ทดสอบจริง
    เหมือนกัน (composite ทับพื้นขาว/ดำ ยืนยันอ่านออกชัดเจน) — **`QuickDownloadSheet` (component ที่ใช้
    ร่วมกันของทั้งสองปุ่ม "ดาวน์โหลดสัปดาห์นี้/เดือนนี้" ที่หน้าแรก และ "ดาวน์โหลดสรุปโภชนาการเดือนนี้"
    ที่หน้าเชิงลึก) เพิ่มแถบ "พื้นหลัง" (ทึบ/โปร่งใส) ให้ด้วย** ตามแพทเทิร์นเดียวกับ `SummaryConfigurator`
    — เพิ่ม prop `backgroundLabel`/`opaqueLabel`/`transparentLabel` (ตาม pattern เดียวกับ `closeLabel`
    ก่อนหน้า) + key `common.background`/`common.opaque`/`common.transparent` ใหม่ ให้ทั้ง 3 caller
    ส่งเข้าไป — state `transparent` **ไม่ persist ข้ามการเปิด sheet** (ต่างจาก `SummaryConfigurator` ที่
    จำค่าไว้ข้ามครั้งด้วย `localStorage` — sheet นี้เป็นปุ่มกดดาวน์โหลดเร็ว ๆ ครั้งเดียว ไม่ใช่หน้าที่คน
    ปรับตั้งค่าแล้วใช้ซ้ำทุกวันแบบหน้า `/dashboard/summary`) — ทดสอบจริงด้วย Playwright: เปิด sheet,
    กด "โปร่งใส", ยืนยันทั้ง href ปุ่มดาวน์โหลดและ src ของรูปพรีวิวมี `&bg=transparent` ต่อท้ายถูกต้อง
  - **hero number ปรับตามประเภทกิจกรรม** — เดิม hero ใช้ระยะทางตายตัวเสมอ พังกับเวทเทรนนิ่ง/กิจกรรมที่
    ไม่มีระยะทาง (โชว์ "0.00 กม." ที่ไม่มีความหมาย) ตอนนี้เช็ค `activity.distanceMeters` ก่อน ถ้าไม่มี
    fallback ไปโชว์เวลาที่ใช้แทน (`h:mm` ถ้าเกิน 1 ชม., นาทีเฉย ๆ ถ้าไม่ถึง) — stat row ด้านล่างก็ทำ
    แบบเดียวกัน (เดิม "เวลา"/"ความเร็วเฉลี่ย" ไม่มีเงื่อนไขเลย ทำให้เวทเทรนนิ่งโชว์ "-" ความเร็วเฉลี่ย
    ที่ไม่มีความหมายเสมอ) ทุก stat เช็คว่ามีค่าจริงก่อนถึงจะใส่ และไม่ซ้ำกับตัวที่กลายเป็น hero ไปแล้ว —
    ถ้า stat row ว่างทั้งหมด (เช่น เวทเทรนนิ่งที่ไม่ได้กรอกแคลอรี่/หัวใจ) ไม่ render แถบเส้นคั่นว่าง ๆ
    ด้านล่างเลย — label ใต้ตัวเลขแต่ละ stat (เช่น "เวลา"/"หัวใจเฉลี่ย") ใหญ่ขึ้นจาก 20px เป็น 25px
    ตามที่ผู้ใช้บอกว่าอ่านยากไปในโหมด `grid` และ `hero` ทั้งคู่ (ตัวเลขค่ายังคงเดิม)
  - **badge PR ท่าเวท** — ถ้ากิจกรรมนั้นมีท่าที่ทำ PR ใหม่ (เช็คจาก `getExerciseStats(userId)`,
    `prActivityId === activity.id`) จะโชว์ badge "🏆 PR ชื่อท่า น้ำหนัก กก." ต่อจาก badge ระยะทาง/เพซ
    เดิม — query `getExerciseStats` เฉพาะตอน `activity.exercises.length > 0` เท่านั้น (กิจกรรมส่วนใหญ่
    ไม่มีท่าเวทเลย ไม่ต้อง query เปล่า ๆ)
  - **`?style=hero|grid|list`** — สไตล์การ์ด 3 แบบเลือกได้จาก sheet เดียวกับ `?bg` ด้านบน
    (`ShareActivityButton` มี toggle: สไตล์การ์ด + พื้นหลัง + ตำแหน่งรายละเอียด) — `grid` (ค่า default,
    เหมือนเดิมก่อนมี `style` param) คือ กริดสถิติเต็ม + เส้นทาง (ถ้ามี) ชิดซ้ายทั้งหมด, `hero` คือการ์ด
    มินิมอลจัดกึ่งกลางทั้งการ์ด (badge/ชื่อ/ตัวเลขหลัก/ตัวเลขรอง) โชว์แค่ hero number ใหญ่ขึ้น (180px แทน
    150px) บวกสถิติรองไม่เกิน 2 ตัว (`heroSubStats`, ตัดมาจาก `statItems` 2 ตัวแรก) ไม่มีกริดเต็ม ไม่มี
    เส้นทางเลย — ออกแบบให้ `grid` เป็นการ์ดบันทึกละเอียด ส่วน `hero` เป็นการ์ดโพสต์เร็ว ๆ อ่านง่ายในแวบเดียว
  - **`?style=list`** — เพิ่มตามคำขอผู้ใช้ (อยากแคปรายการท่าออกกำลังกายทั้งหมดออกมาเป็นรูปเดียวยาว ๆ
    แทนการ scroll แคปทีละหน้าจอ) โชว์ทุกท่า+ทุกเซ็ทเต็ม ๆ (การ์ดย่อยแยกทีละท่า, แต่ละเซ็ทเป็น 1 บรรทัด
    "เซ็ท N: N ครั้ง × W กก. (RPE R)" — ข้อความ `setLine()` ใน `share-card-i18n.ts` เลียนแบบ inline
    render เดิมที่หน้ารายละเอียดกิจกรรมทุกตัวอักษร) ไม่มี hero number/กริดสถิติ/เส้นทางเลย เพราะ
    focus แค่รายการท่าล้วน ๆ ตามที่ขอ — **ไม่ใช้ canvas ตายตัว 1080×1920 เหมือน `grid`/`hero`** เพราะ
    จำนวนท่า/เซ็ทไม่แน่นอน (คนละกิจกรรมมีท่าไม่เท่ากัน) เลยคำนวณความสูง canvas จากเนื้อหาจริงก่อน render
    แทน (Satori/next-og ไม่มี API วัด layout ล่วงหน้าให้ ต้องประเมินเป็น pixel ต่อบรรทัดเอาเอง — ดู
    comment เหนือ `EXERCISE_TITLE_HEIGHT`/`SET_ROW_HEIGHT`/ฯลฯ ใน route) — **จุดที่พลาดตอนแรกและกว่าจะ
    เจอต้องเทสจริงด้วยตา**: แถว badge (ประเภทกิจกรรม + PR badge ต่อท่าที่ทำ PR ใหม่) เป็น `flexWrap`
    ตัดขึ้นบรรทัดใหม่เมื่อความกว้างไม่พอ ตอนแรกคำนวณสมมติว่ามีแค่ 1 แถวเสมอ พอกิจกรรมไหนมี PR badge
    หลายอัน (ข้อความยาว เช่น "PR Kneeling X-frame Back Fly/Row 12 กก.") ตัดขึ้นเป็น 2-3 บรรทัดจริง แต่
    canvas สูงไม่พอ ทำให้ท่าสุดท้ายในรายการโดนตัดหายไปครึ่งการ์ด (ไม่มี error ให้เห็นเลย รูปออกมาได้ปกติ
    แค่เนื้อหาขาดไปเงียบ ๆ) — แก้ด้วยการจำลอง wrap แบบเดียวกับที่ browser ทำจริง (ประเมินความกว้างแต่ละ
    badge จากความยาวข้อความ แล้วนับว่าตัดกี่บรรทัดก่อนคำนวณความสูงรวม) แทนสมมติ 1 บรรทัดตายตัว — ทุกค่า
    คงที่ (ความสูงต่อท่า/ต่อเซ็ท/ต่อ badge) ตั้งใจเผื่อเกินจริงเล็กน้อยเสมอ (เหลือพื้นที่ว่างท้ายรูปนิดหน่อย
    ไม่เป็นไร แต่ตัดเนื้อหาหายไม่ได้เลย) — ปุ่ม "รายการท่า" ใน `ShareActivityButton` โชว์เฉพาะกิจกรรมที่มี
    ท่าเวทจริง (`hasExercises` prop จาก `activity.exercises.length > 0`) และซ่อนตัวเลือก "ตำแหน่ง
    รายละเอียด" (`?pos`) ไปเลยตอนเลือกสไตล์นี้ เพราะไม่มีผลอะไร (list เริ่มจากบนสุดเสมอ ความสูงเท่ากับ
    เนื้อหาพอดีอยู่แล้ว) — ช่องพรีวิวในชีทก็ไม่ล็อกอัตราส่วน 9:16 เหมือน grid/hero อีกต่อไปตอนเลือก list
    (ใช้ `object-contain` แทน `object-cover` ในกรอบสูงจำกัด กันไม่ให้รูปที่สูงผิดปกติโดนครอปในพรีวิว) —
    **ไม่โชว์ badge PR ต่อท่าเหมือน grid/hero** (ผู้ใช้ขอเอาออกในรอบถัดมา เพราะซ้ำกับข้อมูลในการ์ดย่อย
    ด้านล่างอยู่แล้ว — badge "PR ชื่อท่า น้ำหนัก กก." ก็แค่ชื่อ+น้ำหนักของท่านั้นเป๊ะ ๆ ซึ่งรายการท่าเต็ม ๆ
    ข้างล่างโชว์ละเอียดกว่าอยู่แล้ว) แถวป้ายกำกับด้านบนของการ์ด list เหลือแค่ badge ประเภทกิจกรรมอันเดียว
    (`activityTypeLabel`) ไม่มี `badges.map(...)` เหมือน grid/hero — พอไม่มี PR badge ให้ wrap หลายบรรทัด
    แล้ว ส่วนคำนวณความสูง canvas ของ badge row ในโหมด list เลยง่ายลงกลับไปเป็นค่าคงที่แถวเดียวตายตัว
    ไม่ต้องจำลอง wrap เหมือนตอนที่ยังมี PR badge อยู่ (ดู comment เหนือ `listHeaderHeight` ในไฟล์)
  - **`?style=list` เคยโหลดค้างบ่อยสำหรับเซสชันเวทจริง ๆ (ไม่ใช่แค่เคสสุดโต่ง)** — ผู้ใช้แจ้งจากหน้าจอ
    production ว่าพรีวิว "รายการท่า" ค้างที่ "กำลังโหลดตัวอย่าง..." บ่อย ("ส่วนนี้น่าจะได้ใช้บ่อย") — ตรวจ
    จริงด้วยการ seed กิจกรรม MANUAL 3 ขนาด (8 ท่า×4 เซ็ท=32 เซ็ท / 15 ท่า×6 เซ็ท=90 เซ็ท / 30 ท่า×10
    เซ็ท=300 เซ็ท) แล้ว curl `?style=list&bg=transparent` จับเวลาตรง ๆ: 32 เซ็ท ≈ 33 วิ, 90 เซ็ท ≈ 136 วิ,
    300 เซ็ท **CPU core เดียวค้างที่ ~100% นานกว่า 10 นาทีไม่จบ** (`ps aux` เห็น next-server process กิน
    CPU 98%+ ต่อเนื่อง) — เทียบกับ `?style=grid` บน activity เดิมที่ warm แล้วใช้แค่ ~1.8 วิ พิสูจน์ว่า
    "เวลาพื้นฐาน" ที่เจอตอนแรก (grid ก็ 38 วิเหมือนกันตอนนั้น) เป็นแค่ **cold-start ของ request แรกหลัง
    เริ่ม server** (Satori/font/warm-up ครั้งเดียว) ไม่ใช่ต้นทุนต่อ request จริง — ต้นทุนจริงที่ scale
    แย่เฉพาะ `style=list` มาจาก **จำนวน node ต่อเซ็ท** (Satori ทำ layout+text-shaping สังเคราะห์เอง ไม่มี
    hardware acceleration แบบ browser จริง ยิ่งจำนวน text/flex node เยอะ เวลายิ่งแย่กว่าเชิงเส้น — จาก
    ข้อมูลจริงประมาณ ~O(n^1.4)) และที่ร้ายแรงกว่านั้นคือ **`ImageResponse` render เป็น synchronous CPU
    work บน event loop เดียวของ Node ทั้งหมด** ยืนยันได้จากการยิง request `?style=grid` บน activity เล็ก
    ที่ warm cache แล้วพร้อมกับที่ request `?style=list` ขนาดใหญ่กำลัง render อยู่ — request grid เล็ก ๆ
    นั้นค้างรอ**ทั้งหมด**จนกว่า render ก้อนใหญ่จะเสร็จ ไม่ได้ประมวลผลคู่ขนานกันเลย แปลว่า session เวทหนัก
    ๆ ของคนคนเดียวที่ขอพรีวิว list ค้างได้ทั้งแอพสำหรับ**ทุกคน**ไม่ใช่แค่คนที่ขอ — แก้ 2 ทาง (ทั้งคู่อยู่ใน
    `src/app/api/share/[id]/route.tsx`, verify ซ้ำหลังแก้ด้วยชุดกิจกรรมเดิม): (1) **ลด node ต่อเซ็ทจาก 3
    (div ห่อ + span label + span detail แบบ `justify-content: space-between`) เหลือ 1 (`span` เดียว
    ข้อความรวม "เซ็ท N: ..." จาก `t.setLine()` ตัวใหม่ ที่แทนที่ `t.setLabel()`/`t.setDetail()` เดิม)**
    ลดเวลาลง ~27-45% (32 เซ็ท 33→24 วิ, 90 เซ็ท 136→78 วิ) — (2) **`MAX_LIST_SETS`** เพดานจำนวนเซ็ท
    ที่ render จริงต่อรูป (ตัดท่า/เซ็ทที่เกินออก ไม่ render เลย ไม่ใช่แค่บีบให้เล็กลง เพราะต้นทุนมาจาก
    จำนวน node ไม่ใช่พื้นที่ pixel) พร้อมข้อความ "+N เซ็ทไม่แสดงในรูปนี้ (เซสชันยาวเกินไป)"
    (`t.listTruncatedNote()`) ต่อท้ายเสมอถ้าตัดออกจริง — **ไม่เคยตัดเงียบ ๆ** ตามธรรมเนียมเดียวกับ
    `Activity.notes`'s 500-ตัวอักษร — ทั้งสองจุดแก้ที่ height-estimation ต้องอิง `visibleExercises`
    (array ที่ตัดตามเพดานแล้ว) ไม่ใช่ `activity.exercises` ดิบ ไม่งั้นความสูง canvas จะคำนวณเผื่อเนื้อหา
    ที่ไม่ได้ render จริง (พลาดแบบเดียวกับบั๊ก PR-badge wrap เดิมด้านบน) — เพิ่มด้วย: ข้าม query
    `getExerciseStats` (หา PR badge) ไปเลยตอน `cardStyle === "list"` เพราะสไตล์นี้ไม่เคยโชว์ PR badge
    อยู่แล้ว (ดูด้านบน) เดิมยังคง query อยู่ทุกครั้งที่มี exercises แม้ผลจะไม่ถูกใช้เลย — ประหยัด DB
    roundtrip เปล่า ๆ ไม่ได้กระทบเวลา render (Satori เองคือคอขวด ไม่ใช่ DB) แต่เป็น cleanup ที่ถูกต้อง
    ไปด้วย — **ตัวเลขเพดานปรับมาแล้ว 2 รอบ**: รอบแรกตั้งไว้ที่ 80 (ทำให้ 300-เซ็ทที่เคยค้าง 10+ นาทีไม่จบ
    กลายเป็น ~68 วิ) แต่ 80 เองก็ยังใช้เวลา ~70-80 วิ ซึ่งยังเป็นตัวการหลักของปัญหา "render ก้อนใหญ่บล็อก
    ทั้ง server" ที่อธิบายไว้ข้างบนอยู่ดี — ผู้ใช้ขอให้ลดเพดานลงอีกเพื่อร่นหน้าต่างเวลาที่ค้างให้สั้นลง
    (ยอมรับ trade-off ที่ session หนัก ๆ จริง เช่น 12 ท่า×6 เซ็ท=72 จะเริ่มโดนตัดที่เพดานนี้ ซึ่ง 80 เดิม
    ไม่โดน) รอบสองเลย**ลดเหลือ `MAX_LIST_SETS = 50`** วัดซ้ำด้วยชุดกิจกรรมเดิม (32/90/300 เซ็ท) บน
    server ที่ warm แล้ว (curl `?style=grid` ก่อน 1 ครั้งให้พ้น cold-start เหมือนที่พิสูจน์ไว้ข้างบนว่า
    cold-start ไม่ใช่ต้นทุนต่อ request จริง): 32 เซ็ท (ไม่โดนตัด) ยังคง ~24 วิ เท่าเดิม, 90 เซ็ท (ตัดเหลือ
    50) ~40 วิ, 300 เซ็ท (ตัดเหลือ 50 เท่ากัน) ~35 วิ — ลดหน้าต่างเวลาที่ render ก้อนใหญ่สุดบล็อก server
    ได้ลงมาเกือบครึ่งจากเดิม (~70-80 วิ → ~35-40 วิ) โดยไม่กระทบ session ขนาดปกติ/ค่อนข้างหนัก (≤50 เซ็ท
    เช่น 8 ท่า×6 เซ็ท=48) เลย — ตรวจรูปที่ตัดจริง (300→50 เซ็ท) ด้วยตาซ้ำอีกรอบ ยืนยันไม่มีการ clip เนื้อหา
    (5 ท่า×10 เซ็ท render ครบ ตามด้วยข้อความ "+ อีก 250 เซ็ทไม่แสดงในรูปนี้")
  - **หัวการ์ด = โลโก้ mascot เดี่ยว ๆ ไม่มีคำว่า "MooPaTa" แล้ว** — เดิมมีทั้งไอคอนสี่เหลี่ยม "M" +
    ข้อความ "MooPaTa" + วันที่เรียงเป็นคอลัมน์ ตอนนี้เหลือแค่รูป `public/mascot-1.png` (ย่อจากต้นฉบับ
    `Picture/mascot-1.png` 1254×1254 ให้เหลือ 256×256 ก่อน commit กันไฟล์หนักเกินจำเป็น — การ์ดโชว์ที่
    96×96, ขยับจาก 72×72 เดิมตามที่ผู้ใช้ขอว่าโลโก้เล็กไป) — โหลด
    เป็น data URI ผ่าน `loadMascotLogoDataUri()` (`src/lib/share-logo.ts`, cache ไว้ใน memory เหมือน
    `loadShareFonts()`) เพราะ satori ไม่รู้จัก base URL ของแอพเอง อ่านไฟล์ตรงจากดิสก์แทนการอ้าง URL
    ส่วนวันที่ (`dateLabel`) ย้ายไปอยู่บรรทัดแรกในบล็อกรายละเอียดแทน (ดูข้อถัดไป) ไม่ได้หายไปไหน
  - **`?pos=top|center|bottom`** — เลือกตำแหน่งแนวตั้งของ "บล็อกรายละเอียด" ทั้งก้อน (โลโก้/วันที่/badge/
    ชื่อ/hero number/สถิติรอง-เส้นทาง/กริดสถิติ) ว่าจะไปกองอยู่บน/กลาง/ล่างของเฟรม ค่า default คือ `center`
    — เดิม header (โลโก้) ปักบนตายตัว กับกริดสถิติ (ถ้ามี) ปักล่างตายตัว แยกกันคนละจุด ทำให้ส่วนตรงกลาง
    ที่เหลือดูไม่ balance เท่าที่ควรเวลามีทั้งชื่อ/badge/route sketch เยอะ ๆ ตอนนี้ทุกอย่าง**รวมโลโก้ด้วย**
    ย้ายมาอยู่ใน div เดียวกัน (`flex:1`, `justifyContent` สลับตาม `pos`) เคลื่อนไปด้วยกันเป็นก้อนเดียว —
    มีประโยชน์มากที่สุดตอนคู่กับ `?bg=transparent`: เลือก `top`/`bottom` เพื่อเว้นพื้นที่เฟรมส่วนที่เหลือ
    ให้รูปพื้นหลังโชว์ผ่านได้เต็ม ๆ แบบสติกเกอร์ IG/Line story — เลือกได้จาก sheet เดียวกับ style/bg —
    **เดิมโลโก้ปักมุมซ้ายบนตายตัว ไม่ขยับตาม `?pos` เลย** (ตั้งใจไว้แต่แรกว่าเป็นแค่ตรามุมเล็ก ๆ ไม่ใช่
    "รายละเอียด") ผู้ใช้แจ้งว่าเลือก `กลาง`/`ล่าง` แล้วโลโก้ค้างอยู่บนสุดตัวเดียวโดดเด่นเป็นช่องว่างใหญ่คั่น
    ก่อนถึงเนื้อหาจริง ดูแปลก — แก้โดยย้าย `<img>` โลโก้เข้าไปเป็น child แรกในบล็อกรายละเอียดเดียวกันเลย
    (จากเดิมที่แยกเป็น sibling อีกก้อนนอก div ที่มี `flex:1`/`justifyContent`) ตอนนี้เคลื่อนไปเป็นกลุ่ม
    เดียวกับวันที่/badge/ชื่อ/ตัวเลขเหมือนกันหมด — **เฉพาะโหมด `hero` เท่านั้นที่โลโก้จะจัดกึ่งกลางแนวนอน
    ไปด้วย** (เพราะ parent's `alignItems: "center"` ของ hero ครอบคลุมทุก child รวมโลโก้) โหมด `grid` ยัง
    ชิดซ้ายเหมือนเดิมทุกตำแหน่ง — ทดสอบจริงด้วยการ seed กิจกรรมแบดมินตัน (HR เท่านั้น ไม่มีระยะทาง/ความเร็ว)
    แล้ว curl ทั้ง `?pos=top|center|bottom` ทั้งสไตล์ grid/hero ยืนยันภาพว่าโลโก้เคลื่อนไปพร้อมเนื้อหาทุกครั้ง
    และ `pos=top` (ค่าที่เคยเป็นเหมือนพฤติกรรมเดิมพอดี) ให้ผลเหมือนก่อนแก้เป๊ะ ไม่มี regression
  - **`?bg`/`?pos` ไม่ใช่ตัวเลือกให้ผู้ใช้กดเลือกในชีทดาวน์โหลดแล้ว — ตัด choice ทิ้งทั้งหมด ใช้
    `bg=transparent`/`pos=center` เสมอทุกจุด** — ผู้ใช้ขอลดจำนวนหัวข้อ/การตัดสินใจในชีทดาวน์โหลดลง
    ("จะลดการทำงานให้น้อยลงได้รึเปล่า ทำกับทุกหน้าเลย") ตัดทั้งแถบ "พื้นหลัง" (ทึบ/โปร่งใส) และแถบ
    "ตำแหน่งรายละเอียด" (บน/กลาง/ล่าง) ออกจากทุกจุดที่เคยมี: `ShareActivityButton` (ตัดทั้งสองแถบ, เหลือ
    แค่ภาษา+สไตล์การ์ดให้เลือก), `SummaryConfigurator` (ตัดแถบพื้นหลัง — ไม่เคยมี `pos` อยู่แล้ว),
    `QuickDownloadSheet` (ตัดแถบพื้นหลัง — ไม่เคยมี `pos` อยู่แล้วเช่นกัน คนละ 3 caller คือปุ่มดาวน์โหลด
    สัปดาห์นี้/เดือนนี้ที่หน้าแรก กับสรุปโภชนาการเดือนนี้ที่หน้าเชิงลึก) — **API routes ทั้ง 4
    (`/api/share/[id]`, `/daily-summary`, `/period`, `/nutrition`) ไม่ได้แก้เลย** ยังรับ `?bg=`/`?pos=`
    เหมือนเดิมทุกอย่าง (backward-compatible) แค่ฝั่ง UI hardcode ค่าที่ส่งไปเป็น `bg=transparent`
    (และ `pos=center` สำหรับ `[id]` ที่มีตัวเลือกนี้) เสมอแทนที่จะให้ผู้ใช้เลือก — เลือก transparent
    ล้วนเพราะเป็นทางเลือกที่ "เอาไปใช้ต่อได้กว้างที่สุด" (วางทับรูปอื่นได้ ถ้าไม่อยากทับก็ยังเห็นพื้นหลัง
    การ์ดโปร่งแสงของแต่ละบล็อกอยู่ดี ไม่ได้ดูว่างเปล่า) และ `center` เพราะเป็น default เดิมของทั้งสอง
    component อยู่แล้ว ไม่ใช่ค่าที่ผู้ใช้ต้องเรียนรู้ใหม่ — `localStorage` persistence ตัดตามไปด้วย:
    `ShareActivityButton`'s `moopata_activity_share_config_v1` เหลือจำแค่ `{style}` (เดิมจำ
    `{style, bg, pos}`), `SummaryConfigurator`'s `moopata_summary_config_v1`'s `StoredConfig` ตัด field
    `transparent` ออก (เหลือแค่ `fieldOrder`/`fieldEnabled`) — message key ที่ไม่มีจุดเรียกใช้แล้วก็ลบ
    ออกจาก `messages/th.json`/`en.json` ไปด้วย (`common.background`/`opaque`/`transparent`,
    `activityDetail.share.bgCard`/`bgTransparent`/`detailPosition`/`posTop`/`posCenter`/`posBottom`,
    `summary.transparentHint`) — ทดสอบจริงด้วยการ seed กิจกรรมเวทเทรนนิ่ง, curl ทั้ง 4 หน้าที่มีชีท
    (`/dashboard/activity/[id]`, `/dashboard/summary`, `/dashboard`, `/dashboard/nutrition`) ทั้ง TH/EN
    ยืนยันไม่มีข้อความ "พื้นหลัง"/"ทึบ"/"โปร่งใส"/"ตำแหน่งรายละเอียด" หลงเหลือใน HTML เลย (รวมถึงใน
    messages JSON ที่ฝังมากับ RSC payload สำหรับ hydration) และ curl ตรงไปที่ทั้ง 4 API route ยืนยันได้
    PNG แบบ RGBA (โปร่งใสจริง) กลับมาปกติ — `npx tsc --noEmit`, `npm run build`, `npm run test` (197
    เทสผ่านหมด) ผ่านทั้งหมดก่อน commit
  - **สไตล์ `hero` เพิ่มจำนวนสถิติรองจาก "อย่างมาก 2 ตัวแรกที่เจอ" เป็น "อย่างมาก 4 ตัว (2×2)" +
    การันตีว่าถ้ามีแคลอรี่บันทึกไว้ต้องโชว์เสมอ** — ผู้ใช้รายงานว่ากิจกรรมที่ไม่มีระยะทาง/เพซ/ความเร็ว/
    เคเดนซ์เลย (เช่น แบดมินตัน มีแค่หัวใจเฉลี่ย/สูงสุด) พอเลือกสไตล์ `hero` แล้วข้อมูลน้อยมาก แถมขอเพิ่ม
    แคลอรี่เข้าไปด้วยอย่างน้อย — root cause: `heroSubStats` เดิมเป็นแค่ `statItems.slice(0, 2)` เอา 2
    ตัวแรกตามลำดับที่ build ไว้ (เวลา→เพซ/ความเร็วเฉลี่ย→สูงสุด→ไต่ระดับ→หัวใจเฉลี่ย→สูงสุด→เคเดนซ์→
    แคลอรี่ ซึ่งอยู่ท้ายสุดเสมอ) กิจกรรมที่มีแค่หัวใจ 2 ค่าเลยเห็นแค่หัวใจ ไม่มีทางเห็นแคลอรี่แม้จะกรอกไว้
    ก็ตาม เพราะ 2 ช่องเต็มไปด้วยหัวใจก่อนแคลอรี่เสมอ (ปัญหาเดียวกันจะเกิดกับกิจกรรมที่มีข้อมูลครบ ๆ เช่น
    วิ่งที่มีทั้งเพซ/ไต่ระดับ/หัวใจ — แคลอรี่ก็ยังไม่มีทางติด 2 อันดับแรกอยู่ดี) — แก้โดยเพิ่มเพดานเป็น 4
    ตัว (เรียงเป็น 2 แถว แถวละ 2 — `heroSubStatRows`, chunk แบบเดียวกับ `statRows` ของกริดที่ทำอยู่แล้ว
    แค่ทีละ 2 แทนที่จะเป็น 3) และ**แยกแคลอรี่ออกมาการันตีที่นั่งเสมอถ้ามีค่า** (`caloriesStat` หาออกมา
    ก่อน, ที่เหลือ `otherStats` เอาแค่ 3 ตัวแรก แล้วต่อแคลอรี่ท้ายสุดเป็นตัวที่ 4 เสมอ — ไม่ใช่แค่เพิ่ม
    เพดานจาก slice(0,2) เป็น slice(0,4) เฉย ๆ เพราะกิจกรรมที่มีสถิติเยอะกว่า 4 อย่าง [เช่น วิ่งที่มีเพซ
    เฉลี่ย/สูงสุด/ไต่ระดับ/หัวใจเฉลี่ย] จะยังคงเบียดแคลอรี่ออกไปได้เหมือนเดิมถ้าไม่บังคับที่นั่งแยกไว้) —
    ไม่กระทบสไตล์ `grid` เลย (กริดยังโชว์ `statItems` ครบทุกตัวเหมือนเดิม ไม่มีเพดาน) — ทดสอบจริงด้วยการ
    seed กิจกรรมแบดมินตัน 2 แบบ (มี/ไม่มีแคลอรี่) แล้ว curl `?style=hero`: แบบไม่มีแคลอรี่เห็น 2 สถิติ
    หัวใจเหมือนเดิม (ไม่มีอะไรให้โชว์เพิ่มจริง ๆ), แบบมีแคลอรี่ 950 kcal เห็นครบ 3 ช่อง (หัวใจ 2 + แคลอรี่
    แถวที่สอง) ยืนยันว่าแคลอรี่โผล่แล้วจริง ไม่ถูกเบียดออกอีกต่อไป

### 5. ภาษา (i18n) — วางโครงสร้างเสร็จแล้ว แปลครบ "หน้าหลัก" ทั้งหมดตามขอบเขตที่ตกลงไว้
เดิมทั้งแอพเป็น Thai-only ล้วน ไม่มี i18n infra เลย ผู้ใช้ขอให้เพิ่มภาษาอังกฤษ + ปุ่มสลับภาษา — ขอบเขต
ที่ตกลงกันคือ **วางโครงสร้าง i18n ก่อน แล้วแปลแค่ "หน้าหลัก"** (4 แท็บ bottom-nav: หน้าแรก/ไดอารี่/เชิงลึก/
บัญชี + หน้า landing + component ลูกโดยตรงของแต่ละหน้า) ไม่ใช่ทั้ง 108 ไฟล์ที่มีข้อความไทยฝังอยู่ — ดูแผนเต็ม
ที่ `/root/.claude/plans/dreamy-frolicking-gadget.md` ถ้าต้องการรายละเอียดการตัดสินใจแต่ละ phase
- **ใช้ `next-intl` แบบ "without i18n routing"** — ไม่มี `middleware.ts`, ไม่มี `[locale]/` segment,
  โครงสร้าง `src/app/` ยังแบนเหมือนเดิมทั้งหมด ตั้งใจเลือกแบบนี้เพราะเป็นแอพส่วนตัวหลังบ้าน login ไม่มี
  ความจำเป็นด้าน SEO/URL localization การย้ายทั้ง 171 ไฟล์ไปอยู่ใต้ `[locale]/` จะเป็น diff ใหญ่มากโดย
  ไม่ได้ประโยชน์อะไรเพิ่ม
- **แหล่งความจริงของภาษา (`src/lib/locale.ts`, `resolveLocale()`)** — login แล้ว: อ่านจาก
  `User.locale` (enum `Locale { TH EN }`, `@default(TH)`, คอนเวนชันเดียวกับ `unitSystem`) คงอยู่ข้ามอุปกรณ์/
  ข้าม re-login เหมือน `unitSystem` — ยังไม่ login (หน้า landing, ก่อนสมัคร): fallback ไปที่ cookie
  `moopata_locale` (ธรรมดา ไม่ sensitive, อายุ 1 ปี) — ไม่มีทั้งคู่: default `"th"` — ห่อด้วย React's
  `cache()` กันไม่ให้ query DB ซ้ำหลายรอบในคำขอเดียวกัน
- **`src/i18n/request.ts`** — `getRequestConfig` เรียก `resolveLocale()` แล้ว dynamic import
  `messages/th.json`/`messages/en.json` ตาม locale ที่ได้ — ต่อเข้ากับ `next.config.js` ผ่าน
  `createNextIntlPlugin`
- **`src/app/layout.tsx`** — `RootLayout` เปลี่ยนเป็น `async`, เรียก `getLocale()`/`getMessages()` แล้ว
  set `<html lang={locale}>` แบบ dynamic (เดิม hardcode `"th"`) + ห่อ `{children}` ด้วย
  `NextIntlClientProvider` (จำเป็นเพราะ `"use client"` component อย่าง `bottom-nav.tsx` ต้องใช้
  `useTranslations()`, ส่วน Server Component เรียก `getTranslations()` ตรง ๆ ได้เลยไม่ต้องพึ่ง provider)
  — **ผลข้างเคียงที่ตั้งใจรับไว้**: การอ่าน locale ผ่าน `cookies()` ทำให้ทุกหน้าที่แต่ก่อน static
  (`/privacy`, `/terms`, `/reset-password`, `/dashboard/knowledge`) กลายเป็น dynamic render ทุก request
  ไปด้วย (หน้าอื่นเกือบทั้งหมดเป็น dynamic อยู่แล้วจาก `getSessionUserId()`'s `cookies()` เหมือนกัน) —
  ยอมรับได้ในสเกลแอพนี้ ไม่ใช่บั๊ก
- **ปุ่มสลับภาษา (`LocaleToggle` ใน `settings-client.tsx`)** — โครงเดียวกับ `UnitToggle` เดิมเป๊ะ
  (`useState` seed จาก `initial` prop → `fetch` POST → `router.refresh()`) label เป็น "ไทย"/"English"
  ตัวอักษรตรง ๆ ไม่ผ่าน `t()` (ธรรมเนียมเดียวกับทุกแอพ: ชื่อภาษาโชว์เป็นภาษาของมันเอง ไม่แปล) —
  **`POST /api/settings/locale` ใช้ route เดียวรองรับทั้ง 2 เคส**: login อยู่ → update `User.locale` +
  set cookie, ไม่ login (เผื่อใช้จากหน้า landing ในอนาคต) → set แค่ cookie อย่างเดียว ไม่ error
- **Seed ค่า locale ตอนสมัครสมาชิกจาก cookie ที่ตั้งไว้ก่อน login** — ถ้ามีคนกดปุ่มเป็นอังกฤษที่หน้า
  landing (ตอนนั้นมีแค่ cookie ยังไม่มี `User` row) แล้วค่อยสมัครสมาชิก ถ้าไม่ทำแบบนี้ `User.locale`
  จะ default กลับเป็น `TH` เงียบ ๆ จนกว่าจะย้อนมาตั้งใหม่ที่หน้าตั้งค่า — แก้ทั้ง 2 จุดสร้างบัญชี
  (`/api/auth/signup`, `/api/auth/google/callback`) อ่าน cookie `moopata_locale` แล้วส่งต่อเป็น
  `locale` ตอน `db.user.create` ถ้ามีค่าที่ใช้ได้
- **`messages/th.json` / `messages/en.json`** — namespace ตามหน้า/component (ตอนนี้มีแค่ `common`
  กับ `settings` — namespace อื่น `bottomNav`/`landing`/`dashboard`/`food`/`nutrition` รอ phase ถัดไป)
  — มีเทส `messages/messages.test.ts` เทียบ key set สองไฟล์ต้องตรงกันเป๊ะ (เพิ่ม `messages/**/*.test.ts`
  เข้า `vitest.config.mts`'s `include` เพราะปกติจะสแกนแค่ `src/**`) กัน key หายไปฝั่งใดฝั่งหนึ่งเงียบ ๆ
  แบบเดียวกับที่เทส comma-thousands กันบั๊กคล้ายกันในพาร์เซอร์ AI-import
- **แปลครบแล้วทั้งแอพจริง ๆ ตอนนี้** — 5 หน้าหลัก + component ลูกที่จำเป็น + หน้ารายละเอียดกิจกรรม/
  สถิติสูงสุด/เปรียบเทียบ/ความสำเร็จ + `log-activity`/`portion-guide`/`knowledge`/`summary`/
  `supplements` (5 หน้าสุดท้ายที่ยังเหลือ ผู้ใช้ขอ "ลุยรวดเดียวเลยให้เสร็จ" ทำทั้งชุดในรอบเดียว)
  ทดสอบจริงผ่าน MariaDB ทุกหน้า: login แล้วสลับ EN
  ที่หน้าตั้งค่า → เนื้อหาเปลี่ยนภาษาทันที, ลบ cookie ทดสอบใหม่ (เหลือแค่ session cookie) → ยังคงโชว์
  อังกฤษ (พิสูจน์ว่า `User.locale` เป็นตัวตัดสิน ไม่ใช่ cookie), grep หาอักษรไทยในหน้าที่ตั้งเป็น EN แล้ว
  ไม่เจอเลยสักตัว (ยกเว้นจุดที่ตั้งใจเว้นไว้ ดูด้านล่าง) — รายชื่อหน้า/ไฟล์ที่แปลแล้ว:
  - **หน้าตั้งค่า** — `settings/page.tsx` + `settings-client.tsx` + `profile-form.tsx`/
    `nutrition-profile-form.tsx`/`macro-preferences-form.tsx`/`health-flags-form.tsx`/
    `set-password-form.tsx`
  - **หน้า landing/login** — `src/app/page.tsx` + `email-auth-form.tsx`
  - **Bottom nav** — `bottom-nav.tsx` (4 แท็บ + sheet ทางลัด 6 อัน)
  - **หน้าแรก (`/dashboard`)** — `page.tsx` + `health-summary.tsx`/`goal-progress.tsx`/
    `month-highlights.tsx`/`onboarding-card.tsx`/`type-breakdown.tsx`/`activity-heatmap.tsx`/
    `activity-filters.tsx`/`activity-list-view.tsx`/`trend-chart.tsx`/`period-comparison.tsx`
  - **ไดอารี่ (`/dashboard/food`)** — `page.tsx` + `date-strip.tsx`/`water-log-card.tsx`/
    `food-log-view.tsx`/`nutrient-overview.tsx` (ตัวหลังเป็น grandchild แต่แปลด้วยเพราะเป็นภาพหลัก
    ของหน้า ไม่ใช่แค่ direct child ตามขอบเขตเดิม)
  - **เชิงลึก (`/dashboard/nutrition`)** — `page.tsx` + `weight-log-card.tsx`/`weight-trend-chart.tsx`
    (grandchild, แปลด้วยเหตุผลเดียวกับ nutrient-overview)/`body-composition-card.tsx`/
    `progress-photos-card.tsx`/`pose-guide-camera.tsx` (grandchild, แปลเพราะเป็น core flow ไม่ใช่
    ฟีเจอร์เสริม)/`calorie-trend-chart.tsx`/`calorie-ring.tsx`/`nutrition-period-comparison.tsx`/
    `logging-streak-card.tsx`
  - **`src/app/layout.tsx`'s `<meta name="description">` และ `src/app/manifest.ts`** — เปลี่ยนจาก
    `export const metadata`/`export default function manifest()` แบบ static เป็น
    `generateMetadata()`/async `manifest()` ที่เรียก `getTranslations("landing")` แทน เพราะ metadata
    เดิม hardcode ข้อความไทยไว้ตรง ๆ ไม่ขึ้นกับ locale เลย
  - **หน้ารายละเอียดกิจกรรม (`/dashboard/activity/[id]`, เพิ่มรอบถัดมาจากที่ตกลงขอบเขต 5 หน้าหลักไว้
    ตอนแรก — ผู้ใช้เลือกหน้านี้เป็นหน้าถัดไปที่จะแปลผ่าน `AskUserQuestion`)** — `page.tsx` (namespace
    `activityDetail`) + `comparison.tsx`/`delete-activity-button.tsx`/`detail-panel.tsx`/
    `hr-zones.tsx`/`profile-chart.tsx`/`route-sketch.tsx`/`share-activity-button.tsx` ทั้ง 7 ไฟล์ลูก —
    **ยืนยันว่า `useTranslations()`/`useLocale()` จาก `"next-intl"` (ไม่ใช่ `/server`) ใช้ได้ตรง ๆ ใน
    component ลูกที่ซ้อนลึกโดยไม่ต้อง prop-drill `t`/`lang` ผ่านทุกชั้น** แม้ component นั้นจะไม่มี
    `"use client"` เอง (ตราบใดที่ root layout ห่อด้วย `NextIntlClientProvider` ไว้แล้ว — ดูตัวอย่างเดิม
    ที่มีอยู่ก่อนแล้วที่ `goal-progress.tsx`) หน้า `page.tsx` เองยังเป็น async Server Component เรียก
    `getTranslations`/`getLocale` จาก `next-intl/server` ตามปกติ แล้ว narrow `getLocale()`'s
    `string` เป็น `FormatLang` (`"th"|"en"`) ด้วย `locale === "en" ? "en" : "th"` ก่อนส่งต่อให้ทุกฟังก์ชัน
    ใน `format.ts` ที่รับ `lang` — component ลูกที่เป็น client (`profile-chart.tsx`,
    `share-activity-button.tsx`, `delete-activity-button.tsx`) กับที่ไม่ใช่ client (`detail-panel.tsx`,
    `hr-zones.tsx`, `route-sketch.tsx`, `comparison.tsx`) เรียก hook เดียวกันได้เหมือนกันหมด ไม่ต้องแยก
    วิธี
    - **`src/lib/format.ts` เพิ่ม `lang: FormatLang = "th"` ให้อีก 4 ฟังก์ชันที่เดิม hardcode หน่วย/ข้อความ
      ไทยไว้ตรง ๆ**: `formatSignedDistance`, `formatSignedDuration`, `formatSignedPace`,
      `formatSignedSwimPace` (ใช้ใน `comparison.tsx`'s ส่วนต่างเทียบกับครั้งก่อน) — ค่า default `"th"`
      กันไม่ให้ call site เดิมที่ยังไม่ส่ง `lang` พัง (เทสเดิม `format.test.ts` ผ่านหมดไม่ต้องแก้)
    - **Key ซ้ำข้ามหน้าใช้ namespace ร่วมกันแทนสร้างใหม่ซ้ำ** — `activityDetail.stats.*` (24 key) ใช้ทั้ง
      ใน `page.tsx`'s Stat grid และ `comparison.tsx`'s Row label เพราะข้อความไทยเหมือนกันเป๊ะ (เช่น
      "ระยะทาง"), `common.backToOverview` reuse "กลับไปหน้ารวม" เดิมที่มีอยู่แล้ว, ปุ่ม/ป้ายของ
      `share-activity-button.tsx` reuse `common.close`/`common.language`/`common.background`/
      `common.downloadImage`/`common.generatingImage`/`common.downloadFailed`/`common.loadingPreview`/
      `common.share` (key เหล่านี้มีอยู่แล้วจากตอนแปล `QuickDownloadSheet`/`SummaryConfigurator`
      ก่อนหน้า) ส่วนตัวเลือกที่ข้อความไม่ตรงกับ `common.opaque`/`common.transparent` เป๊ะ (BG_OPTIONS ใช้
      "การ์ด" ไม่ใช่ "ทึบ") แยกเป็น key ใหม่ใน `activityDetail.share.*` แทน — ชื่อภาษา ("ไทย"/"English")
      ใน `LANG_OPTIONS` ยังคง hardcode ไม่ผ่าน `t()` เหมือนทุกตัวสลับภาษาอื่นในแอพ (แสดงชื่อภาษาเป็นภาษา
      ของมันเอง)
    - **`weatherLabel()` (`src/lib/weather.ts`) ตั้งใจไม่แปล** — ข้อมูลอากาศมีแค่ใน activity เก่าที่เคย
      sync จาก Strava เท่านั้น (Strava sync ถูกลบไปแล้ว ไม่มีทางมีข้อมูลใหม่เข้ามาอีก) เหตุผลเดียวกับที่
      `DetailPanel`/`ProfileChart`'s `isRun`-only handling (Run-only legacy จาก Strava streams) ไม่ถูก
      แตะเช่นกัน — ทั้งคู่เป็น "ข้อมูลเก่าที่แช่แข็งแล้ว ผลกระทบต่ำ" ตามที่ CLAUDE.md เอกสารไว้อยู่แล้วใน
      หัวข้อ "เพซ/ความเร็วต่อประเภทกิจกรรม" ด้านล่าง (### 6.)
    - ทดสอบจริงผ่าน MariaDB: seed กิจกรรม MANUAL (วิ่ง 5 กม./30 นาที มีท่าเวท Bench Press 2 เซ็ท) +
      `ActivityDetail` ปลอม (streams/splits/laps/bestEfforts/weather) ตรงผ่าน Prisma, มินต์ session JWT,
      `npm run build && npm run start`, curl หน้าเดียวกันทั้ง TH (default) และ EN (ตั้ง `User.locale =
      "EN"` ตรงผ่าน Prisma — สำคัญ: cookie `moopata_locale` เฉย ๆ ไม่พอเพราะ login แล้ว `User.locale`
      เป็นตัวตัดสิน ไม่ใช่ cookie ตามที่ resolveLocale() ออกแบบไว้) ยืนยัน HTML ที่ได้มีข้อความแปลถูกต้อง
      พร้อม interpolation จริง (เช่น "อ้างอิงหัวใจสูงสุด 172 bpm"/"Based on max heart rate 172 bpm",
      "บันทึกด้วย Garmin Forerunner 965"/"Recorded with Garmin Forerunner 965", "เซ็ท 1"/"Set 1",
      หน่วยระยะทาง/เวลาเปลี่ยนตาม locale ด้วย) — `npx tsc --noEmit`, `npm run build`,
      `npm run test` (197 เทสผ่านหมด รวม `messages.test.ts`'s key-parity check) ผ่านทั้งหมดก่อน commit
  - **หน้าสถิติสูงสุด (`/dashboard/records`) + หน้าเปรียบเทียบ (`/dashboard/compare`) — ผู้ใช้ขอต่อทันที
    หลังหน้ารายละเอียดกิจกรรม ("records กับ compare หน้าถัดไปแปลด้วยเลย")** — `records/page.tsx`
    (namespace `records`) + `records/exercise-progression-chart.tsx` (เรียก `useTranslations("records")`
    เองข้างในสำหรับ label "เทรนด์น้ำหนัก (N ครั้งล่าสุด)" แทนที่จะรับเป็น prop — ตาม pattern เดียวกับ
    `hr-zones.tsx` ก่อนหน้า คือให้ nested component เรียก hook เองได้เลยไม่ต้อง prop-drill) —
    `records/pr-progression-chart.tsx` **ไม่ต้องแก้เลย** เพราะรับ `label`/`formatValue` เป็น prop จาก
    `page.tsx` อยู่แล้วแต่แรก (`page.tsx` ส่งข้อความที่แปลแล้วเข้าไปตรง ๆ) — `compare/page.tsx`
    (namespace `compare`) + `compare/compare-view.tsx` ("use client", ย้าย `shortDate`/`optionLabel`
    จากฟังก์ชันระดับโมดูลที่ hardcode `"th-TH"` เป็นรับ `lang: FormatLang` เป็น argument แทน เพราะทั้งคู่
    ไม่ใช่ hook เรียก `useTranslations`/`useLocale` เองไม่ได้ ต้องรับค่าจาก component ที่เรียกมันมาอีกที —
    `ActivityHeader` เพิ่ม prop `lang` ด้วยเหตุผลเดียวกัน)
    - **Reuse ข้ามหน้าเยอะขึ้นรอบนี้เพราะข้อความตรงกับที่ `activityDetail` namespace มีอยู่แล้วพอดีหลาย
      จุด** — `compare-view.tsx` เรียก `useTranslations("activityDetail.stats")` เป็น hook ที่สองคู่กับ
      `useTranslations("compare")` แล้ว reuse `distance`/`time`/`avgPace`/`avgHr`/`avgCadence`/
      `calories` ตรง ๆ (ข้อความเหมือนเป๊ะ) เหลือแค่ `paceOrSpeedAvg`/`elevationGain`/`vs`/`meters` ที่
      สร้างเป็น key ใหม่ใน `compare` namespace เพราะข้อความไม่ตรงกับ `activityDetail.stats` ที่มี (เช่น
      `elevationGain`="ระยะไต่ระดับ" ≠ compare's "ไต่ระดับ") — `records/page.tsx` ไม่ reuse
      `activityDetail.stats` เลยเพราะข้อความต่างกันหมด (เช่น "เพซเร็วที่สุด"/"ระยะทางไกลที่สุด" เป็นสถิติ
      แบบ "สูงสุดตลอดกาล" คนละความหมายกับ stat แบบ "ค่าเฉลี่ยของกิจกรรมนี้" ที่ `activityDetail.stats`
      ใช้) เก็บเป็น key ของตัวเองใน namespace `records` ทั้งหมด
    - **`formatElevationM(lang)` ไม่ได้ถูกเรียกสำหรับค่า elevation-gain delta ทั้งที่หน้า records/
      compare** — ทั้งสองจุด (`records/page.tsx`'s `maxElevationGainM`, `compare-view.tsx`'s
      `elevationDiff`) ต่อ string "ม." เข้ากับตัวเลขดิบตรง ๆ (ไม่ผ่าน `formatElevationM`, ซึ่งจะแปลงเป็น
      ฟุตถ้า `unit === "IMPERIAL"`) ของเดิมก่อนรอบนี้แล้ว — **ไม่ใช่บั๊กที่แก้รอบนี้** (ไม่ได้อยู่ใน scope
      "แปลข้อความ UI" ของงานนี้ แค่เปลี่ยน "ม." ให้ตอบสนอง `lang` ผ่าน key `records.meters`/
      `compare.meters` เพื่อให้ EN เห็น "m" แทน แต่ค่าที่โชว์ยังเป็นเมตรดิบเหมือนเดิมไม่ว่า
      `unitSystem` จะเป็นอะไร — ถ้ามีคน report ว่าเลขไต่ระดับผิดหน่วยตอนตั้ง imperial ให้ดู 2 จุดนี้ก่อน)
    - ทดสอบจริงผ่าน MariaDB: seed user + 3 กิจกรรมวิ่ง (4/5/6 กม., ระยะห่างกันคนละสัปดาห์ เพื่อให้
      `distanceProgression`/`speedProgression` มี ≥3 จุดจริง ปลด `PrProgressionChart` ออกมาโชว์ได้) +
      2 กิจกรรมเวทเทรนนิ่งที่มีท่า Bench Press คนละน้ำหนัก (60→70 กก.) เพื่อให้ `ExerciseProgressionChart`
      มี ≥2 จุด, มินต์ session JWT, curl ทั้งสองหน้าทั้ง TH/EN (สลับผ่าน `User.locale` ตรงผ่าน Prisma
      เหมือนหน้ารายละเอียดกิจกรรม) ยืนยัน HTML มีข้อความแปลถูกต้องพร้อม interpolation จริง (เช่น
      "~77 กก. (1RM ประมาณ)"/"~77 kg (est. 1RM)", "เทรนด์น้ำหนัก (2 ครั้งล่าสุด)"/"Weight trend (last 2
      sessions)") และหน้าเปรียบเทียบโชว์ label "เพซ/ความเร็วเฉลี่ย"/"Avg pace/speed" ถูกต้องตอนเทียบข้าม
      ประเภทกิจกรรม (วิ่ง vs เวทเทรนนิ่ง) — `npx tsc --noEmit`, `npm run build`, `npm run test` (197
      เทสผ่านหมด) ผ่านทั้งหมดก่อน commit
  - **หน้าความสำเร็จ (`/dashboard/achievements`) — ผู้ใช้ขอต่อทันทีหลังหน้าสถิติสูงสุด/เปรียบเทียบ
    ("achievements หน้าถัดไปแปลด้วยเลย")** — `achievements/page.tsx` (namespace `achievements`) +
    `achievement-section.tsx` (เพิ่ม `useTranslations("achievements")` เองสำหรับ "ปลดล็อกแล้ว {n}/{total}"
    — `title` ยังคงรับเป็น prop จาก `page.tsx` เหมือนเดิมเพราะแต่ละ section ใช้ชื่อคนละคำ ไม่มีอะไรให้
    reuse ข้าม 4 section) + `exercise-pr-badges.tsx` (เพิ่ม `useTranslations("achievements")` เอง) —
    **`formatLabel`/`formatProgress` ทั้ง 4 section ใน `page.tsx` เปลี่ยนจากการต่อ string ตรง ๆ
    (`` `อีก ${a} ถึง ${b}` ``) เป็นเรียก `t("xxxProgress", {remaining, target})`** เพราะลำดับคำใน
    ประโยคภาษาอังกฤษต่างจากไทย (ไทย "อีก X ถึง Y" ตรงๆ ตามลำดับพารามิเตอร์ แต่อังกฤษ "X to go to Y" คำว่า
    "to go" อยู่กลางประโยคไม่ใช่ต้น) ต่อ string ตรง ๆ แบบเดิมจะไม่มีทางแปลลำดับคำให้ถูกได้ ต้องผ่าน ICU
    message key ที่แต่ละภาษากำหนดตำแหน่ง `{remaining}`/`{target}` เองอิสระ
    - **`BadgeChip` (`achievement-section.tsx`) เองไม่ต้องแตะเลย** เพราะรับ `label`/`unlocked` เป็น prop
      ล้วน ๆ ไม่มี hardcode ข้อความเอง — ทั้ง milestone badges (`formatLabel`) และ exercise PR badges
      (`exercise-pr-badges.tsx`'s `label`) ส่งข้อความที่แปลแล้วเข้ามาตรง ๆ
    - ทดสอบจริงผ่าน MariaDB: seed user + 12 กิจกรรมวิ่ง 5 กม. (รวม 60 กม., unlock หมุดหมาย 10/50 กม.
      อยู่ระหว่างทางไป 100 กม., unlock หมุดหมาย 10 ครั้ง อยู่ระหว่างทางไป 25 ครั้ง) + 2 กิจกรรมเวทเทรนนิ่ง
      มีท่า Bench Press (reps>1 ทั้งคู่ เพื่อให้เห็น 1RM ประมาณ, PR ล่าสุด 70 กก. × 5) รวม volume พอ unlock
      หมุดหมายแรก (1,000 กก.), มินต์ session JWT, curl หน้าเดียวกันทั้ง TH/EN (สลับผ่าน `User.locale`)
      ยืนยัน HTML มีข้อความแปลถูกต้องพร้อม interpolation จริงทุกจุด — โดยเฉพาะ progress-bar text ที่
      ลำดับคำต่างกันข้ามภาษา: "อีก 40.00 กม. ถึง 100.00 กม." (ไทย) เทียบ "40.00 km to go to 100.00 km"
      (อังกฤษ, ลำดับคำสลับกันจริงตามที่ตั้งใจ), "อีก 11 ครั้ง ถึง 25 ครั้ง"/"11 more to reach 25
      activities", ปลดล็อก "2/7"/"2/7 unlocked" (Thai นำหน้าด้วย "ปลดล็อกแล้ว", English ตามด้วย
      "unlocked" — คนละตำแหน่งอีกเช่นกัน), และ 1RM badge "Bench Press 70 กก. (~82 กก. 1RM)"/"Bench
      Press 70 kg (~82 kg 1RM)" (Epley: 70×(1+5/30)≈81.67 ปัดเป็น 82 ตรงกับที่คำนวณจริง) —
      `npx tsc --noEmit`, `npm run build`, `npm run test` (197 เทสผ่านหมด) ผ่านทั้งหมดก่อน commit
  - **5 หน้าสุดท้าย — ผู้ใช้ขอ "ลุยรวดเดียวเลยให้เสร็จ" หลัง achievements ทำทั้งชุดในรอบเดียว**:
    `log-activity` (+ `edit/page.tsx` ที่ใช้ `LogActivityForm` ตัวเดียวกัน — แปลไปด้วยแม้ไม่ได้อยู่ใน
    5 หน้าที่ระบุชื่อไว้ เพราะ `LogActivityForm` แปลแล้ว ถ้าไม่แปล wrapper ของหน้าแก้ไขด้วยจะเห็นหัวข้อ
    ไทยค้างอยู่เหนือฟอร์มที่เป็นอังกฤษ ครึ่ง ๆ กลาง ๆ แย่กว่าไม่แปลเลย), `portion-guide`, `knowledge`,
    `summary`, `supplements` (namespace `logActivity`/`portionGuide`/`knowledge`/`summary`/
    `supplements` ตามลำดับ)
    - **`AI_PROMPT_TEMPLATE` และ placeholder ตัวอย่างในช่องวาง (`log-activity-form.tsx`) ตั้งใจไม่แปล
      เหมือนเดิม** — เหตุผลเดียวกับ AI-import prompt อื่นทั้งหมดที่ CLAUDE.md เอกสารไว้แล้ว (parser
      ผูกกับ label ไทยตรง ๆ) ตอนแก้ไฟล์นี้ต้องระวังเป็นพิเศษเพราะเป็นไฟล์เดียวที่ทั้งมี AI-prompt
      ที่ห้ามแปล และมี UI ข้อความรอบ ๆ (ปุ่ม/label/error) ที่ต้องแปลอยู่ติดกัน
    - **`TYPES`/`INTENSITIES`/`RPE_CARDIO_LEVELS`/`RPE_LIFT_LEVELS` ย้ายจาก module-level const เข้าไป
      เป็น local const ในตัว component แทน** เพราะต้องเรียก `t()`/`t.raw()` ซึ่งใช้ได้แค่หลัง
      `useTranslations()` hook แล้ว (เรียกที่ module scope ไม่ได้) — `TYPES[0].value` ที่เดิมใช้ seed
      `useState` เริ่มต้นยังทำงานเหมือนเดิม เพราะ array ยังสร้างก่อนบรรทัด `useState` นั้นเสมอ แค่ย้ายเข้า
      มาอยู่ในฟังก์ชันเดียวกัน — ต้องเปลี่ยนชื่อ parameter `(t) => t.value === ...` เป็น `(opt) => ...`
      ใน 3 จุดที่ shadow ชื่อ `t` เดิม (ตัวแปร translations hook) ไปด้วย ไม่งั้น TS ไม่ error แต่จะงงว่า
      `t` ไหนคือของใคร
    - **`formatSetsCompact()` (module-level function, สร้างสรุปเซ็ทแบบย่อ "15×5กก. (RPE 8), ...") รับ
      `t` (translator function ที่ hook คืนมา) เป็น parameter ที่สอง แทนที่จะ hardcode หน่วย "กก."/
      "ครั้ง" ไทยตรง ๆ** — ไม่ใช่ hook เรียกซ้อนเพราะไม่ได้เรียก `useTranslations()` เอง แค่รับค่าที่
      component เรียกมาแล้วส่งต่อมาใช้ ปลอดภัยตาม React's rules of hooks — เพิ่ม key ใหม่
      `logActivity.compactSetWithWeight`/`compactSetNoWeight` สำหรับรูปแบบนี้โดยเฉพาะ (ไม่ reuse
      `colWeight`/`weightPlaceholder` เพราะข้อความประกอบกันคนละแบบ)
    - **`portion-guide-tabs.tsx`/`knowledge/page.tsx` ใช้ `t.raw()` อ่านทั้ง array/object ก้อนใหญ่
      แทนสร้าง key แยกทีละสตริง** — `portionGuide.categories` (array ของ object ซ้อน array ของ
      example อีกที) และ `knowledge.tdeeList`/`macroList`/`activityList` (array ของ bullet string
      ธรรมดา) — `t.raw()` next-intl คืนค่า JSON ดิบไม่ผ่าน ICU parsing เลย เหมาะกับข้อมูลที่เป็น
      โครงสร้าง/รายการ ไม่ใช่ประโยคเดี่ยวที่ต้อง interpolate ตัวแปร (ถ้าใช้ `t()` ทีละ key จะต้องสร้าง
      30+ key แยกสำหรับแค่ portion-guide อย่างเดียว ไม่คุ้มและดูแลยากกว่า)
    - **`knowledge/page.tsx`'s `bmrP2` ใช้ `t.rich()` แทน `t()`** เพราะข้อความมี `<strong>` ฝังอยู่กลาง
      ประโยค (ชื่อสูตร Katch-McArdle/Lean Body Mass) — `t.rich("bmrP2", { strong: (chunks) =>
      <strong>{chunks}</strong> })` จับคู่ tag `<strong>` ในข้อความ JSON กับ React component จริง
      เดียวกับที่ `whey-reminder-toggle.tsx`'s `wheyNeedSubscription` ใช้ `<link>` tag คู่กับ
      `<Link href="/dashboard/food">` (ลิงก์ไปหน้าไดอารี่ต้องอยู่ตรงกลางประโยค ต่อ string เองแบบเดิม
      จะแปลลำดับคำข้ามภาษาไม่ได้ เหมือนปัญหาเดียวกับที่ achievements' progress text แก้ไปแล้วข้างบน)
    - **`summary-configurator.tsx`'s `DEFAULT_FIELDS` เปลี่ยนจากเก็บ `{id, label, enabled}` เป็น
      `{id, enabled}` ล้วน ๆ แล้วแยก `FIELD_LABEL_KEY: Record<string, string>` ไว้ map id → message key
      ต่างหาก** — เดิม label เป็น literal Thai string ฝังอยู่ใน const ระดับโมดูล เปลี่ยนไม่ได้ตาม locale
      เลย ย้าย label ไปคำนวณสดที่ render time ผ่าน `t(FIELD_LABEL_KEY[f.id])` แทน — `applyStoredFields()`
      (merge ค่าที่ persist ไว้ใน `localStorage` เข้ากับ default list) ก็ต้องแก้ตามให้ทำงานกับ id ล้วน ๆ
      ไม่อ้างอิง label เลย (เดิมก็ไม่เคย trust label ที่ persist ไว้อยู่แล้วตามที่ comment เดิมบอก แค่ตอนนี้
      ไม่มี label ให้ persist ตั้งแต่แรกเลยยิ่งชัดเจนขึ้น) — พฤติกรรม persist เดิม (จำ id+enabled+ลำดับ
      ข้าม session, ไม่จำ `lang`) ไม่เปลี่ยนเลย
    - **Reuse ข้ามหน้าเยอะในจุดที่ข้อความซ้ำกับของเดิมที่แปลไปแล้วก่อนหน้า**: `summary-configurator.tsx`
      reuse `common.language`/`common.background`/`common.opaque`/`common.transparent`/
      `common.loadingPreview`/`common.generatingImage`/`common.downloadImage`/`common.downloadFailed`/
      `common.share` (ตัวเลือกภาษา/พื้นหลัง/ปุ่มดาวน์โหลด-แชร์ ข้อความเหมือน `ShareActivityButton`/
      `QuickDownloadSheet` เป๊ะ) และ `activityDetail.share.downloadShort` (ป้าย "ดาวน์โหลด" สั้น ๆ ตอน
      มีปุ่มแชร์คู่กันแล้ว) — `log-activity/page.tsx`, `portion-guide` (ไม่ reuse เพราะ back link ไปคนละ
      หน้า), `supplements/page.tsx`, `summary/page.tsx` reuse `common.backToOverview` (กลับไปหน้ารวม)
    - ทดสอบจริงผ่าน MariaDB ทุกหน้า (รวมหน้าแก้ไขกิจกรรมด้วย): seed กิจกรรมวิ่ง+ท่าเวท+อาหารเสริม 1
      รายการ, มินต์ session JWT, curl ทุกหน้าทั้ง TH/EN ยืนยัน HTML แปลถูกต้องพร้อม interpolation จริง
      ทุกจุดที่ซับซ้อน — โดยเฉพาะ `t.raw()` array ทั้งสองที่ (RPE levels ของ `log-activity`, portion
      categories, knowledge's bullet lists — เห็นทั้ง label/desc/examples ภาษาอังกฤษถูกต้องครบทุก item
      ไม่มีตกหล่น), `t.rich()` ทั้งสองที่ (`<strong>Katch-McArdle</strong>` ใน knowledge, ลิงก์ "food
      diary page" ใน whey reminder), field toggle aria-label ที่หน้า summary ("Show Calories"), และ
      edit-activity page ที่โชว์ "Edit activity"/"Back to activity"/"Save changes" ถูกต้องทั้งที่ฟอร์ม
      ข้างในเป็น component เดียวกับหน้าบันทึกใหม่ — `npx tsc --noEmit`, `npm run build`, `npm run test`
      (197 เทสผ่านหมด) ผ่านทั้งหมดก่อน commit — **ถึงจุดนี้แปล UI ครบทุกหน้าที่เข้าถึงได้จริงในแอพแล้ว**
      เหลือแค่สิ่งที่ตั้งใจไม่แปล (ดูหัวข้อถัดไป)
- **ยังไม่แปล (ตั้งใจ, นอกขอบเขตรอบนี้)**:
  - `ACTIVITY_LEVEL_LABEL`/`GOAL_LABEL` (`src/lib/nutrition.ts`) — shared label map ที่ยังใช้ร่วมกับ
    หน้านอกขอบเขต (activity detail ฯลฯ) เปลี่ยนแค่ในหน้าที่แปลแล้วจะทำให้ไม่ตรงกันข้ามหน้า —
    `BMI_CATEGORY_LABEL`/`BMI_CATEGORY_GUIDANCE` ตรงข้ามกัน แปลแล้วเพราะใช้แค่ในหน้าเชิงลึกหน้าเดียว
    (ดูโค้ดใน `nutrition/page.tsx`, ไม่ import จาก `src/lib/nutrition.ts` อีกต่อไป สร้าง key ในหน้า
    เชิงลึกแทน)
  - `explainCalorieTarget()` (`src/lib/nutrition.ts`) — ฟังก์ชันประกอบประโยคอธิบายเป้าหมายแคลอรี่
    แบบไดนามิก (สอดตัวเลขจริงของ user เข้าไปในประโยคไทย) ซับซ้อนเกินขอบเขต "แปลข้อความ UI คงที่"
    ของรอบนี้ ยังคง Thai-only เสมอไม่ว่า locale ไหน
  - AI-import prompt ทั้งหมด (`AI_PROMPT_TEMPLATE` ใน `body-composition-card.tsx`, prompt template
    ใน `import-meal-panel.tsx`/`activity-import-parse.ts` ฯลฯ) รวมถึง field label ที่ parser ต้องจับคู่
    กับ prompt เป๊ะ ๆ (เช่น `missing` array ใน `applyParsedText`) — คงเป็นภาษาไทยเสมอเพราะ parser
    (`body-composition-import-parse.ts` ฯลฯ) ผูกกับ label ไทยตรง ๆ เปลี่ยนตาม locale ไม่ได้โดยไม่แก้
    parser ด้วย ซึ่งอยู่นอกขอบเขตรอบนี้
  - Grandchild ที่ไม่ใช่ core flow ของหน้าไดอารี่: `food-label-scanner.tsx`, `import-meal-panel.tsx`,
    `water-reminder-toggle.tsx` — เปิดจากปุ่มรองในแผงเพิ่มอาหาร ไม่ใช่ส่วนที่เห็นทันทีเมื่อเข้าหน้า
  - ทุกหน้านอกเหนือจากหน้าที่แปลแล้วทั้งหมดด้านบน (ตอนนี้ครอบคลุมทุกหน้าใน bottom-nav + ทุกหน้าที่เข้าถึง
    ได้จากลิงก์ในนั้นแล้ว) ข้อความ error จาก API, อีเมล, ข้อความในรูปการ์ดแชร์ Satori — Thai-only ถาวร
    จนกว่าจะมีคนขอเพิ่ม
- **ข้อมูลที่ผู้ใช้พิมพ์เอง (ชื่อเมนู/ชื่อกิจกรรม/ชื่อท่า/หมายเหตุ/ชื่อโปรไฟล์ ฯลฯ) ไม่ผ่านระบบแปลภาษา
  เลยไม่ว่ากรณีใด** — เก็บ/แสดงตามที่พิมพ์ไว้เป๊ะเสมอ ระบบ i18n ครอบคลุมแค่ข้อความ UI ของแอพเอง
  (label/ปุ่ม/หัวข้อ) เท่านั้น
- **หน่วย "กก."/"ก."/"มก."/วันที่แบบ `toLocaleString`/`toLocaleDateString`** — จุดที่แปลแล้วทุกจุดเปลี่ยน
  จาก hardcode `"th-TH"` เป็นเลือกตาม locale (`locale === "en" ? "en-US" : "th-TH"` สำหรับตัวเลข/วันที่,
  `locale === "en" ? "kg"/"g"/"mg" : "กก."/"ก."/"มก."` สำหรับหน่วย) — แต่ `Food.unitLabel`/`GRAM_UNIT`
  (`src/lib/food.ts`) เป็นค่าที่เก็บจริงใน DB (ใช้เทียบ `isGramUnit()`) เลย**ไม่แปล** ไม่ว่า locale ไหน
  เพราะเป็น data field ไม่ใช่ label แสดงผลเฉย ๆ

### 6. อื่น ๆ
- Activity pages: `/dashboard` (list), `/dashboard/activity/[id]` (detail), `/dashboard/log-activity`
  (บันทึกเอง), `/dashboard/records`, `/dashboard/compare`, `/dashboard/achievements`,
  `/dashboard/summary` — ทำงานเหมือนกันไม่ว่า `Activity.provider` จะเป็น `STRAVA` (ของเก่า) หรือ
  `MANUAL` (ของใหม่ทั้งหมด นับจากตัด Strava sync ออก) เพราะ query/stat ทุกจุดไม่แยก provider
  - **เพซ/ความเร็วต่อประเภทกิจกรรม** — `activitySpeedValue(type, metersPerSec, unit)` ใน
    `src/lib/format.ts` เป็นจุดเดียวที่ตัดสินว่าประเภทไหนแสดงผลแบบไหน: วิ่ง = เพซนาทีต่อกม./ไมล์
    (`formatPace`), ว่ายน้ำ = เพซนาทีต่อ 100 ม./100 หลา (`formatSwimPace`, ใหม่ — เดิมว่ายน้ำใช้สูตร
    กม./ชม. เหมือนปั่นจักรยานทั้งที่นักว่ายน้ำไม่มีใครพูดเป็น กม./ชม.), อย่างอื่นทั้งหมด = ความเร็ว
    กม./ชม. (หรือไมล์/ชม.) ธรรมดา — ทุกหน้าที่โชว์เพซ/ความเร็วของกิจกรรมเดี่ยว (หน้ารายละเอียด,
    สถิติสูงสุด, การ์ดแชร์, ตารางกิจกรรมในหน้าแรก, month-highlights) เรียกฟังก์ชันนี้แทนการเช็ค
    `type === "Run"` เองแยกจุด — กันไม่ให้ลืมอัปเดตบางหน้าเวลามีประเภทใหม่ที่ไม่ใช่ กม./ชม. อีกในอนาคต
    (แบบที่ Swim เคยพลาดมาก่อน) การเทียบ 2 กิจกรรม (`ComparisonCard` ที่หน้ารายละเอียด,
    `CompareView` ที่ `/dashboard/compare`) มี `swimPaceSecondsPerUnit`/`formatSignedSwimPace`
    คู่กับ `paceSecondsPerUnit`/`formatSignedPace` เดิมสำหรับคำนวณส่วนต่าง — เทียบกันได้เฉพาะกิจกรรม
    ที่ใช้หน่วยเดียวกันเท่านั้น (วิ่งเทียบวิ่ง, ว่ายเทียบว่าย) ถ้าประเภทไม่ตรงกัน (เช่น ปั่นจักรยาน
    เทียบว่ายน้ำ) จะไม่โชว์ส่วนต่างเลยแทนที่จะโชว์ตัวเลขที่เอาหน่วยคนละแบบมาลบกันแบบผิด ๆ (บั๊กเดิมที่
    เจอระหว่างแก้ครั้งนี้ — `CompareView` เคยคำนวณส่วนต่างแบบ "ไม่ใช่วิ่งทั้งคู่" ครอบคลุมกว้างเกินไป
    ทำให้เทียบปั่นจักรยานกับว่ายน้ำได้ผลลัพธ์ที่ไม่มีความหมาย) — `DetailPanel`/`ProfileChart` (กราฟ
    เพซ/ความเร็วตลอดระยะทาง + splits/laps จาก Strava streams) ยังใช้ `isRun` เดิมแบบ Run-only ไม่ได้
    ตามไปแก้ เพราะเป็นข้อมูลเก่าที่ล็อกไว้เฉพาะ activity ที่เคย sync จาก Strava เท่านั้น (ไม่มีทางมี
    ข้อมูลใหม่เข้ามาอีกแล้ว) ผลกระทบน้อยกว่าจุดอื่นมาก
  - `/dashboard/log-activity` มีโหมด "นำเข้าจาก AI" คู่กับ "กรอกเอง" เหมือนอาหาร/InBody (paste prompt
    สำเร็จรูป → ถาม AI เอง พร้อมแนบรูปสรุปกิจกรรมจากแอพนาฬิกา/สายรัด → วางคำตอบกลับมาให้
    `parseActivityText` (`src/lib/activity-import-parse.ts`) เติมประเภท/ระยะเวลา/ระยะทาง/แคลอรี่/
    หัวใจ/เคเดนซ์เฉลี่ย/หมายเหตุ และถ้าเป็นเวทเทรนนิ่งเติมรายการท่า (ตาราง "ชื่อท่า | เซ็ท | ครั้ง |
    น้ำหนัก") ต่อท้ายรายการเดิมด้วย — ไม่เรียก vision API เอง เหมือนฟีเจอร์ AI-import อื่น ๆ ในแอพ
  - **`Activity.avgSpeedMs` คำนวณจากระยะทาง+เวลาให้อัตโนมัติตอนบันทึก/แก้ไขกิจกรรมเอง** — เดิม POST
    `/api/activity/manual` และ PATCH `/api/activity/[id]` เก็บแค่ `distanceMeters`/`durationSec` ที่
    กรอกมาตรง ๆ ไม่เคยคำนวณ `avgSpeedMs` เลยไม่ว่าจะกรอกเองหรือ import จาก AI ทั้งที่มีข้อมูลพอคำนวณ
    ได้อยู่แล้ว (เช่น 5.02 กม. ใน 40 นาที) — `activitySpeedValue()` (`src/lib/format.ts`, จุดเดียวที่
    ตัดสินว่าโชว์เพซ/ความเร็ว) เลยได้ `null` เสมอ ช่อง "เพซเฉลี่ย"/"ความเร็วเฉลี่ย" ที่หน้ารายละเอียด
    กิจกรรมโชว์ "-" ทุกครั้งสำหรับกิจกรรมที่บันทึกเอง แม้จะกรอกระยะทาง+เวลาครบแล้วก็ตาม (กระทบ badge
    "เพซเร็วที่สุด" ที่ต้องเทียบ `avgSpeedMs` ด้วย เลยไม่เคยขึ้นให้กิจกรรมแบบ MANUAL เลย) ตอนนี้ทั้งสอง
    route เรียก `computeAvgSpeedMs(distanceKm, durationMin)` (`src/lib/activity-validation.ts`) —
    คืน `null` ถ้าไม่มีระยะทาง (เช่น เวทเทรนนิ่ง) ไม่งั้นคืน `(distanceKm × 1000) ÷ (durationMin × 60)`
    — `maxSpeedMs` ไม่มีสูตรคำนวณแบบเดียวกันได้ (ไม่มีข้อมูลราย-วินาทีให้หา max จริง มีแค่ค่าเฉลี่ย
    ตลอดทั้งครั้งเท่านั้น) — แก้แค่ route เลยมีผลกับกิจกรรมใหม่/กิจกรรมที่ถูกแก้ไข(บันทึกซ้ำ)เท่านั้น
    กิจกรรม MANUAL เก่าที่บันทึกไว้ก่อนหน้านี้ต้อง backfill แยก:
    `scripts/backfill-avg-speed-2026-09-14.mjs` (หา `Activity` ที่ `provider: "MANUAL"`,
    `avgSpeedMs: null`, มี `distanceMeters` แล้วคำนวณเติมให้ — safe to re-run)
  - **`Activity.maxSpeedMs` กรอกเองได้แล้ว ("เพซ/ความเร็วสูงสุด")** — ผู้ใช้เอาไว้เก็บสถิติเทียบกันเอง
    ในอนาคต (เช่น "เพซดีที่สุด" ที่นาฬิกาโชว์คู่กับเพซเฉลี่ย) ต่างจาก `avgSpeedMs` ที่คำนวณอัตโนมัติ
    ข้างบน field นี้ไม่มีสูตรจากอินพุตอื่นให้คำนวณเลย เลยต้องเป็นช่องกรอกเอง — ฟอร์ม
    (`log-activity-form.tsx`) โชว์ input ต่างกันตามประเภทกิจกรรม ผ่าน `paceUnitMeters(type)`
    (คืน 1000 ถ้าวิ่ง, 100 ถ้าว่ายน้ำ, `null` อย่างอื่น — ใช้ตัดสินว่าโชว์แบบไหน คนละหน้าที่กับ
    `activitySpeedValue()` ที่ตัดสินแค่ตอน**แสดงผล**): วิ่ง/ว่ายน้ำ = 2 ช่อง "นาที"/"วินาที" ต่อ
    กม./100ม. (แปลงเป็น m/s ฝั่ง client ก่อนส่ง — `perUnitMeters ÷ (min×60+sec)`), ประเภทอื่น = ช่อง
    "ความเร็วสูงสุด (กม./ชม.)" เดียว (แปลง `÷ 3.6` ก่อนส่ง) — ส่งเป็น `maxSpeedMs` (ตัวเลข m/s ที่แปลง
    แล้ว ไม่ใช่ raw text แบบฟิลด์ตัวเลขอื่น ๆ) ให้ POST/PATCH ผ่าน `optionalNonNegative()` ตัวเดียวกับ
    ฟิลด์ optional อื่น เพราะฝั่ง client แปลงหน่วยเรียบร้อยแล้ว ไม่ต้องมี validator แยก — หน้าแก้ไข
    (`edit/page.tsx`) แปลงกลับจาก `activity.maxSpeedMs` (m/s) เป็นนาที/วินาที หรือ กม./ชม. ให้ฟอร์ม
    ตอนโหลด โดยใช้ `initial.type` (ประเภทกิจกรรมตอนบันทึกจริง ไม่ใช่ type ที่เลือกอยู่ในฟอร์ม ณ ขณะนั้น)
    เป็นตัวตัดสินหน่วย ถ้าผู้ใช้สลับ dropdown ประเภทกิจกรรมหลังจากนั้น จะเปลี่ยนแค่ว่าช่องไหนโชว์
    ไม่กระทบค่าที่กรอกไว้ในอีกช่อง — ที่หน้ารายละเอียดกิจกรรม/การ์ดแชร์กิจกรรมเดี่ยว (`api/share/[id]`)
    ไม่ต้องแก้อะไรเลย เพราะทั้งคู่อ่าน `activity.maxSpeedMs` ผ่าน `activitySpeedValue()` อยู่แล้วตั้งแต่
    แรก (โชว์ "-" มาตลอดเพราะไม่มีทางกรอกค่านี้ได้) — **"นำเข้าจาก AI" อ่านค่านี้ได้แล้วด้วย** (ผู้ใช้
    ขอเพิ่มในรอบถัดมาจากตอนที่ตั้งใจปล่อยไว้นอกขอบเขตก่อนหน้านี้) `activity-import-parse.ts`'s
    `parseActivityText` เพิ่มบรรทัด "เพซที่ดีที่สุด:"/"ความเร็วสูงสุด:"/"best pace:"/"max speed:" ใน
    พรอมต์ — ต่างจากฟิลด์ตัวเลขอื่นที่ผ่าน `firstNumber` ตรง ๆ ค่านี้ถูกเก็บเป็น raw text ไว้ก่อน
    (`bestPaceRaw`, เหมือน `NOTES_LINE`) เพราะรูปแบบขึ้นกับประเภทกิจกรรมที่อาจจะยังไม่รู้ตอนเจอบรรทัดนี้
    (บรรทัด "เพซที่ดีที่สุด" อาจโผล่มาก่อนบรรทัด "ประเภท" ก็ได้ถ้า AI ตอบไม่ตรงลำดับพรอมต์เป๊ะ) — แปลง
    เป็น `maxSpeedMs` (m/s) จริงหลังวน loop ทุกบรรทัดจบแล้ว ผ่าน `parseBestSpeedMs(raw, result.type)`
    ที่ `result.type` ถูก finalize แล้วแน่นอน — ฟังก์ชันนี้บังคับให้รูปแบบตรงกับประเภทเป๊ะก่อนแปลง
    (วิ่ง/ว่ายน้ำต้องเป็น "mm:ss", อย่างอื่นต้องเป็นตัวเลขล้วน) ถ้าไม่ตรง (เช่น AI ตอบตัวเลขล้วนให้
    กิจกรรมวิ่ง หรือตอบ mm:ss ให้ปั่นจักรยาน) จะคืน `null` แทนการเดาหน่วยผิด ๆ เพราะเดาผิดแล้วเงียบจะแย่
    กว่าช่องว่างเปล่า — ฝั่งฟอร์ม (`applyParsedText`) แปลง `parsed.maxSpeedMs` กลับเป็นนาที/วินาทีหรือ
    กม./ชม. ให้ถูกช่อง โดยใช้ประเภทกิจกรรมที่ "กำลังจะมีผลจริง" (ประเภทที่ parse ได้ถ้าถูกต้อง ไม่งั้น
    ใช้ประเภทที่เลือกอยู่ในฟอร์ม ณ ตอนนั้น) ไม่ใช่ `usesPace`/`paceUnit` ระดับ component เพราะค่านั้น
    ยังอิง `type` state ก่อนที่ `setType(parsed.type)` (เรียกอยู่บรรทัดก่อนหน้าในฟังก์ชันเดียวกัน) จะมีผล
    จริงกับ re-render ครั้งถัดไป ใช้ค่าเก่าจะแปลงหน่วยผิดถ้าประเภทที่ parse ได้ต่างจากที่เลือกไว้ก่อนหน้า
    — เทสอยู่ที่ `activity-import-parse.test.ts` describe block "best pace/speed (maxSpeedMs)"
    ครอบคลุมทั้ง 2 ยูนิต (วิ่ง/ว่ายน้ำ), ยูนิตอื่น, คีย์เวิร์ดอังกฤษ, placeholder "-", ลำดับบรรทัดสลับกัน,
    และ mismatch ทั้ง 2 ทาง (ตัวเลขล้วนให้ประเภทที่ควรเป็น mm:ss และกลับกัน) ที่ควรได้ `null`
  - **เคเดนซ์เฉลี่ย (`Activity.avgCadence`) รับได้จากฟอร์มกรอกเอง/นำเข้าจาก AI แล้ว** — เดิม field นี้
    มีอยู่ใน schema (ของเก่าจาก Strava sync) แต่ POST/PATCH ของกิจกรรมแบบ manual ไม่เคยรับค่านี้เลย
    เพิ่มช่องกรอก "เคเดนซ์เฉลี่ย (spm/rpm)" ในฟอร์ม + `parseActivityText` อ่านคีย์เวิร์ด
    `เคเดนซ์เฉลี่ย`/`cadence` ให้ — **หน่วยขึ้นกับประเภทกิจกรรม** เหมือนเพซ/ความเร็ว: ปั่นจักรยาน = รอบ
    ต่อนาที (rpm), อย่างอื่นทั้งหมด (วิ่ง/เดิน/ฯลฯ) = ก้าวต่อนาที (spm) — `cadenceUnitLabel(type)`
    (`src/lib/format.ts`) เป็นจุดเดียวที่ตัดสินหน่วย ใช้แทนการ hardcode `"rpm"` ที่ 4 จุด (หน้ารายละเอียด
    กิจกรรม, การ์ดแชร์กิจกรรมเดี่ยว, หน้าเปรียบเทียบ 2 จุด) — **เจอบั๊กเดิมระหว่างแก้ครั้งนี้**: ทั้ง 4
    จุดเคย hardcode "rpm" เสมอไม่ว่าประเภทไหน เป็นของเก่าตั้งแต่ตอนที่ `avgCadence` มาจาก Strava sync
    จักรยานเท่านั้น (เงียบอยู่เพราะไม่มีข้อมูลวิ่งเข้ามาแตะ field นี้เลย) พอเปิดให้กรอกเคเดนซ์วิ่งเองได้
    บั๊กนี้เลยเห็นผลจริง แก้พร้อมกันไปด้วย — หน้าเปรียบเทียบ (`compare-view.tsx`) ยังเพิ่ม guard
    `a.type === b.type` ก่อนคำนวณส่วนต่างเคเดนซ์ด้วย (เดิมไม่มีเลย) กันเทียบ spm ของวิ่งกับ rpm ของ
    ปั่นจักรยานแบบลบเลขข้ามหน่วยกันตรง ๆ (บั๊กคนละแบบแต่คล้ายกับที่ `bothSameKind` เคยแก้ให้เพซ/ความเร็ว)
  - **`Activity.notes`** — ช่องข้อความอิสระ ไม่บังคับ สำหรับข้อมูลจากรูปสรุปกิจกรรมที่ไม่มี field
    โครงสร้างรองรับเลย (เช่น Training Effect, VO2max, สัดส่วนโซนหัวใจ, กล้ามเนื้อที่ใช้ — เจอจากรูป
    Zepp เวทเทรนนิ่งที่ผู้ใช้ส่งมาดู) แทนที่จะไล่เพิ่ม column เฉพาะทุกเมตริกของทุกยี่ห้อนาฬิกา (ไม่จบ
    แน่ ๆ เพราะแต่ละยี่ห้อรายงานคนละชุด) — migration `20260915090000_activity_notes`
    (`VARCHAR(500)`, nullable, ไม่มี backfill เพราะกิจกรรมเก่าไม่มีทางมีค่านี้อยู่แล้ว) —
    `optionalNotes()` (`src/lib/activity-validation.ts`) trim + ตัดที่ 500 ตัวอักษรเงียบ ๆ แทนที่จะ
    ปฏิเสธทั้ง request แบบ field ตัวเลขอื่น ๆ ข้างบน (ตั้งใจ: โน้ตยาวเกินโดนตัดท้ายเป็นความเสียหายที่
    กู้คืนได้ง่าย ไม่เหมือนตัวเลขอ่านผิดหน่วยที่นิ่งเงียบแล้วพังข้อมูลจริง) — `parseActivityText` อ่านจาก
    บรรทัด "หมายเหตุ: ..." (หรือ "โน้ต:"/"note:") แยกออกมาจาก `FIELD_MATCHERS` เพราะเป็น field เดียวที่
    เป็นข้อความ ไม่ใช่ตัวเลข — ตอบ "-" (placeholder เดียวกับที่ field อื่นใช้ตอนไม่มีค่าในรูป) ถือว่า
    "ไม่มีโน้ต" เหมือนกัน ไม่ใช่ข้อความ "-" จริง ๆ — แสดงผลที่หน้ารายละเอียดกิจกรรมเป็นกล่องแยก "หมายเหตุ"
    ต่อจากกริดสถิติ ก่อนส่วนท่าออกกำลังกาย (ซ่อนไปเลยถ้าไม่มีค่า)
  - **ประมาณแคลอรี่อัตโนมัติแบบ MET** (`src/lib/calorie-estimate.ts`, `estimateCalories`) — ช่อง
    "แคลอรี่ (kcal)" เดิมต้องพิมพ์เองเสมอ (ไม่มีสูตรในแอพเลย) ทำให้หลายจุดที่พึ่งพา `Activity.calories`
    (แท็บแคลอรี่ที่หน้าแรก, hero number ของการ์ดแชร์กิจกรรม) มักมีข้อมูลไม่ครบเพราะคนลืมกรอก — ตอนนี้
    ถ้าช่องแคลอรี่ว่างอยู่ (และมี `User.weightKg`) จะโชว์ข้อความเล็ก ๆ ใต้ช่อง "ประมาณ ~N kcal (ใช้ค่านี้)"
    กดแล้วเติมให้เลย **ไม่ auto-fill เองเงียบ ๆ** (เหมือน pattern ข้อมูลอ้างอิงท่าเวทด้านล่าง — ให้ผู้ใช้
    กดยืนยันเอง เพราะค่าประมาณผิดที่เข้าไปแบบไม่มีใครสังเกตเห็นแย่กว่าช่องว่างเปล่า) คำนวณจาก
    `MET × น้ำหนักตัว(กก.) × เวลา(ชม.)` (สูตรประมาณมาตรฐาน 1 MET ≈ 1 kcal/kg/ชม.) โดย MET เป็นตาราง
    คงที่ต่อ (ประเภทกิจกรรม, ความหนัก LOW/MODERATE/HIGH — ใช้ field `intensity` ที่ฟอร์มเก็บอยู่แล้วแต่
    เดิมไม่เคยถูกใช้จริงที่ไหนเลยนอกจากบันทึกเก็บไว้เฉย ๆ) ไม่ได้อิงระยะทาง/เพซเพราะ `distanceKm` เป็น
    ช่อง optional ที่หลายคนข้าม สูตรที่ต้องพึ่งมันจะใช้งานไม่ได้บ่อย — ทั้งหน้า `/dashboard/log-activity`
    และ `/dashboard/activity/[id]/edit` ต้องส่ง prop `userWeightKg` (จาก `User.weightKg`) ให้
    `LogActivityForm` เสมอ ไม่งั้นคำแนะนำนี้จะไม่โผล่เลย (prop optional/default `null` กันพังถ้าลืมส่ง)
  - แต่ละแถว "ท่าออกกำลังกาย" เป็นการ์ดแยก (ชื่อท่าเต็มความกว้างแถวบน, เซ็ท/ครั้ง/น้ำหนักเป็น grid 3
    ช่องแถวล่าง) — เดิมเรียงเป็นแถวเดียวกันหมด (ชื่อท่า+เซ็ท+ครั้ง+น้ำหนัก+ปุ่มลบ) ทำให้ช่องชื่อท่า
    ถูกบีบจนแคบมากบนมือถือ (`flex-1` แต่พื้นที่เหลือให้ขยายน้อยเกินไปเพราะอีก 3 ช่องเป็น fixed width)
    ดูเหมือนพิมพ์ไม่ได้ทั้งที่จริงพิมพ์ได้ แค่มองไม่เห็นตัวอักษร
  - **แก้ไข/ลบกิจกรรมที่บันทึกไปแล้วได้แล้ว** (`src/lib/activity-validation.ts` เก็บ validation
    ที่ใช้ร่วมกัน, `PATCH`/`DELETE /api/activity/[id]`) — เดิมมีแค่ POST สร้างอย่างเดียว พิมพ์ผิด/
    บันทึกซ้ำแก้ไม่ได้เลย **แก้ไขจำกัดเฉพาะ `provider: "MANUAL"`** (ปุ่ม "แก้ไข" ที่หน้ารายละเอียด
    กิจกรรมไปหน้า `/dashboard/activity/[id]/edit` ใช้ `LogActivityForm` ตัวเดียวกับตอนสร้าง แค่ส่ง
    `activityId`+`initial` เพิ่มเข้าไปให้สลับเป็นโหมดแก้ไข — PATCH แทน POST, เปลี่ยน exercises ทั้งชุด
    แบบลบแล้วสร้างใหม่ไม่ diff ทีละแถว) เพราะฟอร์มรู้จักแค่ field ชุด manual เท่านั้น กิจกรรมเก่าจาก
    Strava มี field เฉพาะ (เส้นทาง GPS, splits, kudos) ที่ฟอร์มนี้ไม่มีทางเก็บ/แก้ให้ถูกต้อง — **ลบได้
    ทุก provider** (ปุ่ม "ลบ" คู่กับปุ่มแก้ไข ใช้ `confirm()` ก่อนเหมือน `DeleteAccountButton`) เพราะ
    เป็นแค่ลบแถวในเครื่อง Strava sync ตายไปแล้วทั้งหมด ไม่มีประเด็นเรื่อง sync กลับมาใหม่ — **`startedAt`
    ห้ามเป็นวันอนาคต** (`isFutureDate()` ใน `activity-validation.ts`, เช็คทั้ง POST สร้างใหม่และ PATCH
    แก้ไข คืน `400 future_date`) — เดิมเช็คแค่ว่า parse เป็นวันที่ได้ (`!Number.isNaN`) ไม่เคยเช็คว่าเป็น
    วันที่สมเหตุสมผลเลย พิมพ์ปีผิด/เลือก AM-PM ผิดในฟอร์มจะบันทึกกิจกรรมล่วงหน้าไปได้เงียบ ๆ ทำให้ streak/
    heatmap/monthly goal/activity bonus ของวันนี้เพี้ยนเพราะมีกิจกรรม "อนาคต" ปนอยู่
  - **ข้อมูลอ้างอิงท่าเวทจากประวัติ (progressive overload) + PR ต่อท่า** — ทั้งคู่มาจาก query เดียวกัน
    คือ `getExerciseStats(userId)` (`src/lib/exercise-stats.ts`) วนรอบเดียวผ่าน `Exercise` ทั้งหมดของ
    user (เรียงเก่า→ใหม่) พับตามชื่อท่า (trim+lowercase กันซ้ำเพราะตัวพิมพ์/เว้นวรรค) ได้ทั้ง "ครั้ง
    ล่าสุด" (sets/reps/weightKg/วันที่ของ log ล่าสุดของท่านั้น) กับ "PR" (น้ำหนักสูงสุดที่เคยยกของท่านั้น
    ทั้งชีวิต, `null` ถ้าท่านั้นไม่เคยใส่น้ำหนักเลยเพราะเป็น bodyweight — ไม่มี PR ตัวเลขให้โชว์)
    ไม่จำกัดช่วงเวลา (สแกนทั้งหมดเพราะตารางของผู้ใช้คนเดียวเล็กพอ, จำกัดช่วงจะทำให้ท่าที่ไม่ได้ทำนานๆ
    ดูเหมือนไม่เคยทำเลยทั้งที่จริงมีประวัติ)
    - **ที่ฟอร์มบันทึก/แก้ไขกิจกรรม** (`log-activity-form.tsx`) — แต่ละแถวท่า ถ้าชื่อ (trim+lowercase)
      ตรงกับท่าที่เคยบันทึกมาก่อน จะโชว์กล่องเล็ก ๆ ใต้ช่องชื่อ "ครั้งก่อน (วันที่): N เซ็ท × M ครั้ง @ W
      กก." พร้อมปุ่ม "ใช้ค่านี้" คัดลอกเซ็ท/ครั้ง/น้ำหนักครั้งก่อนมาใส่แถวปัจจุบันให้เลย (ตั้งใจไม่ auto-fill
      ทุกครั้งที่พิมพ์ ให้ผู้ใช้กดยืนยันเองแทน) — ช่องชื่อท่ามี `<datalist>` ให้พิมพ์แล้วเห็น autocomplete
      จากชื่อท่าที่เคยใช้ด้วย ทั้งสองหน้า (`/dashboard/log-activity`,
      `/dashboard/activity/[id]/edit`) ต้องดึง `getExerciseStats` มาส่งเป็น prop `exerciseStats`
      ให้ฟอร์มเสมอ ไม่งั้นฟีเจอร์นี้จะเงียบหายไปเฉย ๆ (prop เป็น optional/default `[]` กันพังถ้าลืมส่ง
      แต่ควรส่งทุกจุดที่ใช้ฟอร์มนี้) — **หน้าแก้ไข (`edit/page.tsx`) ต้องส่ง
      `getExerciseStats(userId, activity.id)` (argument ตัวที่สอง = activity ที่กำลังแก้)
      ไม่ใช่ `getExerciseStats(userId)` เฉย ๆ** ไม่งั้นถ้าท่านั้นถูกทำล่าสุดในกิจกรรมที่กำลังแก้อยู่พอดี
      (เคสที่พบบ่อยเพราะคนมักแก้กิจกรรมล่าสุดของตัวเอง) กล่อง "ครั้งก่อน" จะไปโชว์ค่าของแถวเดียวกับที่
      กำลังแก้อยู่นั่นแหละ (ค่าตรงกับที่กรอกในฟอร์มเป๊ะ) แทนที่จะโชว์ครั้งก่อนหน้าจริง ๆ — พบบั๊กนี้ตอน
      รีวิวโค้ดหลังทำฟีเจอร์นี้เสร็จแล้ว แก้ด้วยการเพิ่ม optional 2nd arg `excludeActivityId` ให้
      `getExerciseStats` filter `activityId: { not: excludeActivityId }` ออกจาก query ก่อนพับข้อมูล
      (หน้า records/achievements เรียกแบบไม่ใส่ arg ตัวที่สองเหมือนเดิม เพราะอยากได้ข้อมูลทั้งหมดจริง ๆ)
    - **ที่หน้า "สถิติสูงสุด"** (`/dashboard/records`) — เพิ่มส่วน "PR ท่าออกกำลังกาย" ต่อท้ายการ์ด
      per-type เดิม (การ์ด per-type ของ `WeightTraining` ไม่มีระยะทาง/ความเร็วให้โชว์อยู่แล้วโดยธรรมชาติ
      ส่วนนี้เลยเป็นสถิติที่ actionable จริงสำหรับสายเวทแทน) รายการเรียงตามชื่อท่า (`localeCompare`
      แบบไทย) แต่ละแถวลิงก์ไปหน้ารายละเอียดกิจกรรมที่ทำ PR นั้นได้ (`prActivityId`) — กรองท่าที่ไม่เคย
      ใส่น้ำหนักออกไปแล้ว (ดูด้านบน) — **แต่ละแถวมีเลข "1RM ประมาณ" ต่อท้ายด้วย** (`estimateOneRepMaxKg`,
      `src/lib/exercise-stats.ts`, สูตร Epley: `weight × (1 + reps/30)`) ไม่ต้องเพิ่ม field/query ใหม่เลย
      เพราะ `prReps` มีอยู่แล้วใน `ExerciseStat` (แค่ไม่เคยเอามาใช้) — **ซ่อนบรรทัดนี้ถ้า `prReps === 1`**
      เพราะตอนนั้น PR ที่บันทึกไว้คือ 1RM ที่ยกได้จริงอยู่แล้ว ไม่ใช่แค่ตัวเลขซ้ำ: สูตร Epley ไม่ลดรูปเป็น
      น้ำหนักเดิมพอดีที่ reps=1 (ให้ weight × 31/30 สูงกว่าความจริงเล็กน้อย) โชว์คู่กันจะทำให้เข้าใจผิดว่า
      ยกได้หนักกว่าที่ยกจริง — ทดสอบยืนยันจริงด้วยการ seed ท่าเบนช์เพรสที่ทำ PR 90 กก. × 3 ครั้ง แล้วเปิด
      หน้าสถิติสูงสุดจริง เห็น "90 กก. × 3" คู่กับ "~99 กก. (1RM ประมาณ)" ต่อท้ายตามสูตร (90 × 1.1 = 99)
    - **กราฟเทรนด์น้ำหนักต่อท่า (progressive overload)** — แต่ละแถวในลิสต์ "PR ท่าออกกำลังกาย" ที่หน้า
      สถิติสูงสุดมีกราฟเส้นเล็ก ๆ ต่อท้ายใต้แถวเดิม (`ExerciseProgressionChart`,
      `src/app/dashboard/records/exercise-progression-chart.tsx`) โชว์น้ำหนักสูงสุดต่อครั้งที่ทำท่านั้น
      ไล่ตามเวลา — **ตั้งใจเป็นเส้นตรงเชื่อมจุดต่อจุด ไม่ใช่บันไดแบบ `PrProgressionChart`**
      (`pr-progression-chart.tsx`, ใช้กับสถิติระยะทาง/ความเร็วต่อประเภทกิจกรรมที่หน้าเดียวกัน — ขึ้นอย่าง
      เดียวแล้วค้างแบบขั้นบันไดเพราะเป็น "สถิติดีที่สุดตลอดกาล" ล้วน ๆ) เพราะ progressive overload จริง ๆ
      มีขึ้นมีลงได้ตามธรรมชาติ (deload week/วันที่ทำไม่ไหว/warm-up หนัก) กราฟแบบบันไดจะกลบดิปจริงให้ดูเหมือน
      "ค้างเท่าเดิม" ทั้งที่จริงลดลง ไม่ตรงกับที่เกิดขึ้นจริง
      - **`getExerciseStats()` (`src/lib/exercise-stats.ts`) เพิ่ม field `history:
        ExerciseSessionPoint[]`** ต่อท้าย `ExerciseStat` เดิม (`{ atMs, maxWeightKg, totalVolumeKg }`
        หนึ่งจุดต่อหนึ่งครั้งที่ทำท่านั้น เรียงเก่า→ใหม่, `maxWeightKg` เป็น `null` ถ้าครั้งนั้นเป็น
        bodyweight ล้วนไม่มีน้ำหนักให้พล็อต) — คำนวณในลูปเดิมที่ทำ `latestSets`/`prWeightKg` อยู่แล้ว
        (single pass เดิม ไม่เพิ่ม query ใหม่) โดยอาศัย guarantee เดิมของ query นี้อยู่แล้วว่าแถวของชื่อท่า
        เดียวกันมาตามลำดับเวลาเก่า→ใหม่เสมอ (แม้จะสลับกับท่าชื่ออื่นในสตรีมเดียวกัน) — จุดที่ `history`
        ตัดขอบ "ครั้ง" (session) ใช้ id ของ `Exercise` row เดิมที่ตัดสิน `latestSets` อยู่แล้ว
        (`_latestExerciseId` เปลี่ยน = ข้ามไปอีกครั้งแล้ว, flush ครั้งก่อนหน้าเข้า `history` ก่อนรีเซ็ต
        ตัวสะสม) บวก flush ท้ายลูปอีกรอบสำหรับครั้งล่าสุดที่ยัง "เปิด" ค้างอยู่ตอนลูปจบ (ไม่งั้นครั้งล่าสุด
        จะหายไปจาก `history` เพราะไม่มีแถวถัดไปมา trigger boundary ให้)
      - **หน้าสถิติสูงสุด (`records/page.tsx`) กรองเอาเฉพาะจุดที่ `maxWeightKg !== null` มาพล็อต** (ครั้งที่
        เป็น bodyweight ล้วนคั่นอยู่ระหว่างสองครั้งที่มีน้ำหนักไม่นับเป็นจุดข้อมูลของเทรนด์น้ำหนักเลย ไม่ใช่
        พล็อตเป็น 0) — กราฟโชว์แค่ตอนมี ≥2 จุด (จุดเดียวไม่มีอะไรให้เทียบ, `ExerciseProgressionChart`
        คืน `null` เอง) พร้อมส่วนต่างจุดแรก-จุดสุดท้าย (สีเขียวถ้าเพิ่ม/แดงถ้าลด, **ซ่อนถ้าเท่าเดิม**
        ตามธรรมเนียมเดียวกับที่แถบโบนัสกิจกรรมไม่โชว์ "+0 kcal") สีเส้น `#8b5cf6` (violet-500 — สีเดิม
        ของหมวด `WeightTraining` ตาม `src/lib/activity-colors.ts`'s `LIFT`, เอามาใช้ตรง ๆ เป็น hex เพราะ
        เป็น SVG stroke color ไม่ใช่ class ของ Tailwind ที่ apply ไม่ได้ในนั้น) — แถว "PR ท่าออกกำลังกาย"
        แต่ละแถวเปลี่ยนจาก `<Link>` เป็นแถว `<div>` (Link ยังอยู่ข้างในครอบแค่ส่วนชื่อ/วันที่/น้ำหนัก PR
        เดิม ไปหน้ารายละเอียดกิจกรรมที่ทำ PR ได้เหมือนเดิม) เพราะกราฟใหม่วางต่อท้ายนอก `<Link>` เดิม
        (ไม่ใช่ element ที่กดแล้วนำทางไปไหน)
      - เทสอยู่ที่ `exercise-stats.test.ts`: ยืนยัน `history` มีขึ้น-ลงจริง (60→40 deload→70, ไม่ใช่แค่
        บันไดขึ้นอย่างเดียว), จุดที่เป็น bodyweight-only ได้ `maxWeightKg: null` โดยไม่กระทบครั้งถัดไป,
        และการ flush ครั้งสุดท้ายที่ยัง "เปิด" อยู่ตอนลูปจบทำงานถูกต้อง (ไม่ใช่แค่ตอนมีครั้งถัดมา trigger
        boundary) — ทดสอบจริงด้วยการ seed ท่าสควอท 3 ครั้ง (60 กก. → 40 กก. deload → 65/70 กก.) แล้วเปิด
        หน้าสถิติสูงสุดจริง เห็น SVG path เส้นลง-ขึ้นจริงตรงกับข้อมูล (จุดกลางต่ำสุด ไม่ใช่กราฟขั้นบันได
        ที่จะค้างที่ 60 แล้วขึ้น 70 โดยไม่มีดิป) พร้อมส่วนต่าง "+10.0 กก." สีเขียว ตรวจสอบซ้ำด้วย query
        Prisma ตรง ๆ ว่าข้อมูลดิบตรงกับที่กราฟพล็อต
    - **ที่หน้า "ความสำเร็จ"** (`/dashboard/achievements`) — เพิ่มหมุดหมาย "น้ำหนักสะสมที่ยกได้"
      (`getTotalLiftVolumeKg(userId)` ใน `src/lib/exercise-stats.ts`, thresholds
      `LIFT_VOLUME_MILESTONES_KG` ใน `src/lib/achievements.ts`) ต่อจาก 3 หมุดหมายเดิม
      (ระยะทางสะสม/จำนวนกิจกรรม/สตรีค) ใช้ `AchievementSection` ตัวเดียวกันไม่ต้องสร้าง component
      ใหม่ — คำนวณจาก Σ น้ำหนัก×ครั้ง×เซ็ท ของทุกเซ็ทที่เคยบันทึก (ข้ามท่า bodyweight-only ที่ไม่มี
      น้ำหนักเหมือนตอนคำนวณ PR) ตั้งใจใช้ "น้ำหนักสะสม" แทน "จำนวนท่าที่ทำ PR" เพราะยังไงก็โตขึ้นเรื่อย ๆ
      ทุกครั้งที่บันทึก ไม่ต้องมีท่าหลากหลายถึงจะไต่หมุดหมายได้ (คนที่เล่นซ้ำแค่ไม่กี่ท่าก็ยังลุ้นได้
      เหมือนสายวิ่งที่ไต่ "ระยะทางสะสม") — เดิมข้อความบนหน้านี้ยังพูดถึง "ซิงค์" (เศษจากยุค Strava sync)
      แก้เป็น "บันทึกกิจกรรม" ให้ตรงกับที่แอพทำงานจริงแล้ว — เพิ่มส่วน **"PR ท่าเวท"** ต่อท้ายอีกที
      (`exercise-pr-badges.tsx`, `ExercisePrBadges`) เป็น badge รายชื่อท่า ไม่ใช่ threshold ladder แบบ
      section อื่น เพราะไม่รู้ล่วงหน้าว่าผู้ใช้จะลองท่าอะไรบ้าง เลยไม่มี "locked placeholder" ให้โชว์แบบ
      section อื่น — badge ทุกอันโชว์เป็น "ปลดล็อกแล้ว" (🏅) เสมอเพราะแค่มี PR ก็ถือว่าได้มาแล้ว เรียง
      ตามเวลาที่ทำ PR ล่าสุดมาก่อน (ไม่ใช่เรียงตามตัวอักษรแบบ "PR ท่าออกกำลังกาย" ที่หน้าสถิติสูงสุด)
      ตั้งใจให้อ่านเหมือน feed "เพิ่งทำอะไรสำเร็จ" มากกว่า reference list — ซ่อนทั้ง section ไปเลยถ้ายัง
      ไม่มี PR ท่าไหนเลย (ไม่โชว์ empty state เหมือน section อื่น เพราะไม่มีอะไรที่มีความหมายจะโชว์)
      `BadgeChip` export มาจาก `achievement-section.tsx` ให้ใช้ร่วมกันได้ — **แต่ละ badge โชว์ "1RM
      ประมาณ" ต่อท้ายด้วยเหมือนหน้าสถิติสูงสุด** (`estimateOneRepMaxKg`, ซ่อนถ้า `reps === 1` ด้วยเหตุผล
      เดียวกันทุกอย่าง — ดูบล็อก "1RM ประมาณ" ที่หน้าสถิติสูงสุดด้านบน) `ExercisePrBadges`'s prop
      `exercises` เพิ่ม `reps: number` เข้าไปเพื่อคำนวณ (page.tsx ส่ง `s.prReps` เข้ามาด้วยตอน map จาก
      `exerciseStats` — เดิมส่งแค่ `name`/`weightKg`/`activityId`)
    - **แต่ละเซ็ทเก็บ reps/น้ำหนักแยกกันได้ (ไม่บังคับเท่ากันทุกเซ็ท)** — เดิม `Exercise` เก็บ
      `sets: Int`/`reps: Int`/`weightKg: Float?` เป็น scalar 3 ช่อง สมมติว่าทุกเซ็ทของท่านั้นในครั้งนั้น
      ทำจำนวนครั้ง/น้ำหนักเท่ากันหมด ใช้ไม่ได้กับพีระมิด/drop set ที่แต่ละเซ็ทลดน้ำหนัก/จำนวนครั้งลง
      (เช่น เซ็ท 1: 15 ครั้ง @ 5 กก., เซ็ท 2: 14 ครั้ง @ 5 กก., เซ็ท 3: 10 ครั้ง @ 4 กก.) ตอนนี้แยกเป็น
      ตารางลูก `ExerciseSet` (`exerciseId`, `order`, `reps`, `weightKg`) — หนึ่งแถวต่อหนึ่งเซ็ทจริง ๆ
      (`Exercise` เหลือแค่ `name`/`order` + ผูก `sets ExerciseSet[]`) มี migration
      `20260914090000_exercise_sets` ที่ backfill ข้อมูลเก่าด้วย recursive CTE (ขยาย `sets: Int` เดิม
      ของแต่ละ `Exercise` ให้กลายเป็น N แถว `ExerciseSet` โดยใช้ `reps`/`weightKg` เดิมซ้ำทุกแถว เพราะ
      ข้อมูลเก่าไม่มีทางรู้ว่าแต่ละเซ็ทต่างกันจริงมั้ย) ก่อน drop คอลัมน์เก่าทิ้ง — **ต้องรัน
      `npx prisma migrate deploy` ก่อน deploy โค้ดรอบนี้เสมอ ไม่งั้น query จะพังเพราะคอลัมน์/ตารางไม่ตรง
      กับโค้ดใหม่** (migration มี backfill อัตโนมัติในตัว ไม่ต้องรันสคริปต์แยก)
      - `POST /api/activity/manual` และ `PATCH /api/activity/[id]` สร้าง `Exercise` พร้อม nested
        `sets: { create: [...] }` ในคำสั่งเดียว — PATCH ยังคงลบ `Exercise` เก่าทั้งหมดแล้วสร้างใหม่เหมือน
        เดิม (ไม่ diff ทีละแถว) `ExerciseSet` เก่าถูกลบไปเองผ่าน `ON DELETE CASCADE` ที่ประกาศไว้ใน
        migration SQL ไม่ต้องลบเองในโค้ด
      - `getExerciseStats` (`src/lib/exercise-stats.ts`) query `db.exerciseSet.findMany` ตรง ๆ (join ผ่าน
        `exercise.activity.userId`) เรียงตาม `[activity.startedAt, exercise.order, set.order]` แล้ววน
        สแกนทีละเซ็ท ใช้ id ของ `Exercise` ปัจจุบันเทียบกับรอบก่อนหน้าเพื่อรู้ว่าเซ็ทที่กำลังดูยังอยู่ใน
        "ครั้งล่าสุด" เดียวกันอยู่หรือข้ามไปยังครั้งก่อนหน้าแล้ว (`latestSets` เป็น array ทั้งชุดของครั้ง
        ล่าสุด ไม่ใช่ scalar เดี่ยวแบบเดิม) ส่วน PR ยังคงหาน้ำหนักสูงสุดจากทุกเซ็ทเหมือนเดิม (แค่ตอนนี้
        สแกนทีละแถว `ExerciseSet` แทนทีละแถว `Exercise`) — `getTotalLiftVolumeKg` รวม
        `weightKg × reps` ตรงจากแต่ละแถว `ExerciseSet` (ไม่ต้องคูณ `sets` แยกอีกต่อไปเพราะแต่ละแถวคือ
        1 เซ็ทอยู่แล้ว)
      - ฟอร์มบันทึก/แก้ไขกิจกรรม (`log-activity-form.tsx`) แต่ละท่ามีปุ่ม "+ เพิ่มเซ็ท" เพิ่มแถวเซ็ทย่อยได้
        ไม่จำกัด (ลบทีละเซ็ทได้ ปุ่มลบ disable ถ้าเหลือเซ็ทเดียว กันไม่ให้ท่านั้นไม่มีเซ็ทเลย) กล่อง
        "ครั้งก่อน" เปลี่ยนจากโชว์ "N เซ็ท × M ครั้ง @ W กก." บรรทัดเดียวเป็นสรุปทุกเซ็ทแบบย่อ
        (`formatSetsCompact`, เช่น "15×5กก., 14×5กก., 10×4กก.") ปุ่ม "ใช้ค่านี้" แทนที่เซ็ททั้งชุดของแถว
        ปัจจุบันด้วยเซ็ททั้งหมดของครั้งล่าสุด (ไม่ใช่แค่ก็อปตัวเลข 3 ช่องแบบเดิม)
      - **นำเข้าจาก AI (`activity-import-parse.ts`) อ่านค่าจริงทีละเซ็ทได้แล้ว** (แก้ตามคำขอผู้ใช้ในรอบถัดมา
        จากตอนสร้างฟีเจอร์นี้ — เดิมตั้งใจปล่อยไว้นอกขอบเขต) prompt template เปลี่ยนจากขอ 1 แถวต่อ 1 ท่า
        (คอลัมน์ "เซ็ท" = จำนวนเซ็ทรวม) เป็น **1 แถวต่อ 1 เซ็ทที่ทำจริง** รูปแบบ
        "ชื่อท่า | เซ็ทที่ | ครั้ง | น้ำหนัก(กก.) | RPE" (คอลัมน์ "เซ็ทที่" เป็นแค่เลขลำดับให้คนอ่านง่าย
        ตัว parser ไม่ได้ใช้ค่านั้นเลย ใช้ลำดับแถวแทน) — `parseExerciseSetLine`
        (เดิมชื่อ `parseExerciseLine`) parse แต่ละแถวเป็นหนึ่งเซ็ท แล้ว `parseActivityText` gruop เข้า
        ด้วยกันตามชื่อท่า (trim+lowercase เหมือน `getExerciseStats`) ผ่าน `Map` ที่รักษาลำดับการเจอชื่อ
        ครั้งแรก **ไม่ได้กรุ๊ปเฉพาะแถวติดกัน** — รองรับกรณี AI สลับสองท่าแทรกกันด้วย ทำให้พีระมิด/drop set
        ได้ค่าจริงต่อเซ็ท (15×5, 14×5, 10×4) ไม่ใช่ค่าเดียวขยายซ้ำแบบเดิมอีกต่อไป — `applyParsedText`
        ที่ฟอร์ม (`log-activity-form.tsx`) เลย map ตรง ๆ จาก `parsed.exercises[].sets[]` ได้เลยไม่ต้อง
        ขยายเองแล้ว **breaking change ของรูปแบบข้อความที่ paste เข้ามา** — คำตอบ AI เก่าที่เคย copy ไว้ตาม
        prompt แบบเดิม (คอลัมน์ 2 = จำนวนเซ็ทรวม) จะ parse ผิดถ้าเอามา paste ซ้ำตอนนี้ (คอลัมน์ 2 จะถูกอ่าน
        เป็นเลขเซ็ทที่แทน ไม่กระทบอะไรเพราะไม่ได้ใช้ค่านั้นอยู่แล้ว แต่จำนวนเซ็ทที่เคยได้จากตัวคูณจะหายไป
        เหลือแค่ 1 เซ็ทต่อ 1 แถว) — ไม่ใช่ปัญหาจริงเพราะปุ่ม "คัดลอกคำสั่งสำหรับถาม AI" สร้าง prompt ใหม่ทุก
        ครั้งที่กด ไม่มีใครเก็บ prompt เก่าไว้ใช้ซ้ำ
    - **RPE (Rate of Perceived Exertion) — คนละความหมายกันระหว่างเวทกับคาร์ดิโอ เลยแยกเป็น 2 field
      คนละโมเดล** อ้างอิงจาก Google Sheet ที่ผู้ใช้ส่งมาดู: `ExerciseSet.rpe` (nullable Float, 1-10
      แบบครึ่งจุดได้ เช่น 7.5, 8.5) คือ RPE รายเซ็ทของท่าเวท ความหมายแบบ "เหลือแรงยกได้อีกกี่ที"
      (reps-in-reserve — 10 = ยกไม่ไหวแล้ว, 9 ≈ เหลืออีก 1 ที) ส่วน `Activity.rpe` (nullable Float,
      1-10 แบบครึ่งจุดได้เหมือนกัน) คือ RPE ของกิจกรรมทั้งครั้งโดยรวม ความหมายแบบ Borg/talk-test
      (หายใจ/พูดคุยได้แค่ไหนระหว่างทำ) ใช้กับกิจกรรมคาร์ดิโอเป็นหลัก (วิ่ง/ปั่น/เดิน/ว่ายน้ำ ฯลฯ) แต่
      field เปิดให้ทุกประเภทกิจกรรม ไม่ได้ผูกกับ `type` ที่ schema — ทั้งสอง field validate ผ่าน
      `optionalRpe()` ตัวเดียวกัน (`src/lib/activity-validation.ts`, รับเฉพาะ 1-10 ที่เป็นจำนวนเต็มหรือ
      ครึ่งจำนวนเต็มเท่านั้น — เช็คด้วย `Number.isInteger(n * 2)`, ค่านอกช่วง/ไม่ตรงขั้นครึ่งจุดทำให้
      request ทั้งก้อนพังเหมือน field optional อื่น ๆ) — **เจอบั๊กจริงจากการใช้งาน 2 รอบติดกันในฟีเจอร์นี้**:
      รอบแรก field เดิมเป็น `Int` (จำนวนเต็มล้วน) แต่ช่อง RPE ทั้งสองจุดในฟอร์ม (`log-activity-form.tsx`)
      เป็น `<input type="number" min="1" max="10">` ไม่มี `step` เลย ทำให้พิมพ์ทศนิยมได้ (เช่น `8.5`)
      ผ่านหน้าฟอร์มเงียบ ๆ พอกด "บันทึกกิจกรรม" แล้วไปโดน server reject (400 `invalid_optional_field`)
      — ฝั่ง client จับ error แบบรวม ๆ (`res.ok` เป็น false ก็โชว์แค่ "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง"
      ไม่บอกว่าฟิลด์ไหนพัง) ทำให้ debug ยากมาก ต้องไล่ทีละฟิลด์เอง — แก้รอบแรก: เพิ่มเช็ค client-side ใน
      `save()` ก่อนยิง request ให้ขึ้น error message เจาะจง + เพิ่ม `step="1"` กันพิมพ์ทศนิยม — **ผู้ใช้แจ้ง
      ต่อว่าอยากให้กรอกครึ่งจุด (`.5`) ได้จริง ๆ (แค่ `.1`/`.2` ไม่ต้อง)** เพราะสเกล RPE ที่ใช้กันจริงมีค่า
      ครึ่งจุดอยู่แล้ว (เช่น "7.5" ระหว่าง 7 กับ 8) รอบสองเลยเปลี่ยนดีไซน์จริง ไม่ใช่แค่กันพิมพ์ผิด:
      `Activity.rpe`/`ExerciseSet.rpe` เปลี่ยนจาก `Int?` เป็น `Float?` ใน schema (migration
      `20260916090000_rpe_half_steps`, `MODIFY` คอลัมน์เป็น `DOUBLE`, ไม่มี backfill เพราะค่าเก่าทุกแถว
      เป็นจำนวนเต็มอยู่แล้วแปลงตรงได้ไม่มีปัญหา) `optionalRpe()` เปลี่ยนจาก `Number.isInteger(n)` เป็น
      `Number.isInteger(n * 2)` (0.5 แทนค่าตรงในเลขฐานสองพอดี เลยไม่มีปัญหา floating-point rounding)
      ช่อง input ทั้งสองจุดเปลี่ยน `step="1"` เป็น `step="0.5"`, ข้อความ error ฝั่ง client เปลี่ยนเป็น
      "ต้องเป็นจำนวนเต็มหรือครึ่ง (เช่น 7, 7.5) ระหว่าง 1-10" — **นำเข้าจาก AI ก็ต้องแก้ตาม**: RPE รายเซ็ท
      (`parseExerciseSetLine` ใน `activity-import-parse.ts`) เดิม `Math.round(rpe)` ปัดเป็นจำนวนเต็มเสมอ
      ไม่ว่า AI จะตอบอะไรมา เปลี่ยนเป็น `Math.round(rpe * 2) / 2` ปัดเข้าขั้นครึ่งจุดที่ใกล้สุดแทน — ส่วน
      RPE กิจกรรมทั้งครั้ง (อ่านผ่าน `FIELD_MATCHERS`/`firstNumber` ธรรมดา) ไม่มีการปัดอยู่แล้วตั้งแต่แรก
      เลยไม่ต้องแก้จุดนั้น — **ข้อความ error รวม ๆ แบบ "บันทึกไม่สำเร็จ" ยังเป็นปัญหากับ field
      optional ตัวอื่นที่ validate ผ่าน server เท่านั้น** (distanceKm/avgHeartRate/maxHeartRate/calories/
      avgCadence ผ่าน `optionalNonNegative()`) ถ้าเจอ report "บันทึกไม่สำเร็จ" อีกในอนาคตให้สงสัยฟิลด์
      พวกนี้ก่อนเป็นอันดับต้น ๆ เช่นกัน — ยังไม่ได้ทำ client-side validation ให้ครบทุกฟิลด์ในรอบนี้ เพราะ
      เจอแค่ RPE ที่เป็นปัญหาจริงจากการใช้งาน)
      - **ไม่มี "เซ็ทวอร์มอัพ" แยกประเภทในระบบ** — ผู้ใช้ (ที่ส่ง sheet มา) ยืนยันว่าไม่ต้องการแยก
        เซ็ทวอร์มอัพออกจากเซ็ทจริงด้วย flag พิเศษ ตั้งใจปล่อยให้วอร์มอัพเป็นแค่เซ็ทธรรมดาที่น้ำหนักเบา
        กว่า (บันทึกเป็นเซ็ทแรก ๆ ของท่านั้นในฟอร์มได้เลย) เพราะ `ExerciseSet` รองรับจำนวนเซ็ทไม่จำกัด
        อยู่แล้ว (ดูข้างบน) — volume สะสม (`getTotalLiftVolumeKg`) และ PR เลยนับรวมเซ็ทวอร์มอัพไปด้วย
        โดยตั้งใจ ไม่ใช่บั๊ก
      - ฟอร์มบันทึก/แก้ไขกิจกรรม (`log-activity-form.tsx`) — แต่ละแถวเซ็ทของท่าเวทมีช่อง RPE เพิ่มเป็น
        คอลัมน์ที่ 4 ในกริด (เซ็ท/ครั้ง/น้ำหนัก/RPE/ลบ) กล่อง "ครั้งก่อน"
        (`formatSetsCompact`) ต่อท้าย "(RPE N)" ให้แต่ละเซ็ทถ้ามีค่า ปุ่ม "ใช้ค่านี้" คัดลอก RPE
        มาด้วยเหมือน reps/weightKg — ส่วน RPE ของกิจกรรมทั้งครั้งอยู่ในช่อง "ข้อมูลเพิ่มเติม" คู่กับ
        หัวใจ/แคลอรี่/ระยะทาง (ช่องเดียว ไม่ใช่ต่อเซ็ท เพราะเป็นกิจกรรมทั้งครั้ง)
      - **นำเข้าจาก AI รองรับทั้ง RPE ของกิจกรรมทั้งครั้งและ RPE รายเซ็ท** — RPE กิจกรรมทั้งครั้งอ่านจาก
        field matcher (คีย์เวิร์ด `ระดับความเหนื่อย`/`RPE`) เหมือนฟิลด์อื่น ๆ, RPE รายเซ็ทอ่านจากคอลัมน์ที่
        5 (ตัวสุดท้าย, ไม่บังคับ) ของตาราง "ชื่อท่า | เซ็ทที่ | ครั้ง | น้ำหนัก | RPE" — **เดิมตั้งใจไม่ทำ
        RPE รายเซ็ทเพราะมองว่าเป็นความรู้สึกส่วนตัวขณะเล่นจริง ไม่มีทางอ่านจากรูปได้ แต่ผู้ใช้ขอเพิ่มในรอบ
        ถัดมา** เหตุผลคือถ้าแหล่งรูปเป็นภาพถ่ายสมุด/ชีทบันทึกที่ผู้ใช้จดค่า RPE ไว้เองอยู่แล้ว (ไม่ใช่แค่
        สรุปจากนาฬิกา) AI อ่านตัวเลขที่เขียนไว้ในรูปได้ตรง ๆ เหมือนอ่าน reps/น้ำหนัก — prompt ก็แค่บอกให้
        เว้นคอลัมน์ RPE ว่างถ้ารูปไม่ได้บอกไว้ (ไม่ auto-fill ค่าเดาเอง เหมือน field optional อื่น ๆ)
      - **คำอธิบายแต่ละระดับ RPE (1-10)** — `RpeLevelsGuide` (`log-activity-form.tsx`) เป็นกล่อง
        `<details>`/`<summary>` แตะเพื่อขยาย วางไว้ข้างช่องกรอกทั้งสองจุด (RPE กิจกรรมทั้งครั้ง, RPE
        รายเซ็ท) — ตั้งใจไม่ใช้แค่ `title` tooltip เพราะ hover ใช้ไม่ได้บนมือถือ ต้องแตะดูได้จริงถึงจะ
        ถือว่า "อธิบายชัด ๆ" ตามที่ผู้ใช้ขอ — เนื้อหาสองชุดแยกกันเพราะความหมายคนละสเกล (ดูข้างบน):
        `RPE_CARDIO_LEVELS` ใช้ scale แบบ Borg/talk-test (หายใจ/พูดคุยได้แค่ไหน — อ้างอิงจาก scale ที่
        ผู้ใช้ส่งภาพหน้าจอนาฬิกามาให้ดู) ครบ 10 ระดับ, `RPE_LIFT_LEVELS` ใช้ reps-in-reserve (เหลือแรงยก
        ได้อีกกี่ครั้ง) ย่อเป็นช่วง (5-6, 1-4) แทนแยกทีละเลขเพราะความละเอียดระดับนั้นไม่มีความหมายจริง
        สำหรับสายเวท — ทั้งคู่ export เป็น const array ระดับโมดูล ไม่ผูกกับ component ไหนเป็นพิเศษ
        เผื่อเอาไปใช้ที่อื่นในอนาคต (เช่น หน้า `/dashboard/knowledge`)
      - **ปุ่ม "ทำซ้ำทั้งวันจากครั้งก่อน"** (`getLastWorkoutSession(userId, excludeActivityId?)` ใน
        `src/lib/exercise-stats.ts`) — คนละแบบกับ `getExerciseStats`/"ครั้งก่อน" ที่ fold ตาม**ชื่อท่า**
        ข้ามหลายกิจกรรม อันนี้ดึง**กิจกรรมทั้งครั้งล่าสุด**ที่มีท่าเวทอย่างน้อย 1 ท่า
        (`where: { exercises: { some: {} } }`, `orderBy: startedAt desc`) คืนทุกท่า+ทุกเซ็ทตามลำดับที่
        บันทึกไว้เป๊ะ — ใช้แก้ปัญหาที่ต้องกด "ใช้ค่านี้" ทีละท่าเวลาวันนี้ทำซ้ำรูทีนเดิมทั้งวัน (จากรีวิว
        Google Sheet ของผู้ใช้ที่เห็นรูปแบบวันคล้ายเดิมซ้ำ ๆ บ่อย) แสดงเป็น banner เหนือปุ่ม "+ เพิ่มท่า"
        **เฉพาะตอน `exercises.length === 0` เท่านั้น** (กันไม่ให้เผลอเขียนทับแถวที่ผู้ใช้เริ่มกรอกเองไปแล้ว
        — เหมือน pattern "ครั้งก่อน" เดิมที่ต้องกดยืนยันเองเสมอ ไม่ auto-apply) ทั้งสองหน้า
        (`/dashboard/log-activity`, `/dashboard/activity/[id]/edit`) ต้องส่ง prop `lastWorkoutSession`
        ให้ฟอร์มเสมอ ไม่งั้น banner จะไม่โผล่เลย (prop optional/default `null` กันพังถ้าลืมส่ง) — หน้าแก้ไข
        ส่ง `excludeActivityId` เหมือน `getExerciseStats` เพื่อไม่ให้กิจกรรมที่กำลังแก้เสนอ "ทำซ้ำ" ตัวเอง
      - Migration `20260914100000_rpe` เพิ่มคอลัมน์ nullable ล้วน ทั้งสอง field ไม่มี backfill (กิจกรรม/
        เซ็ทเก่าก่อนหน้านี้ไม่มี RPE อยู่แล้ว `NULL` คือค่าที่ถูกต้องสำหรับของเก่าทุกแถว)
  - **ไม่มีการ์ด "สรุปกิจกรรมทั้งหมด" (ยอดสะสมตลอดกาล) อยู่บนหน้าแรกแล้ว** — ลบออกเพราะเป็นตัวเลข
    เดียวกับที่หน้า "สถิติสูงสุด" (`/dashboard/records`) โชว์อยู่แล้วเป๊ะ (มีปุ่มลัดไปหน้านั้นอยู่
    เหนือขึ้นไปนิดเดียว) แถมเป็นยอดสะสมตลอดกาลที่ไม่ actionable ไม่ควรเป็นสิ่งแรกที่เห็นก่อน
    `HealthSummary` (แคลอรี่/น้ำ/น้ำหนักวันนี้ ซึ่งเปลี่ยนทุกวันและใช้งานได้จริงกว่า) — `stats`
    aggregate query บนหน้านี้เลยเหลือแค่ `_count._all` (ใช้เช็ค onboarding/empty-state) ไม่ต้อง
    `_sum` แล้ว
  - **"ความสม่ำเสมอ" (`ActivityHeatmap`, `src/app/dashboard/activity-heatmap.tsx`) ไม่มีกริดสี่เหลี่ยม
    52 สัปดาห์แบบ GitHub แล้ว** — เดิมช่องเล็ก 11px ต้องเลื่อนซ้ายขวาดูบนมือถือ อ่านยาก แถมตัวเลข
    "ติดต่อกัน X วัน" ก็โชว์อยู่แล้วในหัวหน้า (ข้าง avatar/คำทักทาย) ซ้ำกับที่กริดจะบอก ตอนนี้เหลือแค่
    การ์ดบรรทัดเดียวโชว์ "ติดต่อกัน X วัน / สูงสุด Y วัน" (`streaks.current`/`streaks.longest`) ไม่มี
    กริดวันต่อวันแล้ว — `buildHeatmapDays`/`computeStreaks` (`activity-heatmap.tsx` เดิม) ยังอยู่เหมือนเดิม
    เพราะยังต้องใช้คำนวณ streak ทั้งที่หน้านี้และหน้าความสำเร็จ (`/dashboard/achievements`) แค่
    `ActivityHeatmap` component ไม่รับ `days` prop มาวาดกริดอีกต่อไป (เหลือรับแค่ `streaks`)
  - หน้าแรก (`/dashboard`) มีบล็อก "สัดส่วนกิจกรรมเดือนนี้" (`type-breakdown.tsx`, อยู่ในส่วน
    "สถิติและแนวโน้มเพิ่มเติม" — `CollapsibleSection` ที่ยุบ/ขยายได้ แต่ตัวนี้ตั้ง `defaultOpen`
    ไว้ให้กางออกมาให้เห็นเองตั้งแต่โหลดหน้า ไม่ต้องกดขยายก่อนเหมือนตอนที่ component ถูกสร้างมาแรก ๆ)
    เทียบสัดส่วนตามประเภทกิจกรรม —
    **เทียบด้วยเวลา (`durationSec`) หรือแคลอรี่ (`calories`) แบบสลับแท็บได้ ไม่ใช่ระยะทางแบบเดิม**
    เพราะเทียบด้วยระยะทางทำให้กิจกรรมที่ไม่มีระยะทางโดยธรรมชาติ (เวทเทรนนิ่ง) โชว์ 0% เสมอไม่ว่าจะ
    ทำหนักแค่ไหน แถมเทียบข้ามประเภทกิจกรรมด้วยระยะทางอย่างเดียวก็ไม่แฟร์ (เดิน 15 กม. กับวิ่ง 3.7 กม.
    ใช้แรงคนละแบบ) — เวลาเลือกเป็นค่าเริ่มต้นเพราะ `durationSec` เป็น field บังคับมีครบทุกกิจกรรม
    ส่วนแคลอรี่เป็น field optional (ไม่มีสูตรประมาณอัตโนมัติ/MET ในแอพเลย ต้องพิมพ์เองตอนบันทึกหรือมา
    จาก Strava sync เก่า) ถ้ามีกิจกรรมบางอันไม่ได้กรอกแคลอรี่ไว้ แท็บแคลอรี่จะโชว์ข้อความบอกว่า
    "คำนวณจาก N ใน M กิจกรรม" แทนที่จะทำเหมือนข้อมูลครบ และถ้าเดือนนั้นไม่มีกิจกรรมไหนกรอกแคลอรี่ไว้
    เลยแท็บนี้จะกดไม่ได้ (disabled)
- **CSV export กิจกรรม** (`GET /api/export/csv`, ปุ่มดาวน์โหลดที่หน้าแรก) — คืนไฟล์พร้อม UTF-8 BOM
  (`"﻿" + csv`) นำหน้าเสมอ ไม่งั้น Excel บน Windows (deploy target จริง ดู `DEPLOY-WINDOWS.md`)
  จะเดาว่าไฟล์เป็น Windows-1252 แล้วชื่อกิจกรรม/หมายเหตุภาษาไทยจะเพี้ยนเป็นตัวอักษรมั่ว — `csvEscape()`
  quote ทั้ง `\r`/`\n`/`"` (เดิม regex เช็คแค่ `\n`/`"` ไม่ครอบ `\r` เดี่ยว ๆ ที่ไม่มี `\n` ตามหลัง ซึ่งยัง
  ทำให้แถวแตกใน spreadsheet ได้เหมือนกัน)
- Water/Weight logging: `src/app/api/water|weight/log*`, การ์ดอยู่ทั้งในไดอารี่ (น้ำ) และเชิงลึก
  (น้ำหนัก) — `POST /api/weight/log` (การ์ดน้ำหนักที่หน้าเชิงลึก) เขียนทั้ง `WeightLog` ใหม่ + อัปเดต
  `User.weightKg` คู่กันเสมอ **`POST /api/settings/nutrition-profile` (ฟอร์มโปรไฟล์ที่หน้าตั้งค่า ซึ่งก็มี
  ช่องน้ำหนักเป็น input บังคับสำหรับคำนวณ BMR เหมือนกัน) ก็ต้องเขียน `WeightLog` ด้วยถ้าค่าน้ำหนักเปลี่ยน
  จริง ๆ ไม่ใช่แค่อัปเดต `User.weightKg` อย่างเดียวเงียบ ๆ แบบเดิม** (แก้บั๊กที่เจอจาก audit: เดิม field
  นี้อัปเดตแค่ `User.weightKg` โดยไม่เคยสร้าง `WeightLog` เลย ทำให้กราฟน้ำหนักที่หน้าเชิงลึกขาดจุดข้อมูล
  ทุกครั้งที่คนแก้น้ำหนักผ่านฟอร์มนี้แทนการ์ดน้ำหนักโดยตรง) — **สร้าง `WeightLog` เฉพาะตอนค่าน้ำหนักที่ส่งมา
  ต่างจาก `User.weightKg` เดิมจริง ๆ เท่านั้น** (เทียบค่าก่อนแล้วค่อย `db.$transaction` สร้าง `WeightLog` +
  update `User` พร้อมกัน) ไม่ใช่สร้างทุกครั้งที่กด "บันทึก" แบบไม่มีเงื่อนไข เพราะฟอร์มนี้เป็นฟอร์มโปรไฟล์
  ทั่วไปที่คนอาจกดบันทึกแค่เพื่อแก้ field อื่น (เช่น activity level) โดยไม่ได้ตั้งใจ "log น้ำหนักวันนี้"
  ถ้าสร้างทุกครั้งไม่มีเงื่อนไข กราฟจะเต็มไปด้วยจุดซ้ำ ๆ ค่าเดิมทุกครั้งที่แก้โปรไฟล์เรื่องอื่น
- Supplements: `/dashboard/supplements`, checklist รายวันจาก `SupplementLog`
- Push notifications: `src/lib/push.ts` + `src/app/api/cron/{water-reminder,whey-reminder,weekly-summary}` —
  ต้องมี `PushSubscription` และ flag ที่เกี่ยวข้องเปิดอยู่ทั้งคู่ (ดู comment ใน schema)
  - **`cron/water-reminder`'s atomic claim (`lastWaterReminderSentAt = now`) ต้องอยู่หลังเช็ค `on_pace`
    เท่านั้น ห้ามย้ายกลับไปก่อน** — เคยมีบั๊กจริง (เจอจากการตรวจโค้ดแบบ audit ไม่ใช่จาก user report):
    เดิม claim เกิดก่อนคำนวณ `on_pace` ถ้าผลเป็น on_pace (ดื่มทันเป้าแล้ว ไม่ต้องส่ง) โค้ดจะ `continue`
    ออกจาก loop ทันทีโดยไม่คืนค่า timestamp เดิม (คืนค่าคืนเฉพาะกรณี `sentCount === 0` เท่านั้น) ทำให้
    `lastWaterReminderSentAt` ถูกอัปเดตเป็น "เพิ่งส่ง" ทั้งที่ไม่เคยส่ง push จริงเลย — พอผู้ใช้ทันเป้าตอน
    เช็ครอบหนึ่ง แล้วมาตกเป้าทีหลังในหน้าต่างเวลาเดียวกัน ระบบจะเข้าใจผิดว่าเพิ่งเตือนไปแล้วและข้ามรอบ
    ถัดไปตาม `waterReminderIntervalMin` เงียบ ๆ (reason จะกลายเป็น `too_soon` แทนที่จะส่งจริง) — แก้โดย
    ย้าย atomic claim ไปวางหลังเช็ค `if (drunkMl >= expectedMl)` แทน (claim เฉพาะตอนตัดสินใจจะส่งจริง
    แล้วเท่านั้น) ยังคงกัน cron ยิงซ้อนกันส่ง push ซ้ำได้เหมือนเดิม เพราะยังเป็น atomic `updateMany`
    เทียบ staleness เหมือนเดิมทุกอย่าง แค่เช็คช้าลงหนึ่งจังหวะ — ทดสอบยืนยันจริงด้วยการ seed user ที่
    on_pace ก่อน (ยิง cron รอบแรกได้ reason `on_pace`, query ตรงจาก Prisma ยืนยันว่า
    `lastWaterReminderSentAt` ยังเป็น `null` อยู่) แล้วขยับ window ให้ตกเป้า (ยิงรอบสองได้ reason
    `no_active_subscription` ซึ่งแปลว่าโค้ดพยายามส่งจริงแล้ว ไม่ใช่ `too_soon` แบบที่บั๊กเดิมจะให้)
  - **มี guard `if (endMinutes <= startMinutes)` คืน reason `invalid_window` ก่อนคำนวณ pacing formula
    เสมอ** — กัน division-by-zero (`start === end`) และกันสูตร pacing เพี้ยนตอน overnight window
    (`start > end` เช่น 22:00–06:00) ที่จะทำให้ user ดูเหมือน "อยู่นอกช่วงเวลา" ตลอดเวลาไม่มีวันได้แจ้งเตือน
    — **เป็น defensive เท่านั้น ไม่ reachable ผ่านแอปจริงตอนนี้** เพราะ
    `api/settings/water-reminder-schedule/route.ts` ปฏิเสธ `start >= end` อยู่แล้วเป็นจุดเขียนค่าเดียว
    (กัน overnight window ไปในตัว) แต่ใส่ guard ซ้ำไว้ที่ cron เองด้วยเผื่อมีจุดเขียนค่าอื่นในอนาคตที่ข้าม
    เช็คนั้นไป — ทดสอบยืนยันจริงด้วยการ set `waterReminderStart === waterReminderEnd` ตรงผ่าน Prisma
    (ข้าม settings route ไปตรง ๆ) แล้วยิง cron ได้ reason `invalid_window` ไม่ crash/ไม่ค้าง แล้วรีเซ็ต
    กลับเป็น window ปกติยืนยันว่า evaluation รอบถัดไปทำงานถูกต้องเหมือนเดิม
  - **`cron/weekly-summary`** — แจ้งเตือนสรุปกิจกรรม/บันทึกอาหาร/น้ำหนักของสัปดาห์ที่ผ่านมา ทุกเช้า
    วันจันทร์ เพิ่มเข้ามาเพราะโค้ดที่ต้องใช้มีอยู่แล้ว 90% (ระบบ push, pattern cron-secret + atomic-claim,
    ข้อมูลครบใน DB) เป็น engagement ฟีเจอร์ตัวแรกที่ดึงคนกลับเข้าแอพจริง ๆ ไม่ใช่แค่ปรับให้คนที่เปิดแอพอยู่
    แล้วสะดวกขึ้นแบบฟีเจอร์อื่น — ผู้ใช้เปิดเองที่หน้าตั้งค่า (`User.weeklySummaryEnabled`, default
    `false`, off เหมือน whey reminder เพราะเป็น engagement เสริมไม่ใช่ safety-critical) ยังต้องมี
    `PushSubscription` อย่างน้อย 1 อุปกรณ์เหมือนกันทั้งคู่
    - **ต่างจาก water/whey-reminder ตรงที่ไม่ต้อง poll ถี่** — สองอันนั้นต้องดักจังหวะที่คาดเดาไม่ได้ล่วงหน้า
      (ผู้ใช้ตั้ง window เอง / กิจกรรมจบเมื่อไหร่ก็ไม่รู้) เลย poll ทุก 15 นาที ส่วน weekly summary เป้าหมาย
      เวลาส่งแน่นอนอยู่แล้ว (สัปดาห์ละครั้ง) เลยแค่ตั้ง Windows Scheduled Task แบบ `-Weekly -DaysOfWeek
      Monday -At 8am` ตรง ๆ (ดู `DEPLOY-WINDOWS.md`'s "9d.") ไม่ต้อง poll เลย — `lastWeeklySummarySentAt`
      (`User`, nullable `DateTime`) ยังกันการยิงซ้ำถ้า trigger ถูกเรียกซ้ำ/retry โดยไม่ตั้งใจอยู่ดี
      (atomic `updateMany` claim ก่อนทำงานจริง, staleness threshold 6 วัน — pattern เดียวกับ
      `wheyReminderSentAt` แค่ระดับ user ไม่ใช่ระดับ activity)
    - **"สัปดาห์ที่ผ่านมา" = 7 วันย้อนหลังนับถึงเที่ยงคืนของวันนี้ (ไม่รวมวันนี้)** ไม่ใช่ ISO week
      (จันทร์-อาทิตย์ตามปฏิทิน) เพราะไม่ต้องพึ่งว่า cron รันตรงเวลาเป๊ะทุกครั้ง — รันวันไหนก็ได้ในสัปดาห์
      ยังได้ค่าที่สมเหตุสมผล (7 วันล่าสุดที่จบแล้วจริง ๆ)
    - **Logic คำนวณสรุป (`src/lib/weekly-summary.ts`) แยกจาก query DB เหมือน `nutrition.ts`/
      `exercise-stats.ts`** — `buildWeeklySummary()` รับ array ดิบ (activities/foodLogDates/weightLogs
      ของสัปดาห์นั้น) คืนตัวเลขรวม (จำนวนกิจกรรม, เวลารวม, ระยะทางรวม, จำนวนวันที่บันทึกอาหาร — นับวัน
      ปฏิทินที่ไม่ซ้ำผ่าน `localDateKey` จาก `streak.ts` ไม่ใช่จำนวนแถว `FoodLog` ดิบ เพราะกิน 3 มื้อในวัน
      เดียวไม่ควรนับเป็น "3 วัน", ส่วนต่างน้ำหนัก — ล่าสุดลบเก่าสุดในสัปดาห์นั้น เรียงตาม `loggedAt` เอง
      ก่อนคำนวณเพราะ query ไม่ได้ sort มาให้) — เทสอยู่ที่ `weekly-summary.test.ts` รันเร็วไม่ต้องพึ่ง DB
    - **ไม่ส่ง push ถ้าสัปดาห์นั้นไม่มีอะไรจะบอกเลย** (`hasWeeklySummaryContent`, `activityCount === 0 &&
      foodLoggedDays === 0`) — ตรงกับธรรมเนียมเดียวกับ activity bonus ที่ซ่อนแถบ "+0 kcal" ที่ไม่มี
      ความหมาย ผู้ใช้ที่หายไปทั้งสัปดาห์ได้แจ้งเตือนว่าง ๆ จะยิ่งรู้สึกว่าแอพน่ารำคาญ ไม่ใช่ดึงกลับมา —
      claim ของ user คนนั้นยังคงเซ็ตไว้เหมือนเดิม (ไม่ปล่อยคืนให้ลองใหม่) เพราะ cron รันสัปดาห์ละครั้ง
      อยู่แล้ว ไม่มี "ลองใหม่เร็ว ๆ นี้" ที่มีความหมายเหมือน push ส่งไม่สำเร็จจริง ๆ แบบ whey-reminder
    - **ข้อความในการ์ด Thai-only เหมือน push อื่นทุกตัว** ไม่ผ่าน `?lang=`/`resolveLocale()` เพราะเป็น
      backend-generated text ที่ไม่อยู่ใน scope 5 หน้าหลักที่แปลแล้ว (ดู "### 5. ภาษา (i18n)") — แต่ยัง
      เคารพ `User.unitSystem` สำหรับ format ระยะทาง (กม./ไมล์) เพราะเป็นคนละการตัดสินใจกับภาษา (ตัวเลข/
      หน่วยข้อมูล vs ข้อความ UI)
    - **แต่ละ segment ในข้อความ (กิจกรรม/ระยะทาง/น้ำหนัก) โผล่เฉพาะที่มีความหมายเท่านั้น** ยกเว้นจำนวนวัน
      บันทึกอาหารที่โชว์เสมอแม้เป็น 0/7 (เป็นตัวเลขหลักที่อยากให้เห็นตลอด ไม่ใช่ตัวเลข "ไม่มีอะไรเกิดขึ้น"
      แบบระยะทาง/น้ำหนักที่เป็น 0 จริง ๆ ไม่มีอะไรให้พูดถึง) — ส่วนต่างน้ำหนักปัดทศนิยม 1 ตำแหน่งก่อนเช็คว่า
      เป็น 0 มั้ย (กัน noise จากการชั่งที่คลาดเคลื่อนเล็กน้อยระหว่างสองครั้งโผล่เป็น "+0.04 กก." ที่ไม่มี
      ความหมาย)
    - **แคลอรี่/แมโครเฉลี่ยเทียบเป้าหมาย** — เพิ่ม 2 segment ต่อจาก "บันทึกอาหารครบ N/7 วัน" ในข้อความ
      push: "แคลอรี่เฉลี่ย X/Y kcal" กับ "แมโครเฉลี่ย: โปรตีน.../คาร์บ.../ไขมัน... ก." — `buildWeeklySummary`
      (`src/lib/weekly-summary.ts`) พับ `FoodLog` ของสัปดาห์นั้นเป็นยอดรวมต่อวันปฏิทินก่อน (กัน 3 มื้อ/วัน
      นับซ้ำเหมือนที่ `foodLoggedDays` ทำอยู่แล้ว) แล้ว**เฉลี่ยด้วยจำนวนวันที่มี log จริงเท่านั้น
      (`foodLoggedDays`) ไม่ใช่หาร 7 เสมอ** — วันที่ไม่ได้ log ไม่ใช่ "กิน 0 kcal" แค่ไม่มีข้อมูล หารด้วย 7
      จะทำให้ค่าเฉลี่ยต่ำกว่าที่กินจริงในวันที่ log ไว้ — ฟิลด์ใหม่ 4 ตัว (`avgCaloriesPerLoggedDay`/
      `avgProteinGPerLoggedDay`/`avgCarbGPerLoggedDay`/`avgFatGPerLoggedDay`, ทั้งหมด `null` ถ้า
      `foodLoggedDays === 0`) — **`WeeklySummaryInput.foodLogDates: Date[]` เปลี่ยนเป็น
      `foodLogs: WeeklyFoodLogInput[]`** (`{ loggedAt, calories, proteinG, carbG, fatG }`, breaking
      change ของ input shape) เพราะต้องการแมโครต่อแถวมาด้วย ไม่ใช่แค่วันที่ — cron route
      (`src/app/api/cron/weekly-summary/route.ts`) เปลี่ยน query `foodLog.findMany` จาก
      `select: { loggedAt: true }` เป็น `include: { food: true }` แล้ว map ผ่าน `macrosForGrams(f.food,
      f.grams)` (`src/lib/food.ts`, ตัวเดียวกับที่ทุกหน้าคำนวณแมโครจาก log ใช้อยู่แล้ว) ก่อนส่งเข้า
      `buildWeeklySummary` — **เป้าหมายที่เอามาเทียบมาจาก `computeTargets` ตัวเดียวกับทุกหน้าในแอพ**
      (ไม่ใช่สูตรแยกใหม่) route ประกอบ `nutritionProfile` จาก `User` fields แบบเดียวกับที่
      `dashboard/page.tsx` ทำ (`isProfileComplete` เช็คก่อน, ถ้าครบค่อยดึง
      `getLatestBodyComposition(userId)` + macro prefs (`proteinGPerKg`/`fatPercentOfCalories`) มาคำนวณ) —
      **ถ้าโปรไฟล์โภชนาการยังกรอกไม่ครบ ไม่มีเป้าให้เทียบ เลยไม่โชว์ทั้ง 2 segment นี้เลย** (`targets` เป็น
      `null`, `formatWeeklySummaryBody`'s `targets` param optional เช็คคู่กับ `avgCaloriesPerLoggedDay
      !== null` ก่อนต่อท้าย — ทั้งสองเงื่อนไขต้องผ่านคือมีทั้งข้อมูลจริงและเป้าหมายให้เทียบ) ไม่ใช่โชว์
      ตัวเลขเฉลี่ยเดี่ยว ๆ ไม่มีเป้ากำกับ เพราะจุดประสงค์ทั้งฟีเจอร์คือ "เทียบเป้า" ไม่ใช่แค่รายงานตัวเลข —
      เทสอยู่ที่ `weekly-summary.test.ts`: ยืนยันเฉลี่ยพับต่อวันถูก (ไม่ใช่เฉลี่ยต่อแถว), เฉลี่ยด้วยจำนวน
      วันที่ log จริงไม่ใช่ 7 เสมอ, ข้อความมี/ไม่มี segment ตามเงื่อนไข targets+ข้อมูลจริงถูกต้อง — ทดสอบ
      จริงด้วยการ seed user ที่มีโปรไฟล์ครบ+สแกน InBody (มี %ไขมัน ทำให้ใช้สูตร Katch-McArdle) กับอาหาร
      500g × 2 วันที่รู้ค่าแมโครต่อ 100g แน่นอน คำนวณเป้าหมายด้วยมือเทียบกับ Katch-McArdle+PROTEIN_G_PER_KG_LBM
      ได้ 2495 kcal/138P/330C/69F ตรงกับที่ cron คำนวณจริงเป๊ะทุกตัว (ยืนยันผ่าน debug log ชั่วคราวที่ลบ
      ออกหลังตรวจเสร็จ) — reason `no_active_subscription` (ไม่ใช่ `no_content`) ยืนยันว่า route พยายาม
      ส่งจริงด้วยเนื้อหาที่คำนวณครบแล้ว
    - **หน้าตั้งค่า** — เพิ่ม section ใหม่ (`settings/page.tsx` + `weekly-summary-toggle.tsx`) ก่อนหัวข้อ
      "ผลตรวจสุขภาพ" ใช้ pattern เดียวกับ `WheyReminderToggle` เป๊ะ (เช็คสถานะ browser push subscription
      ก่อน โชว์ปุ่มเปิด/ปิดถ้ามี subscription จริงแล้ว ไม่งั้นโชว์ลิงก์ให้ไปเปิดที่หน้าไดอารี่ก่อน) ต่างจาก
      `WheyReminderToggle` แค่ตรงที่**แปลผ่าน `next-intl`** (`settings.weeklySummary` namespace ใน
      `messages/th.json`/`en.json`) เพราะหน้าตั้งค่าอยู่ใน scope 5 หน้าหลักที่แปลแล้ว ต่างจากหน้า
      `/dashboard/supplements` ที่ `WheyReminderToggle` อยู่ (นอกขอบเขต i18n) — วางไว้ที่หน้าตั้งค่าแทนที่
      จะผูกกับหน้าฟีเจอร์เดียวแบบ water/whey (`/dashboard/food`/`/dashboard/supplements`) เพราะสรุปนี้
      ครอบคลุมทั้งแอพ (กิจกรรม+อาหาร+น้ำหนัก) ไม่ได้ผูกกับ domain เดียว — **`WeeklySummaryToggle` ต้อง
      เรียกทั้งการ์ด (ไอคอน+หัวข้อ+คำอธิบาย+ปุ่ม) เองทั้งหมดเหมือน `WheyReminderToggle` เป๊ะ ไม่ใช่แค่
      ปุ่ม** — บั๊กที่พบจาก code-review รอบตรวจของฟีเจอร์นี้เอง (ไม่ใช่ user report): ตอนแรกวางหัวข้อ/
      คำอธิบายไว้ที่ `settings/page.tsx` (server component, render เสมอ) แล้วให้ `WeeklySummaryToggle`
      คืนแค่ตัวปุ่ม/hint พร้อม `return null` ตอน `pushStatus` เป็น `"checking"`/`"unsupported"` — ทำให้
      ใครก็ตามที่เบราว์เซอร์ไม่รองรับ Push API เห็น section ที่มีแค่หัวข้อ+คำอธิบายค้างอยู่ตลอด ไม่มีปุ่ม
      ไม่มีคำอธิบายว่าทำไม (component อื่นในแอพ, `WheyReminderToggle`, ไม่โดนบั๊กนี้เพราะเรียกทั้งการ์ด
      รวมหัวข้อเองอยู่แล้ว `return null` เลยซ่อนทั้งการ์ดไปด้วยกัน) — แก้โดยย้ายไอคอน+หัวข้อ+คำอธิบายเข้าไป
      อยู่ใน `WeeklySummaryToggle` เอง (`settings/page.tsx` เหลือแค่เรียก `<WeeklySummaryToggle
      initialEnabled={...} />` ตัวเดียว ไม่มี `<section>` ห่อเอง) ทดสอบจริงด้วย Playwright:
      `page.addInitScript(() => delete window.navigator.serviceWorker)` ก่อนโหลดหน้าตั้งค่า จำลอง
      เบราว์เซอร์ที่ไม่รองรับ Push API — ก่อนแก้ยังเห็นหัวข้อ "สรุปผลประจำสัปดาห์" ค้างอยู่ หลังแก้
      หายไปทั้ง section (นับด้วย `page.getByText(...).count()` ได้ 0) พร้อม regression-check เคสปกติ
      (เบราว์เซอร์รองรับแต่ยังไม่มี subscription) ว่ายังเห็นหัวข้อ+ลิงก์ "ต้องเปิดการแจ้งเตือนที่..."
      เหมือนเดิมไม่กระทบ
    - ทดสอบจริงด้วยการ seed user 2 คน (คนแรกมีกิจกรรม 2 ครั้ง/บันทึกอาหาร 3 วัน/น้ำหนักลด 0.7 กก. ในสัปดาห์,
      คนที่สองไม่มีอะไรเลย) + `PushSubscription` ปลอม (endpoint ปลอมส่ง push จริงไม่ได้ แต่พอทดสอบ query/
      claim/summary logic ได้ครบ ไม่ใช่ปลายทาง delivery จริง) ยิง cron ยืนยัน: คนแรกได้ reason
      `no_active_subscription` (แปลว่าพยายามส่งจริงแล้ว ไม่ใช่ `no_content`/`too_soon`), คนที่สองได้
      `no_content` ถูกต้อง, ยิงซ้ำทันทีคนแรกไม่โดนเลือกอีก (`usersConsidered: 0`, claim กันซ้ำทำงาน),
      `lastWeeklySummarySentAt` อัปเดตจริงใน DB, PATCH `/api/settings/weekly-summary` persist ค่าถูกต้อง,
      และเปิดหน้าตั้งค่าจริงผ่าน Playwright เห็น section ใหม่ขึ้น + ข้อความ "ต้องเปิดการแจ้งเตือนที่หน้า
      บันทึกอาหารก่อน" พร้อมลิงก์ทำงานถูกต้อง (เพราะ browser ทดสอบไม่มี push subscription จริง แค่แถวปลอม
      ใน DB สำหรับทดสอบ cron)
- PWA: `manifest.webmanifest`, service worker — ติดตั้งเป็นแอพได้

## Workflow ตอนแก้โค้ด (ทำทุกครั้งก่อน commit)

1. `service mariadb start` (ถ้ายังไม่รัน) → ถ้ามีแก้ schema: `npx prisma migrate dev --name <ชื่อ>`
   (local) — **production ใช้ `npx prisma migrate deploy` เท่านั้น อย่าลืมรันก่อน/พร้อมกับ deploy
   โค้ดใหม่ทุกครั้งที่มี migration ใหม่ ไม่งั้นจะเจอ error แบบ `column ... does not exist`**
2. `npx tsc --noEmit` แล้ว `npm run build` ให้ผ่านทั้งคู่ก่อน
3. `npm run test` (Vitest, `vitest.config.mts`) — unit test สำหรับ logic ล้วน ๆ ที่ไม่ต้องพึ่ง DB/
   Next.js runtime: `src/lib/*.test.ts` ครอบคลุม nutrition calc, exercise-stats (mock `db` ผ่าน
   `vi.mock("./db", ...)` ไม่ต้องต่อ DB จริง), ตัวแปลงข้อความ AI-import ทั้ง 3 ตัว (activity/meal/
   body-composition — มี regression test เฉพาะบั๊ก comma-thousands ที่เจอมาแล้ว 2 รอบ), format.ts,
   calorie-estimate, achievements, activity-validation, pr-progression, streak — รันเร็ว (~1 วิ)
   ควรรันทุกครั้งที่แก้ไฟล์พวกนี้ก่อนจะไปเทสมือรอบใหญ่ต่อ **แต่ไม่ได้แทนที่ข้อ 4 ด้านล่าง** — เทสพวกนี้
   คุม logic ล้วน ๆ เท่านั้น ไม่ครอบคลุม DB query จริง/UI จริง/next/og render จริง (เช่น บั๊ก
   `textShadow: undefined` ที่ทำ satori crash ในการ์ดแชร์ก็ไม่มีทางจับได้จาก unit test แบบนี้ ต้องเทส
   มือแบบข้อ 4 เท่านั้นถึงจะเจอ) — ไฟล์เทสใหม่วางคู่กับไฟล์จริงเสมอ (`foo.ts` + `foo.test.ts`
   directory เดียวกัน) ไม่มี `tests/` แยก
4. ถ้าเทสฟีเจอร์จริง: seed user/ข้อมูลทดสอบผ่าน Prisma ตรง ๆ, มินต์ session JWT ด้วย `jose`'s
   `SignJWT` + `SESSION_SECRET` (**อย่าลืม strip เครื่องหมาย `"` ออกจากค่าใน `.env` ก่อน** ตามที่เขียนไว้
   ด้านบน) แล้ว curl/Playwright ยิงเข้าเซิร์ฟเวอร์ที่รันด้วย `npm run start` (ใช้ `fuser -k 3000/tcp`
   เคลียร์พอร์ตก่อนถ้าจำเป็น) ตรวจผลทั้งจาก HTML ที่ได้และ query ตรงจาก Prisma
5. เก็บกวาดข้อมูลทดสอบ + ไฟล์ scratch ทิ้งให้หมดก่อน commit, หยุด dev server/DB
6. Commit (มี attribution footer ตามที่ session กำหนด), push ไปยัง branch ที่ทำงานอยู่ — ถ้า push
   โดน reject ให้ `git fetch` + `git rebase` ก่อน push ใหม่ (ผู้ใช้บางทีก็ push เข้า remote branch เอง)

## หมายเหตุอื่นที่มีประโยชน์
- **`vitest.config.mts` ต้องเป็น `.mts` ไม่ใช่ `.ts`** — `package.json` ไม่มี `"type": "module"`
  (ทั้งโปรเจกต์เป็น CommonJS by default) ถ้าตั้งชื่อ `.ts` เฉย ๆ vitest จะพยายาม `require()` ไฟล์ config
  ที่ import `vite-tsconfig-paths` (ESM-only package) เข้ามา แล้ว crash ตั้งแต่ยังไม่เริ่มรันเทสเลย
  ("ESM file cannot be loaded by `require`") เปลี่ยนนามสกุลเป็น `.mts` ให้ Node/Vite โหลดเป็น ESM ตรง ๆ
  แก้ปัญหานี้ได้ทันที
- Deploy จริงอยู่บน **Windows Server** ผ่าน `nssm` (`D:\Projectphp\MooPaTa`, service ชื่อ `MooPaTa`)
  — คนละ workflow กับ dev/test ที่นี่ (Linux) ดู `DEPLOY-WINDOWS.md` สำหรับขั้นตอน deploy ฉบับเต็ม
- ข้อความ UI ของแอพเกือบทั้งหมดสลับ TH/EN ได้จริงผ่าน `next-intl` แล้ว (ดู "### 5. ภาษา (i18n)" สำหรับ
  รายชื่อหน้าทั้งหมด) — เหลือแค่จุดที่ตั้งใจไม่แปล (AI-import prompt, ข้อความ error จาก API, อีเมล,
  ข้อความในรูปการ์ดแชร์ Satori, ข้อมูลที่ผู้ใช้พิมพ์เอง) — comment ในโค้ดเป็นอังกฤษเป็นหลัก อธิบาย
  "ทำไม" ไม่ใช่ "ทำอะไร"
