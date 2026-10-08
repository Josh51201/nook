// Color helpers for the Hearth's color picker (CORE-042): pure, so they're
// unit-testable.
//
// A Hearth item's color is its *soft* color: a light tint that always works
// with dark text. Its deep partner (used for Bold, outlines and icons) is
// worked out from it, so any hue picked is readable in every look.

export type Hsl = { h: number; s: number; l: number };

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function hexToHsl(hex: string): Hsl {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.replace(/(.)/g, "$1$1") : clean;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  if ([r, g, b].some(Number.isNaN)) return { h: 0, s: 0, l: 0.5 };
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s, l };
}

export function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const hex = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

// Sixteen hues around the wheel, and three strengths of each tint.
export const pickerHues = [0, 18, 35, 48, 70, 100, 140, 165, 185, 205, 225, 250, 275, 300, 325, 345];

export const pickerTiers = [
  { label: "Light", s: 0.5, l: 0.91 },
  { label: "Soft", s: 0.58, l: 0.85 },
  { label: "Rich", s: 0.6, l: 0.77 },
] as const;

export const pickerGreys = ["#f3f1ef", "#e3e0dd", "#cfcbc7", "#b9b4af"];

export function pickerColor(hue: number, tier: number) {
  const t = pickerTiers[clamp(tier, 0, pickerTiers.length - 1)];
  return hslToHex(hue, t.s, t.l);
}

// The deep partner of any soft color: same hue, dark enough to read white
// text on, rich enough to still feel like the color.
export function deepOf(soft: string): string {
  const { h, s } = hexToHsl(soft);
  if (s < 0.08) return "#5a524c";
  return hslToHex(h, clamp(s + 0.08, 0.4, 0.75), 0.34);
}

// Lighter or darker by a fraction of the lightness range (-1..1), keeping hue.
export function shade(hex: string, amount: number): string {
  const { h, s, l } = hexToHsl(hex);
  return hslToHex(h, s, clamp(l + (amount >= 0 ? (1 - l) * amount : l * amount), 0, 1));
}

// WCAG contrast between two colors (1 = none, 21 = black on white).
export function luminance(hex: string): number {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.replace(/(.)/g, "$1$1") : clean;
  const channel = (i: number) => {
    const v = parseInt(full.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// Is it a color we can show (a "#rgb" or "#rrggbb")? Saved settings are only
// ever our own, but a bad value should never crash a screen.
export function isHex(value: unknown): value is string {
  return typeof value === "string" && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value);
}
