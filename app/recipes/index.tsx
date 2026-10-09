import { Stack, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";
import { Text, TextInput } from "../../components/text";

import { Icon } from "../../components/icon";
import { LoadingScreen } from "../../components/motion";
import { NookHero } from "../../components/nook-hero";
import { NookScroll } from "../../components/nook-scroll";
import { RecipeThumb } from "../../components/recipe-thumb";
import { Button, Chip, EmptyState, HeaderIcon, NavCard, SectionHeader } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { tap } from "../../lib/feedback";
import { findNook } from "../../lib/nooks";
import { localDay } from "../../lib/pets";
import { formatMinutes, madeWords, recipeOfTheDay, searchRecipes, shelvesIn, type Recipe } from "../../lib/recipes";
import { useRecipeBox, type FamilyRecipe } from "../../lib/recipes-data";
import { colors, ui } from "../../lib/theme";

// Recipe Box home (REC-001/002/006): your recipes on their Shelves, or
// family's from your Burrows, with search across names and ingredients.
export default function RecipeBoxHome() {
  const router = useRouter();
  const { session } = useAuth();
  const { box, error, isLoading, reload } = useRecipeBox(session?.user.id);
  const nook = findNook("recipes")!;

  const [whose, setWhose] = useState<"mine" | "family">("mine");
  const [shelf, setShelf] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const source: (Recipe | FamilyRecipe)[] = whose === "mine" ? box?.mine ?? [] : box?.family ?? [];
  const shelves = useMemo(() => shelvesIn(source), [source]);
  const shown = useMemo(
    () => searchRecipes(shelf ? source.filter((r) => r.shelves.includes(shelf)) : source, query),
    [source, shelf, query]
  );

  if (isLoading) return <LoadingScreen cards={3} />;

  const mine = box?.mine ?? [];
  const family = box?.family ?? [];
  const today = recipeOfTheDay(mine, localDay());
  const lastMade = [...mine].filter((r) => r.last_made_at).sort((a, b) => b.last_made_at!.localeCompare(a.last_made_at!))[0];

  function pickWhose(next: "mine" | "family") {
    tap();
    setWhose(next);
    setShelf(null);
  }

  return (
    <NookScroll onRefresh={reload}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <HeaderIcon icon="settings" label="Recipe Box settings" onPress={() => router.push("/recipes/settings")} />
          ),
        }}
      />
      {error ? <Text style={ui.error}>{error}</Text> : null}

      <NookHero
        icon="recipe"
        accent={nook.iconColor}
        tint={nook.color}
        headline={today ? `Tonight? ${today.title}` : "Start your Recipe Box"}
        facts={[
          { icon: "recipe", text: mine.length ? `${mine.length} recipe${mine.length === 1 ? "" : "s"} in your box` : "Type one in or paste a link" },
          ...(lastMade ? [{ icon: "check" as const, text: `Last made: ${lastMade.title}` }] : []),
          ...(family.length ? [{ icon: "group" as const, text: `${family.length} from family` }] : []),
        ]}
      />

      <View style={ui.chips}>
        <Chip selected={whose === "mine"} icon="person" onPress={() => pickWhose("mine")}>
          Mine
        </Chip>
        <Chip selected={whose === "family"} icon="group" onPress={() => pickWhose("family")}>
          Family's
        </Chip>
      </View>

      <View style={[ui.input, ui.row, { paddingVertical: 0 }]}>
        <Icon name="search" size={16} color={colors.muted} />
        <TextInput
          style={{ flex: 1, paddingVertical: 13, fontSize: 16, color: colors.text }}
          value={query}
          onChangeText={setQuery}
          placeholder="Search names and ingredients"
          placeholderTextColor={colors.muted}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      {shelves.length ? (
        <View style={ui.chips}>
          <Chip selected={!shelf} onPress={() => setShelf(null)}>
            All
          </Chip>
          {shelves.map((name) => (
            <Chip
              key={name}
              selected={shelf === name}
              onPress={() => {
                tap();
                setShelf(shelf === name ? null : name);
              }}
            >
              {name}
            </Chip>
          ))}
        </View>
      ) : null}

      <SectionHeader title={whose === "mine" ? (shelf ?? "Your recipes") : shelf ? `Family's ${shelf}` : "From family"} icon="recipe" />
      {shown.length === 0 ? (
        query ? (
          <EmptyState icon="search" title="Nothing matches" body="Try another word, or look in the other box." />
        ) : whose === "mine" ? (
          <EmptyState icon="recipe" title="Your box is empty" body="Type in a family favorite, or paste a link from a recipe website." />
        ) : (
          <EmptyState
            icon="group"
            title="No family recipes yet"
            body="Recipes from people in your Burrows show up here, unless they've kept them just for themselves."
          />
        )
      ) : (
        shown.map((recipe, i) => {
          const time = formatMinutes((recipe.prep_minutes ?? 0) + (recipe.cook_minutes ?? 0));
          const owner = "ownerName" in recipe ? recipe.ownerName : null;
          const subtitle = [owner, time, recipe.private ? "Just me" : null, madeWords(recipe)].filter(Boolean).join(" · ");
          return (
            <NavCard
              key={recipe.id}
              index={i}
              icon="recipe"
              leading={<RecipeThumb imageUrl={recipe.image_url} />}
              title={recipe.title}
              subtitle={subtitle || undefined}
              onPress={() => router.push(`/recipes/${recipe.id}`)}
            />
          );
        })
      )}

      {whose === "mine" ? (
        <Button
          title="Add a recipe"
          icon="add"
          onPress={() => router.push({ pathname: "/recipes/form", params: shelf ? { shelf } : {} })}
        />
      ) : null}
    </NookScroll>
  );
}
