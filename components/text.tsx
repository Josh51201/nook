import { createContext, useContext, type ReactNode, type Ref } from "react";
import { Platform, StyleSheet, Text as RNText, TextInput as RNTextInput, type TextInputProps, type TextProps } from "react-native";

import { boldened, chalkFamily, familyFor, labelFamily, weightOf } from "../lib/fonts";
import type { WidgetFont } from "../lib/widget-skins";
import { currentBoldText, currentFont, currentTextScale } from "../lib/theme";
import { scaledType } from "../lib/text-size";

// Text and TextInput for the whole app, in the chosen font (CORE-035) and
// the chosen text size (CORE-068).
// The weight a style asks for picks the right font file (lib/fonts.ts).
// Nested text with no weight of its own keeps its parent's, just like
// normal text does. With the "classic" font and "Normal" size this is plain
// React Native text.

const ParentWeight = createContext<number | null>(null);
// Inside another <Text>, where a missing size means "same as the parent".
const InsideText = createContext(false);
// Set to 1 by <FixedTextSize>: text in here ignores the text size setting.
const FixedScale = createContext<number | null>(null);
// A Hearth widget's own font (CORE-128), for all the text inside it.
const OwnFont = createContext<WidgetFont | null>(null);

// Text in here wears `font`, unless a style names a font of its own (a face
// like the embroidery hoop keeps its handwriting).
export function WidgetFontScope({ font, children }: { font: WidgetFont; children: ReactNode }) {
  return <OwnFont.Provider value={font === "app" ? null : font}>{children}</OwnFont.Provider>;
}

const MONO = Platform.select({ ios: "Courier", default: "monospace" });

// The Hearth's tiles and widgets are laid out on a fixed grid, so their text
// stays at its designed size (it still follows the phone's own setting, as it
// always has). Wrap anything drawn on that grid in this.
export function FixedTextSize({ children }: { children: ReactNode }) {
  return <FixedScale.Provider value={1}>{children}</FixedScale.Provider>;
}

function scaledStyle(style: TextProps["style"], scale: number, nested: boolean) {
  const flat = StyleSheet.flatten(style);
  if (nested && flat?.fontSize === undefined) return undefined;
  return scaledType(flat?.fontSize, flat?.lineHeight, scale);
}

export function Text({ style, ...props }: TextProps) {
  const parent = useContext(ParentWeight);
  const nested = useContext(InsideText);
  const scale = useContext(FixedScale) ?? currentTextScale();
  const font = currentFont();
  const own = useContext(OwnFont);
  const sized = scale === 1 ? style : [style, scaledStyle(style, scale, nested)];

  let text;
  // Read the style once, and only when something below needs it (with the
  // phone's own font and no widget font, nothing does).
  const flat = own || font !== "classic" ? StyleSheet.flatten(style) : undefined;
  if (own && !flat?.fontFamily) {
    // A widget's own font. Handwriting runs small, so it's drawn a bit bigger.
    const weight = flat?.fontWeight === undefined && parent !== null ? parent : weightOf(flat?.fontWeight);
    const family =
      own === "typewriter" ? MONO : own === "chalk" ? chalkFamily(boldened(weight, currentBoldText())) : labelFamily(own, boldened(weight, currentBoldText()), font);
    const grow = own === "handwritten" ? 1.2 : own === "typewriter" ? 0.94 : 1;
    const size =
      scale === 1 && grow !== 1 && flat?.fontSize !== undefined ? { fontSize: flat.fontSize * grow, lineHeight: flat.lineHeight ? flat.lineHeight * grow : undefined } : null;
    text = (
      <ParentWeight.Provider value={weight}>
        <RNText
          {...props}
          style={[sized, size, family ? { fontFamily: family, fontWeight: own === "typewriter" ? flat?.fontWeight : "normal", letterSpacing: own === "chalk" ? 0.3 : flat?.letterSpacing } : null]}
        />
      </ParentWeight.Provider>
    );
    return scale === 1 ? text : <InsideText.Provider value>{text}</InsideText.Provider>;
  }
  // Text that names its own font (Hearth text, CORE-076) keeps it.
  if (font === "classic" || flat?.fontFamily) {
    text = <RNText {...props} style={sized} />;
  } else {
    const asked = flat?.fontWeight;
    const weight = asked === undefined && parent !== null ? parent : weightOf(asked);
    text = (
      <ParentWeight.Provider value={weight}>
        <RNText
          {...props}
          style={[sized, { fontFamily: familyFor(font, boldened(weight, currentBoldText())) ?? undefined, fontWeight: "normal" }]}
        />
      </ParentWeight.Provider>
    );
  }
  return scale === 1 ? text : <InsideText.Provider value>{text}</InsideText.Provider>;
}

// `ref` reaches the phone's own text box (React 19 passes it as a prop).
export function TextInput({ style, ...props }: TextInputProps & { ref?: Ref<RNTextInput> }) {
  const font = currentFont();
  const scale = useContext(FixedScale) ?? currentTextScale();
  const flat = StyleSheet.flatten(style);
  const sized = scale === 1 ? style : [style, scaledType(flat?.fontSize, flat?.lineHeight, scale)];
  if (font === "classic") return <RNTextInput {...props} style={sized} />;
  const weight = weightOf(flat?.fontWeight);
  return (
    <RNTextInput
      {...props}
      style={[sized, { fontFamily: familyFor(font, boldened(weight, currentBoldText())) ?? undefined, fontWeight: "normal" }]}
    />
  );
}
