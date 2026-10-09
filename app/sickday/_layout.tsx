import { Redirect, Stack } from "expo-router";

import { nookStackOptions } from "../../components/nook-stack";
import { themedScreenLayout } from "../../components/themed-screen";
import { useAuth } from "../../lib/auth-context";
import { largeTitle, useTheme } from "../../lib/theme";

// The Sick Day Nook (SICK-001..014): temperatures, symptoms and doses while
// someone in the Home is sick.
export default function SickDayLayout() {
  const { session, isLoading } = useAuth();
  useTheme();

  if (!isLoading && !session) {
    return <Redirect href="/sign-in" />;
  }

  return (
    <Stack screenLayout={themedScreenLayout} screenOptions={nookStackOptions as never}>
      <Stack.Screen name="index" options={{ title: "Sick Day Nook", ...largeTitle }} />
      <Stack.Screen name="[id]" options={{ title: "Sick" }} />
      <Stack.Screen name="start" options={{ title: "Someone's sick", presentation: "modal" }} />
      <Stack.Screen name="log" options={{ title: "Log", presentation: "modal" }} />
      <Stack.Screen name="dose" options={{ title: "Give medicine", presentation: "modal" }} />
      <Stack.Screen name="cabinet" options={{ title: "Medicine cabinet" }} />
      <Stack.Screen name="medicine" options={{ title: "A medicine", presentation: "modal" }} />
      <Stack.Screen name="helpers" options={{ title: "Add a helper" }} />
      <Stack.Screen name="summary" options={{ title: "For the doctor" }} />
      <Stack.Screen name="history" options={{ title: "Past sick days" }} />
      <Stack.Screen name="settings" options={{ title: "Sick Day Nook Settings" }} />
    </Stack>
  );
}
