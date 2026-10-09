import type { ReactNode } from "react";
import { View } from "react-native";
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Line, LinearGradient, Path, Pattern, Rect, Stop } from "react-native-svg";

import { deepOf, hexToHsl, hslToHex } from "../../lib/colors";
import { CUBBY_OUTSET, cubbyFillOpacity, cubbyShades, cubbyStyleInfo, type CubbyFill, type CubbyStyle } from "../../lib/cubbies";
import { cornerRadius, type Corners, type PatternKey } from "../../lib/decor";
import { PatternTile, patternTileSize } from "./wallpaper";

// The drawings behind Cubbies (CORE-084): a decorated box drawn a little
// bigger than its cells, so its edge frames whatever sits inside it. Most of
// a box is hidden under the widgets in it, so the decorating lives where it
// shows: the edges, the corners and the gaps. A few touches (a bow, a shelf's
// ledge) reach a little further out still.

const BLEED = 10;

type Shades = ReturnType<typeof cubbyShades>;

export function CubbyArt({
  uid,
  styleKey,
  color,
  pattern,
  fill,
  corners,
  shadow,
  width,
  height,
}: {
  // Something unique to this box, for its drawing's ids.
  uid: string;
  styleKey: CubbyStyle;
  color: string;
  pattern?: PatternKey;
  fill?: CubbyFill;
  corners?: Corners;
  // The resting shadow under it (a CSS box-shadow), if any.
  shadow?: string;
  // The size of its cells; the box is drawn around them.
  width: number;
  height: number;
}) {
  const O = CUBBY_OUTSET;
  const W = width + O * 2;
  const H = height + O * 2;
  const r = cornerRadius(corners ?? cubbyStyleInfo(styleKey).corners, W, H);
  const s = cubbyShades(color);
  const box = { x: BLEED, y: BLEED, w: W, h: H, r };
  const id = uid.replace(/[^a-zA-Z0-9_-]/g, "");
  // Takes up its cells (so it can be held and dragged there), and draws
  // around them.
  return (
    <View pointerEvents="none" style={{ width, height }}>
      {shadow ? (
        <View style={{ position: "absolute", left: -O, top: -O, width: W, height: H, borderRadius: r, boxShadow: shadow }} />
      ) : null}
      <Svg width={W + BLEED * 2} height={H + BLEED * 2} style={{ position: "absolute", left: -O - BLEED, top: -O - BLEED }}>
        <Defs>
          <ClipPath id={`clip-${id}`}>
            <Path d={roundRect(box.x, box.y, box.w, box.h, r)} />
          </ClipPath>
          {pattern ? (
            <Pattern id={`pat-${id}`} patternUnits="userSpaceOnUse" {...patternTileSize(pattern)}>
              <PatternTile pattern={pattern} ink={deepOf(color)} opacity={0.24} />
            </Pattern>
          ) : null}
          <LinearGradient id={`shade-${id}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={s.darker} stopOpacity={0.38} />
            <Stop offset="1" stopColor={s.darker} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Box styleKey={styleKey} box={box} s={s} id={id} opacity={cubbyFillOpacity(fill)} hasPattern={Boolean(pattern)} />
      </Svg>
    </View>
  );
}

type BoxGeo = { x: number; y: number; w: number; h: number; r: number };

function Box({
  styleKey,
  box,
  s,
  id,
  opacity,
  hasPattern,
}: {
  styleKey: CubbyStyle;
  box: BoxGeo;
  s: Shades;
  id: string;
  opacity: number;
  hasPattern: boolean;
}) {
  const { x, y, w, h, r } = box;
  const O = CUBBY_OUTSET;
  const outer = roundRect(x, y, w, h, r);
  // The inside of a framed style (crate, picture frame), or the whole box.
  const framed = styleKey === "crate" || styleKey === "frame";
  const t = framed ? O : 0;
  const inner = roundRect(x + t, y + t, w - t * 2, h - t * 2, Math.max(0, r - t));
  const printed: ReactNode = hasPattern ? <Path d={inner} fill={`url(#pat-${id})`} opacity={Math.max(0.5, opacity)} /> : null;
  const cx = x + w / 2;

  switch (styleKey) {
    case "cardboard": {
      const flap = O + 4;
      return (
        <>
          <Path d={outer} fill={s.main} fillOpacity={opacity} />
          {printed}
          <G clipPath={`url(#clip-${id})`}>
            {/* The top flaps, folded down, with their seam. */}
            <Rect x={x} y={y} width={w} height={flap} fill={s.light} fillOpacity={0.45} />
            <Line x1={x} y1={y + flap} x2={x + w} y2={y + flap} stroke={s.dark} strokeOpacity={0.35} strokeWidth={1} />
            <Line x1={cx} y1={y} x2={cx} y2={y + flap} stroke={s.dark} strokeOpacity={0.5} strokeWidth={1} />
          </G>
          {/* Packing tape over the seam, top and bottom. */}
          <Rect x={cx - 13} y={y - 3} width={26} height={flap + 8} fill="#fff6e0" fillOpacity={0.6} stroke={s.dark} strokeOpacity={0.15} />
          <Rect x={cx - 13} y={y + h - O - 6} width={26} height={O + 9} fill="#fff6e0" fillOpacity={0.6} stroke={s.dark} strokeOpacity={0.15} />
          {/* Hand holes on the sides. */}
          {h > 90 ? (
            <>
              <Ellipse cx={x + O / 2} cy={y + h / 2} rx={2.2} ry={7} fill={s.darker} fillOpacity={0.55} />
              <Ellipse cx={x + w - O / 2} cy={y + h / 2} rx={2.2} ry={7} fill={s.darker} fillOpacity={0.55} />
            </>
          ) : null}
          {/* "This way up". */}
          {w > 110 ? (
            <Path
              d={`M${x + w - 30} ${y + 9} l3 -4 l3 4 M${x + w - 27} ${y + 5} v6 M${x + w - 22} ${y + 9} l3 -4 l3 4 M${x + w - 19} ${y + 5} v6`}
              stroke={s.darker}
              strokeOpacity={0.55}
              strokeWidth={1.3}
              strokeLinecap="round"
              fill="none"
            />
          ) : null}
          <Path d={outer} fill="none" stroke={s.dark} strokeOpacity={0.8} strokeWidth={2} />
        </>
      );
    }

    case "crate": {
      const planks = Math.max(0, Math.floor((h - t * 2) / 24));
      // Where the mitred joints start: on the rounded corner, not past it.
      const k = r * (1 - Math.SQRT1_2);
      const nails = [
        [x + t / 2, y + t / 2],
        [x + w - t / 2, y + t / 2],
        [x + t / 2, y + h - t / 2],
        [x + w - t / 2, y + h - t / 2],
        ...(w > 160 ? [[cx, y + t / 2], [cx, y + h - t / 2]] : []),
      ];
      return (
        <>
          <Path d={inner} fill={s.main} fillOpacity={opacity} />
          {printed}
          {Array.from({ length: planks }, (_, i) => (
            <Line key={i} x1={x + t} y1={y + t + (i + 1) * 24} x2={x + w - t} y2={y + t + (i + 1) * 24} stroke={s.dark} strokeOpacity={0.3} strokeWidth={1.2} />
          ))}
          {/* The frame of boards, with their grain and mitred corners. */}
          <Path d={`${outer} ${inner}`} fill={s.dark} fillRule="evenodd" />
          <Path
            d={`M${x + t} ${y + t / 2} H${x + w - t} M${x + t} ${y + h - t / 2} H${x + w - t} M${x + t / 2} ${y + t} V${y + h - t} M${x + w - t / 2} ${y + t} V${y + h - t}`}
            stroke={s.darker}
            strokeOpacity={0.3}
            strokeWidth={1}
          />
          <Path
            d={`M${x + k} ${y + k} L${x + t} ${y + t} M${x + w - k} ${y + k} L${x + w - t} ${y + t} M${x + k} ${y + h - k} L${x + t} ${y + h - t} M${x + w - k} ${y + h - k} L${x + w - t} ${y + h - t}`}
            stroke={s.darker}
            strokeOpacity={0.45}
            strokeWidth={1}
          />
          {nails.map(([nx, ny], i) => (
            <Circle key={i} cx={nx} cy={ny} r={1.8} fill={s.darker} />
          ))}
          <Path d={outer} fill="none" stroke={s.darker} strokeOpacity={0.6} strokeWidth={1.2} />
        </>
      );
    }

    case "gift": {
      const ribbon = deepOf(s.main);
      const lid = O + 3;
      return (
        <>
          <Path d={outer} fill={s.main} fillOpacity={opacity} />
          {printed}
          <G clipPath={`url(#clip-${id})`}>
            <Rect x={x} y={y} width={w} height={lid} fill={s.light} fillOpacity={0.35} />
            <Line x1={x} y1={y + lid} x2={x + w} y2={y + lid} stroke={s.dark} strokeOpacity={0.45} strokeWidth={1.2} />
            {/* Ribbon both ways round, showing in the gaps. */}
            <Rect x={cx - 7} y={y} width={14} height={h} fill={ribbon} fillOpacity={0.88} />
            <Rect x={x} y={y + h / 2 - 7} width={w} height={14} fill={ribbon} fillOpacity={0.88} />
            <Line x1={cx} y1={y} x2={cx} y2={y + h} stroke="#ffffff" strokeOpacity={0.3} strokeWidth={1.5} />
            <Line x1={x} y1={y + h / 2} x2={x + w} y2={y + h / 2} stroke="#ffffff" strokeOpacity={0.3} strokeWidth={1.5} />
          </G>
          <Path d={outer} fill="none" stroke={s.dark} strokeOpacity={0.4} strokeWidth={1.2} />
          {/* The bow, sitting on the lid. */}
          <G>
            <Path d={`M${cx - 3} ${y + 6} l-5 9 l4 -1 l1 4 Z M${cx + 3} ${y + 6} l5 9 l-4 -1 l-1 4 Z`} fill={ribbon} />
            <Ellipse cx={cx - 10} cy={y - 2} rx={10} ry={6.5} fill={ribbon} stroke={s.darker} strokeOpacity={0.35} transform={`rotate(-18 ${cx - 10} ${y - 2})`} />
            <Ellipse cx={cx + 10} cy={y - 2} rx={10} ry={6.5} fill={ribbon} stroke={s.darker} strokeOpacity={0.35} transform={`rotate(18 ${cx + 10} ${y - 2})`} />
            <Ellipse cx={cx - 10} cy={y - 2} rx={4.5} ry={2.4} fill={s.darker} fillOpacity={0.35} transform={`rotate(-18 ${cx - 10} ${y - 2})`} />
            <Ellipse cx={cx + 10} cy={y - 2} rx={4.5} ry={2.4} fill={s.darker} fillOpacity={0.35} transform={`rotate(18 ${cx + 10} ${y - 2})`} />
            <Circle cx={cx} cy={y} r={4.8} fill={ribbon} stroke={s.darker} strokeOpacity={0.4} />
          </G>
        </>
      );
    }

    case "quilted":
      return (
        <>
          <Path d={outer} fill={s.main} fillOpacity={opacity} />
          {printed}
          <Path d={roundRect(x + 1.5, y + 1.5, w - 3, h - 3, Math.max(0, r - 1.5))} fill="none" stroke="#ffffff" strokeOpacity={0.5} strokeWidth={1.5} />
          {/* Running stitches all the way round. */}
          <Path
            d={roundRect(x + 4.5, y + 4.5, w - 9, h - 9, Math.max(0, r - 4.5))}
            fill="none"
            stroke={s.darker}
            strokeOpacity={0.6}
            strokeWidth={1.6}
            strokeDasharray="5 4"
            strokeLinecap="round"
          />
          <Path d={outer} fill="none" stroke={s.dark} strokeOpacity={0.35} strokeWidth={1.5} />
        </>
      );

    case "frame": {
      const corners = [
        [x + t / 2, y + t / 2],
        [x + w - t / 2, y + t / 2],
        [x + t / 2, y + h - t / 2],
        [x + w - t / 2, y + h - t / 2],
      ];
      return (
        <>
          {/* The mat inside the frame. */}
          <Path d={inner} fill={s.light} fillOpacity={opacity} />
          {printed}
          <Path d={`${outer} ${inner}`} fill={s.main} fillRule="evenodd" />
          <Path d={roundRect(x + 2.5, y + 2.5, w - 5, h - 5, Math.max(0, r - 2.5))} fill="none" stroke={s.light} strokeOpacity={0.9} strokeWidth={1.2} />
          <Path d={roundRect(x + t - 1.5, y + t - 1.5, w - (t - 1.5) * 2, h - (t - 1.5) * 2, Math.max(0, r - t))} fill="none" stroke={s.dark} strokeOpacity={0.7} strokeWidth={1.2} />
          <Path d={outer} fill="none" stroke={s.darker} strokeOpacity={0.55} strokeWidth={1.5} />
          {corners.map(([dx, dy], i) => (
            <Path key={i} d={`M${dx} ${dy - 4} L${dx + 4} ${dy} L${dx} ${dy + 4} L${dx - 4} ${dy} Z`} fill={s.light} stroke={s.darker} strokeOpacity={0.5} strokeWidth={0.8} />
          ))}
          <Circle cx={cx} cy={y + t / 2} r={3.4} fill={s.light} stroke={s.darker} strokeOpacity={0.5} strokeWidth={0.8} />
        </>
      );
    }

    case "scrapbook": {
      const tape = washiColor(s.main);
      const strip = (tx: number, ty: number, angle: number, key: string) => (
        <G key={key} transform={`rotate(${angle} ${tx} ${ty})`}>
          <Rect x={tx - 20} y={ty - 6.5} width={40} height={13} fill={tape} fillOpacity={0.82} />
          <Path d={`M${tx - 12} ${ty - 6.5} l-4 13 M${tx - 2} ${ty - 6.5} l-4 13 M${tx + 8} ${ty - 6.5} l-4 13 M${tx + 18} ${ty - 6.5} l-4 13`} stroke="#ffffff" strokeOpacity={0.45} strokeWidth={2} />
        </G>
      );
      return (
        <>
          <Path d={outer} fill={s.main} fillOpacity={opacity} />
          {printed}
          <Path d={outer} fill="none" stroke={s.dark} strokeOpacity={0.3} strokeWidth={1} />
          {strip(x + 8, y + 8, -40, "tl")}
          {strip(x + w - 8, y + 8, 40, "tr")}
          {strip(x + w - 8, y + h - 8, -40, "br")}
          {/* A little doodled heart in the corner. */}
          <Path
            d={`M${x + 12} ${y + h - 3.5} c-4 -3 -6 -5 -6 -7 a2.6 2.6 0 0 1 6 -1 a2.6 2.6 0 0 1 6 1 c0 2 -2 4 -6 7 Z`}
            fill={tape}
            fillOpacity={0.9}
          />
        </>
      );
    }

    case "glass":
      return (
        <>
          <Path d={outer} fill={s.main} fillOpacity={opacity * 0.85} />
          <Path d={outer} fill="#ffffff" fillOpacity={0.16} />
          {printed}
          <G clipPath={`url(#clip-${id})`}>
            {/* Light catching the glass. */}
            <Path d={`M${x + w * 0.1} ${y} L${x + w * 0.22} ${y} L${x} ${y + h * 0.3} L${x} ${y + h * 0.14} Z`} fill="#ffffff" fillOpacity={0.3} />
            <Path d={`M${x + w * 0.26} ${y} L${x + w * 0.3} ${y} L${x} ${y + h * 0.42} L${x} ${y + h * 0.36} Z`} fill="#ffffff" fillOpacity={0.22} />
          </G>
          <Path d={roundRect(x + 1, y + 1, w - 2, h - 2, Math.max(0, r - 1))} fill="none" stroke="#ffffff" strokeOpacity={0.8} strokeWidth={1.6} />
          <Path d={outer} fill="none" stroke={s.dark} strokeOpacity={0.3} strokeWidth={1} />
        </>
      );

    case "shelf": {
      const ledgeTop = y + h - O + 1;
      const brackets = [x + w * 0.2, x + w * 0.8];
      return (
        <>
          <Path d={outer} fill={s.main} fillOpacity={opacity} />
          {printed}
          <G clipPath={`url(#clip-${id})`}>
            {/* The box's inside walls, in shadow at the top. */}
            <Rect x={x} y={y} width={w} height={22} fill={`url(#shade-${id})`} />
            <Rect x={x} y={y} width={5} height={h} fill={s.dark} fillOpacity={0.22} />
            <Rect x={x + w - 5} y={y} width={5} height={h} fill={s.dark} fillOpacity={0.22} />
          </G>
          <Path d={outer} fill="none" stroke={s.dark} strokeOpacity={0.55} strokeWidth={1.5} />
          {/* The ledge it all stands on. */}
          {brackets.map((bx, i) => (
            <Path key={i} d={`M${bx - 5} ${ledgeTop + O + 4} L${bx + 5} ${ledgeTop + O + 4} L${bx} ${ledgeTop + O + 10} Z`} fill="#8a5f3c" />
          ))}
          <Rect x={x - 6} y={ledgeTop} width={w + 12} height={O + 5} rx={3} fill="#b98a5e" stroke="#8a5f3c" strokeOpacity={0.7} />
          <Line x1={x - 4} y1={ledgeTop + 1.5} x2={x + w + 4} y2={ledgeTop + 1.5} stroke="#dcb68c" strokeWidth={1.2} />
        </>
      );
    }
  }
}

// A cheerful tape color to go with the page: its color turned round the
// color wheel, light and soft.
function washiColor(main: string) {
  const { h } = hexToHsl(main);
  return hslToHex((h + 150) % 360, 0.5, 0.72);
}

function roundRect(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  return `M${x + rr} ${y} H${x + w - rr} A${rr} ${rr} 0 0 1 ${x + w} ${y + rr} V${y + h - rr} A${rr} ${rr} 0 0 1 ${x + w - rr} ${y + h} H${x + rr} A${rr} ${rr} 0 0 1 ${x} ${y + h - rr} V${y + rr} A${rr} ${rr} 0 0 1 ${x + rr} ${y} Z`;
}

// A small Cubby for pickers: a box with two little tiles in it, so you can
// see how it frames things.
export function CubbyThumb({ styleKey, color, size }: { styleKey: CubbyStyle; color: string; size: number }) {
  const width = 112;
  const height = 74;
  const room = CUBBY_OUTSET + BLEED;
  const scale = size / (width + room * 2);
  // Drawn once and kept as a picture, so a sheet full of them scrolls smoothly.
  return (
    <View style={{ width: size, height: (height + room * 2) * scale }} shouldRasterizeIOS renderToHardwareTextureAndroid>
      <View style={{ position: "absolute", left: room * scale, top: room * scale, width, height, transform: [{ scale }], transformOrigin: "top left" }}>
        <View style={{ position: "absolute", left: 0, top: 0 }}>
          <CubbyArt uid={`thumb-${styleKey}`} styleKey={styleKey} color={color} width={width} height={height} />
        </View>
        <View style={{ position: "absolute", left: 0, top: 0, width: 50, height, borderRadius: 14, backgroundColor: "#ffffffd9" }} />
        <View style={{ position: "absolute", left: 62, top: 0, width: 50, height, borderRadius: 14, backgroundColor: "#ffffffd9" }} />
      </View>
    </View>
  );
}
