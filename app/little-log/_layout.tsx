import { Redirect, Stack } from "expo-router";

import { nookStackOptions } from "../../components/nook-stack";
import { themedScreenLayout } from "../../components/themed-screen";
import { useAuth } from "../../lib/auth-context";
import { largeTitle, useTheme } from "../../lib/theme";

// The Little Log Nook (LOG-001..010): keep track of anything with a date.
export default function LittleLogLayout() {
  const { session, isLoading } = useAuth();
  useTheme();

  if (!isLoading && !session) {
    return <Redirect href="/sign-in" />;
  }

  return (
    <Stack screenLayout={themedScreenLayout} screenOptions={nookStackOptions as never}>
      <Stack.Screen name="index" options={{ title: "Little Log", ...largeTitle }} />
      <Stack.Screen name="[id]" options={{ title: "Log" }} />
      <Stack.Screen name="form" options={{ title: "A log", presentation: "modal" }} />
      <Stack.Screen name="entry" options={{ title: "Log it", presentation: "modal" }} />
    </Stack>
  );
}
