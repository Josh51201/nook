import { describe, expect, it } from "vitest";

import { cleanCode, friendlyCodeError, looksLikeEmail } from "../lib/sign-in";

describe("looksLikeEmail", () => {
  it("accepts a normal address, with spaces around it", () => {
    expect(looksLikeEmail("  grandma@example.com ")).toBe(true);
  });

  it("catches the usual slips", () => {
    expect(looksLikeEmail("grandma")).toBe(false);
    expect(looksLikeEmail("grandma@example")).toBe(false);
    expect(looksLikeEmail("grand ma@example.com")).toBe(false);
    expect(looksLikeEmail("")).toBe(false);
  });
});

describe("cleanCode", () => {
  it("keeps only the digits, so a pasted code with spaces still works", () => {
    expect(cleanCode("123 456")).toBe("123456");
    expect(cleanCode(" 12-34-56\n")).toBe("123456");
  });
});

describe("friendlyCodeError", () => {
  it("explains a wrong or expired code and what to do", () => {
    expect(friendlyCodeError("Token has expired or is invalid")).toMatch(/Send a new code/);
  });

  it("explains being rate limited", () => {
    expect(friendlyCodeError("For security purposes, you can only request this after 20 seconds")).toMatch(/Wait a minute/);
  });

  it("passes other problems through in plain words", () => {
    expect(friendlyCodeError("Network request failed")).toMatch(/internet connection/);
    expect(friendlyCodeError(undefined).length).toBeGreaterThan(0);
  });
});
