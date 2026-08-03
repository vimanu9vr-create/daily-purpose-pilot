// Permanently deletes a user's account and everything belonging to them.
//
// Required by App Store Review Guideline 5.1.1(v): apps that let people create
// an account must let them delete it from inside the app. Not a downgrade, not
// a support email — actual deletion.
//
// Order matters: storage objects first (they're not covered by the cascade),
// then the auth user, which cascades every table via ON DELETE CASCADE.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Identify the caller from their own token — never from the request body.
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: authHeader, apikey: anonKey },
    });
    if (!userRes.ok) return json({ error: "unauthorized" }, 401);
    const user = (await userRes.json()) as { id: string; email?: string };

    // Require explicit intent, so a stray call can't wipe an account.
    const body = (await req.json().catch(() => ({}))) as { confirm?: string };
    if (body.confirm !== "DELETE") {
      return json({ error: "confirmation_required", message: "Deletion was not confirmed." }, 400);
    }

    const admin = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    };

    // 1. Narration audio. Storage isn't reached by the database cascade.
    try {
      const listRes = await fetch(`${supabaseUrl}/storage/v1/object/list/narration`, {
        method: "POST",
        headers: admin,
        body: JSON.stringify({ prefix: user.id, limit: 1000 }),
      });
      if (listRes.ok) {
        const objects = (await listRes.json()) as { name: string }[];
        if (objects.length > 0) {
          await fetch(`${supabaseUrl}/storage/v1/object/narration`, {
            method: "DELETE",
            headers: admin,
            body: JSON.stringify({ prefixes: objects.map((o) => `${user.id}/${o.name}`) }),
          });
        }
      }
    } catch (error) {
      // Log, but never block deletion on orphaned audio files.
      console.error("storage cleanup failed", error);
    }

    // 2. Push subscriptions, so no notification can reach a deleted account
    //    even if the cascade were somehow delayed.
    await fetch(`${supabaseUrl}/rest/v1/push_subscriptions?user_id=eq.${user.id}`, {
      method: "DELETE",
      headers: { ...admin, Prefer: "return=minimal" },
    });

    // 3. The auth user. Every table references auth.users with ON DELETE
    //    CASCADE, so this removes desires, stories, affirmations, journals,
    //    habits, goals, chats and the profile in one go.
    const deleteRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${user.id}`, {
      method: "DELETE",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });

    if (!deleteRes.ok) {
      const detail = await deleteRes.text().catch(() => "");
      console.error("auth delete failed", deleteRes.status, detail);
      return json({ error: "delete_failed", message: "Couldn't delete the account." }, 500);
    }

    console.log(`deleted account ${user.id}`);
    return json({ deleted: true }, 200);
  } catch (error) {
    console.error("delete-account failed", error);
    return json({ error: "internal_error", message: "Something went wrong." }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
