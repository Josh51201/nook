import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";

import { useAuth } from "../lib/auth-context";
import { useMyProfile } from "../lib/profile";
import { isSupabaseConfigured } from "../lib/supabase";

export default function Index() {
  const { session, isLoading } = useAuth();
  const { isLoading: profileLoading, needsOnboarding } = useMyProfile();

  if (!isSupabaseConfigured) {
    return <Redirect href="/setup-needed" />;
  }

  if (isLoading || (session && profileLoading)) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!session) return <Redirect href="/sign-in" />;
  return <Redirect href={needsOnboarding ? "/onboarding" : "/hearth"} />;
}
