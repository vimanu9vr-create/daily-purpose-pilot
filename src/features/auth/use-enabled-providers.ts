import { useEffect, useState } from "react";

/**
 * Which social sign-in providers this backend actually has configured.
 *
 * Without this, the Google and Apple buttons are always shown and always fail
 * when the provider isn't set up — the raw error being
 * `{"code":400,"error_code":"validation_failed","msg":"Unsupported provider:
 * provider is not enabled"}`, which reached a real person and meant nothing to
 * them. Worse, the handler said "please try again", and trying again could
 * never work.
 *
 * A button that cannot succeed is worse than no button. Supabase publishes its
 * enabled providers at /auth/v1/settings, so we ask, and only render the ones
 * that can actually work.
 *
 * Fails open: if the probe itself fails we show the buttons, because a network
 * blip shouldn't remove someone's only way in.
 */

export type EnabledProviders = {
  google: boolean;
  apple: boolean;
  /** False until the probe finishes, so nothing flashes in and out. */
  resolved: boolean;
};

export function useEnabledProviders(): EnabledProviders {
  const [state, setState] = useState<EnabledProviders>({
    google: false,
    apple: false,
    resolved: false,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const url = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
    const key = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string | undefined;
    if (!url || !key) {
      setState({ google: true, apple: true, resolved: true });
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } });
        if (!response.ok) throw new Error(String(response.status));

        const settings = (await response.json()) as {
          external?: Record<string, boolean>;
        };
        if (cancelled) return;

        setState({
          google: settings.external?.["google"] === true,
          apple: settings.external?.["apple"] === true,
          resolved: true,
        });
      } catch {
        // Show them rather than lock someone out over a failed probe.
        if (!cancelled) setState({ google: true, apple: true, resolved: true });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
