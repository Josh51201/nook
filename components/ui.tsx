import type { ReactNode } from "react";
import { ActivityIndicator, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";

import { colors, themed, ui } from "../lib/theme";
import { Icon, IconBadge, type IconName } from "./icon";
import { Appear, Tap } from "./motion";

// Small, consistent building blocks for Nook screens.

export function Button({
  title,
  onPress,
  icon,
  variant = "primary",
  loading,
  disabled,
  style,
  accessibilityLabel,
}: {
  title: string;
  onPress: () => void;
  icon?: IconName;
  variant?: "primary" | "secondary" | "danger";
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  if (variant === "danger") {
    return (
      <Tap
        onPress={onPress}
        disabled={disabled || loading}
        style={[{ alignItems: "center", padding: 10 }, style]}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        <View style={ui.row}>
          {icon ? <Icon name={icon} size={16} color={colors.error} /> : null}
          <Text style={{ color: colors.error, fontSize: 15, fontWeight: "500" }}>{title}</Text>
        </View>
      </Tap>
    );
  }
  const primary = variant === "primary";
  const tint = primary ? colors.onAccent : colors.bark;
  return (
    <Tap
      onPress={onPress}
      disabled={disabled || loading}
      style={[primary ? ui.button : ui.secondaryButton, style]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {loading ? (
        <ActivityIndicator color={tint} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={18} color={tint} /> : null}
          <Text style={primary ? ui.buttonText : ui.secondaryButtonText}>{title}</Text>
        </>
      )}
    </Tap>
  );
}

export function Chip({
  selected,
  onPress,
  icon,
  children,
}: {
  selected?: boolean;
  onPress: () => void;
  icon?: IconName;
  children: ReactNode;
}) {
  return (
    <Tap
      onPress={onPress}
      pressedScale={0.94}
      style={[ui.chip, ui.row, { gap: 6 }, selected && ui.chipSelected]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      {icon ? <Icon name={icon} size={14} color={selected ? colors.onAccent : colors.bark} /> : null}
      <Text style={[ui.chipText, selected && ui.chipTextSelected]}>{children}</Text>
    </Tap>
  );
}

// A tappable card that leads with an icon: navigation to a list, a person,
// a Gathering…
export function NavCard({
  icon,
  iconColor,
  iconBackground,
  leading,
  title,
  subtitle,
  onPress,
  onLongPress,
  right,
  index = 0,
  style,
  children,
}: {
  icon: IconName;
  // Replaces the icon badge, e.g. with a person's Avatar.
  leading?: ReactNode;
  iconColor?: string;
  iconBackground?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  right?: ReactNode;
  index?: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  return (
    <Appear index={index}>
      <Tap
        onPress={onPress}
        onLongPress={onLongPress}
        disabled={!onPress && !onLongPress}
        style={[ui.card, style]}
        accessibilityRole={onPress ? "button" : undefined}
      >
        <View style={[ui.row, { gap: 12 }]}>
          {leading ?? <IconBadge name={icon} color={iconColor} background={iconBackground} />}
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={ui.cardTitle} numberOfLines={2}>
              {title}
            </Text>
            {subtitle ? <Text style={ui.muted}>{subtitle}</Text> : null}
          </View>
          {right ?? (onPress ? <Icon name="chevron" size={14} color={colors.muted} /> : null)}
        </View>
        {children}
      </Tap>
    </Appear>
  );
}

export function SectionHeader({ title, icon, right }: { title: string; icon?: IconName; right?: ReactNode }) {
  return (
    <View style={[ui.row, { marginTop: 10, justifyContent: "space-between" }]}>
      <View style={ui.row}>
        {icon ? <Icon name={icon} size={18} color={colors.bark} /> : null}
        <Text style={[ui.sectionTitle, { marginTop: 0 }]}>{title}</Text>
      </View>
      {right}
    </View>
  );
}

export function EmptyState({ icon, title, body }: { icon: IconName; title: string; body?: string }) {
  return (
    <Appear>
      <View style={{ alignItems: "center", gap: 8, paddingVertical: 28, paddingHorizontal: 12 }}>
        <IconBadge name={icon} size={64} />
        <Text style={[ui.cardTitle, { fontSize: 17, textAlign: "center" }]}>{title}</Text>
        {body ? <Text style={[ui.muted, { textAlign: "center" }]}>{body}</Text> : null}
      </View>
    </Appear>
  );
}

// A soft colored note: heads-ups, prompts, explanations.
export function Banner({
  icon,
  tone = "sun",
  title,
  body,
  onPress,
  children,
  index,
}: {
  icon: IconName;
  tone?: "sun" | "sky" | "rose" | "bark";
  title?: string;
  body?: ReactNode;
  onPress?: () => void;
  children?: ReactNode;
  index?: number;
}) {
  const background = { sun: colors.sun, sky: colors.sky, rose: colors.rose, bark: colors.barkSoft }[tone];
  return (
    <Appear index={index}>
      <Tap
        onPress={onPress}
        disabled={!onPress}
        style={{ backgroundColor: background, borderRadius: 16, padding: 14, gap: 6 }}
      >
        <View style={[ui.row, { alignItems: "flex-start", gap: 10 }]}>
          <Icon name={icon} size={20} color={colors.bark} style={{ marginTop: 1 }} />
          <View style={{ flex: 1, gap: 2 }}>
            {title ? <Text style={ui.cardTitle}>{title}</Text> : null}
            {body ? <Text style={[ui.muted, { color: colors.text }]}>{body}</Text> : null}
          </View>
          {onPress ? <Icon name="chevron" size={14} color={colors.muted} style={{ marginTop: 4 }} /> : null}
        </View>
        {children}
      </Tap>
    </Appear>
  );
}

// An icon button for screen headers, with an optional count badge that pops
// in (e.g. unread notices).
export function HeaderIcon({
  icon,
  onPress,
  label,
  badge = 0,
}: {
  icon: IconName;
  onPress: () => void;
  label: string;
  badge?: number;
}) {
  return (
    <Tap onPress={onPress} hitSlop={10} pressedScale={0.85} accessibilityLabel={label} accessibilityRole="button">
      <Icon name={icon} size={22} />
      {badge > 0 ? (
        <Animated.View entering={ZoomIn.springify().damping(12)} style={headerBadge}>
          <Text style={{ color: colors.white, fontSize: 11, fontWeight: "700" }}>{badge > 9 ? "9+" : badge}</Text>
        </Animated.View>
      ) : null}
    </Tap>
  );
}

const headerBadge = themed(() => ({
  position: "absolute" as const,
  top: -6,
  right: -9,
  minWidth: 18,
  height: 18,
  borderRadius: 9,
  paddingHorizontal: 4,
  backgroundColor: colors.heart,
  alignItems: "center" as const,
  justifyContent: "center" as const,
}));
