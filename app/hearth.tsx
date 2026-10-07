import { Redirect } from "expo-router";
import { View } from "react-native";

import { HearthScreen } from "../components/hearth/hearth-screen";
import { useAuth } from "../lib/auth-context";
import { hearthThemes, useHearthLayout } from "../lib/hearth";
import { useMyProfile } from "../lib/profile";

// CORE-002/003/006-010/018/019/022-024: the Hearth — your home screen. All
// the designing (and Hollows) lives in HearthScreen, which also draws the
// inside of each Hollow.
export default function Hearth() {
  const { session, isLoading: authLoading } = useAuth();
  const { needsOnboarding, isLoading: profileLoading } = useMyProfile();
  const { layout } = useHearthLayout();
  const theme = hearthThemes[layout.theme] ?? hearthThemes.hearth;

  if (!authLoading && !session) return <Redirect href="/sign-in" />;

  // New here? Set up your profile before entering the Hearth.
  if (needsOnboarding) return <Redirect href="/onboarding" />;

  // Wait for the profile (instant after the first time) so the Hearth never
  // flashes before a new person is sent to the welcome screen.
  if (session && profileLoading) return <View style={{ flex: 1, backgroundColor: theme.background }} />;

  return <HearthScreen scope={null} />;
}
