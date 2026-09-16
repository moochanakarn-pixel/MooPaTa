import { describe, expect, it } from "vitest";
import th from "./th.json";
import en from "./en.json";

// A message present in one locale but missing in the other falls back
// silently (or renders a raw key) instead of failing loudly — same class
// of easy-to-miss bug as the comma-thousands regressions this repo has
// hit twice in the AI-import parsers, so it gets the same "cheap test
// that fails fast" treatment.
function collectKeys(obj: unknown, prefix = ""): string[] {
  if (typeof obj !== "object" || obj === null) return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([key, value]) =>
    collectKeys(value, prefix ? `${prefix}.${key}` : key)
  );
}

describe("messages/th.json vs messages/en.json", () => {
  it("have exactly the same set of keys", () => {
    const thKeys = new Set(collectKeys(th));
    const enKeys = new Set(collectKeys(en));

    const missingFromEn = [...thKeys].filter((k) => !enKeys.has(k));
    const missingFromTh = [...enKeys].filter((k) => !thKeys.has(k));

    expect(missingFromEn, "keys present in th.json but missing from en.json").toEqual([]);
    expect(missingFromTh, "keys present in en.json but missing from th.json").toEqual([]);
  });
});
