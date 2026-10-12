import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

import { useAuth } from "./auth-context";
import { guarded } from "./feedback";
import { cardSeason, nextBirthday, seasonStatus } from "./letterbox";
import { loadLetterbox, personBirthday, personName, type LetterboxData } from "./letterbox-data";
import { useHearthData } from "./hearth-data";

// Your Home's Letterbox for a screen, fresh each time it comes into view.
export function useLetterbox() {
  const [data, setData] = useState<LetterboxData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(
    () =>
      guarded(
        async () => {
          setData(await loadLetterbox());
          setError(null);
        },
        setError,
        () => setIsLoading(false)
      ),
    []
  );

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  return { data, error, isLoading, reload };
}

export type LetterboxSummary = {
  season: number;
  total: number;
  sent: number;
  toSend: { id: string; name: string }[];
  birthdays: { name: string; days: number; date: Date }[];
};

// What the Letterbox shows on the Hearth (LET-009): this season's holiday
// cards and the next birthdays. null while loading or if it can't load.
export function useLetterboxSummary(refreshKey: number) {
  const { session } = useAuth();
  const userId = session?.user.id;
  // Remembered between Hearth pages, so a page you've seen shows at once (CORE-104).
  return useHearthData(userId ? `letterbox:${userId}` : null, refreshKey, () =>
    loadLetterbox().then((data) => {
      const season = cardSeason();
      const status = seasonStatus(data.contacts, data.cards, season);
      const members = new Set(data.members.map((m) => m.profile_id));
      const birthdays = data.contacts
        .flatMap((h) =>
          h.letterbox_people
            .filter((p) => !p.profile_id || !members.has(p.profile_id))
            .map((p) => {
              const birthday = personBirthday(p, data);
              return birthday ? { name: personName(p, data), ...nextBirthday(birthday) } : null;
            })
        )
        .filter((b): b is NonNullable<typeof b> => b !== null)
        .sort((a, b) => a.days - b.days);
      return {
        season,
        total: status.total,
        sent: status.sent.length,
        toSend: status.toSend.map((h) => ({ id: h.id, name: h.name })),
        birthdays,
      };
    }));
}
