import { createContext, useContext } from "react";
import { StyleSheet, Text as RNText, TextInput as RNTextInput, type TextInputProps, type TextProps } from "react-native";

import { familyFor, weightOf } from "../lib/fonts";
import { currentFont } from "../lib/theme";

// Text and TextInput for the whole app, in the chosen font (CORE-035).
// The weight a style asks for picks the right font file (lib/fonts.ts).
// Nested text with no weight of its own keeps its parent's, just like
// normal text does. With the "classic" font this is plain React Native text.

const ParentWeight = createContext<number | null>(null);

export function Text({ style, ...props }: TextProps) {
  const parent = useContext(ParentWeight);
  const font = currentFont();
  if (font === "classic") return <RNText {...props} style={style} />;
  const asked = StyleSheet.flatten(style)?.fontWeight;
  const weight = asked === undefined && parent !== null ? parent : weightOf(asked);
  return (
    <ParentWeight.Provider value={weight}>
      <RNText {...props} style={[style, { fontFamily: familyFor(font, weight) ?? undefined, fontWeight: "normal" }]} />
    </ParentWeight.Provider>
  );
}

export function TextInput({ style, ...props }: TextInputProps) {
  const font = currentFont();
  if (font === "classic") return <RNTextInput {...props} style={style} />;
  const weight = weightOf(StyleSheet.flatten(style)?.fontWeight);
  return (
    <RNTextInput {...props} style={[style, { fontFamily: familyFor(font, weight) ?? undefined, fontWeight: "normal" }]} />
  );
}
