import { Redirect, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { HearthScreen } from "../../components/hearth/hearth-screen";
import { useAuth } from "../../lib/auth-context";
import { hearthThemes, useHearthLayout } from "../../lib/hearth";
import { useTheme } from "../../lib/theme";

// Inside a Hollow (CORE-022/023). You arrive through the door: the screen
// fades in while growing from just a little smaller, so it feels like
// stepping inside rather than sliding sideways.
export default function HollowScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, isLoading } = useAuth();
  const { layout } = useHearthLayout();
  const { key: themeKey } = useTheme();
  const theme = hearthThemes[themeKey] ?? hearthThemes.hearth;

  const grow = useSharedValue(0);
  useEffect(() => {
    grow.value = withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) });
  }, [grow]);
  const stepIn = useAnimatedStyle(() => ({
    opacity: grow.value,
    transform: [{ scale: 0.92 + grow.value * 0.08 }],
  }));

  if (!isLoading && !session) return <Redirect href="/sign-in" />;

  return (
    <Animated.View style={[{ flex: 1, backgroundColor: theme.background }, stepIn]}>
      <HearthScreen scope={id} />
    </Animated.View>
  );
}
