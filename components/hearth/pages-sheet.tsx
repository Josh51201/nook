import { useState } from "react";
import { ScrollView, TextInput, View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";

import { colors, ui } from "../../lib/theme";
import { MAX_PAGES } from "../../lib/hearth-pages";
import type { HearthPage } from "../../lib/hearth-layout";
import { BottomSheet } from "../bottom-sheet";
import { Icon } from "../icon";
import { NewsDot } from "./news";
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
  hoverId,
  canAdd,
  tabRef,
  onSwitch,
  onAdd,
  homeId,
  newsIds = [],
  dotIds = [],
}: {
  pages: HearthPage[];
  activeId: string;
  // The page shared with your Home (CORE-054), shown with a little house.
  homeId?: string;
  // Pages with a Fridge door someone's left a note on (CORE-086): their tab
  // wears a tiny note under a magnet until you've looked.
  newsIds?: string[];
  // Pages with something else new on them, Hollows included (CORE-115):
  // their tab wears a little dot.
  dotIds?: string[];
  accent: string;
  text: string;
  background: string;
  // The tab a dragged item is over right now.
  hoverId?: string;
  // Show a "New page" tab (while editing).
  canAdd?: boolean;
  // So the screen can find each tab on screen (the id "new" is the + tab).
  tabRef?: (id: string, node: View | null) => void;
  onSwitch: (id: string) => void;
  onAdd?: () => void;
}) {
  return (
    // flexGrow 0: a scroll view would otherwise stretch to fill the screen.
    <View style={{ flexGrow: 0, flexShrink: 0 }}>
      <ScrollView
        horizontal
        style={{ flexGrow: 0 }}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingTop: 6, paddingBottom: 6, alignItems: "center" }}
        keyboardShouldPersistTaps="handled"
      >
        {pages.map((page) => {
          const on = page.id === activeId;
          const hover = hoverId === page.id;
          const shared = page.id === homeId;
          const news = newsIds.includes(page.id);
          const dot = !news && dotIds.includes(page.id);
          return (
            <View key={page.id} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {/* The shared Home page (CORE-054) sits apart from your own pages:
                a little divider, a house, and a squarer, warmer tab. */}
            {shared ? <View style={{ width: 1.5, height: 20, borderRadius: 1, backgroundColor: `${accent}40` }} /> : null}
            <View ref={(node) => tabRef?.(page.id, node)} collapsable={false} style={{ transform: [{ scale: hover ? 1.1 : 1 }] }}>
              <Tap
                onPress={() => onSwitch(page.id)}
                pressedScale={0.94}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={news ? `${page.name}, someone left a note on the fridge` : dot ? `${page.name}, something new` : undefined}
                style={{
                  paddingHorizontal: shared ? 12 : 14,
                  paddingVertical: 6,
                  borderRadius: shared ? 10 : 999,
                  backgroundColor: hover || on ? accent : shared ? `${accent}26` : `${accent}14`,
                  borderWidth: hover || shared ? 2 : 1,
                  borderColor: on || hover || shared ? accent : `${accent}33`,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  {shared ? <Icon name="hearth" size={14} color={on || hover ? background : accent} /> : null}
                  <Text style={{ fontSize: 14, fontWeight: on || hover ? "800" : "600", color: on || hover ? background : text }} numberOfLines={1}>
                    {page.name}
                  </Text>
                </View>
              </Tap>
              {news ? <FridgeNews /> : null}
              {dot ? <NewsDot ring={background} size={11} /> : null}
            </View>
            </View>
          );
        })}
        {canAdd && onAdd ? (
          <View ref={(node) => tabRef?.("new", node)} collapsable={false} style={{ transform: [{ scale: hoverId === "new" ? 1.1 : 1 }] }}>
            <Tap
              onPress={onAdd}
              pressedScale={0.94}
              accessibilityRole="button"
              accessibilityLabel="New page"
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
                borderWidth: hoverId === "new" ? 2 : 1,
                borderStyle: "dashed",
                borderColor: accent,
                backgroundColor: hoverId === "new" ? accent : "transparent",
              }}
            >
              <Icon name="add" size={14} color={hoverId === "new" ? background : accent} />
              <Text style={{ fontSize: 14, fontWeight: "700", color: hoverId === "new" ? background : accent }}>New page</Text>
            </Tap>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

// A tiny sticky note under a red magnet, tucked on a page tab's corner.
function FridgeNews() {
  return (
    <Animated.View entering={ZoomIn.springify().damping(11)} pointerEvents="none" style={{ position: "absolute", top: -5, right: -5 }}>
      <View
        style={{
          width: 13,
          height: 12,
          marginTop: 3,
          borderRadius: 1.5,
          backgroundColor: "#fff1a6",
          transform: [{ rotate: "8deg" }],
          boxShadow: "0px 1px 2px rgba(0,0,0,0.3)",
        }}
      />
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 4,
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: "#d94b3f",
          boxShadow: "0px 1px 1px rgba(0,0,0,0.3)",
        }}
      />
    </Animated.View>
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
  homeId,
  homeHidden = false,
  homeName,
  onShowHome,
}: {
  visible: boolean;
  onClose: () => void;
  pages: HearthPage[];
  activeId: string;
  onSwitch: (id: string) => void;
  onAdd: (name: string) => void;
  onRename: (id: string, name: string) => void;
  // For the Home page, this hides it instead (it's everyone's).
  onRemove: (id: string) => void;
  // The page shared with your Home (CORE-054), if it's showing; whether
  // you've hidden it, and a way to bring it back.
  homeId?: string;
  homeHidden?: boolean;
  homeName?: string;
  onShowHome?: () => void;
}) {
  const [newName, setNewName] = useState("");
  // The Home page doesn't count against your own pages.
  const full = pages.filter((p) => p.id !== homeId).length >= MAX_PAGES;

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
            canRemove={page.id === homeId || pages.filter((p) => p.id !== homeId).length > 1}
            shared={page.id === homeId}
            onSwitch={() => onSwitch(page.id)}
            onRename={(name) => onRename(page.id, name)}
            onRemove={() => onRemove(page.id)}
          />
        ))}
        {homeId ? (
          <Text style={ui.muted}>The page with the house is shared with everyone in your Home: anyone can add to it, rearrange it or rename it. Hiding it only hides it for you.</Text>
        ) : null}
        {homeHidden && onShowHome ? (
          <Button title={`Show “${homeName ?? "Home"}” again`} icon="hearth" variant="secondary" onPress={onShowHome} />
        ) : null}
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
  shared = false,
  onSwitch,
  onRename,
  onRemove,
}: {
  page: HearthPage;
  active: boolean;
  canRemove: boolean;
  shared?: boolean;
  onSwitch: () => void;
  onRename: (name: string) => void;
  onRemove: () => void;
}) {
  const [name, setName] = useState(page.name);
  return (
    <View style={[ui.row, { gap: 10 }]}>
      {shared ? <Icon name="hearth" size={20} color={colors.bark} /> : null}
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
        <Tap onPress={onRemove} hitSlop={10} pressedScale={0.85} accessibilityLabel={shared ? `Hide ${page.name}` : `Remove ${page.name}`}>
          <Icon name={shared ? "hidden" : "trash"} size={22} color={shared ? colors.muted : colors.error} />
        </Tap>
      ) : null}
    </View>
  );
}
