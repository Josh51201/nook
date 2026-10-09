import { Image } from "expo-image";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Switch, useWindowDimensions, View } from "react-native";
import { Text, TextInput } from "../../components/text";
import Animated, { FadeIn, LinearTransition } from "react-native-reanimated";

import { ColorPicker } from "../../components/hearth/color-picker";
import { SeasonPicker } from "../../components/hearth/season-picker";
import { TagsEditor } from "../../components/hearth/tag-bar";
import { allTags } from "../../lib/hearth-tags";
import { GRID_GAP } from "../../components/hearth/hearth-grid";
import { IconPicker } from "../../components/hearth/icon-picker";
import { PlacePicker } from "../../components/hearth/place-picker";
import { ItemPreview } from "../../components/hearth/item-preview";
import { WidgetView } from "../../components/hearth/widgets";
import { Icon } from "../../components/icon";
import { LoadingScreen, Tap } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { useLeaveGuard } from "../../components/leave-guard";
import { Collapsible } from "../../components/collapsible";
import { DateField } from "../../components/date-field";
import { Banner, Button, Chip, EmptyState } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { useHearthView } from "../../lib/hearth-view";
import { fullMessage, overflowing } from "../../lib/hearth-limits";
import { homePhotoFolder } from "../../lib/home-hearth";
import { bedStyles, critterForSpecies, critterInfo, critters } from "../../lib/hearth-pet";
import { usePets } from "../../lib/pets-data";
import { cornerChoices, liftChoices } from "../../lib/decor";
import { tap } from "../../lib/feedback";
import { conditions, windowFrames, type Place, type Unit } from "../../lib/weather";
import { launchTargets, MAX_LAUNCH_TARGETS, MAX_OWN_QUOTES, parseQuotes, showInWords } from "../../lib/widget-extras";
import { lookSummary, sizeSummary, tagsSummary } from "../../lib/summaries";
import { pickAndUploadPhoto, removeUnusedPhotos, usePhotoUrls } from "../../lib/hearth-photos";
import { formatDate, gatheringKinds, type GatheringKind } from "../../lib/gift-nook";
import {
  COLUMNS,
  copyItem,
  hearthThemes,
  hollowsOf,
  inScope,
  locate,
  moveToScope,
  removeItem,
  resizeItem,
  sizePresets,
  updateItem,
  type Scope,
  type WidgetItem,
} from "../../lib/hearth";
import { cancelReminders, syncReminders } from "../../lib/reminders";
import { shelvesIn } from "../../lib/recipes";
import { rangeWords } from "../../lib/getaways";
import { localDay } from "../../lib/pets";
import { supabase } from "../../lib/supabase";
import { colors, themed, ui, useTheme } from "../../lib/theme";
import {
  describeSchedule,
  frameStyles,
  frameTimings,
  gatheringWhenOver,
  MAX_FRAME_PHOTOS,
  newReminderId,
  widgetKindInfo,
  type Reminder,
  type ReminderSchedule,
  widgetKinds,
  type WidgetConfig,
  type WidgetKind,
  type WidgetLook,
  type WidgetOf,
} from "../../lib/widgets";
import { addToStack, MAX_STACK, stackMates, unstack } from "../../lib/hearth-stacks";
import { requestMove } from "../../lib/move-request";

