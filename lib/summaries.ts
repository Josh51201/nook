import { cornerChoices, liftChoices, type Corners, type Lift } from "./decor";
import { labelFonts } from "./fonts";
import { labelEffects, labelIsBold, labelLetters, labelLook, labelSpacings, labelUnderlines, type LabelItem } from "./hearth-layout";

// The few words shown on a closed menu section (CORE-074) — what's chosen
// right now, so nobody has to open it to check. Pure, so it's unit-testable.

const lookLabels: Record<string, string> = { soft: "Soft", bold: "Bold", outline: "Outline" };

// "Soft · Round corners · Raised shadow"
export function lookSummary(parts: {
  look?: string;
  corners?: Corners;
  lift?: Lift;
  defaultLift?: Lift;
  border?: boolean;
}) {
  const words: string[] = [];
  if (parts.look) words.push(lookLabels[parts.look] ?? parts.look);
  const corners = cornerChoices.find((c) => c.key === (parts.corners ?? "soft"))?.label;
  if (corners) words.push(`${corners} corners`);
  const lift = liftChoices.find((c) => c.key === (parts.lift ?? parts.defaultLift ?? "soft"))?.label;
  if (lift) words.push(`${lift} shadow`);
  if (parts.border) words.push("Outlined");
  return words.join(" · ");
}

// "Small", "3 × 2", plus "· Locked"
export function sizeSummary(presets: { label: string; w: number; h: number }[], w: number, h: number, locked?: boolean) {
  const named = presets.find((p) => p.w === w && p.h === h)?.label ?? `${Math.round(w * 10) / 10} × ${Math.round(h * 10) / 10}`;
  return locked ? `${named} · Locked` : named;
}

// "None", "Kids, Home", "Kids, Home +2"
export function tagsSummary(tags: string[] | undefined, shown = 2) {
  if (!tags?.length) return "None";
  const first = tags.slice(0, shown).join(", ");
  return tags.length > shown ? `${first} +${tags.length - shown}` : first;
}

// Hearth text's lettering in a few words (CORE-082), e.g.
// "Rounded · Bold · Italic · Wavy underline".
export function letteringInWords(item: LabelItem): string {
  const look = labelLook(item);
  const parts = [labelFonts.find((f) => f.key === (item.font ?? "app"))?.label ?? "Same as the app"];
  if (labelIsBold(item)) parts.push("Bold");
  if (look.italic) parts.push("Italic");
  if (look.letters !== "typed") parts.push(labelLetters.find((l) => l.key === look.letters)!.label);
  if (look.spacing !== "normal") parts.push(`${labelSpacings.find((l) => l.key === look.spacing)!.label} spacing`);
  if (look.underline !== "none") parts.push(`${labelUnderlines.find((l) => l.key === look.underline)!.label} underline`);
  if (look.effect !== "none") parts.push(labelEffects.find((l) => l.key === look.effect)!.label);
  return parts.join(" · ");
}
