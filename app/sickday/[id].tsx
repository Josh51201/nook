import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Alert, StyleSheet, View } from "react-native";

import { Avatar } from "../../components/avatar";
import { Collapsible } from "../../components/collapsible";
import { HeaderWithHelp } from "../../components/help-button";
import { Icon, IconBadge } from "../../components/icon";
import { Appear, LoadingScreen, Tap } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { TempChart } from "../../components/temp-chart";
import { Text } from "../../components/text";
import { Banner, Button, Chip, EmptyState, HeaderIcon, SectionHeader } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { friendlyError, tap } from "../../lib/feedback";
import { sickdaySettingDefaults, useNookSettings } from "../../lib/nook-settings";
import { findNook } from "../../lib/nooks";
import { daysToDue, localDay } from "../../lib/pets";
import {
  doseTimers,
  formatTemp,
  highest,
  isFever,
  isWeekday,
  lastHad,
  missedWord,
  missedWords,
  shortDay,
  spellDates,
  spellDay,
  spellDays,
  spellTitle,
  symptomTally,
  tempPoints,
  tempWhereChoices,
  timeline,
  timerWords,
  toggleDay,
  urgentSymptoms,
  whenWords,
  type TimelineItem,
} from "../../lib/sickday";
import { activeHelpers, firstName, isHomeSpell, personName, undoDose, useNow, useSickDay, useSpell } from "../../lib/sickday-data";
import { supabase } from "../../lib/supabase";
import { colors, ui } from "../../lib/theme";

const nook = findNook("sickday")!;

