import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { RegisterServiceWorker } from "./register-sw";
import "./globals.css";

const fontSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("landing");
  return {
    title: "MooPaTa",
    description: t("tagline"),
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
}

export const viewport: Viewport = {
  themeColor: "#fc4c02",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} className={fontSans.variable}>
      <body className="min-h-screen bg-neutral-950 font-sans text-neutral-100 antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
          <RegisterServiceWorker />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
