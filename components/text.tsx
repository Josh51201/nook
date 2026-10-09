import { createContext, useContext, type ReactNode } from "react";
import { StyleSheet, Text as RNText, TextInput as RNTextInput, type TextInputProps, type TextProps } from "react-native";

import { boldened, familyFor, weightOf } from "../lib/fonts";
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
  const sized = scale === 1 ? style : [style, scaledStyle(style, scale, nested)];

  let text;
  if (font === "classic") {
    text = <RNText {...props} style={sized} />;
  } else {
    const asked = StyleSheet.flatten(style)?.fontWeight;
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

export function TextInput({ style, ...props }: TextInputProps) {
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
