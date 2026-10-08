// The app's typefaces (CORE-035). Custom fonts come as one file per weight,
// so a weight ("700") is turned into the right file here. Pure (no React),
// so it's unit-testable.

export type FontKey = "classic" | "rounded" | "storybook";

export const fontChoices: { key: FontKey; label: string; description: string }[] = [
  { key: "classic", label: "Classic", description: "Your phone's own clean font" },
  { key: "rounded", label: "Rounded", description: "Soft and friendly (Nunito)" },
  { key: "storybook", label: "Storybook", description: "Storybook headings (Fraunces)" },
];

const nunito: Record<number, string> = {
  400: "Nunito_400Regular",
  500: "Nunito_500Medium",
  600: "Nunito_600SemiBold",
  700: "Nunito_700Bold",
  800: "Nunito_800ExtraBold",
  900: "Nunito_900Black",
};

const fraunces: Record<number, string> = {
  600: "Fraunces_600SemiBold",
  700: "Fraunces_700Bold",
  800: "Fraunces_800ExtraBold",
  900: "Fraunces_900Black",
};

// Every font file the choices use (they're loaded when the app starts).
export const fontFiles = [...Object.values(nunito), ...Object.values(fraunces)];

// "bold", 700, "700" → 700; anything lighter than regular → 400.
export function weightOf(weight: string | number | undefined): number {
  if (weight === undefined || weight === "normal") return 400;
  if (weight === "bold") return 700;
  const n = typeof weight === "number" ? weight : parseInt(weight, 10);
  return Number.isFinite(n) ? Math.min(900, Math.max(400, Math.round(n / 100) * 100)) : 400;
}

// The font file for a weight, or null to use the phone's own font.
export function familyFor(font: FontKey, weight: number): string | null {
  if (font === "classic") return null;
  // Storybook: Fraunces for headings (semi-bold and up), Nunito for the rest.
  if (font === "storybook" && weight >= 600) return fraunces[weight] ?? fraunces[700];
  return nunito[weight] ?? nunito[400];
}
