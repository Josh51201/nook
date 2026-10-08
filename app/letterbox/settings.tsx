import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Switch, View } from "react-native";

import { Avatar } from "../../components/avatar";
import { IconBadge } from "../../components/icon";
import { Appear, LoadingScreen, Tap } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { Text } from "../../components/text";
import { Banner, Button, SectionHeader } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { friendlyError, tap } from "../../lib/feedback";
import { displayName } from "../../lib/gift-nook";
import { letterboxSettingDefaults, useNookSettings } from "../../lib/nook-settings";
import { supabase } from "../../lib/supabase";
import { colors, ui } from "../../lib/theme";
import { useLetterbox } from "../../lib/use-letterbox";

type Person = { id: string; display_name: string | null; avatar_icon: string | null; avatar_color: string | null };
type Invite = { id: string; letterbox_id: string; invited: string; invited_by: string | null };

// Letterbox settings (CORE-012): who shares your Letterbox (LET-002) —
// invite family from your Burrows, answer invites, or leave — and
// birthday-card reminders (LET-010).
export default function LetterboxSettings() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id;
  const { data, reload } = useLetterbox();
  const { settings, update, isLoading: settingsLoading } = useNookSettings("letterbox", letterboxSettingDefaults);
  const [mates, setMates] = useState<Person[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [people, setPeople] = useState<Map<string, Person>>(new Map());
  const [boxMembers, setBoxMembers] = useState<Map<string, string[]>>(new Map());
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    const [matesResult, invitesResult] = await Promise.all([
      supabase.from("burrow_members").select("profiles(id, display_name, avatar_icon, avatar_color, is_managed)"),
      supabase.from("letterbox_invites").select("id, letterbox_id, invited, invited_by"),
    ]);
    const byId = new Map<string, Person>();
    for (const row of (matesResult.data ?? []) as unknown as { profiles: (Person & { is_managed: boolean }) | null }[]) {
      if (row.profiles && row.profiles.id !== userId && !row.profiles.is_managed) byId.set(row.profiles.id, row.profiles);
    }
    setMates([...byId.values()].sort((a, b) => displayName(a).localeCompare(displayName(b))));
    const list = (invitesResult.data ?? []) as Invite[];
    setInvites(list);
    // Who's already in the Letterboxes you're invited to.
    const incoming = list.filter((i) => i.invited === userId);
    if (incoming.length) {
      const { data: members } = await supabase
        .from("letterbox_members")
        .select("letterbox_id, profiles(id, display_name, avatar_icon, avatar_color)")
        .in("letterbox_id", incoming.map((i) => i.letterbox_id));
      const groups = new Map<string, string[]>();
      for (const m of (members ?? []) as unknown as { letterbox_id: string; profiles: Person | null }[]) {
        if (!m.profiles) continue;
        byId.set(m.profiles.id, m.profiles);
        groups.set(m.letterbox_id, [...(groups.get(m.letterbox_id) ?? []), displayName(m.profiles)]);
      }
      setBoxMembers(groups);
    }
    setPeople(new Map(byId));
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!data || settingsLoading) return <LoadingScreen cards={3} />;

  const memberIds = new Set(data.members.map((m) => m.profile_id));
  const incoming = invites.filter((i) => i.invited === userId);
  const outgoing = invites.filter((i) => i.letterbox_id === data.boxId);
  const invitable = mates.filter((m) => !memberIds.has(m.id) && !outgoing.some((i) => i.invited === m.id));
  const alone = data.members.length <= 1;

  async function invite(person: Person) {
    setBusy(true);
    const { error } = await supabase.rpc("invite_to_letterbox", { target: person.id });
    setBusy(false);
    if (error) return Alert.alert("Couldn't invite them", friendlyError(error));
    tap("success");
    Alert.alert(`Invite sent to ${displayName(person)}`, "It'll show up in their inbox.");
    load();
  }

  async function withdraw(item: Invite) {
    const { error } = await supabase.from("letterbox_invites").delete().eq("id", item.id);
    if (error) return Alert.alert("Couldn't do that", friendlyError(error));
    load();
  }

  function accept(item: Invite) {
    const from = displayName(item.invited_by ? people.get(item.invited_by) : null);
    Alert.alert(
      `Share ${from}'s Letterbox?`,
      alone
        ? "Everything in your Letterbox comes along, so it's one list for both of you."
        : "You'll leave the Letterbox you share now. Its list stays with the people still in it.",
      [
        { text: "Not now", style: "cancel" },
        {
          text: "Share it",
          onPress: async () => {
            setBusy(true);
            const { error } = await supabase.rpc("accept_letterbox_invite", { invite_id: item.id });
            setBusy(false);
            if (error) return Alert.alert("Couldn't join", friendlyError(error));
            tap("success");
            await Promise.all([reload(), load()]);
          },
        },
      ]
    );
  }

  function leave() {
    Alert.alert("Leave this Letterbox?", "You'll get your own again with a copy of the addresses. The card history stays with them.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Leave",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.rpc("leave_letterbox");
          if (error) return Alert.alert("Couldn't leave", friendlyError(error));
          tap();
          await Promise.all([reload(), load()]);
        },
      },
    ]);
  }

  async function change(changes: Partial<typeof letterboxSettingDefaults>) {
    tap();
    try {
      await update(changes);
    } catch (error) {
      Alert.alert("Couldn't save that setting", (error as Error).message);
    }
  }

  return (
    <NookScroll onRefresh={() => Promise.all([reload(), load()])}>
      {incoming.map((item) => {
        const from = displayName(item.invited_by ? people.get(item.invited_by) : null);
        const who = boxMembers.get(item.letterbox_id);
        return (
          <Banner
            key={item.id}
            icon="mail"
            tone="sky"
            title={`${from} wants to share a Letterbox`}
            body={`${who?.length ? `With ${who.join(" & ")}. ` : ""}One card and address list for your household.`}
          >
            <View style={[ui.row, { gap: 10, marginTop: 6 }]}>
              <Button title="Share it" icon="check" style={{ flex: 1 }} disabled={busy} onPress={() => accept(item)} />
              <Button title="No thanks" variant="secondary" style={{ flex: 1 }} onPress={() => withdraw(item)} />
            </View>
          </Banner>
        );
      })}

      <SectionHeader title="Your household" icon="group" />
      <Text style={ui.muted}>Everyone here shares one Letterbox: the same addresses, cards and thank-yous.</Text>
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
      {outgoing.map((item) => (
        <View key={item.id} style={[ui.card, ui.row, { gap: 12, opacity: 0.8 }]}>
          <Avatar name={displayName(people.get(item.invited))} size={40} />
          <View style={{ flex: 1 }}>
            <Text style={ui.cardTitle}>{displayName(people.get(item.invited))}</Text>
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
            <Tap key={person.id} onPress={() => invite(person)} disabled={busy} style={[ui.card, ui.row, { gap: 12 }]}>
              <Avatar name={displayName(person)} icon={person.avatar_icon} color={person.avatar_color} size={36} />
              <Text style={[ui.cardTitle, { flex: 1 }]}>{displayName(person)}</Text>
              <Text style={[ui.link, { fontWeight: "700" }]}>Invite</Text>
            </Tap>
          ))}
        </>
      ) : mates.length === 0 ? (
        <Text style={ui.muted}>Once your family is in a Burrow with you, you can invite them here.</Text>
      ) : null}

      <SectionHeader title="Notifications" icon="bell" />
      <View style={[ui.card, ui.row, { gap: 12 }]}>
        <IconBadge name="birthday" size={38} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={ui.cardTitle}>Birthday card reminders</Text>
          <Text style={ui.muted}>A week before a birthday in your Letterbox, so the card arrives on time.</Text>
        </View>
        <Switch
          value={settings.notifyBirthdays}
          onValueChange={(notifyBirthdays) => change({ notifyBirthdays })}
          trackColor={{ true: colors.bark }}
        />
      </View>

      <SectionHeader title="Your address" icon="place" />
      <Button title="Edit my mailing address" icon="place" variant="secondary" onPress={() => router.push("/profile")} />

      {!alone ? <Button title="Leave this Letterbox" icon="logout" variant="danger" onPress={leave} /> : null}
    </NookScroll>
  );
}
