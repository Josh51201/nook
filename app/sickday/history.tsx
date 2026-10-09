import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { Appear, LoadingScreen } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { Text } from "../../components/text";
import { Chip, EmptyState, NavCard, SectionHeader } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { findNook } from "../../lib/nooks";
import { historyByPerson, missedWord, spellDates, spellLength, spellTitle } from "../../lib/sickday";
import { firstName, isHomeSpell, useSickDay } from "../../lib/sickday-data";
import { colors, ui } from "../../lib/theme";

const nook = findNook("sickday")!;

// Illness history (SICK-011): everyone's past sick days, newest first, so
// "when did she last have strep?" has an answer. Kept until deleted.
export default function History() {
  const router = useRouter();
  const { session } = useAuth();
  const { data, reload } = useSickDay(session?.user.id);
  const [person, setPerson] = useState<string | null>(null);

  if (!data) return <LoadingScreen cards={3} />;
  const past = data.spells.filter((s) => s.ended_on && isHomeSpell(data, s));
  const byPerson = historyByPerson(past, data.today);
  const people = [...byPerson.keys()];
  const shown = person ? people.filter((p) => p === person) : people;

  return (
    <NookScroll onRefresh={reload}>
      {!past.length ? (
        <EmptyState icon="calendar" title="Nothing here yet" body="Once someone's feeling better, their sick days are kept here: what it was, how long it lasted and what they missed." />
      ) : null}

      {people.length > 1 ? (
        <View style={ui.chips}>
          <Chip selected={!person} onPress={() => setPerson(null)}>
            Everyone
          </Chip>
          {people.map((p) => (
            <Chip key={p} selected={person === p} onPress={() => setPerson(p)}>
              {firstName(data, p)}
            </Chip>
          ))}
        </View>
      ) : null}

      {shown.map((pid) => {
        const entry = byPerson.get(pid)!;
        const lastYear = [
          `${entry.timesThisYear} time${entry.timesThisYear === 1 ? "" : "s"} in the last year`,
          entry.missedThisYear ? `${entry.missedThisYear} day${entry.missedThisYear === 1 ? "" : "s"} missed` : null,
        ]
          .filter(Boolean)
          .join(" · ");
        return (
          <View key={pid} style={{ gap: 10 }}>
            <SectionHeader title={firstName(data, pid)} icon="person" right={<Text style={[ui.muted, { fontSize: 13 }]}>{lastYear}</Text>} />
            {entry.spells.map((s, i) => (
              <Appear key={s.id} index={i}>
                <NavCard
                  icon="sick"
                  iconColor={nook.iconColor}
                  iconBackground={colors.dark ? `${nook.iconColor}33` : nook.color}
                  title={spellTitle(s)}
                  subtitle={[spellDates(s, data.today), spellLength(s, data.today), s.missed_days.length ? `missed ${s.missed_days.length} of ${missedWord(s.missed_from)}` : null]
                    .filter(Boolean)
                    .join(" · ")}
                  onPress={() => router.push(`/sickday/${s.id}`)}
                />
              </Appear>
            ))}
          </View>
        );
      })}
    </NookScroll>
  );
}
