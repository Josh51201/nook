import { useSyncExternalStore } from "react";
import { Appearance, Platform, StyleSheet } from "react-native";

// The whole app wears your Hearth's theme (CORE-032): Hearth (cream and
// bark), Ember, Sage, or Dusk (dark). With "Go dark with my phone" on, it
// switches to Dusk whenever the phone is in dark mode.
//
// `colors`, `ui`, `shadow`, `depth` and `stackScreenOptions` are *live*:
// they always hold the current theme, so screens just read them as before.
// Every screen re-mounts when the theme changes (see ThemedScreen), so
// nothing is left showing the old colors.

export type ThemeKey = "hearth" | "ember" | "sage" | "dusk";

type Palette = {
  dark: boolean;
  bark: string; // the accent
  barkSoft: string; // tinted backgrounds for icons/chips
  cream: string;
  background: string;
  surface: string; // cards
  text: string;
  muted: string;
  border: string;
  error: string;
  white: string; // real white
  onAccent: string; // text and icons sitting on the accent color
  heart: string;
  sun: string; // gentle highlight (prompts, heads-ups)
  sky: string;
  rose: string;
  shade: string; // shadow tint, as "r, g, b"
};

export const palettes: Record<ThemeKey, Palette> = {
  hearth: {
    dark: false,
    bark: "#8a5a3b",
    barkSoft: "#f1e4d8",
    cream: "#f5ece3",
    background: "#fbf7f2",
    surface: "#ffffff",
    text: "#2a2420",
    muted: "#857a72",
    border: "#ece4dc",
    error: "#c0392b",
    white: "#ffffff",
    onAccent: "#ffffff",
    heart: "#c2415a",
    sun: "#fff4d6",
    sky: "#e9f1fb",
    rose: "#fdecea",
    shade: "74, 44, 22",
  },
  ember: {
    dark: false,
    bark: "#b0552d",
    barkSoft: "#f7e0d0",
    cream: "#f8e6d8",
    background: "#fbefe4",
    surface: "#fffaf6",
    text: "#3a2418",
    muted: "#8a6a58",
    border: "#f0dccc",
    error: "#c0392b",
    white: "#ffffff",
    onAccent: "#ffffff",
    heart: "#c2415a",
    sun: "#fff0d0",
    sky: "#ebf0f7",
    rose: "#fde8e2",
    shade: "110, 48, 20",
  },
  sage: {
    dark: false,
    bark: "#4f6b45",
    barkSoft: "#e0e9d8",
    cream: "#e6eee0",
    background: "#eef3ea",
    surface: "#fbfdf9",
    text: "#23301f",
    muted: "#6b7a64",
    border: "#dce5d4",
    error: "#b83a2e",
    white: "#ffffff",
    onAccent: "#ffffff",
    heart: "#b8455e",
    sun: "#f6f1d4",
    sky: "#e5eef4",
    rose: "#f8e8e4",
    shade: "38, 58, 32",
  },
  dusk: {
    dark: true,
    bark: "#f0b98d",
    barkSoft: "#40353f",
    cream: "#352c38",
    background: "#2a2330",
    surface: "#342b39",
    text: "#f4ece6",
    muted: "#b9adb4",
    border: "#463b4b",
    error: "#ff8f80",
    white: "#ffffff",
    onAccent: "#2a2330",
    heart: "#ff8aa3",
    sun: "#463a2e",
    sky: "#2f3a4b",
    rose: "#4a2d36",
    shade: "0, 0, 0",
  },
};

// --- The live theme ------------------------------------------------------------

let current: ThemeKey = "hearth";
let version = 0;
const listeners = new Set<() => void>();

export const colors: Palette = { ...palettes.hearth };

// Start dark if the phone is (Go dark with my phone is on by default), so
// the app doesn't flash cream before your settings load.
if (Appearance.getColorScheme() === "dark") {
  current = "dusk";
  Object.assign(colors, palettes.dusk);
}

// An object whose properties always come from `build()` for the current
// theme, rebuilt once per theme change. Reads, spreads and Object.keys all
// see the current theme's values.
export function themed<T extends object>(build: () => T): T {
  let cache: T | null = null;
  let builtFor = -1;
  const now = () => {
    if (builtFor !== version || !cache) {
      cache = build();
      builtFor = version;
    }
    return cache;
  };
  return new Proxy({} as T, {
    get: (_target, key) => (now() as Record<string | symbol, unknown>)[key],
    has: (_target, key) => key in now(),
    ownKeys: () => Reflect.ownKeys(now()),
    getOwnPropertyDescriptor: (_target, key) => {
      const descriptor = Object.getOwnPropertyDescriptor(now(), key);
      return descriptor ? { ...descriptor, configurable: true } : undefined;
    },
  });
}

