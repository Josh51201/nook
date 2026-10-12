import { useEffect, type ReactNode } from "react";
import { AccessibilityInfo, Pressable, View, useWindowDimensions } from "react-native";
import Animated, { FadeIn, FadeOut, ZoomIn } from "react-native-reanimated";

import type { News } from "../../lib/hearth-news";
import { Icon } from "../icon";
import { Tap } from "../motion";
import { FixedTextSize, Text } from "../text";
import { ItemPreview } from "./item-preview";
import { NEWS_RED } from "./news";

// Peek into a Hollow (CORE-116): hold a Hollow and a card shows what's
// inside, drawn as it looks in there, without stepping in. Let go and it
// stays open; "Go in" steps inside, and a tap outside closes it.

export function HollowPeek({
  name,
  count,
  news,
  width,
  height,
  colors,
  backdrop,
  onGoIn,
  onClose,
  children,
}: {
  name: string;
  // How many things are inside.
  count: number;
  news: News | null;
  // The inside's real size, drawn smaller to fit the card.
  width: number;
  height: number;
  colors: { accent: string; text: string; background: string; dark: boolean };
  // The Hollow's wallpaper.
  backdrop: ReactNode;
  onGoIn: () => void;
  onClose: () => void;
  children: ReactNode;
}) {
  const screen = useWindowDimensions();
  const cardWidth = Math.min(screen.width - 32, 400);
  const line = news
    ? news.count === 1
      ? `New: ${news.latest}`
      : `${news.count} new things, the latest: ${news.latest}`
    : count === 0
      ? "Nothing in here yet"
      : count === 1
        ? "1 thing inside"
        : `${count} things inside`;

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(`${name}. ${line}`);
    // Said once, when it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View
      entering={FadeIn.duration(160)}
      exiting={FadeOut.duration(140)}
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}
    >
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close"
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.dark ? "rgba(0,0,0,0.55)" : "rgba(40,28,20,0.35)" }}
      />
      <Animated.View
        entering={ZoomIn.springify().damping(16).stiffness(220)}
        accessibilityViewIsModal
        style={{
          width: cardWidth,
          padding: 14,
          gap: 12,
          borderRadius: 28,
          backgroundColor: colors.background,
          boxShadow: "0px 12px 32px rgba(0,0,0,0.28)",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 4 }}>
          <Icon name="burrow" size={22} color={colors.accent} />
          <View style={{ flex: 1 }}>
            <FixedTextSize>
              <Text style={{ fontSize: 19, fontWeight: "800", color: colors.text }} numberOfLines={1}>
                {name}
              </Text>
            </FixedTextSize>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              {news ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: NEWS_RED }} /> : null}
              <Text style={{ flex: 1, fontSize: 13.5, color: colors.text, opacity: 0.75 }} numberOfLines={2}>
                {line}
              </Text>
            </View>
          </View>
        </View>
        {count > 0 ? (
          <ItemPreview width={width} height={height} maxHeight={screen.height * 0.45} background={colors.background} backdrop={backdrop}>
            {children}
          </ItemPreview>
        ) : null}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Tap
            onPress={onClose}
            pressedScale={0.96}
            accessibilityRole="button"
            style={{ flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 999, borderWidth: 1.5, borderColor: colors.accent }}
          >
            <Text style={{ color: colors.accent, fontWeight: "700" }}>Close</Text>
          </Tap>
          <Tap
            onPress={onGoIn}
            pressedScale={0.96}
            accessibilityRole="button"
            style={{ flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, paddingVertical: 12, borderRadius: 999, backgroundColor: colors.accent }}
          >
            <Icon name="door" size={16} color={colors.background} />
            <Text style={{ color: colors.background, fontWeight: "800" }}>Go in</Text>
          </Tap>
        </View>
      </Animated.View>
    </Animated.View>
  );
}
