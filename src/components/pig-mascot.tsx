// The MooPaTa mascot — a small pig wearing a headband, matching the app's
// name (หมูปะทะ) and its orange/cream brand palette. Kept as flat shapes
// (circles/ellipses/arcs, no freehand paths) so it stays crisp and legible
// down to favicon size.
export function PigMascotFace({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" fill="none" className={className}>
      <ellipse cx="27" cy="27" rx="14" ry="17" fill="#ffb6a3" transform="rotate(-25 27 27)" />
      <ellipse cx="73" cy="27" rx="14" ry="17" fill="#ffb6a3" transform="rotate(25 73 27)" />
      <ellipse cx="27" cy="27" rx="6.5" ry="9.5" fill="#ff9686" transform="rotate(-25 27 27)" />
      <ellipse cx="73" cy="27" rx="6.5" ry="9.5" fill="#ff9686" transform="rotate(25 73 27)" />

      <circle cx="50" cy="57" r="34" fill="#ffb6a3" />

      <path d="M17 45 A34 34 0 0 1 83 45" stroke="#2a2420" strokeWidth="13" strokeLinecap="round" />
      <path d="M38 42 L38 33 L50 40 L62 33 L62 42" stroke="#fffdf8" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />

      <circle cx="39" cy="56" r="3.4" fill="#2a2420" />
      <circle cx="61" cy="56" r="3.4" fill="#2a2420" />

      <ellipse cx="50" cy="71" rx="14" ry="10" fill="#ff9686" />
      <ellipse cx="45" cy="71" rx="2.6" ry="3.6" fill="#2a2420" />
      <ellipse cx="55" cy="71" rx="2.6" ry="3.6" fill="#2a2420" />

      <path d="M41 63 Q50 69 59 63" stroke="#2a2420" strokeWidth="2.4" fill="none" strokeLinecap="round" />
    </svg>
  );
}

// Full app-icon mark: the face on the brand's orange gradient, rounded
// square background — used wherever a standalone icon is needed (the
// generated PNGs for the manifest/favicon are rendered from this same
// markup, see scripts/render-icons.mjs).
export function PigMascotIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className}>
      <defs>
        <linearGradient id="pigIconBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ff8a3d" />
          <stop offset="100%" stopColor="#fc4c02" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="22" fill="url(#pigIconBg)" />
      <g transform="translate(8 6) scale(0.84)">
        <PigMascotFace />
      </g>
    </svg>
  );
}
