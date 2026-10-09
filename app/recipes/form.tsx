import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useLeaveGuard } from "../../components/leave-guard";
import { useEffect, useState } from "react";
import { Alert, Switch, View } from "react-native";
import { Text, TextInput } from "../../components/text";

import { LoadingScreen } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { RecipePageReader } from "../../components/recipe-page-reader";
import { RecipeThumb } from "../../components/recipe-thumb";
import { Banner, Button, Chip } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { friendlyError, tap } from "../../lib/feedback";
import { normalizeUrl } from "../../lib/gift-nook";
import { recipeSettingDefaults, useNookSettings } from "../../lib/nook-settings";
import { allergens, otherContents } from "../../lib/potluck";
import { cleanShelf, fetchRecipe, MAX_SHELVES, parseRecipePage, shelfIdeas, shelvesIn, toLines, type ImportedRecipe } from "../../lib/recipes";
import { deleteRecipe, loadRecipe, loadRecipeBox, saveRecipe } from "../../lib/recipes-data";
import { fetchTikTok, isTikTok, parseCaption } from "../../lib/tiktok";
import { colors, ui } from "../../lib/theme";

// Add or change a recipe (REC-003/007), or fill one in from a website link
// (REC-008) or a TikTok's caption (REC-013).
//   ?id=…      edit your recipe
//   ?shelf=…   start a new one on that Shelf
export default function RecipeForm() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; shelf?: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;
  const { settings } = useNookSettings("recipes", recipeSettingDefaults);
  const editing = Boolean(params.id);

  const [isLoading, setIsLoading] = useState(true);
  const [link, setLink] = useState("");
  const [fetching, setFetching] = useState(false);
  const [fetchNote, setFetchNote] = useState<string | null>(null);
  // Set while the hidden browser tries a page that refused the quick download.
  const [readerUrl, setReaderUrl] = useState<string | null>(null);
  // What the quick download found (a name and picture, but no recipe), kept
  // in case the hidden browser finds nothing better.
  const [thinFind, setThinFind] = useState<ImportedRecipe | null>(null);
  const [title, setTitle] = useState("");
  const [servings, setServings] = useState("");
  const [prep, setPrep] = useState("");
  const [cookTime, setCookTime] = useState("");
  const [ingredients, setIngredients] = useState("");
  const [steps, setSteps] = useState("");
  const [notes, setNotes] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [shelves, setShelves] = useState<string[]>(params.shelf ? [params.shelf] : []);
  const [knownShelves, setKnownShelves] = useState<string[]>([]);
  const [newShelf, setNewShelf] = useState("");
  const [isPrivate, setIsPrivate] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  // Leaving with unsaved changes asks first (CORE-075).
  const { allowLeave } = useLeaveGuard({ title, servings, prep, cookTime, ingredients, steps, notes, imageUrl, tags, shelves, isPrivate }, !isLoading);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const box = await loadRecipeBox(userId);
        setKnownShelves(shelvesIn(box.mine));
        if (params.id) {
          const recipe = await loadRecipe(params.id);
          if (recipe) {
            setLink(recipe.source_url ?? "");
            setTitle(recipe.title);
            setServings(recipe.servings ? String(recipe.servings) : "");
            setPrep(recipe.prep_minutes ? String(recipe.prep_minutes) : "");
            setCookTime(recipe.cook_minutes ? String(recipe.cook_minutes) : "");
            setIngredients(recipe.ingredients.join("\n"));
            setSteps(recipe.steps.join("\n"));
            setNotes(recipe.notes ?? "");
            setImageUrl(recipe.image_url);
            setTags(recipe.tags);
            setShelves(recipe.shelves);
            setIsPrivate(recipe.private);
          }
        }
      } catch (error) {
        Alert.alert("Couldn't load your recipes", (error as Error).message);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [params.id, userId]);

  if (isLoading) return <LoadingScreen cards={2} />;

  const privateNow = isPrivate ?? settings.newPrivate;

  async function fillFromLink() {
    const url = normalizeUrl(link.trim());
    if (!url) return Alert.alert("Paste a link first", "Copy the address of a recipe page or a TikTok and paste it here.");
    setFetching(true);
    setFetchNote(null);
    setLink(url);
    if (isTikTok(url)) return fillFromTikTok(url);
    const { recipe: found, blocked } = await fetchRecipe(url);
    if (found && (found.ingredients.length || found.steps.length)) return applyFound(found);
    // Turned away, or the page came without its recipe (some sites only add
    // it in a real browser): try a hidden one before giving up.
    setThinFind(found);
    setFetchNote(blocked ? "This site is checking we're a real browser. Hang on a moment…" : "Looking a little harder…");
    setReaderUrl(url);
  }

  // REC-013: the name and any ingredients come from the caption; the whole
  // caption goes in the notes. The video's thumbnail is looked up fresh when
  // shown, so no picture is saved.
  async function fillFromTikTok(url: string) {
    const info = await fetchTikTok(url);
    setFetching(false);
    if (!info) {
      setFetchNote("We couldn't find that TikTok. Check the link is to one video (Share → Copy link) and try again.");
      return;
    }
    tap("success");
    setLink(info.url);
    setImageUrl(null);
    const caption = parseCaption(info.caption);
    if (caption.title && !title.trim()) setTitle(caption.title);
    if (caption.ingredients.length && !ingredients.trim()) setIngredients(caption.ingredients.join("\n"));
    if (caption.notes && !notes.trim()) {
      setNotes([caption.notes, info.author ? `From ${info.author} on TikTok` : null].filter(Boolean).join("\n\n"));
    }
    setFetchNote(
      caption.ingredients.length
        ? "Filled in from the TikTok's caption. Check it over and add the steps from the video."
        : "Saved the TikTok. Its caption didn't list ingredients, so add what you can see in the video."
    );
  }

  function readerDone(page: { url: string; html: string } | null) {
    const url = readerUrl;
    setReaderUrl(null);
    const found = page && url ? parseRecipePage(page.html, page.url || url) : null;
    if (__DEV__) console.log("[recipe import] hidden browser", page ? `${page.html.length} chars from ${page.url}` : "gave up", found ? `${found.ingredients.length} ingredients` : "no recipe");
    if (found && (found.ingredients.length || found.steps.length)) return applyFound(found);
    if (found ?? thinFind) return applyFound((found ?? thinFind)!);
    setFetching(false);
    setFetchNote("That site wouldn't let us in. You can still type the recipe in below, or copy it from the page.");
  }

  function applyFound(found: ImportedRecipe) {
    setFetching(false);
    tap("success");
    if (found.title) setTitle(found.title);
    if (found.servings) setServings(String(found.servings));
    if (found.prep_minutes) setPrep(String(found.prep_minutes));
    if (found.cook_minutes) setCookTime(String(found.cook_minutes));
    if (found.ingredients.length) setIngredients(found.ingredients.join("\n"));
    if (found.steps.length) setSteps(found.steps.join("\n"));
    if (found.image_url) setImageUrl(found.image_url);
    setFetchNote(
      found.ingredients.length || found.steps.length
        ? "Filled in from the page. Check it over, then tag what's in it."
        : "That page didn't share its recipe, so only the name and picture came in. Type the rest below."
    );
  }

  function toggleTag(key: string) {
    tap();
    setTags((current) => (current.includes(key) ? current.filter((t) => t !== key) : [...current, key]));
  }

  function toggleShelf(name: string) {
    tap();
    setShelves((current) => {
      if (current.includes(name)) return current.filter((s) => s !== name);
      if (current.length >= MAX_SHELVES) {
        Alert.alert("That's a lot of Shelves", `A recipe can sit on up to ${MAX_SHELVES}.`);
        return current;
      }
      return [...current, name];
    });
  }

  function addShelf() {
    const name = cleanShelf(newShelf);
    if (!name) return;
    if (!shelves.includes(name)) toggleShelf(name);
    if (!knownShelves.includes(name)) setKnownShelves((k) => [...k, name]);
    setNewShelf("");
  }

  const minutes = (text: string) => {
    const n = parseInt(text, 10);
    return Number.isFinite(n) && n > 0 ? Math.min(n, 2880) : null;
  };

  async function save() {
    if (!title.trim()) return Alert.alert("What's it called?", "Give your recipe a name.");
    setSaving(true);
    const count = parseInt(servings, 10);
    const { id, error } = await saveRecipe(
      {
        title: title.trim().slice(0, 120),
        servings: Number.isFinite(count) && count > 0 ? Math.min(count, 100) : null,
        prep_minutes: minutes(prep),
        cook_minutes: minutes(cookTime),
        ingredients: toLines(ingredients, 100),
        steps: toLines(steps, 60),
        notes: notes.trim() || null,
        source_url: link.trim() ? normalizeUrl(link.trim()) : null,
        image_url: isTikTok(link) ? null : imageUrl,
        tags,
        shelves,
        private: privateNow,
      },
      params.id
    );
    setSaving(false);
    if (error) return Alert.alert("Couldn't save the recipe", friendlyError(error));
    tap("success");
    allowLeave();
    if (editing) router.back();
    else router.replace(`/recipes/${id}`);
  }

  function confirmDelete() {
    Alert.alert(`Delete ${title || "this recipe"}?`, "It's gone from your box. Copies family saved stay in their boxes.", [
      { text: "Keep it", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const { error } = await deleteRecipe(params.id!);
          if (error) return Alert.alert("Couldn't delete it", friendlyError(error));
          allowLeave();
          router.dismissTo("/recipes");
        },
      },
    ]);
  }

  const shelfChoices = [...new Set([...knownShelves, ...shelves, ...shelfIdeas])];

  return (
    <NookScroll>
      <Stack.Screen options={{ title: editing ? "Edit recipe" : "New recipe" }} />
      {readerUrl ? <RecipePageReader url={readerUrl} onDone={readerDone} /> : null}

      <Text style={ui.label}>From a website (optional)</Text>
      <View style={[ui.row, { gap: 8 }]}>
        <TextInput
          style={[ui.input, { flex: 1 }]}
          value={link}
          onChangeText={setLink}
          placeholder="Paste a recipe link"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          onSubmitEditing={fillFromLink}
        />
        <Button title="Fill in" icon="sparkles" variant="secondary" onPress={fillFromLink} loading={fetching} />
      </View>
      <Text style={ui.muted}>A recipe website, or a TikTok video: in TikTok tap Share, then Copy link.</Text>
      {fetchNote ? <Banner icon="sparkles" tone="sky" body={fetchNote} /> : null}

      <View style={[ui.row, { gap: 12 }]}>
        {imageUrl || isTikTok(link) ? <RecipeThumb imageUrl={imageUrl} sourceUrl={isTikTok(link) ? link : null} size={56} /> : null}
        <View style={{ flex: 1, gap: 14 }}>
          <Text style={ui.label}>Name</Text>
          <TextInput
            style={ui.input}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Grandma's chili"
            placeholderTextColor={colors.muted}
            maxLength={120}
          />
        </View>
      </View>
      {imageUrl ? (
        <Text style={[ui.link, { fontSize: 14 }]} onPress={() => setImageUrl(null)}>
          Remove the picture
        </Text>
      ) : null}

      <View style={[ui.row, { gap: 10 }]}>
        {(
          [
            ["Serves", servings, setServings, "4"],
            ["Prep (min)", prep, setPrep, "15"],
            ["Cook (min)", cookTime, setCookTime, "45"],
          ] as const
        ).map(([label, value, set, placeholder]) => (
          <View key={label} style={{ flex: 1, gap: 14 }}>
            <Text style={ui.label}>{label}</Text>
            <TextInput
              style={ui.input}
              value={value}
              onChangeText={(text) => set(text.replace(/[^0-9]/g, ""))}
              placeholder={placeholder}
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
              maxLength={4}
            />
          </View>
        ))}
      </View>

      <Text style={ui.label}>Ingredients</Text>
      <Text style={ui.muted}>One per line, amount first, like "1 1/2 cups flour", so it can scale.</Text>
      <TextInput
        style={[ui.input, { minHeight: 130, textAlignVertical: "top" }]}
        value={ingredients}
        onChangeText={setIngredients}
        placeholder={"2 cups flour\n1 tsp salt\n3 eggs"}
        placeholderTextColor={colors.muted}
        multiline
      />

      <Text style={ui.label}>Steps</Text>
      <Text style={ui.muted}>One per line. Times like "bake 25 minutes" get a timer in cook mode.</Text>
      <TextInput
        style={[ui.input, { minHeight: 150, textAlignVertical: "top" }]}
        value={steps}
        onChangeText={setSteps}
        placeholder={"Heat the oven to 350°F.\nMix everything together.\nBake 25 minutes."}
        placeholderTextColor={colors.muted}
        multiline
      />

      <Text style={ui.label}>Shelves</Text>
      <View style={ui.chips}>
        {shelfChoices.map((name) => (
          <Chip key={name} selected={shelves.includes(name)} onPress={() => toggleShelf(name)}>
            {name}
          </Chip>
        ))}
      </View>
      <View style={[ui.row, { gap: 8 }]}>
        <TextInput
          style={[ui.input, { flex: 1 }]}
          value={newShelf}
          onChangeText={setNewShelf}
          placeholder="A new Shelf"
          placeholderTextColor={colors.muted}
          maxLength={24}
          onSubmitEditing={addShelf}
          returnKeyType="done"
        />
        <Button title="Add" icon="add" variant="secondary" onPress={addShelf} />
      </View>

      <Text style={ui.label}>What's in it?</Text>
      <Text style={ui.muted}>Tag anything family might need to know. Nook warns about allergies and diets from these, never from guessing.</Text>
      <View style={ui.chips}>
        {[...allergens, ...otherContents].map((tag) => (
          <Chip key={tag.key} selected={tags.includes(tag.key)} onPress={() => toggleTag(tag.key)}>
            {tag.label}
          </Chip>
        ))}
      </View>

      <Text style={ui.label}>Notes (optional)</Text>
      <TextInput
        style={[ui.input, { minHeight: 80, textAlignVertical: "top" }]}
        value={notes}
        onChangeText={setNotes}
        placeholder="e.g. Double the garlic. Freezes well."
        placeholderTextColor={colors.muted}
        maxLength={2000}
        multiline
      />

      <View style={[ui.card, ui.row, { gap: 12 }]}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={ui.cardTitle}>Just me</Text>
          <Text style={ui.muted}>Keep this one out of family's view. Otherwise everyone in your Burrows can see it.</Text>
        </View>
        <Switch
          value={privateNow}
          onValueChange={(value) => {
            tap();
            setIsPrivate(value);
          }}
          trackColor={{ true: colors.bark }}
        />
      </View>

      <Button title={editing ? "Save" : "Add to my box"} icon="check" onPress={save} loading={saving} />
      {editing ? <Button title="Delete recipe" icon="trash" variant="danger" onPress={confirmDelete} /> : null}
    </NookScroll>
  );
}
