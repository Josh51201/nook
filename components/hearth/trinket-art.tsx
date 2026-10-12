import { useEffect, type ReactNode } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Ellipse, G, Path, Rect } from "react-native-svg";

import { trinketShades, trinketViewBox, type TrinketKey } from "../../lib/trinkets";

// The little drawings behind Trinkets (CORE-045). Each fits a box (with
// its own proportions), sits on the "floor" at the bottom, and wears the main
// color you picked. A few have a quiet life of their own: a cat that breathes,
// a plant that sways, a flame that flickers.

type Shades = ReturnType<typeof trinketShades>;


const GREENS = ["#5b8049", "#6f9a5c", "#85b06f", "#a3c58a"];
const CREAM = "#fbf3e4";

export function TrinketArt({
  piece,
  color,
  width,
  height,
  flip,
  rotate,
  still = false,
}: {
  piece: TrinketKey;
  color: string;
  width: number;
  height: number;
  flip?: boolean;
  // Turned this many degrees (CORE-098).
  rotate?: number;
  // Hold still (for pickers and previews).
  still?: boolean;
}) {
  const shades = trinketShades(color);
  const box = trinketViewBox(piece);
  return (
    <Alive piece={piece} still={still} style={{ width, height, transform: [...(rotate ? [{ rotate: `${rotate}deg` }] : []), ...(flip ? [{ scaleX: -1 }] : [])] }}>
      <Svg width={width} height={height} viewBox={`0 0 ${box.w} ${box.h}`} preserveAspectRatio="xMidYMax meet">
        <Art piece={piece} s={shades} />
      </Svg>
    </Alive>
  );
}

