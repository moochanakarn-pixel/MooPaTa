import bcrypt from "bcryptjs";

// Cost 12 — a common secure default that stays fast enough for a request
// handler on modest hardware while still being expensive to brute-force.
const BCRYPT_COST = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
