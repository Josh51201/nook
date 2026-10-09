import type { ReactNode } from "react";
import { Platform, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";

import { shade } from "../lib/colors";
import { DOODLE_SIZE, letterMagnets, noteMagnet, noteTilt, paperOf, strokePath, type FridgeNote, type Stroke } from "../lib/fridge";
import { Tap } from "./motion";
import { Text } from "./text";

// The Fridge door's pieces (CORE-086): the door itself (enamel, a chrome
// handle, a freezer seam, a label-maker title), paper notes held up by
// magnets, doodles, and alphabet magnets for an empty door. Used by the
// Hearth widget (components/hearth/widgets.tsx) and the fridge's own screen
// (app/fridge.tsx).

const HAND = "Caveat_700Bold";
const HAND_SOFT = "Caveat_600SemiBold";

export function FridgeDoor({
  width,
  height,
  enamel,
  outline,
  radius = 22,
  freezerAt,
  label,
  border,
  children,
}: {
  width: number;
  height: number;
  // The door's color; null draws just an outline.
  enamel: string | null;
  // The outline (and handle) color for an outline door.
  outline: string;
  radius?: number;
  // Draw a freezer door this many points from the top.
  freezerAt?: number;
  // A label-maker strip in the top corner.
  label?: string | null;
  border?: boolean;
  children?: ReactNode;
}) {
  const handle = enamel ? shade(enamel, enamel === "#ffffff" ? -0.12 : -0.16) : outline;
  const small = Math.min(width, height) < 110;
  const handleWidth = small ? 4 : 7;
  const handles: { top: number; height: number }[] = freezerAt
    ? [
        { top: freezerAt - Math.min(46, freezerAt * 0.5) - 8, height: Math.min(46, freezerAt * 0.5) },
        { top: freezerAt + 12, height: Math.min(90, (height - freezerAt) * 0.32) },
      ]
    : [{ top: height * 0.14, height: Math.max(14, height * 0.3) }];

  return (
    <View
      style={{
        width,
        height,
        borderRadius: radius,
        backgroundColor: enamel ?? "transparent",
        borderWidth: enamel ? (border ? 2.5 : 0) : 2,
        borderColor: enamel ? shade(enamel, -0.35) : outline,
        overflow: "hidden",
        boxShadow: enamel
          ? "0px 6px 14px -8px rgba(60, 40, 20, 0.45), inset 0px 2px 0px rgba(255,255,255,0.55), inset 0px -3px 0px rgba(0,0,0,0.08)"
          : undefined,
      }}
    >
      {/* A soft shine down the enamel. */}
      {enamel ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: width * 0.07,
            width: Math.max(6, width * 0.05),
            backgroundColor: "rgba(255,255,255,0.22)",
          }}
        />
      ) : null}
      {freezerAt ? (
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: freezerAt - 1.5 }}>
          <View style={{ height: 2, backgroundColor: enamel ? shade(enamel, -0.22) : `${outline}66` }} />
          <View style={{ height: 1.5, backgroundColor: "rgba(255,255,255,0.5)" }} />
        </View>
      ) : null}
      {handles.map((h, i) => (
        <View
          key={i}
          pointerEvents="none"
          style={{
            position: "absolute",
            right: small ? 5 : 9,
            top: h.top,
            width: handleWidth,
            height: h.height,
            borderRadius: handleWidth,
            backgroundColor: handle,
            boxShadow: `1px 2px 3px rgba(0,0,0,0.22), inset 1px 1px 0px rgba(255,255,255,0.45)`,
          }}
        />
      ))}
      {children}
      {label ? <LabelTape text={label} /> : null}
    </View>
  );
}

// A strip from a label maker, stuck on a little crooked.
export function LabelTape({ text, style }: { text: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          top: 8,
          left: 10,
          maxWidth: "70%",
          backgroundColor: "#2b2b30",
          borderRadius: 2,
          paddingHorizontal: 6,
          paddingVertical: 2,
          transform: [{ rotate: "-2deg" }],
          boxShadow: "0px 1px 2px rgba(0,0,0,0.3)",
        },
        style,
      ]}
    >
      <Text
        numberOfLines={1}
        style={{
          color: "#f4f4f4",
          fontSize: 10,
          fontWeight: "800",
          letterSpacing: 1.4,
          textTransform: "uppercase",
          fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
        }}
      >
        {text}
      </Text>
    </View>
  );
}

