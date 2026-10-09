import type { IconName } from "../components/icon";

// The first-time tour (CORE-026): little pop-up bubbles that point at parts
// of the app and say what they do. One tour, shown once — the first time
// someone reaches their Hearth — or again from Settings. It walks over to
// the Nooks and Burrows tabs first (the essentials), then back to the Hearth
// for the optional decorating.
// Pure logic only (no React), so it's unit-testable; components/tour.tsx
// draws it.
//
// Having seen it is saved to the account (nook_settings, nook = 'tours'),
// so it doesn't come back on a new phone, and on the phone too, in case
// that save doesn't make it.

// The screens (tabs) a tour step can take you to.
export type TourScreen = "hearth" | "nooks" | "burrows";

export type TourStep = {
  icon: IconName;
  title: string;
  body: string;
  // A <TourTarget id> to point at. If it's scrolled out of view, the tour
  // scrolls to it first. No target (or one that can't be shown) puts the
  // bubble in the middle of the screen.
  target?: string;
  // Skip this step entirely when its target doesn't exist — e.g. the Edit
  // button, which only appears once something is on the Hearth.
  optional?: boolean;
  // Go to this tab first. Steps without one work from anywhere (the tab
  // bar, or a bubble in the middle).
  screen?: TourScreen;
};

export const firstTour: TourStep[] = [
  {
    icon: "hearth",
    title: "Welcome to your Hearth",
    body: "This is home — everything in Nook starts here. Here's a quick look around; it only takes a minute.",
  },
  {
    icon: "bell",
    screen: "hearth",
    target: "hearth-inbox",
    title: "Your inbox",
    body: "News from your Nooks lands here — a Gathering coming up, someone joining your Burrow. A little number shows when there's something new.",
  },
  // The essentials first: where the Nooks are, and joining your people.
  {
    icon: "nooks",
    target: "tab-nooks",
    title: "Every Nook, one tap away",
    body: "Nooks are little apps — family gift lists, potlucks, recipes and more. They all live in this tab. Let's take a look.",
  },
  {
    icon: "gift",
    screen: "nooks",
    target: "nooks-first",
    title: "Open any Nook",
    body: "Tap one to open it — you don't have to add it anywhere first. Anything waiting for you, like a Gathering you're invited to, shows up at the top, and the tab gets a little dot.",
  },
  {
    icon: "burrow",
    target: "tab-burrows",
    title: "Burrows are your people",
    body: "A Burrow is your family or group. Every Nook that shares with people — like the Gift Nook — uses the same Burrows, so everyone only joins once. Let's take a peek.",
  },
  {
    icon: "hearth",
    screen: "burrows",
    target: "burrows-home",
    title: "Your Home",
    body: "The people you live with. Nooks for the house — cards, pets, yearly chores, the sitter sheet — share with your Home instead of the whole family.",
  },
  {
    icon: "burrow",
    screen: "burrows",
    target: "burrows-start",
    title: "Start a Burrow",
    body: "Give it a name, like “The Hazelwoods” or “Grandma's Crew”. You'll be its admin, and you can invite people by sending them a Knock.",
  },
  {
    icon: "door",
    screen: "burrows",
    target: "burrows-code",
    title: "Got a Knock?",
    body: "When someone invites you, they'll send you a 6-letter code. Type it here to join their Burrow — their Gatherings and Wishbooks show up straight away.",
  },
  // Then the fun, optional part: making the Hearth your own.
  {
    icon: "drag",
    screen: "hearth",
    target: "hearth-edit",
    optional: true,
    title: "Make it yours — whenever you like",
    body: "None of this is needed to use Nook. Tap Edit, or hold anything, to drag it around, resize it from its corner, or drop it onto a Hollow.",
  },
  {
    icon: "add",
    screen: "hearth",
    target: "hearth-add",
    title: "Add to your Hearth",
    body: "Widgets — countdowns, reminders, notes — plus text, and Hollows: little houses and stumps you can step into to keep things tidy.",
  },
  {
    icon: "market",
    screen: "hearth",
    target: "hearth-market",
    optional: true,
    title: "The Market",
    body: "See what each Nook does and put the ones you use most on your Hearth as tiles.",
  },
  {
    icon: "settings",
    target: "tab-settings",
    title: "Settings",
    body: "Your profile (add your birthday and your Burrows get a Birthday Gathering for you), your Hearth's name and theme, bigger text if you'd like it, and Help — plus this tour again, whenever you want it.",
  },
  // A warm send-off, in the middle of whatever screen you're on.
  {
    icon: "heart",
    title: "Make yourself at home",
    body: "That's the whole tour! Wander in, open a Nook, and shape your Hearth to your heart's content — pick a theme, move things around, tuck Nooks into Hollows. This little nook is all yours. And if you ever get stuck, tap the ? at the top of a screen (on your Hearth, it's under Edit) or open Settings → Help.",
  },
];

