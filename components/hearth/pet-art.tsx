import { createContext, useEffect, useId, type ReactNode } from "react";
import { View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withTiming } from "react-native-reanimated";
import Svg, { Circle, ClipPath, Defs, Ellipse, Image as SvgImage, Line, Path, Rect } from "react-native-svg";

import { shade } from "../../lib/colors";
import type { BedStyle, CritterKind, PetSize } from "../../lib/hearth-pet";
import { Text } from "../text";

// The Hearth pet's drawings (CORE-048): seven little critters, its bed and
// its food bowl. A critter faces right, fits a 100×80 box and sits on the
// bottom edge. With a Pet Care photo (PET-006) the photo becomes its face.

// Tells bed widgets that their pet is out on the Hearth (pet-roamer.tsx), so
// they draw just the bed; and how big the pet is there, so the two match.
export const PetStageContext = createContext<{ roaming: boolean; pet: PetSize | null }>({ roaming: false, pet: null });

const INK = "#2b211c";
const BLUSH = "#f2a0a0";
const PINK = "#e58e9b";

type Fur = { main: string; light: string; dark: string; darker: string };

function furShades(color: string): Fur {
  return { main: color, light: shade(color, 0.5), dark: shade(color, -0.22), darker: shade(color, -0.5) };
}

// Where each critter's face is, for a photo.
const HEADS: Record<CritterKind, { cx: number; cy: number; r: number }> = {
  dog: { cx: 64, cy: 32, r: 17 },
  cat: { cx: 60, cy: 33, r: 16 },
  rabbit: { cx: 63, cy: 41, r: 14 },
  bird: { cx: 62, cy: 36, r: 13 },
  fish: { cx: 50, cy: 50, r: 15 },
  turtle: { cx: 84, cy: 50, r: 11 },
  hamster: { cx: 58, cy: 48, r: 15 },
};

export function CritterArt({
  critter,
  fur,
  width,
  height,
  eyesClosed = false,
  photoUrl,
  flip = false,
}: {
  critter: CritterKind;
  fur: string;
  width: number;
  height: number;
  eyesClosed?: boolean;
  photoUrl?: string | null;
  // Facing left.
  flip?: boolean;
}) {
  const s = furShades(fur);
  const clip = `pet${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const head = HEADS[critter];
  const photo = photoUrl ? (
    <>
      <Defs>
        <ClipPath id={clip}>
          <Circle cx={head.cx} cy={head.cy} r={head.r} />
        </ClipPath>
      </Defs>
      <Circle cx={head.cx} cy={head.cy} r={head.r + 1.8} fill={s.dark} />
      <SvgImage
        href={{ uri: photoUrl }}
        x={head.cx - head.r}
        y={head.cy - head.r}
        width={head.r * 2}
        height={head.r * 2}
        preserveAspectRatio="xMidYMid slice"
        clipPath={`url(#${clip})`}
      />
    </>
  ) : null;
  return (
    // Always a transform (never removed): taking one away crashes on the phone.
    <View style={{ width, height, transform: [{ scaleX: flip ? -1 : 1 }] }}>
      <Svg width={width} height={height} viewBox="0 0 100 80" preserveAspectRatio="xMidYMax meet">
        <Ellipse cx="50" cy="78" rx="30" ry="2.6" fill="#000" fillOpacity={0.1} />
        <Critter critter={critter} s={s} closed={eyesClosed} photo={photo} />
      </Svg>
    </View>
  );
}

function Eye({ x, y, closed, r = 2.6 }: { x: number; y: number; closed: boolean; r?: number }) {
  if (closed) return <Path d={`M${x - r} ${y} Q${x} ${y + r * 1.1} ${x + r} ${y}`} stroke={INK} strokeWidth={1.6} fill="none" strokeLinecap="round" />;
  return (
    <>
      <Circle cx={x} cy={y} r={r} fill={INK} />
      <Circle cx={x + r * 0.35} cy={y - r * 0.4} r={r * 0.35} fill="#fff" />
    </>
  );
}

