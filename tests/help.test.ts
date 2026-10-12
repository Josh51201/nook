import { describe, expect, it } from "vitest";

import { helpAnswers, helpFor, helpSectionFor, helpSections, helpWords, searchHelp } from "../lib/help";
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
    expect(helpFor("/gift-nook/gathering/abc").title).toBe("A Gathering's gift lists");
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

describe("the Help page (CORE-102)", () => {
  it("has its own questions for every Nook you can open", () => {
    for (const nook of nookCatalog.filter((n) => n.available && n.route)) {
      const section = helpSections.find((s) => s.nook === nook.id);
      expect(section, nook.id).toBeDefined();
      expect(section!.answers.length, nook.id).toBeGreaterThanOrEqual(2);
    }
  });

  it("starts new people off, and has no repeats", () => {
    expect(helpSections[0].id).toBe("start");
    const ids = helpSections.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    const questions = helpAnswers.map((a) => a.question);
    expect(new Set(questions).size).toBe(questions.length);
    for (const item of helpAnswers) expect(item.answer.length, item.question).toBeGreaterThan(30);
  });

  it("explains the Nook words an answer might use", () => {
    const words = helpWords.map((w) => w.word);
    for (const word of ["Nook", "Hearth", "Burrow", "Knock", "Home", "Gathering", "Wishbook", "Tuck", "Nudge"]) {
      expect(words, word).toContain(word);
    }
  });

  it("GIFT-007: says what a tuck is and that the owner is never told, without hinting at any", () => {
    const answer = helpAnswers.find((a) => a.question === "Why can't I see who's getting me what?")!;
    expect(answer.answer).toMatch(/I'll get this/);
    expect(answer.answer).toMatch(/never told/);
  });
});

describe("searchHelp", () => {
  it("finds answers with every word typed, best matches first", () => {
    expect(searchHelp("")).toEqual([]);
    expect(searchHelp("knock code").some((a) => a.question === "How do I join my family?")).toBe(true);
    const tuck = searchHelp("tuck");
    expect(tuck[0].question.toLowerCase()).toContain("tuck");
    expect(searchHelp("zzzz nothing")).toEqual([]);
  });
});

describe("helpSectionFor", () => {
  it("opens Help on the Nook (or part of the app) you came from", () => {
    expect(helpSectionFor("/gift-nook/member/abc")).toBe("gift-nook");
    expect(helpSectionFor("/potluck/p1?x=1")).toBe("potluck");
    expect(helpSectionFor("/")).toBe("hearth");
    expect(helpSectionFor("/burrow/b1")).toBe("people");
    expect(helpSectionFor("/inbox")).toBe("notices");
    expect(helpSectionFor("/settings")).toBeNull();
  });
});
