import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Switch, Text, TextInput, View } from "react-native";

import { Avatar } from "../../components/avatar";
import { Button, NavCard, SectionHeader } from "../../components/ui";
import { NookScroll } from "../../components/nook-scroll";
import { useTour } from "../../components/tour";
import { useAuth } from "../../lib/auth-context";
import {
  hearthThemes,
  useHearthLayout,
  type HearthThemeKey,
} from "../../lib/hearth";
import { formatDate } from "../../lib/gift-nook";
import { hasRealName, useMyProfile } from "../../lib/profile";
import { supabase } from "../../lib/supabase";
import { colors, ui } from "../../lib/theme";
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
            {(Object.keys(hearthThemes) as HearthThemeKey[]).map((key) => {
              const theme = hearthThemes[key];
              const selected = layout.theme === key;
              return (
                <Tap
                  key={key}
                  onPress={() => saveHearthChanges({ theme: key })}
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
            Your theme dresses the whole app, not just the Hearth.
          </Text>
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
        subtitle="Replay the little tour of the Hearth and Burrows"
        onPress={() =>
          tour
            ?.replay()
            .then(() => router.navigate("/hearth"))
            .catch((replayError: Error) => Alert.alert("Couldn't start the tour", replayError.message))
        }
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
