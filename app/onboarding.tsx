import { Redirect, useRouter } from "expo-router";
import { Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { IconBadge } from "../components/icon";
import { LoadingScreen } from "../components/motion";
import { NookScroll } from "../components/nook-scroll";
import { ProfileForm } from "../components/profile-form";
import { useAuth } from "../lib/auth-context";
import { friendlyError, tap } from "../lib/feedback";
import { planBirthdays } from "../lib/plan-birthdays";
import { useMyProfile } from "../lib/profile";
import { colors, ui } from "../lib/theme";

// First time in Nook (PROF-002): set up your profile before entering the
// Hearth. Name is required; everything else is optional and can be changed
// any time from Settings → Your profile.
export default function Onboarding() {
  const router = useRouter();
  const { session, isLoading: authLoading } = useAuth();
  const { profile, isLoading, save } = useMyProfile();

  if (!authLoading && !session) return <Redirect href="/sign-in" />;
  if (isLoading || authLoading) return <LoadingScreen cards={2} />;
  // Already done (or the profile can't be read): nothing to set up.
  if (!profile || profile.onboarded_at) return <Redirect href="/hearth" />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <NookScroll>
        <Animated.View entering={FadeInDown.duration(350)} style={{ alignItems: "center", gap: 8, paddingTop: 8 }}>
          <IconBadge name="hearth" size={64} />
          <Text style={{ fontSize: 28, fontWeight: "800", color: colors.text, textAlign: "center", letterSpacing: -0.4 }}>
            Welcome to Nook
          </Text>
          <Text style={[ui.muted, { textAlign: "center" }]}>
            Let's set up your profile so your family knows who's who. It takes a minute, and you can change it any
            time.
          </Text>
        </Animated.View>
        <View style={{ height: 4 }} />
        <ProfileForm
          initial={profile}
          autoFocusName
          submitLabel="Enter the Hearth"
          onSubmit={async (values) => {
            const { error } = await save({ ...values, onboarded_at: new Date().toISOString() });
            if (error) return friendlyError({ message: error });
            tap("success");
            planBirthdays(true);
            router.replace("/hearth");
            return null;
          }}
        />
      </NookScroll>
    </SafeAreaView>
  );
}
