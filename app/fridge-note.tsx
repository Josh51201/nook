import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { Alert, PanResponder, TextInput as RNTextInput, View, useWindowDimensions } from "react-native";

import { DoodleView, Magnet } from "../components/fridge-door";
import { Icon } from "../components/icon";
import { useLeaveGuard } from "../components/leave-guard";
import { Tap } from "../components/motion";
import { NookScroll } from "../components/nook-scroll";
import { Text } from "../components/text";
import { Button, Chip } from "../components/ui";
import { tap } from "../lib/feedback";
import {
  addPoint,
  lastsChoices,
  magnets,
  MAX_NOTE_LENGTH,
  MAX_STROKES,
  paperOf,
  papers,
  penWidths,
  pens,
  pointCount,
  toDoodlePoint,
  type FridgePlace,
  type Stroke,
} from "../lib/fridge";
import { stickUpNote } from "../lib/fridge-data";
import { colors, ui } from "../lib/theme";

// Stick something up on a fridge (CORE-086): write a note on a sticky note,
// or doodle one with your finger, pick the paper, and say how long it stays
// up. (?home= or ?burrow= says which fridge.)
export default function StickSomethingUp() {
  const router = useRouter();
  const { home, burrow } = useLocalSearchParams<{ home?: string; burrow?: string }>();
  const place: FridgePlace | null = home ? { kind: "home", id: home } : burrow ? { kind: "burrow", id: burrow } : null;
  const { width } = useWindowDimensions();
  const [mode, setMode] = useState<"note" | "doodle">("note");
  const [body, setBody] = useState("");
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [paper, setPaper] = useState<string>(papers[0].key);
  const [lastsDays, setLastsDays] = useState(1);
  const [pen, setPen] = useState(pens[0]);
  const [penWidth, setPenWidth] = useState(penWidths[1].w);
  const [saving, setSaving] = useState(false);
  // While a finger is on the doodle pad, the page holds still.
  const [drawing, setDrawing] = useState(false);
  const { allowLeave, blockLeave } = useLeaveGuard({ body, strokes });

  const ready = mode === "note" ? body.trim().length > 0 : strokes.length > 0;
  const sheet = paperOf(paper);
  const padSize = Math.min(width - 40, 360);

  async function post() {
    if (!place || !ready || saving) return;
    setSaving(true);
    allowLeave();
    try {
      await stickUpNote(
        place,
        mode === "note"
          ? { kind: "note", body, paper, lastsDays }
          : { kind: "doodle", doodle: strokes, paper, lastsDays }
      );
      tap("success");
      router.back();
    } catch (error) {
      blockLeave();
      setSaving(false);
      Alert.alert("Couldn't stick it up", (error as Error).message);
    }
  }

  return (
    <NookScroll scrollEnabled={!drawing}>
      <Stack.Screen options={{ title: "Stick something up" }} />
      <View style={ui.chips}>
        <Chip icon="edit" selected={mode === "note"} onPress={() => setMode("note")}>
          Write a note
        </Chip>
        <Chip icon="paint" selected={mode === "doodle"} onPress={() => setMode("doodle")}>
          Doodle
        </Chip>
      </View>

      {mode === "note" ? (
        <View style={{ paddingTop: 12, alignSelf: "center", width: padSize }}>
          <View
            style={{
              backgroundColor: sheet.color,
              minHeight: padSize * 0.75,
              borderRadius: 3,
              padding: 18,
              paddingTop: 26,
              transform: [{ rotate: "-1.5deg" }],
              boxShadow: "0px 6px 12px -6px rgba(40, 25, 10, 0.4)",
            }}
          >
            {/* Our own TextInput swaps in the app's font; this one keeps the handwriting. */}
            <RNTextInput
              value={body}
              onChangeText={setBody}
              placeholder="Pizza night! Who's in?"
              placeholderTextColor="#2f2a2666"
              multiline
              maxLength={MAX_NOTE_LENGTH}
              autoFocus
              style={{ fontFamily: "Caveat_700Bold", fontSize: 30, lineHeight: 34, color: "#2f2a26", minHeight: padSize * 0.5, textAlignVertical: "top" }}
              accessibilityLabel="Your note"
            />
            <Text style={{ alignSelf: "flex-end", fontSize: 12, color: "#6f625a" }}>
              {body.length}/{MAX_NOTE_LENGTH}
            </Text>
          </View>
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, alignItems: "center" }}>
            <Magnet color={magnets[0]} size={26} />
          </View>
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          <DoodlePad
            size={padSize}
            paper={sheet.color}
            strokes={strokes}
            pen={pen}
            penWidth={penWidth}
            onChange={setStrokes}
            onDrawing={setDrawing}
          />
          <View style={[ui.row, { gap: 10, flexWrap: "wrap" }]}>
            {pens.map((c) => (
              <Tap
                key={c}
                onPress={() => setPen(c)}
                pressedScale={0.85}
                accessibilityRole="button"
                accessibilityLabel="Pen color"
                accessibilityState={{ selected: pen === c }}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: c,
                  borderWidth: pen === c ? 3 : 0,
                  borderColor: colors.background,
                  boxShadow: pen === c ? `0px 0px 0px 2px ${c}` : undefined,
                }}
              />
            ))}
          </View>
          <View style={[ui.row, { gap: 8, flexWrap: "wrap" }]}>
            {penWidths.map((p) => (
              <Chip key={p.w} selected={penWidth === p.w} onPress={() => setPenWidth(p.w)}>
                {p.label}
              </Chip>
            ))}
            <View style={{ flex: 1 }} />
            <Tap
              onPress={() => setStrokes((s) => s.slice(0, -1))}
              disabled={!strokes.length}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Undo the last line"
              style={{ opacity: strokes.length ? 1 : 0.4, padding: 4 }}
            >
              <Icon name="undo" size={22} />
            </Tap>
            <Tap
              onPress={() => setStrokes([])}
              disabled={!strokes.length}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Start over"
              style={{ opacity: strokes.length ? 1 : 0.4, padding: 4 }}
            >
              <Icon name="trash" size={22} />
            </Tap>
          </View>
        </View>
      )}

      <Text style={ui.label}>Paper</Text>
      <View style={[ui.row, { gap: 10, flexWrap: "wrap" }]}>
        {papers.map((p) => (
          <Tap
            key={p.key}
            onPress={() => setPaper(p.key)}
            pressedScale={0.88}
            accessibilityRole="button"
            accessibilityLabel={`${p.label} paper`}
            accessibilityState={{ selected: paper === p.key }}
            style={{
              width: 38,
              height: 38,
              borderRadius: 4,
              backgroundColor: p.color,
              borderWidth: paper === p.key ? 2.5 : 1,
              borderColor: paper === p.key ? colors.bark : p.line,
              transform: [{ rotate: paper === p.key ? "-6deg" : "0deg" }],
            }}
          />
        ))}
      </View>

      <Text style={ui.label}>Stays up for</Text>
      <View style={ui.chips}>
        {lastsChoices.map((c) => (
          <Chip key={c.days} icon="clock" selected={lastsDays === c.days} onPress={() => setLastsDays(c.days)}>
            {c.label}
          </Chip>
        ))}
      </View>
      <Text style={ui.muted}>Then it comes down by itself. You can take it down sooner from the fridge.</Text>

      <Button title="Stick it on the fridge" icon="fridge" onPress={post} loading={saving} disabled={!ready || !place} />
    </NookScroll>
  );
}

