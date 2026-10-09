import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, View } from "react-native";

import { Avatar } from "../../components/avatar";
import { Icon } from "../../components/icon";
import { LoadingScreen, Tap } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { Text } from "../../components/text";
import { Banner, Button, EmptyState, HeaderIcon, NavCard, SectionHeader } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { friendlyError, guarded, tap } from "../../lib/feedback";
import { groupByPerson, isOpenIdea, type Idea } from "../../lib/idea-stash";
import { loadStash, personName, type StashData } from "../../lib/idea-stash-data";
import { supabase } from "../../lib/supabase";
import { colors, ui } from "../../lib/theme";

// Idea Stash (GIFT-036): your private notes about family, grouped by person.
// Only you can ever see these: not the person they're about, and not anyone
// else. Turning an idea into a gift adds an ordinary suggestion on their
// list (GIFT-022), which they can't see either.
//   ?aboutId=...  just the notes about one person.
export default function Stash() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id;
  const { aboutId } = useLocalSearchParams<{ aboutId?: string }>();
  const [data, setData] = useState<StashData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(
    () =>
      userId
        ? guarded(
            async () => {
              setData(await loadStash(userId));
              setError(null);
            },
            setError,
            () => setIsLoading(false)
          )
        : Promise.resolve(),
    [userId]
  );
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (isLoading) return <LoadingScreen cards={3} />;

  const groups = groupByPerson((data?.ideas ?? []).filter((i) => !aboutId || i.about_id === aboutId));
  const who = aboutId && data ? personName(data.people, aboutId) : null;

  function suggest(idea: Idea) {
    tap();
    router.push({ pathname: "/gift-nook/gift-form", params: { forProfileId: idea.about_id, stashId: idea.id } });
  }

  function confirmRemove(idea: Idea) {
    Alert.alert("Remove this note?", idea.title, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          const { error: removeError } = await supabase.from("idea_stash").delete().eq("id", idea.id);
          if (removeError) setError(friendlyError(removeError));
          else load();
        },
      },
    ]);
  }

  return (
    <NookScroll onRefresh={load}>
      <Stack.Screen
        options={{
          title: who ? `Ideas for ${who}` : "Idea Stash",
          headerRight: () => (
            <HeaderIcon
              icon="add"
              label="Add an idea"
              onPress={() => router.push({ pathname: "/gift-nook/stash-form", params: aboutId ? { aboutId } : {} })}
            />
          ),
        }}
      />
      {error ? <Text style={ui.error}>{error}</Text> : null}

      <Banner
        icon="hidden"
        tone="sky"
        title="Just for you"
        body="Nobody else can see this, including the people the notes are about."
      />

      {groups.length === 0 ? (
        <>
          <EmptyState
            icon="suggest"
            title="Nothing here yet"
            body="When someone mentions something they'd love, or you learn their size, jot it down so you remember by the time the gift-giving season rolls around."
          />
          <Button
            title="Add the first one"
            icon="add"
            onPress={() => router.push({ pathname: "/gift-nook/stash-form", params: aboutId ? { aboutId } : {} })}
          />
        </>
      ) : (
        groups.map((group) => {
          const person = data?.people.get(group.aboutId);
          const name = personName(data!.people, group.aboutId);
          return (
            <View key={group.aboutId} style={{ gap: 10 }}>
              {aboutId ? null : (
                <SectionHeader
                  title={name}
                  right={group.open ? <Text style={ui.muted}>{group.open} idea{group.open === 1 ? "" : "s"} to do</Text> : undefined}
                />
              )}
              {group.ideas.map((idea, i) => {
                const open = isOpenIdea(idea);
                return (
                  <NavCard
                    key={idea.id}
                    index={i}
                    icon={idea.kind === "idea" ? "suggest" : "doc"}
                    leading={!aboutId && i === 0 ? <Avatar name={name} icon={person?.avatar_icon} color={person?.avatar_color} /> : undefined}
                    title={idea.title}
                    subtitle={[
                      idea.kind === "note" ? "Good to know" : idea.suggested_at ? "Suggested on their list" : null,
                      idea.price != null ? `about $${idea.price}` : null,
                      idea.notes,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    onPress={() => router.push({ pathname: "/gift-nook/stash-form", params: { ideaId: idea.id } })}
                    onLongPress={() => confirmRemove(idea)}
                    right={
                      open ? (
                        <Tap
                          onPress={() => suggest(idea)}
                          hitSlop={8}
                          pressedScale={0.9}
                          style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.barkSoft }}
                          accessibilityLabel={`Suggest ${idea.title} on ${name}'s list`}
                        >
                          <Icon name="gift" size={14} color={colors.bark} />
                          <Text style={{ color: colors.bark, fontWeight: "700", fontSize: 12 }}>Suggest</Text>
                        </Tap>
                      ) : idea.suggested_at ? (
                        <Icon name="check" size={18} color={colors.muted} />
                      ) : undefined
                    }
                  />
                );
              })}
            </View>
          );
        })
      )}
      {groups.length ? <Text style={ui.muted}>Tap a note to change it, hold to remove it. "Suggest" adds it to their Wishbook as a suggestion they can't see.</Text> : null}
    </NookScroll>
  );
}
