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
  };
  created_at: string;
  read_at: string | null;
};

type KindInfo = { icon: IconName; route: (data: Notice["data"]) => string | null };

const kinds: Record<string, Record<string, KindInfo>> = {
  "gift-nook": {
    gathering_soon: {
      icon: "calendar",
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
    potluck_reminder: {
      icon: "potluck",
      route: (data) => (data.potluck_id ? `/potluck/${data.potluck_id}` : null),
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
