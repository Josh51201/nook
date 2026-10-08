import { useEffect, useState } from "react";
import { Alert, View } from "react-native";

import { friendlyError, tap } from "../lib/feedback";
import { cleanAddress, emptyAddress, hasAddress, type Address } from "../lib/letterbox";
import { supabase } from "../lib/supabase";
import { colors, ui } from "../lib/theme";
import { Text, TextInput } from "./text";
import { Button, Chip, SectionHeader } from "./ui";

// Your mailing address (PROF-005). Optional, but it means family can send
// you cards and their Letterbox stays right when you move. Every Burrow you
// share it with sees it; leave any Burrow out (a work one, say).
export function MailingAddress({ profileId }: { profileId: string }) {
  const [address, setAddress] = useState<Address | null>(null);
  const [saved, setSaved] = useState(false);
  const [burrows, setBurrows] = useState<{ id: string; name: string }[]>([]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from("profile_addresses").select("line1, line2, city, region, postal_code, country").eq("profile_id", profileId).maybeSingle(),
      supabase.from("burrow_members").select("burrows(id, name)").eq("profile_id", profileId),
      supabase.from("address_hidden_burrows").select("burrow_id").eq("profile_id", profileId),
    ]).then(([mine, memberships, hiddenRows]) => {
      const row = mine.data as Address | null;
      setSaved(Boolean(row));
      setAddress(
        row
          ? Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v ?? ""])) as Address
          : emptyAddress()
      );
      setBurrows(
        ((memberships.data ?? []) as unknown as { burrows: { id: string; name: string } | null }[])
          .map((m) => m.burrows)
          .filter((b): b is { id: string; name: string } => Boolean(b))
      );
      setHidden(new Set((hiddenRows.data ?? []).map((h) => h.burrow_id)));
    });
  }, [profileId]);

  if (!address) return null;

  async function save() {
    const clean = cleanAddress(address!);
    if (!hasAddress(clean)) return Alert.alert("Almost there", "Add at least a street address and a city.");
    setSaving(true);
    const { error } = await supabase
      .from("profile_addresses")
      .upsert({ profile_id: profileId, ...clean, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) return Alert.alert("Couldn't save your address", friendlyError(error));
    setSaved(true);
    tap("success");
    Alert.alert("Address saved", "Family's Letterboxes will use it from now on.");
  }

  function remove() {
    Alert.alert("Remove your address?", "Family won't see it anymore.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.from("profile_addresses").delete().eq("profile_id", profileId);
          if (error) return Alert.alert("Couldn't remove it", friendlyError(error));
          setSaved(false);
          setAddress(emptyAddress());
        },
      },
    ]);
  }

  async function toggleBurrow(id: string) {
    tap();
    const wasHidden = hidden.has(id);
    const next = new Set(hidden);
    if (wasHidden) next.delete(id);
    else next.add(id);
    setHidden(next);
    const { error } = wasHidden
      ? await supabase.from("address_hidden_burrows").delete().eq("profile_id", profileId).eq("burrow_id", id)
      : await supabase.from("address_hidden_burrows").insert({ profile_id: profileId, burrow_id: id });
    if (error) {
      setHidden(hidden);
      Alert.alert("Couldn't change that", friendlyError(error));
    }
  }

  const field = (key: keyof Address, placeholder: string, extra?: object) => (
    <TextInput
      style={[ui.input, { flex: 1 }]}
      value={address[key] ?? ""}
      onChangeText={(value) => setAddress((a) => ({ ...a!, [key]: value }))}
      placeholder={placeholder}
      placeholderTextColor={colors.muted}
      {...extra}
    />
  );

  return (
    <View style={{ gap: 12 }}>
      <SectionHeader title="Mailing address" icon="place" />
      <Text style={ui.muted}>
        Optional, but it lets family send you cards — and their Letterbox stays right if you move.
      </Text>
      {field("line1", "Street address", { textContentType: "streetAddressLine1", autoComplete: "street-address" })}
      {field("line2", "Apartment, unit (optional)", { textContentType: "streetAddressLine2" })}
      {field("city", "City", { textContentType: "addressCity" })}
      <View style={[ui.row, { gap: 10 }]}>
        {field("region", "State", { textContentType: "addressState" })}
        {field("postal_code", "ZIP", { textContentType: "postalCode", keyboardType: "numbers-and-punctuation" })}
      </View>
      {field("country", "Country (if not the US)", { textContentType: "countryName" })}
      <Button title={saved ? "Update address" : "Save address"} icon="check" variant="secondary" loading={saving} onPress={save} />
      {saved ? (
        <>
          {burrows.length ? (
            <>
              <Text style={ui.label}>Who can see it</Text>
              <View style={ui.chips}>
                {burrows.map((burrow) => (
                  <Chip key={burrow.id} icon="burrow" selected={!hidden.has(burrow.id)} onPress={() => toggleBurrow(burrow.id)}>
                    {burrow.name}
                  </Chip>
                ))}
              </View>
              <Text style={ui.muted}>
                {hidden.size
                  ? `Hidden from ${burrows.filter((b) => hidden.has(b.id)).map((b) => b.name).join(", ")}. Tap a Burrow to change.`
                  : "Everyone in your Burrows. Tap a Burrow to leave it out."}
              </Text>
            </>
          ) : null}
          <Button title="Remove my address" icon="trash" variant="danger" onPress={remove} />
        </>
      ) : null}
    </View>
  );
}
