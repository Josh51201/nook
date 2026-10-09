import { View } from "react-native";

import { rsvpChoices } from "../lib/gatherings";
import type { Rsvp, RsvpStatus } from "../lib/potluck";
import { colors, ui } from "../lib/theme";
import { Icon } from "./icon";
import { Tap } from "./motion";
import { Text } from "./text";
import { Chip } from "./ui";

// "Are you coming?" (GATH-006, POT-006): your answer, how many extra guests
// you're bringing, and an answer for each kid you look after who's invited.
// The Gathering and its Potluck share these answers.
export function RsvpCard({
  userId,
  myKids,
  rsvps,
  nameOf,
  onPick,
}: {
  userId: string;
  myKids: string[];
  rsvps: Rsvp[];
  nameOf: (profileId: string) => string;
  onPick: (profileId: string, status: RsvpStatus, extraGuests: number) => void;
}) {
  const mine = rsvps.find((r) => r.profile_id === userId);
  return (
    <View style={[ui.card, { gap: 12 }]}>
      <RsvpRow name="You" status={mine?.status} onPick={(status) => onPick(userId, status, mine?.extra_guests ?? 0)} />
      {mine && mine.status !== "no" ? (
        <View style={[ui.row, { justifyContent: "space-between" }]}>
          <Text style={ui.muted}>Bringing extra guests</Text>
          <View style={[ui.row, { gap: 14 }]}>
            <Stepper
              icon="minus"
              label="One fewer guest"
              disabled={mine.extra_guests <= 0}
              onPress={() => onPick(userId, mine.status, mine.extra_guests - 1)}
            />
            <Text style={[ui.cardTitle, { minWidth: 20, textAlign: "center" }]}>{mine.extra_guests}</Text>
            <Stepper
              icon="add"
              label="One more guest"
              disabled={mine.extra_guests >= 20}
              onPress={() => onPick(userId, mine.status, mine.extra_guests + 1)}
            />
          </View>
        </View>
      ) : null}
      {myKids.map((kidId) => {
        const theirs = rsvps.find((r) => r.profile_id === kidId);
        return (
          <RsvpRow
            key={kidId}
            name={nameOf(kidId)}
            status={theirs?.status}
            onPick={(status) => onPick(kidId, status, theirs?.extra_guests ?? 0)}
          />
        );
      })}
    </View>
  );
}

function RsvpRow({ name, status, onPick }: { name: string; status: RsvpStatus | undefined; onPick: (status: RsvpStatus) => void }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={ui.cardTitle}>{name}</Text>
      <View style={ui.chips}>
        {rsvpChoices.map((option) => (
          <Chip key={option.key} selected={status === option.key} onPress={() => onPick(option.key)}>
            {option.label}
          </Chip>
        ))}
      </View>
    </View>
  );
}

function Stepper({ icon, label, disabled, onPress }: { icon: "add" | "minus"; label: string; disabled: boolean; onPress: () => void }) {
  return (
    <Tap
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      pressedScale={0.85}
      style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.barkSoft, alignItems: "center", justifyContent: "center" }}
      accessibilityLabel={label}
    >
      <Icon name={icon} size={16} />
    </Tap>
  );
}
