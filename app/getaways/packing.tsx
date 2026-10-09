import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, View } from "react-native";

import { CheckRow } from "../../components/getaway-bits";
import { LoadingScreen, Tap } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { Text, TextInput } from "../../components/text";
import { Button, Chip, EmptyState, SectionHeader } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { friendlyError, tap } from "../../lib/feedback";
import { displayName } from "../../lib/gift-nook";
import { builtInLists, newLines, packingFor, packProgress, type Item, type ListOwner } from "../../lib/getaways";
import { addItems, savePackList, setDone, useGetaway, usePackLists } from "../../lib/getaways-data";
import { supabase } from "../../lib/supabase";
import { colors, ui } from "../../lib/theme";

// Packing (TRIP-003, TRIP-008): each person's list and a shared one, ticked
// off as you go. Start one from a ready-made or saved list, and save a list
// to reuse next time.
export default function Packing() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;
  const { data, isLoading, reload } = useGetaway(id, userId);
  const [owner, setOwner] = useState<ListOwner | null>(null);
  const [text, setText] = useState("");
  const [listsKey, setListsKey] = useState(0);
  const savedLists = usePackLists(!!userId, listsKey);
  const [showStart, setShowStart] = useState(false);
  const [saveName, setSaveName] = useState<string | null>(null);

  if (isLoading && !data) return <LoadingScreen cards={3} />;
  if (!data) return <EmptyState icon="plane" title="That Getaway isn't here" body="It may have been removed." />;

  const current: ListOwner = owner ?? (userId && data.people.some((p) => p.id === userId) ? userId : "shared");
  const lines = packingFor(data.items, current);
  const ordered = [...lines.filter((l) => !l.done_at), ...lines.filter((l) => l.done_at)];
  const progress = packProgress(data.items, current);
  const ownerName =
    current === "shared" ? "the shared list" : current === userId ? "your list" : `${displayName(data.people.find((p) => p.id === current) ?? { id: "", display_name: null })}'s list`;

  async function addLine() {
    const value = text.trim();
    if (!value) return;
    setText("");
    const { error } = await addItems(data!.trip.id, "pack", [{ text: value.slice(0, 100), for_person: current === "shared" ? null : current }]);
    if (error) Alert.alert("Couldn't add that", friendlyError(error));
    reload();
  }

  async function startFrom(items: string[]) {
    const fresh = newLines(lines.map((l) => l.text), items);
    if (!fresh.length) return Alert.alert("Already on the list", "Everything from that list is already here.");
    tap("success");
    const { error } = await addItems(data!.trip.id, "pack", fresh.map((t) => ({ text: t, for_person: current === "shared" ? null : current })));
    if (error) Alert.alert("Couldn't add those", friendlyError(error));
    setShowStart(false);
    reload();
  }

  async function toggle(item: Item) {
    tap();
    const { error } = await setDone(item.id, !item.done_at);
    if (error) Alert.alert("Couldn't save that", friendlyError(error));
    reload();
  }

  function remove(item: Item) {
    Alert.alert(`Take “${item.text}” off the list?`, undefined, [
      { text: "Keep", style: "cancel" },
      {
        text: "Take off",
        style: "destructive",
        onPress: async () => {
          await supabase.from("getaway_items").delete().eq("id", item.id);
          reload();
        },
      },
    ]);
  }

  async function saveList() {
    if (!saveName?.trim()) return Alert.alert("Name it", "Like “Beach” or “Weekend at Grandma's”.");
    const { error } = await savePackList(saveName, lines.map((l) => l.text));
    if (error) return Alert.alert("Couldn't save the list", friendlyError(error));
    tap("success");
    setSaveName(null);
    setListsKey((k) => k + 1);
    Alert.alert("Saved", "Start any Getaway's packing from it. Find your saved lists in the Getaway Nook's settings.");
  }

  return (
    <NookScroll onRefresh={reload}>
      <Stack.Screen options={{ title: `Packing · ${data.trip.title}` }} />

      <View style={ui.chips}>
        {data.people.map((p) => (
          <Chip key={p.id} icon={p.is_managed ? "kid" : "person"} selected={current === p.id} onPress={() => setOwner(p.id)}>
            {p.id === userId ? "Mine" : displayName(p)}
          </Chip>
        ))}
        <Chip icon="group" selected={current === "shared"} onPress={() => setOwner("shared")}>
          Shared
        </Chip>
      </View>

      {progress.total ? (
        <View style={{ gap: 6 }}>
          <Text style={[ui.muted, { color: colors.text }]}>
            {progress.done === progress.total ? "All packed!" : `${progress.done} of ${progress.total} packed on ${ownerName}`}
          </Text>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.surface, overflow: "hidden" }}>
            <View style={{ height: 8, width: `${(progress.done / progress.total) * 100}%`, backgroundColor: colors.bark, borderRadius: 4 }} />
          </View>
        </View>
      ) : (
        <Text style={ui.muted}>
          {current === "shared"
            ? "Things for everyone: the first-aid kit, chargers, snacks for the car."
            : `Nothing on ${ownerName} yet. Type things in, or start from a list.`}
        </Text>
      )}

      <View style={[ui.row, { gap: 8 }]}>
        <TextInput
          style={[ui.input, { flex: 1 }]}
          value={text}
          onChangeText={setText}
          placeholder="Add something to pack"
          placeholderTextColor={colors.muted}
          maxLength={100}
          returnKeyType="done"
          submitBehavior="submit"
          onSubmitEditing={addLine}
        />
        <Button title="Add" onPress={addLine} disabled={!text.trim()} style={{ paddingHorizontal: 16 }} />
      </View>

      {ordered.length ? (
        <View style={[ui.card, { paddingVertical: 4 }]}>
          {ordered.map((item) => (
            <CheckRow
              key={item.id}
              text={item.text}
              done={!!item.done_at}
              onToggle={() => toggle(item)}
              onLongPress={() => remove(item)}
              sub={item.done_at && item.done_by && item.done_by !== userId && current !== item.done_by ? `Packed by ${displayName(data.profiles.get(item.done_by) ?? { id: "", display_name: null })}` : null}
            />
          ))}
        </View>
      ) : null}
      {ordered.length ? <Text style={[ui.muted, { fontSize: 13 }]}>Hold a line to take it off.</Text> : null}

      <SectionHeader
        title="Start from a list"
        icon="todo"
        right={
          <Tap onPress={() => setShowStart((v) => !v)} hitSlop={8}>
            <Text style={ui.link}>{showStart ? "Hide" : "Show"}</Text>
          </Tap>
        }
      />
      {showStart ? (
        <View style={{ gap: 8 }}>
          <Text style={ui.muted}>Adds whatever isn't on {ownerName} already.</Text>
          {savedLists?.length ? (
            <>
              <Text style={[ui.muted, { fontSize: 13, fontWeight: "600" }]}>Your lists</Text>
              <View style={ui.chips}>
                {savedLists.map((l) => (
                  <Chip key={l.id} icon="star" onPress={() => startFrom(l.items)}>
                    {l.name} · {l.items.length}
                  </Chip>
                ))}
              </View>
            </>
          ) : null}
          <Text style={[ui.muted, { fontSize: 13, fontWeight: "600" }]}>Ready-made</Text>
          <View style={ui.chips}>
            {builtInLists.map((l) => (
              <Chip key={l.name} icon={l.icon} onPress={() => startFrom(l.items)}>
                {l.name}
              </Chip>
            ))}
          </View>
        </View>
      ) : null}

      {lines.length ? (
        saveName === null ? (
          <Button title="Save this list for next time" icon="star" variant="secondary" onPress={() => setSaveName("")} />
        ) : (
          <View style={[ui.card, { gap: 10 }]}>
            <Text style={ui.label}>Save {lines.length} things as a list</Text>
            <TextInput
              style={ui.input}
              value={saveName}
              onChangeText={setSaveName}
              placeholder="Name it, e.g. Beach"
              placeholderTextColor={colors.muted}
              maxLength={40}
              autoFocus
            />
            <Button title="Save list" icon="check" onPress={saveList} />
            <Tap onPress={() => setSaveName(null)} hitSlop={8} style={{ alignSelf: "center" }}>
              <Text style={ui.link}>Cancel</Text>
            </Tap>
          </View>
        )
      ) : null}
    </NookScroll>
  );
}
