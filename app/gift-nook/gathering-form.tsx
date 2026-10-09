import { Redirect, useLocalSearchParams } from "expo-router";

// Gatherings are planned in the Gathering Nook now (GATH-002), with gift
// lists switched on when they come from here. Old links land there.
export default function GatheringFormRedirect() {
  const params = useLocalSearchParams<{ burrowId?: string; gatheringId?: string }>();
  return (
    <Redirect
      href={{
        pathname: "/gatherings/form",
        params: { ...(params.gatheringId ? { gatheringId: params.gatheringId } : { gifts: "1" }), ...(params.burrowId ? { burrowId: params.burrowId } : {}) },
      }}
    />
  );
}
