import { useEffect, useRef, useState } from "react";
import { ScrollView, Switch, View } from "react-native";
import { Text, TextInput } from "../text";

import { cornerChoices, liftChoices, tileShapes } from "../../lib/decor";
import { Slider } from "../slider";
import { tap } from "../../lib/feedback";
import {
  hollowDecors,
  labelDecors,
  labelIsBold,
  hollowLookInfo,
  hollowLooks,
  itemColor,
  nookLabel,
  sizePresets,
  type HearthItem,
  type HollowItem,
  type LabelItem,
  type NookItem,
  type Scope,
  type TrinketItem,
} from "../../lib/hearth";
import { labelFonts } from "../../lib/fonts";
import { lookSummary, sizeSummary, tagsSummary } from "../../lib/summaries";
import { trinketInfo, trinkets } from "../../lib/trinkets";
import { showInWords } from "../../lib/widget-extras";
import { findNook } from "../../lib/nooks";
import { colors, ui } from "../../lib/theme";
import { BottomSheet } from "../bottom-sheet";
import { Collapsible } from "../collapsible";
import { IconBadge } from "../icon";
import { Button, Chip } from "../ui";
import { ColorPicker } from "./color-picker";
import { SeasonPicker } from "./season-picker";
import { TagsEditor } from "./tag-bar";
import { IconPicker } from "./icon-picker";
import { TrinketThumb } from "./trinket-art";

type Editable = NookItem | LabelItem | HollowItem | TrinketItem;

export type MoveTarget = { scope: Scope; label: string };

