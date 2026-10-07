import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import Animated, { Easing, SlideInDown, ZoomIn } from "react-native-reanimated";

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
import { Icon, IconBadge } from "../icon";
import { Tap } from "../motion";
import { Button, Chip } from "../ui";

type Editable = NookItem | LabelItem;

// Bottom sheet for a Nook tile or a text label on the Hearth: what it says,
// how big it is, and its color. (Widgets have their own full editor.)
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

  const nook = item?.kind === "nook" ? findNook(item.nookId) : undefined;

  return (
    <Modal visible={Boolean(item)} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <Pressable style={styles.backdrop} onPress={close} />
        {item ? (
          <Animated.View
            entering={SlideInDown.duration(280).easing(Easing.out(Easing.cubic))}
            style={styles.sheet}
          >
            <View style={styles.grabber} />
            <View style={[ui.row, { gap: 12 }]}>
              {nook ? (
                <IconBadge name={nook.icon} color={nook.iconColor} background={nook.color} size={44} />
              ) : (
                <IconBadge name="text" size={44} />
              )}
              <Text style={[ui.sectionTitle, { marginTop: 0, flex: 1 }]} numberOfLines={1}>
                {item.kind === "nook" ? nookLabel(item) : "Text"}
              </Text>
            </View>

            <Text style={ui.label}>{item.kind === "nook" ? "Name on your Hearth" : "Words"}</Text>
            <TextInput
              style={ui.input}
              value={text}
              onChangeText={setText}
              onEndEditing={commitText}
              placeholder={nook?.title ?? "e.g. Family"}
              placeholderTextColor={colors.muted}
              returnKeyType="done"
            />

            {item.kind === "label" ? (
              <>
                <Text style={ui.label}>Style</Text>
                <View style={ui.chips}>
                  {(["title", "heading", "caption"] as const).map((size) => (
                    <Chip key={size} selected={item.size === size} onPress={() => onChange({ size } as Partial<LabelItem>)}>
                      {size === "title" ? "Title" : size === "heading" ? "Heading" : "Caption"}
                    </Chip>
                  ))}
                </View>
                <Text style={ui.label}>Line up</Text>
                <View style={ui.chips}>
                  {(["left", "center", "right"] as const).map((align) => (
                    <Chip key={align} selected={item.align === align} onPress={() => onChange({ align } as Partial<LabelItem>)}>
                      {align[0].toUpperCase() + align.slice(1)}
                    </Chip>
                  ))}
                </View>
              </>
            ) : null}

            <Text style={ui.label}>Size</Text>
            <View style={ui.chips}>
              {sizePresets[item.kind].map((preset) => (
                <Chip
                  key={preset.label}
                  selected={item.w === preset.w && item.h === preset.h}
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
                const shown = item.kind === "label" ? deepColor(color) : color;
                const selected = item.kind === "label" ? item.color === color : itemColor(item) === color;
                return (
                  <Tap
                    key={color}
                    pressedScale={0.85}
                    onPress={() => {
                      tap();
                      onChange({ color });
                    }}
                    style={[styles.swatch, { backgroundColor: shown }, selected && styles.swatchSelected]}
                    accessibilityLabel={selected ? "Selected color" : "Pick this color"}
                  >
                    {selected ? (
                      <Animated.View entering={ZoomIn.duration(180)}>
                        <Icon name="check" size={18} color={item.kind === "label" ? "#ffffff" : colors.bark} />
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
              title={item.kind === "nook" ? "Remove from Hearth" : "Remove text"}
              icon="trash"
              variant="danger"
              onPress={onRemove}
            />
          </Animated.View>
        ) : null}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)" },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    paddingTop: 10,
    paddingBottom: 36,
    gap: 14,
  },
  grabber: {
    alignSelf: "center",
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    marginBottom: 4,
  },
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
