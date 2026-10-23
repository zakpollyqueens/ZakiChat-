import { createClient } from "npm:@supabase/supabase-js@2";
import { parsePhoneNumberFromString } from "npm:libphonenumber-js@1.11.20";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const secretKeysRaw = Deno.env.get("SUPABASE_SECRET_KEYS");
let secretKey: string | undefined;
if (secretKeysRaw) { try { const parsed = JSON.parse(secretKeysRaw); if (typeof parsed?.default === "string") secretKey = parsed.default; } catch { console.error("SUPABASE_SECRET_KEYS is not valid JSON."); } }
secretKey ||= Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || undefined;
const JJUMA_PUBLIC_KEY = Deno.env.get("JJUMA_PUBLIC_API_KEY") || "";
const JJUMA_SECRET_KEY = Deno.env.get("JJUMA_SECRET_API_KEY") || "";
const JJUMA_WEBHOOK_SECRET = Deno.env.get("JJUMA_WEBHOOK_SECRET") || "";
const API_BASE = "https://api.jjuma.com/api/v1";
if (!SUPABASE_URL || !secretKey) throw new Error("Upgrade checkout requires Supabase server credentials.");
const db = createClient(SUPABASE_URL, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
const plans = { personal_monthly: { label: "Customized Personal", amount: 2 }, business_monthly: { label: "Customized Business", amount: 10 } };
const currencies: Record<string,string> = { UG:"UGX", KE:"KES", TZ:"TZS", US:"USD", GB:"GBP", CA:"CAD", AU:"AUD", NZ:"NZD", ZA:"ZAR", NG:"NGN", GH:"GHS", RW:"RWF", IN:"INR", PK:"PKR", BD:"BDT", JP:"JPY", CN:"CNY", SG:"SGD", MY:"MYR", ID:"IDR", PH:"PHP", TH:"THB", AE:"AED", SA:"SAR", EG:"EGP", ZM:"ZMW", MW:"MWK", MZ:"MZN", NA:"NAD", BW:"BWP", CM:"XAF", SN:"XOF", ET:"ETB" };
const corsHeaders = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods":"POST, OPTIONS", "Vary":"Origin" };
function json(body: unknown, status=200) { return new Response(JSON.stringify(body), { status, headers:{...corsHeaders,"Content-Type":"application/json","Cache-Control":"no-store"} }); }
async function localPrice(usd:number, phone:string) {
  let countryCode=""; try { countryCode=parsePhoneNumberFromString(phone||"")?.country||""; } catch {}
  if (!countryCode) return { amount:usd, currency:"USD", countryCode:"", fxRate:1, rateTime:"" };
  let currency=currencies[countryCode]||"";
  if (!currency) { try { const r=await fetch("https://restcountries.com/v3.1/alpha/"+encodeURIComponent(countryCode)+"?fields=currencies"); const d=await r.json(); currency=Object.keys((Array.isArray(d)?d[0]:d)?.currencies||{})[0]||""; } catch {} }
  if (!currency) throw new Error("Could not determine your billing currency. Please retry.");
  if (currency==="USD") return { amount:usd,currency,countryCode,fxRate:1,rateTime:"" };
  const r=await fetch("https://open.er-api.com/v6/latest/USD",{headers:{Accept:"application/json"},cache:"no-store"});
  const d=await r.json().catch(()=>({})), rate=Number(d?.rates?.[currency]);
  if (!r.ok||d.result!=="success"||!Number.isFinite(rate)||rate<=0) throw new Error("Live exchange rates are unavailable. No payment was made.");
  const digits=new Intl.NumberFormat("en",{style:"currency",currency}).resolvedOptions().maximumFractionDigits, factor=10**digits;
  return { amount:Math.round(usd*rate*factor)/factor,currency,countryCode,fxRate:rate,rateTime:String(d.time_last_update_utc||"") };
}
async function jjumaCreateCheckout(payment:any,user:any,profile:any,plan:{label:string;amount:number},countryCode:string) {
  if (!JJUMA_PUBLIC_KEY || !JJUMA_SECRET_KEY || !JJUMA_WEBHOOK_SECRET) throw new Error("JJuma Pay is not configured for Molan Chat yet. Configure JJUMA_PUBLIC_API_KEY, JJUMA_SECRET_API_KEY and JJUMA_WEBHOOK_SECRET in the ZakiChat Supabase project.");
  const name=String(profile?.full_name||user.user_metadata?.full_name||user.user_metadata?.name||"Molan Chat customer").trim();
  const phone=String(profile?.phone||user.phone||user.user_metadata?.phone||"").trim();
  if (!user.email&&!phone) throw new Error("Add an email address or phone number to your account before checkout.");
  const webhookUrl=Deno.env.get("JJUMA_WEBHOOK_URL")||SUPABASE_URL+"/functions/v1/jjuma-webhook";
  const payload={amount:Number(payment.amount),currency:String(payment.currency).toUpperCase(),email:user.email||undefined,phone_number:phone||undefined,customer_name:name,description:"Molan Chat "+plan.label+" monthly upgrade",return_url:"https://zakpollyqueens.github.io/ZakiChat-/pages/settings.html?upgrade=return",cancel_redirect_url:"https://zakpollyqueens.github.io/ZakiChat-/pages/settings.html?upgrade=cancelled",webhook_url:webhookUrl,external_order_id:payment.id,idempotency_key:payment.id,metadata:{product:"molan_chat_upgrade",user_id:user.id,plan_code:payment.plan,upgrade_payment_id:payment.id,country_code:countryCode,usd_amount:plan.amount}};
  const response=await fetch(API_BASE+"/payments/create",{method:"POST",headers:{Authorization:"Bearer "+JJUMA_PUBLIC_KEY,"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify(payload)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||data?.success!==true||!data?.data?.transaction_id||typeof data?.data?.payment_url!=="string") throw new Error(data?.message||"JJuma Pay could not create checkout.");
  const url=new URL(data.data.payment_url); if(url.protocol!=="https:"||url.hostname!=="pay.jjuma.com") throw new Error("JJuma Pay returned an untrusted checkout URL.");
  const tx=String(data.data.transaction_id);
  const {error}=await db.from("upgrade_payments").update({provider:"jjuma",provider_transaction_id:tx,payment_reference:tx,metadata:{...(payment.metadata||{}),checkout_state:"checkout_created",provider:"jjuma",transaction_id:tx,checkout_url:url.toString(),webhook_url:webhookUrl,product:"molan_chat_upgrade"}}).eq("id",payment.id).eq("status","pending");
  if(error) throw error;
  return {url:url.toString(),transactionId:tx};
}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
 if(req.method!=="POST")return json({success:false,error:"Method not allowed."},405);
 const authorization=req.headers.get("Authorization")||"",token=authorization.startsWith("Bearer ")?authorization.slice(7).trim():"";
 if(!token)return json({success:false,error:"Sign in to request an upgrade."},401);
 let body:Record<string,unknown>;try{body=await req.json()}catch{return json({success:false,error:"A valid JSON request body is required."},400)}
 const planId=typeof body.planId==="string"?body.planId.trim():"",plan=plans[planId as keyof typeof plans];
 if(!plan)return json({success:false,error:"Choose a valid upgrade plan."},400);
 try{
  const {data:authData,error:authError}=await db.auth.getUser(token);if(authError||!authData.user)return json({success:false,error:"Your sign-in session is invalid or expired. Sign in again."},401);
  const user=authData.user;
  const {data:profile,error:profileError}=await db.from("profiles").select("full_name,phone").eq("id",user.id).maybeSingle();if(profileError)throw profileError;
  const pricing=await localPrice(plan.amount,String(profile?.phone||user.phone||user.user_metadata?.phone||""));
  const pricingMetadata={usd_amount:plan.amount,fx_rate:pricing.fxRate,country_code:pricing.countryCode,fx_rate_time:pricing.rateTime,display_currency:pricing.currency};
  const {data:activeUpgrade,error:activeError}=await db.from("user_upgrades").select("id,plan,expires_at").eq("user_id",user.id).eq("status","active").gt("expires_at",new Date().toISOString()).order("expires_at",{ascending:false}).limit(1).maybeSingle();if(activeError)throw activeError;
  if(activeUpgrade?.plan===planId)return json({success:true,alreadyActive:true,checkoutReady:false,planId,message:"This plan is already active on your account."});
  const recentCutoff=new Date(Date.now()-24*60*60*1000).toISOString();
  const {data:existing,error:existingError}=await db.from("upgrade_payments").select("id,plan,amount,currency,status,created_at,provider,provider_transaction_id,payment_reference,metadata").eq("user_id",user.id).eq("plan",planId).eq("status","pending").gte("created_at",recentCutoff).order("created_at",{ascending:false}).limit(1).maybeSingle();if(existingError)throw existingError;
  let payment=existing;
  if(payment?.provider==="jjuma"&&payment.metadata?.checkout_url)return json({success:true,requestId:payment.id,planId,amount:Number(payment.amount),currency:payment.currency,status:payment.status,reused:true,checkoutReady:true,provider:"jjuma",checkoutUrl:payment.metadata.checkout_url,message:"Continue to JJuma Pay to complete your upgrade."});
  if(!payment){const {data:inserted,error}=await db.from("upgrade_payments").insert({user_id:user.id,plan:planId,amount:pricing.amount,currency:pricing.currency,status:"pending",payment_type:"automatic",provider:"jjuma",payment_method:null,metadata:{request_source:"public_upgrade_button",plan_label:plan.label,billing_interval:"monthly",checkout_state:"pending_jjuma",...pricingMetadata}}).select("id,plan,amount,currency,status,created_at,provider,provider_transaction_id,payment_reference,metadata").single();if(error)throw error;payment=inserted}
  else if(payment.provider!=="jjuma"||!payment.metadata?.checkout_url){const {data:repriced,error}=await db.from("upgrade_payments").update({provider:"jjuma",amount:pricing.amount,currency:pricing.currency,metadata:{...(payment.metadata||{}),...pricingMetadata,checkout_state:"pending_jjuma"}}).eq("id",payment.id).eq("status","pending").select("id,plan,amount,currency,status,created_at,provider,provider_transaction_id,payment_reference,metadata").single();if(error)throw error;payment=repriced}
  const checkout=await jjumaCreateCheckout(payment,user,profile,plan,pricing.countryCode);
  return json({success:true,requestId:payment.id,planId,amount:Number(payment.amount),currency:payment.currency,usdAmount:plan.amount,countryCode:pricing.countryCode,fxRate:pricing.fxRate,status:payment.status,reused:Boolean(existing),checkoutReady:true,provider:"jjuma",checkoutUrl:checkout.url,transactionId:checkout.transactionId,message:"Complete JJuma Pay checkout. Your upgrade activates only after the signed webhook and server-side payment verification."});
 }catch(error){console.error("JJuma upgrade checkout failed:",error);return json({success:false,error:error instanceof Error?error.message:"Unable to create secure JJuma Pay checkout."},500)}
});
