import type { CSSProperties } from "react";

// Shared visual language for the story-ratio (1080x1920) share cards
// (src/app/api/share/{daily-summary,nutrition,period}/route.tsx) — each
// route renders a stack of distinct stat "cards" spaced out with
// justifyContent: "space-around" down the canvas; without this bordered-box
// treatment, the same spacing just reads as text floating in empty space
// rather than a deliberately laid-out list of cards.
export const cardStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  background: "rgba(255,255,255,0.045)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 32,
  padding: "40px 44px",
};

export const rowCardStyle: CSSProperties = { ...cardStyle, flexDirection: "row", gap: 32 };

export const titleStyle: CSSProperties = { fontSize: 27, fontWeight: 700, color: "#c9c9c4", letterSpacing: 0.5 };

export function iconCircleStyle(bg: string): CSSProperties {
  return {
    width: 84,
    height: 84,
    flexShrink: 0,
    borderRadius: 24,
    background: bg,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };
}
