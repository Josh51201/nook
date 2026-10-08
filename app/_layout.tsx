import * as Fraunces from "@expo-google-fonts/fraunces";
import * as Nunito from "@expo-google-fonts/nunito";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ThemeGate, themedScreenLayout } from "../components/themed-screen";
import { AuthProvider } from "../lib/auth-context";
import { configureReminders } from "../lib/reminders";
import { fontFiles } from "../lib/fonts";
import { colors, markFontsReady, stackScreenOptions, useTheme } from "../lib/theme";

// Let Hearth reminders show up even while Nook is open.
configureReminders();

// The font choices' files (CORE-035), by name.
const fontSources = Object.fromEntries(
  fontFiles.map((name) => [name, (Nunito as Record<string, unknown>)[name] ?? (Fraunces as Record<string, unknown>)[name]])
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
              <RootStack />
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
  const headerOptions = { ...stackScreenOptions, headerShown: true, headerBackTitle: "Hearth" };

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
      <Stack.Screen name="burrow/[id]" options={{ ...headerOptions, title: "Burrow", headerBackTitle: "Back" }} />
      <Stack.Screen name="hollow/[id]" options={{ animation: "fade", animationDuration: 250 }} />
      <Stack.Screen name="onboarding" options={{ gestureEnabled: false, animation: "fade" }} />
      <Stack.Screen name="profile" options={{ ...headerOptions, title: "Your profile", headerBackTitle: "Settings" }} />
      <Stack.Screen name="home" options={{ ...headerOptions, title: "Your Home", headerBackTitle: "Burrows" }} />
      <Stack.Screen name="inbox" options={{ ...headerOptions, title: "Inbox" }} />
      <Stack.Screen name="market" options={{ ...headerOptions, title: "The Market" }} />
      <Stack.Screen name="widget/[id]" options={{ ...headerOptions, title: "Widget", headerBackTitle: "Back" }} />
      <Stack.Screen name="widget/view/[id]" options={{ ...headerOptions, title: "Widget" }} />
    </Stack>
  );
}
