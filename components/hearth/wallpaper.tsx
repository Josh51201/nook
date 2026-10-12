import { Image } from "expo-image";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Pattern, Rect, Stop, Circle } from "react-native-svg";

import { deepOf } from "../../lib/colors";
import type { PatternKey, Wallpaper } from "../../lib/decor";
import { usePhotoUrls } from "../../lib/hearth-photos";

// The wallpaper behind the Hearth or a Hollow (CORE-041). It's washed over
// the theme's own background, and photos are dimmed with it, so text stays
// readable on light and dark Hearths alike.
export function WallpaperLayer({ wallpaper, background, dark }: { wallpaper: Wallpaper; background: string; dark: boolean }) {
  const screen = useWindowDimensions();
  if (wallpaper.kind === "none") return null;
  if (wallpaper.kind === "photo") return <PhotoWallpaper path={wallpaper.path} dim={wallpaper.dim} background={background} />;
  const wash = dark ? 0.3 : 0.55;
  return (
    // Drawn at the whole screen's size, not "as big as my parent": a drawing
    // doesn't always repaint when its parent grows (the tab bar leaving in Edit
    // left a plain strip at the bottom), but one already big enough never needs to.
    <View style={[StyleSheet.absoluteFill, { overflow: "hidden" }]} pointerEvents="none">
      <Svg width={screen.width} height={screen.height} style={{ position: "absolute", top: 0, left: 0 }}>
        {wallpaper.kind === "gradient" ? (
          <>
            <Defs>
              <LinearGradient
                id="wall"
                x1="0"
                y1="0"
                x2={wallpaper.direction === "diagonal" ? "1" : "0"}
                y2="1"
              >
                <Stop offset="0" stopColor={wallpaper.from} stopOpacity={wash} />
                <Stop offset="1" stopColor={wallpaper.to} stopOpacity={wash} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#wall)" />
          </>
        ) : (
          <>
            <Defs>
              <Pattern id="wall" patternUnits="userSpaceOnUse" {...patternTileSize(wallpaper.pattern)}>
                <PatternTile pattern={wallpaper.pattern} ink={deepOf(wallpaper.color)} opacity={dark ? 0.22 : 0.17} />
              </Pattern>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill={wallpaper.color} fillOpacity={dark ? 0.1 : 0.32} />
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#wall)" />
          </>
        )}
      </Svg>
    </View>
  );
}

function PhotoWallpaper({ path, dim, background }: { path: string; dim: number; background: string }) {
  const urls = usePhotoUrls([path]);
  const url = urls.get(path);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {url ? <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} /> : null}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: background, opacity: url ? dim : 0 }]} />
    </View>
  );
}

// The size of one repeat of each pattern.
export function patternTileSize(pattern: PatternKey) {
  const size = { dots: 30, stripes: 26, gingham: 36, leaves: 52, stars: 44, diamonds: 34 }[pattern];
  return { width: size, height: size };
}

export function PatternTile({ pattern, ink, opacity }: { pattern: PatternKey; ink: string; opacity: number }) {
  switch (pattern) {
    case "dots":
      return (
        <>
          <Circle cx="8" cy="8" r="3.4" fill={ink} fillOpacity={opacity * 1.4} />
          <Circle cx="23" cy="23" r="3.4" fill={ink} fillOpacity={opacity * 1.4} />
        </>
      );
    case "stripes":
      return <Rect x="0" y="0" width="11" height="26" fill={ink} fillOpacity={opacity} />;
    case "gingham":
      return (
        <>
          <Rect x="0" y="0" width="18" height="36" fill={ink} fillOpacity={opacity * 0.9} />
          <Rect x="0" y="0" width="36" height="18" fill={ink} fillOpacity={opacity * 0.9} />
        </>
      );
    case "leaves":
      return (
        <>
          <Path d="M8 22 C10 10 20 6 26 8 C26 18 18 26 8 22 Z" fill={ink} fillOpacity={opacity * 1.3} />
          <Path d="M32 46 C34 34 44 30 50 32 C50 42 42 50 32 46 Z" fill={ink} fillOpacity={opacity * 1.3} />
        </>
      );
    case "stars":
      return (
        <>
          <Path d="M12 4 L14 10 L20 12 L14 14 L12 20 L10 14 L4 12 L10 10 Z" fill={ink} fillOpacity={opacity * 1.5} />
          <Path d="M34 28 L35.5 32 L40 33.5 L35.5 35 L34 39 L32.5 35 L28 33.5 L32.5 32 Z" fill={ink} fillOpacity={opacity * 1.2} />
        </>
      );
    case "diamonds":
      return <Path d="M17 4 L30 17 L17 30 L4 17 Z" fill={ink} fillOpacity={opacity} />;
  }
}
