import { useEffect, useState } from "react";

import { unreadByNook, type NookWaiting } from "./inbox";
import { supabase } from "./supabase";

// Unread notices per Nook (see unreadByNook), fetched again whenever
// `refreshKey` changes — e.g. each time the Nooks tab comes into view.
export function useUnreadByNook(refreshKey: unknown) {
  const [waiting, setWaiting] = useState<Record<string, NookWaiting>>({});
  useEffect(() => {
    let cancelled = false;
    supabase
      .from("notifications")
      .select("nook, title")
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(300)
      .then(({ data }) => {
        if (!cancelled) setWaiting(unreadByNook(data ?? []));
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);
  return waiting;
}
