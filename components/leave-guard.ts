import { useNavigation } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { useEffect, useRef, useState } from "react";
import { Alert } from "react-native";

// "Discard your changes?" (CORE-075): leaving a form or editor with unsaved
// changes — the back button, a swipe, closing a pop-up screen — asks first,
// so nobody loses what they typed by accident.
//
// Pass everything the person can change (`values`) and whether it has
// finished loading (`ready`); what it looks like then is the starting point.
// Call `allowLeave()` just before leaving on purpose (after saving or
// deleting), so that doesn't ask.
export function useLeaveGuard(values: unknown, ready = true) {
  const navigation = useNavigation();
  const [start, setStart] = useState<string | null>(null);
  const allowed = useRef(false);
  const now = JSON.stringify(values);

  useEffect(() => {
    if (ready && start === null) setStart(now);
  }, [ready, start, now]);

  const changed = start !== null && now !== start;

  usePreventRemove(changed, ({ data }) => {
    if (allowed.current) {
      navigation.dispatch(data.action);
      return;
    }
    Alert.alert("Discard your changes?", "You haven't saved what you changed here.", [
      { text: "Keep editing", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: () => navigation.dispatch(data.action) },
    ]);
  });

  return {
    changed,
    allowLeave: () => {
      allowed.current = true;
    },
    // Ask again (e.g. the save that was about to leave failed).
    blockLeave: () => {
      allowed.current = false;
    },
  };
}