export function applyTheme(key: ThemeKey) {
  if (key === current) return;
  current = key;
  Object.assign(colors, palettes[key]);
  version += 1;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Re-render when the theme changes. Returns the theme's key, whether it's
// dark, and a number that changes with every switch (for remounting).
export function useTheme() {
  const v = useSyncExternalStore(subscribe, () => version);
  return { key: current, dark: colors.dark, version: v, colors };
}

// --- Depth (CORE-028) ----------------------------------------------------------
// Things you can tap or read sit *up* on a warm, layered shadow with a lit
// top edge; places you type into sit gently *down*. CSS-style box shadows,
// so they look the same on iPhone and Android. Dark themes need stronger
// shadows to show at all, and dimmer highlights.
const shadeOf = (alpha: number) => `rgba(${colors.shade}, ${Math.min(1, colors.dark ? alpha * 3.2 : alpha)})`;
const lit = (alpha: number) => `rgba(255, 255, 255, ${colors.dark ? alpha * 0.18 : alpha})`;

// Cards and bubbles: a tight contact shadow plus a wide, gentle one.
export const shadow = themed(() => ({
  boxShadow: `0px 1px 2px ${shadeOf(0.06)}, 0px 6px 16px -4px ${shadeOf(0.1)}, 0px 18px 32px -16px ${shadeOf(0.14)}`,
}));

export const depth = themed(() => ({
  // The main accent button: raised, with light catching its top edge.
  button: `0px 1px 2px ${shadeOf(0.2)}, 0px 8px 16px -6px ${colors.dark ? "rgba(0,0,0,0.5)" : `${colors.bark}80`}, inset 0px 1.5px 0px ${lit(0.22)}, inset 0px -2px 0px rgba(0, 0, 0, 0.12)`,
  // Soft secondary buttons and chips: barely lifted.
  soft: `0px 1px 2px ${shadeOf(0.08)}, inset 0px 1.5px 0px ${lit(0.65)}`,
  // Text boxes: pressed a little into the page.
  sunken: `inset 0px 2px 4px ${shadeOf(0.07)}`,
  // Tinted icon badges: a lit top edge.
  badge: `inset 0px 1px 0px ${lit(0.7)}, inset 0px -1px 0px ${shadeOf(0.05)}`,
}));

export const ui = themed(() =>
  StyleSheet.create({
    screen: { padding: 20, gap: 14, paddingBottom: 56 },
    center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 8 },
    sectionTitle: { fontSize: 19, fontWeight: "700", color: colors.text, marginTop: 10 },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 16,
      gap: 4,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.dark ? colors.border : shadeOf(0.06),
      ...shadow,
    },
    cardTitle: { fontSize: 16, fontWeight: "600", color: colors.text },
    muted: { fontSize: 14, color: colors.muted, lineHeight: 20 },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingVertical: 13,
      paddingHorizontal: 14,
      fontSize: 16,
      color: colors.text,
      backgroundColor: colors.surface,
      boxShadow: depth.sunken,
    },
    label: { fontSize: 14, fontWeight: "600", color: colors.text, marginBottom: -6 },
    button: {
      backgroundColor: colors.bark,
      borderRadius: 14,
      paddingVertical: 15,
      paddingHorizontal: 16,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
      boxShadow: depth.button,
    },
    buttonText: { color: colors.onAccent, fontSize: 16, fontWeight: "600" },
    secondaryButton: {
      backgroundColor: colors.barkSoft,
      borderRadius: 14,
      paddingVertical: 13,
      paddingHorizontal: 16,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
      boxShadow: depth.soft,
    },
    secondaryButtonText: { color: colors.bark, fontSize: 15, fontWeight: "600" },
    link: { color: colors.bark, fontSize: 15, fontWeight: "500" },
    error: { color: colors.error },
    row: { flexDirection: "row", alignItems: "center", gap: 8 },
    chip: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 999,
      paddingVertical: 7,
      paddingHorizontal: 13,
      boxShadow: depth.soft,
    },
    chipSelected: { backgroundColor: colors.bark, borderColor: colors.bark, boxShadow: depth.button },
    chipText: { color: colors.text, fontSize: 14 },
    chipTextSelected: { color: colors.onAccent, fontWeight: "600" },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  })
);

// Shared look for every stack's headers and screen transitions: a warm,
// borderless header and the same slide-in on iOS and Android.
export const stackScreenOptions = themed(() => ({
  headerTintColor: colors.bark,
  headerStyle: { backgroundColor: colors.background },
  headerShadowVisible: false,
  headerTitleStyle: { fontWeight: "700" as const, color: colors.text },
  headerLargeTitleShadowVisible: false,
  headerLargeTitleStyle: { color: colors.text },
  headerBackTitle: "Back",
  contentStyle: { backgroundColor: colors.background },
  animation: "ios_from_right" as const,
}));

// Big iPhone-style titles that shrink as you scroll (main screens only).
export const largeTitle = { headerLargeTitle: Platform.OS === "ios" };
