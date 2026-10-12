import { Redirect, Stack } from "expo-router";

import { nookStackOptions } from "../../components/nook-stack";
import { themedScreenLayout } from "../../components/themed-screen";
import { useAuth } from "../../lib/auth-context";
import { largeTitle, useTheme } from "../../lib/theme";

// The Grocery List Nook (GROC-001..009): your lists and your Home's shared ones.
export default function GroceriesLayout() {
  const { session, isLoading } = useAuth();
  useTheme();

  if (!isLoading && !session) {
    return <Redirect href="/sign-in" />;
  }

  return (
    <Stack screenLayout={themedScreenLayout} screenOptions={nookStackOptions as never}>
      <Stack.Screen name="index" options={{ title: "Grocery List Nook", ...largeTitle }} />
      <Stack.Screen name="[id]" options={{ title: "" }} />
      <Stack.Screen name="add" options={{ title: "Add to a grocery list", presentation: "modal" }} />
    </Stack>
  );
}
