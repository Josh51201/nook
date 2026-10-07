import * as Haptics from "expo-haptics";

// Small touches of feedback used across Nooks.

// A gentle tap on the phone for things that "land": tucking a gift, picking
// up a Hearth tile, marking something bought. Never throws — some devices
// (and simulators) have no haptics.
export function tap(kind: "light" | "success" = "light") {
  const run =
    kind === "success"
      ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  run.catch(() => {});
}

// Database/network errors, in plain words. Anything unrecognised passes
// through — our own database messages are already written for people.
export function friendlyError(error: { message?: string; code?: string } | null | undefined) {
  const message = error?.message ?? "Something went wrong.";
  if (error?.code === "42501" || /row-level security/i.test(message)) {
    return "You don't have permission to do that.";
  }
  if (/network request failed|failed to fetch|fetch failed/i.test(message)) {
    return "Couldn't reach Nook — check your internet connection and try again.";
  }
  if (/JWT expired|invalid JWT|not authenticated/i.test(message)) {
    return "Your sign-in expired. Sign out and back in from Settings.";
  }
  if (/duplicate key/i.test(message)) {
    return "That's already there.";
  }
  return message;
}

// Run a screen's loader so it can never leave the screen spinning forever:
// a thrown error or a request that never answers (20 s) becomes a message,
// and `done` (hide the spinner) always runs.
export async function guarded(
  run: () => Promise<void>,
  fail: (message: string) => void,
  done: () => void,
  timeoutMs = 20000
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      run(),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error("Network request failed (timed out)")), timeoutMs);
      }),
    ]);
  } catch (error) {
    fail(friendlyError(error as { message?: string }));
  } finally {
    if (timer) clearTimeout(timer);
    done();
  }
}
