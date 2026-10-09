import { Redirect, Stack } from "expo-router";

import { nookStackOptions } from "../../components/nook-stack";
import { themedScreenLayout } from "../../components/themed-screen";
import { useAuth } from "../../lib/auth-context";
import { largeTitle, useTheme } from "../../lib/theme";

// The Getaway Nook (TRIP-001..014): trips, planned with the people going.
export default function GetawaysLayout() {
  const { session, isLoading } = useAuth();
  useTheme();

  if (!isLoading && !session) {
    return <Redirect href="/sign-in" />;
  }

  return (
    <Stack screenLayout={themedScreenLayout} screenOptions={nookStackOptions as never}>
      <Stack.Screen name="index" options={{ title: "Getaway Nook", ...largeTitle }} />
      <Stack.Screen name="[id]" options={{ title: "Getaway" }} />
      <Stack.Screen name="form" options={{ title: "A Getaway", presentation: "modal" }} />
      <Stack.Screen name="people" options={{ title: "Who's going" }} />
      <Stack.Screen name="packing" options={{ title: "Packing" }} />
      <Stack.Screen name="todos" options={{ title: "Before you go" }} />
      <Stack.Screen name="bookings" options={{ title: "Confirmations" }} />
      <Stack.Screen name="booking-form" options={{ title: "A confirmation", presentation: "modal" }} />
      <Stack.Screen name="itinerary" options={{ title: "Day by day" }} />
      <Stack.Screen name="plan-form" options={{ title: "A plan", presentation: "modal" }} />
      <Stack.Screen name="costs" options={{ title: "Costs" }} />
      <Stack.Screen name="cost-form" options={{ title: "A cost", presentation: "modal" }} />
      <Stack.Screen name="settings" options={{ title: "Getaway Nook Settings" }} />
    </Stack>
  );
}
