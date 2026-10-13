import { useState } from "react";
import { StyleSheet, Switch, View } from "react-native";

import { cornerChoices, liftChoices, type Corners, type Lift } from "../../lib/decor";
import { tap } from "../../lib/feedback";
import { colors, themed, ui } from "../../lib/theme";
import {
  edges,
  hangers,
  materials,
  naturalSkin,
  sameSkin,
  skinFor,
  surpriseSkin,
  takesMaterial,
  tilts,
  type Edge,
  type Material,
  type WidgetSkin,
} from "../../lib/widget-skins";
import { widgetKindInfo, type WidgetConfig, type WidgetLook } from "../../lib/widgets";
import { Icon, type IconName } from "../icon";
import { Tap } from "../motion";
import { Text, TextInput } from "../text";
import { Button, Chip } from "../ui";
import { ColorPicker } from "./color-picker";
import { IconPicker } from "./icon-picker";
import { SkinSurface } from "./widget-skin";

// "How it looks" in the widget editor (CORE-126), in two parts so it never
// feels like a wall of settings. Simple has the choices that change the
// most: what it's made of, its color, what hangs it up and its lean, plus
// "Natural look" and "Surprise me". More has the fine print: edges, style,
// corners, shadow, border and icon. Which part you were in is remembered
// while the app is open.

type Part = "simple" | "more";
let rememberedPart: Part = "simple";

export type LookFields = { color?: string; corners?: Corners; lift?: Lift; border?: boolean; icon?: IconName };

