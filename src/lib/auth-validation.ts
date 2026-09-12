// Deliberately simple — just enough to reject obvious typos before we
// bother hashing a password or sending an email; RFC-5322-complete email
// validation is a rabbit hole with no real payoff here, since the actual
// proof an address works is the verification link landing in it.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: unknown): email is string {
  return typeof email === "string" && email.length <= 254 && EMAIL_PATTERN.test(email);
}

export const MIN_PASSWORD_LENGTH = 8;

export function isValidPassword(password: unknown): password is string {
  return typeof password === "string" && password.length >= MIN_PASSWORD_LENGTH && password.length <= 200;
}
