import { Redirect, Stack } from "expo-router";

import { nookStackOptions } from "../../components/nook-stack";
import { themedScreenLayout } from "../../components/themed-screen";
import { useAuth } from "../../lib/auth-context";
import { largeTitle, useTheme } from "../../lib/theme";

// The Sitter Sheet Nook (SIT-001..008): one page for whoever's looking after
// things, shared by a link that runs out.
export default function SitterLayout() {
  const { session, isLoading } = useAuth();
  useTheme();

  if (!isLoading && !session) {
    return <Redirect href="/sign-in" />;
  }

  return (
    <Stack screenLayout={themedScreenLayout} screenOptions={nookStackOptions as never}>
      <Stack.Screen name="index" options={{ title: "Sitter Sheet Nook", ...largeTitle }} />
      <Stack.Screen name="edit" options={{ title: "The sheet", presentation: "modal" }} />
      <Stack.Screen name="link" options={{ title: "New link", presentation: "modal" }} />
      <Stack.Screen name="preview" options={{ title: "What they'll see" }} />
    </Stack>
  );
}