export function WidgetLookEditor({
  widget,
  item,
  onWidget,
  onItem,
}: {
  widget: WidgetConfig;
  item: LookFields;
  onWidget: (changes: Partial<WidgetConfig>) => void;
  onItem: (changes: LookFields) => void;
}) {
  const [part, setPart] = useState<Part>(rememberedPart);
  const info = widgetKindInfo(widget.kind);
  const skin = skinFor(widget.kind, widget.skin);
  const material = takesMaterial(widget.kind);
  const colored = widget.kind !== "frame" && widget.kind !== "window";

  function setSkin(changes: WidgetSkin) {
    onWidget({ skin: { ...widget.skin, ...changes } });
  }
  function choose(next: Part) {
    tap();
    rememberedPart = next;
    setPart(next);
  }

  return (
    <>
      <View style={styles.tabs} accessibilityRole="tablist">
        {(
          [
            ["simple", "Simple"],
            ["more", "More"],
          ] as [Part, string][]
        ).map(([key, label]) => (
          <Tap
            key={key}
            onPress={() => choose(key)}
            style={[styles.tab, part === key && styles.tabOn]}
            accessibilityRole="tab"
            accessibilityState={{ selected: part === key }}
          >
            <Text style={[styles.tabText, part === key && styles.tabTextOn]}>{label}</Text>
          </Tap>
        ))}
      </View>

      {part === "simple" ? (
        <>
          <Text style={ui.label}>Title</Text>
          <View style={[ui.row, { gap: 10 }]}>
            <TextInput
              style={[ui.input, { flex: 1 }]}
              value={widget.title}
              onChangeText={(title) => onWidget({ title })}
              placeholder={info.label}
              placeholderTextColor={colors.muted}
            />
            <Switch value={widget.showTitle} onValueChange={(showTitle) => onWidget({ showTitle })} trackColor={{ true: colors.bark }} />
          </View>

          {material ? (
            <>
              <Text style={ui.label}>Made of</Text>
              <View style={styles.swatches}>
                {materials.map((m) => (
                  <SkinSwatch
                    key={m.key}
                    label={m.label}
                    material={m.key}
                    edge="plain"
                    color={item.color}
                    selected={skin.material === m.key}
                    onPress={() => setSkin({ material: m.key })}
                  />
                ))}
              </View>
            </>
          ) : null}

          {colored ? (
            <>
              <Text style={ui.label}>Color</Text>
              {skin.material !== "plain" ? (
                <View style={ui.chips}>
                  <Chip selected={!item.color} onPress={() => onItem({ color: undefined })}>
                    {`Natural ${materials.find((m) => m.key === skin.material)!.label.toLowerCase()}`}
                  </Chip>
                </View>
              ) : null}
              <ColorPicker
                value={item.color}
                fallback={skin.material === "plain" ? undefined : ""}
                onChange={(color) => onItem({ color })}
              />
              {skin.material !== "plain" ? <Text style={ui.muted}>A color tints what it's made of: the stain on wood, the color of felt.</Text> : null}
            </>
          ) : null}

          <Text style={ui.label}>Hung up with</Text>
          <View style={ui.chips}>
            {hangers.map((h) => (
              <Chip key={h.key} icon={h.icon} selected={skin.hanger === h.key} onPress={() => setSkin({ hanger: h.key })}>
                {h.label}
              </Chip>
            ))}
          </View>

          <Text style={ui.label}>Tilt</Text>
          <View style={ui.chips}>
            {tilts.map((t) => (
              <Chip key={t.key} selected={skin.tilt === t.key} onPress={() => setSkin({ tilt: t.key })}>
                {t.label}
              </Chip>
            ))}
          </View>

          <View style={[ui.row, { gap: 10, marginTop: 4 }]}>
            <Button
              title="Natural look"
              icon="leaf"
              variant="secondary"
              style={{ flex: 1 }}
              onPress={() => {
                const natural = naturalSkin(widget.kind);
                onWidget({ skin: natural });
                // Its material's own color, not one picked for a plain card.
                if (natural.material) onItem({ color: undefined });
              }}
            />
            <Button
              title="Surprise me"
              icon="sparkles"
              variant="secondary"
              style={{ flex: 1 }}
              onPress={() => onWidget({ skin: surpriseSkin(widget.kind, widget.skin, Math.random()) })}
            />
          </View>
          <Text style={ui.muted}>
            {sameSkin(widget.skin, naturalSkin(widget.kind))
              ? `This is how a ${info.label.toLowerCase()} widget starts out.`
              : "Natural look puts it back how this kind of widget starts out. Surprise me tries a different combination each tap."}
          </Text>
        </>
      ) : (
        <>
          {material ? (
            <>
              <Text style={ui.label}>Edges</Text>
              <View style={styles.swatches}>
                {edges.map((e) => (
                  <SkinSwatch
                    key={e.key}
                    label={e.label}
                    material={skin.material}
                    edge={e.key}
                    color={item.color}
                    selected={skin.edge === e.key}
                    onPress={() => setSkin({ edge: e.key })}
                  />
                ))}
              </View>
            </>
          ) : null}

          {skin.material === "plain" ? (
            <>
              <Text style={ui.label}>Style</Text>
              <View style={ui.chips}>
                {(
                  [
                    ["soft", "Soft"],
                    ["bold", "Bold"],
                    ["outline", "Outline"],
                  ] as [WidgetLook, string][]
                ).map(([look, label]) => (
                  <Chip key={look} selected={widget.look === look} onPress={() => onWidget({ look })}>
                    {label}
                  </Chip>
                ))}
              </View>
              {widget.kind === "companion" ? (
                <Text style={ui.muted}>Outline leaves out the card, so the bed sits right on your Hearth. The title switch shows or hides the pet's name.</Text>
              ) : null}
              {widget.kind === "fridge" ? (
                <Text style={ui.muted}>
                  Soft is a pastel fridge in the color you pick, Bold a deep one, and Outline leaves just the notes on your Hearth. The title is printed on a label-maker
                  strip.
                </Text>
              ) : null}
            </>
          ) : null}

          {skin.edge === "plain" || skin.edge === "stitch" ? (
            <>
              <Text style={ui.label}>Corners</Text>
              <View style={ui.chips}>
                {cornerChoices.map((c) => (
                  <Chip key={c.key} selected={(item.corners ?? "soft") === c.key} onPress={() => onItem({ corners: c.key })}>
                    {c.label}
                  </Chip>
                ))}
              </View>
            </>
          ) : null}

          <Text style={ui.label}>Shadow</Text>
          <View style={ui.chips}>
            {liftChoices.map((c) => (
              <Chip key={c.key} selected={(item.lift ?? "soft") === c.key} onPress={() => onItem({ lift: c.key })}>
                {c.label}
              </Chip>
            ))}
          </View>

          {colored ? (
            <>
              <Text style={ui.label}>Border</Text>
              <View style={ui.chips}>
                <Chip selected={!item.border} onPress={() => onItem({ border: false })}>
                  None
                </Chip>
                <Chip selected={Boolean(item.border)} onPress={() => onItem({ border: true })}>
                  Outlined
                </Chip>
              </View>
            </>
          ) : null}

          <Text style={ui.label}>Icon</Text>
          <IconPicker value={item.icon} fallback={info.icon} onChange={(icon) => onItem({ icon })} />
        </>
      )}
    </>
  );
}

// A little sample of a material or an edge.
function SkinSwatch({
  label,
  material,
  edge,
  color,
  selected,
  onPress,
}: {
  label: string;
  material: Material;
  edge: Edge;
  color?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Tap
      onPress={() => {
        tap();
        onPress();
      }}
      pressedScale={0.92}
      style={styles.swatch}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
    >
      <View style={[styles.sample, selected && styles.sampleOn]}>
        <View style={{ width: SAMPLE_W, height: SAMPLE_H }}>
          <SkinSurface material={material} edge={edge} color={color} fill={color ?? "#f3e7d3"} width={SAMPLE_W} height={SAMPLE_H} radius={10} level={1} />
        </View>
        {selected ? (
          <View style={styles.check}>
            <Icon name="check" size={12} color={colors.onAccent} />
          </View>
        ) : null}
      </View>
      <Text style={[styles.swatchText, selected && { color: colors.bark, fontWeight: "700" }]} numberOfLines={1}>
        {label}
      </Text>
    </Tap>
  );
}

const SAMPLE_W = 62;
const SAMPLE_H = 46;

const styles = themed(() =>
  StyleSheet.create({
    tabs: { flexDirection: "row", backgroundColor: colors.cream, borderRadius: 999, padding: 4, gap: 4 },
    tab: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 999 },
    tabOn: { backgroundColor: colors.surface, boxShadow: "0px 1px 3px rgba(0,0,0,0.12)" },
    tabText: { fontSize: 15, fontWeight: "600", color: colors.muted },
    tabTextOn: { color: colors.bark, fontWeight: "700" },
    swatches: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    swatch: { width: SAMPLE_W + 12, alignItems: "center", gap: 4 },
    sample: { padding: 4, borderRadius: 14, borderWidth: 2, borderColor: "transparent" },
    sampleOn: { borderColor: colors.bark },
    check: {
      position: "absolute",
      right: -4,
      top: -4,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.bark,
      alignItems: "center",
      justifyContent: "center",
    },
    swatchText: { fontSize: 12, color: colors.text, textAlign: "center" },
  })
);
