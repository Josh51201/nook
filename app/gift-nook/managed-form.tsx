import { useLocalSearchParams, useRouter } from "expo-router";
import { useLeaveGuard } from "../../components/leave-guard";
import { useEffect, useState } from "react";
import { Switch, View } from "react-native";
import { Text, TextInput } from "../../components/text";

import { NookScroll } from "../../components/nook-scroll";
import { supabase } from "../../lib/supabase";
import { colors, ui } from "../../lib/theme";
import { Button, Chip } from "../../components/ui";
import { Tap } from "../../components/motion";

// GIFT-019, HOME-008: add a kid (or anyone without a phone) with their own
// Wishbook. You become their manager; add the other parent from their Manage
// screen. A kid who lives with you joins your Home and counts toward its 6.
// Opened from the Home page with ?from=home, it goes back there after.
export default function ManagedForm() {
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const [name, setName] = useState("");
  const [livesHere, setLivesHere] = useState(true);
  const [burrows, setBurrows] = useState<{ id: string; name: string }[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Leaving with unsaved changes asks first (CORE-075).
  const { allowLeave } = useLeaveGuard({ name }, true);

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
    const { data, error: rpcError } = await supabase.rpc("create_home_kid", {
      profile_name: name.trim(),
      burrow_ids: [...picked],
      lives_here: livesHere,
    });
    setIsSaving(false);
    if (rpcError) setError(rpcError.message);
    else {
      allowLeave();
      if (from === "home") router.back();
      else router.replace(`/gift-nook/member/${data}`);
    }
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
              <Chip key={burrow.id} icon="burrow" selected={selected} onPress={() => toggle(burrow.id)}>{burrow.name}</Chip>
            );
          })}
        </View>
      )}

      <View style={[ui.row, { gap: 12 }]}>
        <Text style={[ui.label, { flex: 1 }]}>Lives in your Home</Text>
        <Switch value={livesHere} onValueChange={setLivesHere} trackColor={{ true: colors.bark }} />
      </View>
      <Text style={ui.muted}>
        {livesHere
          ? "They'll show in your Home's Nooks, like the Sitter Sheet and Sick Day, and count toward its 6 people. Your Home's Nook Plus covers them."
          : "For someone who doesn't live with you, like a grandparent without a phone. They won't be in your Home's Nooks or its Nook Plus."}
      </Text>

      {error ? <Text style={ui.error}>{error}</Text> : null}

      <Button title={from === "home" ? "Add them" : "Make their Wishbook"} icon="kid" onPress={create} loading={isSaving} />
    </NookScroll>
  );
}
