import { Alert, Switch, View } from "react-native";

import { Icon, type IconName } from "../components/icon";
import { LoadingScreen } from "../components/motion";
import { NookScroll } from "../components/nook-scroll";
import { Text } from "../components/text";
import { Chip } from "../components/ui";
import { seasonalThemeFor } from "../lib/custom-theme";
import { seasonOf, type Season } from "../lib/decor";
import { tap } from "../lib/feedback";
import { builtInThemes, hearthThemes, useHearthLayout } from "../lib/hearth";
import { colors, ui } from "../lib/theme";

const seasons: { key: Season; label: string; icon: IconName }[] = [
  { key: "winter", label: "Winter", icon: "christmas" },
  { key: "spring", label: "Spring", icon: "flower" },
  { key: "summer", label: "Summer", icon: "sun" },
  { key: "autumn", label: "Autumn", icon: "leaf" },
];

// Themes that change with the seasons (CORE-043): pick a theme for each time
// of year, or leave a season on your usual one. Winter is December to
// February, spring March to May, summer June to August, autumn September
// to November.
export default function ThemeSeasons() {
  const { layout, save, isLoading } = useHearthLayout();
  if (isLoading) return <LoadingScreen />;

  const themes = [
    ...builtInThemes.map((key) => ({ key: key as string, label: hearthThemes[key].label })),
    ...layout.customThemes.map((t) => ({ key: t.id, label: t.name })),
  ];
  const now = seasonOf(new Date());

  function change(changes: Partial<typeof layout.seasonal>) {
    tap();
    save({ seasonal: { ...layout.seasonal, ...changes } }).catch((error: Error) => Alert.alert("Couldn't save that", error.message));
  }

  return (
    <NookScroll>
      <View style={[ui.card, ui.row, { gap: 12 }]}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={ui.cardTitle}>Change with the seasons</Text>
          <Text style={ui.muted}>
            Your Hearth, and the whole app, dresses for the time of year. Right now it's {now}
            {seasonalThemeFor(layout.seasonal, new Date()) ? "." : layout.seasonal.enabled ? " — nothing picked for it, so your usual theme." : "."}
          </Text>
        </View>
        <Switch
          value={layout.seasonal.enabled}
          onValueChange={(enabled) => change({ enabled })}
          trackColor={{ true: colors.bark }}
        />
      </View>

      {layout.seasonal.enabled
        ? seasons.map((season) => (
            <View key={season.key} style={[ui.card, { gap: 10 }]}>
              <View style={[ui.row, { gap: 8 }]}>
                <Icon name={season.icon} size={18} color={colors.bark} />
                <Text style={ui.cardTitle}>
                  {season.label}
                  {season.key === now ? " · now" : ""}
                </Text>
              </View>
              <View style={ui.chips}>
                <Chip selected={!layout.seasonal[season.key]} onPress={() => change({ [season.key]: undefined })}>
                  My usual theme
                </Chip>
                {themes.map((t) => (
                  <Chip key={t.key} selected={layout.seasonal[season.key] === t.key} onPress={() => change({ [season.key]: t.key })}>
                    {t.label}
                  </Chip>
                ))}
              </View>
            </View>
          ))
        : null}
      <Text style={ui.muted}>
        Make your own seasonal themes in Settings → Theme → Make your own. The phone's dark mode still wins if “Go dark with my phone” is on.
      </Text>
    </NookScroll>
  );
}
