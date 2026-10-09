import { useKeepAwake } from "expo-keep-awake";
import * as Notifications from "expo-notifications";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "../../components/text";

import { Icon } from "../../components/icon";
import { LoadingScreen, Tap } from "../../components/motion";
import { TikTokPlayer } from "../../components/tiktok-player";
import { Button, EmptyState } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { friendlyError, tap } from "../../lib/feedback";
import { findTimers, formatClock, scaleIngredient } from "../../lib/recipes";
import { loadRecipe, markMade, type FamilyRecipe } from "../../lib/recipes-data";
import { canRemind, configureReminders } from "../../lib/reminders";
import { colors, ui } from "../../lib/theme";
import { useTikTokVideo } from "../../lib/tiktok";

type Timer = { id: string; label: string; step: number; endsAt: number; notificationId?: string; rang: boolean };

// Cook mode (REC-004): big text, the screen stays on, tick things off as
// you go, and tap a time in a step to start a timer. The phone alerts you
// when a timer ends, even if you've left Nook.
//   ?id=…&factor=…  the recipe, scaled as it was on its page
export default function CookMode() {
  useKeepAwake();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const params = useLocalSearchParams<{ id: string; factor?: string }>();
  const factor = Number(params.factor) > 0 ? Number(params.factor) : 1;

  const [recipe, setRecipe] = useState<FamilyRecipe | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [haveIt, setHaveIt] = useState<Set<number>>(new Set());
  const [done, setDone] = useState<Set<number>>(new Set());
  const [timers, setTimers] = useState<Timer[]>([]);
  const [now, setNow] = useState(Date.now());
  const [finishing, setFinishing] = useState(false);
  const [showVideo, setShowVideo] = useState(true);
  const timersRef = useRef(timers);
  timersRef.current = timers;

  useEffect(() => {
    loadRecipe(params.id)
      .then(setRecipe)
      .catch((error: Error) => Alert.alert("Couldn't open the recipe", error.message))
      .finally(() => setIsLoading(false));
  }, [params.id]);

  // Tick once a second while any timer runs.
  const running = timers.some((t) => !t.rang);
  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [running]);

  // A timer reaching zero while you're here: a buzz, and a word if the phone
  // isn't allowed to show the alert itself.
  useEffect(() => {
    const ended = timers.filter((t) => !t.rang && t.endsAt <= now);
    if (!ended.length) return;
    tap("success");
    setTimers((current) => current.map((t) => (ended.some((e) => e.id === t.id) ? { ...t, rang: true } : t)));
    const silent = ended.filter((t) => !t.notificationId);
    if (silent.length) Alert.alert("Time's up", silent.map((t) => `Step ${t.step + 1}: ${t.label}`).join("\n"));
  }, [now, timers]);

  const video = useTikTokVideo(recipe?.source_url);

  if (isLoading || !recipe) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <TopBar title="Cook mode" top={insets.top} onBack={() => router.back()} />
        {isLoading ? <LoadingScreen cards={3} /> : <EmptyState icon="recipe" title="This recipe isn't here" />}
      </View>
    );
  }

  const current = recipe.steps.findIndex((_, i) => !done.has(i));
  // A TikTok recipe keeps its video at the top to follow along (REC-014).
  const videoId = video?.videoId ?? null;

  function toggle(set: Set<number>, update: (s: Set<number>) => void, i: number) {
    tap();
    const next = new Set(set);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    update(next);
  }

  async function startTimer(step: number, label: string, seconds: number) {
    tap();
    const endsAt = Date.now() + seconds * 1000;
    const id = `${step}-${label}-${endsAt}`;
    setTimers((list) => [...list, { id, label, step, endsAt, rang: false }]);
    setNow(Date.now());
    configureReminders();
    if (!(await canRemind())) return;
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: { title: `${recipe!.title}: time's up`, body: `Step ${step + 1}: ${label}` },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(endsAt),
        channelId: Platform.OS === "android" ? "reminders" : undefined,
      },
    }).catch(() => undefined);
    setTimers((list) => list.map((t) => (t.id === id ? { ...t, notificationId } : t)));
  }

  function stopTimer(timer: Timer) {
    tap();
    if (timer.notificationId && !timer.rang) Notifications.cancelScheduledNotificationAsync(timer.notificationId).catch(() => {});
    setTimers((list) => list.filter((t) => t.id !== timer.id));
  }

  function leave() {
    const left = timersRef.current.filter((t) => !t.rang);
    if (!left.length) return router.back();
    Alert.alert("Timers still running", "Your phone will still alert you when they end.", [
      { text: "Stay", style: "cancel" },
      { text: "Leave", onPress: () => router.back() },
    ]);
  }

  async function finish() {
    setFinishing(true);
    // Only your own copy keeps count; family's recipe stays theirs.
    const { error } = recipe!.owner_id === session?.user.id ? await markMade(recipe!) : { error: null };
    setFinishing(false);
    if (error) return Alert.alert("Couldn't mark it made", friendlyError(error));
    tap("success");
    router.back();
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar title={recipe.title} top={insets.top} onBack={leave} />

      <ScrollView contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 140 + insets.bottom }}>
        {videoId ? (
          <>
            <Button
              title={showVideo ? "Hide the video" : "Show the video"}
              icon={showVideo ? "close" : "play"}
              variant="secondary"
              onPress={() => {
                tap();
                setShowVideo(!showVideo);
              }}
            />
            {showVideo ? <TikTokPlayer videoId={videoId} url={video!.url} maxHeight={460} /> : null}
          </>
        ) : null}
        {recipe.ingredients.length ? (
          <>
            <Text style={[ui.sectionTitle, { fontSize: 22 }]}>You'll need</Text>
            {recipe.ingredients.map((line, i) => {
              const got = haveIt.has(i);
              return (
                <Tap key={i} onPress={() => toggle(haveIt, setHaveIt, i)} style={[ui.row, { gap: 14, alignItems: "flex-start" }]} accessibilityRole="checkbox" accessibilityState={{ checked: got }}>
                  <Tick checked={got} size={24} />
                  <Text style={{ flex: 1, fontSize: 22, lineHeight: 30, color: got ? colors.muted : colors.text, textDecorationLine: got ? "line-through" : "none" }}>
                    {scaleIngredient(line, factor)}
                  </Text>
                </Tap>
              );
            })}
          </>
        ) : null}

        {recipe.steps.length ? <Text style={[ui.sectionTitle, { fontSize: 22 }]}>Steps</Text> : null}
        {recipe.steps.map((step, i) => {
          const finished = done.has(i);
          const isCurrent = i === current;
          return (
            <Tap
              key={i}
              onPress={() => toggle(done, setDone, i)}
              style={[ui.card, { gap: 12, padding: 18, opacity: finished ? 0.55 : 1, borderWidth: isCurrent ? 2 : undefined, borderColor: isCurrent ? colors.bark : undefined }]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: finished }}
            >
              <View style={[ui.row, { gap: 10 }]}>
                <Tick checked={finished} size={20} strong={isCurrent} />
                <Text style={{ fontSize: 15, fontWeight: "700", color: colors.bark }}>Step {i + 1}{isCurrent ? " · now" : ""}</Text>
              </View>
              <Text style={{ fontSize: 24, lineHeight: 34, color: colors.text, textDecorationLine: finished ? "line-through" : "none" }}>{step}</Text>
              {!finished
                ? findTimers(step).map((t, n) => (
                    <Button key={`${n}-${t.label}`} title={`Start ${t.label} timer`} icon="timer" variant="secondary" onPress={() => startTimer(i, t.label, t.seconds)} />
                  ))
                : null}
            </Tap>
          );
        })}

        <Button title={recipe.steps.length && done.size < recipe.steps.length ? "Done cooking" : "All done!"} icon="check" onPress={finish} loading={finishing} />
      </ScrollView>

      {timers.length ? (
        <View
          style={{
            position: "absolute",
            left: 12,
            right: 12,
            bottom: insets.bottom + 12,
            gap: 8,
          }}
        >
          {timers.map((t) => {
            const left = Math.max(0, (t.endsAt - now) / 1000);
            return (
              <View key={t.id} style={[ui.card, ui.row, { gap: 12, paddingVertical: 12, backgroundColor: t.rang ? colors.sun : colors.surface }]}>
                <Icon name="timer" size={22} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 26, fontWeight: "800", color: colors.text, fontVariant: ["tabular-nums"] }}>
                    {t.rang ? "Time's up" : formatClock(left)}
                  </Text>
                  <Text style={ui.muted} numberOfLines={1}>
                    Step {t.step + 1} · {t.label}
                  </Text>
                </View>
                <Tap onPress={() => stopTimer(t)} accessibilityLabel={t.rang ? "Dismiss timer" : "Stop timer"} accessibilityRole="button" hitSlop={8} style={{ padding: 6 }}>
                  <Icon name="close" size={20} />
                </Tap>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

// Back on the left (as on every other screen), the recipe's name beside it.
function TopBar({ title, top, onBack }: { title: string; top: number; onBack: () => void }) {
  return (
    <View style={[ui.row, { paddingTop: top + 8, paddingHorizontal: 12, paddingBottom: 8, gap: 4 }]}>
      <Tap onPress={onBack} accessibilityLabel="Back to the recipe" accessibilityRole="button" hitSlop={10} style={[ui.row, { gap: 2, paddingVertical: 6, paddingRight: 8 }]}>
        <Icon name="back" size={20} />
        <Text style={{ fontSize: 17, color: colors.bark, fontWeight: "500" }}>Back</Text>
      </Tap>
      <Text style={{ flex: 1, fontSize: 18, fontWeight: "800", color: colors.text, textAlign: "right", paddingRight: 8 }} numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}

// An empty ring until it's ticked.
function Tick({ checked, size, strong }: { checked: boolean; size: number; strong?: boolean }) {
  if (checked) return <Icon name="check" size={size} color={colors.bark} />;
  return (
    <View
      style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}
    >
      <View style={{ width: size - 4, height: size - 4, borderRadius: size, borderWidth: 2, borderColor: strong ? colors.bark : colors.muted }} />
    </View>
  );
}
