import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { Alert, ScrollView, Share, TextInput, View } from "react-native";

import { normalizeCustomTheme } from "../../lib/custom-theme";
import { tap } from "../../lib/feedback";
import { hearthThemes, type HearthLayout } from "../../lib/hearth";
import { cleanCode, isFullCode, isHearthLook, lookSummary, packLook, type LookKind, type SharedLook } from "../../lib/hearth-share";
import { supabase } from "../../lib/supabase";
import { colors, ui } from "../../lib/theme";
import { BottomSheet } from "../bottom-sheet";
import { IconBadge } from "../icon";
import { Text } from "../text";
import { Button, Chip } from "../ui";

// Share a look (CORE-055): make a code for your theme or your whole Hearth
// to send to family, or type in a code family sent you.
export type OpenedLook = { kind: LookKind; look: SharedLook; fromName: string };

export function ShareSheet({
  visible,
  onClose,
  layout,
  onUseTheme,
  onTryHearth,
}: {
  visible: boolean;
  onClose: () => void;
  // Your own Hearth (never the Home page).
  layout: HearthLayout;
  onUseTheme: (opened: OpenedLook) => void;
  onTryHearth: (opened: OpenedLook) => void;
}) {
  const [tab, setTab] = useState<"share" | "use">("share");
  const [kind, setKind] = useState<LookKind>("theme");
  const [code, setCode] = useState<string | null>(null);
  const [making, setMaking] = useState(false);
  const [typed, setTyped] = useState("");
  const [looking, setLooking] = useState(false);
  const [opened, setOpened] = useState<OpenedLook | null>(null);

  async function makeCode() {
    setMaking(true);
    const { data, error } = await supabase.rpc("share_look", { look_kind: kind, look_data: packLook(layout, kind) });
    setMaking(false);
    if (error) return Alert.alert("Couldn't make a code", error.message);
    tap("success");
    setCode(data as string);
  }

  async function lookUp() {
    const clean = cleanCode(typed);
    if (!isFullCode(clean)) return Alert.alert("Check the code", "It's 6 letters and numbers, like K7PM3Q.");
    setLooking(true);
    const { data, error } = await supabase.rpc("open_look", { look_code: clean });
    setLooking(false);
    const row = (data as { kind: LookKind; look: SharedLook; from_name: string }[] | null)?.[0];
    if (error) return Alert.alert("Couldn't look that up", error.message);
    if (!row) {
      return Alert.alert(
        "No look with that code",
        "Check the letters, and that it's from someone in one of your Burrows. Codes last 30 days."
      );
    }
    tap();
    setOpened({ kind: row.kind, look: row.look, fromName: row.from_name });
  }

  function close() {
    onClose();
    setCode(null);
    setOpened(null);
    setTyped("");
  }

  const message = (shared: string) =>
    `Here's my Nook ${kind === "theme" ? "theme" : "Hearth"}! In Nook, tap Edit on your Hearth, then Share → "Use a code", and type ${shared}`;

  return (
    <BottomSheet
      visible={visible}
      onClose={close}
      header={
        <View style={[ui.row, { gap: 12 }]}>
          <IconBadge name="share" size={44} />
          <Text style={[ui.sectionTitle, { marginTop: 0, flex: 1 }]}>Share a look</Text>
        </View>
      }
    >
      <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 24 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={ui.chips}>
          <Chip icon="share" selected={tab === "share"} onPress={() => setTab("share")}>
            Share mine
          </Chip>
          <Chip icon="key" selected={tab === "use"} onPress={() => setTab("use")}>
            Use a code
          </Chip>
        </View>

        {tab === "share" ? (
          <>
            <Text style={ui.label}>What to share</Text>
            <View style={ui.chips}>
              <Chip icon="palette" selected={kind === "theme"} onPress={() => (setKind("theme"), setCode(null))}>
                Just my theme
              </Chip>
              <Chip icon="hearth" selected={kind === "hearth"} onPress={() => (setKind("hearth"), setCode(null))}>
                My whole Hearth
              </Chip>
            </View>
            <Text style={ui.muted}>
              {kind === "theme"
                ? "Your colors, wallpaper and ambience."
                : "Every page and everything on it, in your theme. Checklists, habit days, your photos and your pets stay with you, and each widget shows them their own things."}{" "}
              Anyone in one of your Burrows can use the code for 30 days.
            </Text>
            {code ? (
              <View style={[ui.card, { alignItems: "center", gap: 10, paddingVertical: 20 }]}>
                <Text style={ui.muted}>Your code</Text>
                <Text selectable style={{ fontSize: 38, fontWeight: "800", letterSpacing: 6, color: colors.text }}>
                  {code}
                </Text>
                <View style={[ui.row, { gap: 10 }]}>
                  <Button title="Send it" icon="share" onPress={() => Share.share({ message: message(code) }).catch(() => {})} />
                  <Button
                    title="Copy"
                    icon="copy"
                    variant="secondary"
                    onPress={() => {
                      tap();
                      Clipboard.setStringAsync(code).catch(() => {});
                    }}
                  />
                </View>
              </View>
            ) : (
              <Button title="Make a code" icon="key" onPress={makeCode} loading={making} />
            )}
          </>
        ) : opened ? (
          <LookPreview opened={opened} onUseTheme={() => onUseTheme(opened)} onTryHearth={() => onTryHearth(opened)} onBack={() => setOpened(null)} />
        ) : (
          <>
            <Text style={ui.muted}>Family sent you a code? Type it here to see their look before you use it.</Text>
            <TextInput
              style={[ui.input, { fontSize: 24, fontWeight: "700", letterSpacing: 4, textAlign: "center" }]}
              value={typed}
              onChangeText={(text) => setTyped(cleanCode(text))}
              placeholder="K7PM3Q"
              placeholderTextColor={colors.muted}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
              returnKeyType="go"
              onSubmitEditing={lookUp}
              accessibilityLabel="The code"
            />
            <Button title="Look it up" icon="search" onPress={lookUp} loading={looking} disabled={typed.length < 6} />
          </>
        )}
      </ScrollView>
    </BottomSheet>
  );
}

