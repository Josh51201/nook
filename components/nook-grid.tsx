import { useState, type ReactNode } from "react";
import { PixelRatio, View } from "react-native";

import { colors, currentTextScale } from "../lib/theme";
import { shortNookName, type NookDefinition } from "../lib/nooks";
import { Icon, IconBadge } from "./icon";
import { Appear, Tap } from "./motion";
import { Text } from "./text";

// Nooks as a grid of small icons, like a phone's home screen, so a long
// list of Nooks stays one glance tall instead of a long scroll. The number
// of columns follows the space there is (and the phone's text size), so the
// names under the icons have room on small phones and big tablets alike.
// `onAdd` puts a little "+" on each icon (put it on your Hearth), or only
// on the ones `canAdd` allows; `wrap` lets the screen wrap one icon (the
// tour points at the first).
export function NookGrid({
  nooks,
  onOpen,
  onAdd,
  canAdd,
  wrap,
}: {
  nooks: NookDefinition[];
  onOpen: (nook: NookDefinition) => void;
  onAdd?: (nook: NookDefinition) => void;
  canAdd?: (nook: NookDefinition) => boolean;
  wrap?: (nook: NookDefinition, index: number, tile: ReactNode) => ReactNode;
}) {
  const [width, setWidth] = useState(0);
  const gap = 10;
  // Roughly 84pt per icon at normal text size; fewer, wider ones with big
  // text (the phone's setting or Nook's own, CORE-068).
  const scale = Math.min(Math.max(PixelRatio.getFontScale() * currentTextScale(), 1), 1.6);
  const columns = width ? Math.max(3, Math.min(6, Math.floor((width + gap) / (84 * scale + gap)))) : 4;
  // A hair under the exact share, so rounding never pushes one onto a new row.
  const tileWidth = width ? Math.floor((width - gap * (columns - 1)) / columns) : 0;

  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={{ flexDirection: "row", flexWrap: "wrap", gap, opacity: width ? 1 : 0 }}
    >
      {width
        ? nooks.map((nook, i) => {
            const tile = (
              <Appear key={nook.id} index={i}>
                <View style={{ width: tileWidth, alignItems: "center" }}>
                  <Tap
                    onPress={() => onOpen(nook)}
                    pressedScale={0.92}
                    style={{ alignItems: "center", gap: 6, width: "100%", paddingVertical: 4 }}
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${nook.title}`}
                    accessibilityHint={nook.tagline}
                  >
                    <IconBadge name={nook.icon} size={58} color={nook.iconColor} background={nook.color} />
                    <Text
                      style={{ fontSize: 13, lineHeight: 16, fontWeight: "600", color: colors.text, textAlign: "center" }}
                      numberOfLines={2}
                    >
                      {shortNookName(nook)}
                    </Text>
                  </Tap>
                  {onAdd && (!canAdd || canAdd(nook)) ? (
                    <Tap
                      onPress={() => onAdd(nook)}
                      hitSlop={10}
                      pressedScale={0.85}
                      style={{
                        position: "absolute",
                        top: -2,
                        // Tucked against the icon's top-right corner.
                        left: tileWidth / 2 + 18,
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: colors.bark,
                        borderWidth: 2,
                        borderColor: colors.background,
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Add ${nook.title} to your Hearth`}
                    >
                      <Icon name="add" size={12} color={colors.background} />
                    </Tap>
                  ) : null}
                </View>
              </Appear>
            );
            return wrap ? wrap(nook, i, tile) : tile;
          })
        : null}
    </View>
  );
}
