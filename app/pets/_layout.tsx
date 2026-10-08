import { Redirect, Stack } from "expo-router";

import { nookStackOptions } from "../../components/nook-stack";
import { themedScreenLayout } from "../../components/themed-screen";
import { useAuth } from "../../lib/auth-context";
import { largeTitle, useTheme } from "../../lib/theme";

// The Pet Care Nook (PET-001..007): the pets in your Home, and any you help with.
export default function PetsLayout() {
  const { session, isLoading } = useAuth();
  useTheme();

  if (!isLoading && !session) {
    return <Redirect href="/sign-in" />;
  }

  return (
    <Stack screenLayout={themedScreenLayout} screenOptions={nookStackOptions as never}>
      <Stack.Screen name="index" options={{ title: "Pet Care Nook", ...largeTitle }} />
      <Stack.Screen name="[id]" options={{ title: "Pet" }} />
      <Stack.Screen name="form" options={{ title: "A pet", presentation: "modal" }} />
      <Stack.Screen name="health-form" options={{ title: "Vet, vaccines, meds", presentation: "modal" }} />
      <Stack.Screen name="helpers" options={{ title: "Add a helper", presentation: "modal" }} />
      <Stack.Screen name="settings" options={{ title: "Pet Care Nook Settings" }} />
    </Stack>
  );
}
