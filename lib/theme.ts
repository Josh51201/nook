import { Platform, StyleSheet } from "react-native";

// The cozy Nook palette: warm cream background, white cards with a soft
// shadow, bark-brown accents.
export const colors = {
  bark: "#8a5a3b",
  barkSoft: "#f1e4d8", // tinted backgrounds for icons/chips
  cream: "#f5ece3",
  background: "#fbf7f2",
  surface: "#ffffff",
  text: "#2a2420",
  muted: "#857a72",
  border: "#ece4dc",
  error: "#c0392b",
  white: "#fff",
  heart: "#c2415a",
  sun: "#fff4d6", // gentle highlight (prompts, heads-ups)
  sky: "#e9f1fb",
  rose: "#fdecea",
};

// Depth, the same soft-tactile language as the Hearth's tiles (CORE-028):
// things you can tap or read sit *up* on a warm, layered shadow with a lit
// top edge; places you type into sit gently *down*. CSS-style box shadows,
// so they look the same on iPhone and Android.
const shade = (alpha: number) => `rgba(74, 44, 22, ${alpha})`;

// Cards and bubbles: a tight contact shadow plus a wide, gentle one.
export const shadow = {
  boxShadow: `0px 1px 2px ${shade(0.06)}, 0px 6px 16px -4px ${shade(0.1)}, 0px 18px 32px -16px ${shade(0.14)}`,
};

export const depth = {
  // The main bark button: raised, with light catching its top edge.
  button: `0px 1px 2px ${shade(0.2)}, 0px 8px 16px -6px rgba(138, 90, 59, 0.5), inset 0px 1.5px 0px rgba(255, 255, 255, 0.22), inset 0px -2px 0px rgba(0, 0, 0, 0.12)`,
  // Soft secondary buttons and chips: barely lifted.
  soft: `0px 1px 2px ${shade(0.08)}, inset 0px 1.5px 0px rgba(255, 255, 255, 0.65)`,
  // Text boxes: pressed a little into the page.
  sunken: `inset 0px 2px 4px ${shade(0.07)}`,
  // Tinted icon badges: a lit top edge.
  badge: `inset 0px 1px 0px rgba(255, 255, 255, 0.7), inset 0px -1px 0px ${shade(0.05)}`,
};

export const ui = StyleSheet.create({
  screen: { padding: 20, gap: 14, paddingBottom: 56 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 8 },
  sectionTitle: { fontSize: 19, fontWeight: "700", color: colors.text, marginTop: 10 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    gap: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: shade(0.06),
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
  buttonText: { color: colors.white, fontSize: 16, fontWeight: "600" },
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
  chipTextSelected: { color: colors.white, fontWeight: "600" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});

// Shared look for every stack's headers and screen transitions: a warm,
// borderless header and the same slide-in on iOS and Android.
export const stackScreenOptions = {
  headerTintColor: colors.bark,
  headerStyle: { backgroundColor: colors.background },
  headerShadowVisible: false,
  headerTitleStyle: { fontWeight: "700" as const, color: colors.text },
  headerLargeTitleShadowVisible: false,
  headerLargeTitleStyle: { color: colors.text },
  headerBackTitle: "Back",
  contentStyle: { backgroundColor: colors.background },
  animation: "ios_from_right" as const,
};

// Big iPhone-style titles that shrink as you scroll (main screens only).
export const largeTitle = { headerLargeTitle: Platform.OS === "ios" };
