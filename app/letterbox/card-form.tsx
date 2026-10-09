import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useLeaveGuard } from "../../components/leave-guard";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { DateField } from "../../components/date-field";
import { Icon } from "../../components/icon";
import { LoadingScreen, Tap } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { Text, TextInput } from "../../components/text";
import { Button, Chip, EmptyState } from "../../components/ui";
import { friendlyError, tap } from "../../lib/feedback";
import { occasions, seasonFor, type Occasion } from "../../lib/letterbox";
import { photoUrls, removeCardPhoto, uploadCardPhoto } from "../../lib/letterbox-data";
import { parseDateString, toDateString } from "../../lib/profile";
import { supabase } from "../../lib/supabase";
import { colors, ui } from "../../lib/theme";
import { useLetterbox } from "../../lib/use-letterbox";

type Photo = { uri: string; mimeType?: string | null; isNew: boolean } | null;

// Log a card sent or received (LET-005/006), with a photo if you like
// (LET-007). Opened from a contact, card season, or to change one.
export default function CardForm() {
  const router = useRouter();
  const params = useLocalSearchParams<{ contactId?: string; direction?: string; occasion?: string; cardId?: string }>();
  const { data, isLoading } = useLetterbox();
  const existing = params.cardId ? data?.cards.find((c) => c.id === params.cardId) : undefined;

  const [ready, setReady] = useState(false);
  const [contactId, setContactId] = useState<string | null>(params.contactId ?? null);
  const [direction, setDirection] = useState<"sent" | "received">(params.direction === "received" ? "received" : "sent");
  const [occasion, setOccasion] = useState<Occasion>((params.occasion as Occasion) ?? "holiday");
  const [date, setDate] = useState(new Date());
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<Photo>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  // Leaving with unsaved changes asks first (CORE-075).
  const { allowLeave } = useLeaveGuard({ contactId, direction, occasion, date, note, photo }, ready);

  useEffect(() => {
    if (ready || !data) return;
    if (params.cardId && !existing) return;
    if (existing) {
      setContactId(existing.contact_id);
      setDirection(existing.direction);
      setOccasion(existing.occasion);
      setDate(parseDateString(existing.on_date));
      setNote(existing.note ?? "");
      if (existing.photo_path) {
        photoUrls([existing.photo_path]).then((urls) => {
          const uri = urls.get(existing.photo_path!);
          if (uri) setPhoto({ uri, isNew: false });
        });
      }
    } else if (!params.occasion && new Date().getMonth() < 10 && new Date().getMonth() > 0) {
      // Outside the holidays, a card is more likely something else.
      setOccasion(direction === "received" ? "thank_you" : "birthday");
    }
    setReady(true);
  }, [data, existing, params.cardId, params.occasion, direction, ready]);

  if (isLoading || !data || (!ready && !(params.cardId && !existing))) return <LoadingScreen cards={2} />;
  if (params.cardId && !existing) return <EmptyState icon="mail" title="That card is gone" />;

  const contact = data.contacts.find((h) => h.id === contactId);
  const query = search.trim().toLowerCase();
  const choices = data.contacts.filter((h) => !query || h.name.toLowerCase().includes(query));

  async function pickPhoto(from: "camera" | "library") {
    const permission =
      from === "camera" ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      return Alert.alert("Nook can't reach your " + (from === "camera" ? "camera" : "photos"), "You can allow it in your phone's Settings.");
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.6 };
    const result = from === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    const asset = result.canceled ? null : result.assets[0];
    if (asset) setPhoto({ uri: asset.uri, mimeType: asset.mimeType, isNew: true });
  }

  function choosePhoto() {
    Alert.alert("Add a photo of the card", undefined, [
      { text: "Take a photo", onPress: () => pickPhoto("camera") },
      { text: "Choose from library", onPress: () => pickPhoto("library") },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  async function save() {
    if (!contact) return Alert.alert("Who's it for?", "Pick a contact first.");
    setSaving(true);
    try {
      let photoPath = existing?.photo_path ?? null;
      if (photo?.isNew) photoPath = await uploadCardPhoto(data!.homeId, photo.uri, photo.mimeType);
      else if (!photo) photoPath = null;
      const row = {
        contact_id: contact.id,
        direction,
        occasion,
        season: seasonFor(occasion, date),
        on_date: toDateString(date),
        note: note.trim() || null,
        photo_path: photoPath,
      };
      const { error } = existing
        ? await supabase.from("letterbox_cards").update(row).eq("id", existing.id)
        : await supabase.from("letterbox_cards").insert({ ...row, home_id: data!.homeId });
      if (error) throw error;
      if (existing?.photo_path && existing.photo_path !== photoPath) removeCardPhoto(existing.photo_path);
      tap("success");
      allowLeave();
      router.back();
    } catch (error) {
      setSaving(false);
      Alert.alert("Couldn't save the card", friendlyError(error as { message?: string }));
    }
  }

  function confirmDelete() {
    Alert.alert("Remove this card?", undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.from("letterbox_cards").delete().eq("id", existing!.id);
          if (error) return Alert.alert("Couldn't remove it", friendlyError(error));
          removeCardPhoto(existing!.photo_path);
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
          title: existing ? "Change card" : direction === "sent" ? "A card you sent" : "A card you got",
          headerRight: () => (
            <Tap onPress={save} disabled={saving} hitSlop={10}>
              <Text style={{ color: colors.bark, fontSize: 17, fontWeight: "700" }}>Save</Text>
            </Tap>
          ),
        }}
      />

      {params.contactId || existing ? (
        contact ? (
          <Text style={[ui.sectionTitle, { marginTop: 0 }]}>{contact.name}</Text>
        ) : null
      ) : (
        <>
          <Text style={ui.label}>{direction === "sent" ? "Sent to" : "From"}</Text>
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
                <Chip key={h.id} selected={contactId === h.id} onPress={() => setContactId(h.id)}>
                  {h.name}
                </Chip>
              ))}
            </View>
          ) : (
            <Text style={ui.muted}>Add a contact to your Letterbox first.</Text>
          )}
        </>
      )}

      <View style={ui.chips}>
        <Chip icon="arrowUp" selected={direction === "sent"} onPress={() => setDirection("sent")}>
          I sent it
        </Chip>
        <Chip icon="arrowDown" selected={direction === "received"} onPress={() => setDirection("received")}>
          They sent it
        </Chip>
      </View>

      <Text style={ui.label}>What for</Text>
      <View style={ui.chips}>
        {occasions.map((o) => (
          <Chip key={o.key} icon={o.icon} selected={occasion === o.key} onPress={() => setOccasion(o.key)}>
            {o.label}
          </Chip>
        ))}
      </View>

      <Text style={ui.label}>{direction === "sent" ? "Mailed on" : "Arrived on"}</Text>
      <DateField mode="date" value={date} onChange={setDate} />
      {occasion === "holiday" && date.getMonth() === 0 ? (
        <Text style={ui.muted}>Counts toward the {date.getFullYear() - 1} holidays.</Text>
      ) : null}

      <Text style={ui.label}>Note (optional)</Text>
      <TextInput
        style={ui.input}
        value={note}
        onChangeText={setNote}
        placeholder={direction === "sent" ? "e.g. Family photo card" : "e.g. Lovely letter from Aunt Jo"}
        placeholderTextColor={colors.muted}
      />

      <Text style={ui.label}>Photo (optional)</Text>
      {photo ? (
        <Animated.View entering={FadeIn.duration(200)} style={{ gap: 10 }}>
          <Image source={{ uri: photo.uri }} style={styles.photo} contentFit="cover" transition={150} />
          <View style={[ui.row, { gap: 10 }]}>
            <Button title="Change" icon="camera" variant="secondary" style={{ flex: 1 }} onPress={choosePhoto} />
            <Button title="Remove" icon="trash" variant="secondary" style={{ flex: 1 }} onPress={() => setPhoto(null)} />
          </View>
        </Animated.View>
      ) : (
        <Tap onPress={choosePhoto} style={[ui.card, styles.addPhoto]}>
          <Icon name="camera" size={28} color={colors.muted} />
          <Text style={ui.muted}>Snap the card to keep it after the paper's gone</Text>
        </Tap>
      )}

      <Button title="Save" icon="check" onPress={save} loading={saving} style={{ marginTop: 8 }} />
      {existing ? <Button title="Remove card" icon="trash" variant="danger" onPress={confirmDelete} /> : null}
    </NookScroll>
  );
}

const styles = StyleSheet.create({
  photo: { width: "100%", aspectRatio: 4 / 3, borderRadius: 18 },
  addPhoto: { alignItems: "center", gap: 8, paddingVertical: 24 },
});