// Customize one Hearth widget (CORE-018): what it shows and how it looks,
// with a live preview at its real size. Nothing is saved until "Save".
export default function WidgetEditor() {
  const router = useRouter();
  const { id, copied, stacked } = useLocalSearchParams<{ id: string; copied?: string; stacked?: string }>();
  // The widget may be on the page shared with your Home (CORE-054).
  const { layout, save, isLoading, onHome, home: homeHearth } = useHearthView();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  // Hooks first: the screen returns early below while it loads.
  const { key: themeKey } = useTheme();
  // The widget may live on the Hearth or inside a Hollow (CORE-022).
  const found = locate(layout, id);
  const original = found?.item.kind === "widget" ? (found.item as WidgetItem) : undefined;
  const home: Scope = found?.scope ?? null;
  const [livesIn, setLivesIn] = useState<Scope | undefined>(undefined);

  const [draft, setDraft] = useState<WidgetItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // Leaving with unsaved changes asks first (CORE-075).
  const { allowLeave } = useLeaveGuard({ draft, livesIn }, Boolean(draft));

  useEffect(() => {
    if (original && !draft) setDraft(original);
  }, [original, draft]);

  if (isLoading || (original && !draft)) return <LoadingScreen />;
  if (!original || !draft) {
    return <EmptyState icon="widgets" title="That widget is gone" body="It may have been removed from your Hearth." />;
  }

  const widget = draft.widget;
  const info = widgetKindInfo(widget.kind);
  // On the page shared with your Home (CORE-054), not inside a Hollow.
  const sharedPage = onHome && home === null;
  const hereName = sharedPage ? homeHearth.name : "The Hearth";
  const theme = hearthThemes[themeKey] ?? hearthThemes.hearth;
  const stride = (screenWidth - 40 - GRID_GAP * (COLUMNS - 1)) / COLUMNS + GRID_GAP;

  function setWidget(changes: Partial<WidgetConfig>) {
    setDraft((prev) => (prev ? { ...prev, widget: { ...prev.widget, ...changes } as WidgetConfig } : prev));
  }
  function setSettings<K extends WidgetConfig["kind"]>(changes: Partial<WidgetOf<K>["settings"]>) {
    setDraft((prev) =>
      prev
        ? { ...prev, widget: { ...prev.widget, settings: { ...prev.widget.settings, ...changes } } as WidgetConfig }
        : prev
    );
  }

  // Saves, then (with `copyTo`) makes a copy there and opens it (CORE-039).
  // `stackWith` puts a new widget of that kind in this one's stack and opens
  // it; "out" takes this one out of its stack (CORE-050).
  // `thenMove` goes back to the Hearth ready to move it with the arrows (CORE-076).
  async function saveWidget(copyTo?: Scope, stackWith?: WidgetKind | "out", thenMove = false) {
    if (!draft || !original || isSaving) return;
    setIsSaving(true);
    try {
      let next = draft.widget;
      // Phone reminders need scheduling first (this may ask permission), so
      // their notification ids can be saved with the widget.
      if (next.kind === "reminders" && original.widget.kind === "reminders") {
        const synced = await syncReminders(next.title, next.settings.items, original.widget.settings.items);
        next = { ...next, settings: { ...next.settings, items: synced } };
      }
      let items = inScope(layout, home, (inner) =>
        updateItem(inner, draft.id, {
          widget: next,
          color: draft.color,
          icon: draft.icon,
          corners: draft.corners,
          lift: draft.lift,
          border: draft.border,
          showIn: draft.showIn,
          locked: draft.locked,
          tags: draft.tags,
        } as Partial<WidgetItem>)
      );
      if (draft.w !== original.w || draft.h !== original.h) {
        items = inScope({ ...layout, items }, home, (inner) => resizeItem(inner, draft.id, draft.w, draft.h));
      }
      // Moving it to the Hearth or another Hollow.
      if (livesIn !== undefined && livesIn !== home) {
        items = moveToScope({ ...layout, items }, draft.id, livesIn);
      }
      let copyId: string | null = null;
      if (copyTo !== undefined) ({ items, copyId } = copyItem({ ...layout, items }, draft.id, copyTo));
      let stackedId: string | null = null;
      if (stackWith === "out") items = unstack({ items }, draft.id);
      else if (stackWith) {
        const joined = addToStack({ items }, draft.id, stackWith);
        if (joined) ({ items, id: stackedId } = joined);
      }
      // A page or Hollow only holds so much (CORE-066).
      const full = overflowing(layout, { ...layout, items });
      if (full) {
        const message = fullMessage(full);
        setIsSaving(false);
        Alert.alert(message.title, message.body);
        return;
      }
      // Your Hearth updates instantly; the cloud save finishes in the
      // background, so closing never waits on the network.
      const pending = save({ items });
      // Photos taken out of a frame are deleted once nothing else shows them.
      if (next.kind === "frame" && original.widget.kind === "frame") {
        const removed = original.widget.settings.photos.filter((path) => !(next as WidgetOf<"frame">).settings.photos.includes(path));
        if (removed.length) pending.then(() => removeUnusedPhotos(removed, { ...layout, items })).catch(() => {});
      }
      tap("success");
      allowLeave();
      if (stackedId) router.replace({ pathname: "/widget/[id]", params: { id: stackedId, stacked: "1" } });
      else if (copyId) router.replace({ pathname: "/widget/[id]", params: { id: copyId, copied: "1" } });
      else {
        if (thenMove) requestMove(draft.id);
        router.back();
      }
      pending.catch((error: Error) => Alert.alert("Couldn't save your widget", error.message));
    } catch (error) {
      setIsSaving(false);
      Alert.alert("Couldn't save", (error as Error).message);
    }
  }

  function confirmRemove() {
    if (original?.locked) {
      Alert.alert("It's locked", "Unlock it first (Lock in place, further up) to remove it.");
      return;
    }
    Alert.alert("Remove this widget?", undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          if (original?.widget.kind === "reminders") cancelReminders(original.widget.settings.items);
          const pending = save({ items: inScope(layout, home, (inner) => removeItem(inner, id)) });
          allowLeave();
          router.back();
          pending.catch((error: Error) => Alert.alert("Couldn't remove it", error.message));
        },
      },
    ]);
  }

  // What's chosen, for the closed sections (CORE-074).
  const looksSummary = lookSummary({ look: widget.look, corners: draft.corners, lift: draft.lift, border: draft.border });
  const whereId = livesIn ?? home;
  const whereName = whereId ? hollowsOf(layout).find((h) => h.id === whereId)?.name ?? "A Hollow" : "The Hearth";
  const placeSummary = [sizeSummary(sizePresets.widget, draft.w, draft.h, draft.locked), hollowsOf(layout).length ? whereName : null]
    .filter(Boolean)
    .join(" · ");
  const copySummary = original.stack
    ? `In a stack of ${stackMates(layout.items, original).length}`
    : "Copy it, or stack more widgets in its spot";

  // Live preview, at the size it'll be on your Hearth, kept at the top while
  // you scroll through the settings (CORE-079). A tall one is shrunk to fit.
  const preview = (
    <ItemPreview
      width={draft.w * stride - GRID_GAP}
      height={draft.h * stride - GRID_GAP}
      maxHeight={screenHeight * 0.3}
      background={theme.background}
      interactive
    >
      <WidgetView
        widget={widget}
        color={draft.color}
        icon={draft.icon}
        width={draft.w * stride - GRID_GAP}
        height={draft.h * stride - GRID_GAP}
        refreshKey={0}
        themeText={theme.text}
        corners={draft.corners}
        border={draft.border}
        onHomePage={sharedPage}
        onChange={(changed) => setWidget(changed)}
      />
    </ItemPreview>
  );

  return (
    <NookScroll pinned={preview}>
      <Stack.Screen
        options={{
          title: info.label,
          headerRight: () => (
            <Tap onPress={() => saveWidget()} disabled={isSaving} hitSlop={10}>
              <Text style={{ color: colors.bark, fontSize: 17, fontWeight: "700" }}>Save</Text>
            </Tap>
          ),
        }}
      />

      {copied ? (
        <Banner
          icon="copy"
          tone="sky"
          title="Copied!"
          body={`You're now changing the copy${home ? ` in “${hollowsOf(layout).find((h) => h.id === home)?.name ?? "a Hollow"}”` : " on your Hearth"}. The original stays as it was.`}
        />
      ) : null}

      {stacked ? (
        <Banner
          icon="widgets"
          tone="sky"
          title="Added to the stack"
          body="This widget now shares a spot with the one you came from. Swipe on the Hearth to flip between them."
        />
      ) : null}


      <Collapsible id="widget-shows" icon={info.icon} title="What it shows" defaultOpen>
        <KindSettings
          widget={widget}
          setSettings={setSettings}
          setWidget={setWidget}
          photoFolder={sharedPage && homeHearth.homeId ? homePhotoFolder(homeHearth.homeId) : undefined}
          onHomePage={sharedPage}
          homeName={homeHearth.name}
        />
      </Collapsible>

      <Collapsible id="widget-looks" icon="palette" title="How it looks" summary={looksSummary}>
        <Text style={ui.label}>Title</Text>
        <View style={[ui.row, { gap: 10 }]}>
          <TextInput
            style={[ui.input, { flex: 1 }]}
            value={widget.title}
            onChangeText={(title) => setWidget({ title })}
            placeholder={info.label}
            placeholderTextColor={colors.muted}
          />
          <Switch value={widget.showTitle} onValueChange={(showTitle) => setWidget({ showTitle })} trackColor={{ true: colors.bark }} />
        </View>

        <Text style={ui.label}>Style</Text>
        <View style={ui.chips}>
          {(
            [
              ["soft", "Soft"],
              ["bold", "Bold"],
              ["outline", "Outline"],
            ] as [WidgetLook, string][]
          ).map(([look, label]) => (
            <Chip key={look} selected={widget.look === look} onPress={() => setWidget({ look })}>
              {label}
            </Chip>
          ))}
        </View>
        {widget.kind === "companion" ? <Text style={ui.muted}>Outline leaves out the card, so the bed sits right on your Hearth. The title switch shows or hides the pet's name.</Text> : null}
        {widget.kind === "fridge" ? <Text style={ui.muted}>Soft is a pastel fridge in the color below, Bold a deep one, and Outline leaves just the notes on your Hearth. The title is printed on a label-maker strip.</Text> : null}

        {widget.kind === "frame" || widget.kind === "window" ? null : (
          <>
            <Text style={ui.label}>Color</Text>
            <ColorPicker value={draft.color} onChange={(color) => setDraft({ ...draft, color })} />
          </>
        )}

        <Text style={ui.label}>Corners</Text>
        <View style={ui.chips}>
          {cornerChoices.map((c) => (
            <Chip key={c.key} selected={(draft.corners ?? "soft") === c.key} onPress={() => setDraft({ ...draft, corners: c.key })}>
              {c.label}
            </Chip>
          ))}
        </View>
        <Text style={ui.label}>Shadow</Text>
        <View style={ui.chips}>
          {liftChoices.map((c) => (
            <Chip key={c.key} selected={(draft.lift ?? "soft") === c.key} onPress={() => setDraft({ ...draft, lift: c.key })}>
              {c.label}
            </Chip>
          ))}
        </View>
        {widget.kind === "frame" || widget.kind === "window" ? null : (
          <>
            <Text style={ui.label}>Border</Text>
            <View style={ui.chips}>
              <Chip selected={!draft.border} onPress={() => setDraft({ ...draft, border: false })}>
                None
              </Chip>
              <Chip selected={Boolean(draft.border)} onPress={() => setDraft({ ...draft, border: true })}>
                Outlined
              </Chip>
            </View>
          </>
        )}

        <Text style={ui.label}>Icon</Text>
        <IconPicker value={draft.icon} fallback={info.icon} onChange={(icon) => setDraft({ ...draft, icon })} />
      </Collapsible>

      <Collapsible id="widget-size" icon="resize" title="Size & place" summary={placeSummary}>
        <Text style={ui.label}>Size</Text>
        <View style={ui.chips}>
          {sizePresets.widget
            .filter((preset) => preset.w >= info.minSize.w && preset.h >= info.minSize.h)
            .map((preset) => (
              <Chip
                key={preset.label}
                selected={draft.w === preset.w && draft.h === preset.h}
                onPress={() => setDraft({ ...draft, w: preset.w, h: preset.h })}
              >
                {preset.label}
              </Chip>
            ))}
        </View>
        <Text style={ui.muted}>Or drag its corner on the Hearth for any size.</Text>
        <SwitchRow label="Lock in place" value={Boolean(draft.locked)} onChange={(locked) => setDraft({ ...draft, locked: locked || undefined })} />
        <Text style={ui.muted}>Can't be dragged, resized or removed until you unlock it.</Text>
        {draft.locked ? null : (
          <Button
            title="Save and move it on your Hearth"
            icon="arrowUp"
            variant="secondary"
            onPress={() => saveWidget(undefined, undefined, true)}
          />
        )}
        {hollowsOf(layout).length ? (
          <>
            <Text style={ui.label}>Where it lives</Text>
            <View style={ui.chips}>
              <Chip icon="hearth" selected={(livesIn ?? home) === null} onPress={() => setLivesIn(null)}>
                The Hearth
              </Chip>
              {hollowsOf(layout).map((hollowItem) => (
                <Chip
                  key={hollowItem.id}
                  icon="burrow"
                  selected={(livesIn ?? home) === hollowItem.id}
                  onPress={() => setLivesIn(hollowItem.id)}
                >
                  {hollowItem.name}
                </Chip>
              ))}
            </View>
          </>
        ) : null}
      </Collapsible>

      <Collapsible id="widget-when" icon="calendar" title="When it shows" summary={showInWords(draft.showIn)}>
        <SeasonPicker value={draft.showIn} onChange={(showIn) => setDraft({ ...draft, showIn })} />
      </Collapsible>

      <Collapsible id="widget-tags" icon="price" title="Tags" summary={tagsSummary(draft.tags)}>
        <TagsEditor tags={draft.tags} known={allTags(layout)} onChange={(tags) => setDraft({ ...draft, tags })} />
      </Collapsible>

      <Collapsible id="widget-copy" icon="copy" title="Copy & stack" summary={copySummary}>
        <Text style={ui.label}>Make a copy</Text>
        <View style={ui.chips}>
          <Chip icon="hearth" onPress={() => saveWidget(null)}>
            {hereName}
          </Chip>
          {hollowsOf(layout).map((hollowItem) => (
            <Chip key={hollowItem.id} icon="burrow" onPress={() => saveWidget(hollowItem.id)}>
              {hollowItem.name}
            </Chip>
          ))}
        </View>
        <Text style={ui.muted}>
          Saves this one, then opens the copy so you can make it its own.
          {widget.kind === "reminders" ? " The copy's list starts without phone alerts, so nothing rings twice." : ""}
        </Text>
        <Text style={ui.label}>Stack</Text>
        <Text style={ui.muted}>
          A stack keeps several widgets in one spot: swipe sideways on the Hearth to flip through them.
          {original.stack ? ` This one is in a stack of ${stackMates(layout.items, original).length}.` : ""}
        </Text>
        {stackMates(layout.items, original).length < MAX_STACK ? (
          <>
            <Text style={ui.label}>Put another widget in the stack</Text>
            <View style={ui.chips}>
              {widgetKinds.map((kind) => (
                <Chip key={kind.kind} icon={kind.icon} onPress={() => saveWidget(undefined, kind.kind)}>
                  {kind.label}
                </Chip>
              ))}
            </View>
            <Text style={ui.muted}>Saves this one, then opens the new widget so you can set it up.</Text>
          </>
        ) : (
          <Text style={ui.muted}>That's as many as a stack holds ({MAX_STACK}).</Text>
        )}
        {original.stack ? <Button title="Take it out of the stack" icon="close" variant="secondary" onPress={() => saveWidget(undefined, "out")} /> : null}
      </Collapsible>

      <Button title="Save" icon="check" onPress={() => saveWidget()} loading={isSaving} style={{ marginTop: 8 }} />
      <Button title="Remove widget" icon="trash" variant="danger" onPress={confirmRemove} />
    </NookScroll>
  );
}

