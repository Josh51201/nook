import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, Switch, View } from "react-native";

import { DateField } from "../../components/date-field";
import { Icon, type IconName } from "../../components/icon";
import { useLeaveGuard } from "../../components/leave-guard";
import { LoadingScreen, Tap } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { Text, TextInput } from "../../components/text";
import { Button, Chip } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { friendlyError, tap } from "../../lib/feedback";
import { kindInfo, logColors, logIcons, logKinds, starters, type LogKind, type LogStarter } from "../../lib/little-log";
import { cancelLogReminder, syncLogReminder, useLittleLogs } from "../../lib/little-log-data";
import { supabase } from "../../lib/supabase";
import { colors, ui } from "../../lib/theme";

// Make or change a log (LOG-001, LOG-002, LOG-006, LOG-009): a starter or
// your own, what each entry holds, its look, who can see it, and a daily
// reminder. What an entry holds can't change once made (the entries are
// already that kind).
export default function LogForm() {
  const router = useRouter();
  const { id, starter } = useLocalSearchParams<{ id?: string; starter?: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;
  const { data } = useLittleLogs(userId);
  const existing = data?.logs.find((l) => l.id === id);

  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<LogKind>("number");
  const [unit, setUnit] = useState("");
  const [first, setFirst] = useState("");
  const [second, setSecond] = useState("");
  const [icon, setIcon] = useState<string>("chart");
  const [color, setColor] = useState(logColors[0]);
  const [shared, setShared] = useState(false);
  const [remind, setRemind] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [livesWithOthers, setLivesWithOthers] = useState(false);
  const { allowLeave } = useLeaveGuard({ name, kind, unit, first, second, icon, color, shared, remind }, ready);

  useEffect(() => {
    supabase
      .from("home_members")
      .select("profile_id")
      .then(({ data: rows }) => setLivesWithOthers((rows ?? []).length > 1));
  }, []);

  useEffect(() => {
    if (ready || !data) return;
    if (id && !existing) return;
    if (existing) {
      setName(existing.name);
      setKind(existing.kind);
      setUnit(existing.unit ?? "");
      setFirst(existing.labels?.[0] ?? "");
      setSecond(existing.labels?.[1] ?? "");
      setIcon(existing.icon);
      setColor(existing.color);
      setShared(existing.shared);
      setRemind(existing.remind_at);
    } else {
      const picked = starters.find((s) => s.name === starter);
      if (picked) use(picked, false);
    }
    setReady(true);
    // `use` only sets state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, existing, id, ready, starter]);

  if (!data || !ready) return <LoadingScreen cards={2} />;

  function use(s: LogStarter, feedback = true) {
    if (feedback) tap();
    setName(s.name);
    setKind(s.kind);
    setUnit(s.unit ?? "");
    setFirst(s.labels?.[0] ?? "");
    setSecond(s.labels?.[1] ?? "");
    setIcon(s.icon);
    setColor(s.color);
  }

  async function save() {
    if (!name.trim()) return Alert.alert("What are you keeping track of?", "Like “Weight” or “Ella's height”.");
    setSaving(true);
    const row = {
      name: name.trim(),
      unit: kind === "number" || kind === "pair" ? unit.trim() || null : null,
      labels: kind === "pair" ? [first.trim() || "First", second.trim() || "Second"] : null,
      icon,
      color,
      shared,
      remind_at: remind,
    };
    const result = existing
      ? await supabase.from("little_logs").update(row).eq("id", existing.id).select("id, name, remind_at, owner_id").single()
      : await supabase.from("little_logs").insert({ ...row, kind }).select("id, name, remind_at, owner_id").single();
    if (result.error) {
      setSaving(false);
      return Alert.alert("Couldn't save", friendlyError(result.error));
    }
    await syncLogReminder(result.data, userId);
    tap("success");
    allowLeave();
    if (existing) router.back();
    else router.replace(`/little-log/${result.data.id}`);
  }

  function confirmDelete() {
    const count = data!.entries.get(existing!.id)?.length ?? 0;
    Alert.alert(
      `Remove “${existing!.name}”?`,
      count ? `Its ${count} entr${count === 1 ? "y goes" : "ies go"} too, for everyone it's shared with.` : "There's nothing logged in it yet.",
      [
        { text: "Keep it", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase.from("little_logs").delete().eq("id", existing!.id);
            if (error) return Alert.alert("Couldn't remove it", friendlyError(error));
            await cancelLogReminder(existing!.id);
            allowLeave();
            router.dismissTo("/little-log");
          },
        },
      ]
    );
  }

  const remindDate = (() => {
    const [h, m] = (remind ?? "20:00").split(":").map(Number);
    return new Date(2000, 0, 1, h, m);
  })();
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <NookScroll>
      <Stack.Screen
        options={{
          title: existing ? "Change log" : "New log",
          headerRight: () => (
            <Tap onPress={save} disabled={saving} hitSlop={10}>
              <Text style={{ color: colors.bark, fontSize: 17, fontWeight: "700" }}>Save</Text>
            </Tap>
          ),
        }}
      />

      {!existing ? (
        <>
          <Text style={ui.label}>Start from</Text>
          <View style={ui.chips}>
            {starters.map((s) => (
              <Chip key={s.name} icon={s.icon as IconName} selected={name === s.name && kind === s.kind} onPress={() => use(s)}>
                {s.name}
              </Chip>
            ))}
          </View>
        </>
      ) : null}

      <Text style={ui.label}>Name</Text>
      <TextInput
        style={ui.input}
        value={name}
        onChangeText={setName}
        placeholder="What is it? e.g. Ella's height"
        placeholderTextColor={colors.muted}
        maxLength={40}
      />

      <Text style={ui.label}>Each time, you log</Text>
      {existing ? (
        <Text style={ui.muted}>
          {kindInfo(kind).label}. This can't change now there are entries; make a new log for something different.
        </Text>
      ) : (
        <View style={{ gap: 8 }}>
          {logKinds.map((k) => (
            <Tap
              key={k.key}
              onPress={() => {
                tap();
                setKind(k.key);
              }}
              style={[ui.card, styles.kind, kind === k.key && { borderColor: colors.bark, borderWidth: 2 }]}
              accessibilityRole="radio"
              accessibilityState={{ selected: kind === k.key }}
            >
              <Icon name={k.icon} size={20} color={kind === k.key ? colors.bark : colors.muted} />
              <View style={{ flex: 1, gap: 1 }}>
                <Text style={ui.cardTitle}>{k.label}</Text>
                <Text style={[ui.muted, { fontSize: 13 }]}>{k.hint}</Text>
              </View>
              {kind === k.key ? <Icon name="check" size={18} color={colors.bark} /> : null}
            </Tap>
          ))}
        </View>
      )}

      {kind === "number" || kind === "pair" ? (
        <>
          <Text style={ui.label}>Unit (if any)</Text>
          <TextInput
            style={ui.input}
            value={unit}
            onChangeText={setUnit}
            placeholder={kind === "pair" ? "e.g. mmHg" : "e.g. lbs, hours, mi"}
            placeholderTextColor={colors.muted}
            maxLength={12}
            autoCapitalize="none"
          />
        </>
      ) : null}

      {kind === "pair" ? (
        <>
          <Text style={ui.label}>What the two numbers are</Text>
          <View style={[ui.row, { gap: 8 }]}>
            <TextInput
              style={[ui.input, { flex: 1 }]}
              value={first}
              onChangeText={setFirst}
              placeholder="First, e.g. Top"
              placeholderTextColor={colors.muted}
              maxLength={16}
            />
            <Text style={[ui.cardTitle, { fontSize: 20 }]}>/</Text>
            <TextInput
              style={[ui.input, { flex: 1 }]}
              value={second}
              onChangeText={setSecond}
              placeholder="Second, e.g. Bottom"
              placeholderTextColor={colors.muted}
              maxLength={16}
            />
          </View>
        </>
      ) : null}

      <Text style={ui.label}>Color</Text>
      <View style={ui.chips}>
        {logColors.map((c) => (
          <Tap
            key={c}
            onPress={() => {
              tap();
              setColor(c);
            }}
            pressedScale={0.85}
            style={[styles.swatch, { backgroundColor: c }, color === c && styles.swatchOn]}
            accessibilityRole="radio"
            accessibilityState={{ selected: color === c }}
            accessibilityLabel={`Color ${logColors.indexOf(c) + 1}`}
          >
            {color === c ? <Icon name="check" size={16} color="#ffffff" /> : null}
          </Tap>
        ))}
      </View>

      <Text style={ui.label}>Icon</Text>
      <View style={ui.chips}>
        {logIcons.map((name) => (
          <Tap
            key={name}
            onPress={() => {
              tap();
              setIcon(name);
            }}
            pressedScale={0.85}
            style={[styles.icon, { backgroundColor: icon === name ? color : colors.barkSoft }]}
            accessibilityRole="radio"
            accessibilityState={{ selected: icon === name }}
            accessibilityLabel={name}
          >
            <Icon name={name} size={18} color={icon === name ? "#ffffff" : colors.bark} />
          </Tap>
        ))}
      </View>

      <Text style={ui.label}>Who can see it</Text>
      <View style={ui.chips}>
        <Chip icon="lock" selected={!shared} onPress={() => setShared(false)}>
          Just me
        </Chip>
        <Chip icon="group" selected={shared} onPress={() => setShared(true)}>
          Everyone in my Home
        </Chip>
      </View>
      <Text style={ui.muted}>
        {shared
          ? livesWithOthers
            ? "Everyone you live with sees it and can log in it, like a kid's height everyone measures. Only you can change or remove the log itself."
            : "Nobody else lives in your Home yet. Once someone joins, they'll see it and can log in it."
          : "Nobody else sees it, even people you live with."}
      </Text>

      <View style={[ui.card, ui.row, { gap: 12 }]}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={ui.cardTitle}>Remind me every day</Text>
          <Text style={ui.muted}>A nudge on this phone, so you don't forget to log it.</Text>
        </View>
        <Switch value={remind !== null} onValueChange={(on) => setRemind(on ? "20:00" : null)} trackColor={{ true: colors.bark }} />
      </View>
      {remind !== null ? <DateField mode="time" value={remindDate} onChange={(d) => setRemind(`${pad(d.getHours())}:${pad(d.getMinutes())}`)} /> : null}

      <Button title="Save" icon="check" onPress={save} loading={saving} style={{ marginTop: 8 }} />
      {existing ? <Button title="Remove this log" icon="trash" variant="danger" onPress={confirmDelete} /> : null}
    </NookScroll>
  );
}

const styles = StyleSheet.create({
  kind: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  swatch: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  swatchOn: { transform: [{ scale: 1.1 }] },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
