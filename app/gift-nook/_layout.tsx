import { Redirect, Stack, useRouter } from "expo-router";
import { Text, TouchableOpacity } from "react-native";

import { useAuth } from "../../lib/auth-context";
import { colors } from "../../lib/theme";

export default function GiftNookLayout() {
  const router = useRouter();
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
      <Stack.Screen
        name="index"
        options={{
          title: "Gift Nook",
          // This is the first screen of the Gift Nook's own stack, so there's
          // no automatic back button — add one that leaves the Nook.
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.navigate("/hearth")} hitSlop={12}>
              <Text style={{ color: colors.bark, fontSize: 17 }}>‹ Hearth</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <Stack.Screen name="settings" options={{ title: "Gift Nook Settings" }} />
      <Stack.Screen name="notifications" options={{ title: "Inbox" }} />
      <Stack.Screen name="my-tucks" options={{ title: "Your tucks" }} />
      <Stack.Screen name="received" options={{ title: "What did you get?" }} />
      <Stack.Screen name="managed-form" options={{ title: "A kid's Wishbook", presentation: "modal" }} />
      <Stack.Screen name="managed/[id]" options={{ title: "Manage" }} />
      <Stack.Screen name="tuck/[id]" options={{ title: "Your tuck", presentation: "modal" }} />
      <Stack.Screen name="wishbook" options={{ title: "My Wishbook" }} />
      <Stack.Screen name="gift-form" options={{ title: "Gift", presentation: "modal" }} />
      <Stack.Screen name="gathering-form" options={{ title: "New Gathering", presentation: "modal" }} />
      <Stack.Screen name="gathering-picks" options={{ title: "Your gifts here" }} />
      <Stack.Screen name="burrow/[id]" options={{ title: "Burrow" }} />
      <Stack.Screen name="member/[id]" options={{ title: "Wishbook" }} />
      <Stack.Screen name="gathering/[id]" options={{ title: "Gathering" }} />
    </Stack>
  );
}
