import { SymbolView, type SymbolViewProps } from "expo-symbols";
import { View, type StyleProp, type ViewStyle } from "react-native";

import { colors, depth } from "../lib/theme";

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
  potluck: { ios: "fork.knife", android: "restaurant" },
  // Potluck
  warning: { ios: "exclamationmark.triangle.fill", android: "warning" },
  place: { ios: "mappin.and.ellipse", android: "location_on" },
  clock: { ios: "clock", android: "schedule" },
  minus: { ios: "minus", android: "remove" },
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
  christmas: { ios: "snowflake", android: "ac_unit" },
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
  lock: { ios: "lock.fill", android: "lock" },
  unlock: { ios: "lock.open.fill", android: "lock_open" },
  search: { ios: "magnifyingglass", android: "search" },
  tidy: { ios: "wand.and.stars", android: "auto_fix_high" },
  door: { ios: "door.left.hand.open", android: "door_open" },
  wave: { ios: "hand.wave.fill", android: "waving_hand" },
  paw: { ios: "pawprint.fill", android: "pets" },
  leaf: { ios: "leaf.fill", android: "eco" },
  star: { ios: "star.fill", android: "star" },
  moon: { ios: "moon.fill", android: "dark_mode" },
  sun: { ios: "sun.max.fill", android: "wb_sunny" },
  flame: { ios: "flame.fill", android: "local_fire_department" },
  coffee: { ios: "cup.and.saucer.fill", android: "coffee" },
  music: { ios: "music.note", android: "music_note" },
  sailboat: { ios: "sailboat.fill", android: "sailing" },
  cookie: { ios: "birthday.cake", android: "cookie" },
  bike: { ios: "bicycle", android: "pedal_bike" },
  gamepad: { ios: "gamecontroller.fill", android: "sports_esports" },
  arrowUp: { ios: "arrow.up", android: "arrow_upward" },
  arrowDown: { ios: "arrow.down", android: "arrow_downward" },
  drag: { ios: "hand.draw.fill", android: "drag_indicator" },
  resize: { ios: "arrow.up.left.and.arrow.down.right", android: "open_in_full" },
  text: { ios: "textformat", android: "title" },
  widgets: { ios: "square.grid.2x2.fill", android: "widgets" },
  // More to pick from for your own tiles and widgets (CORE-030)
  tree: { ios: "tree.fill", android: "park" },
  flower: { ios: "camera.macro", android: "local_florist" },
  cart: { ios: "cart.fill", android: "shopping_cart" },
  camera: { ios: "camera.fill", android: "photo_camera" },
  plane: { ios: "airplane", android: "flight" },
  car: { ios: "car.fill", android: "directions_car" },
  pill: { ios: "pills.fill", android: "medication" },
  dumbbell: { ios: "dumbbell.fill", android: "fitness_center" },
  bolt: { ios: "bolt.fill", android: "bolt" },
  drop: { ios: "drop.fill", android: "water_drop" },
  school: { ios: "graduationcap.fill", android: "school" },
  work: { ios: "briefcase.fill", android: "work" },
  phone: { ios: "phone.fill", android: "call" },
  mail: { ios: "envelope.fill", android: "mail" },
  cloud: { ios: "cloud.fill", android: "cloud" },
  umbrella: { ios: "umbrella.fill", android: "umbrella" },
  globe: { ios: "globe.americas.fill", android: "public" },
  key: { ios: "key.fill", android: "key" },
  paint: { ios: "paintbrush.fill", android: "brush" },
  game: { ios: "dice.fill", android: "casino" },
  baby: { ios: "stroller.fill", android: "child_friendly" },
  church: { ios: "building.columns.fill", android: "account_balance" },
  rhythm: { ios: "arrow.triangle.2.circlepath", android: "autorenew" },
  tools: { ios: "wrench.and.screwdriver.fill", android: "build" },
  shield: { ios: "checkmark.shield.fill", android: "verified_user" },
  thermo: { ios: "thermometer.medium", android: "thermostat" },
  doc: { ios: "doc.text.fill", android: "description" },
  sitter: { ios: "list.clipboard.fill", android: "assignment" },
  recipe: { ios: "book.pages.fill", android: "auto_stories" },
  timer: { ios: "timer", android: "timer" },
  play: { ios: "play.fill", android: "play_arrow" },
  pause: { ios: "pause.fill", android: "pause" },
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
        boxShadow: depth.badge,
      }}
    >
      <Icon name={name} size={size * 0.52} color={color} />
    </View>
  );
}
