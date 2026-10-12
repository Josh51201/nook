import { localDay } from "./pets";

// Notes Nook (NOTE-001..010): notes like the phone's own Notes app. The
// first line is the title; a line starting with a box is a checklist item.
// The pure parts live here so they can be tested; loading and saving is in
// notes-data.ts.

export type Note = {
  id: string;
  owner_id: string;
  body: string;
  folder: string | null;
  pinned: boolean;
  shared: boolean;
  created_at: string;
  updated_at: string;
  edited_by: string | null;
};

// Checklist lines (NOTE-003) are plain text, so they survive copy and paste.
export const OPEN = "☐ ";
export const DONE = "☑ ";

const isCheck = (line: string) => line.startsWith(OPEN) || line.startsWith(DONE);
const withoutBox = (line: string) => (isCheck(line) ? line.slice(OPEN.length) : line);

// The first line with something on it, without a checkbox.
export function noteTitle(body: string) {
  const line = body.split("\n").find((l) => withoutBox(l).trim());
  const title = line ? withoutBox(line).trim() : "";
  return title ? (title.length > 80 ? `${title.slice(0, 79)}…` : title) : "New note";
}

// What comes after the title, on one line, for the list.
export function notePreview(body: string) {
  const lines = body.split("\n");
  const first = lines.findIndex((l) => withoutBox(l).trim());
  if (first < 0) return "";
  return lines
    .slice(first + 1)
    .map((l) => l.trim())
    .filter((l) => withoutBox(l).trim())
    .join("  ")
    .slice(0, 160);
}

export type Block = { line: number } & ({ kind: "check"; done: boolean; text: string } | { kind: "text"; text: string });

// The note as lines to show when you're reading it (not typing).
export function noteBlocks(body: string): Block[] {
  return body.split("\n").map((text, line) =>
    isCheck(text) ? { line, kind: "check", done: text.startsWith(DONE), text: text.slice(OPEN.length) } : { line, kind: "text", text }
  );
}

// Tick or untick the checklist item on `line`.
export function toggleCheck(body: string, line: number) {
  const lines = body.split("\n");
  const text = lines[line];
  if (text === undefined || !isCheck(text)) return body;
  lines[line] = (text.startsWith(DONE) ? OPEN : DONE) + text.slice(OPEN.length);
  return lines.join("\n");
}

export function checklistCounts(body: string) {
  const lines = body.split("\n").filter(isCheck);
  return { done: lines.filter((l) => l.startsWith(DONE)).length, total: lines.length };
}

// The "Checklist" button: put a box on the line the cursor is on, or take
// it off. Returns the new text and where the cursor goes.
export function toggleChecklistLine(body: string, cursor: number) {
  const start = body.lastIndexOf("\n", Math.max(0, cursor - 1)) + 1;
  const line = body.slice(start).split("\n")[0];
  if (isCheck(line)) {
    return { body: body.slice(0, start) + line.slice(OPEN.length) + body.slice(start + line.length), cursor: Math.max(start, cursor - OPEN.length) };
  }
  return { body: body.slice(0, start) + OPEN + body.slice(start), cursor: cursor + OPEN.length };
}

// Typing Return on a checklist item starts a new one, like the phone's
// Notes; Return on an empty item ends the list. `prev` is the text before
// the keystroke, `next` after. Null when nothing needs doing.
export function continueChecklist(prev: string, next: string): { body: string; cursor: number } | null {
  if (next.length !== prev.length + 1) return null;
  let at = 0;
  while (at < prev.length && prev[at] === next[at]) at++;
  if (next[at] !== "\n" || next.slice(at + 1) !== prev.slice(at)) return null;
  const start = prev.lastIndexOf("\n", at - 1) + 1;
  const line = prev.slice(start, at);
  if (!isCheck(line)) return null;
  if (!line.slice(OPEN.length).trim()) {
    // An empty item: take its box off instead of adding another.
    return { body: prev.slice(0, start) + prev.slice(at), cursor: start };
  }
  return { body: next.slice(0, at + 1) + OPEN + next.slice(at + 1), cursor: at + 1 + OPEN.length };
}

// --- The list ------------------------------------------------------------------------

// Pinned first, then the most recently changed.
export function sortNotes<T extends Pick<Note, "pinned" | "updated_at">>(notes: T[]): T[] {
  return [...notes].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updated_at.localeCompare(a.updated_at));
}

// Every word has to be in the note somewhere, in any case.
export function searchNotes<T extends Pick<Note, "body" | "folder">>(notes: T[], query: string): T[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return notes;
  return notes.filter((n) => {
    const text = `${n.body} ${n.folder ?? ""}`.toLowerCase();
    return words.every((w) => text.includes(w));
  });
}

export function folderNames(notes: Pick<Note, "folder">[]) {
  return [...new Set(notes.map((n) => n.folder).filter((f): f is string => !!f))].sort((a, b) => a.localeCompare(b));
}

// When it last changed, the way the phone's Notes says it: a time today,
// "Yesterday", a weekday this week, otherwise the date.
export function editedWords(iso: string, today = localDay()) {
  const date = new Date(iso);
  const day = localDay(date);
  if (day === today) return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const days = Math.round((new Date(`${today}T12:00:00`).getTime() - new Date(`${day}T12:00:00`).getTime()) / 864e5);
  if (days === 1) return "Yesterday";
  if (days > 1 && days < 7) return date.toLocaleDateString(undefined, { weekday: "long" });
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", ...(day.slice(0, 4) === today.slice(0, 4) ? {} : { year: "numeric" }) });
}
