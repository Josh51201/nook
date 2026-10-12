// Nudges (CORE-101, proposed): a one-tap reminder to someone you're waiting
// on. The database (public.send_nudge) decides who's allowed and who hears;
// these helpers decide who gets a Nudge button. Pure (no React, no
// Supabase), so they're unit-testable.

export type NudgeKind = "wishbook" | "rsvp" | "dish" | "todo" | "rhythm";

// Guests a host can nudge to answer: anyone who hasn't, except you and kids
// you answer for yourself.
export function rsvpNudgeTargets<G extends { profile_id: string; status: string | null }>(
  guests: G[],
  userId: string,
  myKids: string[] = []
): G[] {
  return guests.filter((g) => !g.status && g.profile_id !== userId && !myKids.includes(g.profile_id));
}

// People coming to a Potluck who haven't picked a dish (kids don't bring one).
export function dishNudgeTargets<P extends { id: string; profile: { is_managed?: boolean } | null }>(
  coming: P[],
  dishes: { brought_by: string }[],
  userId: string
): P[] {
  const bringing = new Set(dishes.map((d) => d.brought_by));
  return coming.filter((p) => p.id !== userId && !p.profile?.is_managed && !bringing.has(p.id));
}

// What to tell the sender: nothing when it went (the button says "Nudged"),
// or why nothing went. The database skips anyone you already nudged about
// the same thing in the last day.
export function nudgeOutcome(count: number, many = false): { title: string; body: string } | null {
  if (count > 0) return null;
  return many
    ? { title: "Already nudged today", body: "Everyone's had a nudge from you today. You can nudge them again tomorrow." }
    : { title: "Already nudged today", body: "You can nudge them again tomorrow." };
}
