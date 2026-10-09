import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { Text, TextInput } from "../components/text";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";

import { Icon, IconBadge } from "../components/icon";
import { Appear, LoadingScreen, Tap } from "../components/motion";
import { NookScroll } from "../components/nook-scroll";
import { Button, Chip, SectionHeader } from "../components/ui";
import { tap } from "../lib/feedback";
import { fullMessage, overflowing } from "../lib/hearth-limits";
import { addNook, nookCount, removeNook, useHearthLayout } from "../lib/hearth";
import { nookAisles, nookCatalog, nookMatches, type NookAisle, type NookDefinition } from "../lib/nooks";
import { colors, themed, ui } from "../lib/theme";

// The Market (proposed name): browse Nooks and add them to your Hearth
// (CORE-002) — more than once if you like, e.g. one on the Hearth and one in
// a Hollow; every tile opens the same Nook (CORE-039). Removing a Nook only
// takes its tiles off the Hearth — its data stays. Nooks are grouped into a
// few sections with a search box, each one a short row that opens to show
// what it does, so the Market stays easy to scan as it grows (CORE-088).
export default function Market() {
  const router = useRouter();
  const { layout, save, isLoading, error, reload } = useHearthLayout();
  const [query, setQuery] = useState("");
  const [aisle, setAisle] = useState<NookAisle | null>(null);
  // The one Nook whose details are showing.
  const [expanded, setExpanded] = useState<string | null>(null);

  async function add(nook: NookDefinition, another = false) {
    try {
      const items = addNook(layout, nook.id, another);
      // A page only holds so much (CORE-066).
      const full = overflowing(layout, { ...layout, items });
      if (full) {
        const message = fullMessage(full);
        return Alert.alert(message.title, message.body);
      }
      await save({ items });
      if (another) Alert.alert("Added another", `It's on your Hearth. Move it into a Hollow from Edit if you like.`);
    } catch (saveError) {
      Alert.alert("Couldn't add it", (saveError as Error).message);
    }
  }

  function confirmRemove(nook: NookDefinition, count: number) {
    Alert.alert(
      count > 1 ? `Take all ${count} ${nook.title} tiles off your Hearth?` : `Take ${nook.title} off your Hearth?`,
      (count > 1 ? "To remove just one, use Edit on the Hearth. " : "") +
        "Nothing inside it is deleted — add it back any time and it'll be just as you left it.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => save(removeNook(layout, nook.id)).catch(() => {}),
        },
      ]
    );
  }

  if (error) {
    return (
      <View style={ui.center}>
        <Text style={ui.error}>{error}</Text>
        <Button title="Try again" icon="undo" variant="secondary" onPress={reload} />
      </View>
    );
  }

  if (isLoading) return <LoadingScreen />;

  const searching = query.trim().length > 0;
  const shown = nookCatalog.filter((nook) => (searching ? nookMatches(nook, query) : !aisle || nook.aisle === aisle));
  const sections = searching
    ? [{ title: null, icon: undefined, nooks: shown }]
    : nookAisles
        .filter((group) => !aisle || group.id === aisle)
        .map((group) => ({ title: group.title, icon: group.icon, nooks: shown.filter((nook) => nook.aisle === group.id) }))
        .filter((group) => group.nooks.length);

  function pickAisle(next: NookAisle | null) {
    tap();
    setAisle(next);
  }

  function row(nook: NookDefinition, i: number) {
    const count = nookCount(layout, nook.id);
    const added = count > 0;
    const isOpen = expanded === nook.id;
    return (
      <Appear key={nook.id} index={i}>
        <View style={[ui.card, { gap: 12, padding: 14, opacity: nook.available ? 1 : 0.75 }]}>
          <Tap
            onPress={() => {
              tap();
              setExpanded(isOpen ? null : nook.id);
            }}
            pressedScale={0.98}
            style={[ui.row, { gap: 12 }]}
            accessibilityRole="button"
            accessibilityState={{ expanded: isOpen }}
            accessibilityLabel={`${nook.title}: ${nook.tagline}${added ? ", on your Hearth" : ""}`}
            accessibilityHint={isOpen ? "Hides the details" : "Shows what it does"}
          >
            <IconBadge name={nook.icon} size={46} color={nook.iconColor} background={nook.color} />
            <View style={{ flex: 1, gap: 1 }}>
              <Text style={ui.cardTitle}>{nook.title}</Text>
              <Text style={[ui.muted, { fontSize: 13, lineHeight: 18 }]}>{nook.tagline}</Text>
            </View>
            {!nook.available ? (
              <View style={styles.pill}>
                <Text style={styles.pillText}>Soon</Text>
              </View>
            ) : added ? (
              <Animated.View entering={ZoomIn.springify().damping(12)} style={[ui.row, { gap: 2 }]}>
                <Icon name="check" size={22} color="#3f7a4f" />
                {count > 1 ? <Text style={{ color: "#3f7a4f", fontWeight: "800" }}>×{count}</Text> : null}
              </Animated.View>
            ) : (
              <Tap
                onPress={() => {
                  tap("success");
                  add(nook);
                }}
                hitSlop={8}
                style={[styles.pill, ui.row, { gap: 4 }]}
                accessibilityRole="button"
                accessibilityLabel={`Add ${nook.title} to your Hearth`}
              >
                <Icon name="add" size={14} color={colors.bark} />
                <Text style={styles.pillText}>Add</Text>
              </Tap>
            )}
          </Tap>

          {isOpen ? (
            <Animated.View entering={FadeIn.duration(180)} style={{ gap: 12 }}>
              <Text style={{ fontSize: 14, color: colors.text, lineHeight: 20 }}>{nook.description}</Text>
              {!nook.available ? null : added ? (
                <View style={{ gap: 10 }}>
                  <View style={[ui.row, { gap: 10 }]}>
                    <Button title="Open" icon="chevron" variant="secondary" style={{ flex: 1 }} onPress={() => router.push(nook.route!)} />
                    <Button title="Remove" icon="trash" variant="danger" onPress={() => confirmRemove(nook, count)} />
                  </View>
                  <Button
                    title="Add another"
                    icon="copy"
                    variant="secondary"
                    onPress={() => {
                      tap("success");
                      add(nook, true);
                    }}
                  />
                </View>
              ) : (
                <View style={[ui.row, { gap: 10 }]}>
                  <Button title="Open" icon="chevron" variant="secondary" style={{ flex: 1 }} onPress={() => router.push(nook.route!)} />
                  <Button
                    title="Add to Hearth"
                    icon="add"
                    style={{ flex: 1 }}
                    onPress={() => {
                      tap("success");
                      add(nook);
                    }}
                  />
                </View>
              )}
            </Animated.View>
          ) : null}
        </View>
      </Appear>
    );
  }

  let index = 0;
  return (
    <NookScroll>
      <Text style={ui.muted}>Pick the Nooks you want on your Hearth. Tap one to see what it does.</Text>

      <View style={[ui.input, ui.row, { paddingVertical: 0 }]}>
        <Icon name="search" size={16} color={colors.muted} />
        <TextInput
          style={{ flex: 1, paddingVertical: 13, fontSize: 16, color: colors.text }}
          value={query}
          onChangeText={setQuery}
          placeholder="Find a Nook"
          placeholderTextColor={colors.muted}
          returnKeyType="search"
          clearButtonMode="while-editing"
          accessibilityLabel="Find a Nook"
        />
      </View>

      {searching ? null : (
        <View style={ui.chips}>
          <Chip selected={!aisle} onPress={() => pickAisle(null)}>
            All
          </Chip>
          {nookAisles.map((group) => (
            <Chip key={group.id} selected={aisle === group.id} icon={group.icon} onPress={() => pickAisle(group.id)}>
              {group.short}
            </Chip>
          ))}
        </View>
      )}

      {sections.length ? (
        sections.map((section) => (
          <View key={section.title ?? "found"} style={{ gap: 10 }}>
            {section.title ? <SectionHeader title={section.title} icon={section.icon} /> : null}
            {section.nooks.map((nook) => row(nook, index++))}
          </View>
        ))
      ) : (
        <Text style={ui.muted}>No Nook matches "{query.trim()}".</Text>
      )}
    </NookScroll>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    pill: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 999,
      backgroundColor: colors.barkSoft,
    },
    pillText: { fontSize: 13, fontWeight: "700", color: colors.bark },
  })
);
