import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";

import { useAuth } from "../lib/auth-context";
import { isSupabaseConfigured } from "../lib/supabase";

export default function Index() {
  const { session, isLoading } = useAuth();

  if (!isSupabaseConfigured) {
    return <Redirect href="/setup-needed" />;
  }

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return <Redirect href={session ? "/hearth" : "/sign-in"} />;
}
