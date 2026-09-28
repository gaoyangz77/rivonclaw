import { describe, expect, it } from "vitest";
import {
  buildLoginCredentialsText,
  GENERATED_LOGIN_PASSWORD_LENGTH,
  generateLoginPassword,
  LOGIN_PASSWORD_ALPHABET,
} from "./affiliate-login-credentials.js";

/** A fill that replays `values` in order, wrapping around. */
function replay(values: number[]) {
  let index = 0;
  return (array: Uint32Array) => {
    for (let i = 0; i < array.length; i += 1) {
      array[i] = values[index % values.length]!;
      index += 1;
    }
    return array;
  };
}

describe("generateLoginPassword", () => {
  it("is 16 characters long by default and has no ambiguous characters", () => {
    expect(GENERATED_LOGIN_PASSWORD_LENGTH).toBeGreaterThanOrEqual(14);
    for (const ambiguous of ["0", "O", "o", "1", "l", "I", "i"]) {
      expect(LOGIN_PASSWORD_ALPHABET).not.toContain(ambiguous);
    }
    for (let run = 0; run < 200; run += 1) {
      const password = generateLoginPassword();
      expect(password).toHaveLength(GENERATED_LOGIN_PASSWORD_LENGTH);
      expect(Array.from(password).every((char) => LOGIN_PASSWORD_ALPHABET.includes(char))).toBe(
        true,
      );
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/[a-z]/);
      expect(password).toMatch(/[2-9]/);
    }
  });

  it("does not repeat itself", () => {
    const passwords = new Set(Array.from({ length: 50 }, () => generateLoginPassword()));
    expect(passwords.size).toBe(50);
  });

  it("maps random words onto the alphabet and skips words that would bias it", () => {
    const size = LOGIN_PASSWORD_ALPHABET.length;
    const biased = 2 ** 32 - 1; // above the largest multiple of the alphabet size
    const upper = 0; // "A"
    const lower = LOGIN_PASSWORD_ALPHABET.indexOf("b");
    const digit = LOGIN_PASSWORD_ALPHABET.indexOf("7") + size; // wraps to "7"

    expect(generateLoginPassword(3, replay([upper, biased, lower, digit]))).toBe("Ab7");
  });

  it("draws again until every character class is present", () => {
    const upper = 0; // "A"
    const lower = LOGIN_PASSWORD_ALPHABET.indexOf("b");
    const digit = LOGIN_PASSWORD_ALPHABET.indexOf("7");

    expect(generateLoginPassword(3, replay([upper, upper, upper, upper, lower, digit]))).toBe(
      "Ab7",
    );
  });

  it("refuses a length too short to hold every character class", () => {
    expect(() => generateLoginPassword(2)).toThrow(/at least 3 characters/);
  });
});

describe("buildLoginCredentialsText", () => {
  it("puts the heading, instructions, email and password on their own lines", () => {
    expect(
      buildLoginCredentialsText({
        heading: "TK Copilot login for Maria",
        instructions: "Open the TK Copilot desktop app and sign in with this email and password.",
        emailLabel: "Email",
        email: "maria@example.com",
        passwordLabel: "Password",
        password: "{{x}}$&",
      }),
    ).toBe(
      [
        "TK Copilot login for Maria",
        "Open the TK Copilot desktop app and sign in with this email and password.",
        "Email: maria@example.com",
        "Password: {{x}}$&",
      ].join("\n"),
    );
  });
});
