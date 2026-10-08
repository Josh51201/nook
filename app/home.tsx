import { Stack } from "expo-router";
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
import { useHome, type HomeInvite } from "../lib/home";
import { supabase } from "../lib/supabase";
import { colors, ui } from "../lib/theme";

// Your Home (HOME-001..005): the people you live with. Invite someone from
// your Burrows and, once they accept, every Nook that keeps things for a
// household — the Letterbox's card list, and more to come — is shared
// between you. Each person is in one Home at a time.
export default function HomePage() {
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
          { icon: "group", text: alone ? "Invite the people you live with" : `${data.members.length} people share this Home` },
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

      {invitable.length ? (
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
