import { createClient } from "npm:@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL") || "";
const anon = Deno.env.get("SUPABASE_ANON_KEY") || "";
const resendKey = Deno.env.get("RESEND_API_KEY") || "";
const sender = Deno.env.get("ZAKICHAT_EMAIL_FROM") || "";
const origin = "https://zakpollyqueens.github.io";
const callback = "https://zakpollyqueens.github.io/ZakiChat-/pages/auth-callback.html";
const headers = {
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json", "Cache-Control": "no-store" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return reply({ error: "POST required." }, 405);
  if (req.headers.get("Origin") && req.headers.get("Origin") !== origin) return reply({ error: "Origin not authorized." }, 403);
  try {
    const body = await req.json().catch(() => ({}));
    if (body.action !== "start") return reply({ error: "Unknown action." }, 400);
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!email || !password || password.length > 1024) return reply({ error: "Enter your recovery email and password." }, 400);
    if (!url || !anon) return reply({ error: "Secure sign-in is not configured on the server." }, 503);
    if (!resendKey || !sender) return reply({ error: "Email delivery is not configured for secure sign-in yet. Please contact ZakiChat support." }, 503);

    const verifier = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const { data, error } = await verifier.auth.signInWithPassword({ email, password });
    if (error || !data.user) return reply({ error: "Unable to sign in with those details. Check your email and password." }, 401);
    if (!data.user.email_confirmed_at) return reply({ error: "Verify your email address before signing in." }, 403);

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!serviceKey) return reply({ error: "Secure sign-in server configuration is incomplete." }, 503);
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const { data: generated, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink", email, options: { redirectTo: callback },
    });
    if (linkError || !generated.properties?.action_link) {
      console.error("Could not generate sign-in link:", linkError);
      return reply({ error: "Could not prepare a verification link. Please try again." }, 500);
    }

    const html = '<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:28px;color:#102033"><div style="background:#071a2b;padding:22px;border-radius:16px;color:#fff"><div style="color:#42d9f5;font-size:12px;font-weight:700;letter-spacing:2px">ZAKICHAT SECURITY</div><h1>Confirm your sign-in</h1><p style="color:#d4e6f0">A correct password was entered for your account. Confirm it is you to continue.</p></div><p>This link is one-time use. If you did not try to sign in, ignore this email and consider changing your password.</p><p style="margin:28px 0"><a href="' + generated.properties.action_link + '" style="background:#08b9dc;color:#031321;text-decoration:none;padding:14px 22px;border-radius:10px;font-weight:700;display:inline-block">Verify and sign in</a></p></div>';
    const sent = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + resendKey, "Content-Type": "application/json" },
      body: JSON.stringify({ from: sender, to: [email], subject: "Verify your ZakiChat sign-in", html, text: "Confirm your ZakiChat sign-in with this one-time link: " + generated.properties.action_link }),
    });
    if (!sent.ok) {
      console.error("Email delivery failed:", sent.status, (await sent.text()).slice(0, 300));
      return reply({ error: "We could not send the verification email. Please try again later." }, 502);
    }
    return reply({ success: true, verificationRequired: true, message: "A sign-in verification link has been sent to your recovery email. Open it to finish signing in." });
  } catch (error) {
    console.error("email-login error:", error);
    return reply({ error: "Secure sign-in failed. Please try again later." }, 500);
  }
});
