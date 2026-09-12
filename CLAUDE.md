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
| `Activity` / `ActivityDetail` / `Exercise` | กิจกรรมออกกำลังกาย — ของเก่า normalize มาจาก Strava (`provider: STRAVA`, เก็บไว้เฉย ๆ ไม่ sync ต่อแล้ว), ของใหม่ทั้งหมดเป็น `provider: MANUAL` ที่ผู้ใช้พิมพ์เอง + รายละเอียดเก่าที่เคยโหลดแบบ lazy จาก Strava (splits/streams/weather, เฉพาะ activity เก่า) + ท่าเวทสำหรับ activity แบบ manual |
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
  (ไม่ใช่สร้างบัญชีใหม่) ต้องยืนยันอีเมลก่อนถึงจะ login ด้วยได้ เหมือน signup ปกติ
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
- **บัญชีแยกกันเพราะ login คนละทาง** — Google connect/callback ทำ find-or-create by
  `providerAccountId` เสมอ ไม่สนใจ session ที่ล็อกอินอยู่ตอนนั้น เผลอกด Sign in with Google ระหว่าง
  ที่ login ด้วยอีเมลอยู่จะได้บัญชีคนละใบ — `scripts/list-accounts-2026-09-13.mjs` (ดูว่าบัญชีไหน
  เป็นบัญชีไหน) + `scripts/merge-accounts-2026-09-13.mjs` (ย้ายข้อมูลทั้งหมดจากบัญชีหนึ่งไปอีกบัญชี)
  + `scripts/identify-google-connections-2026-09-13.mjs` (ถอดรหัส token ถามอีเมลจริงจาก Google
  เพราะ DB ไม่เก็บอีเมลของ OAuth ไว้) + `scripts/split-google-connection-2026-09-13.mjs` (แยก
  connection ที่ merge ผิดคนออกกลับเป็นบัญชีใหม่) ใช้แก้เคสนี้ได้

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
  collation เป็น case-insensitive อยู่แล้ว) — ป้องกันคลังบวมจากการคีย์ชื่อเดิมซ้ำ ๆ
- **รวมของซ้ำที่มีอยู่แล้ว** — `POST /api/food/merge-duplicates` ใช้แก้ของเก่าที่ซ้ำอยู่ก่อนมีเช็คด้านบน
  (กลุ่มตามชื่อ normalize แล้ว, เก็บแถวที่มี log เยอะสุดไว้เป็นตัวหลัก, ย้าย `FoodLog` ทั้งหมดไปอ้างแถวนั้น,
  soft-delete ที่เหลือ) — ปุ่ม "รวมเมนูซ้ำทั้งหมด" อยู่ในหน้าคลังอาหาร (banner จะโชว์เองถ้าเจอของซ้ำ)
- **แก้ค่าโภชนาการ** — แก้ได้แค่ที่คลังอาหารส่วนตัวเท่านั้น (มีผลย้อนหลังกับทุกวันที่เคยบันทึกเมนูนั้น
  เพราะ macro คำนวณสดจาก `Food` เสมอ) หน้าไดอารี่แก้ได้แค่ปริมาณ/มื้อของรายการนั้น ๆ — ปุ่มดินสอในไดอารี่
  มีลิงก์ deep-link ไปเปิดฟอร์มแก้ที่คลังอาหาร (`/dashboard/food/library?edit=<foodId>`)
- **คำแนะนำเมนู ("เมนูที่กินบ่อย")** — อยู่ในแผงเพิ่มอาหาร (ไม่โชว์ก่อนกดเพิ่มอาหาร) จัดอันดับด้วย
  `PersonalFood.logCount` (นับจาก `FoodLog.groupBy` server-side จริง ๆ ไม่ได้ persist เป็น field)
  ถ้ายังไม่มีประวัติจะ fallback ไปโชว์จาก `THAI_FOOD_CATALOG` แทน (`src/lib/thai-food-catalog.ts`)
  ดู `src/app/dashboard/food/food-log-view.tsx`
- **"โปรด" (★)** — `Food.isFavorite` เป็นแค่ toggle ที่คลังอาหารสำหรับผู้ใช้ดูเองเฉยๆ **ไม่ได้มีผลกับ
  คำแนะนำเมนูในไดอารี่แล้ว** (อันนั้นใช้ `logCount` ล้วน ๆ) — เผื่อสับสนถ้าเจอ field นี้ในโค้ด

