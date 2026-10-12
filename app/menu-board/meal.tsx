import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

import { Icon, IconBadge } from "../../components/icon";
import { Appear, LoadingScreen, Tap } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { RecipeThumb } from "../../components/recipe-thumb";
import { Text, TextInput } from "../../components/text";
import { Button, EmptyState, SectionHeader } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { friendlyError, tap } from "../../lib/feedback";
import { dayWords, mealLabel, MAX_DISHES, shortDate, slot, slotKind, type MealKey, type MenuKind } from "../../lib/menu-board";
import { planMeal, removeMeals, useMenu } from "../../lib/menu-board-data";
import { localDay } from "../../lib/pets";
import { searchRecipes } from "../../lib/recipes";
import { useRecipeBox } from "../../lib/recipes-data";
import { colors, themed, ui } from "../../lib/theme";

// Plan one meal (MENU-003, MENU-004): type what you're having, pick it from
// the Recipe Box, or say you're going out or everyone's on their own.
export default function MealScreen() {
  const router = useRouter();
  const { day, meal } = useLocalSearchParams<{ day: string; meal: MealKey }>();
  const { session } = useAuth();
  const userId = session?.user.id;
  const { data, error, isLoading, reload } = useMenu(userId, day);
  const { box } = useRecipeBox(userId);
  const [dish, setDish] = useState("");
  const [where, setWhere] = useState("");
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);

  const today = localDay();
  const when = dayWords(day, today);
  const title = `${when === "Today" ? "Today's" : when === "Tomorrow" ? "Tomorrow's" : `${when}'s`} ${mealLabel(meal).toLowerCase()}`;

  if (isLoading && !data) return <LoadingScreen cards={3} />;
  if (!data) {
    return <EmptyState icon="calendar" title="Couldn't open the menu" body={error ?? "Check your connection and try again."} />;
  }

  const rows = slot(data.meals, day, meal);
  const kind = slotKind(rows);
  const dishes = rows.filter((r) => r.kind === "dish");
  const full = kind === "dish" && dishes.length >= MAX_DISHES;
  const recipes = [...(box?.mine ?? []), ...(box?.family ?? [])];
  const found = (query.trim() ? searchRecipes(recipes, query) : recipes).slice(0, 8);

  async function plan(next: { kind: MenuKind; title: string; recipe_id?: string | null }) {
    const go = async () => {
      setSaving(true);
      const { error: planError } = await planMeal(data!.homeId, data!.meals, { day, meal, ...next });
      setSaving(false);
      if (planError) return Alert.alert("Couldn't plan that", friendlyError({ message: planError }));
      tap("success");
      setDish("");
      setQuery("");
      reload();
    };
    // Going out or On your own wipes the dishes off; ask first.
    if (next.kind !== "dish" && dishes.length) {
      Alert.alert("Replace what's planned?", `${dishes.map((d) => d.title).join(", ")} will come off the board.`, [
        { text: "Cancel", style: "cancel" },
        { text: "Replace", onPress: go },
      ]);
    } else {
      await go();
    }
  }

  async function remove(ids: string[]) {
    tap();
    const { error: removeError } = await removeMeals(ids);
    if (removeError) Alert.alert("Couldn't take it off", friendlyError({ message: removeError }));
    reload();
  }

  return (
    <NookScroll onRefresh={reload}>
      <Stack.Screen options={{ title }} />

      <View style={{ gap: 2 }}>
        <Text style={styles.title}>{title}</Text>
        <Text style={ui.muted}>{shortDate(day)} · everyone in your Home sees this</Text>
      </View>

      {/* What's planned now */}
      {kind === "out" || kind === "own" ? (
        <Appear>
          <View style={[ui.card, ui.row, { gap: 12 }]}>
            <IconBadge name={kind === "out" ? "place" : "person"} />
            <View style={{ flex: 1 }}>
              <Text style={ui.cardTitle}>{kind === "out" ? "Going out" : "On your own"}</Text>
              <Text style={ui.muted}>
                {kind === "out" ? rows[0].title.trim() || "Somewhere nice" : "Everyone sorts out their own"}
              </Text>
            </View>
            <RemoveButton label="Take it off the board" onPress={() => remove(rows.map((r) => r.id))} />
          </View>
        </Appear>
      ) : dishes.length ? (
        <View style={[ui.card, { gap: 12 }]}>
          {dishes.map((d) => (
            <View key={d.id} style={[ui.row, { gap: 10 }]}>
              <Icon name={d.recipe_id ? "recipe" : "food"} size={16} color={colors.bark} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[ui.cardTitle, { fontSize: 16 }]}>{d.title}</Text>
                {d.recipe_id ? (
                  <View style={[ui.row, { gap: 14 }]}>
                    <Tap onPress={() => router.push(`/recipes/${d.recipe_id}`)} hitSlop={6} accessibilityRole="link">
                      <Text style={[ui.link, { fontSize: 13 }]}>See the recipe</Text>
                    </Tap>
                    <Tap
                      onPress={() => router.push({ pathname: "/groceries/add", params: { recipe: d.recipe_id! } })}
                      hitSlop={6}
                      accessibilityRole="link"
                    >
                      <Text style={[ui.link, { fontSize: 13 }]}>Add to a grocery list</Text>
                    </Tap>
                  </View>
                ) : null}
              </View>
              <RemoveButton label={`Take ${d.title} off`} onPress={() => remove([d.id])} />
            </View>
          ))}
        </View>
      ) : (
        <Text style={ui.muted}>Nothing planned yet.</Text>
      )}

      {/* A dish, typed */}
      {!full ? (
        <>
          <SectionHeader title={dishes.length ? "Add another dish" : "What are you having?"} icon="food" />
          <View style={[ui.row, { gap: 10 }]}>
            <TextInput
              style={[ui.input, { flex: 1 }]}
              value={dish}
              onChangeText={setDish}
              placeholder="Tacos, leftovers, pancakes…"
              placeholderTextColor={colors.muted}
              maxLength={80}
              returnKeyType="done"
              onSubmitEditing={() => dish.trim() && plan({ kind: "dish", title: dish })}
              accessibilityLabel="What are you having?"
            />
            <Button title="Add" onPress={() => plan({ kind: "dish", title: dish })} disabled={!dish.trim()} loading={saving} style={{ paddingHorizontal: 18 }} />
          </View>
        </>
      ) : (
        <Text style={ui.muted}>That's {MAX_DISHES} dishes, the most one meal holds.</Text>
      )}

      {/* From the Recipe Box (MENU-004) */}
      {!full ? (
        <>
          <SectionHeader title="From the Recipe Box" icon="recipe" />
          {recipes.length ? (
            <>
              <View style={[ui.input, ui.row, { paddingVertical: 0 }]}>
                <Icon name="search" size={16} color={colors.muted} />
                <TextInput
                  style={{ flex: 1, paddingVertical: 13, fontSize: 16, color: colors.text }}
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search recipes"
                  placeholderTextColor={colors.muted}
                  returnKeyType="search"
                  clearButtonMode="while-editing"
                  accessibilityLabel="Search recipes"
                />
              </View>
              {found.length ? (
                <View style={[ui.card, { gap: 10 }]}>
                  {found.map((r) => (
                    <Tap
                      key={r.id}
                      onPress={() => plan({ kind: "dish", title: r.title, recipe_id: r.id })}
                      style={[ui.row, { gap: 12 }]}
                      accessibilityRole="button"
                      accessibilityLabel={`Have ${r.title}`}
                    >
                      <RecipeThumb imageUrl={r.image_url} sourceUrl={r.source_url} size={40} />
                      <View style={{ flex: 1 }}>
                        <Text style={[ui.cardTitle, { fontSize: 15 }]} numberOfLines={1}>
                          {r.title}
                        </Text>
                        {"ownerName" in r ? <Text style={ui.muted}>From {(r as { ownerName: string }).ownerName}'s box</Text> : null}
                      </View>
                      <Icon name="add" size={16} color={colors.bark} />
                    </Tap>
                  ))}
                </View>
              ) : (
                <Text style={ui.muted}>No recipe has “{query.trim()}” in it.</Text>
              )}
            </>
          ) : (
            <Text style={ui.muted}>Recipes you or your family save in the Recipe Box show up here.</Text>
          )}
        </>
      ) : null}

      {/* Going out, or On your own (MENU-003) */}
      <SectionHeader title="Or" icon="sparkles" />
      <View style={[ui.card, { gap: 10 }]}>
        <View style={[ui.row, { gap: 12 }]}>
          <IconBadge name="place" size={36} />
          <View style={{ flex: 1 }}>
            <Text style={ui.cardTitle}>Going out</Text>
            <Text style={ui.muted}>A restaurant, takeout, or dinner at Grandma's</Text>
          </View>
        </View>
        <View style={[ui.row, { gap: 10 }]}>
          <TextInput
            style={[ui.input, { flex: 1 }]}
            value={where}
            onChangeText={setWhere}
            placeholder="Where? (if you know)"
            placeholderTextColor={colors.muted}
            maxLength={80}
            accessibilityLabel="Where are you going?"
          />
          <Button title="Going out" variant="secondary" onPress={() => plan({ kind: "out", title: where })} style={{ paddingHorizontal: 14 }} />
        </View>
      </View>
      <Tap onPress={() => plan({ kind: "own", title: "" })} style={[ui.card, ui.row, { gap: 12 }]} accessibilityRole="button" disabled={kind === "own"}>
        <IconBadge name="person" size={36} />
        <View style={{ flex: 1 }}>
          <Text style={ui.cardTitle}>On your own</Text>
          <Text style={ui.muted}>Everyone sorts out their own this time</Text>
        </View>
        {kind === "own" ? <Icon name="check" size={16} color={colors.bark} /> : <Icon name="chevron" size={14} color={colors.muted} />}
      </Tap>
    </NookScroll>
  );
}

function RemoveButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Tap onPress={onPress} hitSlop={10} style={[styles.remove, { backgroundColor: colors.barkSoft }]} accessibilityRole="button" accessibilityLabel={label}>
      <Icon name="close" size={13} color={colors.bark} />
    </Tap>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    title: { fontSize: 24, fontWeight: "800", color: colors.text, letterSpacing: -0.3 },
    remove: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  })
);
