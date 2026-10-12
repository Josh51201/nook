import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, StyleSheet, View, type TextInput as RNTextInput } from "react-native";

import { HeaderWithHelp } from "../../components/help-button";
import { Icon } from "../../components/icon";
import { LoadingScreen, Tap } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { Text, TextInput } from "../../components/text";
import { Button, Chip, EmptyState, SectionHeader } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { friendlyError, tap } from "../../lib/feedback";
import {
  continueChecklist,
  editedWords,
  folderNames,
  noteBlocks,
  noteTitle,
  toggleCheck,
  toggleChecklistLine,
  type Note,
} from "../../lib/notes";
import { createNote, overwriteNoteBody, personName, saveNoteBody, useNotes } from "../../lib/notes-data";
import { supabase } from "../../lib/supabase";
import { colors, themed, ui } from "../../lib/theme";

type Status = "idle" | "saving" | "saved" | "offline";

// One note (NOTE-002..006, NOTE-009). Reading it shows checklist items as
// boxes to tick; tap any words to write. It saves as you type, a moment
// after you stop. A shared note can be changed by the people you live with
// too; if two of you change it at once, it asks whose words to keep rather
// than quietly losing one.
export default function NotePage() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; folder?: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;
  const { data } = useNotes(userId);

  const [note, setNote] = useState<Note | null>(null);
  const [body, setBody] = useState("");
  const [ready, setReady] = useState(false);
  const [editing, setEditing] = useState(params.id === "new");
  const [selection, setSelection] = useState<{ start: number; end: number } | undefined>(undefined);
  const [status, setStatus] = useState<Status>("idle");
  const [newFolder, setNewFolder] = useState<string | null>(null);

  // The latest words, the note's id once it exists, and the version we last
  // saw, for saving outside React's render cycle.
  const bodyRef = useRef("");
  const idRef = useRef<string | null>(params.id === "new" ? null : params.id);
  const sinceRef = useRef<string | null>(null);
  const dirty = useRef(false);
  const saving = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cursor = useRef(0);
  // Typed in on this visit (only then is an emptied note removed on the way
  // out, never one that just hadn't loaded yet), and still on screen.
  const touched = useRef(false);
  const mounted = useRef(true);
  const input = useRef<RNTextInput>(null);

  useEffect(() => {
    if (ready || !data) return;
    if (idRef.current) {
      const found = data.notes.find((n) => n.id === idRef.current);
      if (!found) return setReady(true);
      setNote(found);
      setBody(found.body);
      bodyRef.current = found.body;
      sinceRef.current = found.updated_at;
    }
    setReady(true);
  }, [data, ready]);

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (saving.current || !dirty.current) return;
    const text = bodyRef.current;
    if (!idRef.current && !text.trim()) return;
    saving.current = true;
    dirty.current = false;
    setStatus("saving");

    const result = idRef.current
      ? await saveNoteBody(idRef.current, text, sinceRef.current ?? "")
      : await createNote(text, params.folder ?? null);
    saving.current = false;

    if ("note" in result && result.note) {
      const saved = result.note;
      if (!idRef.current) {
        idRef.current = saved.id;
        if (mounted.current) router.setParams({ id: saved.id });
      }
      sinceRef.current = saved.updated_at;
      setNote(saved);
      setStatus("saved");
    } else if ("conflict" in result) {
      setStatus("idle");
      askWhoseWords(text, result.conflict ?? null);
    } else {
      // Couldn't reach the server: keep the words and try again shortly.
      dirty.current = true;
      setStatus("offline");
    }
    if (dirty.current) timer.current = setTimeout(() => void flushRef.current(), 2500);
  }, [params.folder, router]);
  const flushRef = useRef(flush);
  flushRef.current = flush;

  // Save what's left on the way out, and don't keep a note that was emptied.
  useEffect(
    () => () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
      const id = idRef.current;
      if (id && touched.current && !bodyRef.current.trim()) {
        void supabase.from("notes").delete().eq("id", id);
      } else {
        void flushRef.current();
      }
    },
    []
  );

  function askWhoseWords(mine: string, theirs: Note | null) {
    if (!theirs) {
      Alert.alert("This note was removed", "Whoever wrote it removed it, or stopped sharing it, while you were writing. Copy your words before you leave if you want them.");
      return;
    }
    const who = personName(data?.names ?? new Map(), theirs.edited_by, userId);
    Alert.alert(`${who === "You" ? "You" : who} changed this note too`, "While you were writing, it was changed somewhere else. Whose words should it keep?", [
      {
        text: "Theirs",
        onPress: () => {
          setNote(theirs);
          setBody(theirs.body);
          bodyRef.current = theirs.body;
          sinceRef.current = theirs.updated_at;
        },
      },
      {
        text: "Mine",
        onPress: async () => {
          const result = await overwriteNoteBody(theirs.id, mine);
          if ("note" in result && result.note) {
            sinceRef.current = result.note.updated_at;
            setNote(result.note);
            setStatus("saved");
          }
        },
      },
    ]);
  }

  function change(next: string) {
    const continued = continueChecklist(bodyRef.current, next);
    const text = continued ? continued.body : next;
    if (continued) setSelection({ start: continued.cursor, end: continued.cursor });
    setBody(text);
    bodyRef.current = text;
    dirty.current = true;
    touched.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flushRef.current(), 800);
  }

  function checklistButton() {
    tap();
    const next = toggleChecklistLine(bodyRef.current, cursor.current);
    change(next.body);
    setSelection({ start: next.cursor, end: next.cursor });
    input.current?.focus();
  }

  function tick(line: number) {
    tap();
    change(toggleCheck(bodyRef.current, line));
    void flushRef.current();
  }

  // Tap words while reading: start writing there.
  function writeAt(line: number | null) {
    const lines = bodyRef.current.split("\n");
    const at = line === null ? bodyRef.current.length : lines.slice(0, line + 1).join("\n").length;
    setSelection({ start: at, end: at });
    setEditing(true);
  }

  function done() {
    tap();
    input.current?.blur();
    setEditing(false);
    void flushRef.current();
  }

  async function setField(changes: Partial<Pick<Note, "pinned" | "folder" | "shared">>) {
    if (!note) return;
    tap();
    const { data: row, error } = await supabase.from("notes").update(changes).eq("id", note.id).select("*").single();
    if (error) return Alert.alert("Couldn't change that", friendlyError(error));
    setNote(row as Note);
  }

  function confirmDelete() {
    Alert.alert(`Delete “${noteTitle(bodyRef.current)}”?`, note?.shared ? "It's gone for everyone it's shared with, too." : "This can't be undone.", [
      { text: "Keep it", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.from("notes").delete().eq("id", note!.id);
          if (error) return Alert.alert("Couldn't delete it", friendlyError(error));
          idRef.current = null;
          dirty.current = false;
          router.back();
        },
      },
    ]);
  }

  if (!data || !ready) return <LoadingScreen cards={1} />;
  if (idRef.current && !note) {
    return <EmptyState icon="note" title="This note isn't here" body="It may have been deleted, or it's no longer shared with you." />;
  }

  const owner = !note || note.owner_id === userId;
  const blocks = noteBlocks(body);
  const titleLine = blocks.findIndex((b) => b.text.trim());
  const folders = folderNames(data.notes.filter((n) => n.owner_id === userId));
  const statusWords = status === "saving" ? "Saving…" : status === "saved" ? "Saved" : status === "offline" ? "Not saved yet, trying again" : "";

  return (
    <NookScroll
      pinned={
        editing ? (
          <View style={[ui.row, { justifyContent: "space-between" }]}>
            <Tap onPress={checklistButton} style={styles.tool} accessibilityRole="button" accessibilityLabel="Checklist: put a box on this line">
              <Icon name="todo" size={18} color={colors.bark} />
              <Text style={ui.secondaryButtonText}>Checklist</Text>
            </Tap>
            <Text style={[ui.muted, { fontSize: 13 }]}>{statusWords}</Text>
          </View>
        ) : undefined
      }
    >
      <Stack.Screen
        options={{
          title: "",
          headerRight: () =>
            editing ? (
              <Tap onPress={done} hitSlop={10}>
                <Text style={{ color: colors.bark, fontSize: 17, fontWeight: "700" }}>Done</Text>
              </Tap>
            ) : (
              <HeaderWithHelp />
            ),
        }}
      />

      {editing ? (
        <TextInput
          ref={input}
          style={styles.editor}
          value={body}
          onChangeText={change}
          selection={selection}
          onSelectionChange={(e) => {
            cursor.current = e.nativeEvent.selection.start;
            if (selection) setSelection(undefined);
          }}
          placeholder={"Title\nThen anything you like…"}
          placeholderTextColor={colors.muted}
          multiline
          scrollEnabled={false}
          autoFocus
          maxLength={20000}
          textAlignVertical="top"
          accessibilityLabel="Note"
        />
      ) : (
        <Tap onPress={() => writeAt(null)} pressedScale={1} style={{ minHeight: 240, gap: 2 }} accessibilityHint="Tap to write">
          {body.trim() ? (
            blocks.map((block, i) =>
              block.kind === "check" ? (
                <View key={block.line} style={styles.check}>
                  <Tap
                    onPress={() => tick(block.line)}
                    hitSlop={8}
                    pressedScale={0.85}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: block.done }}
                    accessibilityLabel={block.text || "Empty item"}
                  >
                    <View style={[styles.box, block.done && { backgroundColor: colors.bark, borderColor: colors.bark }]}>
                      {block.done ? <Icon name="check" size={14} color={colors.onAccent} /> : null}
                    </View>
                  </Tap>
                  <Tap onPress={() => writeAt(block.line)} pressedScale={1} style={{ flex: 1 }}>
                    <Text style={[styles.text, block.done && { color: colors.muted, textDecorationLine: "line-through" }]}>{block.text || " "}</Text>
                  </Tap>
                </View>
              ) : (
                <Tap key={block.line} onPress={() => writeAt(block.line)} pressedScale={1}>
                  <Text style={i === titleLine ? styles.title : styles.text}>{block.text || " "}</Text>
                </Tap>
              )
            )
          ) : (
            <Text style={[styles.text, { color: colors.muted }]}>Empty. Tap to write.</Text>
          )}
        </Tap>
      )}

      {note && !editing ? (
        <View style={{ gap: 12, marginTop: 8 }}>
          <Text style={[ui.muted, { fontSize: 13 }]}>
            {note.shared ? (owner ? "Shared with your Home" : `${personName(data.names, note.owner_id, userId)}'s, shared with your Home`) : "Just you"}
            {" · "}
            {note.shared && note.edited_by && note.edited_by !== userId ? `edited by ${personName(data.names, note.edited_by, userId)}, ` : "edited "}
            {editedWords(note.updated_at)}
          </Text>

          {owner ? (
            <>
              <SectionHeader title="This note" icon="note" />
              <View style={ui.chips}>
                <Chip icon="pin" selected={note.pinned} onPress={() => setField({ pinned: !note.pinned })}>
                  {note.pinned ? "Pinned" : "Pin to the top"}
                </Chip>
                <Chip icon="lock" selected={!note.shared} onPress={() => setField({ shared: false })}>
                  Just me
                </Chip>
                <Chip icon="group" selected={note.shared} onPress={() => setField({ shared: true })}>
                  Share with my Home
                </Chip>
              </View>
              {note.shared ? (
                <Text style={ui.muted}>Everyone you live with can read it and change the words, like ticking off a packing list. Only you can pin, file, unshare or delete it.</Text>
              ) : null}

              <Text style={ui.label}>Folder</Text>
              <View style={ui.chips}>
                <Chip selected={!note.folder} onPress={() => setField({ folder: null })}>
                  None
                </Chip>
                {folders.map((f) => (
                  <Chip key={f} icon="folder" selected={note.folder === f} onPress={() => setField({ folder: f })}>
                    {f}
                  </Chip>
                ))}
                {newFolder === null ? (
                  <Chip icon="add" onPress={() => setNewFolder("")}>
                    New folder
                  </Chip>
                ) : null}
              </View>
              {newFolder !== null ? (
                <TextInput
                  style={ui.input}
                  value={newFolder}
                  onChangeText={setNewFolder}
                  placeholder="Folder name, e.g. House"
                  placeholderTextColor={colors.muted}
                  maxLength={30}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={() => {
                    const name = newFolder.trim();
                    setNewFolder(null);
                    if (name) setField({ folder: name });
                  }}
                />
              ) : null}

              <Button title="Delete note" icon="trash" variant="danger" onPress={confirmDelete} style={{ marginTop: 8 }} />
            </>
          ) : null}
        </View>
      ) : null}
    </NookScroll>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    editor: { fontSize: 17, lineHeight: 25, color: colors.text, minHeight: 320, paddingTop: 4 },
    title: { fontSize: 24, lineHeight: 31, fontWeight: "800", color: colors.text, letterSpacing: -0.3, marginBottom: 4 },
    text: { fontSize: 17, lineHeight: 25, color: colors.text },
    check: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 3 },
    box: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: colors.muted,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 2,
    },
    tool: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: colors.barkSoft },
  })
);
