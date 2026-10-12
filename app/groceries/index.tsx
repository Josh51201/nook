import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Switch, View } from "react-native";

import { BottomSheet } from "../../components/bottom-sheet";
import { HeaderWithHelp } from "../../components/help-button";
import { Icon } from "../../components/icon";
import { LoadingScreen } from "../../components/motion";
import { NookHero } from "../../components/nook-hero";
import { NookScroll } from "../../components/nook-scroll";
import { Text, TextInput } from "../../components/text";
import { Button, EmptyState, HeaderIcon, NavCard } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { friendlyError, tap } from "../../lib/feedback";
import { countWords, LIST_NAME_LENGTH, listCounts, MAX_LISTS } from "../../lib/groceries";
import { createList, useGroceries } from "../../lib/groceries-data";
import { findNook } from "../../lib/nooks";
import { colors, ui } from "../../lib/theme";

// Grocery List home (GROC-001, GROC-002): every list you can use, yours
// first, then ones the people you live with share. A first "Groceries"
// list is made the first time you come in.
export default function GroceriesHome() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id;
  const { data, error, isLoading, reload } = useGroceries(userId, { makeFirst: true });
  const [making, setMaking] = useState(false);
  const [name, setName] = useState("");
  const [shared, setShared] = useState(true);
  const [saving, setSaving] = useState(false);
  const nook = findNook("groceries")!;

  if (isLoading && !data) return <LoadingScreen cards={3} />;
  if (!data) {
    return (
      <NookScroll onRefresh={reload}>
        <EmptyState icon="cart" title="Couldn't open your lists" body={error ?? "Check your connection and try again."} />
      </NookScroll>
    );
  }

  const mine = data.lists.filter((l) => l.owner_id === userId);
  const left = data.lists.reduce((sum, l) => sum + listCounts(data.items.filter((i) => i.list_id === l.id)).left, 0);

  function startList() {
    if (mine.length >= MAX_LISTS) return Alert.alert("That's a lot of lists", `You can keep up to ${MAX_LISTS}. Delete one you don't use to make room.`);
    tap();
    setName("");
    setShared(true);
    setMaking(true);
  }

  async function saveList() {
    if (!name.trim()) return;
    setSaving(true);
    const { list, error: saveError } = await createList(name, shared);
    setSaving(false);
    if (saveError || !list) return Alert.alert("Couldn't make the list", friendlyError({ message: saveError }));
    tap("success");
    setMaking(false);
    router.push(`/groceries/${list.id}`);
  }

  return (
    <View style={{ flex: 1 }}>
      <NookScroll onRefresh={reload}>
        <Stack.Screen
          options={{
            headerRight: () => (
              <HeaderWithHelp>
                <HeaderIcon icon="add" label="New list" onPress={startList} />
              </HeaderWithHelp>
            ),
          }}
        />

        <NookHero
          icon="cart"
          accent={nook.iconColor}
          tint={nook.color}
          headline={left ? `${left} thing${left === 1 ? "" : "s"} to get` : "All stocked up"}
          facts={[
            { icon: "todo", text: `${data.lists.length} list${data.lists.length === 1 ? "" : "s"}` },
            { icon: "recipe", text: "Add from recipes, the Menu Board and Potlucks" },
          ]}
        />

        {data.lists.map((list, i) => {
          const counts = listCounts(data.items.filter((item) => item.list_id === list.id));
          const owner = list.owner_id === userId ? null : data.names.get(list.owner_id) ?? "Someone";
          return (
            <NavCard
              key={list.id}
              index={i}
              icon="cart"
              iconColor={nook.iconColor}
              iconBackground={nook.color}
              title={list.name}
              subtitle={[countWords(counts), owner ? `${owner}'s, shared with you` : list.shared ? "Shared with your Home" : "Just you"].join("\n")}
              right={
                <View style={[ui.row, { gap: 8 }]}>
                  {list.shared && !owner ? <Icon name="group" size={14} color={colors.muted} /> : null}
                  {!list.shared ? <Icon name="lock" size={13} color={colors.muted} /> : null}
                  <Icon name="chevron" size={14} color={colors.muted} />
                </View>
              }
              onPress={() => router.push(`/groceries/${list.id}`)}
            />
          );
        })}

        <Button title="New list" icon="add" variant="secondary" onPress={startList} />
        <Text style={ui.muted}>One list for each store, a list for a party, a list just for you — whatever helps.</Text>
      </NookScroll>

      <BottomSheet visible={making} onClose={() => setMaking(false)} header={<Text style={[ui.cardTitle, { fontSize: 18 }]}>A new list</Text>}>
        <View style={{ gap: 14 }}>
          <TextInput
            style={ui.input}
            value={name}
            onChangeText={setName}
            placeholder="Costco, Aldi, Party supplies…"
            placeholderTextColor={colors.muted}
            maxLength={LIST_NAME_LENGTH}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={saveList}
            accessibilityLabel="List name"
          />
          <View style={[ui.row, { gap: 12 }]}>
            <View style={{ flex: 1 }}>
              <Text style={ui.cardTitle}>Share with my Home</Text>
              <Text style={ui.muted}>{shared ? "Everyone you live with can add to it and tick things off." : "Just you."}</Text>
            </View>
            <Switch value={shared} onValueChange={setShared} trackColor={{ true: colors.bark }} />
          </View>
          <Button title="Make the list" icon="check" onPress={saveList} disabled={!name.trim()} loading={saving} />
        </View>
      </BottomSheet>
    </View>
  );
}
