import type { MetadataRoute } from "next";

// Next.js serves this at /manifest.webmanifest and auto-injects the <link
// rel="manifest"> tag — no manual wiring needed in layout.tsx.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MooPaTa",
    short_name: "MooPaTa",
    description: "รวมข้อมูลการออกกำลังกายจาก Strava และ Huawei Health ไว้ที่เดียว",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#fc4c02",
    icons: [
      // public/logo.png is actually JPEG-encoded despite the extension —
      // browsers sniff the real bytes, so this still renders fine.
      { src: "/logo.png", sizes: "192x192", type: "image/jpeg" },
      { src: "/logo.png", sizes: "512x512", type: "image/jpeg" },
    ],
  };
}