function Art({ piece, s }: { piece: TrinketKey; s: Shades }) {
  switch (piece) {
    case "plant":
      return (
        <>
          <Ellipse cx="50" cy="96" rx="26" ry="3.5" fill="#000" fillOpacity={0.08} />
          <Path d="M50 60 C38 48 36 28 50 12 C64 28 62 48 50 60Z" fill={GREENS[1]} />
          <Path d="M48 62 C32 58 18 46 20 30 C36 34 48 46 48 62Z" fill={GREENS[0]} />
          <Path d="M52 62 C68 58 82 46 80 30 C64 34 52 46 52 62Z" fill={GREENS[2]} />
          <Path d="M47 64 C36 66 24 60 20 50 C34 48 44 54 47 64Z" fill={GREENS[3]} />
          <Path d="M53 64 C64 66 76 60 80 50 C66 48 56 54 53 64Z" fill={GREENS[1]} />
          <Path d="M50 60 L50 26" stroke={GREENS[0]} strokeWidth="1.5" strokeOpacity={0.5} />
          <Path d="M30 63 L70 63 L64 92 Q63.5 95 60.5 95 L39.5 95 Q36.5 95 36 92 Z" fill={s.main} />
          <Rect x="27" y="57" width="46" height="10" rx="3.5" fill={s.dark} />
          <Path d="M32 70 L40 92" stroke={s.light} strokeWidth="3" strokeLinecap="round" strokeOpacity={0.5} />
        </>
      );
    case "succulent":
      return (
        <>
          <Ellipse cx="50" cy="96" rx="22" ry="3" fill="#000" fillOpacity={0.08} />
          {[-62, -36, -12, 12, 36, 62].map((a, i) => (
            <Ellipse key={a} cx="50" cy="52" rx="7.5" ry="21" transform={`rotate(${a} 50 70)`} fill={i % 2 ? "#8fbf9a" : "#7bad89"} />
          ))}
          {[-20, 0, 20].map((a) => (
            <Ellipse key={a} cx="50" cy="55" rx="6" ry="15" transform={`rotate(${a} 50 72)`} fill="#a7d3b0" />
          ))}
          <Path d="M32 70 L68 70 L63 93 Q62.5 96 59.5 96 L40.5 96 Q37.5 96 37 93 Z" fill={s.main} />
          <Rect x="29" y="65" width="42" height="9" rx="3.5" fill={s.dark} />
        </>
      );
    case "lantern":
      return (
        <>
          <Ellipse cx="50" cy="96" rx="22" ry="3" fill="#000" fillOpacity={0.08} />
          <Path d="M36 24 Q50 2 64 24" stroke={s.darker} strokeWidth="3.5" fill="none" strokeLinecap="round" />
          <Rect x="33" y="22" width="34" height="9" rx="3.5" fill={s.dark} />
          <Rect x="35" y="31" width="30" height="48" rx="5" fill="#fff6d8" fillOpacity={0.55} />
          <Path d="M50 38 Q60 52 50 68 Q40 52 50 38Z" fill="#ffb02e" />
          <Path d="M50 48 Q55 56 50 64 Q45 56 50 48Z" fill="#ffe08a" />
          <Rect x="33" y="31" width="3.5" height="48" rx="1.5" fill={s.dark} />
          <Rect x="63.5" y="31" width="3.5" height="48" rx="1.5" fill={s.dark} />
          <Rect x="31" y="78" width="38" height="10" rx="4" fill={s.main} />
          <Rect x="31" y="78" width="38" height="4" rx="2" fill={s.light} fillOpacity={0.6} />
        </>
      );
    case "candle":
      return (
        <>
          <Ellipse cx="50" cy="93" rx="30" ry="6" fill={s.dark} />
          <Ellipse cx="50" cy="90" rx="30" ry="6" fill={s.light} />
          <Rect x="39" y="46" width="22" height="44" rx="5" fill={CREAM} />
          <Path d="M39 50 Q50 58 61 50 L61 54 Q58 62 55 54 Q50 66 45 54 Q42 60 39 54Z" fill="#f1e2c6" />
          <Path d="M50 46 L50 38" stroke="#5a4636" strokeWidth="2" strokeLinecap="round" />
          <Path d="M50 14 Q61 28 50 41 Q39 28 50 14Z" fill="#ffb02e" />
          <Path d="M50 26 Q56 33 50 40 Q44 33 50 26Z" fill="#ffe08a" />
        </>
      );
    case "teacup":
      return (
        <>
          <Path d="M36 22 Q42 12 36 4" stroke={s.light} strokeWidth="3" fill="none" strokeLinecap="round" strokeOpacity={0.9} />
          <Path d="M54 24 Q60 14 54 6" stroke={s.light} strokeWidth="3" fill="none" strokeLinecap="round" strokeOpacity={0.9} />
          <Ellipse cx="48" cy="90" rx="38" ry="7" fill={s.light} />
          <Ellipse cx="48" cy="88" rx="30" ry="5" fill={s.main} fillOpacity={0.5} />
          <Path d="M22 44 H74 V60 Q74 82 48 82 Q22 82 22 60 Z" fill={s.main} />
          <Circle cx="78" cy="58" r="10" stroke={s.dark} strokeWidth="5" fill="none" />
          <Ellipse cx="48" cy="45" rx="26" ry="5.5" fill={s.dark} />
          <Ellipse cx="48" cy="46" rx="23" ry="4" fill="#b97a3d" />
          <Path d="M28 56 Q30 72 40 76" stroke={s.light} strokeWidth="3" strokeLinecap="round" fill="none" strokeOpacity={0.6} />
        </>
      );
    case "books":
      return (
        <>
          <Ellipse cx="60" cy="87" rx="50" ry="4" fill="#000" fillOpacity={0.08} />
          <Rect x="12" y="66" width="92" height="20" rx="3.5" fill={s.main} />
          <Rect x="100" y="68" width="4" height="16" fill={CREAM} />
          <Rect x="18" y="72" width="40" height="3" rx="1.5" fill={s.light} />
          <Rect x="20" y="46" width="76" height="20" rx="3.5" fill={s.dark} />
          <Rect x="92" y="48" width="4" height="16" fill={CREAM} />
          <Rect x="28" y="52" width="30" height="3" rx="1.5" fill={s.light} fillOpacity={0.7} />
          <G transform="rotate(-7 60 36)">
            <Rect x="26" y="26" width="64" height="18" rx="3.5" fill={s.darker} />
            <Rect x="86" y="28" width="4" height="14" fill={CREAM} />
            <Circle cx="44" cy="35" r="3" fill={s.light} fillOpacity={0.8} />
          </G>
        </>
      );
    case "rug":
      return (
        <>
          <Ellipse cx="100" cy="36" rx="96" ry="22" fill={s.dark} />
          <Ellipse cx="100" cy="34" rx="96" ry="22" fill={s.main} />
          <Ellipse cx="100" cy="34" rx="80" ry="17" fill="none" stroke={s.light} strokeWidth="3" strokeDasharray="1 9" strokeLinecap="round" />
          <Ellipse cx="100" cy="34" rx="62" ry="12.5" fill={s.light} fillOpacity={0.55} />
          <Ellipse cx="100" cy="34" rx="40" ry="8" fill={s.dark} fillOpacity={0.85} />
          <Ellipse cx="100" cy="34" rx="16" ry="3.5" fill={s.light} />
        </>
      );
    case "cat":
      return (
        <>
          <Ellipse cx="70" cy="85" rx="60" ry="4" fill="#000" fillOpacity={0.08} />
          <Path d="M104 78 Q132 80 130 60 Q128 50 118 56" stroke={s.dark} strokeWidth="9" strokeLinecap="round" fill="none" />
          <Ellipse cx="72" cy="62" rx="50" ry="24" fill={s.main} />
          <Path d="M52 42 Q54 54 50 64" stroke={s.dark} strokeWidth="5" strokeLinecap="round" fill="none" strokeOpacity={0.55} />
          <Path d="M74 40 Q76 52 72 62" stroke={s.dark} strokeWidth="5" strokeLinecap="round" fill="none" strokeOpacity={0.55} />
          <Circle cx="28" cy="62" r="19" fill={s.main} />
          <Path d="M13 50 L14 30 L28 42Z" fill={s.main} />
          <Path d="M43 50 L42 30 L28 42Z" fill={s.main} />
          <Path d="M17 46 L17.5 36 L24 42Z" fill="#f2a9a0" />
          <Path d="M39 46 L38.5 36 L32 42Z" fill="#f2a9a0" />
          <Path d="M17 62 Q21 66 25 62" stroke="#3a2a22" strokeWidth="2.2" strokeLinecap="round" fill="none" />
          <Path d="M32 62 Q36 66 40 62" stroke="#3a2a22" strokeWidth="2.2" strokeLinecap="round" fill="none" />
          <Path d="M27 68 L31 68 L29 71Z" fill="#e58f8f" />
          <Ellipse cx="38" cy="80" rx="13" ry="6.5" fill={s.light} />
          <Ellipse cx="58" cy="82" rx="12" ry="6" fill={s.light} />
        </>
      );
    case "mushrooms":
      return (
        <>
          <Ellipse cx="70" cy="95" rx="60" ry="4" fill="#000" fillOpacity={0.08} />
          <Rect x="86" y="64" width="14" height="30" rx="6" fill={CREAM} />
          <Path d="M72 66 Q74 30 94 30 Q116 30 118 66 Q95 72 72 66Z" fill={s.main} />
          <Circle cx="86" cy="50" r="4.5" fill="#fff" fillOpacity={0.9} />
          <Circle cx="102" cy="44" r="3.5" fill="#fff" fillOpacity={0.9} />
          <Circle cx="108" cy="58" r="3" fill="#fff" fillOpacity={0.9} />
          <Rect x="38" y="68" width="11" height="26" rx="5" fill={CREAM} />
          <Path d="M24 70 Q26 42 43 42 Q60 42 62 70 Q43 75 24 70Z" fill={s.dark} />
          <Circle cx="36" cy="58" r="3.5" fill="#fff" fillOpacity={0.85} />
          <Circle cx="50" cy="55" r="3" fill="#fff" fillOpacity={0.85} />
          <Rect x="14" y="80" width="8" height="14" rx="4" fill={CREAM} />
          <Path d="M6 82 Q8 66 18 66 Q28 66 30 82 Q18 86 6 82Z" fill={s.light} />
          <Circle cx="14" cy="76" r="2.4" fill="#fff" />
        </>
      );
    case "wreath":
      return (
        <>
          {Array.from({ length: 24 }, (_, i) => {
            const a = (i / 24) * Math.PI * 2;
            return (
              <Ellipse
                key={i}
                cx={50 + Math.cos(a) * 34}
                cy={46 + Math.sin(a) * 34}
                rx="11"
                ry="5.5"
                transform={`rotate(${(a * 180) / Math.PI + 90 + (i % 2 ? 24 : -24)} ${50 + Math.cos(a) * 34} ${46 + Math.sin(a) * 34})`}
                fill={GREENS[i % GREENS.length]}
              />
            );
          })}
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i / 8) * Math.PI * 2 + 0.3;
            return <Circle key={i} cx={50 + Math.cos(a) * 34} cy={46 + Math.sin(a) * 34} r="3.2" fill="#c9433f" />;
          })}
          <Path d="M50 80 Q30 66 28 86 Q42 90 50 80Z" fill={s.main} />
          <Path d="M50 80 Q70 66 72 86 Q58 90 50 80Z" fill={s.main} />
          <Path d="M50 80 L38 96 L45 94 L50 98Z" fill={s.dark} />
          <Path d="M50 80 L62 96 L55 94 L50 98Z" fill={s.dark} />
          <Circle cx="50" cy="81" r="5" fill={s.light} />
        </>
      );
  }
}

