import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { useLeaveGuard } from "./leave-guard";
import { Text, TextInput } from "./text";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";

import { tap } from "../lib/feedback";
import {
  avatarColors,
  avatarIcons,
  formatBirthday,
  hasRealName,
  parseDateString,
  toDateString,
  type MyProfile,
} from "../lib/profile";
import { pickProfilePhoto, rememberProfilePhoto, removeProfilePhoto, uploadProfilePhoto } from "../lib/profile-photos";
import { colors, themed, ui } from "../lib/theme";
import { Avatar } from "./avatar";
import { DateField } from "./date-field";
import { Icon } from "./icon";
import { Tap } from "./motion";
import { Button, SectionHeader } from "./ui";

export type ProfileValues = Pick<MyProfile, "display_name" | "avatar_icon" | "avatar_color" | "avatar_path" | "birthday" | "bio">;

// Name, picture, birthday and a short bio (PROF-001). Used both for the
// first-time welcome and for editing later. Name is the only required part.
// The picture can be a photo (PROF-006), uploaded when the form is saved;
// the color and icon stay chosen underneath, for if the photo is removed.
export function ProfileForm({
  initial,
  submitLabel,
  autoFocusName,
  onSubmit,
}: {
  initial: Partial<MyProfile> | null;
  submitLabel: string;
  autoFocusName?: boolean;
  // Return an error message to show, or null when it saved.
  onSubmit: (values: ProfileValues) => Promise<string | null>;
}) {
  const [name, setName] = useState(hasRealName(initial?.display_name) ? initial!.display_name! : "");
  const [icon, setIcon] = useState<string | null>(initial?.avatar_icon ?? null);
  const [color, setColor] = useState<string | null>(initial?.avatar_color ?? null);
  const [birthday, setBirthday] = useState<string | null>(initial?.birthday ?? null);
  const [bio, setBio] = useState(initial?.bio ?? "");
  // The saved photo (kept unless removed or replaced), and a newly chosen one.
  const [photoPath, setPhotoPath] = useState<string | null>(initial?.avatar_path ?? null);
  const [newPhoto, setNewPhoto] = useState<{ uri: string; mimeType?: string | null } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Leaving with unsaved changes asks first (CORE-075).
  const { allowLeave, blockLeave } = useLeaveGuard({ name, icon, color, birthday, bio, photoPath, newPhoto: newPhoto?.uri ?? null });
  const profileId = initial?.id;
  const hasPhoto = Boolean(newPhoto || photoPath);
  // What the preview shows: the new photo straight from the phone, or the saved one.
  const previewPhoto = newPhoto ? `local:${newPhoto.uri}` : photoPath;

  async function choosePhoto(from: "camera" | "library") {
    const picked = await pickProfilePhoto(from);
    if (!picked) return;
    tap();
    rememberProfilePhoto(`local:${picked.uri}`, picked.uri);
    setNewPhoto(picked);
  }

  function photoOptions() {
    Alert.alert(hasPhoto ? "Change the photo" : "Add a photo", undefined, [
      { text: "Take a photo", onPress: () => choosePhoto("camera") },
      { text: "Choose from library", onPress: () => choosePhoto("library") },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) return setError("What should your family call you?");
    if (trimmed.includes("@")) return setError("Use your name here, not your email address.");
    setIsSaving(true);
    setError(null);

    // Upload a new photo first, so saving the profile points at it.
    let uploaded: string | null = null;
    if (newPhoto && profileId) {
      try {
        uploaded = await uploadProfilePhoto(profileId, newPhoto.uri, newPhoto.mimeType);
        rememberProfilePhoto(uploaded, newPhoto.uri);
      } catch {
        setIsSaving(false);
        return setError("Couldn't upload the photo. Check your connection and try again.");
      }
    }
    const savedPath = initial?.avatar_path ?? null;
    const nextPath = uploaded ?? photoPath;

    // Saving may leave the screen; only ask again if it didn't work.
    allowLeave();
    const message = await onSubmit({
      display_name: trimmed,
      avatar_icon: icon,
      avatar_color: color,
      avatar_path: nextPath,
      birthday,
      bio: bio.trim() || null,
    });
    setIsSaving(false);
    if (message) {
      if (uploaded) removeProfilePhoto(uploaded);
      blockLeave();
      setError(message);
    } else if (savedPath && savedPath !== nextPath) {
      // The old photo isn't anyone's picture any more.
      removeProfilePhoto(savedPath);
    }
  }

  return (
    <>
      <View style={{ alignItems: "center", paddingVertical: 8 }}>
        <Animated.View key={`${icon}-${color}-${previewPhoto}`} entering={ZoomIn.duration(220)}>
          <Avatar name={name || "?"} icon={icon} color={color} photo={previewPhoto} size={104} />
        </Animated.View>
        <Text style={[styles.previewName, !name.trim() && { color: colors.muted }]} numberOfLines={1}>
          {name.trim() || "Your name"}
        </Text>
      </View>

      <Text style={ui.label}>What should your family call you?</Text>
      <TextInput
        style={ui.input}
        value={name}
        onChangeText={setName}
        placeholder="e.g. Josh"
        placeholderTextColor={colors.muted}
        autoFocus={autoFocusName}
        autoCapitalize="words"
        autoCorrect={false}
        maxLength={40}
        returnKeyType="done"
      />

      <SectionHeader title="Your picture" icon="palette" />
      {profileId ? (
        <>
          <View style={[ui.row, { gap: 10 }]}>
            <Button
              title={hasPhoto ? "Change photo" : "Add a photo"}
              icon="camera"
              variant="secondary"
              style={{ flex: 1 }}
              onPress={photoOptions}
            />
            {hasPhoto ? (
              <Button
                title="Remove"
                icon="trash"
                variant="secondary"
                onPress={() => {
                  tap();
                  setNewPhoto(null);
                  setPhotoPath(null);
                }}
              />
            ) : null}
          </View>
          <Text style={ui.muted}>
            {hasPhoto
              ? "Your photo shows instead of the icon. The color and icon below are kept for if you take the photo away."
              : "Or skip the photo and pick a color and an icon (Aa for your initials)."}
          </Text>
        </>
      ) : null}
      <View style={[styles.swatches, hasPhoto && { opacity: 0.6 }]}>
        {avatarColors.map((swatch) => {
          const selected = color === swatch;
          return (
            <Tap
              key={swatch}
              pressedScale={0.85}
              onPress={() => {
                tap();
                setColor(swatch);
              }}
              style={[styles.swatch, { backgroundColor: swatch }, selected && styles.swatchSelected]}
              accessibilityLabel={selected ? "Selected color" : "Pick this color"}
            >
              {selected ? (
                <Animated.View entering={ZoomIn.duration(180)}>
                  <Icon name="check" size={18} color="#ffffff" />
                </Animated.View>
              ) : null}
            </Tap>
          );
        })}
      </View>
      <View style={[styles.swatches, hasPhoto && { opacity: 0.6 }]}>
        <Tap
          pressedScale={0.9}
          onPress={() => {
            tap();
            setIcon(null);
          }}
          style={[styles.iconChoice, icon === null && styles.iconChoiceSelected]}
          accessibilityLabel="Use my initials"
        >
          <Text style={{ fontSize: 15, fontWeight: "800", color: icon === null ? colors.onAccent : colors.bark }}>Aa</Text>
        </Tap>
        {avatarIcons.map((choice) => {
          const selected = icon === choice;
          return (
            <Tap
              key={choice}
              pressedScale={0.9}
              onPress={() => {
                tap();
                setIcon(choice);
              }}
              style={[styles.iconChoice, selected && styles.iconChoiceSelected]}
              accessibilityLabel={choice}
            >
              <Icon name={choice} size={22} color={selected ? colors.onAccent : colors.bark} />
            </Tap>
          );
        })}
      </View>

      <SectionHeader title="Birthday" icon="birthday" />
      {birthday ? (
        <Animated.View entering={FadeIn.duration(200)} style={[ui.card, { gap: 10 }]}>
          <View style={[ui.row, { justifyContent: "space-between" }]}>
            <Text style={ui.cardTitle}>{formatBirthday(birthday)}</Text>
            <Tap onPress={() => setBirthday(null)} hitSlop={8}>
              <Text style={ui.error}>Remove</Text>
            </Tap>
          </View>
          <DateField
            mode="date"
            value={parseDateString(birthday)}
            maximumDate={new Date()}
            onChange={(date) => setBirthday(toDateString(date))}
          />
        </Animated.View>
      ) : (
        <Button
          title="Add my birthday"
          icon="birthday"
          variant="secondary"
          onPress={() => setBirthday(toDateString(new Date(1990, 0, 1)))}
        />
      )}
      <Text style={ui.muted}>
        Optional. Family sees the day, not the year — and your Burrows will plan a Birthday Gathering for you each year.
      </Text>

      <SectionHeader title="About me" icon="person" />
      <TextInput
        style={[ui.input, { minHeight: 84, textAlignVertical: "top" }]}
        value={bio}
        onChangeText={setBio}
        placeholder="A line or two — favorite things, hobbies, anything fun"
        placeholderTextColor={colors.muted}
        multiline
        maxLength={160}
      />
      <Text style={[ui.muted, { textAlign: "right" }]}>{bio.length}/160</Text>

      <View style={[ui.row, { gap: 8, alignItems: "flex-start" }]}>
        <Icon name="group" size={16} color={colors.muted} style={{ marginTop: 2 }} />
        <Text style={[ui.muted, { flex: 1 }]}>
          Your name, picture, birthday and bio are visible to family in your Burrows — never to anyone else.
        </Text>
      </View>

      {error ? <Text style={ui.error}>{error}</Text> : null}
      <Button title={submitLabel} icon="check" onPress={submit} loading={isSaving} />
    </>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    previewName: { fontSize: 20, fontWeight: "800", color: colors.text, marginTop: 10, maxWidth: 260 },
    swatches: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    swatch: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2.5,
      borderColor: "transparent",
    },
    swatchSelected: { borderColor: colors.text },
    iconChoice: {
      width: 46,
      height: 46,
      borderRadius: 16,
      backgroundColor: colors.barkSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    iconChoiceSelected: { backgroundColor: colors.bark },
  })
);
