// MooPaTa app mark: an "M" crossed by a winding route, green-to-blue —
// echoes the multi-sport (run/ride/hike) tracking theme rather than a
// single heart-rate motif. Keep in sync with src/app/icon.svg by hand;
// that file can't import this component since Next.js serves it as a
// static asset.
export function Logo({
  className,
  "aria-hidden": ariaHidden,
}: {
  className?: string;
  "aria-hidden"?: boolean;
}) {
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden={ariaHidden}>
      <rect width="200" height="200" rx="44" fill="#0b0f19" />
      <defs>
        <linearGradient id="moopata-route" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#22c55e" />
          <stop offset="100%" stopColor="#0ea5e9" />
        </linearGradient>
      </defs>
      <text
        x="100"
        y="138"
        fontFamily="Arial, sans-serif"
        fontWeight="800"
        fontSize="128"
        fill="#ffffff"
        textAnchor="middle"
      >
        M
      </text>
      <path
        d="M42 158 C 66 150, 62 118, 96 110 S 150 78, 158 46"
        fill="none"
        stroke="url(#moopata-route)"
        strokeWidth="16"
        strokeLinecap="round"
      />
      <circle cx="158" cy="42" r="12" fill="#4ade80" />
    </svg>
  );
}
