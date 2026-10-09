import { View } from "react-native";

import { displayName, type Profile } from "../lib/gift-nook";
import { colors, ui } from "../lib/theme";
import { Avatar } from "./avatar";
import { DateField } from "./date-field";
import { Icon } from "./icon";
import { Tap } from "./motion";
import { Text } from "./text";
import { Button, Chip } from "./ui";

// Small pieces shared by the Getaway Nook's screens (TRIP-002..006).

// One line you tick off: a packing item or a before-you-go task.
export function CheckRow({
  text,
  sub,
  done,
  onToggle,
  onLongPress,
  warn,
}: {
  text: string;
  sub?: string | null;
  done: boolean;
  onToggle: () => void;
  onLongPress?: () => void;
  warn?: boolean;
}) {
  return (
    <Tap
      onPress={onToggle}
      onLongPress={onLongPress}
      style={[ui.row, { gap: 12, paddingVertical: 8 }]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      accessibilityLabel={text}
      accessibilityHint={onLongPress ? "Hold to change or remove it" : undefined}
    >
      <View
        style={{
          width: 26,
          height: 26,
          borderRadius: 13,
          borderWidth: 2,
          borderColor: done ? colors.bark : colors.muted,
          backgroundColor: done ? colors.bark : "transparent",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {done ? <Icon name="check" size={15} color={colors.onAccent} /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[{ fontSize: 16, color: colors.text }, done && { color: colors.muted, textDecorationLine: "line-through" }]}>{text}</Text>
        {sub ? <Text style={[ui.muted, { fontSize: 13 }, warn && !done && { color: colors.error, fontWeight: "600" }]}>{sub}</Text> : null}
      </View>
    </Tap>
  );
}

// Faces in a row: who's going.
export function Faces({ people, size = 30, max = 6 }: { people: Profile[]; size?: number; max?: number }) {
  return (
    <View style={[ui.row, { gap: -8 }]}>
      {people.slice(0, max).map((p) => (
        <View key={p.id} style={{ borderRadius: size, borderWidth: 2, borderColor: colors.surface }}>
          <Avatar name={displayName(p)} icon={p.avatar_icon} color={p.avatar_color} size={size} />
        </View>
      ))}
      {people.length > max ? <Text style={[ui.muted, { marginLeft: 12 }]}>+{people.length - max}</Text> : null}
    </View>
  );
}

// Pick people from a list (who's going, who paid, who it's split between).
export function PeopleChips({
  people,
  selected,
  onToggle,
  userId,
}: {
  people: Profile[];
  selected: string[];
  onToggle: (id: string) => void;
  userId?: string;
}) {
  return (
    <View style={ui.chips}>
      {people.map((p) => (
        <Chip key={p.id} icon={p.is_managed ? "kid" : "person"} selected={selected.includes(p.id)} onPress={() => onToggle(p.id)}>
          {p.id === userId ? "Me" : displayName(p)}
        </Chip>
      ))}
    </View>
  );
}

function timeAsDate(time: string) {
  const [h, m] = time.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function dateAsTime(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// A time that can be left off ("all day").
export function OptionalTime({ value, onChange, label = "Add a time" }: { value: string | null; onChange: (time: string | null) => void; label?: string }) {
  if (!value) {
    return <Button title={label} icon="clock" variant="secondary" onPress={() => onChange("12:00")} style={{ alignSelf: "flex-start" }} />;
  }
  return (
    <View style={[ui.row, { gap: 12 }]}>
      <DateField mode="time" value={timeAsDate(value)} onChange={(d) => onChange(dateAsTime(d))} />
      <Tap onPress={() => onChange(null)} hitSlop={8}>
        <Text style={ui.error}>No time</Text>
      </Tap>
    </View>
  );
}
