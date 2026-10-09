import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, View } from "react-native";

import { Avatar } from "../../components/avatar";
import { PeopleChips } from "../../components/getaway-bits";
import { LoadingScreen, Tap } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { Text } from "../../components/text";
import { Button, EmptyState, SectionHeader } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { friendlyError, tap } from "../../lib/feedback";
import { displayName } from "../../lib/gift-nook";
import { addTravelers, removeTraveler, useCompanions, useGetaway } from "../../lib/getaways-data";
import { colors, ui } from "../../lib/theme";

// Who's going (TRIP-002): everyone going sees the whole Getaway. Anyone going
// can bring family from their Burrows and people they live with. You can
// take yourself off; whoever started it can take anyone off; a kid's
// managers can take the kid off.
export default function GetawayPeople() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;
  const { data, isLoading, reload } = useGetaway(id, userId);
  const companions = useCompanions(userId);
  const [adding, setAdding] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  if (isLoading && !data) return <LoadingScreen cards={2} />;
  if (!data) return <EmptyState icon="plane" title="That Getaway isn't here" body="It may have been removed." />;

  const going = new Set(data.people.map((p) => p.id));
  const starter = data.trip.created_by === userId;
  const canAdd = (companions ?? []).filter((c) => !going.has(c.id));
  const myKids = new Set((companions ?? []).filter((c) => c.where === "kid").map((c) => c.id));

  function confirmRemove(personId: string, name: string) {
    const self = personId === userId;
    Alert.alert(
      self ? `Leave ${data!.trip.title}?` : `Take ${name} off?`,
      self
        ? "You won't see it any more. Your packing list goes with you; costs stay so the sums still add up."
        : `${name} won't see it any more. Their packing list goes; costs stay so the sums still add up.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: self ? "Leave" : "Take off",
          style: "destructive",
          onPress: async () => {
            const { error } = await removeTraveler(data!.trip.id, personId);
            if (error) return Alert.alert("Couldn't do that", friendlyError(error));
            tap();
            if (self) router.dismissTo("/getaways");
            else reload();
          },
        },
      ]
    );
  }

  async function add() {
    setBusy(true);
    const { error } = await addTravelers(data!.trip.id, adding);
    setBusy(false);
    if (error) return Alert.alert("Couldn't add them", friendlyError(error));
    tap("success");
    setAdding([]);
    reload();
  }

  return (
    <NookScroll onRefresh={reload}>
      <SectionHeader title={`Going · ${data.people.length}`} icon="group" />
      <View style={[ui.card, { gap: 12 }]}>
        {data.people.map((p) => {
          const name = p.id === userId ? "You" : displayName(p);
          const removable = p.id === userId || starter || myKids.has(p.id);
          return (
            <View key={p.id} style={[ui.row, { gap: 12 }]}>
              <Avatar name={displayName(p)} icon={p.avatar_icon} color={p.avatar_color} photo={p.avatar_path} size={36} />
              <View style={{ flex: 1 }}>
                <Text style={ui.cardTitle}>{name}</Text>
                {p.id === data.trip.created_by ? <Text style={[ui.muted, { fontSize: 13 }]}>Started this Getaway</Text> : null}
              </View>
              {removable ? (
                <Tap onPress={() => confirmRemove(p.id, name)} hitSlop={8}>
                  <Text style={ui.error}>{p.id === userId ? "Leave" : "Take off"}</Text>
                </Tap>
              ) : null}
            </View>
          );
        })}
      </View>

      <SectionHeader title="Bring someone" icon="invite" />
      {companions === null ? (
        <Text style={ui.muted}>Loading your family…</Text>
      ) : canAdd.length ? (
        <>
          <PeopleChips
            people={canAdd}
            selected={adding}
            onToggle={(pid) => setAdding((list) => (list.includes(pid) ? list.filter((x) => x !== pid) : [...list, pid]))}
          />
          <Text style={ui.muted}>They'll get a notice in their inbox and see everything about this Getaway.</Text>
          {adding.length ? <Button title={`Add ${adding.length}`} icon="add" onPress={add} loading={busy} /> : null}
        </>
      ) : (
        <Text style={ui.muted}>Everyone from your Home and Burrows is already going.</Text>
      )}
      <Text style={[ui.muted, { color: colors.muted, fontSize: 13 }]}>
        Only family in your Burrows and people you live with can be added. Kids come along for their packing lists.
      </Text>
    </NookScroll>
  );
}
