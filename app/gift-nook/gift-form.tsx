import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useLeaveGuard } from "../../components/leave-guard";
import { useEffect, useState } from "react";
import { Alert, Image, Switch, View } from "react-native";
import { Text, TextInput } from "../../components/text";

import { Icon } from "../../components/icon";
import { NookScroll } from "../../components/nook-scroll";
import { useAuth } from "../../lib/auth-context";
import { displayName, repeatableByDefault, shelfFields, shelfIcons, type Shelf } from "../../lib/gift-nook";
import { friendlyError, tap } from "../../lib/feedback";
import { fetchLinkPreview } from "../../lib/link-preview";
import { supabase } from "../../lib/supabase";
import { colors, ui } from "../../lib/theme";
import { LoadingScreen, Tap } from "../../components/motion";
import { Button, Chip } from "../../components/ui";

// Add or edit a gift (GIFT-002/003/004/009/030).
//   ?giftId=...        edit an existing gift (yours, your kid's, or your suggestion)
//   ?forProfileId=...  add to someone else's list: a kid you manage gets a
//                      normal gift (GIFT-020); anyone else gets a suggestion,
//                      hidden from them (GIFT-022).
//   ?stashId=...       an Idea Stash note being turned into this gift
//                      (GIFT-036): the form starts filled in from it, and the
//                      note is marked once the gift is added.
export default function GiftForm() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id;
  const { giftId, forProfileId, stashId } = useLocalSearchParams<{ giftId?: string; forProfileId?: string; stashId?: string }>();
  const isEditing = Boolean(giftId);

  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [shelfId, setShelfId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [isRepeatable, setIsRepeatable] = useState(false);
  const [isMostWanted, setIsMostWanted] = useState(false);
  const [price, setPrice] = useState("");
  const [details, setDetails] = useState<Record<string, string>>({});
  const [isSuggestion, setIsSuggestion] = useState(false);
  const [forName, setForName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingPreview, setIsFetchingPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Leaving with unsaved changes asks first (CORE-075).
  const { allowLeave } = useLeaveGuard({ shelfId, title, url, imageUrl, notes, isRepeatable, isMostWanted, price, details }, !isLoading);

  useEffect(() => {
    if (!userId) return;
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
          setImageUrl(gift.image_url);
          setNotes(gift.notes ?? "");
          setIsRepeatable(gift.is_repeatable);
          setIsMostWanted(gift.is_most_wanted);
          setPrice(gift.price != null ? String(gift.price) : "");
          setDetails(gift.details ?? {});
          setIsSuggestion(Boolean(gift.suggested_by));
        }
      } else {
        if (shelfRows?.length) {
          setShelfId(shelfRows[0].id);
          setIsRepeatable(repeatableByDefault.has(shelfRows[0].key));
        }
        if (stashId) {
          const { data: idea } = await supabase.from("idea_stash").select("title, notes, url, price").eq("id", stashId).maybeSingle();
          if (idea) {
            setTitle(idea.title);
            setNotes(idea.notes ?? "");
            setUrl(idea.url ?? "");
            setPrice(idea.price != null ? String(idea.price) : "");
          }
        }
        if (forProfileId && forProfileId !== userId) {
          const [profileResult, managerResult] = await Promise.all([
            supabase.from("profiles").select("id, display_name").eq("id", forProfileId).single(),
            supabase
              .from("profile_managers")
              .select("profile_id")
              .eq("profile_id", forProfileId)
              .eq("manager_id", userId),
          ]);
          setForName(displayName(profileResult.data));
          setIsSuggestion(!managerResult.data?.length);
        }
      }
      setIsLoading(false);
    })();
  }, [giftId, forProfileId, userId]);

  const shelf = shelves.find((s) => s.id === shelfId);
  const fields = shelfFields[shelf?.key ?? ""] ?? [];

  function pickShelf(next: Shelf) {
    setShelfId(next.id);
    if (!isEditing) setIsRepeatable(repeatableByDefault.has(next.key));
  }

  async function fillFromLink() {
    if (!url.trim()) return;
    setIsFetchingPreview(true);
    const preview = await fetchLinkPreview(url.trim());
    setIsFetchingPreview(false);
    if (!preview) {
      Alert.alert(
        "Couldn't read that link",
        "Some shops (Amazon especially) don't always share details. Just type the name in — the link still works."
      );
      return;
    }
    if (preview.title && !title.trim()) setTitle(preview.title);
    else if (preview.title && preview.title !== title) {
      Alert.alert("Use this name?", preview.title, [
        { text: "Keep mine", style: "cancel" },
        { text: "Use it", onPress: () => setTitle(preview.title!) },
      ]);
    }
    if (preview.imageUrl) setImageUrl(preview.imageUrl);
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

    const cleanPrice = price.trim().replace(/[$,\s]/g, "");
    const parsedPrice = cleanPrice ? Number(cleanPrice) : null;
    if (parsedPrice != null && (Number.isNaN(parsedPrice) || parsedPrice < 0)) {
      setIsSaving(false);
      setError("Price should be a number, like 25 or 19.99.");
      return;
    }

    const values = {
      shelf_id: shelfId,
      title: title.trim(),
      url: url.trim() || null,
      image_url: imageUrl,
      notes: notes.trim() || null,
      is_repeatable: isRepeatable,
      is_most_wanted: isSuggestion ? false : isMostWanted,
      price: parsedPrice,
      details: cleanDetails,
    };

    let saveError;
    if (giftId) {
      ({ error: saveError } = await supabase.from("gifts").update(values).eq("id", giftId));
    } else {
      const { data: wishbook } = await supabase
        .from("wishbooks")
        .select("id")
        .eq("owner_id", forProfileId ?? userId)
        .single();
      ({ error: saveError } = await supabase.from("gifts").insert({
        ...values,
        wishbook_id: wishbook?.id,
        suggested_by: isSuggestion ? userId : null,
      }));
      // The idea this came from now shows as done (GIFT-036).
      if (!saveError && stashId) {
        await supabase.from("idea_stash").update({ suggested_at: new Date().toISOString() }).eq("id", stashId);
      }
    }

    setIsSaving(false);
    if (saveError) setError(friendlyError(saveError));
    else {
      tap("success");
      allowLeave();
      router.back();
    }
  }

  function confirmDelete() {
    // If someone tucked it, they get a heads-up; you're never told either way
    // (GIFT-025, GIFT-007).
    Alert.alert(
      isSuggestion ? "Remove this suggestion?" : "Remove this gift?",
      isSuggestion ? undefined : "It will disappear from the Wishbook in every Burrow.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            const { error: deleteError } = await supabase.rpc("remove_gift", { target_gift: giftId });
            if (deleteError) setError(friendlyError(deleteError));
            else {
              allowLeave();
              router.back();
            }
          },
        },
      ]
    );
  }

  if (isLoading) return <LoadingScreen />;

  const screenTitle = isEditing
    ? isSuggestion
      ? "Your suggestion"
      : "Gift"
    : isSuggestion
      ? `Suggest for ${forName ?? "them"}`
      : forName
        ? `Gift for ${forName}`
        : "New gift";

  return (
    <NookScroll>
      <Stack.Screen options={{ title: screenTitle }} />

      {isSuggestion ? (
        <View style={[ui.card, { backgroundColor: "#fff7e6" }]}>
          <View style={[ui.row, { gap: 6 }]}>
            <Icon name="hidden" size={16} />
            <Text style={ui.cardTitle}>This is a suggestion</Text>
          </View>
          <Text style={ui.muted}>
            {forName ?? "They"} won't see it. Everyone else can, and can tuck it away.
          </Text>
        </View>
      ) : null}

      <Text style={ui.label}>Link (Amazon or anywhere)</Text>
      <View style={ui.row}>
        <TextInput
          style={[ui.input, { flex: 1 }]}
          value={url}
          onChangeText={setUrl}
          onEndEditing={() => !title.trim() && url.trim() && fillFromLink()}
          placeholder="https://www.amazon.com/..."
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        {url.trim() ? (
          <Button
            title="Fill in"
            icon="sparkles"
            variant="secondary"
            onPress={fillFromLink}
            loading={isFetchingPreview}
          />
        ) : null}
      </View>

      {imageUrl ? (
        <View style={[ui.row, { gap: 12 }]}>
          <Image source={{ uri: imageUrl }} style={{ width: 80, height: 80, borderRadius: 10 }} resizeMode="contain" />
          <Tap onPress={() => setImageUrl(null)}>
            <Text style={ui.error}>Remove picture</Text>
          </Tap>
        </View>
      ) : null}

      <Text style={ui.label}>What is it?</Text>
      <TextInput style={ui.input} value={title} onChangeText={setTitle} placeholder="e.g. Cozy wool socks" />

      <Text style={ui.label}>Shelf</Text>
      <View style={ui.chips}>
        {shelves.map((s) => {
          const selected = s.id === shelfId;
          return (
            <Chip key={s.id} icon={shelfIcons[s.key] ?? "category"} selected={selected} onPress={() => pickShelf(s)}>{s.label}</Chip>
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

      <Text style={ui.label}>About how much? (optional)</Text>
      <TextInput
        style={ui.input}
        value={price}
        onChangeText={setPrice}
        placeholder="e.g. 25"
        keyboardType="decimal-pad"
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

      {!isSuggestion ? (
        <View style={[ui.row, { justifyContent: "space-between" }]}>
          <View style={{ flex: 1 }}>
            <View style={[ui.row, { gap: 6 }]}>
              <Icon name="heart" size={16} color={colors.heart} />
              <Text style={ui.cardTitle}>Most wanted</Text>
            </View>
            <Text style={ui.muted}>Shows at the top of the list so family knows it's a favorite.</Text>
          </View>
          <Switch value={isMostWanted} onValueChange={setIsMostWanted} trackColor={{ true: colors.bark }} />
        </View>
      ) : null}

      {error ? <Text style={ui.error}>{error}</Text> : null}

      <Button title={isEditing ? "Save changes" : isSuggestion ? "Add suggestion" : "Add to Wishbook"} icon="check" onPress={save} loading={isSaving} />

      {isEditing ? (
        <Tap onPress={confirmDelete} style={{ alignItems: "center" }}>
          <Text style={ui.error}>{isSuggestion ? "Remove suggestion" : "Remove gift"}</Text>
        </Tap>
      ) : null}
    </NookScroll>
  );
}
