import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, View } from "react-native";
import { FixedTextSize, Text, TextInput } from "../../components/text";

import { Icon } from "../../components/icon";
import { Tap } from "../../components/motion";
import { NookGrid } from "../../components/nook-grid";
import { NookScroll } from "../../components/nook-scroll";
import { TourTarget, useTourScrollArea } from "../../components/tour";
import { Button, NavCard, SectionHeader } from "../../components/ui";
import { tap } from "../../lib/feedback";
import { addNook, nookCount, useHearthLayout } from "../../lib/hearth";
import { askToPeek } from "../../lib/inbox";
import { fullMessage, overflowing } from "../../lib/hearth-limits";
import { nookAisles, nookCatalog, nookMatches, type NookDefinition } from "../../lib/nooks";
import { colors, ui } from "../../lib/theme";
import { useUnreadByNook } from "../../lib/use-unread";

// CORE-067 (proposed): the Nooks tab — every Nook in one place, so
// anything can be opened in one tap whether or not it's on your Hearth.
// Nooks sit in small icon grids, sorted into the same groups as the Market
// (Family & get-togethers, Around the house…), with a search box, so the
// page stays easy to scan as more Nooks arrive (CORE-088, CORE-100). A + on
// an icon means it isn't on your Hearth yet; tap it to put it there.
// Someone who joined a family just for the Gift Nook, or was invited to a
// Gathering before adding anything, finds it here: Nooks with something new
// for you sit at the top, and opening one from there pops its bell's bubble
// open so you see what was waiting (CORE-099). Arranging the Hearth stays
// on the Hearth and in the Market.
export default function Nooks() {
  const router = useRouter();
  const { layout, save } = useHearthLayout();
  const [refreshKey, setRefreshKey] = useState(0);
  const [query, setQuery] = useState("");
  const waiting = useUnreadByNook(refreshKey);
  const tourScroll = useTourScrollArea();

  useFocusEffect(
    useCallback(() => {
      setRefreshKey((key) => key + 1);
    }, [])
  );

  const available = nookCatalog.filter((nook) => nook.available && nook.route);
  const comingSoon = nookCatalog.filter((nook) => !nook.available);
  const withNews = available.filter((nook) => waiting[nook.id]);
  const anyOffHearth = available.some((nook) => nookCount(layout, nook.id) === 0);
  const groups = nookAisles
    .map((group) => ({ ...group, nooks: available.filter((nook) => nook.aisle === group.id) }))
    .filter((group) => group.nooks.length);

  function open(nook: NookDefinition) {
    tap();
    router.push(nook.route!);
  }

  async function addToHearth(nook: NookDefinition) {
    try {
      const items = addNook(layout, nook.id);
      // A page only holds so much (CORE-066).
      const full = overflowing(layout, { ...layout, items });
      if (full) {
        const message = fullMessage(full);
        return Alert.alert(message.title, message.body);
      }
      tap("success");
      await save({ items });
    } catch (saveError) {
      Alert.alert("Couldn't add it", (saveError as Error).message);
    }
  }

  const searching = query.trim().length > 0;
  const found = searching ? available.filter((nook) => nookMatches(nook, query)) : [];

  // The first-time tour (CORE-026) points at whichever Nook is listed first.
  let tourPlaced = false;
  const tourFirst = (key: string, shown: React.ReactNode) => {
    if (tourPlaced) return shown;
    tourPlaced = true;
    return (
      <TourTarget key={key} id="nooks-first">
        {shown}
      </TourTarget>
    );
  };
  const card = (
    nook: NookDefinition,
    index: number,
    options: { subtitle?: string; right?: React.ReactNode; onPress?: () => void } = {}
  ) =>
    tourFirst(
      nook.id,
      <NavCard
        key={nook.id}
        index={index}
        icon={nook.icon}
        iconColor={nook.iconColor}
        iconBackground={nook.color}
        title={nook.title}
        subtitle={options.subtitle ?? nook.tagline}
        right={options.right}
        onPress={options.onPress ?? (() => open(nook))}
      />
    );
  // Only Nooks that aren't on the Hearth yet get the +.
  const grid = (nooks: NookDefinition[]) => (
    <NookGrid
      nooks={nooks}
      onOpen={open}
      onAdd={addToHearth}
      canAdd={(nook) => nookCount(layout, nook.id) === 0}
      wrap={(nook, _i, tile) => tourFirst(nook.id, tile)}
    />
  );

  return (
    <NookScroll onRefresh={() => setRefreshKey((key) => key + 1)} tour={tourScroll}>
      <Text style={ui.muted}>Every Nook, one tap away — even ones that aren't on your Hearth.</Text>

      <View style={[ui.input, ui.row, { paddingVertical: 0 }]}>
        <Icon name="search" size={16} color={colors.muted} />
        <TextInput
          style={{ flex: 1, paddingVertical: 13, fontSize: 16, color: colors.text }}
          value={query}
          onChangeText={setQuery}
          placeholder="Find a Nook"
          placeholderTextColor={colors.muted}
          returnKeyType="search"
          clearButtonMode="while-editing"
          accessibilityLabel="Find a Nook"
        />
      </View>

      {searching ? (
        found.length ? (
          found.map((nook, i) =>
            card(nook, i, {
              subtitle: waiting[nook.id]?.latest,
              right: nookCount(layout, nook.id) === 0 ? <AddPill nook={nook} onPress={() => addToHearth(nook)} /> : undefined,
            })
          )
        ) : (
          <Text style={ui.muted}>No Nook matches "{query.trim()}".</Text>
        )
      ) : (
        <>
          {withNews.length ? (
            <>
              <SectionHeader title="Waiting for you" icon="bell" />
              {withNews.map((nook, i) =>
                card(nook, i, {
                  subtitle: waiting[nook.id].latest,
                  right: <NewsBubble count={waiting[nook.id].count} />,
                  onPress: () => {
                    askToPeek(nook.id);
                    open(nook);
                  },
                })
              )}
            </>
          ) : null}

          {anyOffHearth ? <Text style={ui.muted}>Tap + on a Nook to put it on your Hearth.</Text> : null}

          {groups.map((group) => (
            <View key={group.id} style={{ gap: 10 }}>
              <SectionHeader title={group.title} icon={group.icon} />
              {grid(group.nooks)}
            </View>
          ))}

          {comingSoon.length ? (
            <Text style={[ui.muted, { marginTop: 6 }]}>
              Coming soon: {comingSoon.map((nook) => nook.title).join(", ")}.
            </Text>
          ) : null}
        </>
      )}

      <Button
        title="Arrange your Hearth in the Market"
        icon="market"
        variant="secondary"
        style={{ marginTop: 8 }}
        onPress={() => router.push("/market")}
      />
    </NookScroll>
  );
}

// "+ Hearth": put a Nook that isn't on the Hearth onto it.
function AddPill({ nook, onPress }: { nook: NookDefinition; onPress: () => void }) {
  return (
    <Tap
      onPress={onPress}
      hitSlop={8}
      style={[
        ui.row,
        {
          gap: 4,
          paddingVertical: 6,
          paddingHorizontal: 10,
          borderRadius: 999,
          backgroundColor: colors.barkSoft,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Add ${nook.title} to your Hearth`}
    >
      <Icon name="add" size={14} color={colors.bark} />
      <Text style={{ fontSize: 13, fontWeight: "700", color: colors.bark }}>Hearth</Text>
    </Tap>
  );
}

// How many new notices a Nook has.
function NewsBubble({ count }: { count: number }) {
  return (
    <View
      style={{
        minWidth: 24,
        height: 24,
        borderRadius: 12,
        paddingHorizontal: 7,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.bark,
      }}
    >
      <FixedTextSize>
        <Text style={{ color: colors.background, fontSize: 13, fontWeight: "800" }}>{count > 99 ? "99+" : count}</Text>
      </FixedTextSize>
    </View>
  );
}
