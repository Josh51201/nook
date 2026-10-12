import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, Switch, View } from "react-native";

import { BottomSheet } from "../../components/bottom-sheet";
import { Collapsible } from "../../components/collapsible";
import { HeaderWithHelp } from "../../components/help-button";
import { Icon } from "../../components/icon";
import { LoadingScreen, Tap } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { Text, TextInput } from "../../components/text";
import { Button, Chip, EmptyState, HeaderIcon, SectionHeader } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { friendlyError, tap } from "../../lib/feedback";
import {
  aisleLabel,
  aisles,
  countWords,
  itemDetail,
  LIST_NAME_LENGTH,
  listCounts,
  listParts,
  parseTyped,
  suggestGroceries,
  type Aisle,
  type GroceryItem,
} from "../../lib/groceries";
import { addItems, clearCart, deleteList, removeItem, updateItem, updateList, useGroceries } from "../../lib/groceries-data";
import { shortDate } from "../../lib/menu-board";
import { colors, themed, ui } from "../../lib/theme";

// One grocery list (GROC-002..006): type to add (with suggestions), tick
// things into the cart while you shop, clear the cart, and see Potluck
// shopping waiting under "Coming up". A shared list updates live.
export default function GroceryListScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;
  const { data, setData, error, isLoading, reload } = useGroceries(userId);
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<GroceryItem | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  if (isLoading && !data) return <LoadingScreen cards={4} />;
  const list = data?.lists.find((l) => l.id === id);
  if (!data || !list) {
    return (
      <NookScroll onRefresh={reload}>
        <EmptyState icon="cart" title="This list isn't here" body={error ?? "It may have been deleted, or it's not shared with you any more."} />
      </NookScroll>
    );
  }

  const isOwner = list.owner_id === userId;
  const items = data.items.filter((i) => i.list_id === id);
  const parts = listParts(items);
  const counts = listCounts(items);
  const suggestions = suggestGroceries(text, items.filter((i) => !i.checked).map((i) => i.name));
  const owner = isOwner ? null : data.names.get(list.owner_id) ?? "Someone";

  async function add(typed: string) {
    const { name, amount, aisle } = parseTyped(typed);
    if (!name.trim()) return;
    tap();
    setText("");
    const { error: addError } = await addItems(id, [{ name, amount, aisle }], data!.items);
    if (addError) Alert.alert("Couldn't add it", friendlyError({ message: addError }));
    reload();
  }

  // Ticks show straight away; the database catches up.
  async function change(item: GroceryItem, next: Partial<GroceryItem>) {
    setData((current) => (current ? { ...current, items: current.items.map((i) => (i.id === item.id ? { ...i, ...next } : i)) } : current));
    const { error: changeError } = await updateItem(item.id, next);
    if (changeError) {
      Alert.alert("Couldn't change that", friendlyError({ message: changeError }));
      reload();
    }
  }

  async function remove(item: GroceryItem) {
    setData((current) => (current ? { ...current, items: current.items.filter((i) => i.id !== item.id) } : current));
    setEditing(null);
    const { error: removeError } = await removeItem(item.id);
    if (removeError) Alert.alert("Couldn't take it off", friendlyError({ message: removeError }));
    reload();
  }

  async function emptyCart() {
    tap("success");
    setData((current) => (current ? { ...current, items: current.items.filter((i) => !(i.list_id === id && i.checked)) } : current));
    const { error: clearError } = await clearCart(id);
    if (clearError) Alert.alert("Couldn't clear the cart", friendlyError({ message: clearError }));
    reload();
  }

  function row(item: GroceryItem) {
    const detail = itemDetail(item);
    return (
      <Tap
        key={item.id}
        onPress={() => {
          tap();
          change(item, { checked: !item.checked });
        }}
        onLongPress={() => setEditing(item)}
        style={styles.item}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.checked }}
        accessibilityLabel={`${item.name}${detail ? `, ${detail}` : ""}`}
        accessibilityHint="Hold to change or remove it"
      >
        <View style={[styles.box, item.checked && { backgroundColor: colors.bark, borderColor: colors.bark }]}>
          {item.checked ? <Icon name="check" size={13} color={colors.onAccent} /> : null}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.itemName, item.checked && { color: colors.muted, textDecorationLine: "line-through" }]}>{item.name}</Text>
          {detail ? <Text style={[ui.muted, { fontSize: 13 }]}>{detail}</Text> : null}
        </View>
        <Tap onPress={() => setEditing(item)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Change ${item.name}`}>
          <Icon name="more" size={16} color={colors.muted} />
        </Tap>
      </Tap>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <NookScroll onRefresh={reload}>
        <Stack.Screen
          options={{
            title: list.name,
            headerRight: () => (
              <HeaderWithHelp>
                {isOwner ? <HeaderIcon icon="settings" label="List settings" onPress={() => setSettingsOpen(true)} /> : null}
              </HeaderWithHelp>
            ),
          }}
        />

        <View style={{ gap: 2 }}>
          <Text style={styles.title}>{list.name}</Text>
          <Text style={ui.muted}>
            {countWords(counts)} · {owner ? `${owner}'s, shared with your Home` : list.shared ? "Shared with your Home" : "Just you"}
          </Text>
        </View>

        {/* Add things at will (GROC-003) */}
        <View style={[ui.input, ui.row, { paddingVertical: 0 }]}>
          <Icon name="add" size={16} color={colors.bark} />
          <TextInput
            style={{ flex: 1, paddingVertical: 13, fontSize: 16, color: colors.text }}
            value={text}
            onChangeText={setText}
            placeholder="Add something: milk, 2 lb chicken…"
            placeholderTextColor={colors.muted}
            returnKeyType="done"
            blurOnSubmit={false}
            onSubmitEditing={() => add(text)}
            maxLength={120}
            accessibilityLabel="Add something to the list"
          />
          {text.trim() ? (
            <Tap onPress={() => add(text)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Add it">
              <Text style={ui.link}>Add</Text>
            </Tap>
          ) : null}
        </View>
        {suggestions.length ? (
          <View style={ui.chips}>
            {suggestions.map((s) => (
              <Chip key={s} icon="add" onPress={() => add(s)}>
                {s}
              </Chip>
            ))}
          </View>
        ) : null}

        {/* Still to get, by aisle (GROC-004) */}
        {!parts.toGet.length && !parts.inCart.length ? (
          <EmptyState
            icon="cart"
            title="Nothing on the list"
            body="Type above, or add a recipe's ingredients from its page in the Recipe Box, the Menu Board, or a Potluck you're bringing a dish to."
          />
        ) : null}
        {parts.toGet.map((group) => (
          <View key={group.aisle} style={{ gap: 6 }}>
            <View style={[ui.row, { gap: 6, marginTop: 6 }]}>
              <Icon name={aisles.find((a) => a.key === group.aisle)!.icon} size={14} color={colors.bark} />
              <Text style={styles.aisle}>{aisleLabel(group.aisle)}</Text>
            </View>
            <View style={[ui.card, { gap: 0, paddingVertical: 4 }]}>{group.items.map(row)}</View>
          </View>
        ))}

        {/* In the cart */}
        {parts.inCart.length ? (
          <>
            <SectionHeader
              title={`In the cart (${parts.inCart.length})`}
              icon="cart"
              right={
                <Tap onPress={emptyCart} hitSlop={8} accessibilityRole="button">
                  <Text style={ui.link}>Clear the cart</Text>
                </Tap>
              }
            />
            <View style={[ui.card, { gap: 0, paddingVertical: 4 }]}>{parts.inCart.map(row)}</View>
          </>
        ) : null}

        {/* Potluck shopping waiting for the week of (GROC-006) */}
        {parts.comingUp.length ? (
          <Collapsible id={`grocery-coming-${id}`} title={`Coming up (${parts.comingUp.length})`} icon="calendar" summary="Joins the list the week of">
            <View style={{ gap: 10 }}>
              {parts.comingUp.map((item) => (
                <View key={item.id} style={[ui.row, { gap: 10 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={[ui.muted, { fontSize: 13 }]}>
                      {[itemDetail(item), item.show_from ? `joins ${shortDate(item.show_from)}` : null].filter(Boolean).join(" · ")}
                    </Text>
                  </View>
                  <Tap onPress={() => change(item, { show_from: null })} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Add ${item.name} now`}>
                    <Text style={[ui.link, { fontSize: 14 }]}>Add it now</Text>
                  </Tap>
                </View>
              ))}
            </View>
          </Collapsible>
        ) : null}

        <Text style={ui.muted}>Tap to put something in the cart. Hold it to change the amount, the aisle, or move it to another list.</Text>
      </NookScroll>

      {/* One item: name, amount, aisle, which list, remove */}
      <BottomSheet visible={!!editing} onClose={() => setEditing(null)} header={<Text style={[ui.cardTitle, { fontSize: 18 }]}>{editing?.name}</Text>}>
        {editing ? (
          <ItemEditor
            key={editing.id}
            item={editing}
            lists={data.lists.filter((l) => l.id !== id)}
            onSave={(next) => {
              change(editing, next);
              setEditing(null);
            }}
            onRemove={() => remove(editing)}
          />
        ) : null}
      </BottomSheet>

      {/* The list itself (owner only): name, sharing, delete */}
      <BottomSheet visible={settingsOpen} onClose={() => setSettingsOpen(false)} header={<Text style={[ui.cardTitle, { fontSize: 18 }]}>This list</Text>}>
        {settingsOpen ? (
          <ListSettings
            name={list.name}
            shared={list.shared}
            onSave={async (next) => {
              const { error: saveError } = await updateList(id, next);
              if (saveError) return Alert.alert("Couldn't save that", friendlyError({ message: saveError }));
              tap("success");
              setSettingsOpen(false);
              reload();
            }}
            onDelete={() =>
              Alert.alert(`Delete ${list.name}?`, "Everything on it goes too, for everyone it's shared with.", [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: async () => {
                    const { error: deleteError } = await deleteList(id);
                    if (deleteError) return Alert.alert("Couldn't delete it", friendlyError({ message: deleteError }));
                    setSettingsOpen(false);
                    router.back();
                  },
                },
              ])
            }
          />
        ) : null}
      </BottomSheet>
    </View>
  );
}

function ItemEditor({
  item,
  lists,
  onSave,
  onRemove,
}: {
  item: GroceryItem;
  lists: { id: string; name: string }[];
  onSave: (next: Partial<GroceryItem>) => void;
  onRemove: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [amount, setAmount] = useState(item.amount ?? "");
  const [aisle, setAisle] = useState<Aisle>(item.aisle);
  const [listId, setListId] = useState(item.list_id);

  return (
    <View style={{ gap: 12 }}>
      <View style={[ui.row, { gap: 10 }]}>
        <TextInput style={[ui.input, { flex: 2 }]} value={name} onChangeText={setName} maxLength={80} placeholder="What" placeholderTextColor={colors.muted} accessibilityLabel="What it is" />
        <TextInput style={[ui.input, { flex: 1 }]} value={amount} onChangeText={setAmount} maxLength={60} placeholder="How much" placeholderTextColor={colors.muted} accessibilityLabel="How much" />
      </View>
      <Text style={ui.label}>Aisle</Text>
      <View style={ui.chips}>
        {aisles.map((a) => (
          <Chip key={a.key} icon={a.icon} selected={aisle === a.key} onPress={() => setAisle(a.key)}>
            {a.label}
          </Chip>
        ))}
      </View>
      {lists.length ? (
        <>
          <Text style={ui.label}>Move to another list</Text>
          <View style={ui.chips}>
            {lists.map((l) => (
              <Chip key={l.id} icon="cart" selected={listId === l.id} onPress={() => setListId(listId === l.id ? item.list_id : l.id)}>
                {l.name}
              </Chip>
            ))}
          </View>
        </>
      ) : null}
      <Button
        title="Save"
        icon="check"
        disabled={!name.trim()}
        onPress={() => onSave({ name: name.trim(), amount: amount.trim() || null, aisle, ...(listId !== item.list_id ? { list_id: listId } : {}) })}
      />
      <Button title="Take it off the list" icon="trash" variant="danger" onPress={onRemove} />
    </View>
  );
}

function ListSettings({
  name: startName,
  shared: startShared,
  onSave,
  onDelete,
}: {
  name: string;
  shared: boolean;
  onSave: (next: { name: string; shared: boolean }) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(startName);
  const [shared, setShared] = useState(startShared);
  return (
    <View style={{ gap: 14 }}>
      <TextInput style={ui.input} value={name} onChangeText={setName} maxLength={LIST_NAME_LENGTH} placeholder="List name" placeholderTextColor={colors.muted} accessibilityLabel="List name" />
      <View style={[ui.row, { gap: 12 }]}>
        <View style={{ flex: 1 }}>
          <Text style={ui.cardTitle}>Share with my Home</Text>
          <Text style={ui.muted}>
            {shared ? "Everyone you live with can add to it and tick things off. Only you can rename, unshare or delete it." : "Just you."}
          </Text>
        </View>
        <Switch value={shared} onValueChange={setShared} trackColor={{ true: colors.bark }} />
      </View>
      <Button title="Save" icon="check" disabled={!name.trim()} onPress={() => onSave({ name: name.trim(), shared })} />
      <Button title="Delete this list" icon="trash" variant="danger" onPress={onDelete} />
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    title: { fontSize: 26, fontWeight: "800", color: colors.text, letterSpacing: -0.4 },
    aisle: { fontSize: 13, fontWeight: "700", color: colors.bark, textTransform: "uppercase", letterSpacing: 0.6 },
    item: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
    itemName: { fontSize: 16, color: colors.text },
    box: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
  })
);
