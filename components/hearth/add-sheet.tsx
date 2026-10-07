import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, FadeIn, SlideInDown } from "react-native-reanimated";

import { colors, ui } from "../../lib/theme";
import { defaultWidget, widgetKinds, widgetTemplates, type WidgetConfig } from "../../lib/widgets";
import { IconBadge, type IconName } from "../icon";
import { Tap } from "../motion";
import { SectionHeader } from "../ui";

// "Add to your Hearth": widgets (CORE-018), ready-made ideas, a text
// label for designing your layout, or a trip to the Market for Nooks.
export function AddSheet({
  visible,
  onClose,
  onAddWidget,
  onAddLabel,
  onOpenMarket,
}: {
  visible: boolean;
  onClose: () => void;
  onAddWidget: (widget: WidgetConfig) => void;
  onAddLabel: () => void;
  onOpenMarket: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      {visible ? (
        <Animated.View entering={SlideInDown.duration(300).easing(Easing.out(Easing.cubic))} style={styles.sheet}>
          <View style={styles.grabber} />
          <Text style={[ui.sectionTitle, { marginTop: 0 }]}>Add to your Hearth</Text>
          <ScrollView contentContainerStyle={{ gap: 10, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            <Row icon="market" title="A Nook" subtitle="Browse the Market for Gift Nook and more" onPress={onOpenMarket} index={0} />
            <Row icon="text" title="Text" subtitle="A title or heading to label part of your Hearth" onPress={onAddLabel} index={1} />

            <SectionHeader title="Widgets" icon="widgets" />
            {widgetKinds.map((kind, i) => (
              <Row
                key={kind.kind}
                index={i + 2}
                icon={kind.icon}
                title={kind.label}
                subtitle={kind.description}
                onPress={() => onAddWidget(defaultWidget(kind.kind))}
              />
            ))}

            <SectionHeader title="Ideas" icon="sparkles" />
            {widgetTemplates.map((template, i) => (
              <Row
                key={template.id}
                index={i + 2 + widgetKinds.length}
                icon={template.icon}
                title={template.label}
                subtitle={template.description}
                onPress={() => onAddWidget(template.build())}
                tint={colors.sun}
              />
            ))}
          </ScrollView>
        </Animated.View>
      ) : null}
    </Modal>
  );
}

function Row({
  icon,
  title,
  subtitle,
  onPress,
  index,
  tint,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  onPress: () => void;
  index: number;
  tint?: string;
}) {
  return (
    <Animated.View entering={FadeIn.delay(Math.min(index, 10) * 30).duration(220)}>
      <Tap onPress={onPress} style={[ui.card, ui.row, { gap: 12 }]} accessibilityRole="button">
        <IconBadge name={icon} size={42} background={tint ?? colors.barkSoft} />
        <View style={{ flex: 1 }}>
          <Text style={ui.cardTitle}>{title}</Text>
          <Text style={ui.muted}>{subtitle}</Text>
        </View>
        <IconBadge name="add" size={28} background="transparent" />
      </Tap>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)" },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: "85%",
    backgroundColor: colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    paddingTop: 10,
    gap: 12,
  },
  grabber: {
    alignSelf: "center",
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    marginBottom: 4,
  },
});