// A quiet life of its own, depending on what it is.
function Alive({ piece, still, style, children }: { piece: TrinketKey; still: boolean; style: object; children: ReactNode }) {
  const t = useSharedValue(0);
  const reduceMotion = useReducedMotion();
  const mode = still || reduceMotion ? "none" : piece === "cat" ? "breathe" : piece === "plant" || piece === "succulent" ? "sway" : piece === "lantern" || piece === "candle" ? "flicker" : piece === "teacup" ? "steam" : "none";

  useEffect(() => {
    if (mode === "none") return;
    const duration = mode === "flicker" ? 700 : mode === "breathe" ? 2200 : mode === "sway" ? 3200 : 2600;
    t.value = withRepeat(
      withSequence(withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration, easing: Easing.inOut(Easing.sin) })),
      -1
    );
  }, [mode]);

  // Always the same shape (neutral values when it isn't moving), so the
  // style is never empty or changing kind.
  const animated = useAnimatedStyle(() => {
    const v = t.value;
    return {
      opacity: mode === "flicker" ? 0.88 + v * 0.12 : mode === "steam" ? 0.85 + v * 0.15 : 1,
      transform: [
        { rotate: mode === "sway" ? `${(v - 0.5) * 3}deg` : "0deg" },
        { scaleY: mode === "breathe" ? 1 + v * 0.035 : 1 },
      ],
    };
  });

  return (
    <View style={style}>
      <Animated.View style={[{ flex: 1 }, animated]}>{children}</Animated.View>
    </View>
  );
}

// Used by the add menu to show every piece.
export function TrinketThumb({ piece, color, size = 48 }: { piece: TrinketKey; color: string; size?: number }) {
  return <TrinketArt piece={piece} color={color} width={size} height={size} still />;
}

