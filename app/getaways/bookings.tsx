import * as Clipboard from "expo-clipboard";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Linking, View } from "react-native";

import { Icon, IconBadge } from "../../components/icon";
import { Appear, LoadingScreen, Tap } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { Text } from "../../components/text";
import { Button, EmptyState } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { tap } from "../../lib/feedback";
import { bookingInfo, timeWords, weekdayWords, type Booking } from "../../lib/getaways";
import { useGetaway } from "../../lib/getaways-data";
import { findNook } from "../../lib/nooks";
import { colors, ui } from "../../lib/theme";

const nook = findNook("getaways")!;

function whenLine(label: string, day: string | null, time: string | null) {
  if (!day) return null;
  return `${label} ${weekdayWords(day)}${time ? ` · ${timeWords(time)}` : ""}`;
}

// Confirmations (TRIP-004): flights, places to stay, cars and tickets, each
// with its confirmation number (tap to copy), times, address and link.
export default function Bookings() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const { data, isLoading, reload } = useGetaway(id, session?.user.id);

  if (isLoading && !data) return <LoadingScreen cards={3} />;
  if (!data) return <EmptyState icon="plane" title="That Getaway isn't here" body="It may have been removed." />;

  const open = (booking?: Booking) =>
    router.push({ pathname: "/getaways/booking-form", params: booking ? { getawayId: data.trip.id, id: booking.id } : { getawayId: data.trip.id } });

  return (
    <NookScroll onRefresh={reload}>
      <Stack.Screen options={{ title: `Confirmations · ${data.trip.title}` }} />

      {!data.bookings.length ? (
        <EmptyState
          icon="doc"
          title="Nothing saved yet"
          body="Keep the flight, the hotel, the rental car and any tickets here, so everyone going has the confirmation numbers and times. They show up on the day-by-day plan too."
        />
      ) : null}

      {data.bookings.map((b, i) => {
        const info = bookingInfo(b.kind);
        const start = whenLine(info.start, b.starts_on, b.starts_time);
        const end = b.ends_on || b.ends_time ? whenLine(info.end, b.ends_on ?? b.starts_on, b.ends_time) : null;
        return (
          <Appear key={b.id} index={i}>
            <View style={[ui.card, { gap: 8 }]}>
              <Tap onPress={() => open(b)} style={[ui.row, { gap: 12 }]} accessibilityRole="button" accessibilityLabel={`${b.title}, change it`}>
                <IconBadge name={info.icon} size={40} color={nook.iconColor} background={colors.dark ? `${nook.iconColor}33` : nook.color} />
                <View style={{ flex: 1 }}>
                  <Text style={ui.cardTitle}>{b.title}</Text>
                  <Text style={[ui.muted, { fontSize: 13 }]}>{info.label}</Text>
                </View>
                <Icon name="edit" size={16} color={colors.muted} />
              </Tap>
              {start ? <Text style={[ui.muted, { color: colors.text }]}>{start}</Text> : null}
              {end ? <Text style={[ui.muted, { color: colors.text }]}>{end}</Text> : null}
              {b.place ? <Text style={ui.muted}>{b.place}</Text> : null}
              {b.code ? (
                <Tap
                  onPress={async () => {
                    await Clipboard.setStringAsync(b.code!);
                    tap("success");
                  }}
                  style={[ui.row, { gap: 8, alignSelf: "flex-start" }]}
                  accessibilityRole="button"
                  accessibilityLabel={`Confirmation ${b.code}, tap to copy`}
                >
                  <Text style={{ fontSize: 18, fontWeight: "800", letterSpacing: 1.5, color: colors.text }}>{b.code}</Text>
                  <Icon name="copy" size={15} color={colors.muted} />
                </Tap>
              ) : null}
              {b.notes ? <Text style={ui.muted}>{b.notes}</Text> : null}
              {b.url ? (
                <Tap onPress={() => Linking.openURL(b.url!).catch(() => {})} style={[ui.row, { gap: 6, alignSelf: "flex-start" }]}>
                  <Icon name="link" size={14} />
                  <Text style={ui.link}>{b.url.replace(/^https?:\/\//i, "").split(/[/?#]/)[0]}</Text>
                </Tap>
              ) : null}
            </View>
          </Appear>
        );
      })}

      <Button title="Add a confirmation" icon="add" onPress={() => open()} />
    </NookScroll>
  );
}
