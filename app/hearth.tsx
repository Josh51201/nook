import { StatusBar } from "expo-status-bar";
import { Redirect, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import Animated, { Easing, FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { DraggableTile } from "../components/hearth/draggable-tile";
import { TileFace } from "../components/hearth/tile-face";
import { TileOptions } from "../components/hearth/tile-options";
import { Icon, IconBadge } from "../components/icon";
import { Skeleton, Tap } from "../components/motion";
import { useAuth } from "../lib/auth-context";
import {
  hearthThemes,
  moveTile,
  newSectionId,
  removeNook,
  updateTile,
  useHearthLayout,
  type HearthSection,
  type HearthTile,
} from "../lib/hearth";
import { tap } from "../lib/feedback";
import { findNook } from "../lib/nooks";

const GAP = 12;
const PADDING = 20;

type Rect = { x: number; y: number; width: number; height: number };

// CORE-002/003/006-010: the Hearth. Nooks you've added from the Market sit
// here as tiles in sections you name. Tap Edit (or hold a tile) to drag
// tiles between sections, resize/recolor/rename them, and manage sections.
export default function Hearth() {
  const router = useRouter();
  const { session, isLoading: authLoading } = useAuth();
  const { layout, save, isLoading, error, reload } = useHearthLayout();
  const theme = hearthThemes[layout.theme] ?? hearthThemes.hearth;

  const [editing, setEditing] = useState(false);
  const [gridWidth, setGridWidth] = useState(0);
  const [optionsFor, setOptionsFor] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoverSectionId, setHoverSectionId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const tileViews = useRef(new Map<string, View>());
  const sectionViews = useRef(new Map<string, View>());
  const tileRects = useRef(new Map<string, Rect>());
  const sectionRects = useRef(new Map<string, Rect>());

  // Refresh widgets each time you come back to the Hearth.
  useFocusEffect(useCallback(() => setRefreshKey((k) => k + 1), []));

  if (!authLoading && !session) {
    return <Redirect href="/sign-in" />;
  }

  function persist(sections: HearthSection[]) {
    save({ sections }).catch((saveError: Error) =>
      Alert.alert("Couldn't save your Hearth", saveError.message)
    );
  }

  function openNook(nookId: string) {
    const route = findNook(nookId)?.route;
    if (route) router.push(route);
  }

  // --- Drag and drop -------------------------------------------------------

  function measureAll() {
    tileRects.current.clear();
    sectionRects.current.clear();
    tileViews.current.forEach((view, id) =>
      view.measureInWindow((x, y, width, height) => tileRects.current.set(id, { x, y, width, height }))
    );
    sectionViews.current.forEach((view, id) =>
      view.measureInWindow((x, y, width, height) =>
        sectionRects.current.set(id, { x, y, width, height })
      )
    );
  }

  // The section under the finger, or the nearest one above/below it.
  function sectionAt(y: number) {
    let nearest: { id: string; distance: number } | null = null;
    for (const [id, rect] of sectionRects.current) {
      if (y >= rect.y && y <= rect.y + rect.height) return id;
      const distance = Math.min(Math.abs(y - rect.y), Math.abs(y - (rect.y + rect.height)));
      if (!nearest || distance < nearest.distance) nearest = { id, distance };
    }
    return nearest?.id ?? null;
  }

  function dropTile(nookId: string, x: number, y: number) {
    setDraggingId(null);
    setHoverSectionId(null);
    const sectionId = sectionAt(y);
    const section = layout.sections.find((s) => s.id === sectionId);
    if (!section) return;

    // Insert after every tile that comes before the finger in reading order.
    let index = 0;
    for (const tile of section.tiles) {
      if (tile.nookId === nookId) continue;
      const rect = tileRects.current.get(tile.nookId);
      if (!rect) continue;
      const isAbove = rect.y + rect.height < y;
      const isLeftOnSameRow = y >= rect.y && y <= rect.y + rect.height && rect.x + rect.width / 2 < x;
      if (isAbove || isLeftOnSameRow) index++;
    }
    persist(moveTile(layout, nookId, section.id, index));
  }

  // --- Sections ------------------------------------------------------------

  function renameSection(sectionId: string, title: string) {
    persist(layout.sections.map((s) => (s.id === sectionId ? { ...s, title } : s)));
  }

  function moveSection(sectionId: string, direction: -1 | 1) {
    const sections = [...layout.sections];
    const from = sections.findIndex((s) => s.id === sectionId);
    const to = from + direction;
    if (to < 0 || to >= sections.length) return;
    [sections[from], sections[to]] = [sections[to], sections[from]];
    persist(sections);
  }

  function deleteSection(sectionId: string) {
    const index = layout.sections.findIndex((s) => s.id === sectionId);
    const section = layout.sections[index];
    const remaining = layout.sections.filter((s) => s.id !== sectionId);
    const doDelete = () => {
      // Its Nooks move into the section above (or the new first one).
      const target = Math.max(0, index - 1);
      persist(
        remaining.map((s, i) => (i === target ? { ...s, tiles: [...s.tiles, ...section.tiles] } : s))
      );
    };
    if (section.tiles.length === 0) doDelete();
    else
      Alert.alert(
        `Remove "${section.title}"?`,
        `Its Nooks will move to "${remaining[Math.max(0, index - 1)].title}".`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Remove", style: "destructive", onPress: doDelete },
        ]
      );
  }

  function addSection() {
    persist([...layout.sections, { id: newSectionId(), title: "New section", tiles: [] }]);
  }

  // --- Rendering -----------------------------------------------------------

  const column = gridWidth ? (gridWidth - GAP) / 2 : 0;
  const rowHeight = column * 0.8;
  function tileSize(tile: HearthTile) {
    if (tile.size === "small") return { width: column, height: rowHeight };
    if (tile.size === "wide") return { width: gridWidth, height: rowHeight };
    return { width: gridWidth, height: rowHeight * 2 + GAP };
  }

  const optionsTile =
    layout.sections.flatMap((s) => s.tiles).find((t) => t.nookId === optionsFor) ?? null;
  const isEmpty = layout.sections.every((s) => s.tiles.length === 0);
  const draggingSectionId = layout.sections.find((s) =>
    s.tiles.some((t) => t.nookId === draggingId)
  )?.id;

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.background }]}
      edges={["top", "left", "right"]}
    >
      <StatusBar style={layout.theme === "dusk" ? "light" : "dark"} />
      <ScrollView
        contentContainerStyle={styles.container}
        scrollEnabled={!draggingId}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
            {layout.title || "The Hearth"}
          </Text>
          <View style={styles.headerButtons}>
            {!isEmpty ? (
              <Tap
                onPress={() => {
                  tap();
                  setEditing((e) => !e);
                }}
                hitSlop={10}
                style={[styles.editButton, { backgroundColor: editing ? theme.accent : "transparent", borderColor: theme.accent }]}
              >
                <Text style={[styles.headerButton, { color: editing ? theme.background : theme.accent }]}>
                  {editing ? "Done" : "Edit"}
                </Text>
              </Tap>
            ) : null}
            <Tap
              onPress={() => router.push("/settings")}
              hitSlop={10}
              pressedScale={0.85}
              accessibilityLabel="Settings"
            >
              <Icon name="settings" size={24} color={theme.accent} />
            </Tap>
          </View>
        </View>

        {editing ? (
          <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} style={[styles.hint, { backgroundColor: `${theme.accent}18` }]}>
            <Icon name="drag" size={18} color={theme.accent} />
            <Text style={{ color: theme.text, flex: 1 }}>
              Hold and drag a Nook to move it. Tap one to resize, recolor, or rename it.
            </Text>
          </Animated.View>
        ) : null}

        {error ? (
          <View style={{ gap: 8 }}>
            <Text style={{ color: "#c0392b" }}>Couldn't load your Hearth: {error}</Text>
            <Tap onPress={reload} style={[styles.outlineButton, { borderColor: theme.accent }]}>
              <Text style={{ color: theme.accent, fontWeight: "600" }}>Try again</Text>
            </Tap>
          </View>
        ) : isLoading ? (
          <View style={styles.grid}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} height={gridWidth ? ((gridWidth - GAP) / 2) * 0.8 : 120} width="48%" radius={24} />
            ))}
          </View>
        ) : (
          <View onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)} style={{ gap: 24 }}>
            {isEmpty && !editing ? (
              <Animated.View entering={FadeIn.duration(250)} exiting={FadeOut.duration(150)}>
                <View style={[styles.emptyCard, { borderColor: theme.muted }]}>
                  <IconBadge name="hearth" size={72} color={theme.accent} background={`${theme.accent}1f`} />
                  <Text style={[styles.emptyTitle, { color: theme.text }]}>Your Hearth is empty</Text>
                  <Text style={{ color: theme.muted, textAlign: "center" }}>
                    Visit the Market to add your first Nook.
                  </Text>
                </View>
              </Animated.View>
            ) : (
              layout.sections.map((section, sectionIndex) => (
                <Animated.View
                  key={section.id}
                  entering={FadeIn.delay(sectionIndex * 60).duration(280)}
                  layout={LinearTransition.duration(260).easing(Easing.out(Easing.cubic))}
                  ref={(view: View | null) => {
                    if (view) sectionViews.current.set(section.id, view);
                    else sectionViews.current.delete(section.id);
                  }}
                  collapsable={false}
                  style={[
                    { gap: 10, zIndex: section.id === draggingSectionId ? 10 : 0 },
                    editing && styles.editingSection,
                    editing && { borderColor: theme.muted },
                    hoverSectionId === section.id && { borderColor: theme.accent, borderStyle: "solid" },
                  ]}
                >
                  {editing ? (
                    <SectionHeaderEditor
                      section={section}
                      color={theme.text}
                      accent={theme.accent}
                      canMoveUp={sectionIndex > 0}
                      canMoveDown={sectionIndex < layout.sections.length - 1}
                      canDelete={layout.sections.length > 1}
                      onRename={(title) => renameSection(section.id, title)}
                      onMove={(direction) => moveSection(section.id, direction)}
                      onDelete={() => deleteSection(section.id)}
                    />
                  ) : section.title ? (
                    <Text style={[styles.sectionTitle, { color: theme.muted }]}>{section.title}</Text>
                  ) : null}

                  <View style={styles.grid}>
                    {section.tiles.map((tile, tileIndex) => {
                      const { width, height } = tileSize(tile);
                      return (
                        <DraggableTile
                          key={tile.nookId}
                          seed={sectionIndex * 7 + tileIndex}
                          editing={editing}
                          isDragging={draggingId === tile.nookId}
                          viewRef={(view) => {
                            if (view) tileViews.current.set(tile.nookId, view);
                            else tileViews.current.delete(tile.nookId);
                          }}
                          handlers={{
                            onPress: () =>
                              editing ? setOptionsFor(tile.nookId) : openNook(tile.nookId),
                            onLongPress: () => {
                              tap();
                              setEditing(true);
                            },
                            onDragStart: () => {
                              tap();
                              measureAll();
                              setDraggingId(tile.nookId);
                            },
                            onDragMove: (_x, y) => {
                              const id = sectionAt(y);
                              if (id !== hoverSectionId) setHoverSectionId(id);
                            },
                            onDrop: (x, y) => dropTile(tile.nookId, x, y),
                          }}
                        >
                          {width > 0 ? (
                            <TileFace
                              tile={tile}
                              width={width}
                              height={height}
                              editing={editing}
                              refreshKey={refreshKey}
                            />
                          ) : null}
                        </DraggableTile>
                      );
                    })}
                    {editing && section.tiles.length === 0 ? (
                      <View style={[styles.dropHint, { borderColor: theme.muted }]}>
                        <Text style={{ color: theme.muted }}>Drag Nooks here</Text>
                      </View>
                    ) : null}
                  </View>
                </Animated.View>
              ))
            )}

            {editing ? (
              <Animated.View entering={FadeIn.duration(250)} exiting={FadeOut.duration(150)}>
                <Tap style={[styles.outlineButton, { borderColor: theme.accent }]} onPress={addSection}>
                  <Icon name="add" size={18} color={theme.accent} />
                  <Text style={{ color: theme.accent, fontWeight: "600" }}>New section</Text>
                </Tap>
              </Animated.View>
            ) : null}

            <Tap style={[styles.addButton, { backgroundColor: theme.accent }]} onPress={() => router.push("/market")}>
              <Icon name="market" size={18} color={theme.background} />
              <Text style={[styles.addButtonText, { color: theme.background }]}>Add a Nook</Text>
            </Tap>
          </View>
        )}
      </ScrollView>

      <TileOptions
        tile={optionsTile}
        onChange={(changes) => optionsFor && persist(updateTile(layout, optionsFor, changes))}
        onOpen={() => {
          const id = optionsFor;
          setOptionsFor(null);
          if (id) openNook(id);
        }}
        onRemove={() => {
          const id = optionsFor;
          setOptionsFor(null);
          if (id) persist(removeNook(layout, id));
        }}
        onClose={() => setOptionsFor(null)}
      />
    </SafeAreaView>
  );
}

