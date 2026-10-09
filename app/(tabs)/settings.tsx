import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Switch, Text as PlainText, useColorScheme, View } from "react-native";
import { Text, TextInput } from "../../components/text";

import { Avatar } from "../../components/avatar";
import { Button, NavCard, SectionHeader } from "../../components/ui";
import { NookScroll } from "../../components/nook-scroll";
import { useTour } from "../../components/tour";
import { useAuth } from "../../lib/auth-context";
import { MAX_CUSTOM_THEMES, buildHearthTheme } from "../../lib/custom-theme";
import {
  builtInThemes,
  hearthThemes,
  useHearthLayout,
  type HearthThemeKey,
} from "../../lib/hearth";
import { fontChoices, familyFor } from "../../lib/fonts";
import { textSizeChoices } from "../../lib/text-size";
import { formatDate } from "../../lib/gift-nook";
import { hasRealName, useMyProfile } from "../../lib/profile";
import { supabase } from "../../lib/supabase";
import { colors, fontsAreReady, ui } from "../../lib/theme";
import { Tap } from "../../components/motion";

// Settings tab (CORE-013/025): account-wide things — who you are, your name,
// how your Hearth looks (CORE-008), the tour again (CORE-026), signing out.
// Each Nook has its own settings page for Nook-specific options.
export default function HearthSettings() {
  const router = useRouter();
  const { session } = useAuth();
  const user = session?.user;

  const { profile } = useMyProfile();
  const tour = useTour();
  const {
    layout,
    save: saveHearth,
    isLoading: hearthLoading,
  } = useHearthLayout();
  const [hearthTitle, setHearthTitle] = useState<string | null>(null);
  // Is Dusk showing only because the phone is in dark mode (CORE-032)?
  const phoneIsDark = useColorScheme() === "dark";
  const duskFromPhone = phoneIsDark && layout.followPhone && layout.theme !== "dusk";

  // Picking a theme always shows it straight away: if the phone's dark mode
  // was overriding it, stop following the phone (the switch is right below).
  function pickTheme(theme: HearthThemeKey) {
    saveHearthChanges(
      phoneIsDark && layout.followPhone && theme !== "dusk" ? { theme, followPhone: false } : { theme }
    );
  }

  // The built-in themes, then the ones you've made (CORE-043).
  const themeChoices = [
    ...builtInThemes.map((key) => ({ key: key as HearthThemeKey, theme: hearthThemes[key] })),
    ...layout.customThemes.map((custom) => ({ key: custom.id, theme: buildHearthTheme(custom) })),
  ];

  function saveHearthChanges(changes: Parameters<typeof saveHearth>[0]) {
    saveHearth(changes).catch((saveError: Error) =>
      Alert.alert("Couldn't save that", saveError.message),
    );
  }

  function commitHearthTitle() {
    if (hearthTitle === null) return;
    const next = hearthTitle.trim() || "The Hearth";
    if (next !== layout.title) saveHearthChanges({ title: next });
  }

  function confirmSignOut() {
    Alert.alert(
      "Sign out?",
      "You can sign back in any time with a code sent to your email.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign out",
          style: "destructive",
          onPress: async () => {
            await supabase.auth.signOut();
            router.replace("/sign-in");
          },
        },
      ],
    );
  }

  return (
    <NookScroll>
      <SectionHeader title="You" icon="person" />
      <NavCard
        icon="person"
        title={
          profile ? (
            <Text>
              {hasRealName(profile.display_name)
                ? profile.display_name
                : "Add your name"}
            </Text>
          ) : (
            "Your profile"
          )
        }
        subtitle={
          profile?.bio?.trim() ||
          "Name, picture, birthday and bio — what your family sees"
        }
        leading={
          profile ? (
            <Avatar
              name={profile.display_name}
              icon={profile.avatar_icon}
              color={profile.avatar_color}
              size={44}
            />
          ) : undefined
        }
        onPress={() => router.push("/profile")}
      />

      <Text style={ui.sectionTitle}>Your Hearth</Text>
      {hearthLoading ? (
        <ActivityIndicator />
      ) : (
        <>
          <Text style={ui.label}>Name</Text>
          <TextInput
            style={ui.input}
            value={hearthTitle ?? layout.title}
            onChangeText={setHearthTitle}
            onEndEditing={commitHearthTitle}
            placeholder="The Hearth"
            returnKeyType="done"
          />
          <Text style={ui.label}>Theme</Text>
          <View style={ui.chips}>
            {themeChoices.map(({ key, theme }) => {
              const selected = layout.theme === key;
              return (
                <Tap
                  key={key}
                  onPress={() => pickTheme(key)}
                  style={[
                    ui.chip,
                    {
                      backgroundColor: theme.background,
                      borderColor: theme.accent,
                    },
                    selected && { borderWidth: 3 },
                  ]}
                >
                  <Text
                    style={{
                      color: theme.text,
                      fontWeight: selected ? "700" : "400",
                    }}
                  >
                    {theme.label}
                  </Text>
                </Tap>
              );
            })}
          </View>
          <Text style={ui.muted}>
            {duskFromPhone
              ? "Your phone is in dark mode, so Nook is wearing Dusk. Pick a theme to switch to it now."
              : "Your theme dresses the whole app, not just the Hearth."}
          </Text>
          {layout.customThemes.map((custom) => (
            <Tap
              key={custom.id}
              onPress={() => router.push({ pathname: "/theme-editor", params: { id: custom.id } })}
              style={[ui.card, ui.row, { gap: 12 }]}
              accessibilityRole="button"
              accessibilityLabel={`Change ${custom.name}`}
            >
              <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: custom.background, borderWidth: 3, borderColor: custom.accent }} />
              <Text style={[ui.cardTitle, { flex: 1 }]}>{custom.name}</Text>
              <Text style={ui.link}>Change</Text>
            </Tap>
          ))}
          {layout.customThemes.length < MAX_CUSTOM_THEMES ? (
            <NavCard
              icon="palette"
              title="Make your own theme"
              subtitle="Pick a background and an accent; the rest is chosen for you"
              onPress={() => router.push("/theme-editor")}
            />
          ) : null}
          <NavCard
            icon="leaf"
            title="Change with the seasons"
            subtitle={layout.seasonal.enabled ? "On — your Hearth dresses for the time of year" : "A different theme for winter, spring, summer and autumn"}
            onPress={() => router.push("/theme-seasons")}
          />
          <Text style={ui.label}>Text size</Text>
          {textSizeChoices.map((choice) => {
            const selected = (layout.textSize ?? "normal") === choice.key;
            return (
              <Tap
                key={choice.key}
                onPress={() => saveHearthChanges({ textSize: choice.key })}
                style={[
                  ui.card,
                  { gap: 2, borderWidth: selected ? 2 : undefined, borderColor: selected ? colors.bark : undefined },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${choice.label} text. ${choice.description}`}
              >
                {/* Drawn at the size it describes, whatever's chosen now. */}
                <PlainText style={{ fontSize: 16 * choice.factor, fontWeight: "700", color: colors.text }}>
                  {choice.label}
                </PlainText>
                <PlainText style={{ fontSize: 13 * choice.factor, color: colors.muted }}>{choice.description}</PlainText>
              </Tap>
            );
          })}
          <Text style={ui.muted}>
            Makes words bigger everywhere except the tiles on your Hearth, which keep their size so your layout stays
            just as you arranged it.
          </Text>
          <Text style={ui.label}>Font</Text>
          {fontChoices.map((choice) => {
            const selected = layout.font === choice.key;
            // Each sample is drawn in its own font, whatever's chosen now.
            const family = (weight: number) =>
              fontsAreReady() ? familyFor(choice.key, weight) ?? undefined : undefined;
            return (
              <Tap
                key={choice.key}
                onPress={() => saveHearthChanges({ font: choice.key })}
                style={[
                  ui.card,
                  { gap: 2, borderWidth: selected ? 2 : undefined, borderColor: selected ? colors.bark : undefined },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <PlainText
                  style={{
                    fontSize: 22,
                    color: colors.text,
                    fontFamily: family(800),
                    fontWeight: family(800) ? "normal" : "800",
                  }}
                >
                  Good evening
                </PlainText>
                <PlainText style={{ fontSize: 14, color: colors.muted, fontFamily: family(400) }}>
                  {choice.label} · {choice.description}
                </PlainText>
              </Tap>
            );
          })}

          <View style={[ui.card, ui.row, { gap: 12 }]}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={ui.cardTitle}>Go dark with my phone</Text>
              <Text style={ui.muted}>
                Switch to Dusk whenever your phone is in dark mode.
              </Text>
            </View>
            <Switch
              value={layout.followPhone}
              onValueChange={(followPhone) =>
                saveHearthChanges({ followPhone })
              }
              trackColor={{ true: colors.bark }}
            />
          </View>
          <Text style={ui.muted}>
            To arrange, resize, or recolor your Nooks, tap Edit on the Hearth.
          </Text>
        </>
      )}

      <NavCard
        icon="sparkles"
        title="Show me around again"
        subtitle="Replay the little tour of the Hearth, Nooks and Burrows"
        onPress={() =>
          tour
            ?.replay()
            .then(() => router.navigate("/hearth"))
            .catch((replayError: Error) => Alert.alert("Couldn't start the tour", replayError.message))
        }
      />

      <NavCard
        icon="help"
        title="Help"
        subtitle="Answers to common questions"
        onPress={() => router.push("/help")}
      />

      <Text style={ui.sectionTitle}>Account</Text>
      <View style={ui.card}>
        <Text style={ui.muted}>Email</Text>
        <Text style={ui.cardTitle}>{user?.email}</Text>
        {user?.created_at ? (
          <>
            <Text style={[ui.muted, { marginTop: 8 }]}>Member since</Text>
            <Text style={ui.cardTitle}>{formatDate(user.created_at)}</Text>
          </>
        ) : null}
      </View>

      <Button
        title="Sign out"
        icon="logout"
        variant="secondary"
        onPress={confirmSignOut}
      />

      <Text style={[ui.muted, { textAlign: "center", marginTop: 24 }]}>
        Nook v{Constants.expoConfig?.version ?? "?"}
      </Text>
    </NookScroll>
  );
}
