import { Stack, useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { HeaderWithHelp } from "../../components/help-button";
import { Icon, IconBadge } from "../../components/icon";
import { Appear, LoadingScreen, Tap } from "../../components/motion";
import { NookHero } from "../../components/nook-hero";
import { NookScroll } from "../../components/nook-scroll";
import { Text } from "../../components/text";
import { Button, Chip, EmptyState, HeaderIcon, NavCard, SectionHeader } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { sickdaySettingDefaults, useNookSettings } from "../../lib/nook-settings";
import { findNook } from "../../lib/nooks";
import {
  clockTime,
  doseTimers,
  formatTemp,
  isFever,
  latestTemp,
  spellDates,
  spellDay,
  spellTitle,
  timerWords,
  type Spell,
} from "../../lib/sickday";
import { firstName, isHomeSpell, useNow, useSickDay, type SickDayData } from "../../lib/sickday-data";
import { colors, ui } from "../../lib/theme";

const nook = findNook("sickday")!;

// Sick Day home (SICK-001, SICK-004, SICK-011): who's sick now, their latest
// temperature and when each medicine is OK again, with quick ways to log;
// then the medicine cabinet and past sick days.
export default function SickDayHome() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id;
  const { data, error, isLoading, reload } = useSickDay(userId);
  const { settings } = useNookSettings("sickday", sickdaySettingDefaults);
  const now = useNow();

  if (isLoading && !data) return <LoadingScreen cards={3} />;
  if (!data) {
    return (
      <NookScroll onRefresh={reload}>
        <EmptyState icon="sick" title="Couldn't open Sick Day" body={error ?? "Check your connection and try again."} />
      </NookScroll>
    );
  }

  const open = data.spells.filter((s) => !s.ended_on).sort((a, b) => a.started_on.localeCompare(b.started_on));
  const mine = open.filter((s) => isHomeSpell(data, s));
  const helping = open.filter((s) => !isHomeSpell(data, s));
  const past = data.spells.filter((s) => s.ended_on && isHomeSpell(data, s));
  const homeMedicines = data.medicines.filter((m) => m.home_id === data.homeId);

  const timersFor = (spell: Spell) => {
    const samePerson = new Set(data.spells.filter((s) => s.patient_id === spell.patient_id && s.home_id === spell.home_id).map((s) => s.id));
    const personDoses = data.recentDoses.filter((d) => samePerson.has(d.spell_id));
    return doseTimers(
      personDoses.filter((d) => d.spell_id === spell.id),
      personDoses,
      now
    );
  };

  const soonest = open
    .flatMap((s) => timersFor(s).map((t) => ({ s, t })))
    .filter(({ t }) => t.wait)
    .sort((a, b) => a.t.wait!.safeAt - b.t.wait!.safeAt)[0];

  const headline = !open.length
    ? "Everyone's well"
    : open.length === 1
      ? spellTitle(open[0]) === "Sick"
        ? `${firstName(data, open[0].patient_id)} is sick`
        : `${firstName(data, open[0].patient_id)}: ${spellTitle(open[0]).toLowerCase()}`
      : `${open.length} people are sick`;

  return (
    <NookScroll onRefresh={reload}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <HeaderWithHelp>
              <HeaderIcon icon="settings" label="Sick Day Nook settings" onPress={() => router.push("/sickday/settings")} />
            </HeaderWithHelp>
          ),
        }}
      />

      <NookHero
        icon="sick"
        accent={nook.iconColor}
        tint={nook.color}
        headline={headline}
        facts={
          open.length
            ? [
                ...(soonest
                  ? [{ icon: "timer" as const, text: `${soonest.t.name} for ${firstName(data, soonest.s.patient_id)} OK at ${clockTime(soonest.t.wait!.safeAt)}` }]
                  : []),
                ...(open.length === 1 ? [{ icon: "calendar" as const, text: `Day ${spellDay(open[0], data.today)}` }] : []),
                ...(helping.length ? [{ icon: "heart" as const, text: `Helping with ${helping.map((s) => firstName(data, s.patient_id)).join(", ")}` }] : []),
              ]
            : [
                { icon: "timer", text: "A timer for the next dose, so nobody doubles up" },
                { icon: "pill", text: homeMedicines.length ? `${homeMedicines.length} in the medicine cabinet` : "Keep the doses you were told" },
              ]
        }
      />

      {mine.length ? <SectionHeader title="Sick now" icon="sick" /> : null}
      {mine.map((s, i) => (
        <SpellCard key={s.id} data={data} spell={s} index={i} unit={settings.tempUnit} timers={timersFor(s)} now={now} />
      ))}

      {helping.length ? <SectionHeader title="You're helping with" icon="heart" /> : null}
      {helping.map((s, i) => (
        <SpellCard key={s.id} data={data} spell={s} index={i} unit={settings.tempUnit} timers={timersFor(s)} now={now} />
      ))}

      <Button
        title={open.length ? "Someone else is sick" : "Someone's sick"}
        icon="add"
        variant={open.length ? "secondary" : "primary"}
        onPress={() => router.push("/sickday/start")}
      />

      <SectionHeader title="Kept for next time" icon="pill" />
      <NavCard
        icon="pill"
        iconColor={nook.iconColor}
        iconBackground={nook.color}
        title="Medicine cabinet"
        subtitle={homeMedicines.length ? `${homeMedicines.length} medicine${homeMedicines.length === 1 ? "" : "s"}, with their doses` : "Save each medicine once, with the dose you were told"}
        onPress={() => router.push("/sickday/cabinet")}
      />
      <NavCard
        icon="calendar"
        iconColor={nook.iconColor}
        iconBackground={nook.color}
        title="Past sick days"
        subtitle={past.length ? `${past.length} kept, by person` : "Who had what, and when, once they're better"}
        onPress={() => router.push("/sickday/history")}
      />
    </NookScroll>
  );
}

