import { StyleSheet, useWindowDimensions } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

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