// One sick spell (SICK-003..012): the next-dose timers, the temperature
// chart, symptoms, missed days, every dose and reading in order, helpers,
// the doctor summary, and "Feeling better".
export default function SpellPage() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;
  const { data, reload: reloadAll } = useSickDay(userId);
  const spell = data?.spells.find((s) => s.id === id);
  const others = data?.spells.filter((s) => spell && s.patient_id === spell.patient_id && s.home_id === spell.home_id) ?? [];
  const { data: detail, reload } = useSpell(spell, others);
  const { settings } = useNookSettings("sickday", sickdaySettingDefaults);
  const now = useNow(20_000);

  if (!data || (spell && !detail)) return <LoadingScreen cards={3} />;
  if (!spell || !detail) return <EmptyState icon="sick" title="That isn't here" body="It may have been deleted, or your time helping has ended." />;

  const unit = settings.tempUnit;
  const home = isHomeSpell(data, spell);
  const name = firstName(data, spell.patient_id);
  const fullName = data.names.get(spell.patient_id)?.name ?? name;
  const timers = doseTimers(detail.doses, detail.personDoses, now);
  const points = tempPoints(detail.log);
  const top = highest(detail.log);
  const symptoms = symptomTally(detail.log);
  const items = timeline(detail.log, detail.doses);
  const helpers = activeHelpers(data, spell);
  const allergies = data.allergies.get(spell.patient_id) ?? [];
  const before = lastHad(data.spells.filter((s) => s.patient_id === spell.patient_id), spell.title, spell.id);
  const ended = !!spell.ended_on;
  const days = spellDays(spell, data.today);

  async function refresh() {
    await Promise.all([reloadAll(), reload()]);
  }

  async function setEnded(day: string | null) {
    const { error } = await supabase.from("sick_spells").update({ ended_on: day }).eq("id", spell!.id);
    if (error) {
      const again = /duplicate key|sick_spells_one_open/i.test(error.message);
      return Alert.alert("Couldn't change that", again ? `${name} is already sick again. Open that one instead.` : friendlyError(error));
    }
    tap("success");
    refresh();
  }

  function feelingBetter() {
    Alert.alert(`${name} is feeling better?`, "This moves to Past sick days. Timers stop, and any helpers lose access tomorrow.", [
      { text: "Not yet", style: "cancel" },
      { text: "Better today", onPress: () => setEnded(localDay()) },
      ...(spell!.started_on < data!.today ? [{ text: "Better since yesterday", onPress: () => setEnded(localDay(new Date(Date.now() - 864e5))) }] : []),
    ]);
  }

  async function toggleMissed(day: string) {
    tap();
    const { error } = await supabase.from("sick_spells").update({ missed_days: toggleDay(spell!.missed_days, day) }).eq("id", spell!.id);
    if (error) return Alert.alert("Couldn't save that", friendlyError(error));
    reloadAll();
  }

  function openItem(item: TimelineItem) {
    const mine = item.kind === "dose" ? item.dose.given_by === userId : item.entry.logged_by === userId;
    if (!mine && !home) return;
    const label = item.kind === "dose" ? `${item.dose.medicine_name} at ${whenWords(item.at, now)}` : `This, from ${whenWords(item.at, now)}`;
    Alert.alert(item.kind === "dose" ? "Remove this dose?" : "Remove this?", item.kind === "dose" ? `${label}. Only if it wasn't really given — the timer goes back to before it.` : label, [
      { text: "Keep it", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          const { error } =
            item.kind === "dose" ? await undoDose(item.dose.id) : await supabase.from("sick_log").delete().eq("id", item.entry.id);
          if (error) return Alert.alert("Couldn't remove it", friendlyError(error));
          refresh();
        },
      },
    ]);
  }

  function removeHelper(profileId: string) {
    const self = profileId === userId;
    Alert.alert(self ? "Stop helping?" : `Remove ${personName(data!, profileId)}?`, self ? `You won't see ${name} here any more.` : "They won't see this any more.", [
      { text: "Cancel", style: "cancel" },
      {
        text: self ? "Stop helping" : "Remove",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.from("sick_helpers").delete().eq("spell_id", spell!.id).eq("profile_id", profileId);
          if (error) return Alert.alert("Couldn't do that", friendlyError(error));
          if (self) return router.dismissTo("/sickday");
          refresh();
        },
      },
    ]);
  }

  const give = (medicine?: string | null) =>
    router.push({ pathname: "/sickday/dose", params: medicine ? { spell: spell.id, medicine } : { spell: spell.id } });

  return (
    <NookScroll onRefresh={refresh}>
      <Stack.Screen
        options={{
          title: name,
          headerRight: () => (
            <HeaderWithHelp>
              {home ? <HeaderIcon icon="edit" label="Change" onPress={() => router.push({ pathname: "/sickday/start", params: { id: spell.id } })} /> : null}
            </HeaderWithHelp>
          ),
        }}
      />

      <View style={[styles.hero, { backgroundColor: colors.dark ? `${nook.iconColor}26` : nook.color }]}>
        <IconBadge name="sick" size={48} color={nook.iconColor} background={colors.surface} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.heroTitle, { color: colors.text }]}>
            {spellTitle(spell) === "Sick" ? (ended ? `${name} was sick` : `${name} is sick`) : `${name} · ${spellTitle(spell)}`}
          </Text>
          <Text style={ui.muted}>
            {ended ? `${spellDates(spell, data.today)} · ${spellDay(spell, data.today)} days` : `Day ${spellDay(spell, data.today)} · ${spellDates(spell, data.today)}`}
          </Text>
          {allergies.length ? (
            <Text style={[ui.muted, { color: colors.error, fontWeight: "700" }]}>Allergic to {allergies.join(", ")}</Text>
          ) : null}
        </View>
      </View>

      {!home ? (
        <Banner icon="heart" tone="rose" body={`You're helping with ${name}. You can log temperatures, symptoms and doses; the family can see who did what.`} />
      ) : null}
      {before ? <Text style={ui.muted}>{before}.</Text> : null}
      {symptoms.some((s) => urgentSymptoms.has(s.name)) ? (
        <Banner icon="warning" tone="rose" title="Trouble breathing was logged" body="If it's happening now, call the doctor or emergency services." />
      ) : null}

      <View style={ui.chips}>
        <Chip icon="pill" onPress={() => give()}>
          Give medicine
        </Chip>
        <Chip icon="thermo" onPress={() => router.push({ pathname: "/sickday/log", params: { spell: spell.id, mode: "temp" } })}>
          Temperature
        </Chip>
        <Chip icon="edit" onPress={() => router.push({ pathname: "/sickday/log", params: { spell: spell.id, mode: "symptoms" } })}>
          Symptoms
        </Chip>
        <Chip icon="doc" onPress={() => router.push({ pathname: "/sickday/log", params: { spell: spell.id, mode: "note" } })}>
          Note
        </Chip>
      </View>

      {timers.length ? (
        <>
          <SectionHeader title="Medicine" icon="timer" />
          {timers.map((t, i) => {
            const ok = t.hasTimer && !t.wait;
            return (
              <Appear key={t.key} index={i}>
                <View style={[ui.card, ui.row, { gap: 12 }]}>
                  <IconBadge
                    name={ok ? "check" : "timer"}
                    size={40}
                    color={ok ? colors.white : nook.iconColor}
                    background={ok ? nook.iconColor : colors.dark ? `${nook.iconColor}33` : nook.color}
                  />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={ui.cardTitle} numberOfLines={1}>
                      {t.name}
                      {t.amount ? <Text style={{ fontWeight: "500" }}>{` · ${t.amount}`}</Text> : null}
                    </Text>
                    <Text style={[ui.muted, { fontSize: 13 }, t.wait && { color: colors.text, fontWeight: "600" }]}>{timerWords(t, now)}</Text>
                    <Text style={[ui.muted, { fontSize: 12 }]}>
                      Last: {whenWords(t.lastGiven, now)} by {personName(data, t.lastGivenBy, userId)}
                      {t.maxPerDay ? ` · ${t.givenToday} of ${t.maxPerDay} in 24 h` : ""}
                    </Text>
                  </View>
                  {!ended ? (
                    <Tap onPress={() => give(t.medicineId)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Give ${t.name}`}>
                      <Text style={{ color: colors.bark, fontWeight: "700" }}>Give</Text>
                    </Tap>
                  ) : null}
                </View>
              </Appear>
            );
          })}
        </>
      ) : null}

      {points.length ? (
        <>
          <SectionHeader
            title="Temperature"
            icon="thermo"
            right={top != null ? <Text style={[ui.muted, { fontSize: 13 }, isFever(top) && { color: colors.error }]}>Highest {formatTemp(top, unit)}</Text> : undefined}
          />
          {points.length > 1 ? (
            <View style={ui.card}>
              <TempChart points={points} unit={unit} accent={nook.iconColor} />
            </View>
          ) : (
            <Text style={ui.muted}>
              {formatTemp(points[0].c, unit)} at {whenWords(points[0].at, now)}. Log another to see a chart.
            </Text>
          )}
        </>
      ) : null}

      {symptoms.length ? (
        <>
          <SectionHeader title="Symptoms" icon="sick" />
          <View style={ui.chips}>
            {symptoms.map((s) => (
              <View key={s.name} style={[styles.symptom, { backgroundColor: urgentSymptoms.has(s.name) ? colors.error : colors.barkSoft }]}>
                <Text style={[styles.symptomText, { color: urgentSymptoms.has(s.name) ? colors.white : colors.text }]}>
                  {s.name}
                  {s.count > 1 ? ` ×${s.count}` : ""}
                </Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {spell.missed_from && home ? (
        <Collapsible
          id={`sick-missed-${spell.id}`}
          title={`Missed ${missedWord(spell.missed_from)}`}
          icon={spell.missed_from === "work" ? "work" : "school"}
          summary={missedWords(spell) ?? "Tick the days"}
          defaultOpen={!spell.missed_days.length && !ended}
        >
          <View style={ui.chips}>
            {days.map((day) => (
              <Chip key={day} selected={spell.missed_days.includes(day)} onPress={() => toggleMissed(day)}>
                {shortDay(day)}
                {!isWeekday(day) ? " (wknd)" : ""}
              </Chip>
            ))}
          </View>
          {spell.missed_days.length ? (
            <Button
              title={`Note for ${missedWord(spell.missed_from)}`}
              icon="mail"
              variant="secondary"
              onPress={() => router.push({ pathname: "/sickday/summary", params: { id: spell.id, mode: "absence" } })}
            />
          ) : null}
        </Collapsible>
      ) : null}

      <Button
        title="For the doctor"
        icon="doc"
        variant="secondary"
        onPress={() => router.push({ pathname: "/sickday/summary", params: { id: spell.id } })}
      />

      <SectionHeader title="Everything so far" icon="clock" />
      {!items.length ? <Text style={ui.muted}>Nothing logged yet. Start with a temperature, or what's wrong.</Text> : null}
      {items.slice(0, 80).map((item, i) => (
        <Appear key={item.kind + (item.kind === "dose" ? item.dose.id : item.entry.id)} index={Math.min(i, 8)}>
          <Tap onLongPress={() => openItem(item)} onPress={() => openItem(item)} style={[styles.item, { borderColor: colors.border }]}>
            <Icon
              name={item.kind === "dose" ? "pill" : item.entry.temp_c != null ? "thermo" : item.entry.symptoms.length ? "sick" : "doc"}
              size={16}
              color={nook.iconColor}
            />
            <View style={{ flex: 1, gap: 1 }}>
              <Text style={{ color: colors.text, fontWeight: "600" }}>{itemText(item, unit)}</Text>
              {item.kind === "log" && item.entry.note && (item.entry.temp_c != null || item.entry.symptoms.length) ? (
                <Text style={ui.muted}>{item.entry.note}</Text>
              ) : null}
              <Text style={[ui.muted, { fontSize: 12 }]}>
                {whenWords(item.at, now)} · {personName(data, item.kind === "dose" ? item.dose.given_by : item.entry.logged_by, userId)}
                {item.kind === "dose" && item.dose.early ? " · given early" : ""}
              </Text>
            </View>
          </Tap>
        </Appear>
      ))}
      {items.length > 80 ? <Text style={ui.muted}>And {items.length - 80} more — all of them are in the doctor summary.</Text> : null}

      {home || helpers.some((h) => h.profile_id === userId) ? (
        <>
          <SectionHeader title="Helpers" icon="heart" />
          {helpers.map((h) => (
            <View key={h.profile_id} style={[ui.card, ui.row, { gap: 12 }]}>
              <Avatar name={personName(data, h.profile_id)} size={36} />
              <View style={{ flex: 1 }}>
                <Text style={ui.cardTitle}>{personName(data, h.profile_id, userId)}</Text>
                <Text style={[ui.muted, { fontSize: 13 }]}>
                  {h.until ? `Until ${shortDay(h.until)}` : "Until they're better"}
                  {h.until && daysToDue(h.until, data.today) === 0 ? " (today)" : ""}
                </Text>
              </View>
              {home || h.profile_id === userId ? (
                <Tap onPress={() => removeHelper(h.profile_id)} hitSlop={8} accessibilityLabel="Remove">
                  <Icon name="close" size={18} color={colors.muted} />
                </Tap>
              ) : null}
            </View>
          ))}
          {home && !ended ? (
            <Button
              title="Add a helper"
              icon="invite"
              variant="secondary"
              onPress={() => router.push({ pathname: "/sickday/helpers", params: { spell: spell.id } })}
            />
          ) : null}
          {home && !helpers.length ? (
            <Text style={ui.muted}>Grandma watching {name} today? A helper from your Burrows can log temperatures and doses too.</Text>
          ) : null}
        </>
      ) : null}

      {home ? (
        ended ? (
          <Button title={`${name} is sick again`} icon="undo" variant="secondary" onPress={() => setEnded(null)} />
        ) : (
          <Button title="Feeling better" icon="heart" onPress={feelingBetter} />
        )
      ) : null}
      <Text style={[ui.muted, { fontSize: 12 }]}>
        Nook only counts the hours and doses you've set; it doesn't give medical advice. When in doubt, call {fullName.split(" ")[0]}'s doctor.
      </Text>
    </NookScroll>
  );
}

function itemText(item: TimelineItem, unit: "f" | "c") {
  if (item.kind === "dose") return `${item.dose.medicine_name}${item.dose.amount ? ` · ${item.dose.amount}` : ""}`;
  const e = item.entry;
  const parts: string[] = [];
  if (e.temp_c != null) {
    const where = e.temp_where ? tempWhereChoices.find((w) => w.key === e.temp_where)?.label.toLowerCase() : null;
    parts.push(`${formatTemp(e.temp_c, unit)}${where ? ` (${where})` : ""}`);
  }
  if (e.symptoms.length) parts.push(e.symptoms.join(", "));
  if (!parts.length && e.note) parts.push(e.note);
  return parts.join(" · ");
}

const styles = StyleSheet.create({
  hero: { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 22, padding: 16 },
  heroTitle: { fontSize: 22, fontWeight: "800" },
  symptom: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  symptomText: { fontWeight: "600" },
  item: { flexDirection: "row", gap: 10, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, alignItems: "flex-start" },
});
