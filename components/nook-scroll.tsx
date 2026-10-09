import { useState, type ReactNode } from "react";
import { RefreshControl, View, type StyleProp, type ViewStyle } from "react-native";
import { KeyboardAwareScrollView, KeyboardToolbar } from "react-native-keyboard-controller";

import { colors, ui } from "../lib/theme";
import { Firelight } from "./firelight";
import { TourScrollArea, type useTourScrollArea } from "./tour";

// The scrolling body for every Nook screen. It keeps whatever field you're
// typing in lifted above the keyboard (iOS and Android), puts a Done /
// next-field bar on top of the keyboard (multi-line notes have no Done key
// otherwise), and gives a real pull-to-refresh spinner when `onRefresh`
// is passed. A soft firelight glow sits behind the top of the page
// (CORE-028). Pass `tour` (from useTourScrollArea) to let the first-time
// tour scroll this screen to what it's pointing at. `pinned` stays at the
// top of the screen while the rest scrolls under it (a live preview of what
// you're editing, CORE-079).
export function NookScroll({
  children,
  onRefresh,
  contentContainerStyle,
  tour,
  pinned,
}: {
  children: ReactNode;
  pinned?: ReactNode;
  onRefresh?: () => Promise<unknown> | void;
  contentContainerStyle?: StyleProp<ViewStyle>;
  tour?: ReturnType<typeof useTourScrollArea>;
}) {
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    try {
      await onRefresh?.();
    } finally {
      setRefreshing(false);
    }
  }

  const scroll = (
    <KeyboardAwareScrollView
      ref={tour?.scrollRef as never}
      {...tour?.scrollProps}
      bottomOffset={32}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[ui.screen, contentContainerStyle]}
      // Firelight is the first child, so the pinned part is the second.
      stickyHeaderIndices={pinned ? [1] : undefined}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.bark} />
        ) : undefined
      }
    >
      {/* Inside the scroll (not behind it) so the ScrollView stays the
          screen's first view — iPhone large titles depend on that. */}
      <Firelight />
      {pinned ? (
        // Edge to edge, so what scrolls under it is hidden.
        <View style={{ marginHorizontal: -20, marginTop: -20, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 10, backgroundColor: colors.background }}>
          {pinned}
        </View>
      ) : null}
      {children}
    </KeyboardAwareScrollView>
  );

  return (
    <>
      {tour ? <TourScrollArea area={tour.area}>{scroll}</TourScrollArea> : scroll}
      <KeyboardToolbar />
    </>
  );
}
