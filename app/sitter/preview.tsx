import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Linking, View } from "react-native";

import { LoadingScreen } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { Text } from "../../components/text";
import { Button, EmptyState, SectionHeader } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { formatTimeOfDay } from "../../lib/pets";
import { clockTime, formatTemp, isFever } from "../../lib/sickday";
import { routineNow, stayWords } from "../../lib/sitter";
import { previewLink, useSitter, type SitterView } from "../../lib/sitter-data";
import { colors, ui } from "../../lib/theme";

// What the sitter sees (SIT-007), straight from the same database call
// their page makes, so what's here is exactly what goes out.
export default function SitterPreview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const { data } = useSitter(session?.user.id);
  const link = data?.links.find((l) => l.id === id);
  const [view, setView] = useState<SitterView | null | undefined>(undefined);

  useEffect(() => {
    if (!link) return;
    previewLink(link.token).then(({ view: v }) => setView(v));
  }, [link]);

  if (!data || (link && view === undefined)) return <LoadingScreen cards={3} />;
  if (!link || !view) {
    return (
      <NookScroll>
        <EmptyState icon="lock" title="This link doesn't open any more" body="It's ended or been switched off, so the sitter sees nothing." />
      </NookScroll>
    );
  }

  const phone = (name: string, number: string, note?: string | null) => (
    <View key={`${name}-${number}`} style={[ui.card, { gap: 8 }]}>
      <Text style={ui.cardTitle}>{name}</Text>
      <Text style={ui.muted}>{[number, note].filter(Boolean).join(" · ")}</Text>
      <View style={[ui.row, { gap: 8 }]}>
        <Button title="Call" icon="phone" variant="secondary" onPress={() => Linking.openURL(`tel:${number.replace(/[^\d+]/g, "")}`)} style={{ flex: 1 }} />
        <Button title="Text" icon="mail" variant="secondary" onPress={() => Linking.openURL(`sms:${number.replace(/[^\d+]/g, "")}`)} style={{ flex: 1 }} />
      </View>
    </View>
  );

  const block = (title: string, body: string | null | undefined, icon: "moon" | "food" | "shield" | "doc" | "place" | "search" | "key") =>
    body ? (
      <View key={title} style={{ gap: 8 }}>
        <SectionHeader title={title} icon={icon} />
        <View style={ui.card}>
          <Text>{body}</Text>
        </View>
      </View>
    ) : null;

  return (
    <NookScroll>
      <View style={{ gap: 4 }}>
        <Text style={[ui.cardTitle, { fontSize: 24 }]}>{view.label}</Text>
        <Text style={ui.muted}>{stayWords(view)}</Text>
      </View>

      {view.contacts?.length ? (
        <>
          <SectionHeader title="Emergency numbers" icon="phone" />
          {view.contacts.map((c) => phone(c.name, c.phone, c.note))}
        </>
      ) : null}
      {block("Address", view.address, "place")}
      {view.doctor_name || view.doctor_phone ? (
        <>
          <SectionHeader title="Doctor" icon="heart" />
          {view.doctor_phone ? phone(view.doctor_name || "Doctor", view.doctor_phone) : <View style={ui.card}><Text>{view.doctor_name}</Text></View>}
        </>
      ) : null}

      {view.kids.length ? (
        <>
          <SectionHeader title="Kids" icon="kid" />
          {view.kids.map((k, i) => (
            <View key={`${k.name}-${i}`} style={[ui.card, { gap: 4 }]}>
              <Text style={ui.cardTitle}>{k.name}</Text>
              <Text style={k.allergies.length ? { color: colors.error, fontWeight: "600" } : ui.muted}>
                {k.allergies.length ? `Allergic to ${k.allergies.join(", ")}` : "No allergies listed"}
              </Text>
              {k.diets.length ? <Text style={ui.muted}>{k.diets.join(", ")}</Text> : null}
            </View>
          ))}
        </>
      ) : null}

      {view.sick?.length ? (
        <>
          <SectionHeader title="Sick today" icon="sick" />
          {view.sick.map((k, i) => (
            <View key={`${k.name}-sick-${i}`} style={[ui.card, { gap: 4 }]}>
              <Text style={ui.cardTitle}>
                {k.name}
                {k.what ? ` · ${k.what}` : ""}
              </Text>
              {k.temp ? (
                <Text style={isFever(k.temp.temp_c) ? { color: colors.error, fontWeight: "600" } : ui.muted}>
                  Last temperature {formatTemp(Number(k.temp.temp_c), "f")} ({formatTemp(Number(k.temp.temp_c), "c")}) at{" "}
                  {clockTime(new Date(k.temp.at).getTime())}
                </Text>
              ) : null}
              {k.medicines.map((m) => (
                <Text key={m.name}>
                  {m.name}
                  {m.amount ? ` ${m.amount}` : ""}: last at {clockTime(new Date(m.last_given).getTime())}
                  {m.next_ok ? `, next OK at ${clockTime(new Date(m.next_ok).getTime())}` : m.every_hours ? ", OK now" : ""}
                </Text>
              ))}
              {!k.medicines.length ? <Text style={ui.muted}>No medicine given yet</Text> : null}
            </View>
          ))}
        </>
      ) : null}

      {view.routine?.length ? (
        <>
          <SectionHeader title="Daily routine" icon="clock" />
          <View style={[ui.card, { gap: 8 }]}>
            {(() => {
              const now = new Date();
              const { steps, now: current, next } = routineNow(view.routine!, `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`);
              return steps.map((step, i) => (
                <View key={i} style={[ui.row, { gap: 10 }]}>
                  <Text style={[ui.muted, { width: 72 }]}>{formatTimeOfDay(step.time)}</Text>
                  <Text style={[{ flex: 1 }, i === current && { fontWeight: "800", color: colors.bark }]}>{step.what}</Text>
                  {i === current ? <Text style={{ color: colors.bark, fontWeight: "700", fontSize: 13 }}>Now</Text> : i === next ? <Text style={[ui.muted, { fontSize: 13 }]}>Next</Text> : null}
                </View>
              ));
            })()}
          </View>
        </>
      ) : null}
      {block("Bedtime", view.bedtime, "moon")}
      {block("Food", view.food, "food")}
      {block("House rules", view.rules, "shield")}

      {view.pets.length ? (
        <>
          <SectionHeader title="Pets" icon="paw" />
          {view.pets.map((p, i) => (
            <View key={`${p.name}-${i}`} style={[ui.card, { gap: 4 }]}>
              <Text style={ui.cardTitle}>{p.name}</Text>
              {p.food ? <Text>Food: {p.food}</Text> : null}
              {p.meals.length ? <Text>Meals: {p.meals.map((m) => (m.time ? `${m.label} (${formatTimeOfDay(m.time)})` : m.label)).join(", ")}</Text> : null}
              {p.medications.length ? <Text>Medications: {p.medications.map((m) => (m.notes ? `${m.title} — ${m.notes}` : m.title)).join("; ")}</Text> : null}
              {p.notes ? <Text style={ui.muted}>{p.notes}</Text> : null}
              {p.vet_phone ? phone(p.vet_name || "Vet", p.vet_phone) : null}
            </View>
          ))}
        </>
      ) : null}

      {view.wifi_name || view.wifi_password ? (
        <>
          <SectionHeader title="Wi-Fi" icon="globe" />
          <View style={[ui.card, { gap: 4 }]}>
            {view.wifi_name ? <Text>Network: {view.wifi_name}</Text> : null}
            {view.wifi_password ? <Text>Password: {view.wifi_password}</Text> : null}
            <Text style={ui.muted}>The sitter gets a button to copy the password.</Text>
          </View>
        </>
      ) : null}
      {block("Where things are", view.places, "search")}
      {block("Door & alarm codes", view.codes, "key")}
      {block("Anything else", view.notes, "doc")}

      <Text style={[ui.muted, { textAlign: "center", marginTop: 8 }]}>Opening it here doesn't count as the sitter opening it.</Text>
    </NookScroll>
  );
}
