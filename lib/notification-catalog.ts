import type { IconName } from "../components/icon";
import {
  fridgeSettingDefaults,
  getawaySettingDefaults,
  gatheringSettingDefaults,
  giftNookSettingDefaults,
  letterboxSettingDefaults,
  nudgeSettingDefaults,
  petSettingDefaults,
  potluckSettingDefaults,
  rhythmSettingDefaults,
  sickdaySettingDefaults,
  sitterSettingDefaults,
  subscriptionSettingDefaults,
} from "./nook-settings";

// Every notification switch of every Nook, in one list (CORE-090). The
// Notifications page in Settings draws from this; each Nook's own settings
// screen shows the same switches, because both read and write the same saved
// settings (public.nook_settings), so changing one changes the other.
// Pure data (no React), so it's unit-testable. The `key`s are also read by
// the database (public.wants_*): rename them in both places or not at all.

export type NotificationSwitch = {
  key: string;
  icon: IconName;
  title: string;
  body: string;
};

export type NookNotifications = {
  // The Nook's id in lib/nooks.ts, and the name its settings are saved under.
  nook: string;
  // For ones that aren't a Nook in the catalog (the Fridge door is a widget).
  label?: { title: string; icon: IconName };
  defaults: Record<string, unknown>;
  switches: NotificationSwitch[];
};

