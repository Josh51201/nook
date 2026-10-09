import { Redirect, Stack } from "expo-router";

import { nookStackOptions } from "../../components/nook-stack";
import { themedScreenLayout } from "../../components/themed-screen";
import { useAuth } from "../../lib/auth-context";
import { largeTitle, useTheme } from "../../lib/theme";

// The Subscriptions Nook (SUB-001..012): every recurring charge in your Home.
export default function SubscriptionsLayout() {
  const { session, isLoading } = useAuth();
  useTheme();

  if (!isLoading && !session) {
    return <Redirect href="/sign-in" />;
  }

  return (
    <Stack screenLayout={themedScreenLayout} screenOptions={nookStackOptions as never}>
      <Stack.Screen name="index" options={{ title: "Subscriptions Nook", ...largeTitle }} />
      <Stack.Screen name="[id]" options={{ title: "Subscription" }} />
      <Stack.Screen name="form" options={{ title: "A subscription", presentation: "modal" }} />
      <Stack.Screen name="settings" options={{ title: "Subscriptions Nook Settings" }} />
    </Stack>
  );
}
