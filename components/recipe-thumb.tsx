import { Image } from "expo-image";
import { View } from "react-native";

import { IconBadge } from "./icon";
import { findNook } from "../lib/nooks";

// A recipe's picture from its website (REC-003), or the Nook's icon.
export function RecipeThumb({ imageUrl, size = 40 }: { imageUrl: string | null; size?: number }) {
  const nook = findNook("recipes")!;
  if (!imageUrl) return <IconBadge name="recipe" size={size} color={nook.iconColor} background={nook.color} />;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2.6, overflow: "hidden", backgroundColor: nook.color }}>
      <Image source={{ uri: imageUrl }} style={{ width: size, height: size }} contentFit="cover" transition={150} />
    </View>
  );
}
