import { usePathname, useRouter } from "expo-router";
import type { ReactNode } from "react";
import { Alert, View } from "react-native";

import { helpFor, helpSectionFor } from "../lib/help";
import { tap } from "../lib/feedback";
import { Icon } from "./icon";
import { Tap } from "./motion";
import { NookInboxBell } from "./nook-inbox";
import { useTour } from "./tour";

// The "?" in a screen's header (CORE-069): a plain-words note about the
// screen you're on, with a way to the Help page or to replay the tour. It's
// a phone alert, so it's big, clear and works with the phone's own text size.
// `color` is for screens with their own look (the Hearth).
export function HelpButton({ color }: { color?: string }) {
  const show = useShowHelp();
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

// Shows this screen's help, for screens that put it somewhere other than
// the header (the Hearth keeps it with its Edit tools, so its header has
// room for your name).
export function useShowHelp() {
  const pathname = usePathname();
  const router = useRouter();
  const tour = useTour();

  return function show() {
    tap();
    const topic = helpFor(pathname);
    // "More help" opens Help on this Nook's own questions (CORE-102).
    const section = helpSectionFor(pathname);
    Alert.alert(topic.title, topic.body, [
      { text: "More help", onPress: () => router.push(section ? { pathname: "/help", params: { topic: section } } : "/help") },
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
  };
}

// A screen's own header buttons (settings…) with the "?" beside them. Give
// a Nook's home screen `nook` and its inbox bell goes first (CORE-099).
export function HeaderWithHelp({ nook, children }: { nook?: string; children?: ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      {nook ? <NookInboxBell nook={nook} /> : null}
      {children}
      <HelpButton />
    </View>
  );
}
