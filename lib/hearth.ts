import { defaultHearthLayout, type HearthLayout } from "./hearth-layout";
import { useNookSettings } from "./nook-settings";

export * from "./hearth-layout";

export function useHearthLayout() {
  const { settings, update, ...rest } = useNookSettings("hearth", defaultHearthLayout);
  const layout = settings as HearthLayout;
  return {
    layout,
    ...rest,
    save: (changes: Partial<HearthLayout>) => update(changes),
  };
}
