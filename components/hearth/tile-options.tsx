import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";

import { tap } from "../../lib/feedback";
import {
  deepColor,
  itemColor,
  nookLabel,
  sizePresets,
  tilePalette,
  type HearthItem,
  type LabelItem,
  type NookItem,
} from "../../lib/hearth";
import { findNook } from "../../lib/nooks";
import { colors, ui } from "../../lib/theme";
import { BottomSheet } from "../bottom-sheet";
import { Icon, IconBadge } from "../icon";
import { Tap } from "../motion";
import { Button, Chip } from "../ui";

type Editable = NookItem | LabelItem;

// Bottom sheet for a Nook tile or a text label on the Hearth: what it says,
// how big it is, and its color. (Widgets have their own full editor.) Drag
// the grabber or title down to close.
export function ItemOptions({
  item,
  onChange,
  onResize,
  onOpen,
  onRemove,
  onClose,
}: {
  item: Editable | null;
  onChange: (changes: Partial<HearthItem>) => void;
  onResize: (w: number, h: number) => void;
  onOpen?: () => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const [text, setText] = useState("");

  // Keep showing the last item while the sheet slides away.
  const lastItem = useRef<Editable | null>(null);
  if (item) lastItem.current = item;
  const shown = item ?? lastItem.current;

  useEffect(() => {
    if (!item) return;
    setText(item.kind === "nook" ? item.label ?? "" : item.text);
  }, [item?.id]);

  function commitText() {
    if (!item) return;
    if (item.kind === "nook") {
      const trimmed = text.trim();
      if (trimmed !== (item.label ?? "")) onChange({ label: trimmed || undefined } as Partial<NookItem>);
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
              <IconBadge name={nook.icon} color={nook.iconColor} background={nook.color} size={44} />
            ) : (
              <IconBadge name="text" size={44} />
            )}
            <Text style={[ui.sectionTitle, { marginTop: 0, flex: 1 }]} numberOfLines={1}>
              {shown.kind === "nook" ? nookLabel(shown) : "Text"}
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
          <Text style={ui.label}>{shown.kind === "nook" ? "Name on your Hearth" : "Words"}</Text>
          <TextInput
            style={ui.input}
            value={text}
            onChangeText={setText}
            onEndEditing={commitText}
            placeholder={nook?.title ?? "e.g. Family"}
            placeholderTextColor={colors.muted}
            returnKeyType="done"
          />

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

          <Text style={ui.label}>Color</Text>
          <View style={ui.chips}>
            {tilePalette.map((color) => {
              const swatch = shown.kind === "label" ? deepColor(color) : color;
              const selected = shown.kind === "label" ? shown.color === color : itemColor(shown) === color;
              return (
                <Tap
                  key={color}
                  pressedScale={0.85}
                  onPress={() => {
                    tap();
                    onChange({ color });
                  }}
                  style={[styles.swatch, { backgroundColor: swatch }, selected && styles.swatchSelected]}
                  accessibilityLabel={selected ? "Selected color" : "Pick this color"}
                >
                  {selected ? (
                    <Animated.View entering={ZoomIn.duration(180)}>
                      <Icon name="check" size={18} color={shown.kind === "label" ? "#ffffff" : colors.bark} />
                    </Animated.View>
                  ) : null}
                </Tap>
              );
            })}
          </View>

          <View style={[ui.row, { marginTop: 8 }]}>
            {onOpen ? (
              <Button title="Open" icon="chevron" variant="secondary" style={{ flex: 1 }} onPress={onOpen} />
            ) : null}
            <Button title="Done" icon="check" style={{ flex: 1 }} onPress={close} />
          </View>
          <Button
            title={shown.kind === "nook" ? "Remove from Hearth" : "Remove text"}
            icon="trash"
            variant="danger"
            onPress={onRemove}
          />
        </ScrollView>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  swatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  swatchSelected: { borderWidth: 2.5, borderColor: colors.bark },
});
