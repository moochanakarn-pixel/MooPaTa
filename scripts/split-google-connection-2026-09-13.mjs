// Undoes one specific Google merge from merge-accounts-2026-09-13.mjs — use
// this when two Google accounts got merged together but should actually
// stay separate (e.g. a personal Gmail vs. a work Google account that
// happen to share a display name). Moves ONE ProviderConnection (identified
// by its Google providerAccountId — get this from
// identify-google-connections-2026-09-13.mjs) out to a brand-new User.
//
// Safe to run even though the connection currently sits on a user with
// other data: only the ProviderConnection row is moved, nothing else is
// touched, and the new user starts blank. The next time that Google
// account logs in, its name/avatar get filled in automatically (same as
// any first-time Google login) via src/app/api/auth/google/callback.
//
// Usage:
//   node scripts/split-google-connection-2026-09-13.mjs           # dry run
//   node scripts/split-google-connection-2026-09-13.mjs --apply   # write

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const APPLY = process.argv.includes("--apply");

// Fill in from identify-google-connections-2026-09-13.mjs's output.
const PROVIDER_ACCOUNT_ID = "TODO_FILL_IN"; // the Google "sub" to split out (e.g. chanakarn@synaturegroup.com's)

async function main() {
  if (PROVIDER_ACCOUNT_ID === "TODO_FILL_IN") {
    console.error("Edit this script first: fill in PROVIDER_ACCOUNT_ID (see scripts/identify-google-connections-2026-09-13.mjs).");
    process.exit(1);
  }

  const connection = await db.providerConnection.findUnique({
    where: { provider_providerAccountId: { provider: "GOOGLE", providerAccountId: PROVIDER_ACCOUNT_ID } },
    include: { user: true },
  });
  if (!connection) {
    console.error(`No GOOGLE ProviderConnection found with providerAccountId ${PROVIDER_ACCOUNT_ID}`);
    process.exit(1);
  }

  console.log(APPLY ? "*** APPLY MODE — will write changes ***" : "Dry run — no changes will be written (pass --apply to write)");
  console.log(`Splitting connection ${connection.id} (Google sub ${PROVIDER_ACCOUNT_ID}) OUT of user ${connection.userId} (${connection.user.name ?? "?"}) into a brand-new user`);

  if (!APPLY) {
    console.log("Dry run complete — re-run with --apply once you've confirmed this is the right connection.");
    await db.$disconnect();
    return;
  }

  const newUser = await db.user.create({ data: {} });
  await db.providerConnection.update({ where: { id: connection.id }, data: { userId: newUser.id } });

  console.log(`Done. Created new user ${newUser.id} and moved the connection to it.`);
  console.log("Next Google login with that account will land on this new, empty user and fill in its name/avatar automatically.");

  await db.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await db.$disconnect();
  process.exit(1);
});
