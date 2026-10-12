import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

import { Collapsible } from "../components/collapsible";
import { Icon } from "../components/icon";
import { Appear, Tap } from "../components/motion";
import { NookScroll } from "../components/nook-scroll";
import { Text, TextInput } from "../components/text";
import { useTour } from "../components/tour";
import { NavCard, SectionHeader } from "../components/ui";
import { tap } from "../lib/feedback";
import { helpSections, helpWords, searchHelp, type HelpAnswer, type HelpSection } from "../lib/help";
import { colors, themed, ui } from "../lib/theme";

// Help (CORE-070, CORE-102): a start for new people, the words the app uses,
// and a few plain questions for each part of the app and each Nook, with a
// search box over all of them. Reached from the "?" on any screen (which
// opens it on that screen's Nook with `?topic=`) and from Settings.
export default function Help() {
  const router = useRouter();
  const tour = useTour();
  const { topic } = useLocalSearchParams<{ topic?: string }>();
  const [query, setQuery] = useState("");

  const here = helpSections.find((s) => s.id === topic && s.id !== "start");
  const start = helpSections.find((s) => s.id === "start")!;
  const around = helpSections.filter((s) => !s.nook && s.id !== "start" && s.id !== here?.id);
  const nooks = helpSections.filter((s) => s.nook && s.id !== here?.id);
  const searching = query.trim().length > 0;
  const found = searching ? searchHelp(query) : [];
  const sectionTitle = (id: string) => helpSections.find((s) => s.id === id)?.title ?? "";

  return (
    <NookScroll>
      <Stack.Screen options={{ title: here ? `Help · ${here.title}` : "Help" }} />

      <View style={[ui.input, ui.row, { paddingVertical: 0 }]}>
        <Icon name="search" size={16} color={colors.muted} />
        <TextInput
          style={{ flex: 1, paddingVertical: 13, fontSize: 16, color: colors.text }}
          value={query}
          onChangeText={setQuery}
          placeholder="Search for an answer"
          placeholderTextColor={colors.muted}
          returnKeyType="search"
          clearButtonMode="while-editing"
          accessibilityLabel="Search for an answer"
        />
      </View>

      {searching ? (
        found.length ? (
          <View style={[ui.card, { paddingVertical: 4 }]}>
            <Answers answers={found} label={(a) => sectionTitle(a.section ?? "")} />
          </View>
        ) : (
          <Text style={ui.muted}>
            Nothing matches "{query.trim()}". Try fewer or different words, like "invite" or "Wishbook".
          </Text>
        )
      ) : (
        <>
          {here ? (
            <>
              <SectionHeader title={here.title} icon={here.icon} />
              <Text style={[ui.muted, { marginTop: -6 }]}>{here.blurb}</Text>
              <View style={[ui.card, { paddingVertical: 4 }]}>
                <Answers answers={here.answers} />
              </View>
            </>
          ) : null}

          {/* New people first, unless they came here from a Nook's "?". */}
          {here ? (
            <Section section={start} />
          ) : (
            <>
              <SectionHeader title={start.title} icon={start.icon} />
              <Text style={[ui.muted, { marginTop: -6 }]}>{start.blurb}</Text>
              <View style={[ui.card, { paddingVertical: 4 }]}>
                <Answers answers={start.answers} />
              </View>
            </>
          )}

          <Collapsible id="help-words" title="Words you'll see" icon="note" summary="Burrow, Tuck, Knock and the rest, in plain words">
            {helpWords.map((item, i) => (
              <Appear key={item.word} index={i}>
                <View style={[ui.row, { gap: 12, alignItems: "flex-start" }]}>
                  <Icon name={item.icon} size={18} style={{ marginTop: 2 }} />
                  <Text style={[styles.answer, { flex: 1 }]}>
                    <Text style={{ fontWeight: "700" }}>{item.word}</Text>: {item.meaning}
                  </Text>
                </View>
              </Appear>
            ))}
          </Collapsible>

          <SectionHeader title="Around the app" icon="hearth" />
          {around.map((section) => (
            <Section key={section.id} section={section} />
          ))}

          <SectionHeader title="Each Nook" icon="nooks" />
          {nooks.map((section) => (
            <Section key={section.id} section={section} />
          ))}
        </>
      )}

      <SectionHeader title="Still stuck?" icon="help" />
      <NavCard
        icon="sparkles"
        title="Show me around again"
        subtitle="Replay the little tour"
        onPress={() =>
          tour
            ?.replay()
            .then(() => router.navigate("/hearth"))
            .catch((error: Error) => Alert.alert("Couldn't start the tour", error.message))
        }
      />
      <NavCard
        icon="settings"
        title="Make the text bigger"
        subtitle="Settings → Text size"
        onPress={() => router.navigate("/settings")}
      />
    </NookScroll>
  );
}

// One part of Help that opens to show its questions.
function Section({ section }: { section: HelpSection }) {
  return (
    <Collapsible id={`help-${section.id}`} title={section.title} icon={section.icon} summary={section.blurb}>
      <View style={{ marginHorizontal: -14, marginBottom: -12 }}>
        <Answers answers={section.answers} />
      </View>
    </Collapsible>
  );
}

// Questions, one tap to open each answer. `label` adds a small line above
// each question (which part of Help a search result came from).
type Answer = HelpAnswer & { section?: string };

function Answers({ answers, label }: { answers: Answer[]; label?: (answer: Answer) => string }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <>
      {answers.map((item, i) => {
        const isOpen = open === item.question;
        return (
          <Tap
            key={item.question}
            onPress={() => {
              tap();
              setOpen(isOpen ? null : item.question);
            }}
            style={[styles.row, i > 0 && styles.divider]}
            accessibilityRole="button"
            accessibilityState={{ expanded: isOpen }}
          >
            {label ? <Text style={[ui.muted, { fontSize: 12, fontWeight: "700" }]}>{label(item)}</Text> : null}
            <View style={[ui.row, { gap: 12 }]}>
              <Text style={[ui.cardTitle, { flex: 1, fontSize: 16 }]}>{item.question}</Text>
              <Icon name={isOpen ? "arrowUp" : "arrowDown"} size={14} color={colors.muted} />
            </View>
            {isOpen ? <Text style={styles.answer}>{item.answer}</Text> : null}
          </Tap>
        );
      })}
    </>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    row: { gap: 8, paddingVertical: 12, paddingHorizontal: 14 },
    divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
    answer: { fontSize: 15, lineHeight: 22, color: colors.text },
  })
);
