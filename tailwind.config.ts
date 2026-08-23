import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        strava: "#fc4c02",
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
