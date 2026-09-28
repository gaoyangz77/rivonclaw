/**
 * The sign-in credentials an owner hands to a business developer (ADR 085).
 *
 * The backend stores only a bcrypt hash of the password, so the Panel is the
 * one place the plain password exists, and only until the one-time login-info
 * card closes. These helpers produce the default password and the text the
 * owner copies to send it on; neither keeps anything.
 */

/** Letters and digits without the look-alikes 0/O/o, 1/l/I and i. */
const UPPERCASE = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWERCASE = "abcdefghjkmnpqrstuvwxyz";
const DIGITS = "23456789";

export const LOGIN_PASSWORD_ALPHABET = `${UPPERCASE}${LOWERCASE}${DIGITS}`;

/** 16 characters over 55 symbols: about 92 bits of entropy. */
export const GENERATED_LOGIN_PASSWORD_LENGTH = 16;

/** Fills an array with cryptographically random values, like `crypto.getRandomValues`. */
export type RandomFill = (array: Uint32Array) => Uint32Array;

const UINT32_RANGE = 2 ** 32;

function defaultRandomFill(array: Uint32Array): Uint32Array {
  return crypto.getRandomValues(array);
}

function hasEveryCharacterClass(password: string): boolean {
  return [UPPERCASE, LOWERCASE, DIGITS].every((charset) =>
    Array.from(password).some((char) => charset.includes(char)),
  );
}

/**
 * A random password from `LOGIN_PASSWORD_ALPHABET` with at least one
 * uppercase letter, one lowercase letter and one digit, so it also passes the
 * owner sign-up rules should the BD ever reuse it there.
 *
 * Random words at or above the largest multiple of the alphabet size are
 * rejected, so every character is uniformly distributed (no modulo bias).
 */
export function generateLoginPassword(
  length: number = GENERATED_LOGIN_PASSWORD_LENGTH,
  fill: RandomFill = defaultRandomFill,
): string {
  if (!Number.isInteger(length) || length < 3) {
    throw new Error(`A generated login password needs at least 3 characters, got ${length}`);
  }
  const alphabetSize = LOGIN_PASSWORD_ALPHABET.length;
  const acceptBelow = UINT32_RANGE - (UINT32_RANGE % alphabetSize);
  const words = new Uint32Array(length);

  for (;;) {
    let password = "";
    while (password.length < length) {
      fill(words);
      for (const word of words) {
        if (word >= acceptBelow) continue;
        password += LOGIN_PASSWORD_ALPHABET[word % alphabetSize];
        if (password.length === length) break;
      }
    }
    if (hasEveryCharacterClass(password)) return password;
  }
}

export interface LoginCredentialsText {
  /** First line, e.g. "TK Copilot login for Maria". */
  heading: string;
  /** How to sign in, one line. */
  instructions: string;
  emailLabel: string;
  email: string;
  passwordLabel: string;
  password: string;
}

/**
 * The ready-to-send message the login-info card's "Copy all" puts on the
 * clipboard: heading, instructions, then one `label: value` line per field.
 * Values are appended verbatim rather than interpolated through i18n so no
 * password character can be read as formatting.
 */
export function buildLoginCredentialsText(parts: LoginCredentialsText): string {
  return [
    parts.heading,
    parts.instructions,
    `${parts.emailLabel}: ${parts.email}`,
    `${parts.passwordLabel}: ${parts.password}`,
  ].join("\n");
}
