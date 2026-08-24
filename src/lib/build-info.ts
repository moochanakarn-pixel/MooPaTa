import { execSync } from "child_process";

export interface BuildInfo {
  commit: string;
  commitDate: string;
  subject: string;
}

let cached: BuildInfo | null | undefined;

// Reads the currently checked-out commit straight from git — no separate
// build step writes a version file, and there isn't one to keep in sync.
// Shown in Settings so "did my update actually take" is a glance instead of
// a guess: if this doesn't match what was just pushed, the running process
// is still on old code (stale dev server, `npm install` never rerun, etc.),
// not a defect in whatever was just fixed.
export function getBuildInfo(): BuildInfo | null {
  if (cached !== undefined) return cached;
  try {
    const out = execSync('git log -1 --format="%h|%ci|%s"', {
      cwd: process.cwd(),
      encoding: "utf8",
      timeout: 2000,
    }).trim();
    const [commit, commitDate, ...subjectParts] = out.split("|");
    cached = { commit, commitDate, subject: subjectParts.join("|") };
  } catch {
    cached = null;
  }
  return cached;
}
