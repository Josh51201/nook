import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Modal, Pressable, StyleSheet, Switch, View } from "react-native";

import { Avatar } from "../../../components/avatar";
import { Icon, IconBadge } from "../../../components/icon";
import { Appear, LoadingScreen, Tap } from "../../../components/motion";
import { NookScroll } from "../../../components/nook-scroll";
import { Text } from "../../../components/text";
import { Button, EmptyState, SectionHeader } from "../../../components/ui";
import { friendlyError, tap } from "../../../lib/feedback";
import { addressLines, nextBirthday, occasionInfo } from "../../../lib/letterbox";
import {
  addressUnavailable,
  contactAddress,
  personBirthday,
  personName,
  photoUrls,
  type Card,
} from "../../../lib/letterbox-data";
import { findNook } from "../../../lib/nooks";
import { formatBirthday } from "../../../lib/profile";
import { supabase } from "../../../lib/supabase";
import { colors, shadow, ui } from "../../../lib/theme";
import { useLetterbox } from "../../../lib/use-letterbox";

const nook = findNook("letterbox")!;

// One contact (LET-003): where to mail them, who lives there and their
// birthdays, whether they're on the holiday list, and every card back and
// forth, year by year (LET-005/006), with photos of the ones you got (LET-007).
export default function ContactPage() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading, reload } = useLetterbox();
  const [photos, setPhotos] = useState<Map<string, string>>(new Map());
  const [viewing, setViewing] = useState<string | null>(null);
  const [onList, setOnList] = useState<boolean | null>(null);

  const contact = data?.contacts.find((h) => h.id === id);
  const cards = data?.cards.filter((c) => c.contact_id === id) ?? [];
  const photoKey = cards.map((c) => c.photo_path).filter(Boolean).join(",");

  useEffect(() => {
    const paths = cards.map((c) => c.photo_path).filter(Boolean) as string[];
    if (paths.length) photoUrls(paths).then(setPhotos);
  }, [photoKey]);

  if (isLoading && !data) return <LoadingScreen cards={3} />;
  if (!data || !contact) {
    return <EmptyState icon="mail" title="That contact is gone" body="It may have been removed from your Letterbox." />;
  }

  const address = contactAddress(contact, data);
  const lines = addressLines(address);
  const fromProfile = contact.address_from && address !== contact ? data.profiles.get(contact.address_from) : null;
  const listed = onList ?? contact.on_holiday_list;

  async function toggleList(next: boolean) {
    tap();
    setOnList(next);
    const { error } = await supabase.from("letterbox_contacts").update({ on_holiday_list: next }).eq("id", id);
    if (error) {
      setOnList(!next);
      Alert.alert("Couldn't change that", friendlyError(error));
    }
  }

  async function copyAddress() {
    await Clipboard.setStringAsync([contact!.name, ...lines].join("\n"));
    tap("success");
    Alert.alert("Address copied");
  }

  // Year by year, newest first.
  const years = [...new Set(cards.map((c) => c.season))].sort((a, b) => b - a);

  function cardRow(card: Card) {
    const occasion = occasionInfo(card.occasion);
    const sent = card.direction === "sent";
    const url = card.photo_path ? photos.get(card.photo_path) : undefined;
    return (
      <Tap
        key={card.id}
        onPress={() => router.push({ pathname: "/letterbox/card-form", params: { cardId: card.id } })}
        style={[ui.card, styles.cardRow]}
      >
        <IconBadge
          name={sent ? "arrowUp" : "arrowDown"}
          size={36}
          color={sent ? nook.iconColor : colors.bark}
          background={sent ? nook.color : colors.barkSoft}
        />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={ui.cardTitle}>
            {sent ? "You sent" : "They sent"} a {occasion.label.toLowerCase()} card
          </Text>
          <Text style={ui.muted}>
            {new Date(`${card.on_date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
            {card.note ? ` · ${card.note}` : ""}
          </Text>
        </View>
        {url ? (
          <Pressable onPress={() => setViewing(url)} hitSlop={6} accessibilityLabel="See the card's photo">
            <Image source={{ uri: url }} style={styles.thumb} contentFit="cover" transition={150} />
          </Pressable>
        ) : (
          <Icon name={occasion.icon} size={18} color={colors.muted} />
        )}
      </Tap>
    );
  }

  return (
    <NookScroll onRefresh={reload}>
      <Stack.Screen
        options={{
          title: contact.name,
          headerRight: () => (
            <Tap
              onPress={() => router.push({ pathname: "/letterbox/contact-form", params: { id } })}
              hitSlop={10}
              style={[ui.row, { gap: 5 }]}
            >
              <Icon name="edit" size={17} />
              <Text style={{ color: colors.bark, fontSize: 17, fontWeight: "600" }}>Edit</Text>
            </Tap>
          ),
        }}
      />

      {/* The envelope: name and address, like it'll be written. */}
      <Appear>
        <View style={[styles.envelope, { boxShadow: shadow.boxShadow }, { backgroundColor: colors.dark ? `${nook.iconColor}26` : nook.color }]}>
          <View style={styles.stamp}>
            <Icon name="mail" size={22} color={nook.iconColor} />
          </View>
          <Text style={[styles.envelopeName, { color: colors.text }]}>{contact.name}</Text>
          {lines.length ? (
            lines.map((line) => (
              <Text key={line} style={[styles.envelopeLine, { color: colors.text }]} selectable>
                {line}
              </Text>
            ))
          ) : (
            <Text style={[styles.envelopeLine, { color: colors.text, opacity: 0.6 }]}>
              {addressUnavailable(contact, data) ? "Their address isn't shared with you" : "No address yet"}
            </Text>
          )}
          {fromProfile ? (
            <View style={[ui.row, { gap: 6, marginTop: 6 }]}>
              <Icon name="sparkles" size={13} color={nook.iconColor} />
              <Text style={[ui.muted, { fontSize: 13, color: colors.text }]}>
                From {possessive(fromProfile.display_name)} profile — stays up to date
              </Text>
            </View>
          ) : null}
        </View>
      </Appear>

      <View style={[ui.row, { gap: 10 }]}>
        {lines.length ? <Button title="Copy address" icon="copy" variant="secondary" style={{ flex: 1 }} onPress={copyAddress} /> : null}
        {!lines.length && !contact.address_from ? (
          <Button
            title="Add their address"
            icon="place"
            variant="secondary"
            style={{ flex: 1 }}
            onPress={() => router.push({ pathname: "/letterbox/contact-form", params: { id } })}
          />
        ) : null}
      </View>

      <View style={[ui.card, ui.row, { gap: 12 }]}>
        <IconBadge name="christmas" size={38} color={nook.iconColor} background={nook.color} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={ui.cardTitle}>On the holiday card list</Text>
          <Text style={ui.muted}>{listed ? "They'll be on your send list each year." : "Not on your send list."}</Text>
        </View>
        <Switch value={listed} onValueChange={toggleList} trackColor={{ true: colors.bark }} />
      </View>

      {contact.letterbox_people.length ? (
        <>
          <SectionHeader title="Who lives here" icon="group" />
          {contact.letterbox_people.map((person, i) => {
            const name = personName(person, data);
            const birthday = personBirthday(person, data);
            const linked = person.profile_id ? data.profiles.get(person.profile_id) : null;
            const next = birthday ? nextBirthday(birthday) : null;
            return (
              <Appear key={person.id} index={i} style={[ui.card, ui.row, { gap: 12 }]}>
                <Avatar name={name} icon={linked?.avatar_icon} color={linked?.avatar_color} photo={linked?.avatar_path} size={40} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={ui.cardTitle}>{name}</Text>
                  <Text style={ui.muted}>
                    {birthday
                      ? `Birthday ${formatBirthday(birthday)} · ${next!.days === 0 ? "today!" : next!.days === 1 ? "tomorrow" : `in ${next!.days} days`}`
                      : "No birthday saved"}
                    {linked ? " · on Nook" : ""}
                  </Text>
                </View>
              </Appear>
            );
          })}
        </>
      ) : null}

      {contact.notes ? (
        <>
          <SectionHeader title="Notes" icon="edit" />
          <View style={ui.card}>
            <Text style={[ui.muted, { color: colors.text }]}>{contact.notes}</Text>
          </View>
        </>
      ) : null}

      <SectionHeader title="Cards" icon="mail" />
      <View style={[ui.row, { gap: 10 }]}>
        <Button
          title="I sent one"
          icon="arrowUp"
          style={{ flex: 1 }}
          onPress={() => router.push({ pathname: "/letterbox/card-form", params: { contactId: id, direction: "sent" } })}
        />
        <Button
          title="They sent one"
          icon="arrowDown"
          variant="secondary"
          style={{ flex: 1 }}
          onPress={() => router.push({ pathname: "/letterbox/card-form", params: { contactId: id, direction: "received" } })}
        />
      </View>
      {years.length === 0 ? (
        <Text style={[ui.muted, { textAlign: "center" }]}>No cards yet. Log one each time a card goes out or comes in.</Text>
      ) : (
        years.map((year) => (
          <View key={year} style={{ gap: 10 }}>
            <Text style={[ui.label, { marginBottom: 0, marginTop: 6 }]}>{year}</Text>
            {cards.filter((c) => c.season === year).map(cardRow)}
          </View>
        ))
      )}

      <Modal visible={viewing !== null} transparent animationType="fade" onRequestClose={() => setViewing(null)}>
        <Pressable style={styles.viewer} onPress={() => setViewing(null)} accessibilityLabel="Close the photo">
          {viewing ? <Image source={{ uri: viewing }} style={styles.full} contentFit="contain" /> : null}
        </Pressable>
      </Modal>
    </NookScroll>
  );
}

function possessive(name: string | null | undefined) {
  return name?.trim() ? `${name.trim()}'s` : "their";
}

const styles = StyleSheet.create({
  envelope: {
    borderRadius: 22,
    padding: 22,
    paddingTop: 26,
    gap: 2,
    overflow: "hidden",
  },
  stamp: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 46,
    height: 54,
    borderRadius: 6,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "rgba(163, 66, 95, 0.45)",
    backgroundColor: "rgba(255,255,255,0.55)",
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "4deg" }],
  },
  envelopeName: { fontSize: 22, fontWeight: "800", marginBottom: 4, marginRight: 60 },
  envelopeLine: { fontSize: 16, lineHeight: 22 },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  thumb: { width: 44, height: 44, borderRadius: 10 },
  viewer: { flex: 1, backgroundColor: "rgba(0,0,0,0.88)", alignItems: "center", justifyContent: "center", padding: 16 },
  full: { width: "100%", height: "80%" },
});