// --- Photo frame (CORE-046) ------------------------------------------------------------

function FrameSettings({
  widget,
  setSettings,
  folder,
}: {
  widget: WidgetOf<"frame">;
  setSettings: (changes: Record<string, unknown>) => void;
  folder?: string;
}) {
  const { session } = useAuth();
  const [uploading, setUploading] = useState(false);
  const { photos, style, seconds, caption } = widget.settings;
  const urls = usePhotoUrls(photos);

  async function add() {
    const userId = session?.user.id;
    if (!userId || uploading || photos.length >= MAX_FRAME_PHOTOS) return;
    setUploading(true);
    const path = await pickAndUploadPhoto(userId, folder);
    setUploading(false);
    if (path) setSettings({ photos: [...photos, path] });
  }

  return (
    <>
      <Text style={ui.label}>
        Pictures ({photos.length}/{MAX_FRAME_PHOTOS})
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {photos.map((path) => (
          <View key={path} style={{ width: 84, height: 84, borderRadius: 14, overflow: "hidden", backgroundColor: colors.barkSoft }}>
            {urls.get(path) ? <Image source={{ uri: urls.get(path) }} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : null}
            <Tap
              onPress={() => setSettings({ photos: photos.filter((p) => p !== path) })}
              hitSlop={6}
              style={{ position: "absolute", top: 4, right: 4, width: 24, height: 24, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" }}
              accessibilityLabel="Remove this picture"
            >
              <Icon name="close" size={12} color="#ffffff" />
            </Tap>
          </View>
        ))}
      </View>
      <Button
        title={photos.length ? "Add another picture" : "Add a picture"}
        icon="camera"
        variant="secondary"
        onPress={add}
        loading={uploading}
        disabled={photos.length >= MAX_FRAME_PHOTOS}
      />

      <Text style={ui.label}>Frame</Text>
      <View style={ui.chips}>
        {frameStyles.map((f) => (
          <Chip key={f.key} selected={style === f.key} onPress={() => setSettings({ style: f.key })}>
            {f.label}
          </Chip>
        ))}
      </View>

      <Text style={ui.label}>Caption (optional)</Text>
      <TextInput
        style={ui.input}
        value={caption}
        onChangeText={(text) => setSettings({ caption: text.slice(0, 40) })}
        placeholder={style === "polaroid" ? "e.g. Summer at the lake" : "e.g. Our family"}
        placeholderTextColor={colors.muted}
      />

      {photos.length > 1 ? (
        <>
          <Text style={ui.label}>Change picture</Text>
          <View style={ui.chips}>
            {frameTimings.map((t) => (
              <Chip key={t.seconds} selected={seconds === t.seconds} onPress={() => setSettings({ seconds: t.seconds })}>
                {t.label}
              </Chip>
            ))}
          </View>
        </>
      ) : null}
      <Text style={ui.muted}>
        {folder
          ? "This frame is on the page shared with your Home, so everyone in your Home can see these pictures. Nobody else can."
          : "Your pictures are private to you. They're kept safe and only shown on your own Hearth."}
      </Text>
    </>
  );
}

// --- Quote of the day (CORE-049) ----------------------------------------------------------

function QuoteSettings({
  widget,
  setSettings,
}: {
  widget: WidgetOf<"quote">;
  setSettings: (changes: Record<string, unknown>) => void;
}) {
  // What you're typing, line by line; the saved list is tidied from it.
  const [text, setText] = useState(widget.settings.mine.join("\n"));
  return (
    <>
      <Text style={ui.label}>Where the quotes come from</Text>
      <View style={ui.chips}>
        {(
          [
            ["cozy", "Ours"],
            ["mine", "Just mine"],
            ["both", "Both"],
          ] as const
        ).map(([source, label]) => (
          <Chip key={source} selected={widget.settings.source === source} onPress={() => setSettings({ source })}>
            {label}
          </Chip>
        ))}
      </View>
      {widget.settings.source !== "cozy" ? (
        <>
          <Text style={ui.label}>Your own quotes (one per line, up to {MAX_OWN_QUOTES})</Text>
          <TextInput
            style={[ui.input, { minHeight: 120, textAlignVertical: "top" }]}
            value={text}
            onChangeText={(next) => {
              setText(next);
              setSettings({ mine: parseQuotes(next) });
            }}
            placeholder={"Something Grandma always said\nA line from a song you love"}
            placeholderTextColor={colors.muted}
            multiline
          />
        </>
      ) : null}
      <Text style={ui.muted}>One quote a day, the same all day, and a new one at midnight.</Text>
    </>
  );
}

// --- Weather and Window (CORE-056, 057) ---------------------------------------------------

function UnitChips({ value, onChange }: { value: Unit; onChange: (unit: Unit) => void }) {
  return (
    <>
      <Text style={ui.label}>Temperature in</Text>
      <View style={ui.chips}>
        <Chip selected={value === "f"} onPress={() => onChange("f")}>
          °F
        </Chip>
        <Chip selected={value === "c"} onPress={() => onChange("c")}>
          °C
        </Chip>
      </View>
    </>
  );
}

function WindowSettings({
  widget,
  setSettings,
}: {
  widget: WidgetOf<"window">;
  setSettings: (changes: Record<string, unknown>) => void;
}) {
  const s = widget.settings;
  const live = s.source === "live";
  return (
    <>
      <Text style={ui.label}>Outside the window</Text>
      <View style={ui.chips}>
        <Chip icon="place" selected={live} onPress={() => setSettings({ source: "live" })}>
          The real weather
        </Chip>
        <Chip icon="sparkles" selected={!live} onPress={() => setSettings({ source: "pick" })}>
          A sky I choose
        </Chip>
      </View>
      {live ? (
        <>
          <Text style={ui.label}>Town</Text>
          <PlacePicker value={s.place} onChange={(place: Place) => setSettings({ place })} />
          <SwitchRow label="Show the temperature" value={s.showTemp} onChange={(showTemp) => setSettings({ showTemp })} />
          {s.showTemp ? <UnitChips value={s.unit} onChange={(unit) => setSettings({ unit })} /> : null}
        </>
      ) : (
        <>
          <Text style={ui.label}>Weather</Text>
          <View style={ui.chips}>
            {conditions.map((c) => (
              <Chip key={c.key} selected={s.condition === c.key} onPress={() => setSettings({ condition: c.key })}>
                {c.label}
              </Chip>
            ))}
          </View>
        </>
      )}
      <Text style={ui.label}>Day or night</Text>
      <View style={ui.chips}>
        {(
          [
            ["auto", live ? "Like outside" : "By the clock"],
            ["day", "Always day"],
            ["night", "Always night"],
          ] as const
        ).map(([time, label]) => (
          <Chip key={time} selected={s.time === time} onPress={() => setSettings({ time })}>
            {label}
          </Chip>
        ))}
      </View>
      <Text style={ui.label}>Frame</Text>
      <View style={ui.chips}>
        {windowFrames.map((f) => (
          <Chip key={f.key} selected={s.frame === f.key} onPress={() => setSettings({ frame: f.key })}>
            {f.label}
          </Chip>
        ))}
      </View>
      <Text style={ui.muted}>
        The rain, snow and clouds hold still while you're editing your Hearth, and if your phone's Reduce Motion is on.
      </Text>
    </>
  );
}

// --- Hearth pet (CORE-048) ------------------------------------------------------------

function CompanionSettings({
  widget,
  setSettings,
  setWidget,
}: {
  widget: WidgetOf<"companion">;
  setSettings: (changes: Record<string, unknown>) => void;
  setWidget: (changes: Partial<WidgetConfig>) => void;
}) {
  const { session } = useAuth();
  const { data } = usePets(session?.user.id);
  const s = widget.settings;
  const pets = data?.pets ?? [];
  const linked = pets.find((p) => p.id === s.petId) ?? null;

  function choosePet(pet: (typeof pets)[number] | null) {
    tap();
    if (!pet) return setSettings({ petId: null });
    const critter = critterForSpecies(pet.species);
    setSettings({ petId: pet.id, name: pet.name, critter, fur: critterInfo(critter).fur, photo: Boolean(pet.photo_path) });
    setWidget({ title: pet.name });
  }

  return (
    <>
      <Text style={ui.label}>Who lives here</Text>
      <View style={ui.chips}>
        {pets.map((pet) => (
          <Chip key={pet.id} icon="paw" selected={s.petId === pet.id} onPress={() => choosePet(pet)}>
            {pet.name}
          </Chip>
        ))}
        <Chip icon="sparkles" selected={!s.petId} onPress={() => choosePet(null)}>
          {pets.length ? "Make one up" : "A pet of my own"}
        </Chip>
      </View>
      {pets.length ? null : <Text style={ui.muted}>Pets you add in Pet Care can live here too, with their own name and photo.</Text>}
      {s.petId && !linked && data ? <Text style={ui.muted}>That pet isn't in your Pet Care any more, so the name below is used.</Text> : null}

      {s.petId && linked ? null : (
        <>
          <Text style={ui.label}>Name</Text>
          <TextInput
            style={ui.input}
            value={s.name}
            onChangeText={(name) => {
              setSettings({ name: name.slice(0, 20) });
              setWidget({ title: name.slice(0, 20) || "Hearth pet" });
            }}
            placeholder="e.g. Biscuit"
            placeholderTextColor={colors.muted}
          />
        </>
      )}

      <Text style={ui.label}>What kind</Text>
      <View style={ui.chips}>
        {critters.map((c) => (
          <Chip
            key={c.key}
            selected={s.critter === c.key}
            onPress={() => setSettings(s.critter === c.key ? {} : { critter: c.key, fur: c.fur })}
          >
            {c.label}
          </Chip>
        ))}
      </View>
      {linked?.photo_path ? (
        <SwitchRow label="Use their photo as the face" value={s.photo} onChange={(photo) => setSettings({ photo })} />
      ) : null}
      <Text style={ui.label}>{s.critter === "turtle" ? "Shell color" : s.critter === "bird" ? "Feather color" : s.critter === "fish" ? "Scale color" : "Fur color"}</Text>
      <ColorPicker value={s.fur} fallback={critterInfo(s.critter).fur} onChange={(fur) => setSettings({ fur })} />

      <Text style={ui.label}>Bed</Text>
      <View style={ui.chips}>
        {bedStyles.map((b) => (
          <Chip key={b.key} selected={s.bed === b.key} onPress={() => setSettings({ bed: b.key })}>
            {b.label}
          </Chip>
        ))}
      </View>

      <SwitchRow label="Wanders around your Hearth" value={s.wanders} onChange={(wanders) => setSettings({ wanders })} />
      <Text style={ui.muted}>
        {s.wanders
          ? "Now and then it hops out to sit on your other widgets and Nooks, sometimes naps there, then comes home. Tap it to say hi."
          : "It stays in its bed. Tap it to say hi."}{" "}
        It sleeps in its bed at night, and stays put while you're editing or if your phone's Reduce Motion is on.
        {s.petId ? " If a meal in Pet Care is late, it waits by its bowl." : ""}
      </Text>
    </>
  );
}

// --- Per-kind settings --------------------------------------------------------

function KindSettings({
  widget,
  setSettings,
  setWidget,
  photoFolder,
  onHomePage = false,
  homeName,
}: {
  widget: WidgetConfig;
  setSettings: (changes: Record<string, unknown>) => void;
  setWidget: (changes: Partial<WidgetConfig>) => void;
  // Where new photos go: the Home's folder for the shared page.
  photoFolder?: string;
  // On the page shared with your Home (CORE-054), and that page's name.
  onHomePage?: boolean;
  homeName?: string;
}) {
  switch (widget.kind) {
    case "fridge":
      return <FridgeSettings widget={widget} setSettings={setSettings} onHomePage={onHomePage} homeName={homeName} />;
    case "companion":
      return <CompanionSettings widget={widget} setSettings={setSettings} setWidget={setWidget} />;
    case "countdown":
      return <CountdownSettings widget={widget} setSettings={setSettings} />;
    case "gatherings":
      return <GatheringsSettings widget={widget} setSettings={setSettings} />;
    case "gathering":
      return <GatheringSettings widget={widget} setSettings={setSettings} setWidget={setWidget} />;
    case "reminders":
      return <RemindersSettings widget={widget} setSettings={setSettings} />;
    case "tucks":
      return (
        <>
          <Text style={ui.label}>Show</Text>
          <View style={ui.chips}>
            <Chip selected={widget.settings.include === "planning"} onPress={() => setSettings({ include: "planning" })}>
              Still to get
            </Chip>
            <Chip selected={widget.settings.include === "open"} onPress={() => setSettings({ include: "open" })}>
              To get + bought
            </Chip>
          </View>
          <Stepper label="How many to list" value={widget.settings.count} min={1} max={6} onChange={(count) => setSettings({ count })} />
        </>
      );
    case "note":
      return (
        <>
          <TextInput
            style={[ui.input, { minHeight: 110, textAlignVertical: "top" }]}
            value={widget.settings.text}
            onChangeText={(text) => setSettings({ text })}
            placeholder="Anything you want to see every day…"
            placeholderTextColor={colors.muted}
            multiline
          />
          <Text style={ui.label}>Text size</Text>
          <View style={ui.chips}>
            {(["small", "medium", "large"] as const).map((size) => (
              <Chip key={size} selected={widget.settings.textSize === size} onPress={() => setSettings({ textSize: size })}>
                {size[0].toUpperCase() + size.slice(1)}
              </Chip>
            ))}
          </View>
          <Text style={ui.label}>Line up</Text>
          <View style={ui.chips}>
            {(["left", "center"] as const).map((align) => (
              <Chip key={align} selected={widget.settings.align === align} onPress={() => setSettings({ align })}>
                {align === "left" ? "Left" : "Center"}
              </Chip>
            ))}
          </View>
        </>
      );
    case "pets":
      return (
        <>
          <Stepper label="Names to list" value={widget.settings.count} min={0} max={6} onChange={(count) => setSettings({ count })} />
          <Text style={ui.muted}>Who still needs feeding today, and what's coming due at the vet, from your Pet Care Nook.</Text>
        </>
      );
    case "frame":
      return <FrameSettings widget={widget} setSettings={setSettings} folder={photoFolder} />;
    case "clock":
      return (
        <>
          <Text style={ui.label}>Face</Text>
          <View style={ui.chips}>
            <Chip icon="clock" selected={widget.settings.face === "digital"} onPress={() => setSettings({ face: "digital" })}>
              Digital
            </Chip>
            <Chip icon="sun" selected={widget.settings.face === "analog"} onPress={() => setSettings({ face: "analog" })}>
              Analog
            </Chip>
          </View>
          <View style={[ui.row, { gap: 10 }]}>
            <Text style={[ui.label, { flex: 1, marginBottom: 0 }]}>24-hour time</Text>
            <Switch value={widget.settings.hour24} onValueChange={(hour24) => setSettings({ hour24 })} trackColor={{ true: colors.bark }} />
          </View>
          <View style={[ui.row, { gap: 10 }]}>
            <Text style={[ui.label, { flex: 1, marginBottom: 0 }]}>Show the date</Text>
            <Switch value={widget.settings.showDate} onValueChange={(showDate) => setSettings({ showDate })} trackColor={{ true: colors.bark }} />
          </View>
        </>
      );
    case "quote":
      return <QuoteSettings widget={widget} setSettings={setSettings} />;
    case "weather":
      return (
        <>
          <Text style={ui.label}>Town</Text>
          <PlacePicker value={widget.settings.place} onChange={(place) => setSettings({ place })} />
          <UnitChips value={widget.settings.unit} onChange={(unit) => setSettings({ unit })} />
          <SwitchRow label="Show the next few days" value={widget.settings.showForecast} onChange={(showForecast) => setSettings({ showForecast })} />
          <Text style={ui.muted}>The days show when the widget is big enough. Updates every 15 minutes or so.</Text>
        </>
      );
    case "window":
      return <WindowSettings widget={widget} setSettings={setSettings} />;
    case "launch":
      return (
        <>
          <Text style={ui.label}>
            Buttons ({widget.settings.targets.length}/{MAX_LAUNCH_TARGETS})
          </Text>
          <View style={ui.chips}>
            {launchTargets().map((target) => {
              const on = widget.settings.targets.includes(target.key);
              return (
                <Chip
                  key={target.key}
                  icon={target.icon}
                  selected={on}
                  onPress={() => {
                    if (on) setSettings({ targets: widget.settings.targets.filter((k) => k !== target.key) });
                    else if (widget.settings.targets.length < MAX_LAUNCH_TARGETS) setSettings({ targets: [...widget.settings.targets, target.key] });
                  }}
                >
                  {target.label}
                </Chip>
              );
            })}
          </View>
          <Text style={ui.muted}>Buttons show in the order you tap them. They only work outside Edit mode.</Text>
        </>
      );
    case "streak":
      return (
        <>
          <Text style={ui.label}>What are you keeping up?</Text>
          <TextInput
            style={ui.input}
            value={widget.settings.name}
            onChangeText={(name) => setSettings({ name: name.slice(0, 30) })}
            placeholder="e.g. Walk the dog"
            placeholderTextColor={colors.muted}
          />
          <Text style={ui.muted}>
            {widget.settings.days.length} day{widget.settings.days.length === 1 ? "" : "s"} logged. Tap “Done today” on your Hearth each day; miss a day and the streak starts over.
          </Text>
          {widget.settings.days.length ? (
            <Button
              title="Start over"
              icon="undo"
              variant="secondary"
              onPress={() =>
                Alert.alert("Start over?", "This clears every day you've logged for this habit.", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Start over", style: "destructive", onPress: () => setSettings({ days: [] }) },
                ])
              }
            />
          ) : null}
        </>
      );
    case "rhythms":
      return (
        <>
          <Stepper label="Chores to list" value={widget.settings.count} min={0} max={6} onChange={(count) => setSettings({ count })} />
          <Text style={ui.label}>Show</Text>
          <View style={ui.chips}>
            <Chip selected={!widget.settings.mineOnly} onPress={() => setSettings({ mineOnly: false })}>
              Everything
            </Chip>
            <Chip icon="person" selected={widget.settings.mineOnly} onPress={() => setSettings({ mineOnly: true })}>
              Just mine
            </Chip>
          </View>
          <Text style={ui.muted}>What's overdue or due today, then what's coming in the next month, from your Rhythms Nook.</Text>
        </>
      );
    case "subscriptions":
      return (
        <>
          <Stepper label="Subscriptions to list" value={widget.settings.count} min={0} max={6} onChange={(count) => setSettings({ count })} />
          <Text style={ui.label}>Show</Text>
          <View style={ui.chips}>
            <Chip selected={!widget.settings.mineOnly} onPress={() => setSettings({ mineOnly: false })}>
              Everything
            </Chip>
            <Chip icon="person" selected={widget.settings.mineOnly} onPress={() => setSettings({ mineOnly: true })}>
              Just mine
            </Chip>
          </View>
          <View style={[ui.row, { gap: 12 }]}>
            <Text style={[ui.label, { flex: 1 }]}>Show the monthly total</Text>
            <Switch value={widget.settings.showTotal} onValueChange={(showTotal) => setSettings({ showTotal })} trackColor={{ true: colors.bark }} />
          </View>
          <Text style={ui.muted}>
            What renews next, soonest first, with free trials marked, from your Subscriptions Nook. Just mine means ones you pay for or keep
            to yourself.
          </Text>
        </>
      );
    case "recipe":
      return <RecipeShelfPicker shelf={widget.settings.shelf} onChange={(shelf) => setSettings({ shelf })} />;
    case "sickday":
      return (
        <>
          <View style={[ui.row, { gap: 12 }]}>
            <Text style={[ui.label, { flex: 1 }]}>Show the latest temperature</Text>
            <Switch value={widget.settings.showTemp} onValueChange={(showTemp) => setSettings({ showTemp })} trackColor={{ true: colors.bark }} />
          </View>
          <Text style={ui.muted}>
            Who's sick and when each medicine they've had is OK again, counting down, from your Sick Day Nook. Says “Everyone's well” the rest of the
            time.
          </Text>
        </>
      );
    case "sitter":
      return (
        <>
          <Stepper label="Links to list" value={widget.settings.count} min={0} max={6} onChange={(count) => setSettings({ count })} />
          <Text style={ui.muted}>Who has a sitter link, until when, and whether they've opened it, from your Sitter Sheet Nook.</Text>
        </>
      );
    case "cards":
      return (
        <>
          <Stepper label="Names to list" value={widget.settings.count} min={0} max={6} onChange={(count) => setSettings({ count })} />
          <Text style={ui.muted}>Who's on your holiday list and still waiting for a card, from your Letterbox Nook.</Text>
        </>
      );
    case "inbox":
      return <Stepper label="Notices to list" value={widget.settings.count} min={0} max={5} onChange={(count) => setSettings({ count })} />;
    case "greeting":
      return (
        <>
          <Text style={ui.label}>Your message (optional)</Text>
          <TextInput
            style={ui.input}
            value={widget.settings.message}
            onChangeText={(message) => setSettings({ message })}
            placeholder="e.g. Have a cozy day"
            placeholderTextColor={colors.muted}
          />
          <SwitchRow label="Use my name" value={widget.settings.showName} onChange={(showName) => setSettings({ showName })} />
          <SwitchRow label="Show today's date" value={widget.settings.showDate} onChange={(showDate) => setSettings({ showDate })} />
        </>
      );
  }
}

function CountdownSettings({
  widget,
  setSettings,
}: {
  widget: WidgetOf<"countdown">;
  setSettings: (changes: Partial<WidgetOf<"countdown">["settings"]>) => void;
}) {
  const { source, gatheringId, getawayId, customTitle, customDate, display } = widget.settings;
  const [gatherings, setGatherings] = useState<{ id: string; title: string; ends_at: string }[]>([]);
  const [getaways, setGetaways] = useState<{ id: string; title: string; starts_on: string; ends_on: string }[]>([]);

  useEffect(() => {
    supabase
      .from("getaways")
      .select("id, title, starts_on, ends_on")
      .gte("ends_on", localDay())
      .order("starts_on")
      .limit(20)
      .then(({ data }) => setGetaways(data ?? []));
  }, []);

  useEffect(() => {
    supabase
      .from("gatherings")
      .select("id, title, ends_at")
      .gt("ends_at", new Date().toISOString())
      .order("ends_at")
      .limit(20)
      .then(({ data }) => setGatherings(data ?? []));
  }, []);

  return (
    <>
      <Text style={ui.label}>Count down to</Text>
      <View style={ui.chips}>
        <Chip selected={source === "next"} onPress={() => setSettings({ source: "next" })}>
          Next Gathering
        </Chip>
        <Chip selected={source === "gathering"} onPress={() => setSettings({ source: "gathering" })}>
          A Gathering
        </Chip>
        <Chip selected={source === "getaway"} onPress={() => setSettings({ source: "getaway" })}>
          A Getaway
        </Chip>
        <Chip selected={source === "custom"} onPress={() => setSettings({ source: "custom" })}>
          My own date
        </Chip>
      </View>

      {source === "getaway" ? (
        <Animated.View entering={FadeIn.duration(200)} style={ui.chips}>
          <Chip selected={!getawayId} onPress={() => setSettings({ getawayId: undefined })}>
            Whichever's next
          </Chip>
          {getaways.map((g) => (
            <Chip key={g.id} selected={getawayId === g.id} onPress={() => setSettings({ getawayId: g.id })}>
              {g.title} · {rangeWords(g.starts_on, g.ends_on)}
            </Chip>
          ))}
        </Animated.View>
      ) : null}

      {source === "gathering" ? (
        <Animated.View entering={FadeIn.duration(200)} style={ui.chips}>
          {gatherings.length ? (
            gatherings.map((g) => (
              <Chip key={g.id} selected={gatheringId === g.id} onPress={() => setSettings({ gatheringId: g.id })}>
                {g.title} · {formatDate(g.ends_at)}
              </Chip>
            ))
          ) : (
            <Text style={ui.muted}>No upcoming Gatherings yet.</Text>
          )}
        </Animated.View>
      ) : null}

      {source === "custom" ? (
        <Animated.View entering={FadeIn.duration(200)} style={{ gap: 12 }}>
          <TextInput
            style={ui.input}
            value={customTitle}
            onChangeText={(title) => setSettings({ customTitle: title })}
            placeholder="What's happening? e.g. Beach trip"
            placeholderTextColor={colors.muted}
          />
          <DateField
            mode="date"
            value={customDate ? new Date(customDate) : new Date()}
            onChange={(date) => setSettings({ customDate: date.toISOString() })}
          />
        </Animated.View>
      ) : null}

      <Text style={ui.label}>Show it as</Text>
      <View style={ui.chips}>
        <Chip selected={display === "number"} onPress={() => setSettings({ display: "number" })}>
          Big number
        </Chip>
        <Chip selected={display === "words"} onPress={() => setSettings({ display: "words" })}>
          In words
        </Chip>
      </View>
    </>
  );
}

// Which fridge (CORE-086): on the Home page it's always the Home's.
function FridgeSettings({
  widget,
  setSettings,
  onHomePage,
  homeName,
}: {
  widget: WidgetOf<"fridge">;
  setSettings: (changes: Partial<WidgetOf<"fridge">["settings"]>) => void;
  onHomePage: boolean;
  homeName?: string;
}) {
  const { place, burrowId } = widget.settings;
  const [burrows, setBurrows] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    supabase
      .from("burrows")
      .select("id, name")
      .order("name")
      .then(({ data }) => setBurrows(data ?? []));
  }, []);

  if (onHomePage) {
    return (
      <Text style={ui.muted}>
        This is your Home's fridge, because it's on the {homeName || "Home"} page. Everyone in your Home sees the same notes, and the page's tab
        gets a little note on it when someone sticks one up.
      </Text>
    );
  }
  const onBurrow = place === "burrow" && Boolean(burrowId);
  return (
    <>
      <Text style={ui.label}>Whose fridge</Text>
      <View style={ui.chips}>
        <Chip icon="hearth" selected={!onBurrow} onPress={() => setSettings({ place: "home", burrowId: null })}>
          My Home's
        </Chip>
        {burrows.map((b) => (
          <Chip key={b.id} icon="burrow" selected={onBurrow && burrowId === b.id} onPress={() => setSettings({ place: "burrow", burrowId: b.id })}>
            {b.name}
          </Chip>
        ))}
      </View>
      <Text style={ui.muted}>
        {onBurrow
          ? "Everyone in this Burrow can see the notes and stick up their own."
          : "The people you live with share this fridge. Put a Fridge door on the Home page and it's theirs to see on their Hearth too."}{" "}
        Notes come down by themselves after a day, three days or a week, whichever the writer picks.
      </Text>
    </>
  );
}