// Bottom sheet for a Nook tile, a text label or a Hollow: what it says or is
// called, how big it is, its color, a Nook tile's icon and look, a Hollow's
// look and decorations (CORE-030/031), where it lives — on the Hearth or
// inside a Hollow — and making a copy of it somewhere (CORE-039). (Widgets
// have their own full editor.)
// Drag the grabber or title down to close.
export function ItemOptions({
  item,
  onChange,
  onResize,
  onOpen,
  onDivider,
  knownTags = [],
  onRemove,
  onClose,
  moveTargets = [],
  onMoveTo,
  copyTargets = [],
  onCopyTo,
  onStartMove,
}: {
  item: Editable | null;
  onChange: (changes: Partial<HearthItem>) => void;
  onResize: (w: number, h: number) => void;
  onOpen?: () => void;
  // Make a text label a full-width fold-away divider, or a plain label again.
  onDivider?: (on: boolean) => void;
  // Tags in use anywhere, to pick from (CORE-065).
  knownTags?: string[];
  onRemove: () => void;
  onClose: () => void;
  // Places this item could move to (the Hearth, or other Hollows).
  moveTargets?: MoveTarget[];
  onMoveTo?: (scope: Scope) => void;
  // Places a copy could go (here, the Hearth, other Hollows).
  copyTargets?: MoveTarget[];
  onCopyTo?: (scope: Scope) => void;
  // Close this and move it with arrows while watching the Hearth (CORE-076).
  onStartMove?: () => void;
}) {
  const [text, setText] = useState("");

  // Keep showing the last item while the sheet slides away.
  const lastItem = useRef<Editable | null>(null);
  if (item) lastItem.current = item;
  const shown = item ?? lastItem.current;

  useEffect(() => {
    if (!item) return;
    setText(item.kind === "nook" ? item.label ?? "" : item.kind === "hollow" ? item.name : item.kind === "trinket" ? "" : item.text);
  }, [item?.id]);

  function commitText() {
    if (!item || item.kind === "trinket") return;
    if (item.kind === "nook") {
      const trimmed = text.trim();
      if (trimmed !== (item.label ?? "")) onChange({ label: trimmed || undefined } as Partial<NookItem>);
    } else if (item.kind === "hollow") {
      if (text.trim() && text.trim() !== item.name) onChange({ name: text.trim() } as Partial<HollowItem>);
    } else if (text.trim() && text.trim() !== item.text) {
      onChange({ text: text.trim() } as Partial<LabelItem>);
    }
  }

  function close() {
    commitText();
    onClose();
  }

  const nook = shown?.kind === "nook" ? findNook(shown.nookId) : undefined;

  // What's chosen, for the closed sections (CORE-074).
  const looksSummary = !shown
    ? ""
    : shown.kind === "nook"
      ? lookSummary({ look: shown.look ?? "soft", corners: shown.corners, lift: shown.lift, defaultLift: "raised", border: shown.border })
      : shown.kind === "hollow"
        ? `${hollowLookInfo(shown.look).label} · ${hollowDecors.find((d) => d.decor === (shown.decor ?? "none"))?.label ?? "Plain"}`
        : shown.kind === "label"
          ? [
              { title: "Title", heading: "Heading", caption: "Caption" }[shown.size],
              labelFonts.find((f) => f.key === (shown.font ?? "app"))?.label,
              shown.divider ? "Divider" : labelDecors.find((d) => d.key === (shown.decor ?? "none"))?.label,
            ].join(" · ")
          : shown.flip
            ? "Flipped"
            : "As drawn";
  const placeSummary = shown ? sizeSummary(sizePresets[shown.kind], shown.w, shown.h, shown.locked) : "";

  return (
    <BottomSheet
      visible={Boolean(item)}
      onClose={close}
      header={
        shown ? (
          <View style={[ui.row, { gap: 12 }]}>
            {nook ? (
              <IconBadge
                name={(shown.kind === "nook" && shown.icon) || nook.icon}
                color={nook.iconColor}
                background={nook.color}
                size={44}
              />
            ) : shown.kind === "hollow" ? (
              <IconBadge name={hollowLookInfo(shown.look).icon} size={44} background={itemColor(shown)} />
            ) : shown.kind === "trinket" ? (
              <TrinketThumb piece={shown.piece} color={itemColor(shown)} size={44} />
            ) : (
              <IconBadge name="text" size={44} />
            )}
            <Text style={[ui.sectionTitle, { marginTop: 0, flex: 1 }]} numberOfLines={1}>
              {shown.kind === "nook"
                ? nookLabel(shown)
                : shown.kind === "hollow"
                  ? shown.name
                  : shown.kind === "trinket"
                    ? trinketInfo(shown.piece).label
                    : "Text"}
            </Text>
          </View>
        ) : null
      }
    >
      {shown ? (
        <ScrollView
          contentContainerStyle={{ gap: 14, paddingBottom: 8 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {shown.kind === "trinket" ? null : (
            <>
              <Text style={ui.label}>
                {shown.kind === "nook" ? "Name on your Hearth" : shown.kind === "hollow" ? "Name" : "Words"}
              </Text>
              <TextInput
                style={ui.input}
                value={text}
                onChangeText={setText}
                onEndEditing={commitText}
                placeholder={nook?.title ?? (shown.kind === "hollow" ? "e.g. Family stuff" : "e.g. Family")}
                placeholderTextColor={colors.muted}
                returnKeyType="done"
              />
            </>
          )}

          {shown.kind === "trinket" ? (
            <>
              <Text style={ui.label}>Which one</Text>
              <View style={ui.chips}>
                {trinkets.map((t) => (
                  <Chip
                    key={t.key}
                    selected={shown.piece === t.key}
                    onPress={() => onChange({
                        piece: t.key,
                        // Keep a color you picked; otherwise take the new piece's own.
                        color: !shown.color || shown.color === trinketInfo(shown.piece).color ? t.color : shown.color,
                      } as Partial<TrinketItem>)}
                  >
                    {t.label}
                  </Chip>
                ))}
              </View>
            </>
          ) : null}

          <Collapsible id="tile-looks" icon="palette" title="How it looks" summary={looksSummary} defaultOpen>
            {shown.kind === "trinket" ? (
              <>
                <Text style={ui.label}>Facing</Text>
                <View style={ui.chips}>
                  <Chip selected={!shown.flip} onPress={() => onChange({ flip: false } as Partial<TrinketItem>)}>
                    As drawn
                  </Chip>
                  <Chip selected={Boolean(shown.flip)} onPress={() => onChange({ flip: true } as Partial<TrinketItem>)}>
                    Flipped
                  </Chip>
                </View>
              </>
            ) : null}
            {shown.kind === "hollow" ? (
              <>
                <Text style={ui.label}>Looks like</Text>
                <View style={ui.chips}>
                  {hollowLooks.map((info) => (
                    <Chip
                      key={info.look}
                      icon={info.icon}
                      selected={shown.look === info.look}
                      onPress={() => onChange({ look: info.look } as Partial<HollowItem>)}
                    >
                      {info.label}
                    </Chip>
                  ))}
                </View>
                <Text style={ui.label}>Decorations</Text>
                <View style={ui.chips}>
                  {hollowDecors.map((info) => (
                    <Chip
                      key={info.decor}
                      icon={info.icon}
                      selected={(shown.decor ?? "none") === info.decor}
                      onPress={() => onChange({ decor: info.decor } as Partial<HollowItem>)}
                    >
                      {info.label}
                    </Chip>
                  ))}
                </View>
              </>
            ) : null}

            {shown.kind === "nook" && nook ? (
              <>
                <Text style={ui.label}>Style</Text>
                <View style={ui.chips}>
                  {(
                    [
                      ["soft", "Soft"],
                      ["bold", "Bold"],
                      ["outline", "Outline"],
                    ] as const
                  ).map(([look, labelText]) => (
                    <Chip
                      key={look}
                      selected={(shown.look ?? "soft") === look}
                      onPress={() => onChange({ look } as Partial<NookItem>)}
                    >
                      {labelText}
                    </Chip>
                  ))}
                </View>
                <Text style={ui.label}>Icon</Text>
                <IconPicker
                  value={shown.icon}
                  fallback={nook.icon}
                  onChange={(icon) => onChange({ icon } as Partial<NookItem>)}
                />
              </>
            ) : null}

            {shown.kind === "label" ? (
              <>
                <Text style={ui.label}>Style</Text>
                <View style={ui.chips}>
                  {(["title", "heading", "caption"] as const).map((size) => (
                    <Chip key={size} selected={shown.size === size} onPress={() => onChange({ size } as Partial<LabelItem>)}>
                      {size === "title" ? "Title" : size === "heading" ? "Heading" : "Caption"}
                    </Chip>
                  ))}
                </View>
                {onDivider ? (
                  <View style={[ui.row, { justifyContent: "space-between" }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={ui.cardTitle}>Fold-away divider</Text>
                      <Text style={ui.muted}>Tap it on your Hearth to fold away everything under it, down to the next divider.</Text>
                    </View>
                    <Switch value={Boolean(shown.divider)} onValueChange={onDivider} trackColor={{ true: colors.bark }} />
                  </View>
                ) : null}
                <Text style={ui.label}>Line up</Text>
                <View style={ui.chips}>
                  {(["left", "center", "right"] as const).map((align) => (
                    <Chip key={align} selected={shown.align === align} onPress={() => onChange({ align } as Partial<LabelItem>)}>
                      {align[0].toUpperCase() + align.slice(1)}
                    </Chip>
                  ))}
                </View>
                <Text style={ui.label}>Up and down</Text>
                <View style={ui.chips}>
                  {(["top", "middle", "bottom"] as const).map((valign) => (
                    <Chip
                      key={valign}
                      // Unset: slim text sits in the middle, taller text at the bottom.
                      selected={(shown.valign ?? (shown.h < 1 ? "middle" : "bottom")) === valign}
                      onPress={() => onChange({ valign } as Partial<LabelItem>)}
                    >
                      {valign[0].toUpperCase() + valign.slice(1)}
                    </Chip>
                  ))}
                </View>
                <Text style={ui.label}>Font</Text>
                <View style={ui.chips}>
                  {labelFonts.map((f) => (
                    <Chip key={f.key} selected={(shown.font ?? "app") === f.key} onPress={() => onChange({ font: f.key } as Partial<LabelItem>)}>
                      {f.label}
                    </Chip>
                  ))}
                </View>
                <View style={ui.chips}>
                  <Chip icon="text" selected={labelIsBold(shown)} onPress={() => onChange({ bold: !labelIsBold(shown) } as Partial<LabelItem>)}>
                    Bold
                  </Chip>
                  <Chip icon="text" selected={Boolean(shown.caps)} onPress={() => onChange({ caps: !shown.caps } as Partial<LabelItem>)}>
                    CAPITALS
                  </Chip>
                </View>
                {shown.divider ? null : (
                  <>
                    <Text style={ui.label}>Decoration</Text>
                    <View style={ui.chips}>
                      {labelDecors.map((d) => (
                        <Chip
                          key={d.key}
                          icon={d.icon}
                          selected={(shown.decor ?? "none") === d.key}
                          onPress={() => onChange({ decor: d.key } as Partial<LabelItem>)}
                        >
                          {d.label}
                        </Chip>
                      ))}
                    </View>
                    <Text style={ui.muted}>The color below tints the pill, patch, ribbon or sign.</Text>
                    {(shown.decor ?? "none") !== "none" ? (
                      <>
                        <Text style={ui.label}>Stretch across</Text>
                        <Slider
                          label="How far the decoration stretches across its space"
                          value={shown.span ?? 0}
                          onChange={(span) => onChange({ span } as Partial<LabelItem>)}
                          startLabel="Just the words"
                          endLabel="Edge to edge"
                        />
                      </>
                    ) : null}
                  </>
                )}
              </>
            ) : null}
            <Text style={ui.label}>{shown.kind === "trinket" ? "Main color" : "Color"}</Text>
            <ColorPicker
              value={shown.kind === "label" ? shown.color : itemColor(shown)}
              onChange={(color) => onChange({ color })}
              deep={shown.kind === "label"}
              fallback={shown.kind === "label" ? "" : itemColor(shown)}
            />

            {shown.kind === "nook" || shown.kind === "hollow" ? (
              <>
                {shown.kind === "nook" ? (
                  <>
                    <Text style={ui.label}>Shape</Text>
                    <View style={ui.chips}>
                      {tileShapes.map((t) => (
                        <Chip key={t.key} icon={t.icon} selected={(shown.shape ?? "arch") === t.key} onPress={() => onChange({ shape: t.key })}>
                          {t.label}
                        </Chip>
                      ))}
                    </View>
                    <Text style={ui.label}>Corners</Text>
                    <View style={ui.chips}>
                      {cornerChoices.map((c) => (
                        <Chip key={c.key} selected={(shown.corners ?? "soft") === c.key} onPress={() => onChange({ corners: c.key })}>
                          {c.label}
                        </Chip>
                      ))}
                    </View>
                  </>
                ) : null}
                <Text style={ui.label}>Shadow</Text>
                <View style={ui.chips}>
                  {liftChoices.map((c) => (
                    <Chip
                      key={c.key}
                      selected={(shown.lift ?? (shown.kind === "nook" ? "raised" : "soft")) === c.key}
                      onPress={() => onChange({ lift: c.key })}
                    >
                      {c.label}
                    </Chip>
                  ))}
                </View>
                {shown.kind === "nook" ? (
                  <>
                    <Text style={ui.label}>Border</Text>
                    <View style={ui.chips}>
                      <Chip selected={!shown.border} onPress={() => onChange({ border: false })}>
                        None
                      </Chip>
                      <Chip selected={Boolean(shown.border)} onPress={() => onChange({ border: true })}>
                        Outlined
                      </Chip>
                    </View>
                  </>
                ) : null}
              </>
            ) : null}
          </Collapsible>

          <Collapsible id="tile-size" icon="resize" title="Size & place" summary={placeSummary}>
            <Text style={ui.label}>Size</Text>
            <View style={ui.chips}>
              {sizePresets[shown.kind].map((preset) => (
                <Chip
                  key={preset.label}
                  selected={shown.w === preset.w && shown.h === preset.h}
                  onPress={() => {
                    tap();
                    onResize(preset.w, preset.h);
                  }}
                >
                  {preset.label}
                </Chip>
              ))}
            </View>
            <Text style={ui.muted}>Or drag the corner handle on the Hearth for any size.</Text>
            <View style={[ui.row, { justifyContent: "space-between" }]}>
              <View style={{ flex: 1 }}>
                <Text style={ui.cardTitle}>Lock in place</Text>
                <Text style={ui.muted}>Can't be dragged, resized or removed until you unlock it.</Text>
              </View>
              <Switch
                value={Boolean(shown.locked)}
                onValueChange={(locked) => onChange({ locked: locked || undefined })}
                trackColor={{ true: colors.bark }}
              />
            </View>
            {onStartMove && !shown.locked ? (
              <Button title="Move it with arrows" icon="arrowUp" variant="secondary" onPress={onStartMove} />
            ) : null}
            {moveTargets.length && onMoveTo && shown.kind !== "hollow" ? (
              <>
                <Text style={ui.label}>Move to</Text>
                <View style={ui.chips}>
                  {moveTargets.map((target) => (
                    <Chip
                      key={target.scope ?? "hearth"}
                      icon={target.scope ? "burrow" : "hearth"}
                      onPress={() => {
                        tap("success");
                        onMoveTo(target.scope);
                      }}
                    >
                      {target.label}
                    </Chip>
                  ))}
                </View>
              </>
            ) : null}
          </Collapsible>

          <Collapsible id="tile-when" icon="calendar" title="When it shows" summary={showInWords(shown.showIn)}>
            <SeasonPicker value={shown.showIn} onChange={(showIn) => onChange({ showIn })} />
          </Collapsible>

          <Collapsible id="tile-tags" icon="price" title="Tags" summary={tagsSummary(shown.tags)}>
            <TagsEditor tags={shown.tags} known={knownTags} onChange={(tags) => onChange({ tags })} />
          </Collapsible>

          {copyTargets.length && onCopyTo && shown.kind !== "hollow" ? (
            <Collapsible id="tile-copy" icon="copy" title="Make a copy" summary="Put another one somewhere else">
              <View style={ui.chips}>
                {copyTargets.map((target) => (
                  <Chip
                    key={target.scope ?? "hearth"}
                    icon="copy"
                    onPress={() => {
                      tap("success");
                      onCopyTo(target.scope);
                    }}
                  >
                    {target.label}
                  </Chip>
                ))}
              </View>
              {shown.kind === "nook" ? (
                <Text style={ui.muted}>Every copy opens the same {nook?.title ?? "Nook"} — style each one your own way.</Text>
              ) : null}
            </Collapsible>
          ) : null}

          <View style={[ui.row, { marginTop: 8 }]}>
            {onOpen ? (
              <Button title="Open" icon="chevron" variant="secondary" style={{ flex: 1 }} onPress={onOpen} />
            ) : null}
            <Button title="Done" icon="check" style={{ flex: 1 }} onPress={close} />
          </View>
          <Button
            title={
              shown.kind === "nook"
                ? "Remove from Hearth"
                : shown.kind === "hollow"
                  ? "Remove this Hollow"
                  : shown.kind === "trinket"
                    ? "Remove this"
                    : "Remove text"
            }
            icon="trash"
            variant="danger"
            onPress={onRemove}
          />
          {shown.kind === "hollow" ? (
            <Text style={[ui.muted, { textAlign: "center" }]}>
              Nothing inside is deleted — it all moves back onto your Hearth.
            </Text>
          ) : null}
        </ScrollView>
      ) : null}
    </BottomSheet>
  );
}