function Critter({ critter, s, closed, photo }: { critter: CritterKind; s: Fur; closed: boolean; photo: ReactNode }) {
  switch (critter) {
    case "dog":
      return (
        <>
          <Path d="M27 60 Q12 54 14 38" stroke={s.main} strokeWidth="7" strokeLinecap="round" fill="none" />
          <Ellipse cx="42" cy="58" rx="22" ry="17" fill={s.main} />
          <Ellipse cx="31" cy="66" rx="11" ry="10" fill={s.dark} />
          <Ellipse cx="29" cy="76" rx="8" ry="3" fill={s.light} />
          <Rect x="50" y="54" width="8" height="23" rx="4" fill={s.main} />
          <Rect x="60" y="54" width="8" height="23" rx="4" fill={s.dark} />
          <Ellipse cx="54" cy="76" rx="5.5" ry="2.6" fill={s.light} />
          <Ellipse cx="64" cy="76" rx="5.5" ry="2.6" fill={s.light} />
          <Ellipse cx="57" cy="53" rx="9" ry="12" fill={s.light} />
          <Path d="M50 44 Q60 50 72 44" stroke="#d95f59" strokeWidth="4" strokeLinecap="round" fill="none" />
          <Circle cx="61" cy="49" r="2.6" fill="#f2c14e" />
          {photo ?? (
            <>
              <Circle cx="64" cy="32" r="17" fill={s.main} />
              <Ellipse cx="77" cy="38" rx="9" ry="7" fill={s.light} />
              <Circle cx="84.5" cy="35" r="3.3" fill={INK} />
              <Path d="M80 42 Q77 44 74 42" stroke={INK} strokeWidth="1.4" fill="none" strokeLinecap="round" />
              <Eye x={68} y={28.5} closed={closed} />
              <Circle cx="69" cy="37" r="3" fill={BLUSH} fillOpacity={0.5} />
            </>
          )}
          <Ellipse cx="55" cy="33" rx="6.5" ry="12.5" transform="rotate(22 55 33)" fill={s.darker} fillOpacity={0.85} />
        </>
      );
    case "cat":
      return (
        <>
          <Path d="M26 70 Q8 68 11 52 Q13 43 20 45" stroke={s.main} strokeWidth="6" strokeLinecap="round" fill="none" />
          <Ellipse cx="44" cy="59" rx="20" ry="18" fill={s.main} />
          <Path d="M32 48 Q36 52 32 56 M38 45 Q42 49 38 53" stroke={s.dark} strokeWidth="2.4" strokeLinecap="round" fill="none" />
          <Rect x="50" y="58" width="7" height="19" rx="3.5" fill={s.main} />
          <Rect x="58" y="58" width="7" height="19" rx="3.5" fill={s.dark} />
          <Ellipse cx="56" cy="57" rx="8" ry="11" fill={s.light} />
          <Path d="M46 25 L48 8 L59 18 Z" fill={s.main} />
          <Path d="M49 22 L50 13 L55 18 Z" fill={PINK} fillOpacity={0.7} />
          <Path d="M62 17 L73 8 L75 26 Z" fill={s.main} />
          <Path d="M65 18 L71 13 L72 22 Z" fill={PINK} fillOpacity={0.7} />
          {photo ?? (
            <>
              <Circle cx="60" cy="33" r="16" fill={s.main} />
              <Path d="M54 19 Q56 23 54 26 M60 18 L60 24 M66 19 Q64 23 66 26" stroke={s.dark} strokeWidth="2" strokeLinecap="round" fill="none" />
              <Eye x={54.5} y={32} closed={closed} r={2.4} />
              <Eye x={66.5} y={32} closed={closed} r={2.4} />
              <Path d="M58.6 37 L61.4 37 L60 38.8 Z" fill={PINK} />
              <Path d="M60 38.8 Q58.5 41.5 56.5 40.5 M60 38.8 Q61.5 41.5 63.5 40.5" stroke={INK} strokeWidth="1.2" fill="none" strokeLinecap="round" />
              <Line x1="44" y1="37" x2="53" y2="38.5" stroke={s.darker} strokeWidth="0.8" />
              <Line x1="67" y1="38.5" x2="77" y2="37" stroke={s.darker} strokeWidth="0.8" />
              <Circle cx="51" cy="39" r="2.6" fill={BLUSH} fillOpacity={0.5} />
              <Circle cx="69" cy="39" r="2.6" fill={BLUSH} fillOpacity={0.5} />
            </>
          )}
        </>
      );
    case "rabbit":
      return (
        <>
          <Ellipse cx="54" cy="17" rx="5.5" ry="16" transform="rotate(-14 54 30)" fill={s.main} />
          <Ellipse cx="54" cy="18" rx="2.6" ry="11" transform="rotate(-14 54 30)" fill={PINK} fillOpacity={0.55} />
          <Ellipse cx="66" cy="16" rx="5.5" ry="16" transform="rotate(10 66 30)" fill={s.dark} />
          <Ellipse cx="66" cy="17" rx="2.6" ry="11" transform="rotate(10 66 30)" fill={PINK} fillOpacity={0.45} />
          <Circle cx="20" cy="60" r="6.5" fill="#fbf7f1" />
          <Ellipse cx="42" cy="61" rx="23" ry="17" fill={s.main} />
          <Ellipse cx="35" cy="66" rx="13" ry="11" fill={s.dark} />
          <Ellipse cx="32" cy="76.5" rx="10" ry="2.8" fill={s.light} />
          <Ellipse cx="60" cy="75.5" rx="6" ry="3.4" fill={s.light} />
          <Ellipse cx="57" cy="59" rx="9" ry="10" fill={s.light} />
          {photo ?? (
            <>
              <Circle cx="63" cy="41" r="14" fill={s.main} />
              <Eye x={67} y={38} closed={closed} r={2.5} />
              <Circle cx="75.5" cy="43" r="1.9" fill={PINK} />
              <Path d="M75.5 45 Q74 47.5 72 46.5" stroke={INK} strokeWidth="1.1" fill="none" strokeLinecap="round" />
              <Circle cx="68" cy="45.5" r="2.6" fill={BLUSH} fillOpacity={0.5} />
            </>
          )}
        </>
      );
    case "bird":
      return (
        <>
          <Line x1="46" y1="70" x2="44" y2="78" stroke="#d58b3a" strokeWidth="2.4" strokeLinecap="round" />
          <Line x1="55" y1="70" x2="56" y2="78" stroke="#d58b3a" strokeWidth="2.4" strokeLinecap="round" />
          <Path d="M30 52 L13 44 L17 58 Z" fill={s.dark} />
          <Ellipse cx="50" cy="53" rx="22" ry="19" fill={s.main} />
          <Ellipse cx="56" cy="59" rx="13" ry="11" fill={s.light} />
          <Ellipse cx="42" cy="55" rx="12" ry="8.5" transform="rotate(-18 42 55)" fill={s.dark} />
          {photo ?? (
            <>
              <Circle cx="62" cy="36" r="13" fill={s.main} />
              <Path d="M57 24 Q60 17 64 23 Q66 18 69 24" fill={s.dark} />
              <Path d="M73.5 34 L83 37.5 L73.5 41 Z" fill="#f2a33a" />
              <Eye x={66} y={33} closed={closed} r={2.3} />
              <Circle cx="68" cy="40" r="2.4" fill={BLUSH} fillOpacity={0.55} />
            </>
          )}
        </>
      );
    case "fish":
      // A fish travels in its bowl.
      return (
        <>
          <Circle cx="50" cy="46" r="31" fill="#cfe8f5" fillOpacity={0.55} stroke="#a9cfe3" strokeWidth="2" />
          <Path d="M22 58 Q50 70 78 58 L76 64 Q50 82 24 64 Z" fill="#e3d5bc" />
          <Circle cx="38" cy="66" r="2.4" fill="#c9b48f" />
          <Circle cx="58" cy="68" r="2.4" fill="#b7cfa6" />
          <Path d="M28 66 Q30 54 34 50 Q33 58 36 66" fill="#7bad89" />
          {photo ?? (
            <>
              <Path d="M38 50 L28 42 L28 58 Z" fill={s.dark} />
              <Ellipse cx="50" cy="50" rx="14" ry="10" fill={s.main} />
              <Path d="M47 41 Q52 36 56 42" fill={s.dark} />
              <Path d="M50 52 Q46 56 49 59" stroke={s.light} strokeWidth="2.4" fill="none" strokeLinecap="round" />
              <Eye x={57} y={48} closed={closed} r={2.2} />
            </>
          )}
          <Circle cx="68" cy="30" r="2.2" fill="#ffffff" fillOpacity={0.8} />
          <Circle cx="72" cy="22" r="1.4" fill="#ffffff" fillOpacity={0.8} />
          <Ellipse cx="50" cy="16" rx="21" ry="4.5" fill="none" stroke="#a9cfe3" strokeWidth="2.4" />
          <Path d="M30 36 Q32 26 40 22" stroke="#ffffff" strokeOpacity={0.7} strokeWidth="2.4" fill="none" strokeLinecap="round" />
        </>
      );
    case "turtle":
      return (
        <>
          <Ellipse cx="30" cy="72" rx="7" ry="5.5" fill="#9cc28a" />
          <Ellipse cx="68" cy="72" rx="7" ry="5.5" fill="#9cc28a" />
          <Path d="M18 64 L12 62 L17 68 Z" fill="#9cc28a" />
          <Path d="M74 58 Q80 46 86 46" stroke="#9cc28a" strokeWidth="9" strokeLinecap="round" fill="none" />
          <Path d="M18 66 Q20 32 49 30 Q78 32 80 66 Z" fill={s.main} />
          <Path d="M36 40 L49 34 L62 40 L60 54 L38 54 Z" fill={s.dark} fillOpacity={0.55} />
          <Path d="M24 58 L36 54 M62 54 L74 58 M49 54 L49 64" stroke={s.dark} strokeWidth="2" strokeOpacity={0.6} />
          <Rect x="15" y="62" width="68" height="7" rx="3.5" fill={s.darker} />
          {photo ?? (
            <>
              <Circle cx="84" cy="50" r="10" fill="#9cc28a" />
              <Eye x={87} y={47} closed={closed} r={2.2} />
              <Path d="M88 54 Q86 55.5 84 54.5" stroke={INK} strokeWidth="1.1" fill="none" strokeLinecap="round" />
            </>
          )}
        </>
      );
    case "hamster":
      return (
        <>
          <Circle cx="40" cy="34" r="6.5" fill={s.dark} />
          <Circle cx="40" cy="34" r="3.4" fill={PINK} fillOpacity={0.6} />
          <Circle cx="70" cy="32" r="6.5" fill={s.dark} />
          <Circle cx="70" cy="32" r="3.4" fill={PINK} fillOpacity={0.6} />
          <Ellipse cx="54" cy="56" rx="27" ry="22" fill={s.main} />
          <Ellipse cx="57" cy="63" rx="16" ry="13" fill={s.light} />
          <Ellipse cx="46" cy="76" rx="6" ry="3" fill={s.light} />
          <Ellipse cx="66" cy="76" rx="6" ry="3" fill={s.light} />
          {photo ?? (
            <>
              <Eye x={50} y={47} closed={closed} r={2.4} />
              <Eye x={65} y={47} closed={closed} r={2.4} />
              <Circle cx="57.5" cy="53" r="1.9" fill={PINK} />
              <Path d="M57.5 55 Q55.5 57.5 54 56.5 M57.5 55 Q59.5 57.5 61 56.5" stroke={INK} strokeWidth="1.1" fill="none" strokeLinecap="round" />
              <Circle cx="45" cy="55" r="4" fill={BLUSH} fillOpacity={0.55} />
              <Circle cx="70" cy="55" r="4" fill={BLUSH} fillOpacity={0.55} />
            </>
          )}
          <Ellipse cx="51" cy="68" rx="3" ry="2.4" fill={s.dark} />
          <Ellipse cx="63" cy="68" rx="3" ry="2.4" fill={s.dark} />
        </>
      );
  }
}

