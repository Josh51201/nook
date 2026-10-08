import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Switch, useWindowDimensions, View } from "react-native";
import { Text, TextInput } from "../../components/text";
import Animated, { FadeIn, LinearTransition } from "react-native-reanimated";

import { GRID_GAP } from "../../components/hearth/hearth-grid";
import { IconPicker } from "../../components/hearth/icon-picker";
import { WidgetView } from "../../components/hearth/widgets";
import { Icon } from "../../components/icon";
import { LoadingScreen, Tap } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { DateField } from "../../components/date-field";
import { Button, Chip, EmptyState, SectionHeader } from "../../components/ui";
import { tap } from "../../lib/feedback";
import { formatDate, gatheringKinds, type GatheringKind } from "../../lib/gift-nook";
import {
  COLUMNS,
  copyItem,
  deepColor,
  hearthThemes,
  hollowsOf,
  inScope,
  locate,
  moveToScope,
  removeItem,
  resizeItem,
  sizePresets,
  tilePalette,
  updateItem,
  useHearthLayout,
  type Scope,
  type WidgetItem,
} from "../../lib/hearth";
import { cancelReminders, syncReminders } from "../../lib/reminders";
import { supabase } from "../../lib/supabase";
import { colors, themed, ui, useTheme } from "../../lib/theme";
import {
  describeSchedule,
  newReminderId,
  widgetKindInfo,
  type Reminder,
  type ReminderSchedule,
  type WidgetConfig,
  type WidgetLook,
  type WidgetOf,
} from "../../lib/widgets";

