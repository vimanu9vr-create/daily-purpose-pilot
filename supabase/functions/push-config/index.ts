// Hands the browser the VAPID public key that the sender is actually signing
// with.
//
// ## Why this function exists at all
//
// The public key used to come from `VITE_VAPID_PUBLIC_KEY`, baked into the
// bundle at build time, while the private key lived in Supabase's function
// secrets. Two halves of one key pair, stored in two different systems, with
// nothing keeping them in step.
//
// They drifted, and the failure was close to invisible. A build variable on
// the host silently overrode the `.env` file — Vite gives real environment
// variables precedence — so the deployed app kept handing out an old public
// key long after the file had been changed. The browser subscribed with the
// old key, the function signed with the new private key, and the push service
// rejected it:
//
//     the VAPID credentials in the authorization header do not correspond
//     to the credentials used to create the subscriptions
//
// Nothing in the app showed an error. The subscription existed, the send
// returned 200, and no notification ever arrived. Diagnosing it took hours,
// and every fix attempt looked like it had worked.
//
// So the key now comes from one place. The sender and the subscriber read the
// same secret from the same store, and a rotation cannot half-happen: change
// the pair in Supabase, and both ends move together on the next request.
//
// The public key is public by definition — it ships in every subscription
// request and in every app bundle. Serving it is not a disclosure.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");

  // Say which half is missing. "Notifications aren't configured" sent people
  // looking at the browser, when the answer was always a secret on the server.
  if (!publicKey) {
    return json(
      {
        error: "not_configured",
        message:
          "VAPID_PUBLIC_KEY is not set on this project. Set it, and VAPID_PRIVATE_KEY from the same generated pair, in the Edge Function secrets.",
      },
      503,
    );
  }

  // A sanity check on the shape, because a wrong-but-present value is worse
  // than a missing one: it produces subscriptions that fail later, somewhere
  // else, with a message that points at the wrong thing.
  //
  // A P-256 VAPID public key is 65 uncompressed bytes, base64url encoded —
  // 87 characters beginning with 'B'.
  const looksRight = /^B[A-Za-z0-9_-]{80,90}$/.test(publicKey);
  if (!looksRight) {
    console.error(`VAPID_PUBLIC_KEY is set but malformed (length ${publicKey.length})`);
    return json(
      {
        error: "malformed_key",
        message:
          "VAPID_PUBLIC_KEY does not look like a VAPID public key. It should be about 87 characters and start with 'B'. Check you didn't paste the private key, or a value with the angle brackets still attached.",
      },
      503,
    );
  }

  return json({ publicKey }, 200);
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json",
      // Short cache: long enough to avoid a request per subscribe, short
      // enough that a key rotation takes effect within the hour.
      "Cache-Control": "public, max-age=300",
    },
  });
}
