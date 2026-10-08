import { useEffect, useState } from "react";
import { Alert, View } from "react-native";
import { Text } from "./text";

import { friendlyError, tap } from "../lib/feedback";
import { allergens, diets, type Needs } from "../lib/potluck";
import { supabase } from "../lib/supabase";
import { ui } from "../lib/theme";
import { SectionHeader, Chip } from "./ui";

// Allergies and diets for one person (PROF-004) — yours, or a kid's if you
// manage them. Saved as you tap. Only family in their Burrows (and a kid's
// managers) can see them; Potlucks use them to warn about dishes (POT-005).
export function DietaryNeeds({ profileId, who }: { profileId: string; who: string }) {
  const [needs, setNeeds] = useState<Needs | null>(null);

  useEffect(() => {
    supabase
      .from("dietary_needs")
      .select("allergies, diets")
      .eq("profile_id", profileId)
      .maybeSingle()
      .then(({ data }) => setNeeds({ allergies: data?.allergies ?? [], diets: data?.diets ?? [] }));
  }, [profileId]);

  async function toggle(list: keyof Needs, key: string) {
    if (!needs) return;
    tap();
    const current = needs[list];
    const next = { ...needs, [list]: current.includes(key) ? current.filter((k) => k !== key) : [...current, key] };
    setNeeds(next);
    const { error } = await supabase
      .from("dietary_needs")
      .upsert({ profile_id: profileId, ...next, updated_at: new Date().toISOString() });
    if (error) {
      setNeeds(needs);
      Alert.alert("Couldn't save that", friendlyError(error));
    }
  }

  if (!needs) return null;

  return (
    <View style={{ gap: 12 }}>
      <SectionHeader title="Allergies & diets" icon="warning" />
      <Text style={ui.muted}>
        So whoever's cooking at a Potluck knows. Only family in {who === "you" ? "your" : "their"} Burrows can see this.
      </Text>
      <Text style={ui.label}>Allergies</Text>
      <View style={ui.chips}>
        {allergens.map((allergen) => (
          <Chip
            key={allergen.key}
            selected={needs.allergies.includes(allergen.key)}
            onPress={() => toggle("allergies", allergen.key)}
          >
            {allergen.label}
          </Chip>
        ))}
      </View>
      <Text style={ui.label}>Diets</Text>
      <View style={ui.chips}>
        {diets.map((diet) => (
          <Chip key={diet.key} selected={needs.diets.includes(diet.key)} onPress={() => toggle("diets", diet.key)}>
            {diet.label}
          </Chip>
        ))}
      </View>
    </View>
  );
}
