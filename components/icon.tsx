import { SymbolView, type SymbolViewProps } from "expo-symbols";
import { View, type StyleProp, type ViewStyle } from "react-native";

import { colors } from "../lib/theme";

// One icon set for the whole app: Apple's SF Symbols on iPhone, Google's
// Material Symbols on Android (both via expo-symbols, built into Expo Go).
// Screens use these friendly names, never raw symbol names, so swapping an
// icon is a one-line change here. Both columns are type-checked against the
// real symbol lists.
const icons = {
  // Nooks & places
  gift: { ios: "gift.fill", android: "redeem" },
  food: { ios: "carrot.fill", android: "nutrition" },
  todo: { ios: "checklist", android: "checklist" },
  hearth: { ios: "house.fill", android: "home" },
  burrow: { ios: "house.lodge.fill", android: "cottage" },
  market: { ios: "storefront.fill", android: "storefront" },
  // Gift Nook
  wishbook: { ios: "book.closed.fill", android: "menu_book" },
  tucks: { ios: "bag.fill", android: "shopping_bag" },
  kid: { ios: "figure.and.child.holdinghands", android: "child_care" },
  heart: { ios: "heart.fill", android: "favorite" },
  suggest: { ios: "lightbulb.fill", android: "lightbulb" },
  hidden: { ios: "eye.slash.fill", android: "visibility_off" },
  price: { ios: "tag.fill", android: "sell" },
  link: { ios: "link", android: "link" },
  sparkles: { ios: "sparkles", android: "auto_awesome" },
  calendar: { ios: "calendar", android: "calendar_month" },
  invite: { ios: "person.badge.plus", android: "person_add" },
  person: { ios: "person.fill", android: "person" },
  group: { ios: "person.3.fill", android: "group" },
  bell: { ios: "bell.fill", android: "notifications" },
  inbox: { ios: "tray.fill", android: "inbox" },
  check: { ios: "checkmark.circle.fill", android: "check_circle" },
  bought: { ios: "shippingbox.fill", android: "local_shipping" },
  given: { ios: "party.popper.fill", android: "celebration" },
  // Gathering kinds
  christmas: { ios: "tree.fill", android: "park" },
  birthday: { ios: "birthday.cake.fill", android: "cake" },
  anniversary: { ios: "heart.circle.fill", android: "favorite" },
  baby_shower: { ios: "stroller.fill", android: "stroller" },
  celebration: { ios: "party.popper.fill", android: "celebration" },
  // Shelves
  clothes: { ios: "tshirt.fill", android: "checkroom" },
  money: { ios: "dollarsign.circle.fill", android: "savings" },
  books: { ios: "books.vertical.fill", android: "menu_book" },
  toys: { ios: "teddybear.fill", android: "toys" },
  experiences: { ios: "ticket.fill", android: "hiking" },
  category: { ios: "square.grid.2x2.fill", android: "category" },
  // Actions
  add: { ios: "plus", android: "add" },
  close: { ios: "xmark", android: "close" },
  more: { ios: "ellipsis", android: "more_horiz" },
  edit: { ios: "pencil", android: "edit" },
  trash: { ios: "trash", android: "delete" },
  share: { ios: "square.and.arrow.up", android: "share" },
  copy: { ios: "doc.on.doc", android: "content_copy" },
  chevron: { ios: "chevron.right", android: "chevron_right" },
  settings: { ios: "gearshape.fill", android: "settings" },
  logout: { ios: "rectangle.portrait.and.arrow.right", android: "logout" },
  palette: { ios: "paintpalette.fill", android: "palette" },
  filter: { ios: "line.3.horizontal.decrease", android: "filter_list" },
  undo: { ios: "arrow.uturn.backward", android: "undo" },
  door: { ios: "door.left.hand.open", android: "door_open" },
  wave: { ios: "hand.wave.fill", android: "waving_hand" },
  arrowUp: { ios: "arrow.up", android: "arrow_upward" },
  arrowDown: { ios: "arrow.down", android: "arrow_downward" },
  drag: { ios: "hand.draw.fill", android: "drag_indicator" },
} satisfies Record<string, { ios: SymbolViewProps["name"] & string; android: AndroidName }>;

type AndroidName = Exclude<Extract<SymbolViewProps["name"], object>["android"], undefined>;

export type IconName = keyof typeof icons;

export function Icon({
  name,
  size = 22,
  color = colors.bark,
  bounce,
  style,
}: {
  name: IconName;
  size?: number;
  color?: string;
  /** iPhone only: a little bounce when this value changes (e.g. after tucking). */
  bounce?: string | number | boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const symbol = icons[name];
  return (
    <SymbolView
      key={bounce === undefined ? undefined : String(bounce)}
      name={{ ios: symbol.ios, android: symbol.android, web: symbol.android }}
      size={size}
      tintColor={color}
      type="hierarchical"
      animationSpec={bounce === undefined ? undefined : { effect: { type: "bounce" } }}
      style={[{ width: size, height: size }, style]}
    />
  );
}

// An icon sitting in a soft tinted circle — used to lead cards and rows.
export function IconBadge({
  name,
  size = 40,
  color = colors.bark,
  background = colors.barkSoft,
}: {
  name: IconName;
  size?: number;
  color?: string;
  background?: string;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2.6,
        backgroundColor: background,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon name={name} size={size * 0.52} color={color} />
    </View>
  );
}
