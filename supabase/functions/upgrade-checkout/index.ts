import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const secretKeysRaw = Deno.env.get("SUPABASE_SECRET_KEYS");
let secretKey: string | undefined;
if (secretKeysRaw) { try { const parsed = JSON.parse(secretKeysRaw); if (typeof parsed?.default === "string") secretKey = parsed.default; } catch { console.error("SUPABASE_SECRET_KEYS is not valid JSON."); } }
secretKey ||= Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || undefined;
if (!SUPABASE_URL || !secretKey) throw new Error("Upgrade checkout requires Supabase URL and a server-side secret key.");
const db = createClient(SUPABASE_URL, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
const plans = {
  personal_monthly: { label: "Customized Personal", amount: 2 },
  business_monthly: { label: "Customized Business", amount: 10 }
};
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin" };
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } }); }
function pesapalConfig() {
  const env = (Deno.env.get("PESAPAL_ENV") || "sandbox").toLowerCase();
  return {
    configured: Boolean(Deno.env.get("PESAPAL_CONSUMER_KEY") && Deno.env.get("PESAPAL_CONSUMER_SECRET") && Deno.env.get("PESAPAL_IPN_ID") && Deno.env.get("PESAPAL_CALLBACK_URL")),
    base: env === "live" || env === "production" ? "https://pay.pesapal.com/v3" : "https://cybqa.pesapal.com/pesapalv3"
  };
}
async function pesapalToken(base: string) {
  const consumer_key = Deno.env.get("PESAPAL_CONSUMER_KEY")!;
  const consumer_secret = Deno.env.get("PESAPAL_CONSUMER_SECRET")!;
  const response = await fetch(base + "/api/Auth/RequestToken", { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify({ consumer_key, consumer_secret }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.token) throw new Error(data?.error?.message || data?.message || "Pesapal authentication failed. Check the server-side credentials and environment.");
  return data.token as string;
}
async function createCheckout(payment: any, user: any, profile: any, plan: { label: string; amount: number }) {
  const config = pesapalConfig();
  if (!config.configured) return null;
  const token = await pesapalToken(config.base);
  const fullName = String(profile?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.name || "").trim();
  const parts = fullName.split(/\s+/).filter(Boolean);
  const email = String(user?.email || "").trim();
  const phone = String(profile?.phone || user?.phone || user?.user_metadata?.phone || "").trim();
  if (!email && !phone) throw new Error("Add a valid email address or phone number to your account before checkout.");
  const order = {
    id: payment.id,
    currency: payment.currency || "USD",
    amount: Number(payment.amount),
    description: "ZakiChat " + plan.label + " monthly upgrade",
    callback_url: Deno.env.get("PESAPAL_CALLBACK_URL"),
    cancellation_url: Deno.env.get("PESAPAL_CANCEL_URL") || Deno.env.get("PESAPAL_CALLBACK_URL"),
    notification_id: Deno.env.get("PESAPAL_IPN_ID"),
    redirect_mode: "TOP_WINDOW",
    billing_address: {
      email_address: email || undefined,
      phone_number: phone || undefined,
      country_code: "UG",
      first_name: parts[0] || "ZakiChat",
      last_name: parts.slice(1).join(" ") || "Customer"
    }
  };
  const response = await fetch(config.base + "/api/Transactions/SubmitOrderRequest", { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify(order) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.redirect_url || String(data.status) !== "200") throw new Error(data?.error?.message || data?.message || "Pesapal could not create the checkout request.");
  const { error: updateError } = await db.from("upgrade_payments").update({
    provider: "pesapal",
    payment_type: "automatic",
    payment_reference: payment.id,
    provider_transaction_id: data.order_tracking_id || null,
    metadata: { ...(payment.metadata || {}), checkout_state: "checkout_created", provider: "pesapal", pesapal_environment: config.base.includes("cybqa") ? "sandbox" : "live", redirect_url: data.redirect_url, order_tracking_id: data.order_tracking_id || null, merchant_reference: data.merchant_reference || payment.id }
  }).eq("id", payment.id).eq("status", "pending");
  if (updateError) throw updateError;
  return { redirectUrl: data.redirect_url as string, trackingId: data.order_tracking_id as string | undefined };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed." }, 405);
  const authorization = req.headers.get("Authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) return json({ success: false, error: "Sign in to request an upgrade." }, 401);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ success: false, error: "A valid JSON request body is required." }, 400); }
  const planId = typeof body.planId === "string" ? body.planId.trim() : "";
  const plan = plans[planId as keyof typeof plans];
  if (!plan) return json({ success: false, error: "Choose a valid upgrade plan." }, 400);
  try {
    const { data: authData, error: authError } = await db.auth.getUser(token);
    if (authError || !authData.user) return json({ success: false, error: "Your sign-in session is invalid or expired. Sign in again." }, 401);
    const user = authData.user;
    const { data: activeUpgrade, error: activeError } = await db.from("user_upgrades").select("id, plan, expires_at").eq("user_id", user.id).eq("status", "active").gt("expires_at", new Date().toISOString()).order("expires_at", { ascending: false }).limit(1).maybeSingle();
    if (activeError) throw activeError;
    if (activeUpgrade?.plan === planId) return json({ success: true, alreadyActive: true, checkoutReady: false, planId, message: "This plan is already active on your account." });

    const recentCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: existing, error: existingError } = await db.from("upgrade_payments").select("id, plan, amount, currency, status, created_at, provider, metadata").eq("user_id", user.id).eq("plan", planId).eq("status", "pending").gte("created_at", recentCutoff).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (existingError) throw existingError;
    let payment = existing;
    if (!payment) {
      const { data: inserted, error: insertError } = await db.from("upgrade_payments").insert({
        user_id: user.id, plan: planId, amount: plan.amount, currency: "USD", status: "pending", payment_type: "automatic", provider: null, payment_method: null,
        metadata: { request_source: "public_upgrade_button", plan_label: plan.label, billing_interval: "monthly", checkout_state: "awaiting_pesapal_configuration" }
      }).select("id, plan, amount, currency, status, created_at, provider, metadata").single();
      if (insertError) throw insertError;
      payment = inserted;
    }
    if (payment.provider === "pesapal" && payment.metadata?.redirect_url) {
      return json({ success: true, requestId: payment.id, planId, amount: Number(payment.amount), currency: payment.currency, status: payment.status, reused: true, checkoutReady: true, checkoutUrl: payment.metadata.redirect_url, message: "Continue to Pesapal to complete your payment." });
    }
    if (!pesapalConfig().configured) {
      return json({ success: true, requestId: payment.id, planId, amount: Number(payment.amount), currency: payment.currency, status: payment.status, reused: Boolean(existing), checkoutReady: false, provider: "pesapal", requiredConfiguration: ["PESAPAL_CONSUMER_KEY", "PESAPAL_CONSUMER_SECRET", "PESAPAL_IPN_ID", "PESAPAL_CALLBACK_URL"], message: "Your upgrade request is safely recorded. Pesapal checkout is not active yet; no charge has been made." });
    }
    const [{ data: profile, error: profileError }] = await Promise.all([db.from("profiles").select("full_name, phone").eq("id", user.id).maybeSingle()]);
    if (profileError) throw profileError;
    const checkout = await createCheckout(payment, user, profile, plan);
    if (!checkout) return json({ success: true, requestId: payment.id, planId, status: "pending", checkoutReady: false, provider: "pesapal", message: "Your request is recorded; Pesapal credentials still need configuration." });
    return json({ success: true, requestId: payment.id, planId, amount: Number(payment.amount), currency: payment.currency, status: payment.status, reused: Boolean(existing), checkoutReady: true, checkoutUrl: checkout.redirectUrl, message: "Continue to Pesapal to complete your payment. Your upgrade activates only after Pesapal confirms payment." });
  } catch (error) {
    console.error("Pesapal upgrade checkout failed:", error);
    return json({ success: false, error: error instanceof Error ? error.message : "Unable to create secure Pesapal checkout." }, 500);
  }
});
