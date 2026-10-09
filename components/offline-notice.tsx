import { useNetInfo } from "@react-native-community/netinfo";
import { useEffect, useRef } from "react";
import { AccessibilityInfo, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, useTheme } from "../lib/theme";
import { Icon } from "./icon";
import { Text } from "./text";

// A small note at the top of every screen while the phone has no internet
// (CORE-075), instead of a scary error the moment something can't save.
// Taps go straight through it, so it never blocks a button.
export function OfflineNotice() {
  const { isConnected, isInternetReachable } = useNetInfo();
  const insets = useSafeAreaInsets();
  useTheme();
  // Only once we know for sure (null means "still checking").
  const offline = isConnected === false || isInternetReachable === false;
  const wasOffline = useRef(false);

  useEffect(() => {
    if (offline === wasOffline.current) return;
    wasOffline.current = offline;
    AccessibilityInfo.announceForAccessibility(
      offline ? "You're offline. Changes won't save until you're back online." : "You're back online."
    );
  }, [offline]);

  if (!offline) return null;
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: insets.top + 4, left: 0, right: 0, alignItems: "center", zIndex: 1000 }}>
      <Animated.View
        entering={FadeInUp.duration(220)}
        exiting={FadeOutUp.duration(180)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          maxWidth: "92%",
          paddingVertical: 8,
          paddingHorizontal: 14,
          borderRadius: 999,
          backgroundColor: colors.text,
          boxShadow: "0px 6px 16px -6px rgba(0,0,0,0.35)",
        }}
      >
        <Icon name="cloud" size={16} color={colors.background} />
        <Text style={{ color: colors.background, fontSize: 13, fontWeight: "600", flexShrink: 1 }}>
          You're offline — changes won't save until you're back online.
        </Text>
      </Animated.View>
    </View>
  );
}
