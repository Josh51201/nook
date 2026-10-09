import { ScrollView, View } from "react-native";
import { Text } from "../text";
import Animated, { FadeIn } from "react-native-reanimated";

import { trinkets, type TrinketKey } from "../../lib/trinkets";
import { cubbyStyles, type CubbyStyle } from "../../lib/cubbies";
import { colors, ui } from "../../lib/theme";
import { defaultWidget, widgetCategories, widgetKindInfo, widgetTemplates, type WidgetConfig } from "../../lib/widgets";
import { BottomSheet } from "../bottom-sheet";
import { IconBadge, type IconName } from "../icon";
import { Tap } from "../motion";
import { SectionHeader } from "../ui";
import { TrinketThumb } from "./trinket-art";
import { CubbyThumb } from "./cubby-art";

// "Add to your Hearth": widgets (CORE-018), ready-made ideas, a text label
// for designing your layout, a Hollow to organize things into (CORE-022),
// or a trip to the Market for Nooks. Inside a Hollow it offers widgets and
// text, and says how to bring a Nook in. Drag the grabber down to close.
export function AddSheet({
  visible,
  onClose,
  onAddWidget,
  onAddLabel,
  onOpenMarket,
  onAddHollow,
  onAddTrinket,
  onAddCubby,
  hollowName,
}: {
  visible: boolean;
  onClose: () => void;
  onAddWidget: (widget: WidgetConfig) => void;
  onAddLabel: () => void;
  onOpenMarket: () => void;
  // Only on the Hearth itself.
  onAddHollow?: () => void;
  // A decoration to scatter around (CORE-045).
  onAddTrinket?: (piece: TrinketKey) => void;
  // A decorated box to put behind things (CORE-084).
  onAddCubby?: (style: CubbyStyle) => void;
  // Set when adding inside a Hollow.
  hollowName?: string;
}) {
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      header={
        <Text style={[ui.sectionTitle, { marginTop: 0 }]} numberOfLines={1}>
          {hollowName ? `Add to ${hollowName}` : "Add to your Hearth"}
        </Text>
      }
    >
      <ScrollView contentContainerStyle={{ gap: 10, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        {hollowName ? (
          <Text style={ui.muted}>
            To bring a Nook in here, drag it onto this Hollow on your Hearth — or tap it in edit mode and choose
            Move to.
          </Text>
        ) : (
          <Row icon="market" title="A Nook" subtitle="Browse the Market for Gift Nook and more" onPress={onOpenMarket} index={0} />
        )}
        {onAddHollow ? (
          <Row
            icon="burrow"
            title="A Hollow"
            subtitle="A little house, stump, burrow hill or mushroom you step into — its own space for Nooks and widgets"
            onPress={onAddHollow}
            index={1}
            tint={colors.sky}
          />
        ) : null}
        <Row icon="text" title="Text" subtitle="A title or heading to label part of this space" onPress={onAddLabel} index={2} />

        {onAddTrinket ? (
          <>
            <SectionHeader title="Trinkets" icon="sparkles" />
            <Text style={ui.muted}>Little decorations to make the place feel lived in. They can't be tapped; they just sit there being cozy.</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {trinkets.map((t) => (
                <Tap
                  key={t.key}
                  onPress={() => onAddTrinket(t.key)}
                  style={[ui.card, { width: "30.5%", alignItems: "center", gap: 6, paddingVertical: 12, paddingHorizontal: 6 }]}
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${t.label}`}
                >
                  <TrinketThumb piece={t.key} color={t.color} size={52} />
                  <Text style={{ fontSize: 12, fontWeight: "600", color: colors.text, textAlign: "center" }} numberOfLines={2}>
                    {t.label}
                  </Text>
                </Tap>
              ))}
            </View>
          </>
        ) : null}

        {onAddCubby ? (
          <>
            <SectionHeader title="Cubbies" icon="category" />
            <Text style={ui.muted}>
              Decorated boxes that sit behind your widgets and tiles. Drag one around a few things to gather them
              together — they move with the box.
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {cubbyStyles.map((c) => (
                <Tap
                  key={c.key}
                  onPress={() => onAddCubby(c.key)}
                  style={[ui.card, { width: "47.5%", alignItems: "center", gap: 6, paddingVertical: 12, paddingHorizontal: 6 }]}
                  accessibilityRole="button"
                  accessibilityLabel={`Add a ${c.label}`}
                >
                  <CubbyThumb styleKey={c.key} color={c.color} size={110} />
                  <Text style={{ fontSize: 12, fontWeight: "600", color: colors.text, textAlign: "center" }} numberOfLines={1}>
                    {c.label}
                  </Text>
                </Tap>
              ))}
            </View>
          </>
        ) : null}

        {widgetCategories.map((category, c) => (
          <View key={category.id} style={{ gap: 10 }}>
            <SectionHeader title={category.label} icon={category.icon} />
            <Text style={ui.muted}>{category.blurb}</Text>
            {category.kinds.map((kind, i) => {
              const info = widgetKindInfo(kind);
              return (
                <Row
                  key={kind}
                  index={c * 2 + i + 2}
                  icon={info.icon}
                  title={info.label}
                  subtitle={info.description}
                  onPress={() => onAddWidget(defaultWidget(kind))}
                />
              );
            })}
          </View>
        ))}

        <SectionHeader title="Ideas" icon="sparkles" />
        <Text style={ui.muted}>Ready-made widgets, already set up for you</Text>
        {widgetTemplates.map((template, i) => (
          <Row
            key={template.id}
            index={i + 2}
            icon={template.icon}
            title={template.label}
            subtitle={template.description}
            onPress={() => onAddWidget(template.build())}
            tint={colors.sun}
          />
        ))}
      </ScrollView>
    </BottomSheet>
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
