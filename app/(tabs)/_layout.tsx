import { Redirect, Tabs } from "expo-router";
import type { BottomTabBarProps } from "expo-router/tabs";
import { StyleSheet, View } from "react-native";
import { Text } from "../../components/text";
import Animated, { useAnimatedStyle, withSpring } from "react-native-reanimated";

import { HelpButton } from "../../components/help-button";
import { Icon, type IconName } from "../../components/icon";
import { Tap } from "../../components/motion";
import { themedScreenLayout } from "../../components/themed-screen";
import { TourTarget } from "../../components/tour";
import { useAuth } from "../../lib/auth-context";
import { tap } from "../../lib/feedback";
import { findNook } from "../../lib/nooks";
import { colors, headerFont, themed, useTheme } from "../../lib/theme";
import { useUnreadByNook } from "../../lib/use-unread";

// CORE-025: the bar along the bottom of the app — the Hearth, every Nook
// (CORE-067), Burrows (families, shared by every Nook) and Settings. Nooks,
// Hollows and other screens open on top of it. The first-time tour
// (CORE-026) is in the root layout, so it can point at these tabs.

const tabIcons: Record<string, IconName> = { hearth: "hearth", nooks: "nooks", burrows: "burrow", settings: "settings" };

const headerOptions = themed(() => ({
  headerShown: true,
  headerStyle: { backgroundColor: colors.background },
  headerShadowVisible: false,
  headerTitleStyle: { fontWeight: "700" as const, color: colors.text, ...headerFont(700) },
  headerTintColor: colors.bark,
  headerRight: () => <HelpButton />,
}));

export default function TabsLayout() {
  const { session, isLoading } = useAuth();
  useTheme();
  if (!isLoading && !session) return <Redirect href="/sign-in" />;

  return (
    <Tabs
      screenLayout={themedScreenLayout}
      tabBar={(props) => <NookTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        // No fade between tabs: a fade interrupted by a quick second tap can
        // stick at invisible and leave a blank page.
        animation: "none",
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="hearth" options={{ title: "Hearth" }} />
      <Tabs.Screen name="nooks" options={{ ...headerOptions, title: "Nooks" }} />
      <Tabs.Screen name="burrows" options={{ ...headerOptions, title: "Burrows" }} />
      <Tabs.Screen name="settings" options={{ ...headerOptions, title: "Settings" }} />
    </Tabs>
  );
}

function NookTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const focused = state.routes[state.index];
  // A dot on the Nooks tab when a Nook has something new (checked again on
  // every tab change), so a newcomer knows where to look.
  const waiting = useUnreadByNook(state.index);
  const nooksHaveNews = Object.keys(waiting).some((id) => findNook(id)?.available);
  // The bar wears the app's theme, like every screen (CORE-032).
  const background = colors.background;
  const accent = colors.bark;
  const muted = colors.muted;
  // A soft shadow cast upward, so the bar floats over the page (CORE-028).
  const lift = `0px -6px 20px -10px rgba(${colors.shade}, ${colors.dark ? 0.6 : 0.16})`;

  // A screen can tuck the bar away (the Hearth does while a sheet is open).
  const hidden = (descriptors[focused.key].options.tabBarStyle as { display?: string } | undefined)?.display === "none";
  if (hidden) return null;

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: background,
          borderTopColor: `${colors.border}aa`,
          boxShadow: lift,
          paddingBottom: Math.max(insets.bottom, 10),
        },
      ]}
    >
      {state.routes.map((route, i) => {
        const isFocused = state.index === i;
        const label = descriptors[route.key].options.title ?? route.name;
        function onPress() {
          const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!isFocused && !event.defaultPrevented) {
            tap();
            navigation.navigate(route.name, route.params);
          }
        }
        return (
          <TourTarget key={route.key} id={`tab-${route.name}`} style={styles.tab}>
            <Tap
              onPress={onPress}
              pressedScale={0.9}
              style={styles.tabInner}
              accessibilityRole="tab"
              accessibilityState={{ selected: isFocused }}
              accessibilityLabel={label}
            >
              <TabPill focused={isFocused} color={`${accent}1f`}>
                <Icon name={tabIcons[route.name] ?? "hearth"} size={22} color={isFocused ? accent : muted} />
                {route.name === "nooks" && nooksHaveNews ? (
                  <View style={[styles.dot, { backgroundColor: accent, borderColor: background }]} />
                ) : null}
              </TabPill>
              <Text style={[styles.label, { color: isFocused ? accent : muted, fontWeight: isFocused ? "700" : "500" }]}>
                {label}
              </Text>
            </Tap>
          </TourTarget>
        );
      })}
    </View>
  );
}

// The soft pill behind the chosen tab's icon springs open.
function TabPill({ focused, color, children }: { focused: boolean; color: string; children: React.ReactNode }) {
  const pillStyle = useAnimatedStyle(() => ({
    opacity: withSpring(focused ? 1 : 0, { damping: 18, stiffness: 220 }),
    transform: [{ scaleX: withSpring(focused ? 1 : 0.5, { damping: 16, stiffness: 220 }) }],
  }));
  return (
    <View style={styles.pillWrap}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.pill, { backgroundColor: color }, pillStyle]} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
    paddingHorizontal: 12,
  },
  tab: { flex: 1 },
  tabInner: { alignItems: "center", gap: 3, paddingVertical: 2 },
  pillWrap: { width: 60, height: 32, alignItems: "center", justifyContent: "center" },
  pill: { borderRadius: 16 },
  label: { fontSize: 12 },
  dot: { position: "absolute", top: 3, right: 14, width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
});
