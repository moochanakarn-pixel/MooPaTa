import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MooPaTa",
  description: "รวมข้อมูลการออกกำลังกายจาก Strava และ Huawei Health ไว้ที่เดียว",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className="min-h-screen bg-neutral-950 text-neutral-100 antialiased">{children}</body>
    </html>
  );
}
