import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, View } from "react-native";

import { Avatar } from "../../components/avatar";
import { LoadingScreen, Tap } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { Text, TextInput } from "../../components/text";
import { Button, Chip } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { friendlyError, tap } from "../../lib/feedback";
import { displayName } from "../../lib/gift-nook";
import { ideaKinds, IDEA_SELECT, parsePrice, type Idea, type IdeaKind } from "../../lib/idea-stash";
import { loadStash, type StashData } from "../../lib/idea-stash-data";
import { supabase } from "../../lib/supabase";
import { ui } from "../../lib/theme";

// Add or change a note in your Idea Stash (GIFT-036).
//   ?ideaId=...   change an existing note
//   ?aboutId=...  start a new note about this person
export default function StashForm() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id;
  const { ideaId, aboutId: startAbout } = useLocalSearchParams<{ ideaId?: string; aboutId?: string }>();

  const [data, setData] = useState<StashData | null>(null);
  const [aboutId, setAboutId] = useState<string | null>(startAbout ?? null);
  const [kind, setKind] = useState<IdeaKind>("idea");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [url, setUrl] = useState("");
  const [price, setPrice] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        setData(await loadStash(userId));
        if (ideaId) {
          const { data: idea } = await supabase.from("idea_stash").select(IDEA_SELECT).eq("id", ideaId).maybeSingle();
          const found = idea as Idea | null;
          if (found) {
            setAboutId(found.about_id);
            setKind(found.kind);
            setTitle(found.title);
            setNotes(found.notes ?? "");
            setUrl(found.url ?? "");
            setPrice(found.price != null ? String(found.price) : "");
          }
        }
      } catch (loadError) {
        setError((loadError as Error).message);
      }
      setIsLoading(false);
    })();
  }, [userId, ideaId]);

  async function save() {
    if (!userId || isSaving) return;
    if (!aboutId) return setError("Who is this about? Pick someone.");
    if (!title.trim()) return setError("Give it a short name first.");
    const parsedPrice = parsePrice(price);
    if (parsedPrice === undefined) return setError("Price should be a number, like 25 or 19.99.");
    setIsSaving(true);
    setError(null);
    const values = {
      about_id: aboutId,
      kind,
      title: title.trim(),
      notes: notes.trim() || null,
      url: kind === "idea" ? url.trim() || null : null,
      price: kind === "idea" ? parsedPrice : null,
      updated_at: new Date().toISOString(),
    };
    const { error: saveError } = ideaId
      ? await supabase.from("idea_stash").update(values).eq("id", ideaId)
      : await supabase.from("idea_stash").insert(values);
    setIsSaving(false);
    if (saveError) return setError(friendlyError(saveError));
    tap("success");
    router.back();
  }

  function confirmRemove() {
    Alert.alert("Remove this note?", undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          const { error: removeError } = await supabase.from("idea_stash").delete().eq("id", ideaId!);
          if (removeError) setError(friendlyError(removeError));
          else router.back();
        },
      },
    ]);
  }

  if (isLoading) return <LoadingScreen />;
  const people = [...(data?.people.values() ?? [])].sort((a, b) => displayName(a).localeCompare(displayName(b)));
  const info = ideaKinds.find((k) => k.key === kind)!;

  return (
    <NookScroll>
      <Stack.Screen options={{ title: ideaId ? "Change this note" : "A new note" }} />

      <Text style={ui.label}>Who is it about?</Text>
      {people.length === 0 ? (
        <Text style={ui.muted}>Join or start a Burrow first, so there's someone to write about.</Text>
      ) : (
        <View style={ui.chips}>
          {people.map((person) => (
            <Tap
              key={person.id}
              onPress={() => setAboutId(person.id)}
              disabled={Boolean(ideaId)}
              pressedScale={0.94}
              style={[ui.chip, ui.row, { gap: 8 }, aboutId === person.id && ui.chipSelected]}
              accessibilityRole="button"
              accessibilityState={{ selected: aboutId === person.id }}
            >
              <Avatar name={displayName(person)} icon={person.avatar_icon} color={person.avatar_color} size={22} />
              <Text style={[ui.chipText, aboutId === person.id && ui.chipTextSelected]}>{displayName(person)}</Text>
            </Tap>
          ))}
        </View>
      )}

      <Text style={ui.label}>What kind of note?</Text>
      <View style={ui.chips}>
        {ideaKinds.map((k) => (
          <Chip key={k.key} icon={k.key === "idea" ? "suggest" : "doc"} selected={kind === k.key} onPress={() => setKind(k.key)}>
            {k.label}
          </Chip>
        ))}
      </View>
      <Text style={ui.muted}>{info.hint}</Text>

      <Text style={ui.label}>{kind === "idea" ? "The idea" : "What to remember"}</Text>
      <TextInput style={ui.input} value={title} onChangeText={(t) => setTitle(t.slice(0, 120))} placeholder={info.placeholder} />

      {kind === "idea" ? (
        <>
          <Text style={ui.label}>Link (optional)</Text>
          <TextInput
            style={ui.input}
            value={url}
            onChangeText={setUrl}
            placeholder="https://…"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <Text style={ui.label}>About how much? (optional)</Text>
          <TextInput style={ui.input} value={price} onChangeText={setPrice} placeholder="e.g. 25" keyboardType="decimal-pad" />
        </>
      ) : null}

      <Text style={ui.label}>More details (optional)</Text>
      <TextInput
        style={[ui.input, { minHeight: 80, textAlignVertical: "top" }]}
        value={notes}
        onChangeText={(t) => setNotes(t.slice(0, 1000))}
        placeholder="When they said it, what colour, anything else…"
        multiline
      />

      <Text style={ui.muted}>Only you can see this. Not {aboutId && data?.people.get(aboutId) ? displayName(data.people.get(aboutId)) : "them"}, and not anyone else.</Text>

      {error ? <Text style={ui.error}>{error}</Text> : null}
      <Button title={ideaId ? "Save changes" : "Add to my stash"} icon="check" onPress={save} loading={isSaving} />
      {ideaId ? (
        <Tap onPress={confirmRemove} style={{ alignItems: "center" }}>
          <Text style={ui.error}>Remove this note</Text>
        </Tap>
      ) : null}
    </NookScroll>
  );
}
