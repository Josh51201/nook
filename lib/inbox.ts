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
    link_id?: string;
    invite_id?: string;
  };
  created_at: string;
  read_at: string | null;
};

type KindInfo = { icon: IconName; route: (data: Notice["data"]) => string | null };

const potluckRoute = (data: Notice["data"]) => (data.potluck_id ? `/potluck/${data.potluck_id}` : "/potluck");

const kinds: Record<string, Record<string, KindInfo>> = {
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
  sitter: {
    sitter_opened: { icon: "check", route: () => "/sitter" },
    sitter_ending: { icon: "sitter", route: () => "/sitter" },
  },
  home: {
    home_invite: { icon: "hearth", route: () => "/home" },
    home_joined: { icon: "group", route: () => "/home" },
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