// Customize one Hearth widget (CORE-018): what it shows and how it looks,
// with a live preview at its real size. Nothing is saved until "Save".
export default function WidgetEditor() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { layout, save, isLoading } = useHearthLayout();
  const { width: screenWidth } = useWindowDimensions();
  // Hooks first: the screen returns early below while it loads.
  const { key: themeKey } = useTheme();
  // The widget may live on the Hearth or inside a Hollow (CORE-022).
  const found = locate(layout, id);
  const original = found?.item.kind === "widget" ? (found.item as WidgetItem) : undefined;
  const home: Scope = found?.scope ?? null;
  const [livesIn, setLivesIn] = useState<Scope | undefined>(undefined);

  const [draft, setDraft] = useState<WidgetItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (original && !draft) setDraft(original);
  }, [original, draft]);

  if (isLoading || (original && !draft)) return <LoadingScreen />;
  if (!original || !draft) {
    return <EmptyState icon="widgets" title="That widget is gone" body="It may have been removed from your Hearth." />;
  }

  const widget = draft.widget;
  const info = widgetKindInfo(widget.kind);
  const theme = hearthThemes[themeKey] ?? hearthThemes.hearth;
  const stride = (screenWidth - 40 - GRID_GAP * (COLUMNS - 1)) / COLUMNS + GRID_GAP;

  function setWidget(changes: Partial<WidgetConfig>) {
    setDraft((prev) => (prev ? { ...prev, widget: { ...prev.widget, ...changes } as WidgetConfig } : prev));
  }
  function setSettings<K extends WidgetConfig["kind"]>(changes: Partial<WidgetOf<K>["settings"]>) {
    setDraft((prev) =>
      prev
        ? { ...prev, widget: { ...prev.widget, settings: { ...prev.widget.settings, ...changes } } as WidgetConfig }
        : prev
    );
  }

  // Saves, then (with `copyTo`) makes a copy there and opens it (CORE-039).
  async function saveWidget(copyTo?: Scope) {
    if (!draft || !original || isSaving) return;
    setIsSaving(true);
    try {
      let next = draft.widget;
      // Phone reminders need scheduling first (this may ask permission), so
      // their notification ids can be saved with the widget.
      if (next.kind === "reminders" && original.widget.kind === "reminders") {
        const synced = await syncReminders(next.title, next.settings.items, original.widget.settings.items);
        next = { ...next, settings: { ...next.settings, items: synced } };
      }
      let items = inScope(layout, home, (inner) =>
        updateItem(inner, draft.id, { widget: next, color: draft.color, icon: draft.icon } as Partial<WidgetItem>)
      );
      if (draft.w !== original.w || draft.h !== original.h) {
        items = inScope({ ...layout, items }, home, (inner) => resizeItem(inner, draft.id, draft.w, draft.h));
      }
      // Moving it to the Hearth or another Hollow.
      if (livesIn !== undefined && livesIn !== home) {
        items = moveToScope({ ...layout, items }, draft.id, livesIn);
      }
      let copyId: string | null = null;
      if (copyTo !== undefined) ({ items, copyId } = copyItem({ ...layout, items }, draft.id, copyTo));
      // Your Hearth updates instantly; the cloud save finishes in the
      // background, so closing never waits on the network.
      const pending = save({ items });
      tap("success");
      if (copyId) router.replace(`/widget/${copyId}`);
      else router.back();
      pending.catch((error: Error) => Alert.alert("Couldn't save your widget", error.message));
    } catch (error) {
      setIsSaving(false);
      Alert.alert("Couldn't save", (error as Error).message);
    }
  }

  function confirmRemove() {
    Alert.alert("Remove this widget?", undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          if (original?.widget.kind === "reminders") cancelReminders(original.widget.settings.items);
          const pending = save({ items: inScope(layout, home, (inner) => removeItem(inner, id)) });
          router.back();
          pending.catch((error: Error) => Alert.alert("Couldn't remove it", error.message));
        },
      },
    ]);
  }

  return (
    <NookScroll>
      <Stack.Screen
        options={{
          title: info.label,
          headerRight: () => (
            <Tap onPress={() => saveWidget()} disabled={isSaving} hitSlop={10}>
              <Text style={{ color: colors.bark, fontSize: 17, fontWeight: "700" }}>Save</Text>
            </Tap>
          ),
        }}
      />

      {/* Live preview, at the size it'll be on your Hearth */}
      <Animated.View
        layout={LinearTransition.duration(220)}
        style={{ alignItems: "center", padding: 12, borderRadius: 24, backgroundColor: theme.background }}
      >
        <WidgetView
          widget={widget}
          color={draft.color}
          icon={draft.icon}
          width={Math.min(draft.w * stride - GRID_GAP, screenWidth - 64)}
          height={draft.h * stride - GRID_GAP}
          refreshKey={0}
          themeText={theme.text}
          onChange={(changed) => setWidget(changed)}
        />
      </Animated.View>

      <SectionHeader title="What it shows" icon={info.icon} />
      <KindSettings widget={widget} setSettings={setSettings} />

      {hollowsOf(layout).length ? (
        <>
          <SectionHeader title="Where it lives" icon="burrow" />
          <View style={ui.chips}>
            <Chip icon="hearth" selected={(livesIn ?? home) === null} onPress={() => setLivesIn(null)}>
              The Hearth
            </Chip>
            {hollowsOf(layout).map((hollowItem) => (
              <Chip
                key={hollowItem.id}
                icon="burrow"
                selected={(livesIn ?? home) === hollowItem.id}
                onPress={() => setLivesIn(hollowItem.id)}
              >
                {hollowItem.name}
              </Chip>
            ))}
          </View>
        </>
      ) : null}

      <SectionHeader title="How it looks" icon="palette" />
      <Text style={ui.label}>Title</Text>
      <View style={[ui.row, { gap: 10 }]}>
        <TextInput
          style={[ui.input, { flex: 1 }]}
          value={widget.title}
          onChangeText={(title) => setWidget({ title })}
          placeholder={info.label}
          placeholderTextColor={colors.muted}
        />
        <Switch value={widget.showTitle} onValueChange={(showTitle) => setWidget({ showTitle })} trackColor={{ true: colors.bark }} />
      </View>

      <Text style={ui.label}>Style</Text>
      <View style={ui.chips}>
        {(
          [
            ["soft", "Soft"],
            ["bold", "Bold"],
            ["outline", "Outline"],
          ] as [WidgetLook, string][]
        ).map(([look, label]) => (
          <Chip key={look} selected={widget.look === look} onPress={() => setWidget({ look })}>
            {label}
          </Chip>
        ))}
      </View>

      <Text style={ui.label}>Color</Text>
      <View style={ui.chips}>
        {tilePalette.map((color) => {
          const selected = (draft.color ?? tilePalette[0]) === color;
          return (
            <Tap
              key={color}
              pressedScale={0.85}
              onPress={() => {
                tap();
                setDraft({ ...draft, color });
              }}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: widget.look === "bold" ? deepColor(color) : color,
                borderWidth: selected ? 2.5 : 1,
                borderColor: selected ? colors.bark : "rgba(0,0,0,0.08)",
                alignItems: "center",
                justifyContent: "center",
              }}
              accessibilityLabel={selected ? "Selected color" : "Pick this color"}
            >
              {selected ? <Icon name="check" size={18} color={widget.look === "bold" ? "#fff" : colors.bark} /> : null}
            </Tap>
          );
        })}
      </View>

      <Text style={ui.label}>Icon</Text>
      <IconPicker value={draft.icon} fallback={info.icon} onChange={(icon) => setDraft({ ...draft, icon })} />

      <Text style={ui.label}>Size</Text>
      <View style={ui.chips}>
        {sizePresets.widget
          .filter((preset) => preset.w >= info.minSize.w && preset.h >= info.minSize.h)
          .map((preset) => (
            <Chip
              key={preset.label}
              selected={draft.w === preset.w && draft.h === preset.h}
              onPress={() => setDraft({ ...draft, w: preset.w, h: preset.h })}
            >
              {preset.label}
            </Chip>
          ))}
      </View>
      <Text style={ui.muted}>Or drag its corner on the Hearth for any size.</Text>

      <SectionHeader title="Make a copy" icon="copy" />
      <View style={ui.chips}>
        <Chip icon="hearth" onPress={() => saveWidget(null)}>
          The Hearth
        </Chip>
        {hollowsOf(layout).map((hollowItem) => (
          <Chip key={hollowItem.id} icon="burrow" onPress={() => saveWidget(hollowItem.id)}>
            {hollowItem.name}
          </Chip>
        ))}
      </View>
      <Text style={ui.muted}>
        Saves this one, then opens the copy so you can make it its own.
        {widget.kind === "reminders" ? " The copy's list starts without phone alerts, so nothing rings twice." : ""}
      </Text>

      <Button title="Save" icon="check" onPress={() => saveWidget()} loading={isSaving} style={{ marginTop: 8 }} />
      <Button title="Remove widget" icon="trash" variant="danger" onPress={confirmRemove} />
    </NookScroll>
  );
}

