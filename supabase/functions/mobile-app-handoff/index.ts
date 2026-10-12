import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const allowedOrigins = new Set(["https://zakpollyqueens.github.io","https://zakichat.local","http://zakichat.local","http://localhost","https://localhost","capacitor://localhost","ionic://localhost"]);
const headers = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : "https://zakpollyqueens.github.io",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin",
});
const json = (body: unknown, status = 200, origin: string | null = null) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers(origin), "Content-Type": "application/json", "Cache-Control": "no-store" } });
const randomToken = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, "0")).join("");
async function hashToken(token: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: headers(origin) });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405, origin);
  if (origin && !allowedOrigins.has(origin)) return json({ error: "Origin not allowed." }, 403, origin);
  const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  try {
    const body = await req.json();
    if (body?.action === "create") {
      const bearer = (req.headers.get("Authorization") || "").match(/^Bearer\s+(.+)$/i)?.[1];
      if (!bearer) return json({ error: "Sign in to the website before authorizing the mobile app." }, 401, origin);
      const { data: authUser, error: authError } = await admin.auth.getUser(bearer);
      if (authError || !authUser.user) return json({ error: "Your website session has expired. Please sign in again." }, 401, origin);
      const token = randomToken();
      const { error } = await admin.from("mobile_app_auth_handoffs").insert({
        user_id: authUser.user.id, token_hash: await hashToken(token),
        expires_at: new Date(Date.now() + 120000).toISOString(),
      });
      if (error) {
        console.error("Mobile handoff create failed:", error.message);
        return json({ error: "Could not authorize the mobile app. Please try again." }, 500, origin);
      }
      return json({ success: true, expiresInSeconds: 120, appUrl: "zakichat://auth-handoff?token=" + token }, 200, origin);
    }
    if (body?.action === "consume") {
      const token = typeof body.token === "string" ? body.token : "";
      if (!/^[a-f0-9]{64}$/.test(token)) return json({ error: "This authorization link is invalid. Please authorize again from Updates." }, 400, origin);
      const { data: claim, error: claimError } = await admin.from("mobile_app_auth_handoffs")
        .update({ consumed_at: new Date().toISOString() })
        .eq("token_hash", await hashToken(token)).is("consumed_at", null)
        .gt("expires_at", new Date().toISOString()).select("user_id").maybeSingle();
      if (claimError) {
        console.error("Mobile handoff claim failed:", claimError.message);
        return json({ error: "Authorization could not be completed. Please try again." }, 500, origin);
      }
      if (!claim?.user_id) return json({ error: "This authorization has expired or has already been used. Return to the website and authorize again." }, 401, origin);
      const { data: account, error: accountError } = await admin.auth.admin.getUserById(claim.user_id);
      const email = account?.user?.email;
      if (accountError || !email) return json({ error: "The account could not be opened. Please sign in on the website and authorize again." }, 401, origin);
      const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email });
      const hashedOtp = link?.properties?.hashed_token;
      if (linkError || !hashedOtp) {
        console.error("Mobile session mint failed:", linkError?.message || "missing hashed token");
        return json({ error: "A mobile session could not be created. Please try again." }, 500, origin);
      }
      const publicAuth = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
      const { data: sessionData, error: sessionError } = await publicAuth.auth.verifyOtp({ type: "magiclink", token_hash: hashedOtp });
      if (sessionError || !sessionData.session) {
        console.error("Mobile session exchange failed:", sessionError?.message || "missing session");
        return json({ error: "The mobile session could not be opened. Please authorize again." }, 500, origin);
      }
      return json({
        success: true,
        session: {
          access_token: sessionData.session.access_token,
          refresh_token: sessionData.session.refresh_token,
          expires_at: sessionData.session.expires_at,
          expires_in: sessionData.session.expires_in,
          token_type: sessionData.session.token_type,
        },
        user: { id: sessionData.user.id, email: sessionData.user.email, user_metadata: sessionData.user.user_metadata || {} },
      }, 200, origin);
    }
    return json({ error: "Unsupported action." }, 400, origin);
  } catch (error) {
    console.error("Mobile handoff request failed:", error instanceof Error ? error.message : "unknown error");
    return json({ error: "The mobile app authorization request could not be processed." }, 500, origin);
  }
});
