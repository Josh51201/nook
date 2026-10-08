import { Redirect, Stack } from "expo-router";

import { nookStackOptions } from "../../components/nook-stack";
import { themedScreenLayout } from "../../components/themed-screen";
import { useAuth } from "../../lib/auth-context";
import { largeTitle, useTheme } from "../../lib/theme";

// The Letterbox Nook (LET-001..011): the card list and address book you share with your Home.
export default function LetterboxLayout() {
  const { session, isLoading } = useAuth();
  useTheme();

  if (!isLoading && !session) {
    return <Redirect href="/sign-in" />;
  }

  return (
    <Stack screenLayout={themedScreenLayout} screenOptions={nookStackOptions as never}>
      <Stack.Screen name="index" options={{ title: "Letterbox Nook", ...largeTitle }} />
      <Stack.Screen name="contact/[id]" options={{ title: "Contact" }} />
      <Stack.Screen name="contact-form" options={{ title: "Contact", presentation: "modal" }} />
      <Stack.Screen name="card-form" options={{ title: "A card", presentation: "modal" }} />
      <Stack.Screen name="season" options={{ title: "Card season" }} />
      <Stack.Screen name="thanks" options={{ title: "Thank-yous" }} />
      <Stack.Screen name="thanks-form" options={{ title: "A thank-you", presentation: "modal" }} />
      <Stack.Screen name="add-family" options={{ title: "Add family", presentation: "modal" }} />
      <Stack.Screen name="settings" options={{ title: "Letterbox Nook Settings" }} />
    </Stack>
  );
}
