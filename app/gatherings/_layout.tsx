import { Redirect, Stack } from "expo-router";

import { nookStackOptions } from "../../components/nook-stack";
import { themedScreenLayout } from "../../components/themed-screen";
import { useAuth } from "../../lib/auth-context";
import { largeTitle, useTheme } from "../../lib/theme";

// The Gathering Nook (GATH-001..): every get-together you're invited to.
export default function GatheringsLayout() {
  const { session, isLoading } = useAuth();
  useTheme();

  if (!isLoading && !session) {
    return <Redirect href="/sign-in" />;
  }

  return (
    <Stack screenLayout={themedScreenLayout} screenOptions={nookStackOptions as never}>
      <Stack.Screen name="index" options={{ title: "Gathering Nook", ...largeTitle }} />
      <Stack.Screen name="[id]" options={{ title: "Gathering" }} />
      <Stack.Screen name="form" options={{ title: "A Gathering", presentation: "modal" }} />
      <Stack.Screen name="settings" options={{ title: "Gathering Nook Settings" }} />
    </Stack>
  );
}
