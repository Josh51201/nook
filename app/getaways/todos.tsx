import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, View } from "react-native";

import { DateField } from "../../components/date-field";
import { CheckRow } from "../../components/getaway-bits";
import { LoadingScreen, Tap } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { NudgePill, useNudges } from "../../components/nudge";
import { Text, TextInput } from "../../components/text";
import { Button, Chip, EmptyState, SectionHeader } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { friendlyError, tap } from "../../lib/feedback";
import { displayName } from "../../lib/gift-nook";
import { addDays, dueWords, ideaDue, newLines, sortTodos, todoIdeas, type Item } from "../../lib/getaways";
import { addItems, nameOf, setDone, useGetaway } from "../../lib/getaways-data";
import { parseDateString, toDateString } from "../../lib/profile";
import { supabase } from "../../lib/supabase";
import { colors, ui } from "../../lib/theme";

// Before you go (TRIP-006): book the sitter, hold the mail… each with an
// optional do-by day (a reminder goes out that morning) and who's doing it.
export default function BeforeYouGo() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;
  const { data, isLoading, reload } = useGetaway(id, userId);
  const [text, setText] = useState("");
  const [dueOn, setDueOn] = useState<string | null>(null);
  const [who, setWho] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const nudges = useNudges();

  if (isLoading && !data) return <LoadingScreen cards={3} />;
  if (!data) return <EmptyState icon="plane" title="That Getaway isn't here" body="It may have been removed." />;

  const { trip, today } = data;
  const todos = sortTodos(data.items.filter((i) => i.kind === "todo"));
  const grownUps = data.people.filter((p) => !p.is_managed);
  const ideas = todoIdeas.filter((idea) => newLines(todos.map((t) => t.text), [idea.text]).length);

  async function add(line: { text: string; due_on: string | null; for_person: string | null }) {
    setSaving(true);
    const { error } = await addItems(trip.id, "todo", [line]);
    setSaving(false);
    if (error) return Alert.alert("Couldn't add that", friendlyError(error));
    tap("success");
    reload();
  }

  async function addTyped() {
    if (!text.trim()) return;
    await add({ text: text.trim().slice(0, 100), due_on: dueOn, for_person: who });
    setText("");
    setDueOn(null);
    setWho(null);
  }

  async function toggle(item: Item) {
    tap(item.done_at ? undefined : "success");
    const { error } = await setDone(item.id, !item.done_at);
    if (error) Alert.alert("Couldn't save that", friendlyError(error));
    reload();
  }

  function remove(item: Item) {
    Alert.alert(`Take “${item.text}” off?`, undefined, [
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

  return (
    <NookScroll onRefresh={reload}>
      <Stack.Screen options={{ title: `Before you go · ${trip.title}` }} />

      {todos.length ? (
        <View style={[ui.card, { paddingVertical: 4 }]}>
          {todos.map((t) => {
            const due = t.done_at ? null : dueWords(t.due_on, today);
            const doer = t.for_person ? nameOf(data.profiles, t.for_person, userId) : null;
            const sub = t.done_at
              ? `Done by ${nameOf(data.profiles, t.done_by, userId)}`
              : [due, doer ? (doer === "You" ? "yours" : `${doer}'s`) : null].filter(Boolean).join(" · ") || null;
            return (
              <CheckRow
                key={t.id}
                text={t.text}
                sub={sub}
                warn={!!t.due_on && t.due_on <= today}
                done={!!t.done_at}
                onToggle={() => toggle(t)}
                onLongPress={() => remove(t)}
                right={
                  // CORE-101: remind whoever's doing it.
                  !t.done_at && t.for_person && t.for_person !== userId ? (
                    <NudgePill
                      sent={nudges.isSent(t.id)}
                      label={`Nudge ${doer} about ${t.text}`}
                      onPress={() => nudges.nudge(t.id, "todo", t.id)}
                    />
                  ) : null
                }
              />
            );
          })}
        </View>
      ) : (
        <Text style={ui.muted}>The things to sort out before you leave. Give one a do-by day and a reminder goes out that morning.</Text>
      )}
      {todos.length ? <Text style={[ui.muted, { fontSize: 13 }]}>Hold one to take it off.</Text> : null}

      <SectionHeader title="Add one" icon="add" />
      <TextInput
        style={ui.input}
        value={text}
        onChangeText={setText}
        placeholder="e.g. Book the dog sitter"
        placeholderTextColor={colors.muted}
        maxLength={100}
      />
      {dueOn ? (
        <View style={[ui.row, { gap: 12 }]}>
          <Text style={ui.label}>Do by</Text>
          <DateField mode="date" value={parseDateString(dueOn)} onChange={(d) => setDueOn(toDateString(d))} />
          <Tap onPress={() => setDueOn(null)} hitSlop={8}>
            <Text style={ui.error}>No date</Text>
          </Tap>
        </View>
      ) : (
        <Button
          title="Add a do-by day"
          icon="calendar"
          variant="secondary"
          onPress={() => setDueOn(addDays(trip.starts_on, -3) < today ? today : addDays(trip.starts_on, -3))}
          style={{ alignSelf: "flex-start" }}
        />
      )}
      {grownUps.length > 1 ? (
        <>
          <Text style={ui.label}>Who's doing it</Text>
          <View style={ui.chips}>
            <Chip icon="group" selected={who === null} onPress={() => setWho(null)}>
              Anyone
            </Chip>
            {grownUps.map((p) => (
              <Chip key={p.id} icon="person" selected={who === p.id} onPress={() => setWho(p.id)}>
                {p.id === userId ? "Me" : displayName(p)}
              </Chip>
            ))}
          </View>
        </>
      ) : null}
      <Button title="Add" icon="add" onPress={addTyped} disabled={!text.trim()} loading={saving} />

      {ideas.length ? (
        <>
          <SectionHeader title="Ideas" icon="sparkles" />
          <Text style={ui.muted}>Tap one to add it, with a do-by day that leaves time to do it.</Text>
          <View style={ui.chips}>
            {ideas.map((idea) => (
              <Chip
                key={idea.text}
                icon="add"
                onPress={() => add({ text: idea.text, due_on: ideaDue(idea.daysBefore, trip.starts_on, today), for_person: null })}
              >
                {idea.text}
              </Chip>
            ))}
          </View>
        </>
      ) : null}
    </NookScroll>
  );
}
