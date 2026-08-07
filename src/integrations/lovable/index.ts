import { supabase } from "../supabase/client";

/**
 * OAuth sign-in, through Supabase directly.
 *
 * This used to wrap @lovable.dev/cloud-auth-js, which was the only piece of
 * app behaviour genuinely tied to Lovable. Supabase has always had its own
 * signInWithOAuth doing the same job, so this drops the dependency without
 * changing how sign-in behaves.
 *
 * The shape of the return value is kept identical on purpose — `redirected`,
 * `error` — so the two call sites in auth.tsx didn't need touching. Worth
 * keeping that way: the surface is small and stable, and if the provider ever
 * changes again, only this file moves.
 *
 * Supabase redirects the browser to the provider, so `redirected: true` is the
 * normal path and the code after it never runs.
 */

type SignInOptions = {
  redirect_uri?: string;
  extraParams?: Record<string, string>;
};

type SignInResult = {
  redirected?: boolean;
  error?: Error;
};

export const lovable = {
  auth: {
    signInWithOAuth: async (
      provider: "google" | "apple" | "microsoft" | "lovable",
      opts?: SignInOptions,
    ): Promise<SignInResult> => {
      // Supabase speaks 'azure' rather than 'microsoft'; the other two match.
      // 'lovable' has no equivalent and is no longer offered anywhere in the UI.
      if (provider === "lovable") {
        return { error: new Error("That sign-in method is no longer available.") };
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: provider === "microsoft" ? "azure" : provider,
        options: {
          redirectTo: opts?.redirect_uri ?? `${window.location.origin}/app`,
          // Only set when present — the project runs exactOptionalPropertyTypes,
          // so passing an explicit undefined is a type error rather than a no-op.
          ...(opts?.extraParams ? { queryParams: opts.extraParams } : {}),
        },
      });

      if (error) return { error };

      // Supabase has navigated the browser away to the provider. Anything after
      // this point runs only if the redirect was blocked.
      return { redirected: true };
    },
  },
};