function SectionHeaderEditor({
  section,
  color,
  accent,
  canMoveUp,
  canMoveDown,
  canDelete,
  onRename,
  onMove,
  onDelete,
}: {
  section: HearthSection;
  color: string;
  accent: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  canDelete: boolean;
  onRename: (title: string) => void;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(section.title);

  return (
    <View style={styles.sectionEditor}>
      <TextInput
        style={[styles.sectionInput, { color, borderColor: accent }]}
        value={title}
        onChangeText={setTitle}
        onEndEditing={() => title.trim() !== section.title && onRename(title.trim())}
        placeholder="Section name"
        placeholderTextColor="#999"
        returnKeyType="done"
      />
      <Tap onPress={() => onMove(-1)} disabled={!canMoveUp} hitSlop={6} pressedScale={0.8} accessibilityLabel="Move section up">
        <Icon name="arrowUp" size={20} color={accent} />
      </Tap>
      <Tap onPress={() => onMove(1)} disabled={!canMoveDown} hitSlop={6} pressedScale={0.8} accessibilityLabel="Move section down">
        <Icon name="arrowDown" size={20} color={accent} />
      </Tap>
      {canDelete ? (
        <Tap onPress={onDelete} hitSlop={6} pressedScale={0.8} accessibilityLabel="Remove section">
          <Icon name="trash" size={19} color="#c0392b" />
        </Tap>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { padding: PADDING, gap: 16, paddingBottom: 60 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    gap: 12,
  },
  title: { fontSize: 32, fontWeight: "800", flexShrink: 1, letterSpacing: -0.5 },
  headerButtons: { flexDirection: "row", alignItems: "center", gap: 18 },
  headerButton: { fontSize: 15, fontWeight: "700" },
  editButton: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 5 },
  hint: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 16 },
  sectionTitle: { fontSize: 13, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.8 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GAP },
  editingSection: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 16,
    padding: 10,
    margin: -10,
  },
  sectionEditor: { flexDirection: "row", alignItems: "center", gap: 12 },
  sectionInput: {
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
    borderBottomWidth: 1,
    paddingVertical: 4,
  },
  sectionAction: { fontSize: 20, fontWeight: "700" },
  dropHint: {
    flex: 1,
    height: 80,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCard: {
    alignItems: "center",
    gap: 8,
    padding: 28,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 18,
  },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  outlineButton: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  addButton: {
    borderRadius: 16,
    padding: 15,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  addButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
