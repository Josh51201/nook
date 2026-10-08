import { Stack, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";

import { LoadingScreen } from "../../components/motion";
import { NookHero } from "../../components/nook-hero";
import { NookScroll } from "../../components/nook-scroll";
import { Text, TextInput } from "../../components/text";
import { Banner, Button, EmptyState, HeaderIcon, NavCard, SectionHeader } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { cardSeason, nextBirthday, seasonStatus } from "../../lib/letterbox";
import {
  addressUnavailable,
  contactAddress,
  loadReceivedGifts,
  personBirthday,
  personName,
  type Contact,
} from "../../lib/letterbox-data";
import { findNook } from "../../lib/nooks";
import { supabase } from "../../lib/supabase";
import { colors, ui } from "../../lib/theme";
import { useLetterbox } from "../../lib/use-letterbox";

const nook = findNook("letterbox")!;

// Letterbox home (LET-001): card season at a glance, thank-yous owed,
// birthdays coming up, and every contact in your address book.
export default function LetterboxHome() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id;
  const { data, error, isLoading, reload } = useLetterbox();
  const [extras, setExtras] = useState<{ hasAddress: boolean; invites: number; thanksOwed: number } | null>(null);
  const [search, setSearch] = useState("");

  // Things that aren't part of the shared list: your own address, invites
  // waiting for you, and gifts you haven't said thanks for yet.
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      Promise.all([
        supabase.from("profile_addresses").select("profile_id").eq("profile_id", userId).maybeSingle(),
        supabase.from("home_invites").select("id", { count: "exact", head: true }).eq("invited", userId),
        supabase.from("letterbox_thanks").select("gift_id, thanked_at"),
        loadReceivedGifts(userId).catch(() => []),
      ]).then(([address, invites, thanks, gifts]) => {
        const rows = (thanks.data ?? []) as { gift_id: string | null; thanked_at: string | null }[];
        const covered = new Set(rows.map((t) => t.gift_id));
        setExtras({
          hasAddress: Boolean(address.data),
          invites: invites.count ?? 0,
          thanksOwed: rows.filter((t) => !t.thanked_at).length + gifts.filter((g) => !covered.has(g.id)).length,
        });
      });
    }, [userId])
  );

  if (isLoading && !data) return <LoadingScreen cards={4} />;
  if (!data) {
    return (
      <NookScroll onRefresh={reload}>
        <EmptyState icon="mail" title="Couldn't open your Letterbox" body={error ?? "Check your connection and try again."} />
      </NookScroll>
    );
  }

  const season = cardSeason();
  const status = seasonStatus(data.contacts, data.cards, season);
  const inSeason = [9, 10, 11, 0].includes(new Date().getMonth());

  // Birthdays in the next six weeks, soonest first.
  const birthdays = data.contacts
    .flatMap((contact) =>
      contact.letterbox_people.map((person) => {
        const birthday = personBirthday(person, data);
        if (!birthday || person.profile_id === userId) return null;
        return { contact, name: personName(person, data), ...nextBirthday(birthday) };
      })
    )
    .filter((b): b is NonNullable<typeof b> => Boolean(b) && b!.days <= 42)
    .sort((a, b) => a.days - b.days);

  const query = search.trim().toLowerCase();
  const shown = query
    ? data.contacts.filter(
        (h) =>
          h.name.toLowerCase().includes(query) ||
          h.letterbox_people.some((p) => personName(p, data).toLowerCase().includes(query)) ||
          (contactAddress(h, data)?.city ?? "").toLowerCase().includes(query)
      )
    : data.contacts;

  const when = (days: number) => (days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`);
  const headline =
    inSeason && status.total
      ? status.toSend.length
        ? `${status.toSend.length} holiday card${status.toSend.length === 1 ? "" : "s"} to send`
        : "All your holiday cards are out!"
      : birthdays[0]
        ? `${birthdays[0].name}'s birthday ${when(birthdays[0].days)}`
        : data.contacts.length
          ? "Your Letterbox"
          : "Start your Letterbox";
  const shared = data.members.length > 1;

  function subtitle(contact: Contact) {
    const address = contactAddress(contact, data!);
    if (address) return [address.line1, address.city].filter(Boolean).join(" · ");
    return addressUnavailable(contact, data!) ? "Their address isn't shared with you" : "No address yet";
  }

  return (
    <NookScroll onRefresh={reload}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <HeaderIcon
              icon="settings"
              label="Letterbox Nook settings"
              
              onPress={() => router.push("/letterbox/settings")}
            />
          ),
        }}
      />

      <NookHero
        icon="mail"
        accent={nook.iconColor}
        tint={nook.color}
        headline={headline}
        facts={[
          {
            icon: "group",
            text: `${data.contacts.length} contact${data.contacts.length === 1 ? "" : "s"}${shared ? ` · shared with ${data.members.length - 1}` : ""}`,
          },
          ...(birthdays[0] && (inSeason || birthdays.length > 1)
            ? [{ icon: "birthday" as const, text: `${birthdays[0].name}'s birthday ${when(birthdays[0].days)}` }]
            : []),
          ...(extras?.thanksOwed ? [{ icon: "heart" as const, text: `${extras.thanksOwed} thank-you${extras.thanksOwed === 1 ? "" : "s"} to write` }] : []),
        ]}
      />

      {extras && extras.invites > 0 ? (
        <Banner
          icon="mail"
          tone="sky"
          title="Someone wants to share a Home with you"
          body="The people you live with, and everything you keep together. Tap to answer."
          onPress={() => router.push("/home")}
        />
      ) : null}
      {extras && !extras.hasAddress ? (
        <Banner
          icon="place"
          tone="sun"
          title="Add your mailing address"
          body="So family can send you cards. You choose which Burrows see it."
          onPress={() => router.push("/profile")}
        />
      ) : null}

      <NavCard
        index={0}
        icon="christmas"
        iconColor={nook.iconColor}
        iconBackground={nook.color}
        title={`Card season ${season}`}
        subtitle={
          status.total
            ? `${status.sent.length} of ${status.total} sent${status.gotFrom.length ? ` · ${status.gotFrom.length} came in` : ""}`
            : "Pick who's on your holiday card list"
        }
        onPress={() => router.push("/letterbox/season")}
      />
      <NavCard
        index={1}
        icon="heart"
        iconColor={nook.iconColor}
        iconBackground={nook.color}
        title="Thank-yous"
        subtitle={extras?.thanksOwed ? `${extras.thanksOwed} still to write` : "All caught up"}
        onPress={() => router.push("/letterbox/thanks")}
      />

      {birthdays.length ? (
        <>
          <SectionHeader title="Birthdays coming up" icon="birthday" />
          {birthdays.slice(0, 4).map((b, i) => (
            <NavCard
              key={`${b.contact.id}-${b.name}`}
              index={i + 2}
              icon="birthday"
              title={b.name}
              subtitle={`${b.date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · ${when(b.days)}${b.days <= 7 ? " · time to mail a card" : ""}`}
              onPress={() => router.push(`/letterbox/contact/${b.contact.id}`)}
            />
          ))}
        </>
      ) : null}

      <SectionHeader title="Contacts" icon="mail" />
      {data.contacts.length > 6 ? (
        <TextInput
          style={ui.input}
          value={search}
          onChangeText={setSearch}
          placeholder="Find a name or town…"
          placeholderTextColor={colors.muted}
          clearButtonMode="while-editing"
        />
      ) : null}
      {data.contacts.length === 0 ? (
        <EmptyState
          icon="mail"
          title="Nobody here yet"
          body="Add family from your Burrows — their addresses fill in and stay up to date — or anyone else you send cards to."
        />
      ) : shown.length === 0 ? (
        <Text style={[ui.muted, { textAlign: "center" }]}>No one matches “{search.trim()}”.</Text>
      ) : (
        shown.map((contact, i) => (
          <NavCard
            key={contact.id}
            index={Math.min(i + 3, 8)}
            icon={contact.letterbox_people.length > 1 ? "group" : "person"}
            title={contact.name}
            subtitle={subtitle(contact)}
            onPress={() => router.push(`/letterbox/contact/${contact.id}`)}
          />
        ))
      )}

      <View style={{ gap: 10 }}>
        <Button title="Add family from your Burrows" icon="burrow" onPress={() => router.push("/letterbox/add-family")} />
        <Button title="Add someone else" icon="add" variant="secondary" onPress={() => router.push("/letterbox/contact-form")} />
      </View>
    </NookScroll>
  );
}
