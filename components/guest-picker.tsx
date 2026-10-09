import { useState } from "react";
import { View } from "react-native";

import { tap } from "../lib/feedback";
import { displayName } from "../lib/gift-nook";
import type { PickerBurrow } from "../lib/gatherings-data";
import { colors, ui } from "../lib/theme";
import { Avatar } from "./avatar";
import { Icon } from "./icon";
import { Tap } from "./motion";
import { Text } from "./text";
import { Chip } from "./ui";

// Who's invited to a Gathering (GATH-003): whole Burrows (everyone in them,
// even people who join later), and/or people picked one by one. The people
// list is filtered by Burrow so a big family stays easy to scan, and someone
// already coming with a picked Burrow shows as included.
export function GuestPicker({
  burrows,
  burrowIds,
  personIds,
  meId,
  onChange,
}: {
  burrows: PickerBurrow[];
  burrowIds: Set<string>;
  personIds: Set<string>;
  meId: string;
  onChange: (burrowIds: Set<string>, personIds: Set<string>) => void;
}) {
  const [filter, setFilter] = useState<string | null>(burrows.length > 1 ? burrows[0].id : null);

  if (!burrows.length) {
    return <Text style={ui.muted}>You're not in a Burrow yet — start or join one in the Burrows tab, then invite them here.</Text>;
  }

  // Who comes with a picked Burrow, and which one (for the "with …" label).
  const viaBurrow = new Map<string, string>();
  for (const burrow of burrows) {
    if (!burrowIds.has(burrow.id)) continue;
    for (const member of burrow.members) if (!viaBurrow.has(member.id)) viaBurrow.set(member.id, burrow.name);
  }

  // Everyone you could pick, once each, in the chosen Burrow (or all).
  const seen = new Set<string>();
  const people = (filter ? burrows.filter((b) => b.id === filter) : burrows)
    .flatMap((b) => b.members)
    .filter((p) => p.id !== meId && !seen.has(p.id) && Boolean(seen.add(p.id)))
    .sort((a, b) => displayName(a).localeCompare(displayName(b)));

  const invited = new Set<string>([meId, ...viaBurrow.keys(), ...personIds]);

  function toggleBurrow(id: string) {
    tap();
    const next = new Set(burrowIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next, personIds);
  }

  function togglePerson(id: string) {
    tap();
    const next = new Set(personIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(burrowIds, next);
  }

  return (
    <View style={{ gap: 12 }}>
      <Text style={ui.label}>Whole Burrows</Text>
      <View style={ui.chips}>
        {burrows.map((burrow) => (
          <Chip key={burrow.id} icon={burrowIds.has(burrow.id) ? "check" : "burrow"} selected={burrowIds.has(burrow.id)} onPress={() => toggleBurrow(burrow.id)}>
            {burrow.name}
          </Chip>
        ))}
      </View>
      <Text style={ui.muted}>Everyone in a Burrow you pick is invited, including anyone who joins it later.</Text>

      <Text style={[ui.label, { marginTop: 4 }]}>Or pick people</Text>
      {burrows.length > 1 ? (
        <View style={ui.chips}>
          {burrows.map((burrow) => (
            <Chip
              key={burrow.id}
              selected={filter === burrow.id}
              onPress={() => {
                tap();
                setFilter(burrow.id);
              }}
            >
              {burrow.name}
            </Chip>
          ))}
          <Chip
            selected={!filter}
            onPress={() => {
              tap();
              setFilter(null);
            }}
          >
            Everyone
          </Chip>
        </View>
      ) : null}
      <View style={[ui.card, { gap: 0, paddingVertical: 4 }]}>
        {people.length ? (
          people.map((person, i) => {
            const withBurrow = viaBurrow.get(person.id);
            const picked = Boolean(withBurrow) || personIds.has(person.id);
            return (
              <Tap
                key={person.id}
                onPress={() => (withBurrow ? undefined : togglePerson(person.id))}
                disabled={Boolean(withBurrow)}
                pressedScale={0.98}
                style={[
                  ui.row,
                  {
                    gap: 12,
                    paddingVertical: 9,
                    borderTopWidth: i ? 1 : 0,
                    borderTopColor: colors.border,
                  },
                ]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: picked, disabled: Boolean(withBurrow) }}
                accessibilityLabel={displayName(person)}
              >
                <Avatar name={person.display_name} icon={person.avatar_icon} color={person.avatar_color} photo={person.avatar_path} size={34} />
                <View style={{ flex: 1 }}>
                  <Text style={ui.cardTitle}>{displayName(person)}</Text>
                  {withBurrow ? <Text style={[ui.muted, { fontSize: 13 }]}>Coming with {withBurrow}</Text> : null}
                </View>
                <View
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 8,
                    borderWidth: picked ? 0 : 2,
                    borderColor: colors.border,
                    backgroundColor: picked ? (withBurrow ? colors.barkSoft : colors.bark) : "transparent",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {picked ? <Icon name="check" size={15} color={withBurrow ? colors.bark : colors.onAccent} /> : null}
                </View>
              </Tap>
            );
          })
        ) : (
          <Text style={[ui.muted, { paddingVertical: 10 }]}>Nobody else in this Burrow yet.</Text>
        )}
      </View>
      <View style={[ui.row, { gap: 6 }]}>
        <Icon name="group" size={15} color={colors.muted} />
        <Text style={ui.muted}>
          {invited.size === 1 ? "Just you so far" : `${invited.size} people invited, counting you`}
        </Text>
      </View>
    </View>
  );
}
