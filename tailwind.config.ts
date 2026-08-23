import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        strava: "#fc4c02",
      },
    },
  },
  plugins: [],
};

export default config;
