import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider } from "../lib/auth-context";
import { colors } from "../lib/theme";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen
            name="settings"
            options={{
              headerShown: true,
              title: "Settings",
              headerTintColor: colors.bark,
              headerBackTitle: "Hearth",
            }}
          />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
