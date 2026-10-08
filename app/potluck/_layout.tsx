import { Redirect, Stack } from "expo-router";

import { nookStackOptions } from "../../components/nook-stack";
import { themedScreenLayout } from "../../components/themed-screen";
import { useAuth } from "../../lib/auth-context";
import { largeTitle, useTheme } from "../../lib/theme";

// The Potluck Nook (POT-001..008). Each get-together in it is a Potluck.
export default function PotluckLayout() {
  const { session, isLoading } = useAuth();
  useTheme();

  if (!isLoading && !session) {
    return <Redirect href="/sign-in" />;
  }

  return (
    <Stack screenLayout={themedScreenLayout} screenOptions={nookStackOptions as never}>
      <Stack.Screen name="index" options={{ title: "Potluck Nook", ...largeTitle }} />
      <Stack.Screen name="[id]" options={{ title: "Potluck" }} />
      <Stack.Screen name="form" options={{ title: "Plan a Potluck", presentation: "modal" }} />
      <Stack.Screen name="dish-form" options={{ title: "Your dish", presentation: "modal" }} />
      <Stack.Screen name="settings" options={{ title: "Potluck Nook Settings" }} />
    </Stack>
  );
}