### 2. เชิงลึก / โภชนาการ (`/dashboard/nutrition` — bottom-nav label คือ "เชิงลึก")
รวมสถิติ/เป้าหมายระยะยาวที่ไม่ใช่การบันทึกรายวัน:
- BMI gauge, กราฟน้ำหนัก (`WeightLogCard`), รูปถ่ายความคืบหน้า (`ProgressPhotosCard`)
- แคลอรี่วันนี้เทียบเป้า (BMR/TDEE จาก `src/lib/nutrition.ts`), แมโครที่ควรได้ต่อวัน
- กราฟแนวโน้มแคลอรี่ 14 วัน (`CalorieTrendChart`), เทียบสัปดาห์นี้กับสัปดาห์ก่อน
  (`NutritionPeriodComparison`)
- เป้าหมายน้ำวันนี้
- **สถิติบันทึกต่อเนื่อง** (`LoggingStreakCard`, `src/app/dashboard/nutrition/logging-streak-card.tsx`)
  — ย้ายมาจากหน้าไดอารี่ในรอบนี้ เพราะเข้ากับสถิติระยะยาวอื่น ๆ มากกว่า ไม่เกี่ยวกับการบันทึกวันนี้
  โดยตรง คำนวณจาก `buildDayCounts`/`computeStreak` ใน `src/lib/streak.ts` (window 60 วันย้อนหลัง)
- คำนวณเป้าหมาย/BMR/TDEE ทั้งหมดต้องมีโปรไฟล์ครบ (`isProfileComplete`) ไม่งั้นหน้านี้จะโชว์ CTA
  ให้ไปกรอกโปรไฟล์แทน
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

### 3. Bottom nav (`src/app/dashboard/bottom-nav.tsx`)
4 แท็บ: หน้าแรก (`/dashboard`) / ไดอารี่ (`/dashboard/food`) / เชิงลึก (`/dashboard/nutrition`,
ครอบคลุม `/dashboard/knowledge` ด้วย) / บัญชี (`/dashboard/settings`) + ปุ่ม [+] กลางเปิด sheet
ทางลัด (เพิ่มอาหาร/บันทึกกิจกรรม/อาหารเสริม/บันทึกน้ำหนัก) หน้าที่ไม่มีแท็บของตัวเอง (records, compare,
achievements, activity detail) เข้าถึงผ่านลิงก์จากหน้าแรกเท่านั้น

### 4. Share cards (Satori/`next/og`)
- `src/app/api/share/{daily-summary,nutrition,period}/route.tsx` — สร้างรูปสรุปแชร์
- สไตล์การ์ดร่วมกันอยู่ที่ `src/lib/share-card-styles.ts` (`cardStyle`, `rowCardStyle`, `titleStyle`,
  `iconCircleStyle`) — ใช้ทั้ง period/nutrition (โทนเข้มเดิม navy/green) และ daily-summary
- ข้อจำกัดของ Satori ที่เจอแล้ว: ไม่รองรับ `conic-gradient()`, `justify-content: space-evenly`
  (ใช้ `"space-around"` แทน), ตัวอักษร "ล" ท้ายคำที่โดดเดี่ยว render เพี้ยน (เลี่ยงด้วยการใช้คำเต็ม)
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

