import { useRouter } from "expo-router";

import { LoadingScreen } from "../components/motion";
import { NookScroll } from "../components/nook-scroll";
import { ProfileForm } from "../components/profile-form";
import { EmptyState } from "../components/ui";
import { friendlyError, tap } from "../lib/feedback";
import { planBirthdays } from "../lib/plan-birthdays";
import { useMyProfile } from "../lib/profile";

// Edit your profile any time (PROF-001).
export default function EditProfile() {
  const router = useRouter();
  const { profile, isLoading, save } = useMyProfile();

  if (isLoading) return <LoadingScreen cards={2} />;
  if (!profile) {
    return <EmptyState icon="person" title="Couldn't load your profile" body="Check your connection and try again." />;
  }

  return (
    <NookScroll>
      <ProfileForm
        initial={profile}
        submitLabel="Save"
        onSubmit={async (values) => {
          const { error } = await save({ ...values, onboarded_at: profile.onboarded_at ?? new Date().toISOString() });
          if (error) return friendlyError({ message: error });
          tap("success");
          planBirthdays(true); // your birthday may now be inside the 30-day window
          router.back();
          return null;
        }}
      />
    </NookScroll>
  );
}
