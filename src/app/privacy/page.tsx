import Link from "next/link";

export const metadata = { title: "นโยบายความเป็นส่วนตัว — MooPaTa" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-neutral-300">
      <Link href="/" className="mb-8 inline-block text-sm text-neutral-500 hover:text-neutral-300">
        ← กลับหน้าแรก
      </Link>
      <h1 className="mb-2 text-2xl font-bold text-white">นโยบายความเป็นส่วนตัว</h1>
      <p className="mb-8 text-sm text-neutral-500">ปรับปรุงล่าสุด: 2026</p>

      <div className="space-y-6 text-sm leading-relaxed">
        <section>
          <h2 className="mb-2 font-semibold text-white">ข้อมูลที่เก็บ</h2>
          <p>เมื่อเชื่อมต่อบัญชี Strava กับ MooPaTa เราจะเก็บข้อมูลต่อไปนี้:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-neutral-400">
            <li>ชื่อและรูปโปรไฟล์จากบัญชี Strava ของคุณ</li>
            <li>
              ข้อมูล activity ที่ Strava อนุญาตให้เข้าถึง เช่น ระยะทาง เวลา อัตราการเต้นหัวใจ ความเร็ว
              เส้นทาง GPS ระดับความสูง และสถิติอื่นๆ ที่เกี่ยวข้อง
            </li>
            <li>
              Access token / refresh token ของ Strava (เข้ารหัสด้วย AES-256-GCM ก่อนเก็บ ไม่เก็บเป็นข้อความธรรมดา)
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 font-semibold text-white">การใช้ข้อมูล</h2>
          <p className="text-neutral-400">
            ข้อมูลถูกใช้เพื่อแสดงผล dashboard, สถิติ และรายละเอียด activity ของคุณเองภายในแอพเท่านั้น
            เราไม่ขาย ไม่แชร์ หรือใช้ข้อมูลของคุณเพื่อโฆษณา และไม่ส่งต่อให้บุคคลที่สามใดๆ
            นอกเหนือจากการเรียก API ของ Strava เองซึ่งจำเป็นต่อการทำงานของแอพ
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-semibold text-white">การเก็บรักษาและความปลอดภัย</h2>
          <p className="text-neutral-400">
            ข้อมูลถูกเก็บในฐานข้อมูลของผู้ดูแลระบบแอพนี้จนกว่าคุณจะลบบัญชี Token ทุกตัวเข้ารหัสไว้ที่ฐานข้อมูล
            แต่โปรดทราบว่านี่คือโปรเจกต์ส่วนบุคคล ไม่ได้ผ่านการตรวจสอบความปลอดภัยระดับองค์กร
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-semibold text-white">สิทธิ์ของคุณ</h2>
          <p className="text-neutral-400">
            คุณสามารถยกเลิกการเชื่อมต่อ Strava หรือลบบัญชีพร้อมข้อมูลทั้งหมดได้ทุกเมื่อจากหน้า{" "}
            <Link href="/dashboard/settings" className="text-[#fc4c02] hover:underline">
              ตั้งค่า
            </Link>{" "}
            การลบบัญชีจะลบข้อมูล activity ทั้งหมดถาวรและกู้คืนไม่ได้
          </p>
        </section>
      </div>
    </main>
  );
}
