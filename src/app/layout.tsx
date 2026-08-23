import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { RegisterServiceWorker } from "./register-sw";
import "./globals.css";

const fontSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MooPaTa",
  description: "รวมข้อมูลการออกกำลังกายจาก Strava และ Huawei Health ไว้ที่เดียว",
  icons: { icon: "/logo.png" },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MooPaTa",
  },
};

export const viewport: Viewport = {
  themeColor: "#fc4c02",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={fontSans.variable}>
      <body className="min-h-screen bg-neutral-950 font-sans text-neutral-100 antialiased">
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
