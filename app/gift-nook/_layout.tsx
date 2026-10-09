import { Redirect, Stack } from "expo-router";

import { nookStackOptions } from "../../components/nook-stack";
import { themedScreenLayout } from "../../components/themed-screen";
import { useAuth } from "../../lib/auth-context";
import { largeTitle, useTheme } from "../../lib/theme";

export default function GiftNookLayout() {
  const { session, isLoading } = useAuth();
  useTheme();

  if (!isLoading && !session) {
    return <Redirect href="/sign-in" />;
  }

  return (
    <Stack screenLayout={themedScreenLayout} screenOptions={nookStackOptions as never}>
      <Stack.Screen
        name="index"
        options={{
          title: "Gift Nook",
          ...largeTitle,
        }}
      />
      <Stack.Screen name="settings" options={{ title: "Gift Nook Settings" }} />
      <Stack.Screen name="my-tucks" options={{ title: "Your tucks", ...largeTitle }} />
      <Stack.Screen name="received" options={{ title: "What did you get?" }} />
      <Stack.Screen name="managed-form" options={{ title: "Add a kid", presentation: "modal" }} />
      <Stack.Screen name="managed/[id]" options={{ title: "Manage" }} />
      <Stack.Screen name="tuck/[id]" options={{ title: "Your tuck", presentation: "modal" }} />
      <Stack.Screen name="stash" options={{ title: "Idea Stash", ...largeTitle }} />
      <Stack.Screen name="stash-form" options={{ title: "An idea", presentation: "modal" }} />
      <Stack.Screen name="wishbook" options={{ title: "My Wishbook", ...largeTitle }} />
      <Stack.Screen name="gift-form" options={{ title: "Gift", presentation: "modal" }} />
      <Stack.Screen name="gathering-form" options={{ title: "New Gathering", presentation: "modal" }} />
      <Stack.Screen name="gathering-picks" options={{ title: "Your gifts here" }} />
      <Stack.Screen name="burrow/[id]" options={{ title: "Burrow" }} />
      <Stack.Screen name="member/[id]" options={{ title: "Wishbook" }} />
      <Stack.Screen name="gathering/[id]" options={{ title: "Gathering" }} />
    </Stack>
  );
}
