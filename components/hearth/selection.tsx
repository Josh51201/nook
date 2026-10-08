import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { cleanTag, MAX_TAG_LENGTH } from "../../lib/hearth-tags";
import { colors, ui } from "../../lib/theme";
import { BottomSheet } from "../bottom-sheet";
import { Icon, type IconName } from "../icon";
import { Tap } from "../motion";
import { Text } from "../text";
import { Chip } from "../ui";
import { ColorPicker } from "./color-picker";

// Select many (CORE-060): the bar along the bottom while you're picking
// things on the Hearth, and the little sheets for "Move to" and "Color".

export type SelectionAction = "move" | "copy" | "color" | "lock" | "tag" | "delete";

export function SelectionBar({
  count,
  allLocked,
  accent,
  background,
  text,
  bottom,
  onAction,
  onDone,
}: {
  count: number;
  // Everything picked is locked, so the lock button unlocks.
  allLocked: boolean;
  accent: string;
  background: string;
  text: string;
  bottom: number;
  onAction: (action: SelectionAction) => void;
  onDone: () => void;
}) {
  const none = count === 0;
  const actions: { key: SelectionAction; label: string; icon: IconName }[] = [
    { key: "move", label: "Move to", icon: "burrow" },
    { key: "copy", label: "Copy", icon: "copy" },
    { key: "color", label: "Color", icon: "palette" },
    { key: "lock", label: allLocked ? "Unlock" : "Lock", icon: "lock" },
    { key: "tag", label: "Tag", icon: "price" },
    { key: "delete", label: "Remove", icon: "trash" },
  ];
  return (
    <Animated.View entering={FadeIn.duration(160)} style={[styles.wrap, { bottom }]} pointerEvents="box-none">
      <View style={[styles.bar, { backgroundColor: background, borderColor: `${text}22` }]}>
        <View style={styles.top}>
          <Text style={{ color: text, fontWeight: "800", flex: 1 }} numberOfLines={1}>
            {none ? "Tap things to pick them" : `${count} picked`}
          </Text>
          <Tap onPress={onDone} hitSlop={10} accessibilityRole="button">
            <Text style={{ color: accent, fontWeight: "800" }}>Done</Text>
          </Tap>
        </View>
        <View style={styles.actions}>
          {actions.map((a) => (
            <Tap
              key={a.key}
              onPress={() => onAction(a.key)}
              disabled={none}
              pressedScale={0.92}
              style={[styles.action, { opacity: none ? 0.35 : 1 }]}
              accessibilityRole="button"
              accessibilityLabel={a.label}
            >
              <Icon name={a.icon} size={20} color={a.key === "delete" ? colors.error : accent} />
              <Text style={{ color: a.key === "delete" ? colors.error : text, fontSize: 12, fontWeight: "600" }}>{a.label}</Text>
            </Tap>
          ))}
        </View>
      </View>
    </Animated.View>
  );
}

export type SelectionTarget = { key: string; label: string; icon: IconName; onPick: () => void };

// "Move to…": the Hearth, Hollows and pages the picked things can go to.
export function MoveManySheet({
  visible,
  count,
  targets,
  onClose,
}: {
  visible: boolean;
  count: number;
  targets: SelectionTarget[];
  onClose: () => void;
}) {
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      header={<Text style={[ui.sectionTitle, { marginTop: 0 }]}>Move {count} to…</Text>}
    >
      <View style={[ui.chips, { paddingBottom: 24 }]}>
        {targets.length ? (
          targets.map((t) => (
            <Chip key={t.key} icon={t.icon} onPress={t.onPick}>
              {t.label}
            </Chip>
          ))
        ) : (
          <Text style={ui.muted}>There's nowhere else to move them yet — add a Hollow or a page first.</Text>
        )}
      </View>
    </BottomSheet>
  );
}

// "Tag": add a tag to everything picked, or take it off.
export function TagManySheet({
  visible,
  count,
  tags,
  onToggle,
  onAdd,
  onClose,
}: {
  visible: boolean;
  count: number;
  // Every tag in use, and how many of the picked things have it.
  tags: { tag: string; has: number }[];
  onToggle: (tag: string, on: boolean) => void;
  onAdd: (tag: string) => void;
  onClose: () => void;
}) {
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      header={<Text style={[ui.sectionTitle, { marginTop: 0 }]}>Tag {count}</Text>}
    >
      <View style={{ gap: 10, paddingBottom: 24 }}>
        {tags.length ? (
          <View style={ui.chips}>
            {tags.map(({ tag, has }) => (
              <Chip key={tag} icon="price" selected={has === count} onPress={() => onToggle(tag, has < count)}>
                {has > 0 && has < count ? `${tag} (${has})` : tag}
              </Chip>
            ))}
          </View>
        ) : (
          <Text style={ui.muted}>No tags yet. Make the first one below.</Text>
        )}
        <NewTag onAdd={onAdd} />
      </View>
    </BottomSheet>
  );
}

function NewTag({ onAdd }: { onAdd: (tag: string) => void }) {
  const [text, setText] = useState("");
  function add() {
    const tag = cleanTag(text);
    if (!tag) return;
    onAdd(tag);
    setText("");
  }
  return (
    <View style={[ui.row, { gap: 8 }]}>
      <TextInput
        style={[ui.input, { flex: 1 }]}
        value={text}
        onChangeText={setText}
        onSubmitEditing={add}
        placeholder="New tag, like Kids"
        placeholderTextColor={colors.muted}
        maxLength={MAX_TAG_LENGTH}
        returnKeyType="done"
      />
      <Chip onPress={add}>Add</Chip>
    </View>
  );
}

// "Color": one color for everything picked.
export function ColorManySheet({
  visible,
  count,
  onPick,
  onClose,
}: {
  visible: boolean;
  count: number;
  onPick: (color: string) => void;
  onClose: () => void;
}) {
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      header={<Text style={[ui.sectionTitle, { marginTop: 0 }]}>Color for {count}</Text>}
    >
      <View style={{ paddingBottom: 24 }}>
        <ColorPicker value={undefined} onChange={onPick} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 16, right: 16 },
  bar: {
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    boxShadow: "0px 8px 24px rgba(0,0,0,0.18)",
  },
  top: { flexDirection: "row", alignItems: "center", gap: 12 },
  actions: { flexDirection: "row", justifyContent: "space-between" },
  action: { flex: 1, alignItems: "center", gap: 3, paddingVertical: 4 },
});
