// Small helpers for the emailed-code sign-in (AUTH-001, CORE-071). Pure (no
// React), so they're unit-testable.

// How long to wait before offering a new code (so nobody taps it ten times).
export const RESEND_SECONDS = 60;

// Not a real check (only the email's owner can pass that) — just catches the
// slip of a missing @ or a space before we send anything.
export function looksLikeEmail(text: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text.trim());
}

// What was typed or pasted, down to its digits ("123 456" → "123456").
export function cleanCode(text: string) {
  return text.replace(/\D/g, "");
}

// A wrong or old code, in plain words, with what to do about it.
export function friendlyCodeError(message: string | undefined) {
  if (message && /expired|invalid|incorrect|not found/i.test(message)) {
    return "That code didn't work. It may have been typed a little wrong, or it may be an old one — check the newest email, or tap “Send a new code”.";
  }
  if (message && /rate limit|too many|seconds/i.test(message)) {
    return "That's a lot of tries! Wait a minute, then try again.";
  }
  if (message && /network request failed|failed to fetch|fetch failed/i.test(message)) {
    return "Couldn't reach Nook — check your internet connection and try again.";
  }
  return message ?? "Something went wrong. Please try again.";
}
