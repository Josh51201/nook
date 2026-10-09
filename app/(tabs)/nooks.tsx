import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, View } from "react-native";
import { Text } from "../../components/text";

import { Icon } from "../../components/icon";
import { Tap } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { TourTarget, useTourScrollArea } from "../../components/tour";
import { Button, NavCard, SectionHeader } from "../../components/ui";
import { tap } from "../../lib/feedback";
import { addNook, nookCount, useHearthLayout } from "../../lib/hearth";
import { fullMessage, overflowing } from "../../lib/hearth-limits";
import { nookCatalog, type NookDefinition } from "../../lib/nooks";
import { colors, ui } from "../../lib/theme";
import { useUnreadByNook } from "../../lib/use-unread";

// CORE-067 (proposed): the Nooks tab — every Nook in one plain list, so
// anything can be opened in one tap whether or not it's on your Hearth.
// Someone who joined a family just for the Gift Nook, or was invited to a
// Gathering before adding anything, finds it here: Nooks with something new
// for you sit at the top. Arranging the Hearth stays on the Hearth and in
// the Market.
export default function Nooks() {
  const router = useRouter();
  const { layout, save } = useHearthLayout();
  const [refreshKey, setRefreshKey] = useState(0);
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
  const onHearth = available.filter((nook) => nookCount(layout, nook.id) > 0);
  const notOnHearth = available.filter((nook) => nookCount(layout, nook.id) === 0);

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

  // The first-time tour (CORE-026) points at whichever Nook is listed first.
  let index = 0;
  const card = (nook: NookDefinition, options: { subtitle?: string; right?: React.ReactNode } = {}) => {
    const first = index === 0;
    const shown = (
      <NavCard
        key={nook.id}
        index={index++}
        icon={nook.icon}
        iconColor={nook.iconColor}
        iconBackground={nook.color}
        title={nook.title}
        subtitle={options.subtitle ?? nook.tagline}
        right={options.right}
        onPress={() => open(nook)}
      />
    );
    return first ? (
      <TourTarget key={nook.id} id="nooks-first">
        {shown}
      </TourTarget>
    ) : (
      shown
    );
  };

  return (
    <NookScroll onRefresh={() => setRefreshKey((key) => key + 1)} tour={tourScroll}>
      <Text style={ui.muted}>Every Nook, one tap away — even ones that aren't on your Hearth.</Text>

      {withNews.length ? (
        <>
          <SectionHeader title="Waiting for you" icon="bell" />
          {withNews.map((nook) =>
            card(nook, {
              subtitle: waiting[nook.id].latest,
              right: <NewsBubble count={waiting[nook.id].count} />,
            })
          )}
        </>
      ) : null}

      {onHearth.length ? (
        <>
          <SectionHeader title="On your Hearth" icon="hearth" />
          {onHearth.map((nook) => card(nook))}
        </>
      ) : null}

      {notOnHearth.length ? (
        <>
          <SectionHeader title={onHearth.length ? "More Nooks" : "Nooks to try"} icon="nooks" />
          {notOnHearth.map((nook) =>
            card(nook, {
              right: (
                <Tap
                  onPress={() => addToHearth(nook)}
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
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "700",
                      color: colors.bark,
                    }}
                  >
                    Hearth
                  </Text>
                </Tap>
              ),
            })
          )}
        </>
      ) : null}

      {comingSoon.length ? (
        <Text style={[ui.muted, { marginTop: 6 }]}>
          Coming soon: {comingSoon.map((nook) => nook.title).join(", ")}.
        </Text>
      ) : null}

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
      <Text style={{ color: colors.background, fontSize: 13, fontWeight: "800" }}>{count > 99 ? "99+" : count}</Text>
    </View>
  );
}
