import { Image } from "expo-image";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Linking, View } from "react-native";
import { Text } from "../../components/text";

import { Icon } from "../../components/icon";
import { LoadingScreen, Tap } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { TikTokPlayer } from "../../components/tiktok-player";
import { Banner, Button, Chip, EmptyState, HeaderIcon, SectionHeader } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { friendlyError, guarded, tap } from "../../lib/feedback";
import { findNook } from "../../lib/nooks";
import { dishWarnings, tagLabel, type Person } from "../../lib/potluck";
import { formatMinutes, madeWords, scaleFactor, scaleIngredient, youWords } from "../../lib/recipes";
import { loadFamilyNeeds, loadRecipe, saveCopy, type FamilyRecipe } from "../../lib/recipes-data";
import { colors, ui } from "../../lib/theme";
import { tiktokVideoId } from "../../lib/tiktok";

const multipliers = [0.5, 1, 2, 3];

// One recipe (REC-003): scale it (REC-005), see who it's not safe for
// (REC-010), cook it (REC-004), or save family's into your own box (REC-002).
// A TikTok recipe plays its video right here (REC-014).
export default function RecipeScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;

  const [recipe, setRecipe] = useState<FamilyRecipe | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [servings, setServings] = useState<number | null>(null);
  const [times, setTimes] = useState(1);
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    () =>
      guarded(
        async () => {
          const loaded = await loadRecipe(id);
          setRecipe(loaded);
          setServings((current) => current ?? loaded?.servings ?? null);
          if (userId && loaded?.tags.length) setPeople(await loadFamilyNeeds(userId));
        },
        setError,
        () => setIsLoading(false)
      ),
    [id, userId]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (isLoading) return <LoadingScreen cards={3} />;
  if (!recipe) {
    return <EmptyState icon="recipe" title="This recipe isn't here" body={error ?? "It may have been deleted, or kept just for its owner."} />;
  }

  const mine = recipe.owner_id === userId;
  const videoId = recipe.source_url ? tiktokVideoId(recipe.source_url) : null;
  const factor = recipe.servings ? scaleFactor(recipe.servings, servings ?? recipe.servings) : times;
  const warnings = dishWarnings(recipe.tags, people).map(youWords);
  const time = [
    recipe.prep_minutes ? `Prep ${formatMinutes(recipe.prep_minutes)}` : null,
    recipe.cook_minutes ? `Cook ${formatMinutes(recipe.cook_minutes)}` : null,
  ].filter(Boolean);

  async function copyToMyBox() {
    setSaving(true);
    const { id: newId, error: copyError } = await saveCopy(recipe!);
    setSaving(false);
    if (copyError || !newId) return Alert.alert("Couldn't save it", friendlyError(copyError));
    tap("success");
    router.replace(`/recipes/${newId}`);
  }

  function cook() {
    router.push({ pathname: "/recipes/cook", params: { id: recipe!.id, factor: String(factor) } });
  }

  return (
    <NookScroll onRefresh={load}>
      <Stack.Screen
        options={{
          title: recipe.title,
          headerRight: mine
            ? () => <HeaderIcon icon="edit" label="Edit recipe" onPress={() => router.push({ pathname: "/recipes/form", params: { id: recipe.id } })} />
            : undefined,
        }}
      />

      {videoId ? (
        <TikTokPlayer videoId={videoId} url={recipe.source_url!} />
      ) : recipe.image_url ? (
        <View style={{ borderRadius: 22, overflow: "hidden", backgroundColor: findNook("recipes")!.color }}>
          <Image source={{ uri: recipe.image_url }} style={{ width: "100%", aspectRatio: 16 / 10 }} contentFit="cover" transition={200} />
        </View>
      ) : null}

      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 26, fontWeight: "800", color: colors.text, letterSpacing: -0.4 }}>{recipe.title}</Text>
        {!mine ? <Text style={ui.muted}>From {recipe.ownerName}'s box</Text> : null}
        {mine && recipe.from_name ? <Text style={ui.muted}>Saved from {recipe.from_name}</Text> : null}
        {time.length ? <Text style={ui.muted}>{time.join(" · ")}</Text> : null}
        {madeWords(recipe) ? <Text style={ui.muted}>{madeWords(recipe)}</Text> : null}
        {mine && recipe.private ? (
          <View style={[ui.row, { gap: 6 }]}>
            <Icon name="lock" size={13} color={colors.muted} />
            <Text style={ui.muted}>Just me: family can't see this one</Text>
          </View>
        ) : null}
        {recipe.shelves.length ? <Text style={ui.muted}>On {recipe.shelves.join(", ")}</Text> : null}
      </View>

      {warnings.length ? (
        <Banner icon="warning" tone="rose" title="Not for everyone" body={warnings.map((w) => `${w}.`).join("\n")} />
      ) : null}
      {recipe.tags.length ? (
        <Text style={ui.muted}>Has {recipe.tags.map((t) => tagLabel(t).toLowerCase()).join(", ")}</Text>
      ) : null}

      <View style={[ui.row, { gap: 10 }]}>
        <Button title="Start cooking" icon="play" onPress={cook} style={{ flex: 1 }} disabled={!recipe.steps.length && !recipe.ingredients.length && !videoId} />
        {!mine ? <Button title="Save to my box" icon="add" variant="secondary" onPress={copyToMyBox} loading={saving} style={{ flex: 1 }} /> : null}
      </View>

      <SectionHeader
        title="Ingredients"
        icon="food"
        right={
          recipe.servings ? (
            <View style={[ui.row, { gap: 10 }]}>
              <Stepper icon="minus" label="Fewer servings" onPress={() => setServings(Math.max(1, (servings ?? recipe.servings!) - 1))} />
              <Text style={[ui.cardTitle, { minWidth: 70, textAlign: "center" }]}>
                {servings ?? recipe.servings} serving{(servings ?? recipe.servings) === 1 ? "" : "s"}
              </Text>
              <Stepper icon="add" label="More servings" onPress={() => setServings(Math.min(100, (servings ?? recipe.servings!) + 1))} />
            </View>
          ) : null
        }
      />
      {!recipe.servings && recipe.ingredients.length ? (
        <View style={ui.chips}>
          {multipliers.map((m) => (
            <Chip key={m} selected={times === m} onPress={() => setTimes(m)}>
              {m === 0.5 ? "Half" : m === 1 ? "As written" : `${m}×`}
            </Chip>
          ))}
        </View>
      ) : null}
      {recipe.ingredients.length ? (
        <View style={[ui.card, { gap: 10 }]}>
          {recipe.ingredients.map((line, i) => (
            <View key={i} style={[ui.row, { alignItems: "flex-start", gap: 10 }]}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.bark, marginTop: 8 }} />
              <Text style={{ flex: 1, fontSize: 16, color: colors.text, lineHeight: 22 }}>{scaleIngredient(line, factor)}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={ui.muted}>No ingredients written down.</Text>
      )}

      <SectionHeader title="Steps" icon="todo" />
      {recipe.steps.length ? (
        recipe.steps.map((step, i) => (
          <View key={i} style={[ui.card, ui.row, { alignItems: "flex-start", gap: 12 }]}>
            <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: colors.barkSoft, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: colors.bark, fontWeight: "700" }}>{i + 1}</Text>
            </View>
            <Text style={{ flex: 1, fontSize: 16, color: colors.text, lineHeight: 23 }}>{step}</Text>
          </View>
        ))
      ) : (
        <Text style={ui.muted}>No steps written down.</Text>
      )}

      {recipe.notes ? (
        <>
          <SectionHeader title="Notes" icon="edit" />
          <View style={ui.card}>
            <Text style={{ fontSize: 15, color: colors.text, lineHeight: 22 }}>{recipe.notes}</Text>
          </View>
        </>
      ) : null}

      {recipe.source_url && !videoId ? (
        <Tap onPress={() => Linking.openURL(recipe.source_url!).catch(() => {})} style={[ui.row, { gap: 6, alignSelf: "flex-start" }]}>
          <Icon name="link" size={15} />
          <Text style={ui.link} numberOfLines={1}>
            {hostOf(recipe.source_url)}
          </Text>
        </Tap>
      ) : null}
    </NookScroll>
  );
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function Stepper({ icon, label, onPress }: { icon: "minus" | "add"; label: string; onPress: () => void }) {
  return (
    <Tap
      onPress={() => {
        tap();
        onPress();
      }}
      accessibilityLabel={label}
      accessibilityRole="button"
      style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.barkSoft, alignItems: "center", justifyContent: "center" }}
    >
      <Icon name={icon} size={16} />
    </Tap>
  );
}
