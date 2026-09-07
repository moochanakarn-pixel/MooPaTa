import type { MetadataRoute } from "next";

// Next.js serves this at /manifest.webmanifest and auto-injects the <link
// rel="manifest"> tag — no manual wiring needed in layout.tsx.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MooPaTa",
    short_name: "MooPaTa",
    description: "รวมข้อมูลการออกกำลังกายจาก Strava ไว้ที่เดียว",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f5efe1",
    theme_color: "#fc4c02",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