function GatheringsSettings({
  widget,
  setSettings,
}: {
  widget: WidgetOf<"gatherings">;
  setSettings: (changes: Partial<WidgetOf<"gatherings">["settings"]>) => void;
}) {
  const { burrowId, kinds, count, showCountdown } = widget.settings;
  const [burrows, setBurrows] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    supabase
      .from("burrows")
      .select("id, name")
      .order("name")
      .then(({ data }) => setBurrows(data ?? []));
  }, []);

  function toggleKind(kind: GatheringKind) {
    setSettings({ kinds: kinds.includes(kind) ? kinds.filter((k) => k !== kind) : [...kinds, kind] });
  }

  return (
    <>
      <Text style={ui.label}>From</Text>
      <View style={ui.chips}>
        <Chip selected={!burrowId} onPress={() => setSettings({ burrowId: null })}>
          All my Burrows
        </Chip>
        {burrows.map((b) => (
          <Chip key={b.id} icon="burrow" selected={burrowId === b.id} onPress={() => setSettings({ burrowId: b.id })}>
            {b.name}
          </Chip>
        ))}
      </View>
      <Text style={ui.label}>Kinds (none picked = all)</Text>
      <View style={ui.chips}>
        {gatheringKinds.map((k) => (
          <Chip key={k.key} icon={k.icon} selected={kinds.includes(k.key)} onPress={() => toggleKind(k.key)}>
            {k.label}
          </Chip>
        ))}
      </View>
      <Stepper label="How many" value={count} min={1} max={6} onChange={(next) => setSettings({ count: next })} />
      <SwitchRow label="Show how long until each" value={showCountdown} onChange={(next) => setSettings({ showCountdown: next })} />
    </>
  );
}

