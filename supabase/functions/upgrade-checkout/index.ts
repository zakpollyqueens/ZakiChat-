import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const secretKeysRaw = Deno.env.get("SUPABASE_SECRET_KEYS");
let secretKey: string | undefined;
if (secretKeysRaw) {
  try {
    const parsed = JSON.parse(secretKeysRaw);
    if (typeof parsed?.default === "string") secretKey = parsed.default;
  } catch {
    console.error("SUPABASE_SECRET_KEYS is not valid JSON.");
  }
}
secretKey ||= Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || undefined;
if (!SUPABASE_URL || !secretKey) {
  throw new Error("Upgrade request API requires Supabase URL and a server-side secret key.");
}

const db = createClient(SUPABASE_URL, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});
const plans = {
  personal_monthly: { label: "Personal", amount: 2 },
  business_monthly: { label: "Business", amount: 10 }
};
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin"
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed." }, 405);

  const authorization = req.headers.get("Authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) return json({ success: false, error: "Sign in to request an upgrade." }, 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: "A valid JSON request body is required." }, 400);
  }

  const planId = typeof body.planId === "string" ? body.planId.trim() : "";
  const plan = plans[planId as keyof typeof plans];
  if (!plan) return json({ success: false, error: "Choose a valid upgrade plan." }, 400);

  try {
    const { data: authData, error: authError } = await db.auth.getUser(token);
    if (authError || !authData.user) return json({ success: false, error: "Your sign-in session is invalid or expired. Sign in again." }, 401);
    const userId = authData.user.id;

    const { data: activeUpgrade, error: activeError } = await db.from("user_upgrades")
      .select("id, plan, expires_at")
      .eq("user_id", userId)
      .eq("status", "active")
      .gt("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (activeError) throw activeError;
    if (activeUpgrade?.plan === planId) {
      return json({
        success: true,
        alreadyActive: true,
        checkoutReady: false,
        planId,
        message: "This plan is already active on your account."
      });
    }

    const recentCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: existing, error: existingError } = await db.from("upgrade_payments")
      .select("id, plan, amount, currency, status, created_at")
      .eq("user_id", userId)
      .eq("plan", planId)
      .eq("status", "pending")
      .gte("created_at", recentCutoff)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingError) throw existingError;

    if (existing) {
      return json({
        success: true,
        requestId: existing.id,
        planId,
        amount: Number(existing.amount),
        currency: existing.currency,
        status: existing.status,
        reused: true,
        checkoutReady: false,
        message: "Your upgrade request is already recorded. Secure payment checkout is not configured yet, so no charge has been made."
      });
    }

    const { data: payment, error: insertError } = await db.from("upgrade_payments").insert({
      user_id: userId,
      plan: planId,
      amount: plan.amount,
      currency: "USD",
      status: "pending",
      payment_type: "automatic",
      provider: null,
      payment_method: null,
      metadata: {
        request_source: "public_upgrade_button",
        plan_label: plan.label,
        billing_interval: "monthly",
        checkout_state: "provider_not_configured"
      }
    }).select("id, plan, amount, currency, status, created_at").single();

    if (insertError) throw insertError;
    return json({
      success: true,
      requestId: payment.id,
      planId,
      amount: Number(payment.amount),
      currency: payment.currency,
      status: payment.status,
      reused: false,
      checkoutReady: false,
      message: "Your upgrade request has been recorded. Secure payment checkout is not configured yet, so no charge has been made."
    });
  } catch (error) {
    console.error("Upgrade request failed:", error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : "Unable to record the upgrade request."
    }, 500);
  }
});
