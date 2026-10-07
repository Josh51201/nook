import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { tileColor, tilePalette, tileSizes, type HearthTile } from "../../lib/hearth";
import { findNook } from "../../lib/nooks";
import { colors, ui } from "../../lib/theme";

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
    <Modal visible={Boolean(tile)} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={styles.backdrop} onPress={close} />
        {tile ? (
          <View style={styles.sheet}>
            <Text style={[ui.sectionTitle, { marginTop: 0 }]}>
              {nook?.emoji} {nook?.title}
            </Text>

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
                  <TouchableOpacity
                    key={size.key}
                    style={[ui.chip, selected && ui.chipSelected]}
                    onPress={() => onChange({ size: size.key })}
                  >
                    <Text style={[ui.chipText, selected && ui.chipTextSelected]}>{size.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={ui.label}>Color</Text>
            <View style={ui.chips}>
              {tilePalette.map((color) => (
                <TouchableOpacity
                  key={color}
                  onPress={() => onChange({ color })}
                  style={[
                    styles.swatch,
                    { backgroundColor: color },
                    tileColor(tile) === color && styles.swatchSelected,
                  ]}
                />
              ))}
            </View>

            <View style={[ui.row, { marginTop: 8 }]}>
              <TouchableOpacity style={[ui.secondaryButton, { flex: 1 }]} onPress={onOpen}>
                <Text style={ui.secondaryButtonText}>Open</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[ui.button, { flex: 1 }]} onPress={close}>
                <Text style={ui.buttonText}>Done</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={onRemove} style={{ alignItems: "center", padding: 8 }}>
              <Text style={ui.error}>Remove from Hearth</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)" },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
    gap: 16,
  },
  swatch: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: "#ccc" },
  swatchSelected: { borderWidth: 3, borderColor: colors.bark },
});
