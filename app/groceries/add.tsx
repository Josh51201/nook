import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

import { Icon } from "../../components/icon";
import { LoadingScreen, Tap } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { Text, TextInput } from "../../components/text";
import { Banner, Button, Chip, EmptyState, SectionHeader } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { friendlyError, guarded, tap } from "../../lib/feedback";
import { guessAisle, itemKey, potluckShowFrom, splitIngredient } from "../../lib/groceries";
import { addItems, schedulePotluckAlert, useGroceries, type ItemDraft } from "../../lib/groceries-data";
import { dishesWithoutRecipe, recipesOnMenu, shortDate, weekWords } from "../../lib/menu-board";
import { loadMenu } from "../../lib/menu-board-data";
import { grocerySettingDefaults, menuBoardSettingDefaults, useNookSettings } from "../../lib/nook-settings";
import { localDay } from "../../lib/pets";
import { loadPotluck } from "../../lib/potluck-data";
import { RECIPE_FIELDS, scaleIngredient, type Recipe } from "../../lib/recipes";
import { loadRecipe } from "../../lib/recipes-data";
import { supabase } from "../../lib/supabase";
import { colors, themed, ui } from "../../lib/theme";

// Pick what you need and put it on a grocery list (GROC-005, GROC-006,
// MENU-005). Opened from a recipe (?recipe=id&factor=2), the Menu Board's
// "Shop for this week" (?week=YYYY-MM-DD), or a Potluck you're bringing a
// dish to (?potluck=id). Nothing starts ticked: you pick what you're out of.

type Line = { key: string; name: string; amount: string | null; source: string | null; picked: boolean };
type Group = { title: string; icon: "recipe" | "food" | "potluck" | "add"; lines: Line[] };
type Potluck = { id: string; title: string; day: string };

const lineFrom = (text: string, source: string | null, key: string): Line => {
  const { name, amount } = splitIngredient(text);
  return { key, name, amount, source, picked: false };
};

const recipeGroup = (recipe: Pick<Recipe, "id" | "title" | "ingredients">, factor = 1): Group => ({
  title: recipe.title,
  icon: "recipe",
  lines: recipe.ingredients.filter((l) => l.trim()).map((l, i) => lineFrom(scaleIngredient(l, factor), recipe.title, `${recipe.id}-${i}`)),
});