// --- The bed and the bowl ---------------------------------------------------------------

export function BedArt({ style, color, width, height }: { style: BedStyle; color: string; width: number; height: number }) {
  const main = color;
  const light = shade(color, 0.42);
  const dark = shade(color, -0.25);
  return (
    <Svg width={width} height={height} viewBox="0 0 120 103" preserveAspectRatio="xMidYMax meet">
      <Ellipse cx="60" cy="100" rx="56" ry="3" fill="#000" fillOpacity={0.08} />
      {style === "house" ? (
        <>
          <Path d="M10 46 L60 6 L110 46 Z" fill={dark} />
          <Rect x="16" y="40" width="88" height="58" rx="5" fill={main} />
          <Path d="M10 46 L60 6 L110 46" stroke={shade(color, -0.45)} strokeWidth="6" strokeLinejoin="round" strokeLinecap="round" fill="none" />
          <Path d="M36 98 L36 66 Q36 46 60 46 Q84 46 84 66 L84 98 Z" fill={shade(color, -0.55)} fillOpacity={0.8} />
          <Rect x="42" y="18" width="36" height="9" rx="4" fill={light} fillOpacity={0.9} />
          <Ellipse cx="60" cy="94" rx="30" ry="6" fill={light} />
        </>
      ) : style === "basket" ? (
        <>
          <Ellipse cx="60" cy="66" rx="56" ry="16" fill={dark} />
          <Ellipse cx="60" cy="70" rx="46" ry="11" fill={light} />
          <Path d="M4 66 Q8 98 60 99 Q112 98 116 66 Q110 86 60 86 Q10 86 4 66 Z" fill={main} />
          {[18, 34, 50, 66, 82, 98].map((x) => (
            <Path key={x} d={`M${x} ${80 + Math.abs(60 - x) * -0.12} L${x + 4} ${96 - Math.abs(60 - x) * 0.1}`} stroke={dark} strokeWidth="2.4" strokeLinecap="round" />
          ))}
          <Path d="M8 70 Q60 92 112 70" stroke={light} strokeWidth="2" fill="none" strokeOpacity={0.6} />
        </>
      ) : (
        <>
          <Ellipse cx="60" cy="80" rx="57" ry="19" fill={dark} />
          <Ellipse cx="60" cy="76" rx="54" ry="16" fill={main} />
          <Ellipse cx="60" cy="78" rx="38" ry="9" fill={light} fillOpacity={0.7} />
          {[24, 60, 96].map((x) => (
            <Circle key={x} cx={x} cy={x === 60 ? 64 : 70} r="1.8" fill={dark} />
          ))}
        </>
      )}
    </Svg>
  );
}

