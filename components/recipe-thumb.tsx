import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { View } from "react-native";

import { IconBadge } from "./icon";
import { findNook } from "../lib/nooks";
import { fetchTikTok, isTikTok } from "../lib/tiktok";

// A recipe's picture: from its website (REC-003), or a TikTok's thumbnail,
// looked up fresh each time because TikTok's expire (REC-013).
export function useRecipeImage(imageUrl: string | null, sourceUrl: string | null) {
  const [tiktokThumb, setTiktokThumb] = useState<string | null>(null);
  const tiktok = isTikTok(sourceUrl);

  useEffect(() => {
    if (!tiktok || !sourceUrl) return;
    let live = true;
    fetchTikTok(sourceUrl).then((info) => live && setTiktokThumb(info?.thumbnailUrl ?? null));
    return () => {
      live = false;
    };
  }, [tiktok, sourceUrl]);

  return tiktok ? tiktokThumb : imageUrl;
}

// The picture in a rounded square, or the Nook's icon if there's none (or
// it won't load).
export function RecipeThumb({ imageUrl, sourceUrl = null, size = 40 }: { imageUrl: string | null; sourceUrl?: string | null; size?: number }) {
  const nook = findNook("recipes")!;
  const uri = useRecipeImage(imageUrl, sourceUrl);
  const [broken, setBroken] = useState<string | null>(null);
  if (!uri || broken === uri) {
    return <IconBadge name={isTikTok(sourceUrl) ? "play" : "recipe"} size={size} color={nook.iconColor} background={nook.color} />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2.6, overflow: "hidden", backgroundColor: nook.color }}>
      <Image source={{ uri }} style={{ width: size, height: size }} contentFit="cover" transition={150} onError={() => setBroken(uri)} />
    </View>
  );
}
