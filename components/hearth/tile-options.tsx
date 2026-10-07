import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import Animated, { SlideInDown, ZoomIn } from "react-native-reanimated";

import { tileColor, tilePalette, tileSizes, type HearthTile } from "../../lib/hearth";
import { findNook } from "../../lib/nooks";
import { tap } from "../../lib/feedback";
import { colors, ui } from "../../lib/theme";
import { Icon, IconBadge } from "../icon";
import { Button, Chip } from "../ui";
import { Tap } from "../motion";

// Bottom sheet for one Hearth tile: name, size, color, open, remove.
export function TileOptions({
  tile,
  onChange,
  onOpen,
  onRemove,
  onClose,
}: {
  tile: HearthTile | null;
  onChange: (changes: Partial<HearthTile>) => void;
  onOpen: () => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const nook = tile ? findNook(tile.nookId) : undefined;
  const [label, setLabel] = useState("");

  useEffect(() => {
    setLabel(tile?.label ?? "");
  }, [tile?.nookId]);

  function commitLabel() {
    if (!tile) return;
    const trimmed = label.trim();
    if (trimmed !== (tile.label ?? "")) onChange({ label: trimmed || undefined });
  }

  function close() {
    commitLabel();
    onClose();
  }

  return (
    <Modal visible={Boolean(tile)} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
      >
        <Pressable style={styles.backdrop} onPress={close} />
        {tile ? (
          <Animated.View entering={SlideInDown.springify().damping(20).stiffness(180)} style={styles.sheet}>
            <View style={styles.grabber} />
            <View style={[ui.row, { gap: 12 }]}>
              {nook ? <IconBadge name={nook.icon} color={nook.iconColor} background={nook.color} size={44} /> : null}
              <Text style={[ui.sectionTitle, { marginTop: 0 }]}>{nook?.title}</Text>
            </View>

            <Text style={ui.label}>Name on your Hearth</Text>
            <TextInput
              style={ui.input}
              value={label}
              onChangeText={setLabel}
              onEndEditing={commitLabel}
              placeholder={nook?.title}
              returnKeyType="done"
            />

            <Text style={ui.label}>Size</Text>
            <View style={ui.chips}>
              {tileSizes.map((size) => {
                const selected = tile.size === size.key;
                return (
                  <Chip
                    key={size.key}
                    selected={selected}
                    onPress={() => {
                      tap();
                      onChange({ size: size.key });
                    }}
                  >
                    {size.label}
                  </Chip>
                );
              })}
            </View>

            <Text style={ui.label}>Color</Text>
            <View style={ui.chips}>
              {tilePalette.map((color) => {
                const selected = tileColor(tile) === color;
                return (
                  <Tap
                    key={color}
                    pressedScale={0.85}
                    onPress={() => {
                      tap();
                      onChange({ color });
                    }}
                    style={[styles.swatch, { backgroundColor: color }, selected && styles.swatchSelected]}
                    accessibilityLabel={selected ? "Selected color" : "Pick this color"}
                  >
                    {selected ? (
                      <Animated.View entering={ZoomIn.springify().damping(12)}>
                        <Icon name="check" size={18} color={colors.bark} />
                      </Animated.View>
                    ) : null}
                  </Tap>
                );
              })}
            </View>

            <View style={[ui.row, { marginTop: 8 }]}>
              <Button title="Open" icon="chevron" variant="secondary" style={{ flex: 1 }} onPress={onOpen} />
              <Button title="Done" icon="check" style={{ flex: 1 }} onPress={close} />
            </View>
            <Button title="Remove from Hearth" icon="trash" variant="danger" onPress={onRemove} />
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
    gap: 16,
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
