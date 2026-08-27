import Link from "next/link";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6 rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5">
      <h2 className="mb-3 font-medium text-neutral-100">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-neutral-400">{children}</div>
    </section>
  );
}

function Formula({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg bg-neutral-950/60 px-3 py-2 font-mono text-xs text-neutral-300">{children}</p>;
}

export default function KnowledgePage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/dashboard/nutrition" className="mb-6 inline-flex items-center gap-1.5 text-sm text-neutral-500 transition hover:text-neutral-300">
        <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
          <path d="M13 4 7 10l6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        กลับไปหน้าโภชนาการ
      </Link>

      <h1 className="mb-1 text-xl font-bold">ตัวเลขในแอปมาจากไหน</h1>
      <p className="mb-8 text-sm text-neutral-500">
        คำอธิบายสั้น ๆ เบื้องหลังทุกตัวเลขในหน้าโภชนาการ ไม่มีอะไรลึกลับ — เป็นสูตรมาตรฐานที่ใช้กันทั่วไป ไม่ใช่ AI เดา
      </p>

      <Section title="BMR (พลังงานที่ใช้ตอนนอนนิ่ง ๆ)">
        <p>
          BMR คือพลังงานที่ร่างกายเผาผลาญแม้ไม่ขยับตัวเลย (หายใจ สูบฉีดเลือด ฯลฯ) คำนวณด้วยสูตร Mifflin-St Jeor
          ซึ่งเป็นสูตรที่แนวทางโภชนาการปัจจุบันถือว่าแม่นยำที่สุดสำหรับคนทั่วไป (แม่นกว่าสูตร Harris-Benedict รุ่นเก่า)
        </p>
        <Formula>ชาย: BMR = 10×น้ำหนัก(กก.) + 6.25×ส่วนสูง(ซม.) − 5×อายุ + 5</Formula>
        <Formula>หญิง: BMR = 10×น้ำหนัก(กก.) + 6.25×ส่วนสูง(ซม.) − 5×อายุ − 161</Formula>
      </Section>

      <Section title="TDEE (พลังงานที่ใช้จริงต่อวัน)">
        <p>เอา BMR คูณด้วยตัวคูณตามระดับกิจกรรมในชีวิตประจำวัน — ไม่นับกิจกรรมที่บันทึกในแอปซ้ำ เพราะตัวคูณนี้ครอบคลุมไลฟ์สไตล์โดยรวมอยู่แล้ว</p>
        <ul className="ml-4 list-disc space-y-1">
          <li>แทบไม่ออกกำลังกาย: ×1.2</li>
          <li>ออกกำลังกายเบา (1-3 วัน/สัปดาห์): ×1.375</li>
          <li>ออกกำลังกายปานกลาง (3-5 วัน/สัปดาห์): ×1.55</li>
          <li>ออกกำลังกายหนัก (6-7 วัน/สัปดาห์): ×1.725</li>
          <li>หนักมาก/งานใช้แรงกาย: ×1.9</li>
        </ul>
      </Section>

      <Section title="เป้าหมายแคลอรี่ (ลด/คง/เพิ่มน้ำหนัก)">
        <p>ไขมันในร่างกาย 1 กก. ≈ 7,700 kcal — นี่คือตัวเลขมาตรฐานที่ใช้คำนวณว่าต้องกินเกิน/ขาดวันละเท่าไหร่เพื่อให้น้ำหนักเปลี่ยนตามอัตราที่ตั้งไว้</p>
        <Formula>ส่วนต่างต่อวัน = (อัตรา กก./สัปดาห์ × 7,700) ÷ 7</Formula>
        <p>เป้าหมายแคลอรี่ = TDEE ± ส่วนต่างนี้ (บวกถ้าเพิ่มน้ำหนัก ลบถ้าลด) และจะไม่มีวันแนะนำต่ำกว่า 1,200 kcal/วัน ไม่ว่าจะตั้งอัตราลดแรงแค่ไหน — เพดานความปลอดภัยขั้นต่ำ ไม่ใช่ค่าที่แนะนำให้กินจริง ถ้าจำเป็นต้องกินต่ำกว่านี้ควรอยู่ภายใต้การดูแลของแพทย์</p>
      </Section>

      <Section title="แมโคร (โปรตีน/คาร์บ/ไขมัน)">
        <ul className="ml-4 list-disc space-y-1">
          <li>โปรตีน: 1.8 กรัม ต่อน้ำหนักตัว 1 กก. (อยู่กลางช่วง 1.6-2.2 ก./กก. ที่แนะนำสำหรับคนออกกำลังกายสม่ำเสมอ)</li>
          <li>ไขมัน: 25% ของแคลอรี่เป้าหมายทั้งหมด</li>
          <li>คาร์บ: ส่วนที่เหลือหลังหักโปรตีนและไขมันแล้ว</li>
        </ul>
      </Section>

      <Section title="น้ำดื่ม">
        <Formula>พื้นฐาน = น้ำหนักตัว(กก.) × 33 มล.</Formula>
        <p>เป็นค่ากลางของช่วง 30-35 มล./กก. ที่ใช้กันทั่วไป</p>
      </Section>

      <Section title="ทำไมกิจกรรมวันนี้ถึงเพิ่มเป้าหมายให้">
        <p>วันที่มีกิจกรรม (ทั้งจาก Strava และบันทึกเอง) จะปรับเป้าหมายเพิ่มให้อัตโนมัติ นับเป็นบล็อกละ 30 นาที:</p>
        <ul className="ml-4 list-disc space-y-1">
          <li>น้ำ: +500 มล. ต่อ 30 นาที (สูงสุด +1.5 ลิตร/วัน)</li>
          <li>คาร์บ: +15 ก. ต่อ 30 นาที (สูงสุด +90 ก./วัน) — เติมไกลโคเจนที่ใช้ไป</li>
          <li>โปรตีน: +5 ก. ต่อ 30 นาที (สูงสุด +30 ก./วัน)</li>
        </ul>
        <p>
          คำนวณตามระยะเวลาอย่างเดียว ไม่แยกตามความหนักของกิจกรรม เพราะกิจกรรมที่บันทึกเองไม่มีข้อมูลความหนักเทียบเท่ากิจกรรมที่ซิงก์จาก Strava
          จึงใช้สูตรเดียวกันได้กับทั้งสองแบบ
        </p>
      </Section>

      <Section title="กราฟแนวโน้มน้ำหนักใช้ทำอะไร">
        <p>
          บันทึกน้ำหนักที่หน้าโภชนาการจะอัปเดตค่าน้ำหนักในโปรไฟล์ให้อัตโนมัติ ทำให้ BMR/TDEE คำนวณจากน้ำหนักล่าสุดเสมอ
          โดยไม่ต้องย้อนไปแก้ที่หน้าตั้งค่าทุกครั้ง
        </p>
      </Section>

      <p className="mt-2 text-xs text-neutral-600">
        ตัวเลขทั้งหมดเป็นค่าประมาณจากสูตรมาตรฐานทั่วไป ไม่ใช่คำแนะนำทางการแพทย์ — หากมีภาวะสุขภาพเฉพาะทาง ควรปรึกษาแพทย์หรือนักโภชนาการ
      </p>
    </main>
  );
}