// A round magnet with a little shine.
export function Magnet({ color, size, children }: { color: string; size: number; children?: ReactNode }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        alignItems: "center",
        justifyContent: "center",
        boxShadow: `0px ${Math.max(1, size * 0.12)}px ${Math.max(2, size * 0.2)}px rgba(0,0,0,0.3), inset 0px -${Math.max(1, size * 0.1)}px 0px rgba(0,0,0,0.18)`,
      }}
    >
      <View
        style={{
          position: "absolute",
          top: size * 0.18,
          left: size * 0.22,
          width: size * 0.28,
          height: size * 0.2,
          borderRadius: size,
          backgroundColor: "rgba(255,255,255,0.55)",
        }}
      />
      {children}
    </View>
  );
}

export function firstName(name: string | null | undefined) {
  return name?.trim().split(" ")[0] || "Someone";
}

// One note or doodle on the door: paper hanging a little crooked under its
// magnet, the words in handwriting, signed by whoever stuck it up.
export function FridgeNoteCard({
  note,
  width,
  height,
  onPress,
  big = false,
}: {
  note: FridgeNote;
  width: number;
  height: number;
  onPress?: () => void;
  // On the fridge's own screen: roomier writing and a signature.
  big?: boolean;
}) {
  const paper = paperOf(note.paper);
  const side = Math.min(width, height);
  const magnet = Math.max(10, Math.min(26, side * 0.17));
  const top = magnet * 0.55;
  const signed = height >= 74;
  const signSize = Math.max(11, Math.min(18, side * 0.13));
  const room = height - top - 6 - (signed ? signSize + 2 : 0);
  const fontSize = Math.max(12, Math.min(big ? 30 : 22, side * (big ? 0.15 : 0.17)));
  const lines = Math.max(1, Math.floor(room / (fontSize * 1.05)));
  const who = firstName(note.author?.display_name);

  const card = (
    <View
      style={{
        width,
        height,
        transform: [{ rotate: `${noteTilt(note.id)}deg` }],
      }}
    >
      <View
        style={{
          position: "absolute",
          top: magnet * 0.35,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: paper.color,
          borderRadius: 2,
          boxShadow: "0px 3px 6px -2px rgba(40, 25, 10, 0.35)",
          paddingTop: top,
          paddingHorizontal: Math.max(4, side * 0.07),
          paddingBottom: 4,
          overflow: "hidden",
        }}
      >
        {note.kind === "doodle" && note.doodle ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <DoodleView strokes={note.doodle} size={Math.max(10, Math.min(width - Math.max(8, side * 0.14), room))} />
          </View>
        ) : (
          <Text
            numberOfLines={lines}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            style={{ fontFamily: HAND, fontSize, lineHeight: fontSize * 1.05, color: "#2f2a26" }}
          >
            {note.body}
          </Text>
        )}
        {signed ? (
          <Text
            numberOfLines={1}
            style={{ fontFamily: HAND_SOFT, fontSize: signSize, lineHeight: signSize * 1.1, color: "#6f625a", textAlign: "right" }}
          >
            – {who}
          </Text>
        ) : null}
      </View>
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, alignItems: "center" }}>
        <Magnet color={noteMagnet(note.id)} size={magnet} />
      </View>
    </View>
  );

  if (!onPress) return card;
  return (
    <Tap
      onPress={onPress}
      pressedScale={0.94}
      accessibilityRole="button"
      accessibilityLabel={note.kind === "doodle" ? `A doodle from ${who}` : `Note from ${who}: ${note.body}`}
    >
      {card}
    </Tap>
  );
}

// A doodle's pen strokes, drawn `size` wide (it's always square).
export function DoodleView({ strokes, size, children }: { strokes: Stroke[]; size: number; children?: ReactNode }) {
  const k = size / DOODLE_SIZE;
  return (
    <Svg width={size} height={size}>
      {strokes.map((stroke, i) => (
        <Path
          key={i}
          d={strokePath(stroke.p, size)}
          stroke={stroke.c}
          strokeWidth={Math.max(1, stroke.w * k)}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      ))}
      {children}
    </Svg>
  );
}

// "H I !" in chunky alphabet magnets, for a door with nothing on it.
export function LetterMagnets({ size }: { size: number }) {
  return (
    <View style={{ flexDirection: "row", gap: size * 0.12, alignItems: "flex-end" }} pointerEvents="none">
      {letterMagnets.map((m, i) => (
        <Text
          key={i}
          style={{
            fontSize: size,
            lineHeight: size * 1.1,
            fontWeight: "900",
            color: m.color,
            transform: [{ rotate: `${[-10, 6, 12][i % 3]}deg` }, { translateY: [0, -size * 0.12, size * 0.04][i % 3] }],
            textShadowColor: "rgba(0,0,0,0.25)",
            textShadowOffset: { width: 0, height: Math.max(1, size * 0.05) },
            textShadowRadius: 1,
          }}
        >
          {m.letter}
        </Text>
      ))}
    </View>
  );
}
