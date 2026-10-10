// Deleting your account (AUTH-003, Q-020). The database does the real work
// (delete_my_account in supabase/migrations/20261010140000_delete_account.sql);
// this file turns what it says will happen into plain sentences (no database
// here, so it's unit-testable; the calls are in account-deletion-data.ts).

export type DeletionPreview = {
  // Kids only you look after, who go with you.
  kids: { id: string; name: string }[];
  // Burrows with no other grown-up, which go too.
  burrows: string[];
  // Gifts you've tucked that become available again.
  tucks: number;
};

// The word you type to confirm.
export const CONFIRM_WORD = "DELETE";

export function isConfirmed(typed: string) {
  return typed.trim().toUpperCase() === CONFIRM_WORD;
}

function joinNames(names: string[]) {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

// What will be lost, in the order people care about it. Always starts with
// the things that go no matter what.
export function describeDeletion(preview: DeletionPreview): string[] {
  const lines = [
    "Your profile, Wishbook, Hearth, photos and notices are deleted for good.",
    "You'll be taken out of every Burrow and your Home. Burrows that still have other grown-ups stay, and someone else takes over running them.",
  ];
  if (preview.burrows.length) {
    lines.push(
      `${preview.burrows.length === 1 ? "This Burrow has" : "These Burrows have"} no one else in ${preview.burrows.length === 1 ? "it" : "them"}, so ${preview.burrows.length === 1 ? "it's" : "they're"} deleted too: ${joinNames(preview.burrows)}.`,
    );
  }
  if (preview.kids.length) {
    const names = preview.kids.map((kid) => kid.name);
    lines.push(
      `${joinNames(names)} ${names.length === 1 ? "is" : "are"} only looked after by you, so ${names.length === 1 ? "their profile and Wishbook go" : "their profiles and Wishbooks go"} too. To keep them, hand ${names.length === 1 ? "their profile" : "their profiles"} to someone first.`,
    );
  }
  if (preview.tucks > 0) {
    lines.push(
      `${preview.tucks === 1 ? "The 1 gift" : `The ${preview.tucks} gifts`} you've tucked for other people will show as available again.`,
    );
  }
  return lines;
}