### 5. อื่น ๆ
- Activity pages: `/dashboard` (list), `/dashboard/activity/[id]` (detail), `/dashboard/log-activity`
  (บันทึกเอง), `/dashboard/records`, `/dashboard/compare`, `/dashboard/achievements`,
  `/dashboard/summary` — ทำงานเหมือนกันไม่ว่า `Activity.provider` จะเป็น `STRAVA` (ของเก่า) หรือ
  `MANUAL` (ของใหม่ทั้งหมด นับจากตัด Strava sync ออก) เพราะ query/stat ทุกจุดไม่แยก provider
  - `/dashboard/log-activity` มีโหมด "นำเข้าจาก AI" คู่กับ "กรอกเอง" เหมือนอาหาร/InBody (paste prompt
    สำเร็จรูป → ถาม AI เอง พร้อมแนบรูปสรุปกิจกรรมจากแอพนาฬิกา/สายรัด → วางคำตอบกลับมาให้
    `parseActivityText` (`src/lib/activity-import-parse.ts`) เติมประเภท/ระยะเวลา/ระยะทาง/แคลอรี่/
    หัวใจ และถ้าเป็นเวทเทรนนิ่งเติมรายการท่า (ตาราง "ชื่อท่า | เซ็ท | ครั้ง | น้ำหนัก") ต่อท้ายรายการ
    เดิมด้วย — ไม่เรียก vision API เอง เหมือนฟีเจอร์ AI-import อื่น ๆ ในแอพ
  - แต่ละแถว "ท่าออกกำลังกาย" เป็นการ์ดแยก (ชื่อท่าเต็มความกว้างแถวบน, เซ็ท/ครั้ง/น้ำหนักเป็น grid 3
    ช่องแถวล่าง) — เดิมเรียงเป็นแถวเดียวกันหมด (ชื่อท่า+เซ็ท+ครั้ง+น้ำหนัก+ปุ่มลบ) ทำให้ช่องชื่อท่า
    ถูกบีบจนแคบมากบนมือถือ (`flex-1` แต่พื้นที่เหลือให้ขยายน้อยเกินไปเพราะอีก 3 ช่องเป็น fixed width)
    ดูเหมือนพิมพ์ไม่ได้ทั้งที่จริงพิมพ์ได้ แค่มองไม่เห็นตัวอักษร
- Water/Weight logging: `src/app/api/water|weight/log*`, การ์ดอยู่ทั้งในไดอารี่ (น้ำ) และเชิงลึก
  (น้ำหนัก)
- Supplements: `/dashboard/supplements`, checklist รายวันจาก `SupplementLog`
- Push notifications: `src/lib/push.ts` + `src/app/api/cron/{water-reminder,whey-reminder}` —
  ต้องมี `PushSubscription` และ flag ที่เกี่ยวข้องเปิดอยู่ทั้งคู่ (ดู comment ใน schema)
- PWA: `manifest.webmanifest`, service worker — ติดตั้งเป็นแอพได้

## Workflow ตอนแก้โค้ด (ทำทุกครั้งก่อน commit)

1. `service mariadb start` (ถ้ายังไม่รัน) → ถ้ามีแก้ schema: `npx prisma migrate dev --name <ชื่อ>`
   (local) — **production ใช้ `npx prisma migrate deploy` เท่านั้น อย่าลืมรันก่อน/พร้อมกับ deploy
   โค้ดใหม่ทุกครั้งที่มี migration ใหม่ ไม่งั้นจะเจอ error แบบ `column ... does not exist`**
2. `npx tsc --noEmit` แล้ว `npm run build` ให้ผ่านทั้งคู่ก่อน
3. ถ้าเทสฟีเจอร์จริง: seed user/ข้อมูลทดสอบผ่าน Prisma ตรง ๆ, มินต์ session JWT ด้วย `jose`'s
   `SignJWT` + `SESSION_SECRET` (**อย่าลืม strip เครื่องหมาย `"` ออกจากค่าใน `.env` ก่อน** ตามที่เขียนไว้
   ด้านบน) แล้ว curl/Playwright ยิงเข้าเซิร์ฟเวอร์ที่รันด้วย `npm run start` (ใช้ `fuser -k 3000/tcp`
   เคลียร์พอร์ตก่อนถ้าจำเป็น) ตรวจผลทั้งจาก HTML ที่ได้และ query ตรงจาก Prisma
4. เก็บกวาดข้อมูลทดสอบ + ไฟล์ scratch ทิ้งให้หมดก่อน commit, หยุด dev server/DB
5. Commit (มี attribution footer ตามที่ session กำหนด), push ไปยัง branch ที่ทำงานอยู่ — ถ้า push
   โดน reject ให้ `git fetch` + `git rebase` ก่อน push ใหม่ (ผู้ใช้บางทีก็ push เข้า remote branch เอง)

## หมายเหตุอื่นที่มีประโยชน์
- Deploy จริงอยู่บน **Windows Server** ผ่าน `nssm` (`D:\Projectphp\MooPaTa`, service ชื่อ `MooPaTa`)
  — คนละ workflow กับ dev/test ที่นี่ (Linux) ดู `DEPLOY-WINDOWS.md` สำหรับขั้นตอน deploy ฉบับเต็ม
- ทุกอย่างในแอพเป็นภาษาไทย (UI text) — comment ในโค้ดเป็นอังกฤษเป็นหลัก อธิบาย "ทำไม" ไม่ใช่ "ทำอะไร"
