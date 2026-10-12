import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { HeaderWithHelp } from "../../components/help-button";
import { Icon } from "../../components/icon";
import { Appear, LoadingScreen, Tap } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { Text, TextInput } from "../../components/text";
import { Button, Chip, EmptyState, HeaderIcon, SectionHeader } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { tap } from "../../lib/feedback";
import { checklistCounts, editedWords, folderNames, notePreview, noteTitle, searchNotes, sortNotes, type Note } from "../../lib/notes";
import { personName, useNotes } from "../../lib/notes-data";
import { colors, ui } from "../../lib/theme";

// Notes home (NOTE-001, NOTE-004, NOTE-005, NOTE-008): search, folders,
// pinned notes first then the newest, and notes shared with you by the
// people you live with.
export default function NotesHome() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id;
  const { data, error, isLoading, reload } = useNotes(userId);
  const [query, setQuery] = useState("");
  const [folder, setFolder] = useState<string | null>(null);

  if (isLoading && !data) return <LoadingScreen cards={4} />;
  if (!data) {
    return (
      <NookScroll onRefresh={reload}>
        <EmptyState icon="note" title="Couldn't open your notes" body={error ?? "Check your connection and try again."} />
      </NookScroll>
    );
  }

  function write() {
    tap();
    router.push({ pathname: "/notes/[id]", params: { id: "new", ...(folder ? { folder } : {}) } });
  }

  const mine = data.notes.filter((n) => n.owner_id === userId);
  const theirs = data.notes.filter((n) => n.owner_id !== userId);
  const folders = folderNames(mine);
  const searching = query.trim().length > 0;
  const inFolder = folder ? mine.filter((n) => n.folder === folder) : mine;
  const found = searching ? sortNotes(searchNotes(data.notes, query)) : [];
  const pinned = sortNotes(inFolder.filter((n) => n.pinned));
  const rest = sortNotes(inFolder.filter((n) => !n.pinned));

  function row(note: Note, index: number) {
    const counts = checklistCounts(note.body);
    const preview = notePreview(note.body);
    const from = note.owner_id !== userId ? personName(data!.names, note.owner_id, userId) : null;
    return (
      <Appear key={note.id} index={index}>
        <Tap
          onPress={() => router.push({ pathname: "/notes/[id]", params: { id: note.id } })}
          style={[ui.card, styles.row]}
          accessibilityRole="button"
          accessibilityLabel={`${noteTitle(note.body)}. ${editedWords(note.updated_at)}`}
        >
          <View style={{ flex: 1, gap: 3 }}>
            <View style={[ui.row, { gap: 6 }]}>
              {note.pinned ? <Icon name="pin" size={12} color={colors.bark} /> : null}
              <Text style={[ui.cardTitle, { flexShrink: 1 }]} numberOfLines={1}>
                {noteTitle(note.body)}
              </Text>
              {note.shared && !from ? <Icon name="group" size={12} color={colors.muted} /> : null}
            </View>
            <Text style={[ui.muted, { fontSize: 13 }]} numberOfLines={1}>
              <Text style={{ color: colors.text, fontSize: 13 }}>{editedWords(note.updated_at)}</Text>
              {from ? `  ${from}'s` : ""}
              {preview ? `  ${preview}` : "  No more text"}
            </Text>
          </View>
          {counts.total ? (
            <View style={[styles.count, { backgroundColor: colors.barkSoft }]}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: colors.bark }}>
                {counts.done}/{counts.total}
              </Text>
            </View>
          ) : null}
        </Tap>
      </Appear>
    );
  }

  return (
    <NookScroll onRefresh={reload}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <HeaderWithHelp>
              <HeaderIcon icon="edit" label="New note" onPress={write} />
            </HeaderWithHelp>
          ),
        }}
      />

      <View style={[ui.input, ui.row, { paddingVertical: 0 }]}>
        <Icon name="search" size={16} color={colors.muted} />
        <TextInput
          style={{ flex: 1, paddingVertical: 13, fontSize: 16, color: colors.text }}
          value={query}
          onChangeText={setQuery}
          placeholder="Search your notes"
          placeholderTextColor={colors.muted}
          returnKeyType="search"
          clearButtonMode="while-editing"
          accessibilityLabel="Search your notes"
        />
      </View>

      {!data.notes.length ? (
        <>
          <EmptyState
            icon="note"
            title="Nothing written yet"
            body="Jot down anything: a packing list, the Wi-Fi password, gift ideas, what the doctor said. The first line becomes the title. Notes are just yours unless you share one with your Home."
          />
          <Button title="Write a note" icon="edit" onPress={write} />
        </>
      ) : searching ? (
        found.length ? (
          <View style={{ gap: 10 }}>{found.map((n, i) => row(n, i))}</View>
        ) : (
          <Text style={ui.muted}>No note has “{query.trim()}” in it.</Text>
        )
      ) : (
        <>
          {folders.length ? (
            <View style={ui.chips}>
              <Chip selected={!folder} onPress={() => setFolder(null)}>
                All notes
              </Chip>
              {folders.map((f) => (
                <Chip key={f} icon="folder" selected={folder === f} onPress={() => setFolder(folder === f ? null : f)}>
                  {f}
                </Chip>
              ))}
            </View>
          ) : null}

          {pinned.length ? (
            <View style={{ gap: 10 }}>
              <SectionHeader title="Pinned" icon="pin" />
              {pinned.map((n, i) => row(n, i))}
            </View>
          ) : null}
          {rest.length ? (
            <View style={{ gap: 10 }}>
              {pinned.length || folder ? <SectionHeader title={folder ?? "Notes"} icon={folder ? "folder" : "note"} /> : null}
              {rest.map((n, i) => row(n, i + pinned.length))}
            </View>
          ) : null}
          {!folder && theirs.length ? (
            <View style={{ gap: 10 }}>
              <SectionHeader title="Shared with you" icon="group" />
              {sortNotes(theirs.map((n) => ({ ...n, pinned: false }))).map((n, i) => row(n, i + mine.length))}
            </View>
          ) : null}

          <Button title="New note" icon="edit" onPress={write} />
        </>
      )}
    </NookScroll>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  count: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
});
