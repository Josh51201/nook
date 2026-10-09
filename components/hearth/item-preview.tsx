import { useState, type ReactNode } from "react";
import { View } from "react-native";

// A live look at what you're changing, kept in view while you edit it
// (CORE-079): the item drawn exactly as on your Hearth, on the Hearth's own
// background. Something too big for the frame is shrunk to fit as a whole
// (never squashed), so a tall widget doesn't push the settings off screen.

export function ItemPreview({
  width,
  height,
  maxHeight,
  background,
  backdrop,
  interactive = false,
  children,
}: {
  // Its real size on the Hearth.
  width: number;
  height: number;
  // The most room the preview may take up and down.
  maxHeight: number;
  background: string;
  // The Hearth's wallpaper, drawn behind it.
  backdrop?: ReactNode;
  // A widget's preview can be tapped (e.g. ticking its checklist); tiles and
  // text can't.
  interactive?: boolean;
  children: ReactNode;
}) {
  const [room, setRoom] = useState(0);
  const PAD = 12;
  const scale = room ? Math.min(1, (room - PAD * 2) / width, maxHeight / height) : 1;

  return (
    <View
      onLayout={(e) => setRoom(e.nativeEvent.layout.width)}
      style={{ alignItems: "center", padding: PAD, borderRadius: 24, backgroundColor: background, overflow: "hidden" }}
      accessibilityLabel="Preview"
    >
      {backdrop}
      <View style={{ width: width * scale, height: height * scale }} pointerEvents={interactive ? "auto" : "none"}>
        <View style={{ width, height, transform: [{ scale }], transformOrigin: "top left" }}>{children}</View>
      </View>
    </View>
  );
}
