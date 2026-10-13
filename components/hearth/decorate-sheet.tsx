import { Image } from "expo-image";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import {
  ambienceLabel,
  ambiences,
  fireSounds,
  type FireSound,
  gradientPresets,
  patterns,
  photoDims,
  type Ambience,
  type Wallpaper,
} from "../../lib/decor";
import { tap } from "../../lib/feedback";
import { pickAndUploadPhoto, usePhotoUrls } from "../../lib/hearth-photos";
import { lookPacks } from "../../lib/look-packs";
import { colors, themed, ui } from "../../lib/theme";
import { BottomSheet } from "../bottom-sheet";
import { Icon, IconBadge } from "../icon";
import { Tap } from "../motion";
import { Collapsible } from "../collapsible";
import { Banner, Button, Chip } from "../ui";
import { Text } from "../text";
import { ColorPicker } from "./color-picker";

type Kind = Wallpaper["kind"] | "inherit";

// "Decorate" (CORE-041, CORE-047): the wallpaper behind this space and the
// weather in the air over the whole Hearth. Inside a Hollow the wallpaper can
// be its own, or the same as the Hearth's. Look packs (CORE-129) give every
// widget here a look that goes together.
export function DecorateSheet({
  visible,
  onClose,
  userId,
  inHollow,
  hollowName,
  wallpaper,
  onWallpaper,
  ambience,
  onAmbience,
  fireSound,
  onFireSound,
  weatherPlace,
  widgets = 0,
  onPack,
}: {
  visible: boolean;
  onClose: () => void;
  userId: string | undefined;
  inHollow: boolean;
  hollowName?: string;
  // This space's own wallpaper (a Hollow with none uses the Hearth's).
  wallpaper: Wallpaper | undefined;
  onWallpaper: (next: Wallpaper | undefined) => void;
  ambience: Ambience;
  onAmbience: (next: Ambience) => void;
  // The soft fireplace sound (CORE-047).
  fireSound: FireSound | undefined;
  onFireSound: (next: FireSound) => void;
  // The town "Match the weather" follows, if any (CORE-058).
  weatherPlace?: string;
  // How many widgets are in this space, and dressing them all in a pack.
  widgets?: number;
  onPack?: (id: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const kind: Kind = wallpaper?.kind ?? (inHollow ? "inherit" : "none");
  const photoUrls = usePhotoUrls(wallpaper?.kind === "photo" ? [wallpaper.path] : []);

  // What's chosen, for the closed sections (CORE-074).
  const wallpaperSummary = {
    inherit: "Same as the Hearth",
    none: "Plain",
    pattern: "Pattern",
    gradient: "Gradient",
    photo: "My photo",
  }[kind];

  function choose(next: Kind) {
    tap();
    switch (next) {
      case "inherit":
        return onWallpaper(undefined);
      case "none":
        return onWallpaper({ kind: "none" });
      case "pattern":
        return onWallpaper(wallpaper?.kind === "pattern" ? wallpaper : { kind: "pattern", pattern: "dots", color: "#dfe8d6" });
      case "gradient":
        return onWallpaper(
          wallpaper?.kind === "gradient"
            ? wallpaper
            : { kind: "gradient", from: gradientPresets[0].from, to: gradientPresets[0].to, direction: "down" }
        );
      case "photo":
        return wallpaper?.kind === "photo" ? undefined : choosePhoto();
    }
  }

  async function choosePhoto() {
    if (!userId || uploading) return;
    setUploading(true);
    const path = await pickAndUploadPhoto(userId);
    setUploading(false);
    if (path) onWallpaper({ kind: "photo", path, dim: wallpaper?.kind === "photo" ? wallpaper.dim : 0.4 });
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      header={
        <View style={[ui.row, { gap: 12 }]}>
          <IconBadge name="palette" size={44} />
          <Text style={[ui.sectionTitle, { marginTop: 0, flex: 1 }]} numberOfLines={1}>
            {inHollow ? `Decorate ${hollowName ?? "this Hollow"}` : "Decorate your Hearth"}
          </Text>
        </View>
      }
    >
      <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
        <Collapsible id="decorate-wallpaper" icon="paint" title="Wallpaper" summary={wallpaperSummary} defaultOpen>
          <View style={ui.chips}>
            {inHollow ? (
              <Chip icon="hearth" selected={kind === "inherit"} onPress={() => choose("inherit")}>
                Same as the Hearth
              </Chip>
            ) : null}
            <Chip icon="close" selected={kind === "none"} onPress={() => choose("none")}>
              Plain
            </Chip>
            <Chip icon="category" selected={kind === "pattern"} onPress={() => choose("pattern")}>
              Pattern
            </Chip>
            <Chip icon="palette" selected={kind === "gradient"} onPress={() => choose("gradient")}>
              Gradient
            </Chip>
            <Chip icon="camera" selected={kind === "photo"} onPress={() => choose("photo")}>
              My photo
            </Chip>
          </View>

          {wallpaper?.kind === "pattern" ? (
            <>
              <Text style={ui.label}>Pattern</Text>
              <View style={ui.chips}>
                {patterns.map((p) => (
                  <Chip key={p.key} selected={wallpaper.pattern === p.key} onPress={() => onWallpaper({ ...wallpaper, pattern: p.key })}>
                    {p.label}
                  </Chip>
                ))}
              </View>
              <Text style={ui.label}>Color</Text>
              <ColorPicker value={wallpaper.color} onChange={(color) => onWallpaper({ ...wallpaper, color })} />
            </>
          ) : null}

          {wallpaper?.kind === "gradient" ? (
            <>
              <Text style={ui.label}>Colors</Text>
              <View style={ui.chips}>
                {gradientPresets.map((g) => (
                  <Chip
                    key={g.key}
                    selected={wallpaper.from === g.from && wallpaper.to === g.to}
                    onPress={() => onWallpaper({ ...wallpaper, from: g.from, to: g.to })}
                  >
                    {g.label}
                  </Chip>
                ))}
              </View>
              <Text style={ui.label}>Top color</Text>
              <ColorPicker value={wallpaper.from} fallback={wallpaper.from} onChange={(from) => onWallpaper({ ...wallpaper, from })} />
              <Text style={ui.label}>Bottom color</Text>
              <ColorPicker value={wallpaper.to} fallback={wallpaper.to} onChange={(to) => onWallpaper({ ...wallpaper, to })} />
              <Text style={ui.label}>Direction</Text>
              <View style={ui.chips}>
                <Chip selected={wallpaper.direction === "down"} onPress={() => onWallpaper({ ...wallpaper, direction: "down" })}>
                  Top to bottom
                </Chip>
                <Chip selected={wallpaper.direction === "diagonal"} onPress={() => onWallpaper({ ...wallpaper, direction: "diagonal" })}>
                  Corner to corner
                </Chip>
              </View>
            </>
          ) : null}

          {wallpaper?.kind === "photo" ? (
            <>
              <View style={styles.preview}>
                {photoUrls.get(wallpaper.path) ? (
                  <Image source={{ uri: photoUrls.get(wallpaper.path) }} style={StyleSheet.absoluteFill} contentFit="cover" />
                ) : null}
              </View>
              <Text style={ui.label}>How strong the photo is</Text>
              <View style={ui.chips}>
                {photoDims.map((d) => (
                  <Chip key={d.dim} selected={wallpaper.dim === d.dim} onPress={() => onWallpaper({ ...wallpaper, dim: d.dim })}>
                    {d.label}
                  </Chip>
                ))}
              </View>
              <Text style={ui.muted}>A softer photo keeps your text easy to read.</Text>
              <Button title="Choose a different photo" icon="camera" variant="secondary" onPress={choosePhoto} loading={uploading} />
            </>
          ) : null}
          {uploading && wallpaper?.kind !== "photo" ? <Text style={ui.muted}>Adding your photo…</Text> : null}
        </Collapsible>
        {onPack ? (
          <Collapsible
            id="decorate-packs"
            icon="widgets"
            title="Widget looks"
            summary={widgets ? `Dress all ${widgets} widget${widgets === 1 ? "" : "s"} at once` : "No widgets here yet"}
          >
            <Text style={ui.muted}>
              {`One tap gives every widget ${inHollow ? "in this Hollow" : "on this page"} a look that goes together. They keep their colors, and you can undo it.`}
            </Text>
            {lookPacks.map((pack) => (
              <Tap
                key={pack.id}
                onPress={() => {
                  tap();
                  onPack(pack.id);
                }}
                disabled={!widgets}
                style={[styles.pack, !widgets && { opacity: 0.5 }]}
                accessibilityRole="button"
                accessibilityLabel={`${pack.label}: ${pack.blurb}`}
              >
                <IconBadge name={pack.icon} size={38} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.packName}>{pack.label}</Text>
                  <Text style={ui.muted} numberOfLines={2}>
                    {pack.blurb}
                  </Text>
                </View>
                <Icon name="chevron" size={16} color={colors.muted} />
              </Tap>
            ))}
          </Collapsible>
        ) : null}
        <Collapsible id="decorate-ambience" icon="sparkles" title="Ambience" summary={ambienceLabel(ambience)}>
          <View style={ui.chips}>
            {ambiences.map((a) => (
              <Chip key={a.key} icon={a.icon} selected={ambience === a.key} onPress={() => (tap(), onAmbience(a.key))}>
                {a.label}
              </Chip>
            ))}
          </View>
          <Text style={ui.muted}>
            The air over your whole Hearth, paused while you're editing. “Follow the season” picks snow, petals,
            sunbeam dust or leaves, and fireflies at night. “Match the weather” brings rain or snow when it's
            raining or snowing outside, and follows the season otherwise. Off if your phone's Reduce Motion is on.
          </Text>
          {ambience === "weather" ? (
            <Banner
              icon="umbrella"
              tone="sky"
              title={weatherPlace ? `Matching the weather in ${weatherPlace}` : "Pick a town first"}
              body={
                weatherPlace
                  ? "From your Weather widget (or a Window showing live weather)."
                  : "Add a Weather widget, or a Window set to live weather, and choose a town in its settings."
              }
            />
          ) : null}
        </Collapsible>

        <Collapsible
          id="decorate-fire"
          icon="flame"
          title="Fireplace sound"
          summary={fireSounds.find((f) => f.key === (fireSound ?? "off"))?.label}
        >
          <View style={ui.chips}>
            {fireSounds.map((f) => (
              <Chip
                key={f.key}
                icon={f.key === "off" ? "close" : "flame"}
                selected={(fireSound ?? "off") === f.key}
                onPress={() => (tap(), onFireSound(f.key))}
              >
                {f.label}
              </Chip>
            ))}
          </View>
          <Text style={ui.muted}>
            A crackling fire while you're on your Hearth or in a Hollow. It fades away when you open a Nook or leave
            the app, stays quiet when your phone is on silent, and plays along with any music you have on.
          </Text>
        </Collapsible>

        <Button title="Done" icon="check" onPress={onClose} style={{ marginTop: 6 }} />
      </ScrollView>
    </BottomSheet>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    pack: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
    packName: { fontSize: 16, fontWeight: "700", color: colors.text },
    preview: {
      height: 120,
      borderRadius: 18,
      overflow: "hidden",
      backgroundColor: colors.barkSoft,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
  })
);
