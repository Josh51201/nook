import { describe, expect, it } from "vitest";

import {
  DONE,
  OPEN,
  checklistCounts,
  continueChecklist,
  editedWords,
  folderNames,
  noteBlocks,
  notePreview,
  noteTitle,
  searchNotes,
  sortNotes,
  toggleCheck,
  toggleChecklistLine,
} from "../lib/notes";

describe("title and preview (NOTE-002)", () => {
  it("takes the first line with words as the title", () => {
    expect(noteTitle("\n  Packing list\nSocks")).toBe("Packing list");
    expect(noteTitle(`${OPEN}Milk\n${OPEN}Eggs`)).toBe("Milk");
    expect(noteTitle("   \n")).toBe("New note");
    expect(noteTitle("x".repeat(100))).toHaveLength(80);
  });

  it("previews what comes after the title", () => {
    expect(notePreview("Wi-Fi\nNetwork: Burrow\n\nPassword: acorns")).toBe("Network: Burrow  Password: acorns");
    expect(notePreview("Just a title")).toBe("");
  });
});

describe("checklists (NOTE-003)", () => {
  const body = `Groceries\n${OPEN}Milk\n${DONE}Eggs\nnot an item`;

  it("reads the note as lines and boxes", () => {
    const blocks = noteBlocks(body);
    expect(blocks[1]).toEqual({ line: 1, kind: "check", done: false, text: "Milk" });
    expect(blocks[2]).toMatchObject({ kind: "check", done: true, text: "Eggs" });
    expect(blocks[3]).toMatchObject({ kind: "text", text: "not an item" });
    expect(checklistCounts(body)).toEqual({ done: 1, total: 2 });
  });

  it("ticks and unticks an item, and leaves other lines alone", () => {
    expect(toggleCheck(body, 1)).toBe(`Groceries\n${DONE}Milk\n${DONE}Eggs\nnot an item`);
    expect(toggleCheck(body, 2)).toBe(`Groceries\n${OPEN}Milk\n${OPEN}Eggs\nnot an item`);
    expect(toggleCheck(body, 0)).toBe(body);
  });

  it("puts a box on the cursor's line, or takes it off", () => {
    const on = toggleChecklistLine("Title\nBread", 8);
    expect(on.body).toBe(`Title\n${OPEN}Bread`);
    expect(on.cursor).toBe(8 + OPEN.length);
    const off = toggleChecklistLine(on.body, on.cursor);
    expect(off.body).toBe("Title\nBread");
  });

  it("starts a new item on Return, and ends the list on an empty one", () => {
    const prev = `${OPEN}Milk`;
    const typed = continueChecklist(prev, `${prev}\n`);
    expect(typed).toEqual({ body: `${OPEN}Milk\n${OPEN}`, cursor: prev.length + 1 + OPEN.length });

    const empty = `${OPEN}Milk\n${OPEN}`;
    expect(continueChecklist(empty, `${empty}\n`)).toEqual({ body: `${OPEN}Milk\n`, cursor: prev.length + 1 });

    expect(continueChecklist("Plain", "Plain\n")).toBeNull();
    expect(continueChecklist(prev, `${prev}s`)).toBeNull();
  });
});

describe("the list (NOTE-001, NOTE-004, NOTE-005)", () => {
  const notes = [
    { id: "a", body: "Old", folder: null, pinned: false, updated_at: "2026-10-01T00:00:00Z" },
    { id: "b", body: "Wi-Fi password", folder: "House", pinned: true, updated_at: "2026-09-01T00:00:00Z" },
    { id: "c", body: "New idea", folder: "Ideas", pinned: false, updated_at: "2026-10-10T00:00:00Z" },
  ];

  it("puts pinned notes first, then the newest", () => {
    expect(sortNotes(notes).map((n) => n.id)).toEqual(["b", "c", "a"]);
  });

  it("finds notes with every word, in any case, folder included", () => {
    expect(searchNotes(notes, "wi-fi PASSWORD").map((n) => n.id)).toEqual(["b"]);
    expect(searchNotes(notes, "house").map((n) => n.id)).toEqual(["b"]);
    expect(searchNotes(notes, "  ")).toHaveLength(3);
  });

  it("lists folders once, sorted", () => {
    expect(folderNames([...notes, { folder: "House" }])).toEqual(["House", "Ideas"]);
  });

  it("says when it changed like the phone's Notes", () => {
    expect(editedWords(new Date("2026-10-11T15:00:00").toISOString(), "2026-10-12")).toBe("Yesterday");
    expect(editedWords(new Date("2026-08-01T15:00:00").toISOString(), "2026-10-12")).toMatch(/Aug/);
  });
});
