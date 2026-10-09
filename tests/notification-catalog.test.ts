import { describe, expect, it, vi } from "vitest";

vi.mock("../lib/supabase", () => ({ supabase: {} }));
vi.mock("../lib/auth-context", () => ({ useAuth: () => ({ session: null }) }));

import { findNook } from "../lib/nooks";
import { isOn, notificationCatalog, onSummary } from "../lib/notification-catalog";

describe("the one-place Notifications list (CORE-090)", () => {
  it("lists every notify switch of every Nook, and nothing that doesn't exist", () => {
    for (const entry of notificationCatalog) {
      const listed = entry.switches.map((s) => s.key).sort();
      const real = Object.keys(entry.defaults).filter((k) => k.startsWith("notify")).sort();
      expect(listed, entry.nook).toEqual(real);
    }
  });

  it("only names Nooks that exist, once each", () => {
    const ids = notificationCatalog.map((e) => e.nook);
    expect(new Set(ids).size).toBe(ids.length);
    for (const entry of notificationCatalog) expect(findNook(entry.nook) ?? entry.label, entry.nook).toBeDefined();
  });

  it("reads a switch from what's saved, else the Nook's default", () => {
    const pets = notificationCatalog.find((e) => e.nook === "pets")!;
    expect(isOn(pets, {}, "notifyMissed")).toBe(true);
    expect(isOn(pets, {}, "notifyFed")).toBe(false);
    expect(isOn(pets, { notifyMissed: false, notifyFed: true }, "notifyMissed")).toBe(false);
    expect(isOn(pets, { notifyFed: true }, "notifyFed")).toBe(true);
  });

  it("sums a Nook up in a few words", () => {
    const pets = notificationCatalog.find((e) => e.nook === "pets")!;
    expect(onSummary(pets, {})).toBe("2 of 3 on");
    expect(onSummary(pets, { notifyFed: true })).toBe("All on");
    expect(onSummary(pets, { notifyMissed: false, notifyDue: false })).toBe("All off");
    const letterbox = notificationCatalog.find((e) => e.nook === "letterbox")!;
    expect(onSummary(letterbox, {})).toBe("On");
    expect(onSummary(letterbox, { notifyBirthdays: false })).toBe("Off");
  });
});
