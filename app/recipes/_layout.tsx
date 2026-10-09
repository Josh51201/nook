import { Redirect, Stack } from "expo-router";

import { nookStackOptions } from "../../components/nook-stack";
import { themedScreenLayout } from "../../components/themed-screen";
import { useAuth } from "../../lib/auth-context";
import { largeTitle, useTheme } from "../../lib/theme";

// The Recipe Box Nook (REC-001..012).
export default function RecipesLayout() {
  const { session, isLoading } = useAuth();
  useTheme();

  if (!isLoading && !session) {
    return <Redirect href="/sign-in" />;
  }

  return (
    <Stack screenLayout={themedScreenLayout} screenOptions={nookStackOptions as never}>
      <Stack.Screen name="index" options={{ title: "Recipe Box Nook", ...largeTitle }} />
      <Stack.Screen name="[id]" options={{ title: "Recipe" }} />
      <Stack.Screen name="form" options={{ title: "New recipe", presentation: "modal" }} />
      {/* Cook mode draws its own top bar with a Back button. The header must
          be hidden here, not from the screen: hiding a modal's header after
          it opens rebuilds the screen, over and over. */}
      <Stack.Screen name="cook" options={{ title: "Cook mode", presentation: "fullScreenModal", gestureEnabled: false, headerShown: false }} />
      <Stack.Screen name="settings" options={{ title: "Recipe Box Settings" }} />
    </Stack>
  );
}