// --- Per-kind settings --------------------------------------------------------

function KindSettings({
  widget,
  setSettings,
}: {
  widget: WidgetConfig;
  setSettings: (changes: Record<string, unknown>) => void;
}) {
  switch (widget.kind) {
    case "countdown":
      return <CountdownSettings widget={widget} setSettings={setSettings} />;
    case "gatherings":
      return <GatheringsSettings widget={widget} setSettings={setSettings} />;
    case "reminders":
      return <RemindersSettings widget={widget} setSettings={setSettings} />;
    case "tucks":
      return (
        <>
          <Text style={ui.label}>Show</Text>
          <View style={ui.chips}>
            <Chip selected={widget.settings.include === "planning"} onPress={() => setSettings({ include: "planning" })}>
              Still to get
            </Chip>
            <Chip selected={widget.settings.include === "open"} onPress={() => setSettings({ include: "open" })}>
              To get + bought
            </Chip>
          </View>
          <Stepper label="How many to list" value={widget.settings.count} min={1} max={6} onChange={(count) => setSettings({ count })} />
        </>
      );
    case "note":
      return (
        <>
          <TextInput
            style={[ui.input, { minHeight: 110, textAlignVertical: "top" }]}
            value={widget.settings.text}
            onChangeText={(text) => setSettings({ text })}
            placeholder="Anything you want to see every day…"
            placeholderTextColor={colors.muted}
            multiline
          />
          <Text style={ui.label}>Text size</Text>
          <View style={ui.chips}>
            {(["small", "medium", "large"] as const).map((size) => (
              <Chip key={size} selected={widget.settings.textSize === size} onPress={() => setSettings({ textSize: size })}>
                {size[0].toUpperCase() + size.slice(1)}
              </Chip>
            ))}
          </View>
          <Text style={ui.label}>Line up</Text>
          <View style={ui.chips}>
            {(["left", "center"] as const).map((align) => (
              <Chip key={align} selected={widget.settings.align === align} onPress={() => setSettings({ align })}>
                {align === "left" ? "Left" : "Center"}
              </Chip>
            ))}
          </View>
        </>
      );
    case "cards":
      return (
        <>
          <Stepper label="Names to list" value={widget.settings.count} min={0} max={6} onChange={(count) => setSettings({ count })} />
          <Text style={ui.muted}>Who's on your holiday list and still waiting for a card, from your Letterbox Nook.</Text>
        </>
      );
    case "inbox":
      return <Stepper label="Notices to list" value={widget.settings.count} min={0} max={5} onChange={(count) => setSettings({ count })} />;
    case "greeting":
      return (
        <>
          <Text style={ui.label}>Your message (optional)</Text>
          <TextInput
            style={ui.input}
            value={widget.settings.message}
            onChangeText={(message) => setSettings({ message })}
            placeholder="e.g. Have a cozy day"
            placeholderTextColor={colors.muted}
          />
          <SwitchRow label="Use my name" value={widget.settings.showName} onChange={(showName) => setSettings({ showName })} />
          <SwitchRow label="Show today's date" value={widget.settings.showDate} onChange={(showDate) => setSettings({ showDate })} />
        </>
      );
  }
}

