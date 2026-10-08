import { useState, type ReactNode } from "react";
import { RefreshControl, type StyleProp, type ViewStyle } from "react-native";
import { KeyboardAwareScrollView, KeyboardToolbar } from "react-native-keyboard-controller";

import { colors, ui } from "../lib/theme";
import { TourScrollArea, type useTourScrollArea } from "./tour";

// The scrolling body for every Nook screen. It keeps whatever field you're
// typing in lifted above the keyboard (iOS and Android), puts a Done /
// next-field bar on top of the keyboard (multi-line notes have no Done key
// otherwise), and gives a real pull-to-refresh spinner when `onRefresh`
// is passed. Pass `tour` (from useTourScrollArea) to let the first-time
// tour scroll this screen to what it's pointing at.
export function NookScroll({
  children,
  onRefresh,
  contentContainerStyle,
  tour,
}: {
  children: ReactNode;
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
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.bark} />
        ) : undefined
      }
    >
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
