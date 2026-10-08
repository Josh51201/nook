import { useRouter } from "expo-router";
import { Text } from "./text";

import { colors, stackScreenOptions, ui } from "../lib/theme";
import { Icon, type IconName } from "./icon";
import { Tap } from "./motion";

// Shared screen options for every Nook's stack (CORE-014). The first screen
// in a Nook's stack has no back button of its own, so it gets one that says
// where it leads: the Hearth usually, or a Burrow's page, the inbox, or
// another Nook — whatever opened it.

type Navigation = {
  getState: () => { routes: unknown[] };
  getParent: () => { getState: () => unknown } | undefined;
};

const places: Record<string, { label: string; icon: IconName }> = {
  "burrow/[id]": { label: "Burrow", icon: "burrow" },
  inbox: { label: "Inbox", icon: "bell" },
  "gift-nook": { label: "Gift Nook", icon: "gift" },
  potluck: { label: "Potluck Nook", icon: "potluck" },
};

function cameFrom(navigation: Navigation) {
  const root = navigation.getParent()?.getState() as { index: number; routes: { name: string }[] } | undefined;
  const previous = root?.routes[root.index - 1]?.name ?? "";
  return places[previous] ?? { label: "Hearth", icon: "hearth" as IconName };
}

function BackTo({ label, icon }: { label: string; icon: IconName }) {
  const router = useRouter();
  return (
    <Tap
      onPress={() => (router.canGoBack() ? router.back() : router.replace("/hearth"))}
      hitSlop={12}
      pressedScale={0.9}
      style={[ui.row, { gap: 5 }]}
      accessibilityLabel={`Back to ${label === "Hearth" ? "the Hearth" : label}`}
    >
      <Icon name={icon} size={18} />
      <Text style={{ color: colors.bark, fontSize: 17, fontWeight: "500" }}>{label}</Text>
    </Tap>
  );
}

export function nookStackOptions({ navigation }: { navigation: Navigation }) {
  const first = navigation.getState().routes.length <= 1;
  const place = first ? cameFrom(navigation) : null;
  return {
    ...stackScreenOptions,
    headerLeft: place ? () => <BackTo {...place} /> : undefined,
  };
}
