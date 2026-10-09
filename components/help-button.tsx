import { usePathname, useRouter } from "expo-router";
import type { ReactNode } from "react";
import { Alert, View } from "react-native";

import { helpFor } from "../lib/help";
import { tap } from "../lib/feedback";
import { Icon } from "./icon";
import { Tap } from "./motion";
import { useTour } from "./tour";

// The "?" in a screen's header (CORE-069): a plain-words note about the
// screen you're on, with a way to the Help page or to replay the tour. It's
// a phone alert, so it's big, clear and works with the phone's own text size.
// `color` is for screens with their own look (the Hearth).
export function HelpButton({ color }: { color?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const tour = useTour();

  function show() {
    tap();
    const topic = helpFor(pathname);
    Alert.alert(topic.title, topic.body, [
      { text: "More help", onPress: () => router.push("/help") },
      ...(tour
        ? [
            {
              text: "Show me around",
              onPress: () =>
                tour
                  .replay()
                  .then(() => router.navigate("/hearth"))
                  .catch((error: Error) => Alert.alert("Couldn't start the tour", error.message)),
            },
          ]
        : []),
      { text: "Got it", style: "cancel" },
    ]);
  }

  return (
    <Tap
      onPress={show}
      hitSlop={10}
      pressedScale={0.85}
      style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center" }}
      accessibilityRole="button"
      accessibilityLabel="Help with this screen"
    >
      <Icon name="help" size={22} color={color} />
    </Tap>
  );
}

// A screen's own header buttons (settings, inbox…) with the "?" beside them.
export function HeaderWithHelp({ children }: { children?: ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      {children}
      <HelpButton />
    </View>
  );
}
