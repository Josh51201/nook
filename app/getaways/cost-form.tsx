import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, View } from "react-native";

import { DateField } from "../../components/date-field";
import { PeopleChips } from "../../components/getaway-bits";
import { useLeaveGuard } from "../../components/leave-guard";
import { LoadingScreen, Tap } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { Text, TextInput } from "../../components/text";
import { Button } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { friendlyError, tap } from "../../lib/feedback";
import { useGetaway } from "../../lib/getaways-data";
import { localDay } from "../../lib/pets";
import { parseDateString, toDateString } from "../../lib/profile";
import { formatMoney, parsePrice, priceText } from "../../lib/subscriptions";
import { supabase } from "../../lib/supabase";
import { colors, ui } from "../../lib/theme";

// Add or change a cost (TRIP-009): what, how much, who paid, and who it's
// split between (everyone going, to start).
export default function CostForm() {
  const router = useRouter();
  const { getawayId, id } = useLocalSearchParams<{ getawayId: string; id?: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;
  const { data } = useGetaway(getawayId, userId);
  const existing = data?.costs.find((c) => c.id === id);

  const [ready, setReady] = useState(false);
  const [what, setWhat] = useState("");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState<string | null>(null);
  const [split, setSplit] = useState<string[]>([]);
  const [spentOn, setSpentOn] = useState(localDay());
  const [saving, setSaving] = useState(false);
  const { allowLeave } = useLeaveGuard({ what, amount, paidBy, split, spentOn }, ready);

  useEffect(() => {
    if (ready || !data) return;
    if (id && !existing) return;
    if (existing) {
      setWhat(existing.what);
      setAmount(priceText(existing.amount_cents));
      setPaidBy(existing.paid_by);
      setSplit(existing.split_among);
      setSpentOn(existing.spent_on);
    } else {
      setPaidBy(userId ?? null);
      setSplit(data.people.map((p) => p.id));
    }
    setReady(true);
  }, [data, existing, id, ready, userId]);

  if (!data || !ready) return <LoadingScreen cards={2} />;

  const cents = parsePrice(amount);
  const each = cents && split.length ? cents / split.length : null;
  const toggle = (pid: string) => setSplit((list) => (list.includes(pid) ? list.filter((x) => x !== pid) : [...list, pid]));

  async function save() {
    if (!what.trim()) return Alert.alert("What was it?", "Like “Groceries” or “The beach house”.");
    if (!cents) return Alert.alert("How much?", "Like 84.50.");
    if (!paidBy) return Alert.alert("Who paid?", "Pick who paid for it.");
    if (!split.length) return Alert.alert("Who's it for?", "Pick at least one person to split it between.");
    setSaving(true);
    const row = { what: what.trim(), amount_cents: cents, paid_by: paidBy, split_among: split, spent_on: spentOn };
    const { error } = existing
      ? await supabase.from("getaway_costs").update(row).eq("id", existing.id)
      : await supabase.from("getaway_costs").insert({ ...row, getaway_id: data!.trip.id });
    if (error) {
      setSaving(false);
      return Alert.alert("Couldn't save", friendlyError(error));
    }
    tap("success");
    allowLeave();
    router.back();
  }

  function confirmDelete() {
    Alert.alert(existing!.is_payback ? "Remove this payback?" : `Remove “${existing!.what}”?`, "Everyone's totals change to match.", [
      { text: "Keep", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.from("getaway_costs").delete().eq("id", existing!.id);
          if (error) return Alert.alert("Couldn't remove it", friendlyError(error));
          allowLeave();
          router.back();
        },
      },
    ]);
  }

  if (existing?.is_payback) {
    return (
      <NookScroll>
        <Stack.Screen options={{ title: "Payback" }} />
        <Text style={ui.muted}>This records a payback, made with “Mark paid”. If it didn't happen, remove it and the amount goes back to owing.</Text>
        <Button title="Remove this payback" icon="trash" variant="danger" onPress={confirmDelete} />
      </NookScroll>
    );
  }

  return (
    <NookScroll>
      <Stack.Screen
        options={{
          title: existing ? "Change cost" : "New cost",
          headerRight: () => (
            <Tap onPress={save} disabled={saving} hitSlop={10}>
              <Text style={{ color: colors.bark, fontSize: 17, fontWeight: "700" }}>Save</Text>
            </Tap>
          ),
        }}
      />
      <TextInput
        style={ui.input}
        value={what}
        onChangeText={setWhat}
        placeholder="What was it? e.g. Groceries"
        placeholderTextColor={colors.muted}
        maxLength={60}
      />
      <View style={[ui.row, { gap: 8 }]}>
        <Text style={[ui.cardTitle, { fontSize: 20 }]}>$</Text>
        <TextInput
          style={[ui.input, { flex: 1 }]}
          value={amount}
          onChangeText={setAmount}
          placeholder="84.50"
          placeholderTextColor={colors.muted}
          keyboardType="decimal-pad"
          maxLength={10}
        />
      </View>

      <Text style={ui.label}>Who paid</Text>
      <PeopleChips people={data.people.filter((p) => !p.is_managed)} selected={paidBy ? [paidBy] : []} onToggle={setPaidBy} userId={userId} />

      <Text style={ui.label}>Split between</Text>
      <PeopleChips people={data.people} selected={split} onToggle={toggle} userId={userId} />
      <Text style={ui.muted}>
        {each ? `${formatMoney(each)} each.` : "Everyone going, to start."} A kid's share is added to their grown-up's.
      </Text>

      <Text style={ui.label}>Day</Text>
      <DateField mode="date" value={parseDateString(spentOn)} onChange={(d) => setSpentOn(toDateString(d))} />

      <Button title="Save" icon="check" onPress={save} loading={saving} style={{ marginTop: 8 }} />
      {existing ? <Button title="Remove" icon="trash" variant="danger" onPress={confirmDelete} /> : null}
    </NookScroll>
  );
}
