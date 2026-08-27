const ICON_PATHS: Record<string, string> = {
  // running figure
  Run: "M13 4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm2.2 4.4-2 1-1.4 2.6 2.4 2.3-.6 4.7m-3.6-6 2.2-1.4L11 9M4 20l3.6-3.6 2.4-1",
  // bicycle
  Ride: "M6 18a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm12 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM9 15l3-7h4l2 4M12 8h3M6 15l3-7",
  VirtualRide: "M6 18a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm12 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM9 15l3-7h4l2 4M12 8h3M6 15l3-7",
  // footprints for walk/hike
  Walk: "M7 10a2 2 0 1 1 0-4 2 2 0 0 1 0 4Zm0 10c-.5-2 .5-4 2-5m8-1a2 2 0 1 1 0-4 2 2 0 0 1 0 4Zm0 10c.5-2-.5-4-2-5",
  Hike: "M7 10a2 2 0 1 1 0-4 2 2 0 0 1 0 4Zm0 10c-.5-2 .5-4 2-5m8-1a2 2 0 1 1 0-4 2 2 0 0 1 0 4Zm0 10c.5-2-.5-4-2-5",
  // wave for swim
  Swim: "M3 17c1.5 1.5 3 1.5 4.5 0s3-1.5 4.5 0 3 1.5 4.5 0 3-1.5 4.5 0M8 10l4-6 4 6M12 4v6",
  // dumbbell
  WeightTraining: "M4 9v6M20 9v6M7 12h10M2 10.5v3M22 10.5v3",
  // soccer ball (circle + pentagon panel)
  Football: "M4 12a8 8 0 1 0 16 0 8 8 0 1 0-16 0Z M12 8.8 10.1 10.2l.7 2.3h2.4l.7-2.3L12 8.8Z",
  Soccer: "M4 12a8 8 0 1 0 16 0 8 8 0 1 0-16 0Z M12 8.8 10.1 10.2l.7 2.3h2.4l.7-2.3L12 8.8Z",
  // racket head + handle, with a small shuttlecock
  Badminton: "M9 3a5 5 0 1 0 .1 0Z M9 8 4 20M13 10l3 2M16 10l-3 2",
};

const DEFAULT_ICON = "M12 3v18M5 8l7-5 7 5M5 16l7 5 7-5";

export function ActivityIcon({ type, className }: { type: string; className?: string }) {
  const path = ICON_PATHS[type] ?? DEFAULT_ICON;
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d={path} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
