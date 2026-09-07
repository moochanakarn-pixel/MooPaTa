// The MooPaTa mascot — a pig wearing a headband with an "M" mark, eating
// from a bowl, in the app's own brand colors. Two variants:
// - PigMascotFace: just the head + bowl, transparent background, for
//   inline use (empty states, etc.) at any size.
// - PigMascotIcon: the full brand mark (face + bowl + four small stat
//   icons on a connecting ring) on a rounded-square card background — used
//   for the landing page hero and as the source for the generated app
//   icons (see scripts/render-icons.mjs, which renders this same markup).
const NAVY = "#1e2a44";
const NAVY_DARK = "#141c33";
const PINK = "#ffcdc2";
const PINK_DARK = "#ff9e8c";
const CREAM = "#fefcf8";
const ORANGE = "#fc4c02";

function PigMascotFaceShapes() {
  return (
    <>
      <ellipse cx="73" cy="63" rx="15" ry="19" fill={PINK} stroke={NAVY} strokeWidth="3" transform="rotate(-22 73 63)" />
      <ellipse cx="127" cy="63" rx="15" ry="19" fill={PINK} stroke={NAVY} strokeWidth="3" transform="rotate(22 127 63)" />

      <circle cx="100" cy="99" r="38" fill={PINK} stroke={NAVY} strokeWidth="3.4" />

      <path d="M65 85 A38 38 0 0 1 135 85" stroke={NAVY} strokeWidth="14" strokeLinecap="round" fill="none" />
      <path d="M87 92 L87 82 L100 89 L113 82 L113 92" stroke={CREAM} strokeWidth="4.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />

      <circle cx="86" cy="98" r="3.4" fill={NAVY} />
      <circle cx="114" cy="98" r="3.4" fill={NAVY} />

      <ellipse cx="100" cy="114" rx="16" ry="11" fill={PINK_DARK} stroke={NAVY} strokeWidth="2.6" />
      <ellipse cx="94" cy="114" rx="2.8" ry="4" fill={NAVY} />
      <ellipse cx="106" cy="114" rx="2.8" ry="4" fill={NAVY} />

      <path d="M89 106 Q100 112 111 106" stroke={NAVY} strokeWidth="2.4" fill="none" strokeLinecap="round" />

      <path d="M58 152 Q58 165 100 165 Q142 165 142 152 Z" fill={NAVY} />
      <ellipse cx="100" cy="152" rx="42" ry="11" fill={NAVY_DARK} />
      <ellipse cx="94" cy="142" rx="30" ry="12" fill={CREAM} />
      <path d="M112 127 Q126 125 130 137 Q132 147 120 150 Q108 152 106 141 Q105 131 112 127Z" fill="#4caf50" />
      <path d="M118 144 Q130 139 137 148 Q139 154 132 156 L116 153Z" fill={ORANGE} />
    </>
  );
}

export function PigMascotFace({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 165" className={className}>
      <PigMascotFaceShapes />
    </svg>
  );
}

export function PigMascotIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className}>
      <rect width="200" height="200" rx="44" fill={CREAM} />

      <path d="M42 46 A85 85 0 0 1 158 46" stroke={NAVY} strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M170 62 A85 85 0 0 1 170 148" stroke={NAVY} strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M158 164 A85 85 0 0 1 42 164" stroke={NAVY} strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M30 148 A85 85 0 0 1 30 62" stroke={NAVY} strokeWidth="3" fill="none" strokeLinecap="round" />

      <g transform="translate(40 40)">
        <path d="M0 -16 C9 -16 16 -9 16 0 C16 10 0 22 0 22 C0 22 -16 10 -16 0 C-16 -9 -9 -16 0 -16Z" fill={ORANGE} />
        <circle cx="0" cy="-1" r="6" fill={CREAM} />
      </g>

      <g transform="translate(155 45)">
        <rect x="-20" y="2" width="7" height="12" rx="1.5" fill={NAVY} />
        <rect x="-9" y="-6" width="7" height="20" rx="1.5" fill={NAVY} />
        <rect x="2" y="-16" width="7" height="30" rx="1.5" fill={ORANGE} />
        <path d="M-20 -10 L14 -24 M14 -24 L4 -23 M14 -24 L15 -14" stroke={ORANGE} strokeWidth="3.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      <g transform="translate(163 155)">
        <path d="M0 15 C-16 4 -18 -10 -8 -14 C-2 -16 0 -10 0 -8 C0 -10 2 -16 8 -14 C18 -10 16 4 0 15Z" fill={ORANGE} />
        <path d="M-11 0 L-5 0 L-2 -6 L2 6 L5 0 L11 0" stroke={CREAM} strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      <g transform="translate(37 158)">
        <rect x="-13" y="-19" width="8" height="6" rx="2" fill={NAVY} />
        <rect x="-13" y="13" width="8" height="6" rx="2" fill={NAVY} />
        <rect x="-15" y="-15" width="30" height="30" rx="8" fill={NAVY} />
        <path d="M0 -6 C4 -2 5 2 2 5 C4 3 3 0 0 -1 C1 2 -3 4 -3 1 C-4 -1 -2 -4 0 -6Z" fill={ORANGE} />
      </g>

      <g transform="translate(0 5)">
        <PigMascotFaceShapes />
      </g>
    </svg>
  );
}
