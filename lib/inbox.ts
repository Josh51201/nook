import type { IconName } from "../components/icon";

// The inbox is shared by every Nook (CORE-027). A notice carries the Nook
// that sent it (`nook`) and a `kind` that Nook defines. To send notices
// from a new Nook: have its database code insert rows with that `nook`,
// then add its kinds below.

export type Notice = {
  id: string;
  nook: string;
  kind: string;
  title: string;
  body: string | null;
  data: {
    owner_id?: string;
    gift_id?: string;
    burrow_id?: string;
    gathering_id?: string;
    potluck_id?: string;
    contact_id?: string;
    pet_id?: string;
    rhythm_id?: string;
    subscription_id?: string;
    getaway_id?: string;
    spell_id?: string;
    link_id?: string;
    invite_id?: string;
    home_id?: string;
    note_id?: string;
    expires_at?: string;
  };
  created_at: string;
  read_at: string | null;
};

type KindInfo = { icon: IconName; route: (data: Notice["data"]) => string | null };

const potluckRoute = (data: Notice["data"]) => (data.potluck_id ? `/potluck/${data.potluck_id}` : "/potluck");

const gatheringRoute = (data: Notice["data"]) => (data.gathering_id ? `/gatherings/${data.gathering_id}` : "/gatherings");

const kinds: Record<string, Record<string, KindInfo>> = {
  gatherings: {
    gathering_invite: { icon: "invite", route: gatheringRoute },
    gathering_changed: { icon: "edit", route: gatheringRoute },
    gathering_rsvp: { icon: "check", route: gatheringRoute },
    gathering_soon: { icon: "calendar", route: gatheringRoute },
  },
  "gift-nook": {
    gathering_soon: {
      icon: "calendar",
      route: (data) => (data.gathering_id ? `/gift-nook/gathering/${data.gathering_id}` : null),
    },
    gathering_new: {
      icon: "celebration",
      route: (data) => (data.gathering_id ? `/gift-nook/gathering/${data.gathering_id}` : null),
    },
    new_gifts: {
      icon: "gift",
      route: (data) => (data.owner_id ? `/gift-nook/member/${data.owner_id}` : null),
    },
    tuck_changed: { icon: "edit", route: () => "/gift-nook/my-tucks" },
    member_joined: {
      icon: "invite",
      route: (data) => (data.burrow_id ? `/burrow/${data.burrow_id}` : null),
    },
  },
  potluck: {
    potluck_reminder: { icon: "potluck", route: (data) => potluckRoute(data) },
    potluck_new: { icon: "invite", route: (data) => potluckRoute(data) },
    potluck_changed: { icon: "edit", route: (data) => potluckRoute(data) },
    potluck_rsvp: { icon: "check", route: (data) => potluckRoute(data) },
    potluck_dish: { icon: "food", route: (data) => potluckRoute(data) },
  },
  pets: {
    pet_fed: { icon: "paw", route: (data) => (data.pet_id ? `/pets/${data.pet_id}` : "/pets") },
    meal_missed: { icon: "paw", route: (data) => (data.pet_id ? `/pets/${data.pet_id}` : "/pets") },
    health_due: { icon: "pill", route: (data) => (data.pet_id ? `/pets/${data.pet_id}` : "/pets") },
  },
  rhythms: {
    rhythm_heads_up: { icon: "calendar", route: (data) => (data.rhythm_id ? `/rhythms/${data.rhythm_id}` : "/rhythms") },
    rhythm_due: { icon: "rhythm", route: (data) => (data.rhythm_id ? `/rhythms/${data.rhythm_id}` : "/rhythms") },
    rhythm_overdue: { icon: "warning", route: (data) => (data.rhythm_id ? `/rhythms/${data.rhythm_id}` : "/rhythms") },
    rhythm_done: { icon: "check", route: (data) => (data.rhythm_id ? `/rhythms/${data.rhythm_id}` : "/rhythms") },
  },
  subscriptions: {
    trial_ending: {
      icon: "warning",
      route: (data) => (data.subscription_id ? `/subscriptions/${data.subscription_id}` : "/subscriptions"),
    },
    renewal_soon: {
      icon: "card",
      route: (data) => (data.subscription_id ? `/subscriptions/${data.subscription_id}` : "/subscriptions"),
    },
  },
  getaways: {
    getaway_added: { icon: "plane", route: (data) => (data.getaway_id ? `/getaways/${data.getaway_id}` : "/getaways") },
    getaway_todo: { icon: "todo", route: (data) => (data.getaway_id ? `/getaways/todos?id=${data.getaway_id}` : "/getaways") },
    getaway_tomorrow: { icon: "calendar", route: (data) => (data.getaway_id ? `/getaways/${data.getaway_id}` : "/getaways") },
  },
  sickday: {
    sick_dose_given: { icon: "pill", route: (data) => (data.spell_id ? `/sickday/${data.spell_id}` : "/sickday") },
    sick_dose_ready: { icon: "timer", route: (data) => (data.spell_id ? `/sickday/${data.spell_id}` : "/sickday") },
    sick_helper: { icon: "sick", route: (data) => (data.spell_id ? `/sickday/${data.spell_id}` : "/sickday") },
  },
  sitter: {
    sitter_opened: { icon: "check", route: () => "/sitter" },
    sitter_ending: { icon: "sitter", route: () => "/sitter" },
  },
  home: {
    home_invite: { icon: "hearth", route: () => "/home" },
    home_joined: { icon: "group", route: () => "/home" },
  },
  // Fridge door notes (CORE-086): open the fridge it's on.
  fridge: {
    fridge_note: {
      icon: "fridge",
      route: (data) => (data.home_id ? `/fridge?home=${data.home_id}` : data.burrow_id ? `/fridge?burrow=${data.burrow_id}` : null),
    },
  },
  letterbox: {
    birthday_card: {
      icon: "birthday",
      route: (data) => (data.contact_id ? `/letterbox/contact/${data.contact_id}` : "/letterbox"),
    },
  },
};

// A kind we don't know (say, from a newer version of the app) still shows
// up — just with a plain bell, and nowhere to go.
export function noticeIcon(notice: Pick<Notice, "nook" | "kind">): IconName {
  return kinds[notice.nook]?.[notice.kind]?.icon ?? "bell";
}

export function noticeRoute(notice: Pick<Notice, "nook" | "kind" | "data">): string | null {
  return kinds[notice.nook]?.[notice.kind]?.route(notice.data ?? {}) ?? null;
}

// Unread notices counted per Nook, for the Nooks tab: which Nooks have
// something waiting, and the newest notice's title to show under each.
// `rows` must be newest first.
export type NookWaiting = { count: number; latest: string };

export function unreadByNook(rows: Pick<Notice, "nook" | "title">[]): Record<string, NookWaiting> {
  const waiting: Record<string, NookWaiting> = {};
  for (const row of rows) {
    const entry = waiting[row.nook];
    if (entry) entry.count += 1;
    else waiting[row.nook] = { count: 1, latest: row.title };
  }
  return waiting;
}
