import { useEffect, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { Text, TextInput } from "../text";

import { cornerChoices, liftChoices } from "../../lib/decor";
import { tap } from "../../lib/feedback";
import {
  hollowDecors,
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
import { trinketInfo, trinkets } from "../../lib/trinkets";
import { findNook } from "../../lib/nooks";
import { colors, ui } from "../../lib/theme";
import { BottomSheet } from "../bottom-sheet";
import { IconBadge } from "../icon";
import { Button, Chip } from "../ui";
import { ColorPicker } from "./color-picker";
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
  onRemove,
  onClose,
  moveTargets = [],
  onMoveTo,
  copyTargets = [],
  onCopyTo,
}: {
  item: Editable | null;
  onChange: (changes: Partial<HearthItem>) => void;
  onResize: (w: number, h: number) => void;
  onOpen?: () => void;
  onRemove: () => void;
  onClose: () => void;
  // Places this item could move to (the Hearth, or other Hollows).
  moveTargets?: MoveTarget[];
  onMoveTo?: (scope: Scope) => void;
  // Places a copy could go (here, the Hearth, other Hollows).
  copyTargets?: MoveTarget[];
  onCopyTo?: (scope: Scope) => void;
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
              <Text style={ui.label}>Line up</Text>
              <View style={ui.chips}>
                {(["left", "center", "right"] as const).map((align) => (
                  <Chip key={align} selected={shown.align === align} onPress={() => onChange({ align } as Partial<LabelItem>)}>
                    {align[0].toUpperCase() + align.slice(1)}
                  </Chip>
                ))}
              </View>
            </>
          ) : null}

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

          {copyTargets.length && onCopyTo && shown.kind !== "hollow" ? (
            <>
              <Text style={ui.label}>Make a copy</Text>
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
            </>
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

