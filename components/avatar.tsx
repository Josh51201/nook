import { View } from "react-native";
import { FixedTextSize, Text } from "./text";

import { avatarColors, initialsOf } from "../lib/profile";
import { Icon, type IconName } from "./icon";

// A person's picture: their chosen icon (or initials) on their chosen color.
// Falls back to a color picked from their name so everyone looks distinct
// even before they've set one.
export function Avatar({
  name,
  icon,
  color,
  size = 44,
}: {
  name: string | null | undefined;
  icon?: string | null;
  color?: string | null;
  size?: number;
}) {
  const background =
    color ?? avatarColors[Math.abs([...(name ?? "?")].reduce((sum, ch) => sum + ch.charCodeAt(0), 0)) % avatarColors.length];
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2.4,
        backgroundColor: background,
        alignItems: "center",
        justifyContent: "center",
      }}
      accessibilityLabel={name ? `${name}'s picture` : "Profile picture"}
    >
      {icon ? (
        <Icon name={icon as IconName} size={size * 0.5} color="#ffffff" />
      ) : (
        <FixedTextSize>
          <Text style={{ color: "#ffffff", fontSize: size * 0.4, fontWeight: "800" }}>{initialsOf(name)}</Text>
        </FixedTextSize>
      )}
    </View>
  );
}
