import { Redirect, Stack } from "expo-router";

import { useAuth } from "../../lib/auth-context";
import { colors } from "../../lib/theme";

export default function GiftNookLayout() {
  const { session, isLoading } = useAuth();

  if (!isLoading && !session) {
    return <Redirect href="/sign-in" />;
  }

  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.bark,
        headerStyle: { backgroundColor: colors.white },
        headerBackTitle: "Back",
        contentStyle: { backgroundColor: colors.white },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Gift Nook" }} />
      <Stack.Screen name="wishbook" options={{ title: "My Wishbook" }} />
      <Stack.Screen name="gift-form" options={{ title: "Gift", presentation: "modal" }} />
      <Stack.Screen name="gathering-form" options={{ title: "New Gathering", presentation: "modal" }} />
      <Stack.Screen name="burrow/[id]" options={{ title: "Burrow" }} />
      <Stack.Screen name="member/[id]" options={{ title: "Wishbook" }} />
      <Stack.Screen name="gathering/[id]" options={{ title: "Gathering" }} />
    </Stack>
  );
}
