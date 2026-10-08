import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, useColorScheme, View } from "react-native";

import { ThemeSwatches } from "../components/hearth/theme-swatches";
import { Icon } from "../components/icon";
import { LoadingScreen, Tap } from "../components/motion";
import { NookScroll } from "../components/nook-scroll";
import { Text, TextInput } from "../components/text";
import { Button, Chip, SectionHeader } from "../components/ui";
import {
  MAX_CUSTOM_THEMES,
  buildPalette,
  newThemeId,
  normalizeCustomTheme,
  themeDefaults,
  type CustomTheme,
} from "../lib/custom-theme";
import { tap } from "../lib/feedback";
import { useHearthLayout } from "../lib/hearth";
import { colors, ui } from "../lib/theme";

// Make your own theme (CORE-043): a name, light or dark, a background color
// and an accent color. Everything else is worked out from those two so the
// whole app stays readable. The preview below is drawn in the colors being
// made, not the current theme's.
export default function ThemeEditor() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { layout, save, isLoading } = useHearthLayout();
  const phoneIsDark = useColorScheme() === "dark";
  const existing = layout.customThemes.find((t) => t.id === id);

  const [draft, setDraft] = useState<CustomTheme | null>(null);
  const [saving, setSaving] = useState(false);

  if (isLoading) return <LoadingScreen />;
  if (id && !existing && !draft) {
    return (
      <NookScroll>
        <Text style={ui.muted}>That theme isn't here any more.</Text>
      </NookScroll>
    );
  }

  const theme: CustomTheme =
    draft ??
    existing ?? {
      id: newThemeId(),
      name: "",
      dark: false,
      background: themeDefaults.light.background,
      accent: themeDefaults.light.accent,
    };
  const palette = buildPalette(theme);
  const isNew = !existing;

  function change(changes: Partial<CustomTheme>) {
    setDraft({ ...theme, ...changes });
  }

  function setMode(dark: boolean) {
    if (dark === theme.dark) return;
    tap();
    const defaults = dark ? themeDefaults.dark : themeDefaults.light;
    change({ dark, background: defaults.background, accent: defaults.accent });
  }

  async function saveTheme() {
    const clean = normalizeCustomTheme({ ...theme, name: theme.name.trim() });
    if (!theme.name.trim()) return Alert.alert("Give it a name", "Like “Autumn evening”.");
    if (isNew && layout.customThemes.length >= MAX_CUSTOM_THEMES) {
      return Alert.alert("That's a lot of themes!", `You can keep up to ${MAX_CUSTOM_THEMES}. Delete one to make room.`);
    }
    setSaving(true);
    const others = layout.customThemes.filter((t) => t.id !== clean.id);
    try {
      await save({
        customThemes: [...others, clean],
        theme: clean.id,
        // If the phone's dark mode was overriding it, stop following the phone
        // so the new theme shows straight away.
        ...(phoneIsDark && layout.followPhone && !clean.dark ? { followPhone: false } : {}),
      });
      tap("success");
      router.back();
    } catch (error) {
      setSaving(false);
      Alert.alert("Couldn't save that", (error as Error).message);
    }
  }

  function confirmDelete() {
    Alert.alert(`Delete “${existing!.name}”?`, "Anywhere it's used goes back to your usual theme.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const cleaned = Object.fromEntries(
            (["winter", "spring", "summer", "autumn"] as const).map((s) => [s, layout.seasonal[s] === existing!.id ? undefined : layout.seasonal[s]])
          );
          try {
            await save({
              customThemes: layout.customThemes.filter((t) => t.id !== existing!.id),
              theme: layout.theme === existing!.id ? "hearth" : layout.theme,
              seasonal: { ...layout.seasonal, ...cleaned },
            });
            router.back();
          } catch (error) {
            Alert.alert("Couldn't delete it", (error as Error).message);
          }
        },
      },
    ]);
  }

  return (
    <NookScroll>
      <Stack.Screen
        options={{
          title: isNew ? "New theme" : "Change theme",
          headerRight: () => (
            <Tap onPress={saveTheme} disabled={saving} hitSlop={10}>
              <Text style={{ color: colors.bark, fontSize: 17, fontWeight: "700" }}>Save</Text>
            </Tap>
          ),
        }}
      />

      {/* A little Hearth in the colors being made. */}
      <View style={{ backgroundColor: palette.background, borderRadius: 24, padding: 16, gap: 12, borderWidth: 1, borderColor: palette.border }}>
        <Text style={{ color: palette.text, fontSize: 22, fontWeight: "800" }} numberOfLines={1}>
          {theme.name.trim() || "My theme"}
        </Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1, backgroundColor: palette.surface, borderRadius: 18, padding: 14, gap: 4, borderWidth: 1, borderColor: palette.border }}>
            <Icon name="flame" size={22} color={palette.bark} />
            <Text style={{ color: palette.text, fontWeight: "700" }}>Gift Nook</Text>
            <Text style={{ color: palette.muted, fontSize: 13 }}>Christmas in 12 days</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: palette.barkSoft, borderRadius: 18, padding: 14, gap: 4 }}>
            <Icon name="leaf" size={22} color={palette.bark} />
            <Text style={{ color: palette.text, fontWeight: "700" }}>Pet Care</Text>
            <Text style={{ color: palette.muted, fontSize: 13 }}>Everyone's fed</Text>
          </View>
        </View>
        <View style={{ backgroundColor: palette.bark, borderRadius: 14, paddingVertical: 12, alignItems: "center" }}>
          <Text style={{ color: palette.onAccent, fontWeight: "700" }}>Add to your Hearth</Text>
        </View>
      </View>

      <Text style={ui.label}>Name</Text>
      <TextInput
        style={ui.input}
        value={theme.name}
        onChangeText={(name) => change({ name })}
        placeholder="e.g. Autumn evening"
        placeholderTextColor={colors.muted}
        maxLength={24}
      />

      <Text style={ui.label}>Light or dark</Text>
      <View style={ui.chips}>
        <Chip icon="sun" selected={!theme.dark} onPress={() => setMode(false)}>
          Light
        </Chip>
        <Chip icon="moon" selected={theme.dark} onPress={() => setMode(true)}>
          Dark
        </Chip>
      </View>

      <SectionHeader title="Background" icon="paint" />
      <ThemeSwatches dark={theme.dark} mode="background" value={palette.background} onChange={(background) => change({ background })} />

      <SectionHeader title="Accent" icon="palette" />
      <ThemeSwatches dark={theme.dark} mode="accent" value={palette.bark} onChange={(accent) => change({ accent })} />
      <Text style={ui.muted}>
        The accent is for buttons, icons and highlights. Text, cards and shadows are chosen for you so everything stays easy to read.
      </Text>

      <Button title="Save and wear it" icon="check" onPress={saveTheme} loading={saving} style={{ marginTop: 6 }} />
      {existing ? <Button title="Delete this theme" icon="trash" variant="danger" onPress={confirmDelete} /> : null}
    </NookScroll>
  );
}
