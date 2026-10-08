import { useState } from "react";
import { ScrollView, TextInput, View } from "react-native";

import { colors, ui } from "../../lib/theme";
import { MAX_PAGES } from "../../lib/hearth-pages";
import type { HearthPage } from "../../lib/hearth-layout";
import { BottomSheet } from "../bottom-sheet";
import { Icon } from "../icon";
import { Tap } from "../motion";
import { Text } from "../text";
import { Button, Chip } from "../ui";

// The pages of the Hearth (CORE-051), such as "Everyday" and "Holidays".
// Swipe the Hearth sideways, or tap a page here, to go between them.

// A row of page names under the top bar. Tap one to go there.
export function PageStrip({
  pages,
  activeId,
  accent,
  text,
  background,
  onSwitch,
}: {
  pages: HearthPage[];
  activeId: string;
  accent: string;
  text: string;
  background: string;
  onSwitch: (id: string) => void;
}) {
  return (
    // flexGrow 0: a scroll view would otherwise stretch to fill the screen.
    <View style={{ flexGrow: 0, flexShrink: 0 }}>
      <ScrollView
        horizontal
        style={{ flexGrow: 0 }}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingTop: 2, paddingBottom: 10, alignItems: "center" }}
        keyboardShouldPersistTaps="handled"
      >
        {pages.map((page) => {
          const on = page.id === activeId;
          return (
            <Tap
              key={page.id}
              onPress={() => onSwitch(page.id)}
              pressedScale={0.94}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: on ? accent : `${accent}14`,
                borderWidth: 1,
                borderColor: on ? accent : `${accent}33`,
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: on ? "800" : "600", color: on ? background : text }} numberOfLines={1}>
                {page.name}
              </Text>
            </Tap>
          );
        })}
      </ScrollView>
    </View>
  );
}

// Add, rename and remove pages.
export function PagesSheet({
  visible,
  onClose,
  pages,
  activeId,
  onSwitch,
  onAdd,
  onRename,
  onRemove,
}: {
  visible: boolean;
  onClose: () => void;
  pages: HearthPage[];
  activeId: string;
  onSwitch: (id: string) => void;
  onAdd: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
}) {
  const [newName, setNewName] = useState("");
  const full = pages.length >= MAX_PAGES;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      header={<Text style={[ui.sectionTitle, { marginTop: 0 }]}>Pages</Text>}
    >
      <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 24 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={ui.muted}>
          Swipe the Hearth sideways to move between pages — one for every day, another for the holidays, whatever you like.
          Taking a page away moves what's on it to your first page.
        </Text>
        {pages.map((page) => (
          <PageRow
            key={page.id}
            page={page}
            active={page.id === activeId}
            canRemove={pages.length > 1}
            onSwitch={() => onSwitch(page.id)}
            onRename={(name) => onRename(page.id, name)}
            onRemove={() => onRemove(page.id)}
          />
        ))}
        {full ? (
          <Text style={ui.muted}>That's the most pages ({MAX_PAGES}).</Text>
        ) : (
          <>
            <Text style={ui.label}>New page</Text>
            <TextInput
              style={ui.input}
              value={newName}
              onChangeText={setNewName}
              placeholder="e.g. Holidays"
              placeholderTextColor={colors.muted}
              maxLength={20}
              returnKeyType="done"
            />
            <Button
              title="Add a page"
              icon="add"
              onPress={() => {
                onAdd(newName);
                setNewName("");
              }}
            />
          </>
        )}
      </ScrollView>
    </BottomSheet>
  );
}

function PageRow({
  page,
  active,
  canRemove,
  onSwitch,
  onRename,
  onRemove,
}: {
  page: HearthPage;
  active: boolean;
  canRemove: boolean;
  onSwitch: () => void;
  onRename: (name: string) => void;
  onRemove: () => void;
}) {
  const [name, setName] = useState(page.name);
  return (
    <View style={[ui.row, { gap: 10 }]}>
      <View style={{ flex: 1 }}>
        <TextInput
          style={ui.input}
          value={name}
          onChangeText={setName}
          onEndEditing={() => (name.trim() ? name.trim() !== page.name && onRename(name) : setName(page.name))}
          maxLength={20}
          returnKeyType="done"
        />
      </View>
      {active ? (
        <Chip selected onPress={() => {}}>
          Here
        </Chip>
      ) : (
        <Chip onPress={onSwitch}>Go</Chip>
      )}
      {canRemove ? (
        <Tap onPress={onRemove} hitSlop={10} pressedScale={0.85} accessibilityLabel={`Remove ${page.name}`}>
          <Icon name="trash" size={22} color={colors.error} />
        </Tap>
      ) : null}
    </View>
  );
}
