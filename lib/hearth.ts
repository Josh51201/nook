import { useMemo } from "react";

import { defaultHearthLayout, migrateLayout, type HearthLayout } from "./hearth-layout";
import { useNookSettings } from "./nook-settings";

export * from "./hearth-layout";

export function useHearthLayout() {
  const { settings, update, ...rest } = useNookSettings("hearth", defaultHearthLayout);
  // Older Hearths (named sections) are converted to the grid on the fly and
  // saved in the new shape on the next change.
  const layout = useMemo(() => migrateLayout(settings as Parameters<typeof migrateLayout>[0]), [settings]);
  return {
    layout,
    ...rest,
    save: (changes: Partial<HearthLayout>) =>
      update({ version: 2, items: layout.items, sections: undefined, ...changes } as Partial<HearthLayout>),
  };
}
