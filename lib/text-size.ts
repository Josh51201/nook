// How big the app's text is (CORE-068). Pure (no React), so it's
// unit-testable; components/text.tsx applies it.
//
// "Normal" follows the phone's own text-size setting, exactly as before.
// "Large" and "Extra large" mean *at least* that big: if the phone's setting
// already makes text that big, nothing is added on top, so the two never
// stack into something enormous.

export type TextSizeKey = "normal" | "large" | "xlarge";

export const textSizeChoices: { key: TextSizeKey; label: string; description: string; factor: number }[] = [
  { key: "normal", label: "Normal", description: "Follows your phone's text size", factor: 1 },
  { key: "large", label: "Large", description: "Easier to read", factor: 1.15 },
  { key: "xlarge", label: "Extra large", description: "Biggest — for the clearest reading", factor: 1.3 },
];

// What to multiply the sizes we write by, given the phone's own text scale
// (which React Native applies on top by itself).
export function textScaleFor(key: TextSizeKey | undefined, phoneScale = 1): number {
  const factor = textSizeChoices.find((choice) => choice.key === key)?.factor ?? 1;
  if (factor <= 1) return 1;
  const phone = phoneScale > 0 ? phoneScale : 1;
  return Math.max(1, factor / phone);
}

// The size and line height to use for text drawn at `fontSize` / `lineHeight`
// (either may be missing: plain text is 14 until told otherwise).
export function scaledType(
  fontSize: number | undefined,
  lineHeight: number | undefined,
  scale: number
): { fontSize: number; lineHeight?: number } {
  const size = (fontSize ?? 14) * scale;
  return { fontSize: size, ...(lineHeight === undefined ? {} : { lineHeight: lineHeight * scale }) };
}
