import { Image } from "expo-image";
import { View } from "react-native";
import { FixedTextSize, Text } from "./text";

import { avatarColors, initialsOf } from "../lib/profile";
import { useProfilePhotoUrl } from "../lib/profile-photos";
import { Icon, type IconName } from "./icon";

// A person's picture: their photo if they've added one (PROF-006),
// otherwise their chosen icon (or initials) on their chosen color. Falls back
// to a color picked from their name so everyone looks distinct even before
// they've set one. The icon/initials sit underneath while a photo loads, and
// stay if it can't be shown.
export function Avatar({
  name,
  icon,
  color,
  photo,
  size = 44,
}: {
  name: string | null | undefined;
  icon?: string | null;
  color?: string | null;
  // The photo's storage path (profiles.avatar_path).
  photo?: string | null;
  size?: number;
}) {
  const photoUrl = useProfilePhotoUrl(photo);
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
        overflow: "hidden",
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
      {photo && photoUrl ? (
        <Image
          // Cached by the photo itself, not the link (which changes hourly).
          source={{ uri: photoUrl, cacheKey: photo }}
          style={{ position: "absolute", width: size, height: size }}
          contentFit="cover"
          transition={150}
          recyclingKey={photo}
        />
      ) : null}
    </View>
  );
}
