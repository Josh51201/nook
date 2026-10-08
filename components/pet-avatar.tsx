import { Image } from "expo-image";
import { View } from "react-native";

import { IconBadge } from "./icon";

// A pet's picture: their photo if they have one, otherwise a paw print in
// the Pet Care Nook's colors.
export function PetAvatar({ uri, size = 56 }: { uri?: string | null; size?: number }) {
  if (uri) {
    return (
      <View style={{ width: size, height: size, borderRadius: size / 2.6, overflow: "hidden" }}>
        <Image source={{ uri }} style={{ width: size, height: size }} contentFit="cover" transition={150} />
      </View>
    );
  }
  return <IconBadge name="paw" size={size} color="#3f6a96" background="#d9e4ef" />;
}
