import { useMemo, useState } from "react";
import { ScrollView, TextInput, View } from "react-native";

import { findItems, type FoundItem } from "../../lib/hearth-find";
import type { HearthLayout } from "../../lib/hearth-layout";
import { colors, ui } from "../../lib/theme";
import { BottomSheet } from "../bottom-sheet";
import { Icon, IconBadge } from "../icon";
import { Tap } from "../motion";
import { Text } from "../text";

// Find in Edit (CORE-063): type part of a name to find a widget, Nook,
// Hollow, text or Trinket on any page or inside any Hollow, then jump to it.
export function FindSheet({
  visible,
  onClose,
  layout,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  layout: HearthLayout;
  onPick: (found: FoundItem) => void;
}) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => (visible ? findItems(layout, query) : []), [visible, layout, query]);
  const manyPages = layout.pages.length > 1;

  return (
    <BottomSheet visible={visible} onClose={onClose} header={<Text style={[ui.sectionTitle, { marginTop: 0 }]}>Find</Text>}>
      <ScrollView contentContainerStyle={{ gap: 10, paddingBottom: 24 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <TextInput
          style={ui.input}
          value={query}
          onChangeText={setQuery}
          placeholder="Part of a name, like “groceries”"
          placeholderTextColor={colors.muted}
          autoCorrect={false}
          returnKeyType="search"
          autoFocus
        />
        {query.trim() === "" ? (
          <Text style={ui.muted}>Searches every page and every Hollow, then takes you there.</Text>
        ) : results.length === 0 ? (
          <Text style={ui.muted}>Nothing called that on your Hearth.</Text>
        ) : (
          results.map((found) => (
            <Tap
              key={found.item.id}
              onPress={() => onPick(found)}
              style={[ui.card, ui.row, { gap: 12 }]}
              accessibilityRole="button"
            >
              <IconBadge name={found.item.kind === "hollow" ? "burrow" : "search"} size={36} background={colors.barkSoft} />
              <View style={{ flex: 1 }}>
                <Text style={ui.cardTitle} numberOfLines={1}>
                  {found.label}
                </Text>
                <Text style={ui.muted} numberOfLines={1}>
                  {found.kindLabel}
                  {manyPages ? ` · ${found.pageName}` : ""}
                  {found.hollowName ? ` · in ${found.hollowName}` : ""}
                </Text>
              </View>
              <Icon name="chevron" size={16} color={colors.muted} />
            </Tap>
          ))
        )}
      </ScrollView>
    </BottomSheet>
  );
}
