import { useEffect } from "react";

import { useUserId } from "@/hooks/use-session-user";
import { supabase } from "@/integrations/supabase/client";

/**
 * Keeps the stored timezone matching the device.
 *
 * This exists because of a real bug: `timezone` defaulted to 'UTC' and was
 * only ever written when someone changed their delivery time. Anyone who left
 * the default 07:00 kept UTC — so a 7am alarm in India fired at 12:30pm, and
 * the morning notification arrived in the middle of the day.
 *
 * Runs once per session, writes only when the value actually differs.
 */
export function useTimezoneSync() {
  const userId = useUserId();

  useEffect(() => {
    if (!userId || typeof window === "undefined") return;

    const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!deviceZone) return;

    let cancelled = false;

    void (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("timezone")
        .eq("id", userId)
        .maybeSingle();
      if (error || cancelled || !data) return;
      if (data.timezone === deviceZone) return;

      await supabase.from("profiles").update({ timezone: deviceZone }).eq("id", userId);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);
}
