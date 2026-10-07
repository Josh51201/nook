import { Redirect, Stack, useRouter } from "expo-router";
import { Text } from "react-native";

import { Icon } from "../../components/icon";
import { Tap } from "../../components/motion";
import { useAuth } from "../../lib/auth-context";
import { colors, largeTitle, stackScreenOptions, ui } from "../../lib/theme";

// "Back to the Hearth" for any Gift Nook screen opened straight from the Hearth
// (a widget, say), where it's the first screen in the stack and so has no
// back button of its own.
function HearthBack() {
  const router = useRouter();
  return (
    <Tap
      onPress={() => (router.canGoBack() ? router.back() : router.replace("/hearth"))}
      hitSlop={12}
      pressedScale={0.9}
      style={[ui.row, { gap: 5 }]}
      accessibilityLabel="Back to the Hearth"
    >
      <Icon name="hearth" size={18} />
      <Text style={{ color: colors.bark, fontSize: 17, fontWeight: "500" }}>Hearth</Text>
    </Tap>
  );
}

export default function GiftNookLayout() {
  const { session, isLoading } = useAuth();

  if (!isLoading && !session) {
    return <Redirect href="/sign-in" />;
  }

  return (
    <Stack
      screenOptions={({ navigation }) => ({
        ...stackScreenOptions,
        // First screen in this stack? Offer the way back to the Hearth.
        headerLeft: navigation.getState().routes.length <= 1 ? () => <HearthBack /> : undefined,
      })}
    >
      <Stack.Screen
        name="index"
        options={{
          title: "Gift Nook",
          ...largeTitle,
        }}
      />
      <Stack.Screen name="settings" options={{ title: "Gift Nook Settings" }} />
      <Stack.Screen name="notifications" options={{ title: "Inbox", ...largeTitle }} />
      <Stack.Screen name="my-tucks" options={{ title: "Your tucks", ...largeTitle }} />
      <Stack.Screen name="received" options={{ title: "What did you get?" }} />
      <Stack.Screen name="managed-form" options={{ title: "A kid's Wishbook", presentation: "modal" }} />
      <Stack.Screen name="managed/[id]" options={{ title: "Manage" }} />
      <Stack.Screen name="tuck/[id]" options={{ title: "Your tuck", presentation: "modal" }} />
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
