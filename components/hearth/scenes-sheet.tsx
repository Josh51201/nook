import { useState } from "react";
import { ScrollView, TextInput, View } from "react-native";

import { dayParts, MAX_SCENES, scheduleWords, type DayPart, type SceneSchedule, type ScenesState } from "../../lib/hearth-scenes";
import { showInWords } from "../../lib/widget-extras";
import { colors, ui } from "../../lib/theme";
import { BottomSheet } from "../bottom-sheet";
import { Icon } from "../icon";
import { Tap } from "../motion";
import { Text } from "../text";
import { Button, Chip } from "../ui";
import { SeasonPicker } from "./season-picker";

// Scenes (CORE-052): whole-Hearth setups you can swap between, by hand or on
// a schedule.
export function ScenesSheet({
  visible,
  onClose,
  state,
  ready,
  onSave,
  onUse,
  onRename,
  onSchedule,
  onRemove,
}: {
  visible: boolean;
  onClose: () => void;
  state: ScenesState;
  // The scenes have finished loading (saving before that could wipe them).
  ready: boolean;
  onSave: (name: string) => void;
  onUse: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onSchedule: (id: string, schedule: SceneSchedule | undefined) => void;
  onRemove: (id: string) => void;
}) {
  const [newName, setNewName] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const full = state.scenes.length >= MAX_SCENES;

  return (
    <BottomSheet visible={visible} onClose={onClose} header={<Text style={[ui.sectionTitle, { marginTop: 0 }]}>Scenes</Text>}>
      <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 24 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={ui.muted}>
          A scene is your whole Hearth — every page, the theme, wallpaper and ambience — saved under a name. Switch between
          them any time, or let one switch on by itself, like an Evening look after 5 PM. The one you leave is always kept.
        </Text>

        {state.scenes.map((scene) => (
          <SceneRow
            key={scene.id}
            scene={scene}
            active={state.active === scene.id}
            expanded={open === scene.id}
            onToggle={() => setOpen(open === scene.id ? null : scene.id)}
            onUse={() => onUse(scene.id)}
            onRename={(name) => onRename(scene.id, name)}
            onSchedule={(schedule) => onSchedule(scene.id, schedule)}
            onRemove={() => onRemove(scene.id)}
          />
        ))}

        {state.scenes.length && !state.active ? (
          <Text style={ui.muted}>The Hearth you're on isn't a saved scene yet — it will be kept as “My Hearth” if you switch.</Text>
        ) : null}

        <Text style={ui.label}>Save this look as a scene</Text>
        {full ? (
          <Text style={ui.muted}>That's the most scenes ({MAX_SCENES}). Remove one to save another.</Text>
        ) : (
          <>
            <TextInput
              style={ui.input}
              value={newName}
              onChangeText={setNewName}
              placeholder="e.g. Evening"
              placeholderTextColor={colors.muted}
              maxLength={20}
              returnKeyType="done"
            />
            <Button
              title="Save as a scene"
              icon="add"
              disabled={!ready}
              onPress={() => {
                onSave(newName);
                setNewName("");
              }}
            />
          </>
        )}
      </ScrollView>
    </BottomSheet>
  );
}

function SceneRow({
  scene,
  active,
  expanded,
  onToggle,
  onUse,
  onRename,
  onSchedule,
  onRemove,
}: {
  scene: ScenesState["scenes"][number];
  active: boolean;
  expanded: boolean;
  onToggle: () => void;
  onUse: () => void;
  onRename: (name: string) => void;
  onSchedule: (schedule: SceneSchedule | undefined) => void;
  onRemove: () => void;
}) {
  const [name, setName] = useState(scene.name);
  const schedule = scene.schedule;
  return (
    <View style={[ui.card, { gap: 10 }]}>
      <View style={[ui.row, { gap: 10 }]}>
        <View style={{ flex: 1 }}>
          <TextInput
            style={ui.input}
            value={name}
            onChangeText={setName}
            onEndEditing={() => (name.trim() ? name.trim() !== scene.name && onRename(name) : setName(scene.name))}
            maxLength={20}
            returnKeyType="done"
          />
        </View>
        {active ? (
          <Chip selected onPress={() => {}}>
            On now
          </Chip>
        ) : (
          <Chip onPress={onUse}>Use</Chip>
        )}
        <Tap onPress={onRemove} hitSlop={10} pressedScale={0.85} accessibilityLabel={`Remove ${scene.name}`}>
          <Icon name="trash" size={22} color={colors.error} />
        </Tap>
      </View>
      <Tap onPress={onToggle} style={[ui.row, { justifyContent: "space-between" }]} accessibilityRole="button">
        <View style={[ui.row, { gap: 8, flex: 1 }]}>
          <Icon name="clock" size={16} color={colors.bark} />
          <Text style={ui.muted} numberOfLines={1}>
            {scheduleWords(schedule, showInWords)}
          </Text>
        </View>
        <Text style={{ color: colors.bark, fontWeight: "700" }}>{expanded ? "Done" : "Schedule"}</Text>
      </Tap>
      {expanded ? (
        <View style={{ gap: 10 }}>
          <Text style={ui.label}>Time of day</Text>
          <View style={ui.chips}>
            <Chip selected={!schedule?.part} onPress={() => onSchedule({ ...schedule, part: undefined })}>
              Any time
            </Chip>
            {dayParts.map((d) => (
              <Chip key={d.part} selected={schedule?.part === d.part} onPress={() => onSchedule({ ...schedule, part: d.part as DayPart })}>
                {d.label}
              </Chip>
            ))}
          </View>
          <Text style={ui.muted}>
            {schedule?.part ? dayParts.find((d) => d.part === schedule.part)?.hours : "Pick a time of day, months, or both."}
          </Text>
          <Text style={ui.label}>Months</Text>
          <SeasonPicker value={schedule?.months} onChange={(months) => onSchedule({ ...schedule, months })} />
          <Text style={ui.muted}>
            It switches on when you open your Hearth during these times. Open another scene by hand and it stays put until the
            next time slot comes round.
          </Text>
        </View>
      ) : null}
    </View>
  );
}