export function BowlArt({ full, width, height, color }: { full: boolean; width: number; height: number; color: string }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 40 20" preserveAspectRatio="xMidYMax meet">
      {full ? (
        <>
          <Circle cx="14" cy="9" r="4" fill="#b9814d" />
          <Circle cx="20" cy="7" r="4.2" fill="#a7703f" />
          <Circle cx="26" cy="9" r="4" fill="#c28c58" />
        </>
      ) : null}
      <Path d="M3 9 L37 9 L33 19 L7 19 Z" fill={color} />
      <Rect x="2" y="8" width="36" height="3.5" rx="1.75" fill={shade(color, -0.25)} />
    </Svg>
  );
}

// "z z z" drifting up from a sleeping pet.
export function Snooze({ size, color, still = false }: { size: number; color: string; still?: boolean }) {
  const reduceMotion = useReducedMotion();
  const quiet = still || reduceMotion;
  return (
    <View pointerEvents="none" style={{ width: size, height: size, flexDirection: "row", alignItems: "flex-end" }}>
      {[0, 1, 2].map((i) => (
        <Zee key={i} index={i} size={size} color={color} still={quiet} />
      ))}
    </View>
  );
}

function Zee({ index, size, color, still }: { index: number; size: number; color: string; still: boolean }) {
  const t = useSharedValue(still ? 0.5 : 0);
  useEffect(() => {
    if (still) return;
    t.value = withDelay(index * 700, withRepeat(withTiming(1, { duration: 2100, easing: Easing.out(Easing.quad) }), -1));
  }, [still, index, t]);
  const style = useAnimatedStyle(() => ({
    opacity: still ? 0.8 - index * 0.2 : Math.sin(t.value * Math.PI),
    transform: [{ translateY: -t.value * size * 0.5 - index * size * 0.18 }, { translateX: t.value * size * 0.12 }],
  }));
  return (
    <Animated.View style={style}>
      <Text style={{ color, fontSize: size * (0.28 + index * 0.08), fontWeight: "800" }}>z</Text>
    </Animated.View>
  );
}
