import { StatusBar } from "expo-status-bar";
import { Redirect, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { AddSheet } from "../components/hearth/add-sheet";
import { GRID_GAP, HearthGrid } from "../components/hearth/hearth-grid";
import { TileFace } from "../components/hearth/tile-face";
import { ItemOptions } from "../components/hearth/tile-options";
import { WidgetView } from "../components/hearth/widgets";
import { Icon, IconBadge } from "../components/icon";
import { Skeleton, Tap } from "../components/motion";
import { useAuth } from "../lib/auth-context";
import { tap } from "../lib/feedback";
import {
  addItem,
  deepColor,
  hearthThemes,
  moveItem,
  newItemId,
  removeItem,
  resizeItem,
  updateItem,
  useHearthLayout,
  type HearthItem,
  type LabelItem,
  type NookItem,
} from "../lib/hearth";
import { findNook } from "../lib/nooks";
import { cancelReminders, syncReminders } from "../lib/reminders";
import { touchesGuarded } from "../lib/touch-guard";
import { widgetKindInfo, type WidgetConfig } from "../lib/widgets";

const PADDING = 20;

// CORE-002/003/006-010/018/019: the Hearth. A free-form grid you design:
// Nook tiles, widgets and text labels, placed and sized however you like.
// Tap Edit (or hold anything) to drag items anywhere, resize them from the
// corner, and add widgets or text.
export default function Hearth() {
  const router = useRouter();
  const { session, isLoading: authLoading } = useAuth();
  const { layout, save, isLoading, error, reload } = useHearthLayout();
  const theme = hearthThemes[layout.theme] ?? hearthThemes.hearth;

  const [editing, setEditing] = useState(false);
  const [gridWidth, setGridWidth] = useState(0);
  const [optionsFor, setOptionsFor] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Refresh widgets each time you come back to the Hearth.
  useFocusEffect(useCallback(() => setRefreshKey((k) => k + 1), []));

  if (!authLoading && !session) {
    return <Redirect href="/sign-in" />;
  }

  function persist(items: HearthItem[]) {
    save({ items }).catch((saveError: Error) =>
      Alert.alert("Couldn't save your Hearth", saveError.message),
    );
  }

  function openNook(nookId: string) {
    const route = findNook(nookId)?.route;
    if (route) router.push(route);
  }

  // Tapping a widget outside edit mode jumps somewhere useful.
  function openWidget(item: HearthItem & { kind: "widget" }) {
    switch (item.widget.kind) {
      case "countdown":
      case "gatherings":
        return router.push("/gift-nook");
      case "tucks":
        return router.push("/gift-nook/my-tucks");
      case "inbox":
        return router.push("/gift-nook/notifications");
      case "greeting":
        return;
      default: // note, reminders: open the editor
        return router.push(`/widget/${item.id}`);
    }
  }

  function onPressItem(item: HearthItem) {
    // A checkbox inside a widget was just pressed; that's not an "open".
    if (touchesGuarded()) return;
    if (item.kind === "widget") {
      if (editing) router.push(`/widget/${item.id}`);
      else openWidget(item);
    } else if (editing) {
      setOptionsFor(item.id);
    } else if (item.kind === "nook") {
      openNook(item.nookId);
    }
  }

  async function changeWidget(
    item: HearthItem & { kind: "widget" },
    widget: WidgetConfig,
  ) {
    if (widget.kind === "reminders" && item.widget.kind === "reminders") {
      const synced = await syncReminders(
        widget.title,
        widget.settings.items,
        item.widget.settings.items,
      );
      widget = { ...widget, settings: { ...widget.settings, items: synced } };
    }
    persist(updateItem(layout, item.id, { widget } as Partial<HearthItem>));
  }

  function addWidget(widget: WidgetConfig) {
    setAdding(false);
    const size = widgetKindInfo(widget.kind).size;
    const id = newItemId("w");
    const items = addItem(layout, { id, kind: "widget", widget, ...size });
    save({ items })
      .then(async () => {
        tap("success");
        // Ready-made ideas may come with reminders to schedule.
        if (
          widget.kind === "reminders" &&
          widget.settings.items.some((r) => r.schedule)
        ) {
          const synced = await syncReminders(
            widget.title,
            widget.settings.items,
            [],
          );
          save({
            items: items.map((it) =>
              it.id === id
                ? ({
                    ...it,
                    widget: {
                      ...widget,
                      settings: { ...widget.settings, items: synced },
                    },
                  } as HearthItem)
                : it,
            ),
          }).catch(() => {});
        }
        router.push(`/widget/${id}`);
      })
      .catch((saveError: Error) =>
        Alert.alert("Couldn't add it", saveError.message),
      );
  }

  function addLabel() {
    setAdding(false);
    const id = newItemId("l");
    persist(
      addItem(layout, {
        id,
        kind: "label",
        text: "My Nooks",
        size: "heading",
        align: "left",
        w: 4,
        h: 1,
      }),
    );
    setEditing(true);
    setOptionsFor(id);
  }

  function remove(item: HearthItem) {
    if (item.kind === "widget" && item.widget.kind === "reminders")
      cancelReminders(item.widget.settings.items);
    persist(removeItem(layout, item.id));
  }

  const optionsItem = (layout.items.find(
    (i) => i.id === optionsFor && i.kind !== "widget",
  ) ?? null) as NookItem | LabelItem | null;
  const isEmpty = layout.items.length === 0;

  function renderItem(
    item: HearthItem,
    size: { width: number; height: number },
  ) {
    if (item.kind === "nook")
      return <TileFace item={item} {...size} refreshKey={refreshKey} />;
    if (item.kind === "widget") {
      return (
        <WidgetView
          widget={item.widget}
          color={item.color}
          {...size}
          refreshKey={refreshKey}
          themeText={theme.text}
          onChange={
            editing ? undefined : (widget) => changeWidget(item, widget)
          }
        />
      );
    }
    const fontSize = { title: 30, heading: 19, caption: 14 }[item.size];
    return (
      <View
        style={[
          size,
          {
            justifyContent: "flex-end",
            paddingHorizontal: 4,
            paddingBottom: 2,
          },
        ]}
      >
        <Text
          numberOfLines={2}
          style={{
            fontSize,
            fontWeight: item.size === "caption" ? "500" : "800",
            textAlign: item.align,
            color: item.color
              ? deepColor(item.color)
              : item.size === "caption"
                ? theme.muted
                : theme.text,
            letterSpacing: item.size === "title" ? -0.5 : 0,
          }}
        >
          {item.text}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: theme.background }]}
        edges={["top", "left", "right"]}
      >
        <StatusBar style={layout.theme === "dusk" ? "light" : "dark"} />
        <ScrollView
          contentContainerStyle={styles.container}
          scrollEnabled={!dragging}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text
              style={[styles.title, { color: theme.text }]}
              numberOfLines={1}
            >
              {layout.title || "The Hearth"}
            </Text>
            <View style={styles.headerButtons}>
              {editing ? (
                <Tap
                  onPress={() => setAdding(true)}
                  hitSlop={10}
                  pressedScale={0.85}
                  accessibilityLabel="Add to your Hearth"
                >
                  <Icon name="add" size={24} color={theme.accent} />
                </Tap>
              ) : null}
              {!isEmpty ? (
                <Tap
                  onPress={() => {
                    tap();
                    setEditing((e) => !e);
                  }}
                  hitSlop={10}
                  style={[
                    styles.editButton,
                    {
                      backgroundColor: editing ? theme.accent : "transparent",
                      borderColor: theme.accent,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.headerButton,
                      { color: editing ? theme.background : theme.accent },
                    ]}
                  >
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
            <Animated.View
              entering={FadeIn.duration(200)}
              exiting={FadeOut.duration(150)}
              style={[styles.hint, { backgroundColor: `${theme.accent}18` }]}
            >
              <Icon name="drag" size={18} color={theme.accent} />
              <Text style={{ color: theme.text, flex: 1 }}>
                Hold anything and drag it anywhere. Drag a corner to resize. Tap
                to customize, or + to add widgets and text.
              </Text>
            </Animated.View>
          ) : null}

          <View onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}>
            {error ? (
              <View style={{ gap: 8 }}>
                <Text style={{ color: "#c0392b" }}>
                  Couldn't load your Hearth: {error}
                </Text>
                <Tap
                  onPress={reload}
                  style={[styles.outlineButton, { borderColor: theme.accent }]}
                >
                  <Text style={{ color: theme.accent, fontWeight: "600" }}>
                    Try again
                  </Text>
                </Tap>
              </View>
            ) : isLoading ? (
              <View style={styles.skeletons}>
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton
                    key={i}
                    height={gridWidth ? (gridWidth - GRID_GAP) / 2 : 160}
                    width="48%"
                    radius={24}
                  />
                ))}
              </View>
            ) : isEmpty ? (
              <Animated.View
                entering={FadeIn.duration(250)}
                style={[styles.emptyCard, { borderColor: theme.muted }]}
              >
                <IconBadge
                  name="hearth"
                  size={72}
                  color={theme.accent}
                  background={`${theme.accent}1f`}
                />
                <Text style={[styles.emptyTitle, { color: theme.text }]}>
                  Make this place yours
                </Text>
                <Text style={{ color: theme.muted, textAlign: "center" }}>
                  Add a Nook from the Market, or a widget — a countdown,
                  reminders, a note — and arrange it all however you like.
                </Text>
                <Tap
                  style={[
                    styles.addButton,
                    { backgroundColor: theme.accent, alignSelf: "stretch" },
                  ]}
                  onPress={() => setAdding(true)}
                >
                  <Icon name="add" size={18} color={theme.background} />
                  <Text
                    style={[styles.addButtonText, { color: theme.background }]}
                  >
                    Add to your Hearth
                  </Text>
                </Tap>
              </Animated.View>
            ) : (
              <HearthGrid
                items={layout.items}
                width={gridWidth}
                editing={editing}
                accent={theme.accent}
                onMove={(id, x, y) => persist(moveItem(layout, id, x, y))}
                onResize={(id, w, h) => persist(resizeItem(layout, id, w, h))}
                onPressItem={onPressItem}
                onLongPress={() => setEditing(true)}
                onDraggingChange={setDragging}
                renderItem={renderItem}
              />
            )}
          </View>

          {!isEmpty && !isLoading ? (
            <View style={[styles.footerRow, { marginTop: 8 }]}>
              <Tap
                style={[
                  styles.addButton,
                  { backgroundColor: theme.accent, flex: 1 },
                ]}
                onPress={() => setAdding(true)}
              >
                <Icon name="widgets" size={18} color={theme.background} />
                <Text
                  style={[styles.addButtonText, { color: theme.background }]}
                >
                  Add
                </Text>
              </Tap>
              <Tap
                style={[
                  styles.outlineButton,
                  { borderColor: theme.accent, flex: 1 },
                ]}
                onPress={() => router.push("/market")}
              >
                <Icon name="market" size={18} color={theme.accent} />
                <Text style={{ color: theme.accent, fontWeight: "600" }}>
                  Market
                </Text>
              </Tap>
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>

      {/* Sheets sit inside the screen (not system pop-ups) so opening another
          screen from them can't collide with a half-dismissed pop-up. */}
      <ItemOptions
        item={optionsItem}
        onChange={(changes) =>
          optionsFor && persist(updateItem(layout, optionsFor, changes))
        }
        onResize={(w, h) =>
          optionsFor && persist(resizeItem(layout, optionsFor, w, h))
        }
        onOpen={
          optionsItem?.kind === "nook"
            ? () => {
                const nookId = optionsItem.nookId;
                setOptionsFor(null);
                openNook(nookId);
              }
            : undefined
        }
        onRemove={() => {
          const item = optionsItem;
          setOptionsFor(null);
          if (item) remove(item);
        }}
        onClose={() => setOptionsFor(null)}
      />

      <AddSheet
        visible={adding}
        onClose={() => setAdding(false)}
        onAddWidget={addWidget}
        onAddLabel={addLabel}
        onOpenMarket={() => {
          setAdding(false);
          router.push("/market");
        }}
      />
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
  title: {
    fontSize: 32,
    fontWeight: "800",
    flexShrink: 1,
    letterSpacing: -0.5,
  },
  headerButtons: { flexDirection: "row", alignItems: "center", gap: 16 },
  headerButton: { fontSize: 15, fontWeight: "700" },
  editButton: {
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  hint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 16,
  },
  skeletons: { flexDirection: "row", flexWrap: "wrap", gap: GRID_GAP },
  emptyCard: {
    alignItems: "center",
    gap: 10,
    padding: 24,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 24,
  },
  emptyTitle: { fontSize: 19, fontWeight: "800" },
  footerRow: { flexDirection: "row", gap: 12 },
  outlineButton: {
    borderWidth: 1.5,
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
  addButtonText: { fontSize: 16, fontWeight: "600" },
});
