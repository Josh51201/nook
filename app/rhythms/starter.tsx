import { Stack, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

import { DateField } from "../../components/date-field";
import { Icon } from "../../components/icon";
import { LoadingScreen, Tap } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { Text } from "../../components/text";
import { Button, EmptyState, SectionHeader } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { friendlyError, tap } from "../../lib/feedback";
import { findNook } from "../../lib/nooks";
import { parseDateString, toDateString } from "../../lib/profile";
import { areas, repeatWords, startersLeft, suggestedDue, type Starter } from "../../lib/rhythms";
import { addStarters, useRhythms } from "../../lib/rhythms-data";
import { colors, ui } from "../../lib/theme";

const nook = findNook("rhythms")!;

// The starter list (RHY-003): tick the chores your Home does, then set when
// each is next due. Ones already added are left out.
export default function StarterList() {
  const router = useRouter();
  const { session } = useAuth();
  const { data } = useRhythms(session?.user.id);
  const [picked, setPicked] = useState<Map<string, string>>(new Map());
  const [step, setStep] = useState<"pick" | "dates">("pick");
  const [saving, setSaving] = useState(false);

  const left = useMemo(() => (data ? startersLeft(data.rhythms.map((r) => r.title)) : []), [data]);

  if (!data) return <LoadingScreen cards={3} />;
  if (!left.length) {
    return <EmptyState icon="check" title="You've got them all" body="Everything on the starter list is already in your Rhythms. Add your own any time." />;
  }

  const chosen = left.filter((s) => picked.has(s.title));

  function toggle(starter: Starter) {
    tap();
    setPicked((current) => {
      const next = new Map(current);
      if (next.has(starter.title)) next.delete(starter.title);
      else next.set(starter.title, suggestedDue(starter, data!.today));
      return next;
    });
  }

  function setDate(title: string, day: string) {
    setPicked((current) => new Map(current).set(title, day));
  }

  async function save() {
    setSaving(true);
    const { error } = await addStarters(
      data!.homeId,
      chosen.map((s) => ({ ...s, due_on: picked.get(s.title)! }))
    );
    if (error) {
      setSaving(false);
      return Alert.alert("Couldn't add those", friendlyError(error));
    }
    tap("success");
    router.back();
  }

  return (
    <NookScroll>
      <Stack.Screen
        options={{
          title: step === "pick" ? "Starter list" : "When is each due?",
          headerRight:
            step === "pick" && chosen.length
              ? () => (
                  <Tap onPress={() => setStep("dates")} hitSlop={10}>
                    <Text style={{ color: colors.bark, fontSize: 17, fontWeight: "700" }}>Next</Text>
                  </Tap>
                )
              : undefined,
        }}
      />

      {step === "pick" ? (
        <>
          <Text style={ui.muted}>Tick the ones your Home does. You'll set the dates next.</Text>
          {areas.map((area) => {
            const items = left.filter((s) => s.area === area.key);
            if (!items.length) return null;
            return (
              <View key={area.key} style={{ gap: 8 }}>
                <SectionHeader title={area.label} icon={area.icon} />
                <View style={[ui.card, { gap: 2, paddingVertical: 6 }]}>
                  {items.map((s) => {
                    const on = picked.has(s.title);
                    return (
                      <Tap
                        key={s.title}
                        onPress={() => toggle(s)}
                        style={styles.pick}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: on }}
                      >
                        <View style={[styles.box, { borderColor: nook.iconColor }, on && { backgroundColor: nook.iconColor }]}>
                          {on ? <Icon name="check" size={14} color="#ffffff" /> : null}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={ui.cardTitle}>{s.title}</Text>
                          <Text style={[ui.muted, { fontSize: 13 }]}>Usually {repeatWords(s.months)}</Text>
                        </View>
                      </Tap>
                    );
                  })}
                </View>
              </View>
            );
          })}
          <Button
            title={chosen.length ? `Next: set ${chosen.length} date${chosen.length === 1 ? "" : "s"}` : "Tick a few to start"}
            icon="calendar"
            disabled={!chosen.length}
            onPress={() => setStep("dates")}
          />
        </>
      ) : (
        <>
          <Text style={ui.muted}>
            Our best guess is filled in. Change any you know — like when the car registration really runs out.
          </Text>
          {chosen.map((s) => (
            <View key={s.title} style={[ui.card, { gap: 8 }]}>
              <View style={[ui.row, { gap: 8 }]}>
                <Text style={[ui.cardTitle, { flex: 1 }]}>{s.title}</Text>
                <Text style={[ui.muted, { fontSize: 13 }]}>{repeatWords(s.months)}</Text>
              </View>
              <DateField mode="date" value={parseDateString(picked.get(s.title)!)} onChange={(d) => setDate(s.title, toDateString(d))} />
            </View>
          ))}
          <Button title={`Add ${chosen.length} rhythm${chosen.length === 1 ? "" : "s"}`} icon="check" onPress={save} loading={saving} />
          <Tap onPress={() => setStep("pick")} hitSlop={8} style={{ alignSelf: "center" }}>
            <Text style={ui.link}>Back to the list</Text>
          </Tap>
        </>
      )}
    </NookScroll>
  );
}

const styles = StyleSheet.create({
  pick: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  box: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, alignItems: "center", justifyContent: "center" },
});
