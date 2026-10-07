import { describe, expect, it, vi } from "vitest";

vi.mock("../lib/supabase", () => ({ supabase: {} }));

const { countdown, formatPrice, sortGifts } = await import("../lib/gift-nook");

describe("Gift Nook helpers", () => {
  it("sorts Most wanted first, then newest", () => {
    const gifts = [
      { id: "old", is_most_wanted: false, created_at: "2026-01-01T00:00:00Z" },
      { id: "new", is_most_wanted: false, created_at: "2026-03-01T00:00:00Z" },
      { id: "star", is_most_wanted: true, created_at: "2025-01-01T00:00:00Z" },
    ];
    expect(sortGifts(gifts).map((g) => g.id)).toEqual(["star", "new", "old"]);
  });

  it("formats approximate prices", () => {
    expect(formatPrice(25)).toBe("~$25");
    expect(formatPrice(19.5)).toBe("~$19.50");
    expect(formatPrice(null)).toBeNull();
  });

  it("counts down to a Gathering by calendar day", () => {
    const now = new Date(2026, 11, 20, 22, 0); // Dec 20, 10pm local
    expect(countdown(new Date(2026, 11, 20, 23, 59).toISOString(), now)).toBe("today");
    expect(countdown(new Date(2026, 11, 21, 23, 59).toISOString(), now)).toBe("tomorrow");
    expect(countdown(new Date(2026, 11, 25, 23, 59).toISOString(), now)).toBe("in 5 days");
    expect(countdown(new Date(2026, 11, 17, 23, 59).toISOString(), now)).toBe("ended 3 days ago");
  });
});
