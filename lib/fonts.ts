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
// Handwriting, for text on the Hearth only (CORE-076).
const caveat: Record<number, string> = {
  400: "Caveat_400Regular",
  500: "Caveat_500Medium",
  600: "Caveat_600SemiBold",
  700: "Caveat_700Bold",
};

// Italics, for Hearth text (CORE-082). Handwriting has no italic file; it's
// slanted instead (labelSlanted).
const nunitoItalic: Record<number, string> = {
  400: "Nunito_400Regular_Italic",
  500: "Nunito_500Medium_Italic",
  600: "Nunito_600SemiBold_Italic",
  700: "Nunito_700Bold_Italic",
  800: "Nunito_800ExtraBold_Italic",
  900: "Nunito_900Black_Italic",
};
const frauncesItalic: Record<number, string> = {
  600: "Fraunces_600SemiBold_Italic",
  700: "Fraunces_700Bold_Italic",
  800: "Fraunces_800ExtraBold_Italic",
  900: "Fraunces_900Black_Italic",
};

// Chalk, for widgets on a chalkboard (CORE-135).
const chalk: Record<number, string> = {
  400: "CabinSketch_400Regular",
  700: "CabinSketch_700Bold",
};

export function chalkFamily(weight: number) {
  return weight >= 600 ? chalk[700] : chalk[400];
}

export const fontFiles = [
  ...Object.values(nunito),
  ...Object.values(fraunces),
  ...Object.values(caveat),
  ...Object.values(nunitoItalic),
  ...Object.values(frauncesItalic),
  ...Object.values(chalk),
];

// Fonts a piece of Hearth text can wear (CORE-076). "app" follows the app's
// own font choice.
export type LabelFont = "app" | "rounded" | "storybook" | "handwritten" | "classic";

export const labelFonts: { key: LabelFont; label: string }[] = [
  { key: "app", label: "Same as the app" },
  { key: "rounded", label: "Rounded" },
  { key: "storybook", label: "Storybook" },
  { key: "handwritten", label: "Handwritten" },
  { key: "classic", label: "Classic" },
];

// The font file for Hearth text, or null for the phone's own font (which
// does italics by itself with fontStyle).
export function labelFamily(font: LabelFont | undefined, weight: number, appFont: FontKey, italic = false): string | null {
  const family = uprightFamily(font, weight, appFont);
  if (!italic || !family) return family;
  return family.replace(/^(Nunito|Fraunces)_(\w+)$/, "$1_$2_Italic");
}

// Handwriting has no italic font, so italic handwriting is slanted.
export function labelSlanted(font: LabelFont | undefined, appFont: FontKey, italic: boolean): boolean {
  return italic && Boolean(uprightFamily(font, 400, appFont)?.startsWith("Caveat"));
}

function uprightFamily(font: LabelFont | undefined, weight: number, appFont: FontKey): string | null {
  const w = weightOf(weight);
  switch (font ?? "app") {
    case "app":
      return familyFor(appFont, w);
    case "rounded":
      return nunito[w] ?? nunito[400];
    case "storybook":
      // Fraunces comes in semi-bold and up.
      return fraunces[Math.max(600, w)] ?? fraunces[700];
    case "handwritten":
      return caveat[Math.min(700, w)] ?? caveat[400];
    case "classic":
      return null;
  }
}

// "bold", 700, "700" → 700; anything lighter than regular → 400.
export function weightOf(weight: string | number | undefined): number {
  if (weight === undefined || weight === "normal") return 400;
  if (weight === "bold") return 700;
  const n = typeof weight === "number" ? weight : parseInt(weight, 10);
  return Number.isFinite(n) ? Math.min(900, Math.max(400, Math.round(n / 100) * 100)) : 400;
}

// The font file for a weight, or null to use the phone's own font.
// With the phone's Bold Text setting on (iPhone), our own fonts go two steps
// heavier, the way the phone's font does by itself (CORE-075).
export function boldened(weight: number, bold: boolean): number {
  return bold ? Math.min(900, weight + 200) : weight;
}

export function familyFor(font: FontKey, weight: number): string | null {
  if (font === "classic") return null;
  // Storybook: Fraunces for headings (semi-bold and up), Nunito for the rest.
  if (font === "storybook" && weight >= 600) return fraunces[weight] ?? fraunces[700];
  return nunito[weight] ?? nunito[400];
}
