import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        strava: "#fc4c02",
        // Every page/card/text color in this app is built from the
        // `neutral` scale (bg-neutral-950 for the page, bg-neutral-900 for
        // cards, text-neutral-100..600 for text) — the app was designed
        // dark-first, so low numbers were the *brightest* shades (near-white
        // text) and high numbers the *darkest* (near-black backgrounds).
        // This inverts that scale's actual colors (numbers keep the same
        // meaning to every component: 100 = highest-emphasis text, 950 =
        // page background) into a warm cream palette instead, so the whole
        // app reads as a light theme without touching any component.
        neutral: {
          100: "#2a2420",
          200: "#3d3630",
          300: "#524a42",
          400: "#6b6259",
          500: "#8a8175",
          600: "#aca294",
          700: "#d3c7b0",
          800: "#e8e0d0",
          900: "#fffdf8",
          950: "#f5efe1",
        },
        // These accent colors are used as *text* directly on the cream
        // background (badges, warnings, chart labels) at their light "300"
        // and "400" shades — tuned for legibility on a dark page, so on
        // cream they'd read as pale and low-contrast. Swapped in each
        // color's own default 700/600 hex here; every other shade (500,
        // 600, 900, etc. used for solid buttons/badge fills) is untouched
        // since those already read fine regardless of page background.
        red: { 300: "#b91c1c", 400: "#dc2626" },
        lime: { 300: "#4d7c0f", 400: "#65a30d" },
        amber: { 300: "#b45309", 400: "#d97706" },
        emerald: { 300: "#047857", 400: "#059669" },
        sky: { 300: "#0369a1", 400: "#0284c7" },
        orange: { 300: "#c2410c", 400: "#ea580c" },
        cyan: { 300: "#0e7490", 400: "#0891b2" },
        violet: { 300: "#6d28d9", 400: "#7c3aed" },
        rose: { 300: "#be123c", 400: "#e11d48" },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "glow-orange":
          "radial-gradient(600px circle at var(--x, 50%) var(--y, 0%), rgba(252,76,2,0.18), transparent 60%)",
      },
    },
  },
  plugins: [],
};

export default config;
