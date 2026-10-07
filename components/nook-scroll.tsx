import { useState, type ReactNode } from "react";
import { RefreshControl, type StyleProp, type ViewStyle } from "react-native";
import { KeyboardAwareScrollView, KeyboardToolbar } from "react-native-keyboard-controller";

import { colors, ui } from "../lib/theme";

// The scrolling body for every Nook screen. It keeps whatever field you're
// typing in lifted above the keyboard (iOS and Android), puts a Done /
// next-field bar on top of the keyboard (multi-line notes have no Done key
// otherwise), and gives a real pull-to-refresh spinner when `onRefresh`
// is passed.
export function NookScroll({
  children,
  onRefresh,
  contentContainerStyle,
}: {
  children: ReactNode;
  onRefresh?: () => Promise<unknown> | void;
  contentContainerStyle?: StyleProp<ViewStyle>;
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

  return (
    <>
      <KeyboardAwareScrollView
        bottomOffset={32}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={[ui.screen, contentContainerStyle]}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.bark} />
          ) : undefined
        }
      >
        {children}
      </KeyboardAwareScrollView>
      <KeyboardToolbar />
    </>
  );
}
