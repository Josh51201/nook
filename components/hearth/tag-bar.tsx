import { useState } from "react";
import { ScrollView, TextInput, View } from "react-native";

import { cleanTag, MAX_TAGS_PER_ITEM, MAX_TAG_LENGTH } from "../../lib/hearth-tags";
import { colors, ui } from "../../lib/theme";
import { Icon } from "../icon";
import { Tap } from "../motion";
import { Text } from "../text";
import { Chip } from "../ui";

// Tags and filters (CORE-065).

// A row of your tags under the top bar. Tap one to hide everything with it;
// tap again to bring it back.
export function TagBar({
  tags,
  hidden,
  accent,
  text,
  background,
  onToggle,
  onShowAll,
}: {
  tags: string[];
  hidden: string[];
  accent: string;
  text: string;
  background: string;
  onToggle: (tag: string) => void;
  onShowAll: () => void;
}) {
  const isHidden = (tag: string) => hidden.some((h) => h.toLowerCase() === tag.toLowerCase());
  return (
    <View style={{ flexGrow: 0, flexShrink: 0 }}>
      <ScrollView
        horizontal
        style={{ flexGrow: 0 }}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingTop: 2, paddingBottom: 10, alignItems: "center" }}
        keyboardShouldPersistTaps="handled"
      >
        {tags.map((tag) => {
          const off = isHidden(tag);
          return (
            <Tap
              key={tag}
              onPress={() => onToggle(tag)}
              pressedScale={0.94}
              accessibilityRole="button"
              accessibilityLabel={off ? `Show ${tag}` : `Hide ${tag}`}
              accessibilityState={{ selected: !off }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                paddingHorizontal: 12,
                paddingVertical: 5,
                borderRadius: 999,
                borderWidth: 1,
                borderStyle: off ? "dashed" : "solid",
                borderColor: off ? `${text}44` : `${accent}55`,
                backgroundColor: off ? "transparent" : `${accent}18`,
              }}
            >
              <Icon name={off ? "hidden" : "price"} size={12} color={off ? `${text}88` : accent} />
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "700",
                  color: off ? `${text}88` : text,
                  textDecorationLine: off ? "line-through" : "none",
                }}
                numberOfLines={1}
              >
                {tag}
              </Text>
            </Tap>
          );
        })}
        {hidden.length ? (
          <Tap onPress={onShowAll} hitSlop={8} accessibilityRole="button">
            <Text style={{ fontSize: 13, fontWeight: "800", color: accent }}>Show all</Text>
          </Tap>
        ) : null}
      </ScrollView>
    </View>
  );
}

// Pick an item's tags from the ones you already use, or make a new one.
export function TagsEditor({
  tags,
  known,
  onChange,
}: {
  tags: string[] | undefined;
  known: string[];
  onChange: (tags: string[] | undefined) => void;
}) {
  const [draft, setDraft] = useState("");
  const current = tags ?? [];
  const has = (tag: string) => current.some((t) => t.toLowerCase() === tag.toLowerCase());
  const options = [...current, ...known.filter((k) => !has(k))];
  const full = current.length >= MAX_TAGS_PER_ITEM;

  function toggle(tag: string) {
    const next = has(tag) ? current.filter((t) => t.toLowerCase() !== tag.toLowerCase()) : full ? current : [...current, tag];
    onChange(next.length ? next : undefined);
  }
  function addDraft() {
    const tag = cleanTag(draft);
    if (!tag) return;
    if (!has(tag) && !full) onChange([...current, tag]);
    setDraft("");
  }

  return (
    <View style={{ gap: 8 }}>
      {options.length ? (
        <View style={ui.chips}>
          {options.map((tag) => (
            <Chip key={tag} icon="price" selected={has(tag)} onPress={() => toggle(tag)}>
              {tag}
            </Chip>
          ))}
        </View>
      ) : null}
      <View style={[ui.row, { gap: 8 }]}>
        <TextInput
          style={[ui.input, { flex: 1 }]}
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={addDraft}
          placeholder={full ? `Up to ${MAX_TAGS_PER_ITEM} tags` : "New tag, like Kids"}
          placeholderTextColor={colors.muted}
          maxLength={MAX_TAG_LENGTH}
          editable={!full}
          returnKeyType="done"
        />
        <Chip onPress={addDraft}>Add</Chip>
      </View>
    </View>
  );
}
