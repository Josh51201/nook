import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";

import { DietaryNeeds } from "../../../components/dietary-needs";
import { LoadingScreen } from "../../../components/motion";
import { NookScroll } from "../../../components/nook-scroll";
import { ProfileForm } from "../../../components/profile-form";
import { EmptyState } from "../../../components/ui";
import { friendlyError, tap } from "../../../lib/feedback";
import { planBirthdays } from "../../../lib/plan-birthdays";
import { PROFILE_SELECT, type MyProfile } from "../../../lib/profile";
import { supabase } from "../../../lib/supabase";

// A manager edits a kid's picture, birthday and "about me" (PROF-003), and
// their allergies and diets (PROF-004). The
// database only lets the kid's managers do this (profiles update policy).
export default function ManagedProfile() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("profiles")
      .select(PROFILE_SELECT)
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
        setProfile((data as MyProfile | null) ?? null);
        setIsLoading(false);
      });
  }, [id]);

  if (isLoading) return <LoadingScreen cards={2} />;
  if (!profile) return <EmptyState icon="kid" title="Couldn't load that profile" />;

  return (
    <NookScroll>
      <Stack.Screen options={{ title: `${profile.display_name ?? "Their"} profile` }} />
      <ProfileForm
        initial={profile}
        submitLabel="Save"
        onSubmit={async (values) => {
          const { error } = await supabase.from("profiles").update(values).eq("id", id);
          if (error) return friendlyError(error);
          tap("success");
          planBirthdays(true);
          router.back();
          return null;
        }}
      />
      <DietaryNeeds profileId={id} who={profile.display_name ?? "them"} />
    </NookScroll>
  );
}
