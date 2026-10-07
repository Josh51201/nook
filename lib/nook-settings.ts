import { useCallback, useEffect, useState } from "react";

import { useAuth } from "./auth-context";
import { supabase } from "./supabase";

// Settings for the Hearth or one Nook, saved to the account
// (public.nook_settings) so they follow you across devices. Saved values
// are merged over `defaults`, so adding a new setting needs no migration.
export function useNookSettings<T extends Record<string, unknown>>(nook: string, defaults: T) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [settings, setSettings] = useState<T>(defaults);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from("nook_settings")
      .select("settings")
      .eq("profile_id", userId)
      .eq("nook", nook)
      .maybeSingle()
      .then(({ data }) => {
        setSettings({ ...defaults, ...(data?.settings ?? {}) });
        setIsLoading(false);
      });
    // `defaults` is a literal at each call site; only reload when the Nook or user changes.
  }, [nook, userId]);

  const update = useCallback(
    async (changes: Partial<T>) => {
      if (!userId) return;
      const next = { ...settings, ...changes };
      setSettings(next);
      const { error } = await supabase.from("nook_settings").upsert(
        { profile_id: userId, nook, settings: next, updated_at: new Date().toISOString() },
        { onConflict: "profile_id,nook" }
      );
      if (error) throw error;
    },
    [nook, settings, userId]
  );

  return { settings, update, isLoading };
}

// Gift Nook settings and their defaults. Provisional list pending Q-019.
export const giftNookSettingDefaults = {
  hideTakenGifts: false,
};
