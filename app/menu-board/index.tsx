import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

import { HeaderWithHelp } from "../../components/help-button";
import { Icon } from "../../components/icon";
import { Appear, LoadingScreen, Tap } from "../../components/motion";
import { NookHero } from "../../components/nook-hero";
import { NookScroll } from "../../components/nook-scroll";
import { Text } from "../../components/text";
import { Button, EmptyState, HeaderIcon } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { friendlyError, tap } from "../../lib/feedback";
import {
  addDays,
  dayWords,
  mealHeadline,
  mealTimes,
  nextMeal,
  plannedCount,
  recipesOnMenu,
  shortDate,
  slot,
  slotKind,
  slotWords,
  weekDays,
  weekStart,
  weekWords,
  type MealKey,
} from "../../lib/menu-board";
import { copyLastWeek, useMenu, wipeWeek } from "../../lib/menu-board-data";
import { menuBoardSettingDefaults, useNookSettings } from "../../lib/nook-settings";
import { findNook } from "../../lib/nooks";
import { localDay } from "../../lib/pets";
import { colors, themed, ui } from "../../lib/theme";

// The Menu Board (MENU-001..006): the Home's week, a card a day with
// breakfast, lunch and dinner, like the wipe-off menu mat on the fridge.
// Tap a meal to plan it.
export default function MenuBoardHome() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id;
  const { settings } = useNookSettings("menu-board", menuBoardSettingDefaults);
  const startsOn = settings.weekStart === 1 ? 1 : 0;
  const today = localDay();
  const [offset, setOffset] = useState(0);
  const start = addDays(weekStart(today, startsOn), offset * 7);
  const { data, error, isLoading, reload } = useMenu(userId, start);
  const [busy, setBusy] = useState(false);
  const nook = findNook("menu-board")!;

  const shown = mealTimes.filter((m) => settings.meals.includes(m.key));
  const meals = shown.length ? shown : mealTimes;

  if (isLoading && !data) return <LoadingScreen cards={4} />;
  if (!data) {
    return (
      <NookScroll onRefresh={reload}>
        <EmptyState icon="calendar" title="Couldn't open the menu" body={error ?? "Check your connection and try again."} />
      </NookScroll>
    );
  }

  const days = weekDays(start);
  const week = data.meals.filter((m) => m.day >= start && m.day <= days[6]);
  const planned = plannedCount(week, days, meals.map((m) => m.key));
  const upNext = nextMeal(meals.map((m) => m.key), new Date().getHours());
  const todayWords = upNext ? slotWords(slot(week, today, upNext)) : "";
  const hasShopping = recipesOnMenu(week).length > 0 || week.some((m) => m.kind === "dish");

  function open(day: string, meal: MealKey) {
    tap();
    router.push({ pathname: "/menu-board/meal", params: { day, meal } });
  }

  async function copy() {
    setBusy(true);
    const { copied, error: copyError } = await copyLastWeek(data!.homeId, start, week);
    setBusy(false);
    if (copyError) return Alert.alert("Couldn't copy last week", friendlyError({ message: copyError }));
    tap("success");
    if (!copied) Alert.alert("Nothing to copy", "Last week had nothing planned for the meals still empty this week.");
    reload();
  }

  function wipe() {
    Alert.alert("Wipe the week?", "Everything planned for this week comes off the board, for everyone in your Home.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Wipe it",
        style: "destructive",
        onPress: async () => {
          const { error: wipeError } = await wipeWeek(data!.homeId, start);
          if (wipeError) Alert.alert("Couldn't wipe it", friendlyError({ message: wipeError }));
          reload();
        },
      },
    ]);
  }

  return (
    <NookScroll onRefresh={reload}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <HeaderWithHelp>
              <HeaderIcon icon="settings" label="Menu Board settings" onPress={() => router.push("/menu-board/settings")} />
            </HeaderWithHelp>
          ),
        }}
      />

      <NookHero
        icon="menuBoard"
        accent={nook.iconColor}
        tint={nook.color}
        headline={offset === 0 && upNext ? mealHeadline(upNext, todayWords) : weekWords(start, today, startsOn)}
        facts={[
          { icon: "calendar", text: `${planned} of ${days.length * meals.length} meals planned ${offset === 0 ? "this week" : "that week"}` },
          { icon: "group", text: "Shared with everyone in your Home" },
        ]}
      />

      {/* Flip between weeks */}
      <View style={[ui.row, { justifyContent: "space-between" }]}>
        <WeekArrow icon="arrowLeft" label="The week before" onPress={() => setOffset(offset - 1)} />
        <Tap onPress={() => setOffset(0)} disabled={offset === 0} accessibilityRole="button" accessibilityLabel="Back to this week" style={{ alignItems: "center", flex: 1 }}>
          <Text style={[ui.cardTitle, { fontSize: 17 }]}>{weekWords(start, today, startsOn)}</Text>
          <Text style={ui.muted}>
            {shortDate(start)} – {shortDate(days[6])}
            {offset !== 0 ? "  ·  Back to this week" : ""}
          </Text>
        </Tap>
        <WeekArrow icon="arrowRight" label="The week after" onPress={() => setOffset(offset + 1)} />
      </View>

      {days.map((day, i) => {
        const isToday = day === today;
        const past = day < today;
        return (
          <Appear key={day} index={i}>
            <View style={[ui.card, styles.day, isToday && { borderColor: nook.iconColor, borderWidth: 2 }, past && { opacity: 0.7 }]}>
              <View style={[ui.row, { justifyContent: "space-between" }]}>
                <Text style={[ui.cardTitle, { fontSize: 17 }]}>
                  {dayWords(day, today) === "Today" || dayWords(day, today) === "Tomorrow"
                    ? `${dayWords(day, today)} · ${new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: "long" })}`
                    : dayWords(day, today)}
                </Text>
                <Text style={ui.muted}>{shortDate(day)}</Text>
              </View>
              {meals.map((m) => {
                const rows = slot(week, day, m.key);
                const words = slotWords(rows);
                const kind = slotKind(rows);
                return (
                  <Tap
                    key={m.key}
                    onPress={() => open(day, m.key)}
                    style={styles.meal}
                    accessibilityRole="button"
                    accessibilityLabel={`${m.label}, ${dayWords(day, today)}: ${words || "nothing planned"}`}
                  >
                    <View style={[styles.mealIcon, { backgroundColor: colors.barkSoft }]}>
                      <Icon name={kind === "out" ? "place" : kind === "own" ? "person" : m.icon} size={14} color={colors.bark} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.mealLabel}>{m.label}</Text>
                      <Text style={[styles.mealText, !words && { color: colors.muted, fontStyle: "italic" }]} numberOfLines={2}>
                        {words || "Tap to plan"}
                      </Text>
                    </View>
                    {rows.some((r) => r.recipe_id) ? <Icon name="recipe" size={13} color={colors.muted} /> : null}
                  </Tap>
                );
              })}
            </View>
          </Appear>
        );
      })}

      {hasShopping ? (
        <Button title="Shop for this week" icon="cart" onPress={() => router.push({ pathname: "/groceries/add", params: { week: start } })} />
      ) : null}
      <View style={[ui.row, { gap: 10 }]}>
        <Button title="Copy last week" icon="copy" variant="secondary" onPress={copy} loading={busy} style={{ flex: 1 }} />
      </View>
      {week.length ? <Button title="Wipe the week" icon="trash" variant="danger" onPress={wipe} /> : null}
    </NookScroll>
  );
}

function WeekArrow({ icon, label, onPress }: { icon: "arrowLeft" | "arrowRight"; label: string; onPress: () => void }) {
  return (
    <Tap
      onPress={() => {
        tap();
        onPress();
      }}
      hitSlop={10}
      style={[styles.arrow, { backgroundColor: colors.barkSoft }]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Icon name={icon} size={16} color={colors.bark} />
    </Tap>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    day: { gap: 4, paddingVertical: 12 },
    meal: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
    mealIcon: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
    mealLabel: { fontSize: 12, fontWeight: "700", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.6 },
    mealText: { fontSize: 16, color: colors.text, lineHeight: 21 },
    arrow: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  })
);
