import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider } from "../lib/auth-context";
import { colors } from "../lib/theme";

const headerOptions = {
  headerShown: true,
  headerTintColor: colors.bark,
  headerBackTitle: "Hearth",
};

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="settings" options={{ ...headerOptions, title: "Settings" }} />
            <Stack.Screen name="market" options={{ ...headerOptions, title: "The Market" }} />
          </Stack>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