export type Rect = { x: number; y: number; width: number; height: number };
export type Screen = { width: number; height: number };

// The steps that will actually show, given which targets exist on the
// screen the tour starts from. Steps on another tab are kept as they are;
// their targets are looked for once the tour gets there.
export function resolveSteps(steps: TourStep[], present: Set<string>, startScreen: TourScreen = "hearth"): TourStep[] {
  return steps
    .filter((step) => (step.screen && step.screen !== startScreen) || !step.optional || present.has(step.target ?? ""))
    .map((step) => {
      if (step.screen && step.screen !== startScreen) return step;
      return step.target && !present.has(step.target) ? { ...step, target: undefined } : step;
    });
}

// Is a measured target fully inside `bounds` (the screen, or the visible
// part of a scrolling list) and big enough to point at?
export function isWithin(rect: Rect | null | undefined, bounds: Rect): rect is Rect {
  if (!rect || rect.width < 4 || rect.height < 4) return false;
  return (
    rect.x >= bounds.x &&
    rect.y >= bounds.y &&
    rect.x + rect.width <= bounds.x + bounds.width &&
    rect.y + rect.height <= bounds.y + bounds.height
  );
}

const REVEAL_MARGIN = 24;

// Where to scroll a list so a target that's out of view sits in the middle
// of it — or null if it's already comfortably in view (or the list can't
// scroll any further toward it). `offset` is how far the list is scrolled
// now; `contentHeight` is the full height of what's in it.
export function revealOffset(target: Rect, viewport: Rect, offset: number, contentHeight: number): number | null {
  const top = viewport.y + REVEAL_MARGIN;
  const bottom = viewport.y + viewport.height - REVEAL_MARGIN;
  if (target.y >= top && target.y + target.height <= bottom) return null;
  const centered = offset + (target.y + target.height / 2) - (viewport.y + viewport.height / 2);
  const next = Math.round(clamp(centered, 0, Math.max(0, contentHeight - viewport.height)));
  return Math.abs(next - offset) < 1 ? null : next;
}

export const HOLE_PADDING = 8;
export const BUBBLE_MARGIN = 16;
const ARROW_GAP = 14;

// The spotlight around a target: the target plus a little breathing room.
export function spotlight(rect: Rect): Rect {
  return {
    x: rect.x - HOLE_PADDING,
    y: rect.y - HOLE_PADDING,
    width: rect.width + HOLE_PADDING * 2,
    height: rect.height + HOLE_PADDING * 2,
  };
}

export type BubblePlacement =
  | { side: "center" }
  // `top`/`bottom` are distances from the screen's top/bottom edge, so the
  // bubble's own height never needs measuring. `arrowX` is where the arrow
  // sits, measured from the bubble's left edge.
  | { side: "below"; top: number; arrowX: number }
  | { side: "above"; bottom: number; arrowX: number };

// Put the bubble on whichever side of the target has more room, with its
// arrow pointing at the target's middle.
export function placeBubble(rect: Rect | null, screen: Screen): BubblePlacement {
  if (!rect) return { side: "center" };
  const hole = spotlight(rect);
  const bubbleWidth = screen.width - BUBBLE_MARGIN * 2;
  const arrowX = clamp(rect.x + rect.width / 2 - BUBBLE_MARGIN, 28, bubbleWidth - 28);
  const roomAbove = hole.y;
  const roomBelow = screen.height - (hole.y + hole.height);
  if (roomBelow >= roomAbove) return { side: "below", top: hole.y + hole.height + ARROW_GAP, arrowX };
  return { side: "above", bottom: screen.height - hole.y + ARROW_GAP, arrowX };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

// An SVG path that covers the whole screen except a rounded hole — the dim
// layer with the spotlight cut out (drawn with fillRule="evenodd"). Runs on
// the UI thread too, so the hole can glide from one target to the next.
export function holePath(screenWidth: number, screenHeight: number, x: number, y: number, w: number, h: number, r: number) {
  "worklet";
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  const outer = `M0 0H${screenWidth}V${screenHeight}H0Z`;
  if (w <= 0 || h <= 0) return outer;
  const inner =
    `M${x + radius} ${y}H${x + w - radius}` +
    `A${radius} ${radius} 0 0 1 ${x + w} ${y + radius}V${y + h - radius}` +
    `A${radius} ${radius} 0 0 1 ${x + w - radius} ${y + h}H${x + radius}` +
    `A${radius} ${radius} 0 0 1 ${x} ${y + h - radius}V${y + radius}` +
    `A${radius} ${radius} 0 0 1 ${x + radius} ${y}Z`;
  return `${outer} ${inner}`;
}
