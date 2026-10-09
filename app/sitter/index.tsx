import * as Clipboard from "expo-clipboard";
import { Stack, useRouter } from "expo-router";
import { Alert, Share, View } from "react-native";

import { Icon } from "../../components/icon";
import { LoadingScreen } from "../../components/motion";
import { NookHero } from "../../components/nook-hero";
import { NookScroll } from "../../components/nook-scroll";
import { Text } from "../../components/text";
import { Banner, Button, EmptyState, HeaderIcon, NavCard, SectionHeader } from "../../components/ui";
import { HeaderWithHelp } from "../../components/help-button";
import { useAuth } from "../../lib/auth-context";
import { friendlyError, tap } from "../../lib/feedback";
import { findNook } from "../../lib/nooks";
import { linkState, linkUrl, sectionFilled, sections, shareMessage, stayWords, viewsWords, type SitterLink } from "../../lib/sitter";
import { removeLink, switchOffLink, useSitter } from "../../lib/sitter-data";
import { colors, ui } from "../../lib/theme";

const nook = findNook("sitter")!;

// Sitter Sheet home (SIT-001): the sheet your Home keeps, and the links
// you've given out, each with when it runs out and how often it's been opened.
export default function SitterHome() {
  const router = useRouter();
  const { session } = useAuth();
  const { data, error, isLoading, reload } = useSitter(session?.user.id);

  if (isLoading && !data) return <LoadingScreen cards={3} />;
  if (!data) {
    return (
      <NookScroll onRefresh={reload}>
        <EmptyState icon="sitter" title="Couldn't open the Sitter Sheet" body={error ?? "Check your connection and try again."} />
      </NookScroll>
    );
  }

  const filled = sections.filter((s) => sectionFilled(data.sheet, s.key));
  const live = data.links.filter((l) => ["active", "upcoming"].includes(linkState(l)));
  const past = data.links.filter((l) => !live.includes(l)).slice(0, 10);
  const nothingToShare = !filled.length && !data.kids.length && !data.pets.length;

  async function share(link: SitterLink) {
    const url = linkUrl(link.token);
    if (!url) return Alert.alert("Not ready to share yet", "The sitter's web page hasn't been put online yet. The link is saved here, ready for when it is.");
    Alert.alert(link.label, stayWords(link), [
      {
        text: "Copy link",
        onPress: async () => {
          await Clipboard.setStringAsync(url);
          tap("success");
        },
      },
      { text: "Share…", onPress: () => Share.share({ message: shareMessage(link, url) }) },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  function manage(link: SitterLink) {
    const state = linkState(link);
    Alert.alert(link.label, `${stayWords(link)}\n${viewsWords(link.views)}`, [
      ...(state === "active" || state === "upcoming"
        ? [
            { text: "Share again", onPress: () => share(link) },
            { text: "See what they see", onPress: () => router.push(`/sitter/preview?id=${link.id}`) },
            {
              text: "Switch off now",
              style: "destructive" as const,
              onPress: async () => {
                const { error: offError } = await switchOffLink(link.id);
                if (offError) Alert.alert("Couldn't switch it off", friendlyError(offError));
                reload();
              },
            },
          ]
        : [
            {
              text: "Remove",
              style: "destructive" as const,
              onPress: async () => {
                const { error: removeError } = await removeLink(link.id);
                if (removeError) Alert.alert("Couldn't remove it", friendlyError(removeError));
                reload();
              },
            },
          ]),
      { text: "Cancel", style: "cancel" },
    ]);
  }

  function linkCard(link: SitterLink, index: number) {
    const state = linkState(link);
    const by = link.created_by ? data!.names.get(link.created_by) : null;
    const words =
      state === "off" ? "Switched off" : state === "ended" ? "Ended" : state === "upcoming" ? `Starts ${stayWords({ starts_on: link.starts_on, ends_on: link.starts_on })}` : "Working now";
    return (
      <NavCard
        key={link.id}
        index={index}
        icon={state === "active" || state === "upcoming" ? "link" : "lock"}
        iconColor={nook.iconColor}
        iconBackground={nook.color}
        title={link.label}
        subtitle={[stayWords(link), words, viewsWords(link.views), by ? `Made by ${by}` : null].filter(Boolean).join(" · ")}
        onPress={() => manage(link)}
        right={
          state === "active" || state === "upcoming" ? (
            <Button title="Share" icon="share" variant="secondary" onPress={() => share(link)} style={{ paddingHorizontal: 12, paddingVertical: 8 }} />
          ) : undefined
        }
      />
    );
  }

  return (
    <NookScroll onRefresh={reload}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <HeaderWithHelp>
              <HeaderIcon icon="settings" label="Sitter Sheet settings" onPress={() => router.push("/sitter/settings")} />
            </HeaderWithHelp>
          ),
        }}
      />
      <NookHero
        icon="sitter"
        accent={nook.iconColor}
        tint={nook.color}
        headline={!filled.length ? "Write your sitter sheet" : live.length ? `${live.length} link${live.length === 1 ? "" : "s"} out` : "Ready to share"}
        facts={[
          { icon: "doc", text: `${filled.length} of ${sections.length} parts filled in` },
          { icon: "group", text: "Shared with your Home" },
        ]}
      />

      <SectionHeader title="The sheet" icon="doc" />
      <NavCard
        icon="edit"
        iconColor={nook.iconColor}
        iconBackground={nook.color}
        title={filled.length ? "Change the sheet" : "Fill in the sheet"}
        subtitle={filled.length ? filled.map((s) => s.label).join(", ") : "Numbers, bedtime, house rules — whatever a sitter needs."}
        onPress={() => router.push("/sitter/edit")}
      />

      <SectionHeader title="Links" icon="link" />
      <Text style={ui.muted}>
        Make a link for each stay. The sitter opens it on their phone, no app needed, and it stops working after the last day.
      </Text>
      {live.map((l, i) => linkCard(l, i))}
      <Button title="Make a link" icon="add" onPress={() => router.push("/sitter/link")} disabled={nothingToShare} />
      {nothingToShare ? <Text style={ui.muted}>Fill in the sheet first.</Text> : null}

      {past.length ? (
        <View style={{ gap: 10 }}>
          <SectionHeader title="Ended" icon="lock" />
          {past.map((l, i) => linkCard(l, i))}
        </View>
      ) : null}

      <Banner icon="shield" tone="sky" title="Only what you pick">
        <View style={[ui.row, { gap: 6, marginTop: 4 }]}>
          <Icon name="hidden" size={14} color={colors.muted} />
          <Text style={[ui.muted, { flex: 1 }]}>
            Kids and pets only appear on a link if you tick them. Kids show just a first name, allergies and diets.
          </Text>
        </View>
      </Banner>
    </NookScroll>
  );
}