// One Gathering (GATH-009): which one, and what it does once it's over (GATH-010).
function GatheringSettings({
  widget,
  setSettings,
  setWidget,
}: {
  widget: WidgetOf<"gathering">;
  setSettings: (changes: Partial<WidgetOf<"gathering">["settings"]>) => void;
  setWidget: (changes: Partial<WidgetConfig>) => void;
}) {
  const { gatheringId, whenOver } = widget.settings;
  const [gatherings, setGatherings] = useState<{ id: string; title: string; ends_at: string }[]>([]);

  useEffect(() => {
    supabase
      .from("gatherings")
      .select("id, title, ends_at")
      .gt("ends_at", new Date().toISOString())
      .order("ends_at")
      .limit(20)
      .then(({ data }) => setGatherings(data ?? []));
  }, []);

  // The picked one may already be over, so it isn't in the list above.
  const [picked, setPicked] = useState<{ id: string; title: string; ends_at: string } | null>(null);
  useEffect(() => {
    if (!gatheringId || gatherings.some((g) => g.id === gatheringId)) return setPicked(null);
    supabase
      .from("gatherings")
      .select("id, title, ends_at")
      .eq("id", gatheringId)
      .maybeSingle()
      .then(({ data }) => setPicked(data ?? null));
  }, [gatheringId, gatherings]);

  const choices = picked ? [picked, ...gatherings] : gatherings;
  const pick = (g: { id: string; title: string } | null) => {
    setSettings({ gatheringId: g?.id ?? null });
    // Its name is how you'll find it on your Hearth (Find, screen readers).
    setWidget({ title: g?.title ?? "Next Gathering" });
  };

  return (
    <>
      <Text style={ui.label}>Which Gathering</Text>
      <View style={ui.chips}>
        <Chip selected={!gatheringId} onPress={() => pick(null)}>
          Whichever's next
        </Chip>
        {choices.map((g) => (
          <Chip key={g.id} selected={gatheringId === g.id} onPress={() => pick(g)}>
            {g.title} · {formatDate(g.ends_at)}
          </Chip>
        ))}
      </View>
      {!choices.length ? <Text style={ui.muted}>No upcoming Gatherings yet.</Text> : null}
      {gatheringId ? (
        <Animated.View entering={FadeIn.duration(200)} style={{ gap: 8 }}>
          <Text style={ui.label}>When it's over</Text>
          <View style={ui.chips}>
            {gatheringWhenOver.map((choice) => (
              <Chip key={choice.key} selected={whenOver === choice.key} onPress={() => setSettings({ whenOver: choice.key })}>
                {choice.label}
              </Chip>
            ))}
          </View>
          <Text style={ui.muted}>{gatheringWhenOver.find((c) => c.key === whenOver)?.hint}</Text>
        </Animated.View>
      ) : (
        <Text style={ui.muted}>Once one's over, it moves on to the next by itself.</Text>
      )}
      <Text style={ui.muted}>Your gift shopping here is only ever yours: nobody else sees it, least of all whoever the gifts are for.</Text>
    </>
  );
}

