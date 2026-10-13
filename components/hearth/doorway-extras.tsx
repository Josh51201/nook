import { View } from "react-native";

import type { Doorway } from "../../lib/tile-looks";
import { DoormatUnder, FlowerBox, PorchLight } from "./tile-build";

// What sits around a Nook tile on the Hearth (CORE-139): a porch light
// beside it that glows when the Nook has news, and a flower box or doormat
// along its bottom. They reach a little outside the tile.
export function DoorwayExtras({ doorway, width, height, lit, color }: { doorway: Required<Doorway>; width: number; height: number; lit: boolean; color: string }) {
  return (
    <>
      {doorway.porchLight ? (
        <View pointerEvents="none" style={{ position: "absolute", left: -9, top: Math.max(4, height * 0.16) }}>
          <PorchLight lit={lit} />
        </View>
      ) : null}
      {doorway.below === "flowers" ? (
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: height - 15, alignItems: "center" }}>
          <FlowerBox width={width} />
        </View>
      ) : null}
      {doorway.below === "doormat" ? (
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: height + 1, alignItems: "center" }}>
          <DoormatUnder width={width} color={color} />
        </View>
      ) : null}
    </>
  );
}
