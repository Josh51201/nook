import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { View } from "react-native";

import { Icon } from "../../components/icon";
import { Appear, LoadingScreen, Tap } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { Text } from "../../components/text";
import { EmptyState, SectionHeader } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { itinerary, timeWords } from "../../lib/getaways";
import { useGetaway } from "../../lib/getaways-data";
import { findNook } from "../../lib/nooks";
import { colors, ui } from "../../lib/theme";

const nook = findNook("getaways")!;

// Day by day (TRIP-005): every day of the trip with its confirmations
// (flights on their day, check-in and check-out) and the plans you add.
export default function Itinerary() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const { data, isLoading, reload } = useGetaway(id, session?.user.id);

  if (isLoading && !data) return <LoadingScreen cards={3} />;
  if (!data) return <EmptyState icon="plane" title="That Getaway isn't here" body="It may have been removed." />;

  const days = itinerary(data.trip, data.bookings, data.plans);
  const today = data.today;

  return (
    <NookScroll onRefresh={reload}>
      <Stack.Screen options={{ title: `Day by day · ${data.trip.title}` }} />
      <Text style={ui.muted}>Confirmations show up on their days by themselves. Add anything else you're planning.</Text>

      {days.map((d, di) => (
        <View key={d.day} style={{ gap: 8 }}>
          <SectionHeader
            title={d.label}
            icon={d.day === today ? "sun" : "calendar"}
            right={
              <Tap
                onPress={() => router.push({ pathname: "/getaways/plan-form", params: { getawayId: data.trip.id, day: d.day } })}
                hitSlop={8}
                accessibilityLabel={`Add a plan for ${d.label}`}
              >
                <Icon name="add" size={20} />
              </Tap>
            }
          />
          {d.entries.length ? (
            <Appear index={di}>
              <View style={[ui.card, { gap: 12 }, d.day === today && { borderWidth: 2, borderColor: nook.iconColor }]}>
                {d.entries.map((e) => (
                  <Tap
                    key={e.key}
                    onPress={() =>
                      e.bookingId
                        ? router.push({ pathname: "/getaways/booking-form", params: { getawayId: data.trip.id, id: e.bookingId } })
                        : router.push({ pathname: "/getaways/plan-form", params: { getawayId: data.trip.id, id: e.planId! } })
                    }
                    style={[ui.row, { gap: 12, alignItems: "flex-start" }]}
                    accessibilityRole="button"
                  >
                    <Text style={[ui.muted, { width: 68, fontSize: 13, color: e.time ? colors.text : colors.muted, paddingTop: 2 }]}>
                      {timeWords(e.time) ?? "All day"}
                    </Text>
                    <Icon name={e.icon} size={16} color={nook.iconColor} style={{ marginTop: 2 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, color: colors.text, fontWeight: "600" }}>{e.title}</Text>
                      {e.sub ? <Text style={[ui.muted, { fontSize: 13 }]}>{e.sub}</Text> : null}
                    </View>
                  </Tap>
                ))}
              </View>
            </Appear>
          ) : (
            <Text style={[ui.muted, { fontSize: 13 }]}>Nothing planned. A free day!</Text>
          )}
        </View>
      ))}
    </NookScroll>
  );
}
