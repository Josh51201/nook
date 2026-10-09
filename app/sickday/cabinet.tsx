import { useRouter } from "expo-router";
import { View } from "react-native";

import { IconBadge } from "../../components/icon";
import { Appear, LoadingScreen, Tap } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { Text } from "../../components/text";
import { Button, EmptyState } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { findNook } from "../../lib/nooks";
import { ingredientLabel, medicineRule } from "../../lib/sickday";
import { firstName, useSickDay } from "../../lib/sickday-data";
import { colors, ui } from "../../lib/theme";

const nook = findNook("sickday")!;

// The medicine cabinet (SICK-005): each medicine saved once, with the dose
// and hours between doses from the label or the doctor.
export default function Cabinet() {
  const router = useRouter();
  const { session } = useAuth();
  const { data, reload } = useSickDay(session?.user.id);

  if (!data) return <LoadingScreen cards={3} />;
  const medicines = data.medicines.filter((m) => m.home_id === data.homeId);

  return (
    <NookScroll onRefresh={reload}>
      {!medicines.length ? (
        <EmptyState
          icon="pill"
          title="Nothing in the cabinet yet"
          body="Save what you keep in the house — kids' Tylenol, Motrin, an antibiotic — with the dose and hours between doses from the label or the doctor. Giving a dose then starts the timer by itself."
        />
      ) : (
        medicines.map((m, i) => (
          <Appear key={m.id} index={i}>
            <Tap
              onPress={() => router.push({ pathname: "/sickday/medicine", params: { id: m.id } })}
              style={[ui.card, ui.row, { gap: 12 }]}
              accessibilityRole="button"
            >
              <IconBadge name="pill" size={40} color={nook.iconColor} background={colors.dark ? `${nook.iconColor}33` : nook.color} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={ui.cardTitle}>
                  {m.name}
                  {m.for_profile ? <Text style={{ fontWeight: "500" }}>{` · ${firstName(data, m.for_profile)}'s`}</Text> : null}
                </Text>
                {medicineRule(m) ? <Text style={[ui.muted, { fontSize: 13 }]}>{medicineRule(m)}</Text> : null}
                {m.ingredients.length ? (
                  <Text style={[ui.muted, { fontSize: 12 }]}>{m.ingredients.map(ingredientLabel).join(", ")}</Text>
                ) : null}
              </View>
            </Tap>
          </Appear>
        ))
      )}
      <Button title="Add a medicine" icon="add" onPress={() => router.push("/sickday/medicine")} />
      <Text style={[ui.muted, { fontSize: 12 }]}>
        Medicines sharing what's in them count together, so Tylenol and NyQuil (both acetaminophen) can't be doubled up. Shared with your Home.
      </Text>
    </NookScroll>
  );
}
