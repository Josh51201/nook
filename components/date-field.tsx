import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { Platform, Text, View } from "react-native";

import { formatDate } from "../lib/gift-nook";
import { colors, ui } from "../lib/theme";
import { Icon } from "./icon";
import { Tap } from "./motion";

// A date/time field that's readable in dark mode and works the same way on
// Android (tap → system dialog) as iOS (compact inline picker).
export function DateField({
  mode,
  value,
  onChange,
  maximumDate,
}: {
  mode: "date" | "time" | "datetime";
  value: Date;
  onChange: (date: Date) => void;
  maximumDate?: Date; // e.g. today, for a birthday
}) {
  if (Platform.OS === "ios") {
    return (
      <View style={{ alignItems: "flex-start" }}>
        <DateTimePicker
          value={value}
          mode={mode}
          display="compact"
          maximumDate={maximumDate}
          themeVariant="light"
          accentColor={colors.bark}
          onChange={(_e, picked) => picked && onChange(picked)}
        />
      </View>
    );
  }
  const label =
    mode === "time"
      ? value.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
      : mode === "date"
        ? formatDate(value.toISOString())
        : value.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  function open() {
    const pickTime = (base: Date) =>
      DateTimePickerAndroid.open({
        value: base,
        mode: "time",
        onChange: (_e, picked) => picked && onChange(picked),
      });
    if (mode === "time") return pickTime(value);
    DateTimePickerAndroid.open({
      value,
      mode: "date",
      maximumDate,
      onChange: (_e, picked) => {
        if (!picked) return;
        if (mode === "datetime") {
          picked.setHours(value.getHours(), value.getMinutes());
          pickTime(picked);
        } else onChange(picked);
      },
    });
  }
  return (
    <Tap onPress={open} style={[ui.input, ui.row]}>
      <Icon name="calendar" size={16} />
      <Text style={{ color: colors.text, fontSize: 16 }}>{label}</Text>
    </Tap>
  );
}
