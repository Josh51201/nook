import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

import { Avatar } from "../../components/avatar";
import { Icon } from "../../components/icon";
import { Appear, LoadingScreen, Tap } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { Text } from "../../components/text";
import { Button, EmptyState } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { friendlyError, tap } from "../../lib/feedback";
import { displayName } from "../../lib/gift-nook";
import { householdNameFor } from "../../lib/letterbox";
import { findNook } from "../../lib/nooks";
import { supabase } from "../../lib/supabase";
import { colors, ui } from "../../lib/theme";
import { useLetterbox } from "../../lib/use-letterbox";

const nook = findNook("letterbox")!;

type Mate = {
  id: string;
  display_name: string | null;
  avatar_icon: string | null;
  avatar_color: string | null;
  burrows: string[];
  hasAddress: boolean;
  // Same street, city and ZIP as someone else = they live together.
  home: string | null;
};

// Add family from your Burrows in one go (LET-004): each becomes a
// household linked to them, using their own address when they share it.
export default function AddFamily() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id;
  const { data } = useLetterbox();
  const [mates, setMates] = useState<Mate[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from("burrow_members")
      .select("burrows(name), profiles(id, display_name, avatar_icon, avatar_color, is_managed)")
      .then(async ({ data: rows }) => {
        const byId = new Map<string, Mate>();
        type Row = {
          burrows: { name: string } | null;
          profiles: { id: string; display_name: string | null; avatar_icon: string | null; avatar_color: string | null; is_managed: boolean } | null;
        };
        for (const row of (rows ?? []) as unknown as Row[]) {
          const p = row.profiles;
          if (!p || p.id === userId || p.is_managed) continue;
          const mate = byId.get(p.id) ?? { ...p, burrows: [], hasAddress: false, home: null };
          if (row.burrows?.name && !mate.burrows.includes(row.burrows.name)) mate.burrows.push(row.burrows.name);
          byId.set(p.id, mate);
        }
        const ids = [...byId.keys()];
        if (ids.length) {
          const { data: addresses } = await supabase
            .from("profile_addresses")
            .select("profile_id, line1, city, postal_code")
            .in("profile_id", ids);
          for (const a of addresses ?? []) {
            const mate = byId.get(a.profile_id)!;
            mate.hasAddress = true;
            mate.home = [a.line1, a.city, a.postal_code].map((part) => (part ?? "").trim().toLowerCase()).join("|");
          }
        }
        setMates([...byId.values()].sort((a, b) => displayName(a).localeCompare(displayName(b))));
      });
  }, [userId]);

  if (!mates || !data) return <LoadingScreen cards={4} />;

  // Already in your Letterbox (or sharing it with you): nothing to add.
  const inBox = new Set([
    ...data.households.flatMap((h) => h.letterbox_people.map((p) => p.profile_id)),
    ...data.members.map((m) => m.profile_id),
  ]);
  const available = mates.filter((m) => !inBox.has(m.id));

  function toggle(id: string) {
    tap();
    setPicked((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function add() {
    setSaving(true);
    try {
      // People who share an address become one household.
      const homes = new Map<string, Mate[]>();
      for (const mate of available.filter((m) => picked.has(m.id))) {
        const key = mate.home ?? mate.id;
        homes.set(key, [...(homes.get(key) ?? []), mate]);
      }
      for (const group of homes.values()) {
        const withAddress = group.find((m) => m.hasAddress);
        const { data: household, error } = await supabase
          .from("letterbox_households")
          .insert({
            letterbox_id: data!.boxId,
            name: householdNameFor(group.map(displayName)),
            address_from: withAddress?.id ?? null,
          })
          .select("id")
          .single();
        if (error) throw error;
        const { error: personError } = await supabase.from("letterbox_people").insert(
          group.map((mate, position) => ({
            household_id: household.id,
            letterbox_id: data!.boxId,
            name: displayName(mate),
            profile_id: mate.id,
            position,
          }))
        );
        if (personError) throw personError;
      }
      tap("success");
      router.back();
    } catch (error) {
      setSaving(false);
      Alert.alert("Couldn't add everyone", friendlyError(error as { message?: string }));
    }
  }

  return (
    <NookScroll>
      <Stack.Screen options={{ title: "Add family" }} />
      {available.length === 0 ? (
        <EmptyState
          icon="burrow"
          title={mates.length ? "Everyone's already here" : "No family on Nook yet"}
          body={mates.length ? "All your Burrow family is in your Letterbox." : "Start or join a Burrow and family will show up here."}
        />
      ) : (
        <>
          <Text style={ui.muted}>
            Pick who to add. Anyone sharing their address fills in on their own and stays up to date when they move.
            People who share the same address become one household.
          </Text>
          {available.map((mate, i) => {
            const on = picked.has(mate.id);
            return (
              <Appear key={mate.id} index={i}>
                <Tap
                  onPress={() => toggle(mate.id)}
                  style={[ui.card, styles.row, on && { borderColor: nook.iconColor, borderWidth: 2 }]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                >
                  <Avatar name={displayName(mate)} icon={mate.avatar_icon} color={mate.avatar_color} size={42} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={ui.cardTitle}>{displayName(mate)}</Text>
                    <Text style={[ui.muted, { fontSize: 13 }]} numberOfLines={1}>
                      {mate.hasAddress ? "Address shared" : "No address shared yet"} · {mate.burrows.join(", ")}
                    </Text>
                  </View>
                  <View style={[styles.check, { borderColor: nook.iconColor }, on && { backgroundColor: nook.iconColor }]}>
                    {on ? <Icon name="check" size={15} color="#ffffff" /> : null}
                  </View>
                </Tap>
              </Appear>
            );
          })}
          <Button
            title={picked.size ? `Add ${picked.size}` : "Pick who to add"}
            icon="add"
            disabled={!picked.size}
            loading={saving}
            onPress={add}
          />
        </>
      )}
      <Text style={[ui.muted, { textAlign: "center", fontSize: 13, color: colors.muted }]}>
        Only addresses they've chosen to share with your Burrows come through.
      </Text>
    </NookScroll>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  check: { width: 26, height: 26, borderRadius: 9, borderWidth: 2, alignItems: "center", justifyContent: "center" },
});
