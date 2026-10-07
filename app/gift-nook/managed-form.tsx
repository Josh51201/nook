import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from "react-native";

import { NookScroll } from "../../components/nook-scroll";
import { supabase } from "../../lib/supabase";
import { colors, ui } from "../../lib/theme";

// GIFT-019: make a Wishbook for a kid (or anyone without a phone). You
// become its manager; add the other parent from its Manage screen.
export default function ManagedForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [burrows, setBurrows] = useState<{ id: string; name: string }[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("burrows")
      .select("id, name")
      .order("name")
      .then(({ data }) => {
        setBurrows(data ?? []);
        setPicked(new Set((data ?? []).map((b) => b.id)));
      });
  }, []);

  function toggle(burrowId: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(burrowId)) next.delete(burrowId);
      else next.add(burrowId);
      return next;
    });
  }

  async function create() {
    if (!name.trim()) {
      setError("What's their name?");
      return;
    }
    setIsSaving(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("create_managed_profile", {
      profile_name: name.trim(),
      burrow_ids: [...picked],
    });
    setIsSaving(false);
    if (rpcError) setError(rpcError.message);
    else router.replace(`/gift-nook/member/${data}`);
  }

  return (
    <NookScroll>
      <Text style={ui.muted}>
        For kids or anyone without a phone. You'll manage their Wishbook — and since they can't
        peek, you'll see what's been tucked so you can coordinate. When they're older, give them a
        hand-off code to take it over on their own account.
      </Text>

      <Text style={ui.label}>Their name</Text>
      <TextInput style={ui.input} value={name} onChangeText={setName} placeholder="e.g. Lily" />

      <Text style={ui.label}>Which Burrows can see their list?</Text>
      {burrows.length === 0 ? (
        <Text style={ui.muted}>You're not in any Burrows yet — you can add them to one later.</Text>
      ) : (
        <View style={ui.chips}>
          {burrows.map((burrow) => {
            const selected = picked.has(burrow.id);
            return (
              <TouchableOpacity
                key={burrow.id}
                style={[ui.chip, selected && ui.chipSelected]}
                onPress={() => toggle(burrow.id)}
              >
                <Text style={[ui.chipText, selected && ui.chipTextSelected]}>{burrow.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {error ? <Text style={ui.error}>{error}</Text> : null}

      <TouchableOpacity style={ui.button} onPress={create} disabled={isSaving}>
        {isSaving ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={ui.buttonText}>Make their Wishbook</Text>
        )}
      </TouchableOpacity>
    </NookScroll>
  );
}
