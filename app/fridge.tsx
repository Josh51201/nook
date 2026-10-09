import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, Switch, View, useWindowDimensions } from "react-native";

import { Avatar } from "../components/avatar";
import { BottomSheet } from "../components/bottom-sheet";
import { firstName, FridgeDoor, FridgeNoteCard, LabelTape, LetterMagnets } from "../components/fridge-door";
import { LoadingScreen } from "../components/motion";
import { NookScroll } from "../components/nook-scroll";
import { Text } from "../components/text";
import { Button, EmptyState } from "../components/ui";
import { useAuth } from "../lib/auth-context";
import { luminance } from "../lib/colors";
import { tap } from "../lib/feedback";
import { comesDownWords, hashOf, isFridgeColor, postedWords, type FridgeNote, type FridgePlace } from "../lib/fridge";
import { markFridgesSeen, takeDownNote, useFridgeNotes } from "../lib/fridge-data";
import { useHomeHearth } from "../lib/home-hearth-data";
import { fridgeSettingDefaults, useNookSettings } from "../lib/nook-settings";
import { supabase } from "../lib/supabase";
import { colors, ui } from "../lib/theme";

// A fridge door up close (CORE-086): every note and doodle your Home or a
// Burrow has stuck up, big enough to read. Tap one to see who left it and
// when it comes down; "Stick something up" adds your own. Opened from a
// Fridge door widget or from its notice in the inbox (?home= or ?burrow=).
export default function FridgeScreen() {
  const router = useRouter();
  const { home, burrow, color } = useLocalSearchParams<{ home?: string; burrow?: string; color?: string }>();
  const place: FridgePlace | null = home ? { kind: "home", id: home } : burrow ? { kind: "burrow", id: burrow } : null;
  const { session } = useAuth();
  const homeHearth = useHomeHearth();
  const { width } = useWindowDimensions();
  const [refreshKey, setRefreshKey] = useState(0);
  const { notes, loaded, error, reload } = useFridgeNotes(place, refreshKey);
  const [burrowName, setBurrowName] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const { settings, update } = useNookSettings("fridge", fridgeSettingDefaults);

  useFocusEffect(useCallback(() => setRefreshKey((k) => k + 1), []));

  useEffect(() => {
    if (!burrow) return;
    supabase
      .from("burrows")
      .select("name")
      .eq("id", burrow)
      .maybeSingle()
      .then(({ data }) => setBurrowName(data?.name ?? null));
  }, [burrow]);

  // Being here counts as seeing what's up.
  useEffect(() => {
    if (place && loaded) void markFridgesSeen([place]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [home, burrow, loaded, notes.length]);

  if (!place) return <EmptyState icon="fridge" title="That fridge isn't here" body="Open a fridge from a Fridge door widget on your Hearth." />;
  if (!loaded) return <LoadingScreen cards={2} />;

  const title = place.kind === "home" ? "Home fridge" : burrowName ? `${burrowName} fridge` : "Burrow fridge";
  const open = notes.find((n) => n.id === openId) ?? null;
  const notifyKey = place.kind === "home" ? "notifyHome" : "notifyBurrow";
  const others = place.kind === "home" ? homeHearth.others : null;

  return (
    <View style={{ flex: 1 }}>
      <NookScroll onRefresh={reload}>
        <Stack.Screen options={{ title }} />
        {error ? <Text style={ui.error}>Couldn't load the fridge: {error}</Text> : null}
        <BigFridge
          notes={notes}
          width={width - 40}
          title={title}
          enamel={isFridgeColor(color) ? color : "#f3ede4"}
          onOpen={(note) => {
            tap();
            setOpenId(note.id);
          }}
        />
        <Button
          title="Stick something up"
          icon="add"
          onPress={() => router.push(`/fridge-note?${place.kind}=${place.id}` as never)}
        />
        <Text style={ui.muted}>
          {place.kind === "home"
            ? others && others.length
              ? `Everyone in your Home sees this fridge: ${others.join(", ")}.`
              : "Everyone in your Home sees this fridge. It's just you so far; invite the people you live with from the Home page."
            : "Everyone in this Burrow sees this fridge."}{" "}
          Each note comes down by itself after a day, three days or a week, whichever its writer picked.
        </Text>
        <View style={[ui.row, { justifyContent: "space-between" }]}>
          <Text style={[ui.cardTitle, { flex: 1 }]}>
            {place.kind === "home" ? "Tell me when someone in my Home sticks one up" : "Tell me when someone in a Burrow sticks one up"}
          </Text>
          <Switch
            value={settings[notifyKey]}
            onValueChange={(on) => update({ [notifyKey]: on }).catch((e: Error) => Alert.alert("Couldn't save that", e.message))}
            trackColor={{ true: colors.bark }}
          />
        </View>
      </NookScroll>

      <BottomSheet visible={Boolean(open)} onClose={() => setOpenId(null)}>
        {open ? (
          <NoteUpClose
            note={open}
            width={width}
            canTakeDown={open.author_id === session?.user.id || place.kind === "home"}
            onTakeDown={() => {
              const mine = open.author_id === session?.user.id;
              Alert.alert(
                "Take it down?",
                mine ? "It comes off the fridge for everyone." : `${firstName(open.author?.display_name)} stuck this up. It comes off the fridge for everyone.`,
                [
                  { text: "Leave it up", style: "cancel" },
                  {
                    text: "Take it down",
                    style: "destructive",
                    onPress: () => {
                      setOpenId(null);
                      takeDownNote(place, open.id).catch((e: Error) => Alert.alert("Couldn't take it down", e.message));
                    },
                  },
                ]
              );
            }}
          />
        ) : null}
      </BottomSheet>
    </View>
  );
}

// The whole fridge: a freezer door on top with its label and magnets, and
// the notes on the big door below, two across.
function BigFridge({
  notes,
  width,
  title,
  enamel,
  onOpen,
}: {
  notes: FridgeNote[];
  width: number;
  title: string;
  enamel: string;
  onOpen: (note: FridgeNote) => void;
}) {
  const freezer = 104;
  const pad = { left: 12, right: 30, top: 16, bottom: 18 };
  const innerW = width - pad.left - pad.right;
  const cols = 2;
  const cell = innerW / cols;
  const rows = Math.max(2, Math.ceil(notes.length / cols));
  const grid = { cellW: cell, cellH: cell * 1.02 };
  // Words on the door stay readable on a deep-colored fridge.
  const ink = luminance(enamel) < 0.3 ? "rgba(255,255,255,0.88)" : "#6f625a";
  const height = freezer + pad.top + rows * grid.cellH + pad.bottom;

  return (
    <FridgeDoor width={width} height={height} enamel={enamel} outline={colors.bark} radius={30} freezerAt={freezer}>
      <LabelTape text={title} style={{ top: 18, left: 18 }} />
      <View style={{ position: "absolute", right: 34, top: 30 }}>
        <LetterMagnets size={34} />
      </View>
      <Text style={{ position: "absolute", left: 18, top: 52, color: ink, fontSize: 13, fontWeight: "600" }}>
        {notes.length ? `${notes.length} up right now` : "Nothing up yet"}
      </Text>
      <View style={{ position: "absolute", left: pad.left, top: freezer + pad.top, width: innerW, bottom: pad.bottom }}>
        {notes.length === 0 ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 20 }}>
            <Text style={{ fontFamily: "Caveat_700Bold", fontSize: 28, color: ink, textAlign: "center" }}>
              A clean fridge!
            </Text>
            <Text style={{ color: ink, fontSize: 14, textAlign: "center" }}>
              Leave a note, a doodle, a "dinner at 6", or just a hello.
            </Text>
          </View>
        ) : (
          notes.map((note, i) => {
            const jitter = (hashOf(note.id) % 9) - 4;
            return (
              <View
                key={note.id}
                style={{ position: "absolute", left: (i % cols) * grid.cellW + 7 + jitter, top: Math.floor(i / cols) * grid.cellH + 6 }}
              >
                <FridgeNoteCard note={note} width={grid.cellW - 14} height={grid.cellH - 12} big onPress={() => onOpen(note)} />
              </View>
            );
          })
        )}
      </View>
    </FridgeDoor>
  );
}

// One note, big: who left it, when, and when it comes down.
function NoteUpClose({
  note,
  width,
  canTakeDown,
  onTakeDown,
}: {
  note: FridgeNote;
  width: number;
  canTakeDown: boolean;
  onTakeDown: () => void;
}) {
  const size = Math.min(width - 80, 300);
  return (
    <View style={{ gap: 14, alignItems: "center" }}>
      <View style={{ paddingTop: 6 }}>
        <FridgeNoteCard note={note} width={size} height={size} big />
      </View>
      <View style={[ui.row, { gap: 10, alignSelf: "stretch" }]}>
        <Avatar name={note.author?.display_name} icon={note.author?.avatar_icon} color={note.author?.avatar_color} size={38} />
        <View style={{ flex: 1 }}>
          <Text style={ui.cardTitle}>From {note.author?.display_name?.trim() || "someone"}</Text>
          <Text style={ui.muted}>
            {postedWords(note.created_at)} · {comesDownWords(note.expires_at)}
          </Text>
        </View>
      </View>
      {canTakeDown ? <Button title="Take it down" icon="trash" variant="danger" onPress={onTakeDown} /> : null}
    </View>
  );
}