// A square of paper to draw on with a finger. Lines are kept as points on a
// 0–1000 square, so they look the same at any size.
function DoodlePad({
  size,
  paper,
  strokes,
  pen,
  penWidth,
  onChange,
  onDrawing,
}: {
  size: number;
  paper: string;
  strokes: Stroke[];
  pen: string;
  penWidth: number;
  onChange: (strokes: Stroke[]) => void;
  onDrawing: (drawing: boolean) => void;
}) {
  const [live, setLive] = useState<Stroke | null>(null);
  // The responder is made once; these keep it up to date.
  const latest = useRef({ strokes, pen, penWidth, size, onChange, onDrawing });
  latest.current = { strokes, pen, penWidth, size, onChange, onDrawing };
  const current = useRef<Stroke | null>(null);
  const full = strokes.length >= MAX_STROKES;

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        // Keep the finger even if the page wants to scroll.
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: (event) => {
          const { strokes: done, pen: color, penWidth: w, size: side } = latest.current;
          if (done.length >= MAX_STROKES) return;
          latest.current.onDrawing(true);
          const point = toDoodlePoint(event.nativeEvent.locationX, event.nativeEvent.locationY, side);
          current.current = { c: color, w, p: point };
          setLive(current.current);
        },
        onPanResponderMove: (event) => {
          const stroke = current.current;
          if (!stroke) return;
          const { strokes: done, size: side } = latest.current;
          const point = toDoodlePoint(event.nativeEvent.locationX, event.nativeEvent.locationY, side);
          const next = addPoint(stroke, point, pointCount(done) + stroke.p.length / 2);
          if (next !== stroke) {
            current.current = next;
            setLive(next);
          }
        },
        onPanResponderRelease: () => finish(),
        onPanResponderTerminate: () => finish(),
      }),
    []
  );

  function finish() {
    const stroke = current.current;
    current.current = null;
    setLive(null);
    latest.current.onDrawing(false);
    if (stroke) latest.current.onChange([...latest.current.strokes, stroke]);
  }

  return (
    <View
      {...responder.panHandlers}
      accessibilityLabel="Doodle pad. Draw with your finger."
      style={{
        width: size,
        height: size,
        alignSelf: "center",
        backgroundColor: paper,
        borderRadius: 4,
        overflow: "hidden",
        boxShadow: "0px 6px 12px -6px rgba(40, 25, 10, 0.4)",
      }}
    >
      {/* Not touchable, so every touch lands on the pad itself and its
          position is measured from the pad's corner. */}
      <View pointerEvents="none">
        <DoodleView strokes={live ? [...strokes, live] : strokes} size={size} />
      </View>
      {!strokes.length && !live ? (
        <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontFamily: "Caveat_700Bold", fontSize: 26, color: "#2f2a2655" }}>Draw something!</Text>
        </View>
      ) : null}
      {full ? (
        <Text style={{ position: "absolute", bottom: 8, alignSelf: "center", fontSize: 12, color: "#6f625a" }}>That's a full page!</Text>
      ) : null}
    </View>
  );
}