function CountdownSettings({
  widget,
  setSettings,
}: {
  widget: WidgetOf<"countdown">;
  setSettings: (changes: Partial<WidgetOf<"countdown">["settings"]>) => void;
}) {
  const { source, gatheringId, customTitle, customDate, display } = widget.settings;
  const [gatherings, setGatherings] = useState<{ id: string; title: string; ends_at: string }[]>([]);

  useEffect(() => {
    supabase
      .from("gatherings")
      .select("id, title, ends_at")
      .gt("ends_at", new Date().toISOString())
      .order("ends_at")
      .limit(20)
      .then(({ data }) => setGatherings(data ?? []));
  }, []);

  return (
    <>
      <Text style={ui.label}>Count down to</Text>
      <View style={ui.chips}>
        <Chip selected={source === "next"} onPress={() => setSettings({ source: "next" })}>
          Next Gathering
        </Chip>
        <Chip selected={source === "gathering"} onPress={() => setSettings({ source: "gathering" })}>
          A Gathering
        </Chip>
        <Chip selected={source === "custom"} onPress={() => setSettings({ source: "custom" })}>
          My own date
        </Chip>
      </View>

      {source === "gathering" ? (
        <Animated.View entering={FadeIn.duration(200)} style={ui.chips}>
          {gatherings.length ? (
            gatherings.map((g) => (
              <Chip key={g.id} selected={gatheringId === g.id} onPress={() => setSettings({ gatheringId: g.id })}>
                {g.title} · {formatDate(g.ends_at)}
              </Chip>
            ))
          ) : (
            <Text style={ui.muted}>No upcoming Gatherings yet.</Text>
          )}
        </Animated.View>
      ) : null}

      {source === "custom" ? (
        <Animated.View entering={FadeIn.duration(200)} style={{ gap: 12 }}>
          <TextInput
            style={ui.input}
            value={customTitle}
            onChangeText={(title) => setSettings({ customTitle: title })}
            placeholder="What's happening? e.g. Beach trip"
            placeholderTextColor={colors.muted}
          />
          <DateField
            mode="date"
            value={customDate ? new Date(customDate) : new Date()}
            onChange={(date) => setSettings({ customDate: date.toISOString() })}
          />
        </Animated.View>
      ) : null}

      <Text style={ui.label}>Show it as</Text>
      <View style={ui.chips}>
        <Chip selected={display === "number"} onPress={() => setSettings({ display: "number" })}>
          Big number
        </Chip>
        <Chip selected={display === "words"} onPress={() => setSettings({ display: "words" })}>
          In words
        </Chip>
      </View>
    </>
  );
}

