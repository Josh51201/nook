import { StyleSheet, useWindowDimensions } from "react-native";
import Svg, { Defs, G, LinearGradient, Mask, RadialGradient, Rect, Stop } from "react-native-svg";

// Warm light from the fire, glowing behind a screen so the page has some
// depth instead of a flat color (CORE-028).
//
// - "hearth": pours down from the top edge of the Hearth.
// - "ambient": a soft oval of warmth behind ordinary screens. It fades to
//   nothing before the top edge, so there's no seam under a flat header.
export function Firelight({
  color = "#f5b97c",
  strength = 0.2,
  variant = "ambient",
}: {
  color?: string;
  strength?: number;
  variant?: "hearth" | "ambient";
}) {
  const { width, height: screenHeight } = useWindowDimensions();
  const hearth = variant === "hearth";
  const height = Math.round(hearth ? width * 1.1 : screenHeight * 0.8);
  const id = `firelight-${variant}`;
  return (
    <Svg width={width} height={height} style={styles.glow} pointerEvents="none">
      <Defs>
        <RadialGradient
          id={id}
          cx="50%"
          cy={hearth ? "0%" : "42%"}
          rx={hearth ? "80%" : "78%"}
          ry={hearth ? "100%" : "42%"}
          fx="50%"
          fy={hearth ? "0%" : "42%"}
        >
          <Stop offset="0" stopColor={color} stopOpacity={strength} />
          <Stop offset="0.55" stopColor={color} stopOpacity={strength * 0.35} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill={`url(#${id})`} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  glow: { position: "absolute", top: 0, left: 0 },
});

// A strip that fades the page out as content scrolls up under a fixed bar —
// painted to look exactly like the page behind it (the solid color plus the
// same firelight), so there is no hard edge, just content melting away.
// `top` is where the strip starts, measured from the top of the screen the
// Firelight fills.
export function GlowVeil({
  top,
  height = 22,
  background,
  color,
  strength,
}: {
  top: number;
  height?: number;
  background: string;
  color: string;
  strength: number;
}) {
  const { width } = useWindowDimensions();
  return (
    <Svg width={width} height={height} style={{ position: "absolute", top, left: 0 }} pointerEvents="none">
      <Defs>
        <LinearGradient id="veil-fade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#fff" stopOpacity={1} />
          <Stop offset="1" stopColor="#fff" stopOpacity={0} />
        </LinearGradient>
        <Mask id="veil-mask" x="0" y="0" width={width} height={height} maskUnits="userSpaceOnUse">
          <Rect x={0} y={0} width={width} height={height} fill="url(#veil-fade)" />
        </Mask>
        <RadialGradient
          id="veil-glow"
          gradientUnits="userSpaceOnUse"
          cx={width / 2}
          cy={-top}
          fx={width / 2}
          fy={-top}
          rx={width * 0.8}
          ry={Math.round(width * 1.1)}
        >
          <Stop offset="0" stopColor={color} stopOpacity={strength} />
          <Stop offset="0.55" stopColor={color} stopOpacity={strength * 0.35} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <G mask="url(#veil-mask)">
        <Rect x={0} y={0} width={width} height={height} fill={background} />
        <Rect x={0} y={0} width={width} height={height} fill="url(#veil-glow)" />
      </G>
    </Svg>
  );
}
