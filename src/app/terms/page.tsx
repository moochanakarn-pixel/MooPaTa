import Link from "next/link";

export const metadata = { title: "ข้อกำหนดการใช้งาน — MooPaTa" };

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-neutral-300">
      <Link href="/" className="mb-8 inline-block text-sm text-neutral-500 hover:text-neutral-300">
        ← กลับหน้าแรก
      </Link>
      <h1 className="mb-2 text-2xl font-bold text-white">ข้อกำหนดการใช้งาน</h1>
      <p className="mb-8 text-sm text-neutral-500">ปรับปรุงล่าสุด: 2026</p>

      <div className="space-y-6 text-sm leading-relaxed text-neutral-400">
        <section>
          <h2 className="mb-2 font-semibold text-white">เกี่ยวกับบริการ</h2>
          <p>
            MooPaTa เป็นโปรเจกต์ส่วนบุคคลที่รวมข้อมูลการออกกำลังกายจาก Strava (และในอนาคตคือ Huawei Health) มาแสดงผลในที่เดียว
            ให้บริการ &quot;ตามสภาพ&quot; (as-is) ไม่มีการรับประกันความถูกต้อง ความต่อเนื่อง หรือความพร้อมใช้งานของบริการ
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-semibold text-white">ความรับผิดชอบของผู้ใช้</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>คุณต้องมีบัญชี Strava ของตัวเองและยินยอมให้ MooPaTa เข้าถึงข้อมูลผ่าน Strava OAuth</li>
            <li>การใช้งานต้องเป็นไปตาม Strava API Agreement ของ Strava เอง</li>
            <li>ห้ามใช้แอพนี้ในทางที่ผิดกฎหมายหรือละเมิดสิทธิ์ผู้อื่น</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 font-semibold text-white">ข้อจำกัดความรับผิด</h2>
          <p>
            ผู้พัฒนาไม่รับผิดชอบต่อความเสียหายใดๆ ที่เกิดจากการใช้งานหรือความขัดข้องของบริการ รวมถึงข้อมูลสูญหายหรือคลาดเคลื่อน
            บริการอาจถูกปรับปรุง ระงับ หรือยกเลิกได้โดยไม่ต้องแจ้งล่วงหน้า
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-semibold text-white">การยกเลิก</h2>
          <p>
            คุณสามารถหยุดใช้งานและลบบัญชีได้ทุกเมื่อจากหน้า{" "}
            <Link href="/dashboard/settings" className="text-[#fc4c02] hover:underline">
              ตั้งค่า
            </Link>{" "}
            ดูรายละเอียดการจัดการข้อมูลเพิ่มเติมที่{" "}
            <Link href="/privacy" className="text-[#fc4c02] hover:underline">
              นโยบายความเป็นส่วนตัว
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