function GatheringsSettings({
  widget,
  setSettings,
}: {
  widget: WidgetOf<"gatherings">;
  setSettings: (changes: Partial<WidgetOf<"gatherings">["settings"]>) => void;
}) {
  const { burrowId, kinds, count, showCountdown } = widget.settings;
  const [burrows, setBurrows] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    supabase
      .from("burrows")
      .select("id, name")
      .order("name")
      .then(({ data }) => setBurrows(data ?? []));
  }, []);

  function toggleKind(kind: GatheringKind) {
    setSettings({ kinds: kinds.includes(kind) ? kinds.filter((k) => k !== kind) : [...kinds, kind] });
  }

  return (
    <>
      <Text style={ui.label}>From</Text>
      <View style={ui.chips}>
        <Chip selected={!burrowId} onPress={() => setSettings({ burrowId: null })}>
          All my Burrows
        </Chip>
        {burrows.map((b) => (
          <Chip key={b.id} icon="burrow" selected={burrowId === b.id} onPress={() => setSettings({ burrowId: b.id })}>
            {b.name}
          </Chip>
        ))}
      </View>
      <Text style={ui.label}>Kinds (none picked = all)</Text>
      <View style={ui.chips}>
        {gatheringKinds.map((k) => (
          <Chip key={k.key} icon={k.icon} selected={kinds.includes(k.key)} onPress={() => toggleKind(k.key)}>
            {k.label}
          </Chip>
        ))}
      </View>
      <Stepper label="How many" value={count} min={1} max={6} onChange={(next) => setSettings({ count: next })} />
      <SwitchRow label="Show how long until each" value={showCountdown} onChange={(next) => setSettings({ showCountdown: next })} />
    </>
  );
}

const weekdays = ["S", "M", "T", "W", "T", "F", "S"];

