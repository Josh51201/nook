import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Switch, View } from "react-native";

import { DateField } from "../../components/date-field";
import { useLeaveGuard } from "../../components/leave-guard";
import { LoadingScreen, Tap } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { Text, TextInput } from "../../components/text";
import { Button, Chip } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { friendlyError, tap } from "../../lib/feedback";
import { phoneTimeZone } from "../../lib/pets";
import { parseDateString, toDateString } from "../../lib/profile";
import {
  categories,
  cleanLast4,
  cycles,
  looksLikeCardNumber,
  matchingPicks,
  normalizeLink,
  parsePrice,
  priceText,
  remindChoices,
  stepRenewal,
  storeLinks,
  type Category,
  type Cycle,
} from "../../lib/subscriptions";
import { personName, useSubscriptions } from "../../lib/subscriptions-data";
import { supabase } from "../../lib/supabase";
import { colors, ui } from "../../lib/theme";

// Add or change a subscription (SUB-001..009): what it is and what it costs,
// how often and when it next charges (or when its free trial ends), the
// reminder, who can see it, who pays and on which card, and where to cancel.
export default function SubscriptionForm() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;
  const { data } = useSubscriptions(userId);
  const existing = data?.subs.find((s) => s.id === id);

  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [cycle, setCycle] = useState<Cycle>("monthly");
  const [renewsOn, setRenewsOn] = useState(toDateString(new Date()));
  const [onTrial, setOnTrial] = useState(false);
  const [category, setCategory] = useState<Category>("other");
  const [remindDays, setRemindDays] = useState<number | null>(3);
  const [isPrivate, setIsPrivate] = useState(false);
  const [payer, setPayer] = useState<string | null>(null);
  const [cardName, setCardName] = useState("");
  const [last4, setLast4] = useState("");
  const [link, setLink] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  // Leaving with unsaved changes asks first (CORE-075).
  const { allowLeave } = useLeaveGuard(
    { name, price, cycle, renewsOn, onTrial, category, remindDays, isPrivate, payer, cardName, last4, link, notes },
    ready
  );

  useEffect(() => {
    if (ready || !data) return;
    if (id && !existing) return;
    if (existing) {
      setName(existing.name);
      setPrice(priceText(existing.price_cents));
      setCycle(existing.cycle as Cycle);
      setRenewsOn(existing.renews_on);
      setOnTrial(existing.on_trial);
      setCategory(existing.category as Category);
      setRemindDays(existing.remind_days);
      setIsPrivate(existing.private);
      setPayer(existing.payer);
      setCardName(existing.card_name ?? "");
      setLast4(existing.card_last4 ?? "");
      setLink(existing.manage_url ?? "");
      setNotes(existing.notes ?? "");
    } else {
      setRenewsOn(stepRenewal(toDateString(new Date()), "monthly"));
    }
    setReady(true);
  }, [data, existing, id, ready]);

  if (!data || !ready) return <LoadingScreen cards={2} />;

  const shared = data.members.length > 1;
  // Only whoever added it can make it "Just me" (the database checks too).
  const canMakePrivate = !existing || existing.created_by === userId;
  const picks = existing ? [] : matchingPicks(name, data.subs.map((s) => s.name), name.trim() ? 6 : 8);

  function pick(p: (typeof picks)[number]) {
    tap();
    setName(p.name);
    setCategory(p.category);
    setCycle(p.cycle);
    setRenewsOn(stepRenewal(toDateString(new Date()), p.cycle));
  }

  function choosePrivate(value: boolean) {
    setIsPrivate(value);
    // A "Just me" one can only be paid by you.
    if (value && payer && payer !== userId) setPayer(userId ?? null);
  }

  async function save() {
    if (!name.trim()) return Alert.alert("What is it?", "Like “Netflix” or “The gym”.");
    const cents = parsePrice(price);
    if (cents === null) return Alert.alert("What does it cost?", onTrial ? "What it will charge once the trial ends, like 15.49." : "What each charge is, like 15.49.");
    if (looksLikeCardNumber(cardName)) {
      return Alert.alert("Not the card number", "Just a name for the card, like “Chase Visa”, and its last 4 digits. Never the full number.");
    }
    const digits = last4.trim() ? cleanLast4(last4) : null;
    if (last4.trim() && !digits) return Alert.alert("Last 4 digits", "Just the last 4 digits of the card, like 1234.");
    const manageUrl = normalizeLink(link);

    setSaving(true);
    const row = {
      name: name.trim(),
      price_cents: cents,
      cycle,
      renews_on: renewsOn,
      on_trial: onTrial,
      category,
      remind_days: remindDays,
      private: isPrivate,
      payer: isPrivate && payer !== userId ? null : payer,
      card_name: cardName.trim() || null,
      card_last4: digits,
      manage_url: manageUrl,
      notes: notes.trim() || null,
      tz: phoneTimeZone(),
    };
    const { error } = existing
      ? await supabase.from("subscriptions").update(row).eq("id", existing.id)
      : await supabase.from("subscriptions").insert({ ...row, home_id: data!.homeId });
    if (error) {
      setSaving(false);
      return Alert.alert("Couldn't save", friendlyError(error));
    }
    tap("success");
    allowLeave();
    router.back();
  }

  function confirmDelete() {
    Alert.alert(
      `Remove “${existing!.name}”?`,
      "Its price history goes too. If you've cancelled it, “I paused or cancelled it” keeps it and counts what it saves instead.",
      [
        { text: "Keep it", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase.from("subscriptions").delete().eq("id", existing!.id);
            if (error) return Alert.alert("Couldn't remove it", friendlyError(error));
            allowLeave();
            router.dismissTo("/subscriptions");
          },
        },
      ]
    );
  }

  return (
    <NookScroll>
      <Stack.Screen
        options={{
          title: existing ? "Change subscription" : "New subscription",
          headerRight: () => (
            <Tap onPress={save} disabled={saving} hitSlop={10}>
              <Text style={{ color: colors.bark, fontSize: 17, fontWeight: "700" }}>Save</Text>
            </Tap>
          ),
        }}
      />

      <TextInput
        style={ui.input}
        value={name}
        onChangeText={setName}
        placeholder="What is it? e.g. Netflix"
        placeholderTextColor={colors.muted}
        maxLength={60}
      />
      {picks.length ? (
        <View style={ui.chips}>
          {picks.map((p) => (
            <Chip key={p.name} icon={categories.find((c) => c.key === p.category)?.icon} onPress={() => pick(p)}>
              {p.name}
            </Chip>
          ))}
        </View>
      ) : null}

      <Text style={ui.label}>{onTrial ? "Price once the trial ends" : "Price"}</Text>
      <View style={[ui.row, { gap: 8 }]}>
        <Text style={[ui.cardTitle, { fontSize: 20 }]}>$</Text>
        <TextInput
          style={[ui.input, { flex: 1 }]}
          value={price}
          onChangeText={setPrice}
          placeholder="15.49"
          placeholderTextColor={colors.muted}
          keyboardType="decimal-pad"
          maxLength={10}
        />
      </View>

      <Text style={ui.label}>Charges</Text>
      <View style={ui.chips}>
        {cycles.map((c) => (
          <Chip key={c.key} selected={cycle === c.key} onPress={() => setCycle(c.key)}>
            {c.label}
          </Chip>
        ))}
      </View>

      <View style={[ui.card, ui.row, { gap: 12 }]}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={ui.cardTitle}>On a free trial</Text>
          <Text style={ui.muted}>You'll be reminded before it starts charging, so there's time to cancel.</Text>
        </View>
        <Switch value={onTrial} onValueChange={setOnTrial} trackColor={{ true: colors.bark }} />
      </View>

      <Text style={ui.label}>{onTrial ? "Free trial ends (the first charge)" : "Next charge"}</Text>
      <DateField mode="date" value={parseDateString(renewsOn)} onChange={(d) => setRenewsOn(toDateString(d))} />
      <Text style={ui.muted}>After each charge, the next date moves on by itself.</Text>

      <Text style={ui.label}>Remind me</Text>
      <View style={ui.chips}>
        {remindChoices.map((c) => (
          <Chip key={c.label} icon={c.days ? "bell" : undefined} selected={remindDays === c.days} onPress={() => setRemindDays(c.days)}>
            {c.label}
          </Chip>
        ))}
      </View>

      <Text style={ui.label}>Kind</Text>
      <View style={ui.chips}>
        {categories.map((c) => (
          <Chip key={c.key} icon={c.icon} selected={category === c.key} onPress={() => setCategory(c.key)}>
            {c.label}
          </Chip>
        ))}
      </View>

      <Text style={ui.label}>Who can see it</Text>
      {canMakePrivate ? (
        <>
          <View style={ui.chips}>
            <Chip icon="group" selected={!isPrivate} onPress={() => choosePrivate(false)}>
              Everyone in my Home
            </Chip>
            <Chip icon="lock" selected={isPrivate} onPress={() => choosePrivate(true)}>
              Just me
            </Chip>
          </View>
          <Text style={ui.muted}>
            {isPrivate
              ? "Nobody else sees it or counts it in their totals, even people you live with."
              : "Everyone you live with sees it and can change it."}
          </Text>
        </>
      ) : (
        <Text style={ui.muted}>
          Shared with your Home. Only {personName(data, existing!.created_by, userId)}, who added it, can make it “Just me”.
        </Text>
      )}

      <Text style={ui.label}>Who pays</Text>
      <View style={ui.chips}>
        <Chip selected={payer === null} onPress={() => setPayer(null)}>
          Not said
        </Chip>
        {(isPrivate || !shared ? data.members.filter((m) => m.id === userId) : data.members).map((m) => (
          <Chip key={m.id} icon="person" selected={payer === m.id} onPress={() => setPayer(m.id)}>
            {m.id === userId ? "Me" : m.name}
          </Chip>
        ))}
      </View>
      {shared && !isPrivate ? (
        <Text style={ui.muted}>Reminders go to whoever pays, or to everyone in your Home if nobody's picked.</Text>
      ) : null}

      <Text style={ui.label}>Which card</Text>
      <View style={[ui.row, { gap: 8 }]}>
        <TextInput
          style={[ui.input, { flex: 1 }]}
          value={cardName}
          onChangeText={setCardName}
          placeholder="Card name, e.g. Chase Visa"
          placeholderTextColor={colors.muted}
          maxLength={30}
        />
        <TextInput
          style={[ui.input, { width: 96, textAlign: "center" }]}
          value={last4}
          onChangeText={(t) => setLast4(t.replace(/\D/g, "").slice(0, 4))}
          placeholder="Last 4"
          placeholderTextColor={colors.muted}
          keyboardType="number-pad"
          maxLength={4}
        />
      </View>
      <Text style={ui.muted}>Only the last 4 digits, so you know which statement it's on. Never the full card number.</Text>

      <Text style={ui.label}>Where to manage or cancel it</Text>
      <TextInput
        style={ui.input}
        value={link}
        onChangeText={setLink}
        placeholder="Website, e.g. netflix.com/account"
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        maxLength={500}
      />
      <View style={ui.chips}>
        {storeLinks.map((s) => (
          <Chip key={s.url} icon="phone" selected={link === s.url} onPress={() => setLink(link === s.url ? "" : s.url)}>
            {s.label}
          </Chip>
        ))}
      </View>
      <Text style={ui.muted}>Paid through your phone's app store? Pick it and the button opens your store subscriptions.</Text>

      <TextInput
        style={[ui.input, { minHeight: 80, textAlignVertical: "top" }]}
        value={notes}
        onChangeText={setNotes}
        placeholder="Notes: which plan, whose login, the family plan's members…"
        placeholderTextColor={colors.muted}
        multiline
        maxLength={300}
      />

      <Button title="Save" icon="check" onPress={save} loading={saving} style={{ marginTop: 8 }} />
      {existing ? <Button title="Remove" icon="trash" variant="danger" onPress={confirmDelete} /> : null}
    </NookScroll>
  );
}
