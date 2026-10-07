import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Text, TextInput, TouchableOpacity, View } from "react-native";

import { NookScroll } from "../../../components/nook-scroll";
import { tuckStatusLabel, type TuckStatus } from "../../../lib/gift-nook";
import { supabase } from "../../../lib/supabase";
import { colors, ui } from "../../../lib/theme";

// Edit one of your tucks: planning/bought and a note other givers can see
// (GIFT-023/024). The gift's owner never sees any of it (GIFT-007).
export default function TuckScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [giftTitle, setGiftTitle] = useState("");
  const [status, setStatus] = useState<TuckStatus>("planning");
  const [note, setNote] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("claims")
      .select("status, note, gifts(title)")
      .eq("id", id)
      .single()
      .then(({ data }) => {
        setGiftTitle((data?.gifts as unknown as { title: string } | null)?.title ?? "");
        setStatus((data?.status as TuckStatus) ?? "planning");
        setNote(data?.note ?? "");
        setIsLoading(false);
      });
  }, [id]);

  async function save() {
    setIsSaving(true);
    const { error } = await supabase.rpc("update_tuck", {
      claim_id: id,
      new_status: status,
      new_note: note,
    });
    setIsSaving(false);
    if (error) Alert.alert("Couldn't save", error.message);
    else router.back();
  }

  if (isLoading) {
    return (
      <View style={ui.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (status === "given") {
    return (
      <View style={ui.center}>
        <Text style={ui.cardTitle}>{giftTitle}</Text>
        <Text style={ui.muted}>{tuckStatusLabel.given} — all done!</Text>
      </View>
    );
  }

  return (
    <NookScroll>
      <Text style={ui.sectionTitle}>{giftTitle}</Text>

      <Text style={ui.label}>Where are you at?</Text>
      <View style={ui.chips}>
        {(["planning", "bought"] as const).map((option) => {
          const selected = status === option;
          return (
            <TouchableOpacity
              key={option}
              style={[ui.chip, selected && ui.chipSelected]}
              onPress={() => setStatus(option)}
            >
              <Text style={[ui.chipText, selected && ui.chipTextSelected]}>{tuckStatusLabel[option]}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={ui.label}>Note for other givers</Text>
      <TextInput
        style={[ui.input, { minHeight: 80, textAlignVertical: "top" }]}
        value={note}
        onChangeText={setNote}
        placeholder="e.g. got the blue one · arriving 12/20"
        multiline
        maxLength={500}
      />
      <Text style={ui.muted}>Everyone giving to them can see this. They never can.</Text>

      <TouchableOpacity style={ui.button} onPress={save} disabled={isSaving}>
        {isSaving ? <ActivityIndicator color={colors.white} /> : <Text style={ui.buttonText}>Save</Text>}
      </TouchableOpacity>
    </NookScroll>
  );
}
