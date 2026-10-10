import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, View } from "react-native";

import { Icon } from "../components/icon";
import { Tap } from "../components/motion";
import { NookScroll } from "../components/nook-scroll";
import { Text, TextInput } from "../components/text";
import { Button } from "../components/ui";
import { CONFIRM_WORD, describeDeletion, isConfirmed, type DeletionPreview } from "../lib/account-deletion";
import { deleteMyAccount, loadDeletionPreview } from "../lib/account-deletion-data";
import { useAuth } from "../lib/auth-context";
import { colors, ui } from "../lib/theme";

// Delete your account (AUTH-003). Reached from Settings. Spells out exactly
// what goes (it asks the database, so it's never a guess), then asks you to
// type DELETE before the red button works. Deleting is immediate.
export default function DeleteAccount() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id;

  const [preview, setPreview] = useState<DeletionPreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadDeletionPreview()
      .then((result) => {
        if (!cancelled) setPreview(result);
      })
      .catch((error: Error) => {
        if (!cancelled) setLoadError(error.message || "Couldn't check what would be deleted.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const ready = Boolean(preview) && isConfirmed(typed) && !isDeleting;

  async function confirmDelete() {
    if (!preview || !userId) return;
    setIsDeleting(true);
    try {
      await deleteMyAccount(userId, preview);
      router.replace("/sign-in");
    } catch (error) {
      setIsDeleting(false);
      Alert.alert(
        "Couldn't delete your account",
        `${(error as Error).message || "Check your connection and try again."} Nothing was lost if this didn't finish.`,
      );
    }
  }

  return (
    <NookScroll>
      <View style={[ui.card, { gap: 10, borderColor: colors.error }]}>
        <View style={ui.row}>
          <Icon name="warning" size={20} color={colors.error} />
          <Text style={[ui.cardTitle, { color: colors.error }]}>This can't be undone</Text>
        </View>
        <Text style={ui.muted}>
          Deleting your account removes you from Nook right away. There's no waiting period and no way to get it back.
        </Text>
      </View>

      <Text style={ui.cardTitle}>What will happen</Text>
      {preview ? (
        <View style={[ui.card, { gap: 12 }]}>
          {describeDeletion(preview).map((line) => (
            <Text key={line} style={{ color: colors.text, fontSize: 15, lineHeight: 22 }}>
              {line}
            </Text>
          ))}
        </View>
      ) : loadError ? (
        <View style={[ui.card, { gap: 8 }]}>
          <Text style={{ color: colors.error }}>{loadError}</Text>
          <Text style={ui.muted}>Go back and try again once you're connected.</Text>
        </View>
      ) : (
        <View style={[ui.card, { alignItems: "center" }]}>
          <ActivityIndicator color={colors.bark} />
        </View>
      )}

      <Text style={ui.cardTitle}>Type {CONFIRM_WORD} to confirm</Text>
      <TextInput
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          color: colors.text,
          borderRadius: 14,
          padding: 14,
          fontSize: 16,
        }}
        value={typed}
        onChangeText={setTyped}
        placeholder={CONFIRM_WORD}
        autoCapitalize="characters"
        autoCorrect={false}
        editable={!isDeleting}
        accessibilityLabel={`Type ${CONFIRM_WORD} to confirm deleting your account`}
      />

      <Tap
        onPress={confirmDelete}
        disabled={!ready}
        accessibilityRole="button"
        accessibilityLabel="Delete my account for good"
        accessibilityState={{ disabled: !ready }}
        style={{
          backgroundColor: colors.error,
          opacity: ready ? 1 : 0.4,
          borderRadius: 14,
          padding: 16,
          alignItems: "center",
        }}
      >
        {isDeleting ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <View style={ui.row}>
            <Icon name="trash" size={18} color={colors.white} />
            <Text style={{ color: colors.white, fontSize: 16, fontWeight: "700" }}>Delete my account for good</Text>
          </View>
        )}
      </Tap>

      <Button title="Keep my account" variant="secondary" onPress={() => router.back()} disabled={isDeleting} />
    </NookScroll>
  );
}
