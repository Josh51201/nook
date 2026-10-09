import { describe, expect, it } from "vitest";

import { helpAnswers, helpFor } from "../lib/help";
import { nookCatalog } from "../lib/nooks";

describe("helpFor", () => {
  it("has something to say about each tab and the main screens", () => {
    for (const path of ["/hearth", "/nooks", "/burrows", "/settings", "/inbox", "/market", "/home", "/profile", "/help"]) {
      const topic = helpFor(path);
      expect(topic.title.length, path).toBeGreaterThan(0);
      expect(topic.body.length, path).toBeGreaterThan(20);
    }
  });

  it("says something specific about the Gift Nook's own pages", () => {
    expect(helpFor("/gift-nook/wishbook").title).toBe("My Wishbook");
    expect(helpFor("/gift-nook/gathering/abc").title).toBe("A Gathering");
  });

  it("falls back to the Nook's own description for its other screens", () => {
    for (const nook of nookCatalog.filter((n) => n.available && n.route)) {
      expect(helpFor(`${nook.route}/something-new`).body, nook.id).toBe(nook.description);
    }
  });

  it("ignores a query string and never comes back empty", () => {
    expect(helpFor("/inbox?nook=gift-nook").title).toBe("Inbox");
    expect(helpFor("/not-a-real-screen").body.length).toBeGreaterThan(0);
    expect(helpFor("/").title).toBe("Your Hearth");
  });
});

describe("helpAnswers", () => {
  it("explains the owner never seeing claims without revealing anything", () => {
    const answer = helpAnswers.find((a) => a.question.includes("who bought"));
    expect(answer?.answer).toMatch(/never told/);
  });

  it("has an answer for every question", () => {
    for (const item of helpAnswers) {
      expect(item.question.endsWith("?") || item.question.length > 5).toBe(true);
      expect(item.answer.length).toBeGreaterThan(30);
    }
  });
});
