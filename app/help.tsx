import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, View } from "react-native";

import { Icon } from "../components/icon";
import { Appear, Tap } from "../components/motion";
import { NookScroll } from "../components/nook-scroll";
import { Text } from "../components/text";
import { useTour } from "../components/tour";
import { NavCard } from "../components/ui";
import { tap } from "../lib/feedback";
import { helpAnswers } from "../lib/help";
import { colors, ui } from "../lib/theme";

// Help (CORE-070): plain answers to the questions people actually ask, one
// tap to open each, and a way to replay the tour. Reached from the "?" on
// any screen, and from Settings.
export default function Help() {
  const router = useRouter();
  const tour = useTour();
  const [open, setOpen] = useState<number | null>(null);

  return (
    <NookScroll>
      <Text style={ui.muted}>Tap a question to see the answer.</Text>

      {helpAnswers.map((item, i) => {
        const isOpen = open === i;
        return (
          <Appear key={item.question} index={i}>
            <Tap
              onPress={() => {
                tap();
                setOpen(isOpen ? null : i);
              }}
              style={[ui.card, { gap: 10 }]}
              accessibilityRole="button"
              accessibilityState={{ expanded: isOpen }}
            >
              <View style={[ui.row, { gap: 12 }]}>
                <Text style={[ui.cardTitle, { flex: 1 }]}>{item.question}</Text>
                <Icon name={isOpen ? "arrowUp" : "arrowDown"} size={16} color={colors.muted} />
              </View>
              {isOpen ? <Text style={{ fontSize: 15, lineHeight: 22, color: colors.text }}>{item.answer}</Text> : null}
            </Tap>
          </Appear>
        );
      })}

      <NavCard
        icon="sparkles"
        title="Show me around again"
        subtitle="Replay the little tour"
        onPress={() =>
          tour
            ?.replay()
            .then(() => router.navigate("/hearth"))
            .catch((error: Error) => Alert.alert("Couldn't start the tour", error.message))
        }
      />
      <NavCard
        icon="settings"
        title="Make the text bigger"
        subtitle="Settings → Text size"
        onPress={() => router.navigate("/settings")}
      />
    </NookScroll>
  );
}