// One person who's sick: what it is, the latest temperature, and each
// medicine's timer, with one-tap logging (it's often 3 AM).
function SpellCard({
  data,
  spell,
  index,
  unit,
  timers,
  now,
}: {
  data: SickDayData;
  spell: Spell;
  index: number;
  unit: "f" | "c";
  timers: ReturnType<typeof doseTimers>;
  now: number;
}) {
  const router = useRouter();
  const temp = latestTemp(data.openLog.filter((e) => e.spell_id === spell.id));
  const fever = isFever(temp?.temp_c);
  const name = firstName(data, spell.patient_id);
  return (
    <Appear index={index}>
      <View style={[ui.card, { gap: 10 }]}>
        <Tap
          onPress={() => router.push(`/sickday/${spell.id}`)}
          style={[ui.row, { gap: 12 }]}
          accessibilityRole="button"
          accessibilityLabel={`${name}, ${spellTitle(spell)}, day ${spellDay(spell, data.today)}`}
        >
          <IconBadge name="sick" size={42} color={nook.iconColor} background={colors.dark ? `${nook.iconColor}33` : nook.color} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={ui.cardTitle} numberOfLines={1}>
              {name}
              {spellTitle(spell) !== "Sick" ? <Text style={{ fontWeight: "500" }}>{` · ${spellTitle(spell)}`}</Text> : null}
            </Text>
            <Text style={[ui.muted, { fontSize: 13 }]}>
              Day {spellDay(spell, data.today)} · {spellDates(spell, data.today)}
            </Text>
          </View>
          {temp ? (
            <View style={[styles.temp, { backgroundColor: fever ? colors.error : colors.dark ? `${nook.iconColor}33` : nook.color }]}>
              <Text style={{ fontWeight: "800", color: fever ? "#ffffff" : nook.iconColor }}>{formatTemp(temp.temp_c!, unit)}</Text>
            </View>
          ) : null}
          <Icon name="chevron" size={16} color={colors.muted} />
        </Tap>

        {timers.length ? (
          <View style={{ gap: 6 }}>
            {timers.slice(0, 4).map((t) => (
              <View key={t.key} style={[ui.row, { gap: 8 }]}>
                <Icon name={t.hasTimer && !t.wait ? "check" : "timer"} size={15} color={nook.iconColor} />
                <Text style={[ui.muted, { flex: 1, color: colors.text }]} numberOfLines={1}>
                  {t.name}
                </Text>
                <Text style={[ui.muted, { fontSize: 13, fontWeight: "600" }, t.wait && { color: colors.text }]}>{timerWords(t, now)}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={ui.chips}>
          <Chip icon="pill" onPress={() => router.push({ pathname: "/sickday/dose", params: { spell: spell.id } })}>
            Give medicine
          </Chip>
          <Chip icon="thermo" onPress={() => router.push({ pathname: "/sickday/log", params: { spell: spell.id, mode: "temp" } })}>
            Temperature
          </Chip>
          <Chip icon="edit" onPress={() => router.push({ pathname: "/sickday/log", params: { spell: spell.id, mode: "symptoms" } })}>
            Symptoms
          </Chip>
        </View>
      </View>
    </Appear>
  );
}

const styles = StyleSheet.create({
  temp: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
});
