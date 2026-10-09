import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, View } from "react-native";

import { Avatar } from "../components/avatar";
import { Icon } from "../components/icon";
import { Appear, LoadingScreen, Tap } from "../components/motion";
import { NookHero } from "../components/nook-hero";
import { NookScroll } from "../components/nook-scroll";
import { Text } from "../components/text";
import { Banner, Button, EmptyState, SectionHeader } from "../components/ui";
import { useAuth } from "../lib/auth-context";
import { friendlyError, tap } from "../lib/feedback";
import { displayName } from "../lib/gift-nook";
import { MAX_HOME_MEMBERS, useHome, type HomeInvite, type MyKid } from "../lib/home";
import { supabase } from "../lib/supabase";
import { colors, ui } from "../lib/theme";

// Your Home (HOME-001..011): the people you live with. Invite someone from
// your Burrows and, once they accept, every Nook that keeps things for a
// household — the Letterbox's card list, and more to come — is shared
// between you. Kids live here too (HOME-007), counting toward the 6. Each
// person, kids included, is in one Home at a time.
export default function HomePage() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id;
  const { data, error, isLoading, reload } = useHome(userId);
  const [busy, setBusy] = useState(false);

  if (isLoading && !data) return <LoadingScreen cards={3} />;
  if (!data) {
    return (
      <NookScroll onRefresh={reload}>
        <EmptyState icon="hearth" title="Couldn't open your Home" body={error ?? "Check your connection and try again."} />
      </NookScroll>
    );
  }

  const memberIds = new Set(data.members.map((m) => m.profile_id));
  const sentTo = new Set(data.sent.map((i) => i.invited));
  const invitable = [...data.people.values()]
    .filter((p) => !memberIds.has(p.id) && !sentTo.has(p.id))
    .filter((p) => !data.incoming.some((i) => i.invited_by === p.id))
    .sort((a, b) => displayName(a).localeCompare(displayName(b)));
  const alone = data.members.length <= 1;
  const headcount = data.members.length + data.kids.length;
  const full = headcount + data.sent.length >= MAX_HOME_MEMBERS;
  // Kids you look after who don't live in any Home yet (HOME-009).
  const notHome = data.myKids.filter((k) => !k.home_id);
  const elsewhere = data.myKids.filter((k) => k.home_id && !k.lives_with_me);
  const others = data.members.filter((m) => m.profile_id !== userId);

  async function invite(id: string, name: string) {
    setBusy(true);
    const { error: rpcError } = await supabase.rpc("invite_to_home", { target: id });
    setBusy(false);
    if (rpcError) return Alert.alert("Couldn't invite them", friendlyError(rpcError));
    tap("success");
    Alert.alert(`Invite sent to ${name}`, "It'll show up in their inbox.");
    reload();
  }

  async function withdraw(item: HomeInvite) {
    const { error: deleteError } = await supabase.from("home_invites").delete().eq("id", item.id);
    if (deleteError) return Alert.alert("Couldn't do that", friendlyError(deleteError));
    reload();
  }

  function accept(item: HomeInvite) {
    const from = displayName(item.invited_by ? data!.people.get(item.invited_by) : null);
    Alert.alert(
      `Share ${from}'s Home?`,
      alone
        ? "Everything you've kept so far comes along, so it's one set for both of you."
        : "You'll leave the Home you share now. What's kept there stays with the people still in it.",
      [
        { text: "Not now", style: "cancel" },
        {
          text: "Share it",
          onPress: async () => {
            setBusy(true);
            const { error: rpcError } = await supabase.rpc("accept_home_invite", { invite_id: item.id });
            setBusy(false);
            if (rpcError) return Alert.alert("Couldn't join", friendlyError(rpcError));
            tap("success");
            reload();
          },
        },
      ]
    );
  }

  async function setKidHome(kid: MyKid | { id: string; display_name: string | null }, livesHere: boolean) {
    setBusy(true);
    const { error: rpcError } = await supabase.rpc("set_kid_home", { target_kid: kid.id, lives_here: livesHere });
    setBusy(false);
    if (rpcError) return Alert.alert(livesHere ? "Couldn't add them" : "Couldn't do that", friendlyError(rpcError));
    tap("success");
    reload();
  }

  function kidOptions(kidId: string, name: string) {
    Alert.alert(name, undefined, [
      { text: "Manage their profile", onPress: () => router.push(`/gift-nook/managed/${kidId}`) },
      {
        text: "Doesn't live here",
        style: "destructive",
        onPress: () =>
          Alert.alert(
            `Take ${name.split(" ")[0]} out of this Home?`,
            "They stay in your Burrows with their Wishbook, but leave this Home's Nooks (Sitter Sheet, Sick Day) and its Nook Plus. Their sick days here stay with the Home.",
            [
              { text: "Cancel", style: "cancel" },
              { text: "Take them out", style: "destructive", onPress: () => setKidHome({ id: kidId, display_name: name }, false) },
            ]
          ),
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  function leave() {
    Alert.alert(
      "Leave this Home?",
      "You'll get your own Home again, with a copy of your Letterbox addresses. Card history and anything else kept together stays with the people still here.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: async () => {
            const { error: rpcError } = await supabase.rpc("leave_home");
            if (rpcError) return Alert.alert("Couldn't leave", friendlyError(rpcError));
            tap();
            reload();
          },
        },
      ]
    );
  }

  return (
    <NookScroll onRefresh={reload}>
      <Stack.Screen options={{ title: "Your Home" }} />

      {data.incoming.map((item) => {
        const from = displayName(item.invited_by ? data.people.get(item.invited_by) : null);
        const who = data.inviterHomes.get(item.home_id);
        return (
          <Banner
            key={item.id}
            icon="hearth"
            tone="sky"
            title={`${from} wants to share a Home with you`}
            body={`${who?.length ? `With ${who.join(" & ")}. ` : ""}Everything you keep together — cards, addresses and more — in one place.`}
          >
            <View style={[ui.row, { gap: 10, marginTop: 6 }]}>
              <Button title="Share it" icon="check" style={{ flex: 1 }} disabled={busy} onPress={() => accept(item)} />
              <Button title="No thanks" variant="secondary" style={{ flex: 1 }} onPress={() => withdraw(item)} />
            </View>
          </Banner>
        );
      })}

      <NookHero
        icon="hearth"
        accent={colors.dark ? colors.bark : "#8a5a3b"}
        tint={colors.barkSoft}
        headline={alone ? "Just you, for now" : `You and ${others.map((m) => displayName(m.profiles).split(" ")[0]).join(" & ")}`}
        facts={[
          {
            icon: "group",
            text: headcount <= 1 ? "Invite the people you live with" : `${headcount} of ${MAX_HOME_MEMBERS} places taken`,
          },
          { icon: "sparkles", text: "Shared by every Nook that keeps things at home" },
        ]}
      />

      <SectionHeader title="Who lives here" icon="group" />
      {data.members.map((member, i) => (
        <Appear key={member.profile_id} index={i} style={[ui.card, ui.row, { gap: 12 }]}>
          <Avatar
            name={displayName(member.profiles)}
            icon={member.profiles?.avatar_icon}
            color={member.profiles?.avatar_color}
            size={40}
          />
          <Text style={[ui.cardTitle, { flex: 1 }]}>
            {displayName(member.profiles)}
            {member.profile_id === userId ? " (you)" : ""}
          </Text>
        </Appear>
      ))}
      {data.sent.map((item) => (
        <View key={item.id} style={[ui.card, ui.row, { gap: 12, opacity: 0.8 }]}>
          <Avatar name={displayName(data.people.get(item.invited))} size={40} />
          <View style={{ flex: 1 }}>
            <Text style={ui.cardTitle}>{displayName(data.people.get(item.invited))}</Text>
            <Text style={ui.muted}>Invited — waiting for them</Text>
          </View>
          <Tap onPress={() => withdraw(item)} hitSlop={8}>
            <Text style={ui.error}>Cancel</Text>
          </Tap>
        </View>
      ))}

      <SectionHeader title="Kids" icon="kid" />
      {data.kids.map((kid, i) => (
        <Appear key={kid.kid_id} index={i}>
          <Tap
            onPress={() => kidOptions(kid.kid_id, displayName(kid.profiles))}
            style={[ui.card, ui.row, { gap: 12 }]}
            accessibilityRole="button"
            accessibilityLabel={`${displayName(kid.profiles)}, options`}
          >
            <Avatar name={displayName(kid.profiles)} icon={kid.profiles?.avatar_icon} color={kid.profiles?.avatar_color} size={40} />
            <Text style={[ui.cardTitle, { flex: 1 }]}>{displayName(kid.profiles)}</Text>
            <Icon name="more" size={18} color={colors.muted} />
          </Tap>
        </Appear>
      ))}
      {notHome.map((kid) => (
        <View key={kid.id} style={[ui.card, ui.row, { gap: 12 }]}>
          <Avatar name={kid.display_name} icon={kid.avatar_icon} color={kid.avatar_color} size={40} />
          <View style={{ flex: 1 }}>
            <Text style={ui.cardTitle}>{kid.display_name ?? "Someone"}</Text>
            <Text style={ui.muted}>You look after them. Do they live here?</Text>
          </View>
          <Tap onPress={() => setKidHome(kid, true)} disabled={busy || full} hitSlop={8}>
            <Text style={[ui.link, { fontWeight: "700" }, full && { color: colors.muted }]}>Lives here</Text>
          </Tap>
        </View>
      ))}
      {elsewhere.map((kid) => (
        <View key={kid.id} style={[ui.row, { gap: 8 }]}>
          <Icon name="hearth" size={16} color={colors.muted} />
          <Text style={[ui.muted, { flex: 1 }]}>
            {`${(kid.display_name ?? "They").split(" ")[0]} lives in another Home. A kid is in one Home at a time; take them out there to add them here.`}
          </Text>
        </View>
      ))}
      {!data.kids.length && !notHome.length ? (
        <Text style={ui.muted}>
          Kids get their own profile and Wishbook, show up in your Home's Nooks, and count toward its {MAX_HOME_MEMBERS} places. When they get a
          phone, a hand-off code moves it all onto their own account.
        </Text>
      ) : null}
      {notHome.length ? (
        <Text style={ui.muted}>Only kids in your Home are in its Nooks and covered by its Nook Plus. Someone without a phone who lives elsewhere can stay out.</Text>
      ) : null}
      {!full ? (
        <Button title="Add a kid" icon="kid" variant="secondary" onPress={() => router.push("/gift-nook/managed-form?from=home")} />
      ) : null}

      {full ? (
        <View style={[ui.row, { gap: 8 }]}>
          <Icon name="hearth" size={16} color={colors.muted} />
          <Text style={[ui.muted, { flex: 1 }]}>
            {`A Home holds up to ${MAX_HOME_MEMBERS} people, kids included, and yours is full.`}
          </Text>
        </View>
      ) : invitable.length ? (
        <>
          <Text style={ui.label}>Invite someone you live with</Text>
          {invitable.map((person) => (
            <Tap
              key={person.id}
              onPress={() => invite(person.id, displayName(person))}
              disabled={busy}
              style={[ui.card, ui.row, { gap: 12 }]}
            >
              <Avatar name={displayName(person)} icon={person.avatar_icon} color={person.avatar_color} size={36} />
              <Text style={[ui.cardTitle, { flex: 1 }]}>{displayName(person)}</Text>
              <Text style={[ui.link, { fontWeight: "700" }]}>Invite</Text>
            </Tap>
          ))}
        </>
      ) : data.people.size === 0 ? (
        <View style={[ui.row, { gap: 8 }]}>
          <Icon name="burrow" size={16} color={colors.muted} />
          <Text style={[ui.muted, { flex: 1 }]}>
            Once the people you live with are in a Burrow with you, you can invite them here.
          </Text>
        </View>
      ) : null}

      {!alone ? <Button title="Leave this Home" icon="logout" variant="danger" onPress={leave} /> : null}
    </NookScroll>
  );
}
