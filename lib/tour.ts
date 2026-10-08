import type { IconName } from "../components/icon";

// The first-time tour (CORE-026): little pop-up bubbles that point at parts
// of the app and say what they do. Pure logic only (no React), so it's
// unit-testable; components/tour.tsx draws it.
//
// Which tours someone has seen is saved to their account (nook_settings,
// nook = 'tours'), so it doesn't come back on a new phone.

export type TourKey = "hearth" | "burrows";

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
};

export const tours: Record<TourKey, TourStep[]> = {
  hearth: [
    {
      icon: "hearth",
      title: "Welcome to your Hearth",
      body: "This is home — everything in Nook starts here. Here's a quick look around.",
    },
    {
      icon: "bell",
      target: "hearth-inbox",
      title: "Your inbox",
      body: "News from your Nooks lands here — a Gathering coming up, someone joining your Burrow. A little number shows when there's something new.",
    },
    {
      icon: "drag",
      target: "hearth-edit",
      optional: true,
      title: "Make it yours",
      body: "Tap Edit, or hold anything, to drag it around, resize it from its corner, or drop it onto a Hollow.",
    },
    {
      icon: "add",
      target: "hearth-add",
      title: "Add to your Hearth",
      body: "Tap here to add widgets — countdowns, reminders, notes — plus text, and Hollows: little houses and stumps you can step into to keep things tidy.",
    },
    {
      icon: "market",
      target: "hearth-market",
      optional: true,
      title: "The Market",
      body: "Nooks live here — little apps like the Gift Nook. Add one and it shows up as a tile on your Hearth.",
    },
    {
      icon: "burrow",
      target: "tab-burrows",
      title: "Burrows are your people",
      body: "A Burrow is your family or group. Start one, or join one with a Knock code. Every Nook that shares with people — like the Gift Nook — uses your Burrows.",
    },
    {
      icon: "settings",
      target: "tab-settings",
      title: "Settings",
      body: "Your profile, your Hearth's name and theme — and this tour again, whenever you want it.",
    },
  ],
  burrows: [
    {
      icon: "burrow",
      target: "burrows-start",
      title: "Start a Burrow",
      body: "Give it a name, like “The Collinses”. You'll be its admin, and you can invite people by sending them a Knock.",
    },
    {
      icon: "door",
      target: "burrows-code",
      title: "Got a Knock?",
      body: "When someone invites you, they'll send you a 6-letter code. Type it here to join their Burrow.",
    },
    {
      icon: "group",
      title: "One Burrow, every Nook",
      body: "Your Burrows are shared by every Nook that needs family — so everyone only has to join once.",
    },
  ],
};

export type Rect = { x: number; y: number; width: number; height: number };
export type Screen = { width: number; height: number };

// The steps that will actually show, given which targets exist right now.
export function resolveSteps(steps: TourStep[], present: Set<string>): TourStep[] {
  return steps
    .filter((step) => !step.optional || (step.target && present.has(step.target)))
    .map((step) => (step.target && !present.has(step.target) ? { ...step, target: undefined } : step));
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