const weekdays = ["S", "M", "T", "W", "T", "F", "S"];

function RemindersSettings({
  widget,
  setSettings,
}: {
  widget: WidgetOf<"reminders">;
  setSettings: (changes: Partial<WidgetOf<"reminders">["settings"]>) => void;
}) {
  const { items, hideDone } = widget.settings;

  function update(id: string, changes: Partial<Reminder>) {
    setSettings({ items: items.map((item) => (item.id === id ? { ...item, ...changes } : item)) });
  }
  function setSchedule(item: Reminder, kind: ReminderSchedule["kind"] | "none") {
    const now = new Date();
    const hour = 9;
    const minute = 0;
    const schedule: ReminderSchedule | undefined =
      kind === "none"
        ? undefined
        : kind === "daily"
          ? { kind, hour, minute }
          : kind === "weekly"
            ? { kind, weekday: now.getDay() + 1, hour, minute }
            : { kind, at: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, hour, minute).toISOString() };
    update(item.id, { schedule });
  }

  return (
    <>
      {items.map((item) => (
        <Animated.View key={item.id} entering={FadeIn.duration(200)} layout={LinearTransition.duration(200)} style={[ui.card, { gap: 10 }]}>
          <View style={[ui.row, { gap: 10 }]}>
            <TextInput
              style={[ui.input, { flex: 1 }]}
              value={item.text}
              onChangeText={(text) => update(item.id, { text })}
              placeholder="e.g. Log lunch"
              placeholderTextColor={colors.muted}
            />
            <Tap
              onPress={() => setSettings({ items: items.filter((r) => r.id !== item.id) })}
              hitSlop={8}
              pressedScale={0.85}
              accessibilityLabel="Remove reminder"
            >
              <Icon name="trash" size={20} color={colors.error} />
            </Tap>
          </View>
          <View style={ui.chips}>
            {(
              [
                ["none", "No alert"],
                ["once", "Once"],
                ["daily", "Daily"],
                ["weekly", "Weekly"],
              ] as const
            ).map(([kind, label]) => (
              <Chip
                key={kind}
                selected={(item.schedule?.kind ?? "none") === kind}
                onPress={() => setSchedule(item, kind)}
              >
                {label}
              </Chip>
            ))}
          </View>
          {item.schedule?.kind === "weekly" ? (
            <View style={ui.chips}>
              {weekdays.map((letter, i) => {
                const schedule = item.schedule as Extract<ReminderSchedule, { kind: "weekly" }>;
                return (
                  <Chip key={i} selected={schedule.weekday === i + 1} onPress={() => update(item.id, { schedule: { ...schedule, weekday: i + 1 } })}>
                    {letter}
                  </Chip>
                );
              })}
            </View>
          ) : null}
          {item.schedule ? (
            <View style={[ui.row, { gap: 10 }]}>
              <Icon name="bell" size={16} />
              <View style={{ flex: 1 }}>
                <DateField
                  mode={item.schedule.kind === "once" ? "datetime" : "time"}
                  value={scheduleDate(item.schedule)}
                  onChange={(date) => update(item.id, { schedule: withTime(item.schedule!, date) })}
                />
              </View>
            </View>
          ) : null}
          {item.schedule ? <Text style={ui.muted}>{describeSchedule(item.schedule)}</Text> : null}
        </Animated.View>
      ))}
      <Button
        title="Add a reminder"
        icon="add"
        variant="secondary"
        onPress={() => setSettings({ items: [...items, { id: newReminderId(), text: "", done: false }] })}
      />
      <SwitchRow label="Hide ones I've checked off" value={hideDone} onChange={(next) => setSettings({ hideDone: next })} />
      <Text style={ui.muted}>
        Alerts ring on this phone. Nook will ask permission to send notifications the first time.
      </Text>
    </>
  );
}

