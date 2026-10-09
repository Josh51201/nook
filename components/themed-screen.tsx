import { StatusBar } from "expo-status-bar";
import { Fragment, useLayoutEffect, type ReactElement, type ReactNode } from "react";
import { useColorScheme } from "react-native";

import { buildHearthTheme, buildPalette, resolveThemeKey, type CustomTheme } from "../lib/custom-theme";
import { builtInThemes, hearthThemes, useHearthLayout } from "../lib/hearth";
import { applyFont, applyTextSize, applyTheme, palettes, useTheme, type ThemeKey } from "../lib/theme";

// The theme the whole app should wear right now (CORE-032): your Hearth's
// theme, or Dusk while the phone is in dark mode if "Go dark with my phone"
// is on.
export function effectiveTheme(chosen: ThemeKey, followPhone: boolean, phoneIsDark: boolean): ThemeKey {
  return followPhone && phoneIsDark ? "dusk" : chosen;
}

// Themes you've made (CORE-043) are added to the live lists under their own
// keys. A theme is only rebuilt when it has changed, so unchanged ones keep
// the same palette and don't re-dress the app.
const registered = new Map<string, string>();

function registerCustomThemes(themes: CustomTheme[]) {
  const keep = new Set<string>();
  for (const theme of themes) {
    keep.add(theme.id);
    const fingerprint = JSON.stringify(theme);
    if (registered.get(theme.id) === fingerprint && palettes[theme.id]) continue;
    registered.set(theme.id, fingerprint);
    palettes[theme.id] = buildPalette(theme);
    hearthThemes[theme.id] = buildHearthTheme(theme);
  }
  for (const id of [...registered.keys()]) {
    if (keep.has(id)) continue;
    registered.delete(id);
    delete palettes[id];
    delete hearthThemes[id];
  }
}

// Keeps the live theme in step with your settings and the phone. Lives just
// inside the AuthProvider so it can read your Hearth settings.
export function ThemeGate({ children }: { children: ReactNode }) {
  const { layout } = useHearthLayout();
  const scheme = useColorScheme();
  const { dark } = useTheme();
  // Registered while rendering (it's idempotent), so everything below already
  // knows your themes by the time it draws.
  registerCustomThemes(layout.customThemes);
  const key = resolveThemeKey({
    chosen: layout.theme,
    followPhone: layout.followPhone,
    phoneIsDark: scheme === "dark",
    seasonal: layout.seasonal,
    now: new Date(),
    known: new Set([...builtInThemes, ...layout.customThemes.map((t) => t.id)]),
  });

  const paletteVersion = palettes[key];
  useLayoutEffect(() => {
    applyTheme(key);
  }, [key, paletteVersion]);
  useLayoutEffect(() => {
    applyFont(layout.font);
  }, [layout.font]);
  useLayoutEffect(() => {
    applyTextSize(layout.textSize);
  }, [layout.textSize]);

  return (
    <>
      <StatusBar style={dark ? "light" : "dark"} />
      {children}
    </>
  );
}

// Navigators (route groups) that hold other screens: re-mounting one of
// those would reset where you are, so only leaf screens re-mount.
const NAVIGATORS = new Set(["(tabs)", "(auth)", "gift-nook", "potluck"]);

function ThemedScreen({ name, children }: { name: string; children: ReactElement }) {
  const { version } = useTheme();
  if (NAVIGATORS.has(name)) return children;
  // A theme change re-mounts the screen, so every color on it is fresh.
  return <Fragment key={version}>{children}</Fragment>;
}

// For a navigator's `screenLayout`.
export function themedScreenLayout({ children, route }: { children: ReactElement; route: { name: string } }) {
  return <ThemedScreen name={route.name}>{children}</ThemedScreen>;
}
