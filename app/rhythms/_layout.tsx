import { Redirect, Stack } from "expo-router";

import { nookStackOptions } from "../../components/nook-stack";
import { themedScreenLayout } from "../../components/themed-screen";
import { useAuth } from "../../lib/auth-context";
import { largeTitle, useTheme } from "../../lib/theme";

// The Rhythms Nook (RHY-001..008): the chores your Home does every season or year.
export default function RhythmsLayout() {
  const { session, isLoading } = useAuth();
  useTheme();

  if (!isLoading && !session) {
    return <Redirect href="/sign-in" />;
  }

  return (
    <Stack screenLayout={themedScreenLayout} screenOptions={nookStackOptions as never}>
      <Stack.Screen name="index" options={{ title: "Rhythms Nook", ...largeTitle }} />
      <Stack.Screen name="[id]" options={{ title: "Rhythm" }} />
      <Stack.Screen name="form" options={{ title: "A rhythm", presentation: "modal" }} />
      <Stack.Screen name="starter" options={{ title: "Starter list", presentation: "modal" }} />
      <Stack.Screen name="settings" options={{ title: "Rhythms Nook Settings" }} />
    </Stack>
  );
}