function RemindersSettings({
  widget,
  setSettings,
}: {
  widget: WidgetOf<"reminders">;
  setSettings: (changes: Partial<WidgetOf<"reminders">["settings"]>) => void;
}) {
  const { items, hideDone } = widget.settings;

  function update(id: string, changes: Partial<Reminder>) {
    setSettings({ items: items.map((item) => (item.id === id ? { ...item, ...changes } : item)) });
  }
  function setSchedule(item: Reminder, kind: ReminderSchedule["kind"] | "none") {
    const now = new Date();
    const hour = 9;
    const minute = 0;
    const schedule: ReminderSchedule | undefined =
      kind === "none"
        ? undefined
        : kind === "daily"
          ? { kind, hour, minute }
          : kind === "weekly"
            ? { kind, weekday: now.getDay() + 1, hour, minute }
            : { kind, at: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, hour, minute).toISOString() };
    update(item.id, { schedule });
  }

  return (
    <>
      {items.map((item) => (
        <Animated.View key={item.id} entering={FadeIn.duration(200)} layout={LinearTransition.duration(200)} style={[ui.card, { gap: 10 }]}>
          <View style={[ui.row, { gap: 10 }]}>
            <TextInput
              style={[ui.input, { flex: 1 }]}
              value={item.text}
              onChangeText={(text) => update(item.id, { text })}
              placeholder="e.g. Log lunch"
              placeholderTextColor={colors.muted}
            />
            <Tap
              onPress={() => setSettings({ items: items.filter((r) => r.id !== item.id) })}
              hitSlop={8}
              pressedScale={0.85}
              accessibilityLabel="Remove reminder"
            >
              <Icon name="trash" size={20} color={colors.error} />
            </Tap>
          </View>
          <View style={ui.chips}>
            {(
              [
                ["none", "No alert"],
                ["once", "Once"],
                ["daily", "Daily"],
                ["weekly", "Weekly"],
              ] as const
            ).map(([kind, label]) => (
              <Chip
                key={kind}
                selected={(item.schedule?.kind ?? "none") === kind}
                onPress={() => setSchedule(item, kind)}
              >
                {label}
              </Chip>
            ))}
          </View>
          {item.schedule?.kind === "weekly" ? (
            <View style={ui.chips}>
              {weekdays.map((letter, i) => {
                const schedule = item.schedule as Extract<ReminderSchedule, { kind: "weekly" }>;
                return (
                  <Chip key={i} selected={schedule.weekday === i + 1} onPress={() => update(item.id, { schedule: { ...schedule, weekday: i + 1 } })}>
                    {letter}
                  </Chip>
                );
              })}
            </View>
          ) : null}
          {item.schedule ? (
            <View style={[ui.row, { gap: 10 }]}>
              <Icon name="bell" size={16} />
              <View style={{ flex: 1 }}>
                <DateField
                  mode={item.schedule.kind === "once" ? "datetime" : "time"}
                  value={scheduleDate(item.schedule)}
                  onChange={(date) => update(item.id, { schedule: withTime(item.schedule!, date) })}
                />
              </View>
            </View>
          ) : null}
          {item.schedule ? <Text style={ui.muted}>{describeSchedule(item.schedule)}</Text> : null}
        </Animated.View>
      ))}
      <Button
        title="Add a reminder"
        icon="add"
        variant="secondary"
        onPress={() => setSettings({ items: [...items, { id: newReminderId(), text: "", done: false }] })}
      />
      <SwitchRow label="Hide ones I've checked off" value={hideDone} onChange={(next) => setSettings({ hideDone: next })} />
      <Text style={ui.muted}>
        Alerts ring on this phone. Nook will ask permission to send notifications the first time.
      </Text>
    </>
  );
}

function scheduleDate(schedule: ReminderSchedule) {
  if (schedule.kind === "once") return new Date(schedule.at);
  const date = new Date();
  date.setHours(schedule.hour, schedule.minute, 0, 0);
  return date;
}

function withTime(schedule: ReminderSchedule, date: Date): ReminderSchedule {
  if (schedule.kind === "once") return { ...schedule, at: date.toISOString() };
  return { ...schedule, hour: date.getHours(), minute: date.getMinutes() };
}

// --- Small inputs ----------------------------------------------------------------

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <View style={[ui.row, { justifyContent: "space-between" }]}>
      <Text style={ui.cardTitle}>{label}</Text>
      <View style={[ui.row, { gap: 14 }]}>
        <Tap onPress={() => value > min && onChange(value - 1)} disabled={value <= min} style={stepperButton} hitSlop={6}>
          <Text style={stepperText}>−</Text>
        </Tap>
        <Text style={[ui.cardTitle, { minWidth: 20, textAlign: "center" }]}>{value}</Text>
        <Tap onPress={() => value < max && onChange(value + 1)} disabled={value >= max} style={stepperButton} hitSlop={6}>
          <Icon name="add" size={16} />
        </Tap>
      </View>
    </View>
  );
}

const stepperButton = themed(() => ({
  width: 34,
  height: 34,
  borderRadius: 17,
  backgroundColor: colors.barkSoft,
  alignItems: "center" as const,
  justifyContent: "center" as const,
}));
const stepperText = { fontSize: 20, fontWeight: "700" as const, color: colors.bark, marginTop: -2 };

function SwitchRow({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <View style={[ui.row, { justifyContent: "space-between" }]}>
      <Text style={ui.cardTitle}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.bark }} />
    </View>
  );
}
