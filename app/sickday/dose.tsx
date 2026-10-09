import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, View } from "react-native";

import { DateField } from "../../components/date-field";
import { Icon } from "../../components/icon";
import { useLeaveGuard } from "../../components/leave-guard";
import { Appear, LoadingScreen, Tap } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { Text, TextInput } from "../../components/text";
import { Button, Chip, EmptyState } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { friendlyError, tap } from "../../lib/feedback";
import { sickdaySettingDefaults, useNookSettings } from "../../lib/nook-settings";
import { clockTime, doseWait, medicineRule, medicinesFor, ruleOf, untilWords, type Medicine } from "../../lib/sickday";
import { alertTime, firstName, giveDose, scheduleDoseAlert, useNow, useSickDay, useSpell } from "../../lib/sickday-data";
import { colors, ui } from "../../lib/theme";

// Give a dose (SICK-004, SICK-005): pick from the cabinet (each shows whether
// it's OK now) or type something else. The database checks again and refuses
// a dose that's too soon, so two people tapping at once can't both give it;
// "Give it anyway" is there for when the doctor said so, and is marked.
export default function GiveDose() {
  const router = useRouter();
  const { spell: spellId, medicine: medicineParam } = useLocalSearchParams<{ spell: string; medicine?: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;
  const { data } = useSickDay(userId);
  const spell = data?.spells.find((s) => s.id === spellId);
  const others = data?.spells.filter((s) => spell && s.patient_id === spell.patient_id && s.home_id === spell.home_id) ?? [];
  const { data: detail } = useSpell(spell, others);
  const { settings } = useNookSettings("sickday", sickdaySettingDefaults);
  const now = useNow(15_000);

  const [picked, setPicked] = useState<string | null>(medicineParam ?? null);
  const [other, setOther] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [at, setAt] = useState(new Date());
  const [changeTime, setChangeTime] = useState(false);
  const [saving, setSaving] = useState(false);
  const { allowLeave } = useLeaveGuard({ picked, name, amount, changeTime });

  const choices = spell && data ? medicinesFor(data.medicines.filter((m) => m.home_id === spell.home_id), spell.patient_id) : [];
  const medicine = choices.find((m) => m.id === picked) ?? null;

  useEffect(() => {
    if (medicine) setAmount(medicine.amount ?? "");
  }, [medicine?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data || (spell && !detail)) return <LoadingScreen cards={3} />;
  if (!spell || !detail) return <EmptyState icon="sick" title="That isn't here" />;

  const who = firstName(data, spell.patient_id);
  const home = spell.home_id === data.homeId;

  function choose(m: Medicine) {
    tap();
    setOther(false);
    setPicked(m.id);
  }

  async function give(anyway = false) {
    if (!medicine && !(other && name.trim())) return Alert.alert("Which medicine?", "Pick one from the cabinet, or type it under Something else.");
    setSaving(true);
    const givenAt = changeTime ? at : new Date();
    const result = await giveDose({
      spellId: spell!.id,
      medicineId: medicine?.id ?? null,
      name: medicine ? null : name.trim(),
      amount: amount.trim() || null,
      givenAt: changeTime ? at : null,
      anyway,
    });
    if (!result.ok && "tooSoon" in result) {
      setSaving(false);
      const { safeAt, reason } = result.tooSoon;
      const label = medicine?.name ?? name.trim();
      const why =
        reason === "day"
          ? `${who} has had as many as the most a day you set. The next is OK at ${clockTime(safeAt)}.`
          : safeAt > givenAt.getTime()
            ? `${label} (or something with the same thing in it) was given too recently. The next is OK at ${clockTime(safeAt)}, in ${untilWords(safeAt - Date.now())}.`
            : `That's too close to another dose of ${label}.`;
      return Alert.alert("Not yet", why, [
        { text: "Don't give it", style: "cancel" },
        { text: "Give it anyway", style: "destructive", onPress: () => confirmAnyway() },
      ]);
    }
    if (!result.ok) {
      setSaving(false);
      return Alert.alert("Couldn't save", friendlyError("error" in result ? result.error : null));
    }
    if (medicine && settings.notifyDoseReady) {
      const ready = alertTime(medicine, givenAt.getTime());
      if (ready) await scheduleDoseAlert(result.id, `${who} can have ${medicine.name} again`, ready);
    }
    tap("success");
    allowLeave();
    router.back();
  }

  function confirmAnyway() {
    Alert.alert("Only if a doctor or the label says so", "It'll be marked as given early, and everyone looking after them will see it.", [
      { text: "Cancel", style: "cancel" },
      { text: "Give it anyway", style: "destructive", onPress: () => give(true) },
    ]);
  }

  return (
    <NookScroll>
      <Stack.Screen
        options={{
          title: `Medicine for ${who}`,
          headerRight: () => (
            <Tap onPress={() => give()} disabled={saving} hitSlop={10}>
              <Text style={{ color: colors.bark, fontSize: 17, fontWeight: "700" }}>Give</Text>
            </Tap>
          ),
        }}
      />

      {choices.length ? (
        choices.map((m, i) => {
          const wait = doseWait(detail.personDoses, ruleOf(m), now);
          const on = picked === m.id && !other;
          return (
            <Appear key={m.id} index={i}>
              <Tap
                onPress={() => choose(m)}
                style={[ui.card, ui.row, { gap: 12 }, on && { borderColor: colors.bark, borderWidth: 2 }]}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
              >
                <Icon name={wait ? "timer" : "pill"} size={22} color={wait ? colors.muted : colors.bark} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={ui.cardTitle}>
                    {m.name}
                    {m.for_profile ? <Text style={{ fontWeight: "500" }}>{` · ${who}'s`}</Text> : null}
                  </Text>
                  {medicineRule(m) ? <Text style={[ui.muted, { fontSize: 13 }]}>{medicineRule(m)}</Text> : null}
                  <Text style={[ui.muted, { fontSize: 13, fontWeight: "600" }, wait ? { color: colors.error } : { color: colors.text }]}>
                    {wait ? `Not until ${clockTime(wait.safeAt)} (${untilWords(wait.safeAt - now)})` : m.every_hours || m.max_per_day ? "OK now" : "No timer set"}
                  </Text>
                </View>
                {on ? <Icon name="check" size={20} color={colors.bark} /> : null}
              </Tap>
            </Appear>
          );
        })
      ) : (
        <Text style={ui.muted}>
          The medicine cabinet is empty. Save a medicine there once, with the dose and hours between doses from the label or the doctor, and
          it'll keep the timer for you.
        </Text>
      )}
      {home ? (
        <Button title="Add to the medicine cabinet" icon="add" variant="secondary" onPress={() => router.push("/sickday/medicine")} />
      ) : null}

      <Chip icon="edit" selected={other} onPress={() => (setOther(!other), setPicked(null))}>
        Something else
      </Chip>
      {other ? (
        <TextInput
          style={ui.input}
          value={name}
          onChangeText={setName}
          placeholder="Which medicine?"
          placeholderTextColor={colors.muted}
          maxLength={60}
          autoFocus
        />
      ) : null}
      {other ? <Text style={ui.muted}>Without hours between doses there's no timer. Matching names are still counted together.</Text> : null}

      <Text style={ui.label}>How much</Text>
      <TextInput
        style={ui.input}
        value={amount}
        onChangeText={setAmount}
        placeholder="e.g. 5 mL, 1 tablet"
        placeholderTextColor={colors.muted}
        maxLength={40}
      />

      <Text style={ui.label}>When</Text>
      {changeTime ? (
        <DateField mode="datetime" value={at} onChange={setAt} maximumDate={new Date()} />
      ) : (
        <View style={ui.chips}>
          <Chip selected onPress={() => {}}>
            Just now
          </Chip>
          <Chip icon="clock" onPress={() => setChangeTime(true)}>
            Earlier
          </Chip>
        </View>
      )}

      <Button title="Give" icon="check" onPress={() => give()} loading={saving} />
      <Text style={[ui.muted, { fontSize: 12 }]}>
        Nook never works out a dose. It only counts the hours and the most a day that you saved from the label or the doctor.
      </Text>
    </NookScroll>
  );
}