export default function AddToGroceries() {
  const router = useRouter();
  const params = useLocalSearchParams<{ recipe?: string; factor?: string; week?: string; potluck?: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;
  const { data: groceries } = useGroceries(userId, { makeFirst: true });
  const { settings, update } = useNookSettings("groceries", grocerySettingDefaults);
  const { settings: menuSettings } = useNookSettings("menu-board", menuBoardSettingDefaults);
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [potluck, setPotluck] = useState<Potluck | null>(null);
  const [heading, setHeading] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [listId, setListId] = useState<string | null>(null);
  const [extra, setExtra] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userId) return;
    guarded(async () => {
      if (params.recipe) {
        const recipe = await loadRecipe(params.recipe);
        if (!recipe) throw new Error("This recipe isn't here any more.");
        const factor = Number(params.factor) > 0 ? Number(params.factor) : 1;
        setHeading(recipe.title);
        setGroups([recipeGroup(recipe, factor)]);
      } else if (params.week) {
        const { meals } = await loadMenu(params.week);
        const ids = recipesOnMenu(meals);
        const { data: rows, error: recipeError } = ids.length ? await supabase.from("recipes").select(RECIPE_FIELDS).in("id", ids) : { data: [], error: null };
        if (recipeError) throw recipeError;
        const byId = new Map(((rows ?? []) as Recipe[]).map((r) => [r.id, r]));
        const next: Group[] = ids.filter((rid) => byId.has(rid)).map((rid) => recipeGroup(byId.get(rid)!));
        const loose = dishesWithoutRecipe(meals);
        if (loose.length) next.push({ title: "Meals without a recipe", icon: "food", lines: loose.map((d, i) => ({ key: `dish-${i}`, name: d, amount: null, source: null, picked: false })) });
        setHeading(weekWords(params.week, localDay(), menuSettings.weekStart === 1 ? 1 : 0));
        setGroups(next);
      } else if (params.potluck) {
        const loaded = await loadPotluck(params.potluck, userId);
        if (!loaded) throw new Error("This Potluck isn't here any more.");
        const day = localDay(new Date(loaded.potluck.starts_at));
        setPotluck({ id: loaded.potluck.id, title: loaded.potluck.title, day });
        setHeading(loaded.potluck.title);
        const next: Group[] = [];
        for (const dish of loaded.dishes.filter((d) => d.brought_by === userId)) {
          const recipe = dish.recipe_id && loaded.openRecipes.has(dish.recipe_id) ? await loadRecipe(dish.recipe_id) : null;
          if (recipe && recipe.ingredients.length) next.push({ ...recipeGroup(recipe), title: dish.name, icon: "potluck" });
          else next.push({ title: dish.name, icon: "potluck", lines: [{ key: `${dish.id}-0`, name: dish.name, amount: null, source: null, picked: false }] });
        }
        // Everything for a Potluck says which one it's for.
        setGroups(next.map((g) => ({ ...g, lines: g.lines.map((l) => ({ ...l, source: loaded.potluck.title })) })));
      } else {
        setGroups([]);
      }
    }, setError, () => {});
    // Load once for what the screen was opened with.
  }, [userId, params.recipe, params.week, params.potluck]);

  // The list last added to, else your first.
  const lists = groceries?.lists ?? [];
  const chosen = lists.find((l) => l.id === listId) ?? lists.find((l) => l.id === settings.lastList) ?? lists[0] ?? null;

  if (error) return <EmptyState icon="cart" title="Couldn't open that" body={error} />;
  if (!groups || !groceries) return <LoadingScreen cards={3} />;

  const picked = groups.flatMap((g) => g.lines.filter((l) => l.picked));
  const showFrom = potluck ? potluckShowFrom(potluck.day) : null;
  const onList = new Set(groceries.items.filter((i) => chosen && i.list_id === chosen.id && !i.checked).map((i) => itemKey(i.name)));

  function setLine(groupIndex: number, key: string, change: Partial<Line>) {
    setGroups((current) =>
      current!.map((g, i) => (i === groupIndex ? { ...g, lines: g.lines.map((l) => (l.key === key ? { ...l, ...change } : l)) } : g))
    );
  }

  function pickAll(groupIndex: number, on: boolean) {
    tap();
    setGroups((current) => current!.map((g, i) => (i === groupIndex ? { ...g, lines: g.lines.map((l) => ({ ...l, picked: on })) } : g)));
  }

  function addExtra() {
    const text = extra.trim();
    if (!text) return;
    tap();
    const line = { ...lineFrom(text, potluck?.title ?? null, `extra-${Date.now()}`), picked: true };
    setGroups((current) => {
      const at = current!.findIndex((g) => g.icon === "add");
      if (at >= 0) return current!.map((g, i) => (i === at ? { ...g, lines: [...g.lines, line] } : g));
      return [...current!, { title: "Something else", icon: "add", lines: [line] }];
    });
    setExtra("");
  }

  async function save() {
    if (!chosen || !picked.length) return;
    setSaving(true);
    const drafts: ItemDraft[] = picked.map((l) => ({
      name: l.name,
      amount: l.amount,
      aisle: guessAisle(l.name),
      source: l.source,
      potluck_id: potluck?.id ?? null,
      show_from: showFrom,
    }));
    const { error: addError, added, merged } = await addItems(chosen.id, drafts, groceries!.items);
    setSaving(false);
    if (addError) return Alert.alert("Couldn't add them", friendlyError({ message: addError }));
    tap("success");
    update({ lastList: chosen.id }).catch(() => {});
    if (potluck && showFrom) schedulePotluckAlert(potluck.id, potluck.title, chosen.name, showFrom);
    const total = added + merged;
    Alert.alert(
      `Added ${total} to ${chosen.name}`,
      showFrom ? `They're waiting under "Coming up" and join the list on ${shortDate(showFrom)}, the week of the Potluck.` : merged ? `${merged} were already on the list, so the amounts were added together.` : "",
      [
        { text: "Open the list", onPress: () => router.replace(`/groceries/${chosen.id}`) },
        { text: "Done", style: "cancel", onPress: () => router.back() },
      ]
    );
  }

  return (
    <NookScroll>
      <Stack.Screen options={{ title: "Add to a grocery list" }} />

      <View style={{ gap: 2 }}>
        <Text style={styles.title}>{heading || "Add to a grocery list"}</Text>
        <Text style={ui.muted}>Tick what you need to buy.</Text>
      </View>

      {potluck ? (
        showFrom ? (
          <Banner
            icon="calendar"
            tone="sky"
            title={`Joins your list on ${shortDate(showFrom)}`}
            body={`That's the week of the Potluck. Until then it waits under "Coming up", so it doesn't clutter this week's shopping. This phone will remind you that morning.`}
          />
        ) : (
          <Banner icon="potluck" tone="sky" title="It's Potluck week" body="These go straight on your list." />
        )
      ) : null}

      {!groups.length ? (
        <Text style={ui.muted}>
          {params.week
            ? "Nothing on this week's menu to shop for yet."
            : params.potluck
              ? "You're not bringing a dish to this Potluck yet. Add one first, then come back."
              : "Nothing to add from here."}
        </Text>
      ) : null}

      {groups.map((group, gi) => {
        const allPicked = group.lines.every((l) => l.picked);
        return (
          <View key={`${group.title}-${gi}`} style={{ gap: 8 }}>
            <SectionHeader
              title={group.title}
              icon={group.icon}
              right={
                group.lines.length > 1 ? (
                  <Tap onPress={() => pickAll(gi, !allPicked)} hitSlop={8} accessibilityRole="button">
                    <Text style={ui.link}>{allPicked ? "None" : "All"}</Text>
                  </Tap>
                ) : null
              }
            />
            <View style={[ui.card, { gap: 0, paddingVertical: 4 }]}>
              {group.lines.map((line) => (
                <Tap
                  key={line.key}
                  onPress={() => {
                    tap();
                    setLine(gi, line.key, { picked: !line.picked });
                  }}
                  style={styles.line}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: line.picked }}
                  accessibilityLabel={`${line.name}${line.amount ? `, ${line.amount}` : ""}`}
                >
                  <View style={[styles.box, line.picked && { backgroundColor: colors.bark, borderColor: colors.bark }]}>
                    {line.picked ? <Icon name="check" size={13} color={colors.onAccent} /> : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, color: colors.text }}>{line.name}</Text>
                    {line.amount || onList.has(itemKey(line.name)) ? (
                      <Text style={[ui.muted, { fontSize: 13 }]}>
                        {[line.amount, onList.has(itemKey(line.name)) ? "already on the list" : null].filter(Boolean).join(" · ")}
                      </Text>
                    ) : null}
                  </View>
                </Tap>
              ))}
            </View>
          </View>
        );
      })}

      {/* Anything else, typed (GROC-003) */}
      <SectionHeader title="Anything else?" icon="add" />
      <View style={[ui.row, { gap: 10 }]}>
        <TextInput
          style={[ui.input, { flex: 1 }]}
          value={extra}
          onChangeText={setExtra}
          placeholder="Napkins, ice, a bag of rolls…"
          placeholderTextColor={colors.muted}
          maxLength={120}
          returnKeyType="done"
          blurOnSubmit={false}
          onSubmitEditing={addExtra}
          accessibilityLabel="Something else to add"
        />
        <Button title="Add" variant="secondary" onPress={addExtra} disabled={!extra.trim()} style={{ paddingHorizontal: 18 }} />
      </View>

      {/* Which list */}
      {lists.length > 1 ? (
        <>
          <SectionHeader title="Which list?" icon="cart" />
          <View style={ui.chips}>
            {lists.map((l) => (
              <Chip key={l.id} icon={l.shared ? "group" : "lock"} selected={chosen?.id === l.id} onPress={() => setListId(l.id)}>
                {l.name}
              </Chip>
            ))}
          </View>
        </>
      ) : null}

      <Button
        title={picked.length ? `Add ${picked.length} to ${chosen?.name ?? "your list"}` : "Tick what you need"}
        icon="cart"
        onPress={save}
        disabled={!picked.length || !chosen}
        loading={saving}
      />
    </NookScroll>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    title: { fontSize: 24, fontWeight: "800", color: colors.text, letterSpacing: -0.3 },
    line: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
    box: {
      width: 24,
      height: 24,
      borderRadius: 7,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
  })
);
