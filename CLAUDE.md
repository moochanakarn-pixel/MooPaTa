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
- Login ผ่าน "Login with Strava" (OAuth2) เท่านั้น ไม่มีระบบสมัครสมาชิกแยก — เชื่อม Strava ครั้งแรก
  คือการสร้างบัญชี (`User` ไม่มี field `email`)
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
| `ProviderConnection` | OAuth token ของ Strava (เข้ารหัส AES-256-GCM ด้วย `src/lib/crypto.ts`) |
| `Activity` / `ActivityDetail` / `Exercise` | กิจกรรมออกกำลังกาย normalize จาก Strava (หรือ MANUAL) + รายละเอียดที่โหลดแบบ lazy (splits/streams/weather) + ท่าเวทสำหรับ activity แบบ manual |
| `WaterLog` / `WeightLog` | บันทึกน้ำ/น้ำหนักรายครั้ง — log น้ำหนักใหม่จะอัปเดต `User.weightKg` ด้วย |
| `BodyCompositionLog` | ผลตรวจ InBody/เครื่องวัดองค์ประกอบร่างกายแบบเป็นครั้ง ๆ (ไม่ใช่ทุกวัน) — เฉพาะ `weightKg` บังคับ ที่เหลือ optional ตาม field ที่เครื่องแต่ละรุ่นมี |
| `PushSubscription` | Web Push subscription ต่ออุปกรณ์ (มีแถว = เปิดแจ้งเตือนสำหรับเครื่องนั้น) |
| `Supplement` / `SupplementLog` | รายการอาหารเสริมที่ต้องกินประจำ + เช็คว่ากินไปหรือยันแต่ละวัน |

## ฟีเจอร์หลัก แยกตามส่วน

### 1. Strava sync (ของเดิมตั้งแต่ต้นโปรเจกต์)
- `src/lib/providers/strava.ts` — OAuth2 + REST client
- `src/lib/sync-strava.ts` — ดึง activity ใหม่มา upsert, throttle การสแกนหาอะไรที่ถูกลบฝั่ง Strava
- `src/app/api/auth/strava/connect|callback`, `src/app/api/sync/strava`, `src/app/api/cron/sync`
  (auth ด้วย `CRON_SECRET` แทน session เพราะ cron ไม่มี browser)
- หน้าที่เกี่ยวข้อง: `/dashboard` (list), `/dashboard/activity/[id]` (detail + streams/splits),
  `/dashboard/records`, `/dashboard/compare`, `/dashboard/achievements`, `/dashboard/summary`

### 2. ระบบอาหาร/ไดอารี่ (`/dashboard/food` = ไดอารี่, `/dashboard/food/library` = คลังอาหารส่วนตัว)
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

### 3. เชิงลึก / โภชนาการ (`/dashboard/nutrition` — bottom-nav label คือ "เชิงลึก")
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
  weightKg × (1 - bodyFat%/100)) แทน และคำนวณโปรตีนจาก lean body mass (2.2 g/kg) แทน total bodyweight
  (1.8 g/kg) — ทุกจุดในแอพที่เรียก `computeTargets` (หน้าแรก/ไดอารี่/เชิงลึก/share card/cron
  water-reminder) ต้องดึง body composition ล่าสุดผ่าน `getLatestBodyComposition(userId)`
  (`src/lib/body-composition.ts`) มาส่งเข้าไปด้วยเสมอ ไม่งั้นตัวเลขจะไม่ตรงกันระหว่างหน้าต่าง ๆ
  (หลักการเดียวกับที่ `applyActivityBonus`'s comment อธิบายไว้สำหรับ activity bonus) — ฟังก์ชันนี้คืน
  `null` ถ้ายังไม่มีสแกน หรือสแกนล่าสุดไม่มี `bodyFatPercent` (แค่มี weightKg อย่างเดียวไม่พอคำนวณ lean
  body mass ได้)

### 4. Bottom nav (`src/app/dashboard/bottom-nav.tsx`)
4 แท็บ: หน้าแรก (`/dashboard`) / ไดอารี่ (`/dashboard/food`) / เชิงลึก (`/dashboard/nutrition`,
ครอบคลุม `/dashboard/knowledge` ด้วย) / บัญชี (`/dashboard/settings`) + ปุ่ม [+] กลางเปิด sheet
ทางลัด (เพิ่มอาหาร/บันทึกกิจกรรม/อาหารเสริม/บันทึกน้ำหนัก) หน้าที่ไม่มีแท็บของตัวเอง (records, compare,
achievements, activity detail) เข้าถึงผ่านลิงก์จากหน้าแรกเท่านั้น

### 5. Share cards (Satori/`next/og`)
- `src/app/api/share/{daily-summary,nutrition,period}/route.tsx` — สร้างรูปสรุปแชร์
- สไตล์การ์ดร่วมกันอยู่ที่ `src/lib/share-card-styles.ts` (`cardStyle`, `rowCardStyle`, `titleStyle`,
  `iconCircleStyle`)
- ข้อจำกัดของ Satori ที่เจอแล้ว: ไม่รองรับ `conic-gradient()`, `justify-content: space-evenly`
  (ใช้ `"space-around"` แทน), ตัวอักษร "ล" ท้ายคำที่โดดเดี่ยว render เพี้ยน (เลี่ยงด้วยการใช้คำเต็ม)

### 6. อื่น ๆ
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
