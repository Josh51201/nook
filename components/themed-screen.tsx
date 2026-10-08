import { StatusBar } from "expo-status-bar";
import { Fragment, useLayoutEffect, type ReactElement, type ReactNode } from "react";
import { useColorScheme } from "react-native";

import { useHearthLayout } from "../lib/hearth";
import { applyTheme, useTheme, type ThemeKey } from "../lib/theme";

// The theme the whole app should wear right now (CORE-032): your Hearth's
// theme, or Dusk while the phone is in dark mode if "Go dark with my phone"
// is on.
export function effectiveTheme(chosen: ThemeKey, followPhone: boolean, phoneIsDark: boolean): ThemeKey {
  return followPhone && phoneIsDark ? "dusk" : chosen;
}

// Keeps the live theme in step with your settings and the phone. Lives just
// inside the AuthProvider so it can read your Hearth settings.
export function ThemeGate({ children }: { children: ReactNode }) {
  const { layout } = useHearthLayout();
  const scheme = useColorScheme();
  const { dark } = useTheme();
  const key = effectiveTheme(layout.theme, layout.followPhone, scheme === "dark");

  useLayoutEffect(() => {
    applyTheme(key);
  }, [key]);

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
