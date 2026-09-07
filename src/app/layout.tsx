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
  description: "รวมข้อมูลการออกกำลังกายจาก Strava ไว้ที่เดียว",
  icons: { icon: "/icon-32.png", apple: "/icon-180.png" },
  appleWebApp: {
    capable: true,
    // "black-translucent" draws white status-bar icons over the page —
    // right for a dark theme, but invisible against the cream background
    // now. "default" gives dark icons, which read on a light page.
    statusBarStyle: "default",
    title: "MooPaTa",
  },
};

export const viewport: Viewport = {
  themeColor: "#fc4c02",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
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
