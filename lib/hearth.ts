import { useMemo } from "react";

import { defaultHearthLayout, migrateLayout, starterItems, type HearthLayout } from "./hearth-layout";
import { useNookSettings } from "./nook-settings";

export * from "./hearth-layout";

export function useHearthLayout() {
  const { settings, update, isNew, ...rest } = useNookSettings("hearth", defaultHearthLayout);
  // Older Hearths (named sections) are converted to the grid on the fly and
  // saved in the new shape on the next change. Someone brand new starts with
  // a hello across the top (CORE-072), saved with their first change.
  const layout = useMemo(() => {
    const migrated = migrateLayout(settings as Parameters<typeof migrateLayout>[0]);
    return isNew ? { ...migrated, items: starterItems() } : migrated;
  }, [settings, isNew]);
  return {
    layout,
    ...rest,
    save: (changes: Partial<HearthLayout>) =>
      update({ version: 2, items: layout.items, sections: undefined, ...changes } as Partial<HearthLayout>),
  };
}
