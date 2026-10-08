import { View } from "react-native";

import { tap } from "../../lib/feedback";
import { monthNames, showInWords, type ShowIn } from "../../lib/widget-extras";
import { ui } from "../../lib/theme";
import { Text } from "../text";
import { Chip } from "../ui";

// "Show it": always, or only in some months (CORE-053) — a gift countdown
// from November to December, say. It can wrap round the new year (November to
// January). Out of season it's hidden on the Hearth, but still there while
// you're editing (dimmed), so you can find it again.
export function SeasonPicker({ value, onChange }: { value: ShowIn | undefined; onChange: (next: ShowIn | undefined) => void }) {
  return (
    <View style={{ gap: 10 }}>
      <View style={ui.chips}>
        <Chip icon="sun" selected={!value} onPress={() => (tap(), onChange(undefined))}>
          Always
        </Chip>
        <Chip icon="calendar" selected={Boolean(value)} onPress={() => (tap(), onChange(value ?? { from: new Date().getMonth() + 1, to: new Date().getMonth() + 1 }))}>
          Only some months
        </Chip>
      </View>
      {value ? (
        <>
          <Text style={ui.label}>From</Text>
          <View style={ui.chips}>
            {monthNames.map((name, i) => (
              <Chip key={name} selected={value.from === i + 1} onPress={() => onChange({ ...value, from: i + 1 })}>
                {name}
              </Chip>
            ))}
          </View>
          <Text style={ui.label}>Until</Text>
          <View style={ui.chips}>
            {monthNames.map((name, i) => (
              <Chip key={name} selected={value.to === i + 1} onPress={() => onChange({ ...value, to: i + 1 })}>
                {name}
              </Chip>
            ))}
          </View>
          <Text style={ui.muted}>Shown {showInWords(value).toLowerCase()}, every year.</Text>
        </>
      ) : null}
    </View>
  );
}
