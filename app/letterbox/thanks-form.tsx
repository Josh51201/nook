import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useLeaveGuard } from "../../components/leave-guard";
import { useEffect, useState } from "react";
import { Alert, View } from "react-native";

import { LoadingScreen, Tap } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { Text, TextInput } from "../../components/text";
import { Button, Chip } from "../../components/ui";
import { friendlyError, tap } from "../../lib/feedback";
import { NO_NOTE } from "../../lib/letterbox";
import type { Thanks } from "../../lib/letterbox-data";
import { supabase } from "../../lib/supabase";
import { colors, ui } from "../../lib/theme";
import { useLetterbox } from "../../lib/use-letterbox";

// One thank-you note owed (LET-011): what it's for and who it's to — a
// contact in your Letterbox, or just a name. For a gift from the Gift
// Nook, you're the one saying who it was from (GIFT-007).
export default function ThanksForm() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; giftId?: string; what?: string }>();
  const { data, isLoading } = useLetterbox();
  const [existing, setExisting] = useState<Thanks | null | undefined>(params.id ? undefined : null);
  const [what, setWhat] = useState(params.what ?? "");
  const [contactId, setContactId] = useState<string | null>(null);
  const [fromName, setFromName] = useState("");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  // Leaving with unsaved changes asks first (CORE-075).
  const { allowLeave } = useLeaveGuard({ what, contactId, fromName }, existing !== undefined);

  useEffect(() => {
    if (!params.id) return;
    supabase
      .from("letterbox_thanks")
      .select("*")
      .eq("id", params.id)
      .maybeSingle()
      .then(({ data: row }) => {
        const item = row as Thanks | null;
        setExisting(item);
        if (item) {
          setWhat(item.what);
          setContactId(item.contact_id);
          setFromName(item.from_name === NO_NOTE ? "" : (item.from_name ?? ""));
        }
      });
  }, [params.id]);

  if (isLoading || !data || existing === undefined) return <LoadingScreen cards={2} />;

  const giftId = existing?.gift_id ?? params.giftId ?? null;
  const query = search.trim().toLowerCase();
  const choices = data.contacts.filter((h) => !query || h.name.toLowerCase().includes(query));

  async function save(skip = false) {
    if (!what.trim()) return Alert.alert("What's it for?", "Like “the cozy scarf”.");
    if (!skip && !contactId && !fromName.trim()) return Alert.alert("Who's it to?", "Pick a contact or type a name.");
    setSaving(true);
    const row = {
      what: what.trim(),
      contact_id: skip ? null : contactId,
      from_name: skip ? NO_NOTE : contactId ? null : fromName.trim(),
      ...(skip ? { thanked_at: new Date().toISOString() } : {}),
    };
    const { error } = existing
      ? await supabase.from("letterbox_thanks").update(row).eq("id", existing.id)
      : await supabase.from("letterbox_thanks").insert({ ...row, home_id: data!.homeId, gift_id: giftId });
    if (error) {
      setSaving(false);
      return Alert.alert("Couldn't save", friendlyError(error));
    }
    tap("success");
    allowLeave();
    router.back();
  }

  function confirmDelete() {
    Alert.alert("Remove this thank-you?", undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.from("letterbox_thanks").delete().eq("id", existing!.id);
          if (error) return Alert.alert("Couldn't remove it", friendlyError(error));
          allowLeave();
          router.back();
        },
      },
    ]);
  }

  return (
    <NookScroll>
      <Stack.Screen
        options={{
          title: existing ? "Thank-you" : giftId ? "Who was it from?" : "A thank-you",
          headerRight: () => (
            <Tap onPress={() => save()} disabled={saving} hitSlop={10}>
              <Text style={{ color: colors.bark, fontSize: 17, fontWeight: "700" }}>Save</Text>
            </Tap>
          ),
        }}
      />

      <Text style={ui.label}>For</Text>
      <TextInput
        style={ui.input}
        value={what}
        onChangeText={setWhat}
        placeholder="e.g. the cozy scarf, a wedding gift, dinner"
        placeholderTextColor={colors.muted}
      />

      <Text style={ui.label}>To</Text>
      {data.contacts.length > 8 ? (
        <TextInput
          style={ui.input}
          value={search}
          onChangeText={setSearch}
          placeholder="Find a contact…"
          placeholderTextColor={colors.muted}
        />
      ) : null}
      {data.contacts.length ? (
        <View style={ui.chips}>
          {choices.map((h) => (
            <Chip
              key={h.id}
              selected={contactId === h.id}
              onPress={() => {
                setContactId(contactId === h.id ? null : h.id);
                setFromName("");
              }}
            >
              {h.name}
            </Chip>
          ))}
        </View>
      ) : null}
      <TextInput
        style={ui.input}
        value={fromName}
        onChangeText={(value) => {
          setFromName(value);
          if (value) setContactId(null);
        }}
        placeholder={data.contacts.length ? "…or type a name" : "Their name"}
        placeholderTextColor={colors.muted}
      />

      <Button title="Save" icon="check" onPress={() => save()} loading={saving} style={{ marginTop: 8 }} />
      {giftId && !existing ? (
        <Button title={NO_NOTE} icon="check" variant="secondary" onPress={() => save(true)} />
      ) : null}
      {existing ? <Button title="Remove" icon="trash" variant="danger" onPress={confirmDelete} /> : null}
    </NookScroll>
  );
}
