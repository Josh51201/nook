import * as Caveat from "@expo-google-fonts/caveat";
import * as Fraunces from "@expo-google-fonts/fraunces";
import * as Nunito from "@expo-google-fonts/nunito";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ThemeGate, themedScreenLayout } from "../components/themed-screen";
import { HelpButton } from "../components/help-button";
import { OfflineNotice } from "../components/offline-notice";
import { TourProvider } from "../components/tour";
import { AuthProvider } from "../lib/auth-context";
import { configureReminders } from "../lib/reminders";
import { fontFiles } from "../lib/fonts";
import { colors, markFontsReady, stackScreenOptions, useTheme } from "../lib/theme";

// Let Hearth reminders show up even while Nook is open.
configureReminders();

// The font choices' files (CORE-035), by name.
const fontSources = Object.fromEntries(
  fontFiles.map((name) => [
    name,
    (Nunito as Record<string, unknown>)[name] ?? (Fraunces as Record<string, unknown>)[name] ?? (Caveat as Record<string, unknown>)[name],
  ])
) as Record<string, number>;

export default function RootLayout() {
  // Until these load (a moment at start-up), text uses the phone's own font.
  const [fontsLoaded] = useFonts(fontSources);
  useEffect(() => {
    if (fontsLoaded) markFontsReady();
  }, [fontsLoaded]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <SafeAreaProvider>
          <AuthProvider>
            <ThemeGate>
              {/* Up here so the tour can be replayed from any screen (Help). */}
              <TourProvider>
                <RootStack />
                <OfflineNotice />
              </TourProvider>
            </ThemeGate>
          </AuthProvider>
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

function RootStack() {
  // Re-render (and so re-style every header) when the theme changes.
  useTheme();
  const headerOptions = {
    ...stackScreenOptions,
    headerShown: true,
    headerBackTitle: "Hearth",
    // The "?" on every screen with a header (CORE-069).
    headerRight: () => <HelpButton />,
  };

  return (
    <Stack
      screenLayout={themedScreenLayout}
      screenOptions={{
        headerShown: false,
        animation: "ios_from_right",
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      {/* The Hearth, Burrows and Settings tabs (CORE-025). */}
      <Stack.Screen name="(tabs)" />
      {/* Nooks fade in over their tile as it grows to fill the screen (CORE-034). */}
      <Stack.Screen name="gift-nook" options={{ animation: "fade", animationDuration: 220 }} />
      <Stack.Screen name="potluck" options={{ animation: "fade", animationDuration: 220 }} />
      <Stack.Screen name="letterbox" options={{ animation: "fade", animationDuration: 220 }} />
      <Stack.Screen name="pets" options={{ animation: "fade", animationDuration: 220 }} />
      <Stack.Screen name="rhythms" options={{ animation: "fade", animationDuration: 220 }} />
      <Stack.Screen name="sitter" options={{ animation: "fade", animationDuration: 220 }} />
      <Stack.Screen name="recipes" options={{ animation: "fade", animationDuration: 220 }} />
      <Stack.Screen name="subscriptions" options={{ animation: "fade", animationDuration: 220 }} />
      <Stack.Screen name="getaways" options={{ animation: "fade", animationDuration: 220 }} />
      <Stack.Screen name="gatherings" options={{ animation: "fade", animationDuration: 220 }} />
      <Stack.Screen name="sickday" options={{ animation: "fade", animationDuration: 220 }} />
      <Stack.Screen name="burrow/[id]" options={{ ...headerOptions, title: "Burrow", headerBackTitle: "Back" }} />
      <Stack.Screen name="hollow/[id]" options={{ animation: "fade", animationDuration: 250 }} />
      <Stack.Screen name="onboarding" options={{ gestureEnabled: false, animation: "fade" }} />
      <Stack.Screen name="profile" options={{ ...headerOptions, title: "Your profile", headerBackTitle: "Settings" }} />
      <Stack.Screen name="home" options={{ ...headerOptions, title: "Your Home", headerBackTitle: "Burrows" }} />
      <Stack.Screen name="theme-editor" options={{ ...headerOptions, title: "Theme", headerBackTitle: "Settings" }} />
      <Stack.Screen name="theme-seasons" options={{ ...headerOptions, title: "Seasonal themes", headerBackTitle: "Settings" }} />
      <Stack.Screen name="notifications" options={{ ...headerOptions, title: "Notifications", headerBackTitle: "Settings" }} />
      <Stack.Screen name="inbox" options={{ ...headerOptions, title: "Inbox" }} />
      <Stack.Screen name="fridge" options={{ ...headerOptions, title: "Fridge", headerBackTitle: "Back" }} />
      <Stack.Screen name="fridge-note" options={{ ...headerOptions, title: "Stick something up", headerBackTitle: "Fridge" }} />
      <Stack.Screen name="market" options={{ ...headerOptions, title: "The Market" }} />
      <Stack.Screen name="help" options={{ ...headerOptions, title: "Help", headerRight: undefined, headerBackTitle: "Back" }} />
      <Stack.Screen name="widget/[id]" options={{ ...headerOptions, title: "Widget", headerBackTitle: "Back" }} />
      <Stack.Screen name="widget/view/[id]" options={{ ...headerOptions, title: "Widget" }} />
    </Stack>
  );
}