export const notificationCatalog: NookNotifications[] = [
  {
    nook: "gift-nook",
    defaults: giftNookSettingDefaults,
    switches: [
      { key: "notifyNewGifts", icon: "gift", title: "New gifts added", body: "When someone in your Burrows adds to their Wishbook (bundled, not one per gift)." },
      { key: "notifyTuckChanged", icon: "edit", title: "A gift you tucked changed", body: "If its owner edits or removes something you're getting them." },
      { key: "notifyMemberJoined", icon: "invite", title: "Someone joined your Burrow", body: "When a Knock is answered." },
    ],
  },
  {
    nook: "gatherings",
    defaults: gatheringSettingDefaults,
    switches: [
      { key: "notifyInvites", icon: "invite", title: "When you're invited", body: "Including when a Burrow you're in is invited. Automatic birthday ones stay quiet." },
      { key: "notifyChanged", icon: "edit", title: "When plans change", body: "If the day, time or place of one you're invited to moves (not if you said you can't make it)." },
      { key: "notifySoon", icon: "calendar", title: "When one's coming up", body: "A week before, and the day before." },
      { key: "notifyRsvps", icon: "check", title: "When someone answers", body: "For Gatherings you host: who's coming and who can't." },
    ],
  },
  {
    nook: "potluck",
    defaults: potluckSettingDefaults,
    switches: [
      { key: "notifyNew", icon: "invite", title: "A new Potluck", body: "When someone in your Burrow plans one." },
      { key: "notifyReminder", icon: "potluck", title: "Remind me the day before", body: "“Tomorrow: you're bringing mashed potatoes.”" },
      { key: "notifyChanged", icon: "edit", title: "The plan changes", body: "If the time, place or name changes and you're going or bringing something." },
      { key: "notifyRsvps", icon: "check", title: "Someone RSVPs", body: "For Potlucks you host. Off unless you turn it on, since it can get busy." },
      { key: "notifyDishes", icon: "food", title: "Someone picks a dish", body: "For Potlucks you host. Off unless you turn it on." },
    ],
  },
  {
    nook: "nudges",
    label: { title: "Nudges", icon: "nudge" },
    defaults: nudgeSettingDefaults,
    switches: [
      {
        key: "notifyNudges",
        icon: "nudge",
        title: "When someone nudges you",
        body: "A reminder from family: answer an invite, add to your Wishbook, pick a Potluck dish, or a job that's yours. They're never told if this is off.",
      },
    ],
  },
  {
    nook: "fridge",
    label: { title: "Fridge door", icon: "fridge" },
    defaults: fridgeSettingDefaults,
    switches: [
      { key: "notifyHome", icon: "fridge", title: "A note on your Home's fridge", body: "When someone in your Home sticks one up." },
      { key: "notifyBurrow", icon: "fridge", title: "A note on a Burrow's fridge", body: "When someone sticks one up on a fridge in one of your Burrows." },
    ],
  },
  {
    nook: "pets",
    defaults: petSettingDefaults,
    switches: [
      { key: "notifyMissed", icon: "bell", title: "Meal not fed yet", body: "If a meal with a nudge time hasn't been checked off by then, your Home hears about it." },
      { key: "notifyDue", icon: "pill", title: "Vet, vaccine and refill dates", body: "A heads-up a week before something comes due, and again if it's passed." },
      { key: "notifyFed", icon: "paw", title: "When someone feeds a pet", body: "“Biscuit was fed — Sam did breakfast.” Can get busy in a big Home, so it's off unless you want it." },
    ],
  },
  {
    nook: "rhythms",
    defaults: rhythmSettingDefaults,
    switches: [
      { key: "notifyHeadsUp", icon: "calendar", title: "A heads-up before it's due", body: "A week ahead, so there's time to plan. Skipped for monthly ones." },
      { key: "notifyDueDay", icon: "bell", title: "On the day it's due", body: "A nudge the morning it comes due." },
      { key: "notifyOverdue", icon: "warning", title: "When it's overdue", body: "One reminder if the day passes and nobody has marked it done." },
      { key: "notifyDone", icon: "check", title: "When someone does one", body: "“Sam did: Change the furnace filter.” Off unless you want it." },
    ],
  },
  {
    nook: "subscriptions",
    defaults: subscriptionSettingDefaults,
    switches: [
      { key: "notifyTrials", icon: "warning", title: "Before a free trial ends", body: "So there's time to cancel before the first charge." },
      { key: "notifyYearly", icon: "calendar", title: "Before a yearly one renews", body: "Also ones billed every 3 or 6 months, the big charges that sneak up on you." },
      { key: "notifyMonthly", icon: "card", title: "Before a monthly one renews", body: "And weekly ones. Off unless you want it, since they'd come every few weeks." },
    ],
  },
  {
    nook: "getaways",
    defaults: getawaySettingDefaults,
    switches: [
      { key: "notifyAdded", icon: "plane", title: "When someone adds you to a Getaway", body: "So you know to start packing." },
      { key: "notifyTodos", icon: "todo", title: "When a before-you-go task is due", body: "The morning of its do-by day, to whoever's doing it (or everyone going)." },
      { key: "notifyLeaving", icon: "calendar", title: "The day before you leave", body: "With how much is left on your packing list." },
    ],
  },
  {
    nook: "sickday",
    defaults: sickdaySettingDefaults,
    switches: [
      { key: "notifyDoseReady", icon: "timer", title: "When the next dose is OK", body: "For a dose you gave: an alert on this phone and a note in your inbox once the hours between doses are up." },
      { key: "notifyDoseGiven", icon: "pill", title: "When someone else gives a dose", body: "So you know it's been given and don't give it again." },
      { key: "notifyHelper", icon: "sick", title: "When you're asked to help", body: "Someone from your Burrows adds you to help with a person who's sick." },
    ],
  },
  {
    nook: "sitter",
    defaults: sitterSettingDefaults,
    switches: [
      { key: "notifyOpened", icon: "check", title: "When a sitter opens it", body: "The first time they open a link you made, so you know it reached them." },
      { key: "notifyEnding", icon: "sitter", title: "The morning a link ends", body: "A heads-up on the last day, in case the stay runs longer and you want a new link." },
    ],
  },
  {
    nook: "letterbox",
    defaults: letterboxSettingDefaults,
    switches: [
      { key: "notifyBirthdays", icon: "birthday", title: "Birthday card reminders", body: "A week before a birthday in your Letterbox, so the card arrives on time." },
    ],
  },
];

// Whether a switch is on, given what's saved (a never-touched one is on or
// off by its Nook's default).
export function isOn(entry: NookNotifications, saved: Record<string, unknown>, key: string) {
  return Boolean(key in saved ? saved[key] : entry.defaults[key]);
}

// "3 of 4 on", "All on", "All off".
export function onSummary(entry: NookNotifications, saved: Record<string, unknown>) {
  const on = entry.switches.filter((s) => isOn(entry, saved, s.key)).length;
  const total = entry.switches.length;
  if (on === total) return total === 1 ? "On" : "All on";
  if (on === 0) return total === 1 ? "Off" : "All off";
  return `${on} of ${total} on`;
}