function LookPreview({
  opened,
  onUseTheme,
  onTryHearth,
  onBack,
}: {
  opened: OpenedLook;
  onUseTheme: () => void;
  onTryHearth: () => void;
  onBack: () => void;
}) {
  const { look, fromName } = opened;
  const custom = look.custom ? normalizeCustomTheme({ id: "", ...look.custom }) : null;
  const builtIn = hearthThemes[look.theme] ?? hearthThemes.hearth;
  const swatch = custom ? { background: custom.background, accent: custom.accent } : { background: builtIn.background, accent: builtIn.accent };
  const whole = isHearthLook(look);
  return (
    <View style={{ gap: 12 }}>
      <View style={[ui.card, { flexDirection: "row", gap: 14, alignItems: "center" }]}>
        <View style={{ width: 54, height: 54, borderRadius: 16, backgroundColor: swatch.background, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }}>
          <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: swatch.accent }} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={ui.cardTitle}>{whole ? `${fromName}'s whole Hearth` : `${fromName}'s theme`}</Text>
          <Text style={ui.muted}>{lookSummary(look)}</Text>
        </View>
      </View>
      {whole ? (
        <>
          <Button title="Try the whole Hearth" icon="sparkles" onPress={onTryHearth} />
          <Text style={ui.muted}>
            It's added to your Scenes and switched on. Your own Hearth is kept as a scene too, so you can switch back any time
            (Edit → Scenes).
          </Text>
          <Button title="Just use the theme" icon="palette" variant="secondary" onPress={onUseTheme} />
        </>
      ) : (
        <>
          <Button title="Use this theme" icon="palette" onPress={onUseTheme} />
          <Text style={ui.muted}>Your Hearth's colors, wallpaper and ambience change; everything on it stays put.</Text>
        </>
      )}
      <Button title="Type a different code" variant="secondary" onPress={onBack} />
    </View>
  );
}
