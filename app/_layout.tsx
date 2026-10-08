import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider } from "../lib/auth-context";
import { configureReminders } from "../lib/reminders";
import { stackScreenOptions } from "../lib/theme";

// Let Hearth reminders show up even while Nook is open.
configureReminders();

const headerOptions = { ...stackScreenOptions, headerShown: true, headerBackTitle: "Hearth" };

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <SafeAreaProvider>
          <AuthProvider>
            <Stack screenOptions={{ headerShown: false, animation: "ios_from_right" }}>
              {/* The Hearth, Burrows and Settings tabs (CORE-025). */}
              <Stack.Screen name="(tabs)" />
              <Stack.Screen
                name="burrow/[id]"
                options={{ ...headerOptions, title: "Burrow", headerBackTitle: "Back" }}
              />
              <Stack.Screen name="hollow/[id]" options={{ animation: "fade", animationDuration: 250 }} />
              <Stack.Screen name="onboarding" options={{ gestureEnabled: false, animation: "fade" }} />
              <Stack.Screen
                name="profile"
                options={{ ...headerOptions, title: "Your profile", headerBackTitle: "Settings" }}
              />
              <Stack.Screen name="inbox" options={{ ...headerOptions, title: "Inbox" }} />
              <Stack.Screen
                name="market"
                options={{ ...headerOptions, title: "The Market" }}
              />
              <Stack.Screen
                name="widget/[id]"
                options={{ ...headerOptions, title: "Widget" }}
              />
            </Stack>
          </AuthProvider>
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
