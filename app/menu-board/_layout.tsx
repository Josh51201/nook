import { Redirect, Stack } from "expo-router";

import { nookStackOptions } from "../../components/nook-stack";
import { themedScreenLayout } from "../../components/themed-screen";
import { useAuth } from "../../lib/auth-context";
import { largeTitle, useTheme } from "../../lib/theme";

// The Menu Board Nook (MENU-001..010): the Home's menu for the week.
export default function MenuBoardLayout() {
  const { session, isLoading } = useAuth();
  useTheme();

  if (!isLoading && !session) {
    return <Redirect href="/sign-in" />;
  }

  return (
    <Stack screenLayout={themedScreenLayout} screenOptions={nookStackOptions as never}>
      <Stack.Screen name="index" options={{ title: "Menu Board Nook", ...largeTitle }} />
      <Stack.Screen name="meal" options={{ title: "A meal" }} />
      <Stack.Screen name="settings" options={{ title: "Menu Board Settings" }} />
    </Stack>
  );
}