function scheduleDate(schedule: ReminderSchedule) {
  if (schedule.kind === "once") return new Date(schedule.at);
  const date = new Date();
  date.setHours(schedule.hour, schedule.minute, 0, 0);
  return date;
}

function withTime(schedule: ReminderSchedule, date: Date): ReminderSchedule {
  if (schedule.kind === "once") return { ...schedule, at: date.toISOString() };
  return { ...schedule, hour: date.getHours(), minute: date.getMinutes() };
}

// --- Small inputs ----------------------------------------------------------------

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <View style={[ui.row, { justifyContent: "space-between" }]}>
      <Text style={ui.cardTitle}>{label}</Text>
      <View style={[ui.row, { gap: 14 }]}>
        <Tap onPress={() => value > min && onChange(value - 1)} disabled={value <= min} style={stepperButton} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Less ${label}`}>
          <Text style={stepperText}>−</Text>
        </Tap>
        <Text style={[ui.cardTitle, { minWidth: 20, textAlign: "center" }]}>{value}</Text>
        <Tap onPress={() => value < max && onChange(value + 1)} disabled={value >= max} style={stepperButton} hitSlop={6} accessibilityRole="button" accessibilityLabel={`More ${label}`}>
          <Icon name="add" size={16} />
        </Tap>
      </View>
    </View>
  );
}

const stepperButton = themed(() => ({
  width: 34,
  height: 34,
  borderRadius: 17,
  backgroundColor: colors.barkSoft,
  alignItems: "center" as const,
  justifyContent: "center" as const,
}));
const stepperText = { fontSize: 20, fontWeight: "700" as const, color: colors.bark, marginTop: -2 };

function SwitchRow({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <View style={[ui.row, { justifyContent: "space-between" }]}>
      <Text style={ui.cardTitle}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.bark }} />
    </View>
  );
}

// Recipe of the day (REC-011): all of your Recipe Box, or one of its Shelves.
function RecipeShelfPicker({ shelf, onChange }: { shelf: string | null; onChange: (shelf: string | null) => void }) {
  const { session } = useAuth();
  const [shelves, setShelves] = useState<string[]>([]);

  useEffect(() => {
    if (!session) return;
    supabase
      .from("recipes")
      .select("shelves")
      .eq("owner_id", session.user.id)
      .then(({ data }) => setShelves(shelvesIn((data ?? []) as { shelves: string[] }[])));
  }, [session]);

  return (
    <>
      <Text style={ui.label}>Pick from</Text>
      <View style={ui.chips}>
        <Chip selected={!shelf} onPress={() => onChange(null)}>
          My whole box
        </Chip>
        {[...new Set([...(shelf ? [shelf] : []), ...shelves])].map((name) => (
          <Chip key={name} selected={shelf === name} onPress={() => onChange(name)}>
            {name}
          </Chip>
        ))}
      </View>
      <Text style={ui.muted}>A different recipe each day from your Recipe Box Nook. Tap it on your Hearth to open it.</Text>
    </>
  );
}
