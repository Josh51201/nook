import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { useAuth } from "../../lib/auth-context";
import { repeatableByDefault, shelfFields, type Shelf } from "../../lib/gift-nook";
import { supabase } from "../../lib/supabase";
import { colors, ui } from "../../lib/theme";

// Add or edit a gift on your own Wishbook (GIFT-002/003/004/009). Pass
// ?giftId=... to edit.
export default function GiftForm() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id;
  const { giftId } = useLocalSearchParams<{ giftId?: string }>();
  const isEditing = Boolean(giftId);

  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [shelfId, setShelfId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [isRepeatable, setIsRepeatable] = useState(false);
  const [details, setDetails] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: shelfRows } = await supabase.from("shelves").select("*").order("sort_order");
      setShelves(shelfRows ?? []);

      if (giftId) {
        const { data: gift, error: giftError } = await supabase
          .from("gifts")
          .select("*")
          .eq("id", giftId)
          .single();
        if (giftError || !gift) {
          setError(giftError?.message ?? "Couldn't load that gift.");
        } else {
          setShelfId(gift.shelf_id);
          setTitle(gift.title);
          setUrl(gift.url ?? "");
          setNotes(gift.notes ?? "");
          setIsRepeatable(gift.is_repeatable);
          setDetails(gift.details ?? {});
        }
      } else if (shelfRows?.length) {
        setShelfId(shelfRows[0].id);
        setIsRepeatable(repeatableByDefault.has(shelfRows[0].key));
      }
      setIsLoading(false);
    })();
  }, [giftId]);

  const shelf = shelves.find((s) => s.id === shelfId);
  const fields = shelfFields[shelf?.key ?? ""] ?? [];

  function pickShelf(next: Shelf) {
    setShelfId(next.id);
    if (!isEditing) setIsRepeatable(repeatableByDefault.has(next.key));
  }

  async function save() {
    if (!userId || !shelfId) return;
    if (!title.trim()) {
      setError("What's the gift? Give it a name.");
      return;
    }
    setIsSaving(true);
    setError(null);

    // Only keep answers for the chosen Shelf's questions.
    const cleanDetails: Record<string, string> = {};
    for (const field of fields) {
      const value = details[field.key]?.trim();
      if (value) cleanDetails[field.key] = value;
    }

    const values = {
      shelf_id: shelfId,
      title: title.trim(),
      url: url.trim() || null,
      notes: notes.trim() || null,
      is_repeatable: isRepeatable,
      details: cleanDetails,
    };

    let saveError;
    if (giftId) {
      ({ error: saveError } = await supabase
        .from("gifts")
        .update({ ...values, updated_at: new Date().toISOString() })
        .eq("id", giftId));
    } else {
      const { data: wishbook } = await supabase
        .from("wishbooks")
        .select("id")
        .eq("owner_id", userId)
        .single();
      ({ error: saveError } = await supabase
        .from("gifts")
        .insert({ ...values, wishbook_id: wishbook?.id }));
    }

    setIsSaving(false);
    if (saveError) setError(saveError.message);
    else router.back();
  }

  function confirmDelete() {
    // Q-009 is still open: claimers aren't told yet when a gift they tucked
    // is deleted. The owner gets no hint either way (GIFT-007).
    Alert.alert("Remove this gift?", "It will disappear from your Wishbook in every Burrow.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          const { error: deleteError } = await supabase.from("gifts").delete().eq("id", giftId!);
          if (deleteError) setError(deleteError.message);
          else router.back();
        },
      },
    ]);
  }

  if (isLoading) {
    return (
      <View style={ui.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
      <Text style={ui.label}>What is it?</Text>
      <TextInput style={ui.input} value={title} onChangeText={setTitle} placeholder="e.g. Cozy wool socks" />

      <Text style={ui.label}>Shelf</Text>
      <View style={ui.chips}>
        {shelves.map((s) => {
          const selected = s.id === shelfId;
          return (
            <TouchableOpacity
              key={s.id}
              style={[ui.chip, selected && ui.chipSelected]}
              onPress={() => pickShelf(s)}
            >
              <Text style={[ui.chipText, selected && ui.chipTextSelected]}>{s.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {fields.map((field) => (
        <View key={field.key} style={{ gap: 16 }}>
          <Text style={ui.label}>{field.label}</Text>
          <TextInput
            style={ui.input}
            value={details[field.key] ?? ""}
            onChangeText={(text) => setDetails((prev) => ({ ...prev, [field.key]: text }))}
            placeholder={field.placeholder}
          />
        </View>
      ))}

      <Text style={ui.label}>Link (Amazon or anywhere)</Text>
      <TextInput
        style={ui.input}
        value={url}
        onChangeText={setUrl}
        placeholder="https://www.amazon.com/..."
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
      />

      <Text style={ui.label}>Notes</Text>
      <TextInput
        style={[ui.input, { minHeight: 80, textAlignVertical: "top" }]}
        value={notes}
        onChangeText={setNotes}
        placeholder="Anything that helps — favorite color, already have the blue one…"
        multiline
      />

      <View style={[ui.row, { justifyContent: "space-between" }]}>
        <View style={{ flex: 1 }}>
          <Text style={ui.cardTitle}>Many people can give this</Text>
          <Text style={ui.muted}>
            On for things like money or clothes. Off means once someone tucks it away, it's taken.
          </Text>
        </View>
        <Switch
          value={isRepeatable}
          onValueChange={setIsRepeatable}
          trackColor={{ true: colors.bark }}
        />
      </View>

      {error ? <Text style={ui.error}>{error}</Text> : null}

      <TouchableOpacity style={ui.button} onPress={save} disabled={isSaving}>
        {isSaving ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={ui.buttonText}>{isEditing ? "Save changes" : "Add to Wishbook"}</Text>
        )}
      </TouchableOpacity>

      {isEditing ? (
        <TouchableOpacity onPress={confirmDelete} style={{ alignItems: "center" }}>
          <Text style={ui.error}>Remove gift</Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}
