import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/session";
import { EmailAuthForm } from "./email-auth-form";

export default async function HomePage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const userId = await getSessionUserId();
  if (userId) redirect("/dashboard");

  const features = [
    {
      icon: ["M4 4v10a5 5 0 0 0 5 5h7M14 4l5 5-5 5"],
      color: "#fc4c02",
      title: "ซิงค์อัตโนมัติ",
      desc: "เชื่อม Strava ครั้งเดียว ซิงค์ให้เองทุก 30 นาที",
    },
    {
      icon: [
        "M5 4h10v3a5 5 0 0 1-5 5 5 5 0 0 1-5-5V4Z",
        "M5 5H3a2 2 0 0 0 2 4M15 5h2a2 2 0 0 1-2 4M10 12v3m-2.5 0h5",
      ],
      color: "#f59e0b",
      title: "สถิติและสถิติสูงสุด",
      desc: "PR ทุกประเภทกีฬา พร้อม streak รายวัน",
    },
    {
      icon: ["M3 18 8 8l4 6 3-4 6 8H3Z"],
      color: "#0ea5e9",
      title: "กราฟและ Heatmap",
      desc: "ดูความสม่ำเสมอย้อนหลังได้เป็นปี",
    },
    {
      // Same diary-book path used by the bottom nav's "ไดอารี่" tab, so the
      // landing page's promise and the in-app icon read as the same feature.
      icon: ["M5 3v14a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6.5L11.5 3H6a1 1 0 0 0-1 0Z M11 3v3.5a1 1 0 0 0 1 1H15M8 11h4M8 14h4"],
      color: "#22c55e",
      title: "บันทึกอาหาร น้ำ น้ำหนัก",
      desc: "คำนวณแคลอรี่และแมโครที่ควรได้ให้อัตโนมัติ",
    },
    {
      icon: ["M10 3.5c-2 0-3.5 1.5-3.5 3.5v2.3L5 12h10l-1.5-2.7V7c0-2-1.5-3.5-3.5-3.5Z", "M8.5 14a1.5 1.5 0 0 0 3 0"],
      color: "#8b5cf6",
      title: "แจ้งเตือนน้ำ+อาหารเสริม",
      desc: "เตือนตรงเวลา ไม่พลาดแม้วันยุ่ง",
    },
    {
      icon: ["M10 3v10m0 0 3.5-3.5M10 13l-3.5-3.5M4 15v1a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-1"],
      color: "#f43f5e",
      title: "แชร์การ์ดสวยๆ",
      desc: "สรุปกิจกรรมหรือโภชนาการ พร้อมโพสต์โซเชียล",
    },
  ];

  return (
    <main className="flex min-h-screen flex-col items-center">
      <div className="flex w-full flex-col items-center gap-5 rounded-b-[2.5rem] bg-[#fc4c02] px-6 pb-12 pt-16 text-center shadow-lg shadow-orange-950/10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icon-512.png"
          alt="MooPaTa"
          className="h-36 w-36 rounded-[1.75rem] ring-4 ring-white/25 drop-shadow-2xl"
        />
        <div className="space-y-2">
          <h1 className="text-5xl font-extrabold tracking-tight text-white">MooPaTa</h1>
          <p className="text-balance text-sm font-medium text-orange-50/90">
            รวมข้อมูลออกกำลังกายจาก Strava พร้อมบันทึกอาหาร น้ำ น้ำหนัก ไว้ที่เดียว
          </p>
        </div>
      </div>

      <div className="relative z-10 flex w-full max-w-md flex-1 flex-col items-center gap-8 px-6 py-10 text-center">
        <div className="grid w-full grid-cols-2 gap-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="flex flex-col items-start gap-2 rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-4 text-left"
            >
              <div
                className="flex h-9 w-9 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${f.color}1a`, color: f.color }}
              >
                <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                  {f.icon.map((d) => (
                    <path key={d} d={d} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  ))}
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-neutral-200">{f.title}</p>
                <p className="mt-0.5 text-xs leading-snug text-neutral-500">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {searchParams.error && (
          <p className="w-full rounded-xl border border-red-900/50 bg-red-950/50 px-4 py-3 text-sm text-red-300">
            เชื่อมต่อไม่สำเร็จ ({searchParams.error}) ลองใหม่อีกครั้ง
          </p>
        )}

        <div className="flex w-full flex-col gap-3">
          <a
            href="/api/auth/strava/connect"
            className="group flex items-center justify-center gap-2 rounded-xl bg-[#fc4c02] px-6 py-3.5 font-semibold text-white shadow-lg shadow-orange-950/30 transition hover:bg-[#e04402] hover:shadow-orange-950/50 active:scale-[0.98]"
          >
            เชื่อมต่อกับ Strava
            <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 transition group-hover:translate-x-0.5">
              <path d="M7 4l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>

        <div className="flex w-full items-center gap-3 text-xs text-neutral-600">
          <div className="h-px flex-1 bg-neutral-800" />
          หรือ
          <div className="h-px flex-1 bg-neutral-800" />
        </div>

        <EmailAuthForm />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-2 pb-8 text-xs text-neutral-600">
        <p>ข้อมูลของคุณถูกเข้ารหัสและเก็บไว้อย่างปลอดภัย</p>
        <p className="flex gap-3">
          <Link href="/privacy" className="hover:text-neutral-400">
            นโยบายความเป็นส่วนตัว
          </Link>
          <span>·</span>
          <Link href="/terms" className="hover:text-neutral-400">
            ข้อกำหนดการใช้งาน
          </Link>
        </p>
      </div>
    </main>
  );
}
