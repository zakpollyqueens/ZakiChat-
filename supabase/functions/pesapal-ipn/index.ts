import { createClient } from "npm:@supabase/supabase-js@2";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const secretKeysRaw = Deno.env.get("SUPABASE_SECRET_KEYS");
let secretKey: string | undefined;
if (secretKeysRaw) { try { const parsed = JSON.parse(secretKeysRaw); if (typeof parsed?.default === "string") secretKey = parsed.default; } catch { console.error("SUPABASE_SECRET_KEYS is not valid JSON."); } }
secretKey ||= Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || undefined;
if (!SUPABASE_URL || !secretKey) throw new Error("Pesapal IPN requires server-side Supabase credentials.");
const db = createClient(SUPABASE_URL, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
const env = (Deno.env.get("PESAPAL_ENV") || "sandbox").toLowerCase();
const base = env === "live" || env === "production" ? "https://pay.pesapal.com/v3" : "https://cybqa.pesapal.com/pesapalv3";
function reply(body: unknown, status=200) { return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }); }
async function getToken() {
  const key = Deno.env.get("PESAPAL_CONSUMER_KEY"), secret = Deno.env.get("PESAPAL_CONSUMER_SECRET");
  if (!key || !secret) throw new Error("Pesapal credentials are not configured.");
  const response = await fetch(base + "/api/Auth/RequestToken", { method:"POST", headers:{Accept:"application/json","Content-Type":"application/json"}, body:JSON.stringify({consumer_key:key,consumer_secret:secret}) });
  const data = await response.json().catch(()=>({}));
  if (!response.ok || !data.token) throw new Error(data?.error?.message || data?.message || "Pesapal authentication failed.");
  return data.token as string;
}
Deno.serve(async (req: Request) => {
  if (req.method !== "GET" && req.method !== "POST") return reply({ status: 405, message: "Method not allowed." },405);
  let params: Record<string,string> = {};
  if (req.method === "GET") {
    const u = new URL(req.url); u.searchParams.forEach((v,k)=>params[k]=v);
  } else {
    const type = req.headers.get("content-type") || "";
    if (type.includes("application/json")) { const body = await req.json().catch(()=>({})); params = Object.fromEntries(Object.entries(body).map(([k,v])=>[k,String(v??"")])); }
    else { const body = new URLSearchParams(await req.text()); body.forEach((v,k)=>params[k]=v); }
  }
  const trackingId = params.OrderTrackingId || params.orderTrackingId || "";
  const merchantReference = params.OrderMerchantReference || params.orderMerchantReference || "";
  const notificationType = params.OrderNotificationType || params.orderNotificationType || "IPNCHANGE";
  if (!trackingId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(merchantReference)) {
    return reply({ orderNotificationType: notificationType, orderTrackingId: trackingId, orderMerchantReference: merchantReference, status: 400 },400);
  }
  try {
    const { data: payment, error: paymentError } = await db.from("upgrade_payments").select("id, amount, currency, status, provider, provider_transaction_id").eq("id",merchantReference).eq("provider","pesapal").maybeSingle();
    if (paymentError) throw paymentError;
    if (!payment) return reply({ orderNotificationType: notificationType, orderTrackingId: trackingId, orderMerchantReference: merchantReference, status: 404 },404);
    const token = await getToken();
    const statusResponse = await fetch(base + "/api/Transactions/GetTransactionStatus?orderTrackingId=" + encodeURIComponent(trackingId), { headers:{Accept:"application/json",Authorization:"Bearer "+token} });
    const statusData = await statusResponse.json().catch(()=>({}));
    if (!statusResponse.ok) throw new Error(statusData?.error?.message || statusData?.message || "Unable to verify Pesapal transaction status.");
    const actualReference = String(statusData.merchant_reference || statusData.merchantReference || "");
    if (actualReference && actualReference !== merchantReference) throw new Error("Pesapal merchant reference did not match this payment request.");
    const paymentStatus = String(statusData.payment_status_description || "").toUpperCase();
    if (paymentStatus === "COMPLETED") {
      const result = await db.rpc("confirm_pesapal_upgrade", {
        p_payment_id: merchantReference,
        p_tracking_id: trackingId,
        p_amount: Number(statusData.amount),
        p_currency: String(statusData.currency || ""),
        p_payment_method: String(statusData.payment_method || ""),
        p_confirmation_code: String(statusData.confirmation_code || "")
      });
      if (result.error) throw result.error;
    } else if (["FAILED","REVERSED","INVALID"].includes(paymentStatus)) {
      await db.from("upgrade_payments").update({status:"failed",updated_at:new Date().toISOString(),metadata:{pesapal_status:paymentStatus,pesapal_tracking_id:trackingId,pesapal_description:String(statusData.description||"")}}).eq("id",merchantReference).eq("status","pending");
    }
    return reply({ orderNotificationType: notificationType, orderTrackingId: trackingId, orderMerchantReference: merchantReference, status: 200 });
  } catch (error) {
    console.error("Pesapal IPN processing failed:",error);
    return reply({ orderNotificationType: notificationType, orderTrackingId: trackingId, orderMerchantReference: merchantReference, status: 500, message: error instanceof Error ? error.message : "Unable to process Pesapal notification." },500);
  }
});
