import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

// Unit tests only, for pure business logic (nutrition math, exercise-stats
// aggregation, AI-import text parsers, etc.) — no React rendering, no real
// database, no Next.js dev server. Anything that needs those (a page
// actually rendering, a route actually hitting MariaDB, a share card
// actually producing a PNG) is still verified the existing way: seed real
// data, curl/Playwright the running `npm run start` server, per
// CLAUDE.md's workflow. tsconfigPaths() resolves the same "@/*" -> "src/*"
// alias tsconfig.json declares, so test files can import with the same
// paths the app code itself uses.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    include: ["src/**/*.test.ts", "messages/**/*.test.ts"],
  },
});
