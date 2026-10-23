import { createClient } from "npm:@supabase/supabase-js@2";
import { createHmac } from "node:crypto";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const secretKeysRaw = Deno.env.get("SUPABASE_SECRET_KEYS");
let serviceKey: string | undefined;
if(secretKeysRaw){try{const parsed=JSON.parse(secretKeysRaw);if(typeof parsed?.default==="string")serviceKey=parsed.default}catch{}}
serviceKey ||= Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||undefined;
const WEBHOOK_SECRET=Deno.env.get("JJUMA_WEBHOOK_SECRET")||"";
const JJUMA_SECRET_KEY=Deno.env.get("JJUMA_SECRET_API_KEY")||"";
const API_BASE="https://api.jjuma.com/api/v1";
if(!SUPABASE_URL||!serviceKey)throw new Error("JJuma webhook requires Supabase server credentials.");
const db=createClient(SUPABASE_URL,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
function reply(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}})}
function safeEqual(a:string,b:string){if(a.length!==b.length)return false;let n=0;for(let i=0;i<a.length;i++)n|=a.charCodeAt(i)^b.charCodeAt(i);return n===0}
function signature(timestamp:string,body:string){return createHmac("sha256",WEBHOOK_SECRET).update(timestamp+"."+body).digest("hex")}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"POST, OPTIONS"}});
 if(req.method!=="POST")return reply({ok:false,error:"Method not allowed."},405);
 if(!WEBHOOK_SECRET||!JJUMA_SECRET_KEY)return reply({ok:false,error:"JJuma webhook secrets are not configured."},503);
 const rawBody=await req.text(),supplied=(req.headers.get("X-Jjuma-Signature")||"").replace(/^sha256=/i,"").trim(),timestamp=(req.headers.get("X-Jjuma-Timestamp")||"").trim();
 if(!rawBody||!supplied||!timestamp)return reply({ok:false,error:"Missing signed webhook data."},401);
 const parsedTimestamp=Number(timestamp),timeMs=Number.isFinite(parsedTimestamp)?(parsedTimestamp<1e12?parsedTimestamp*1000:parsedTimestamp):Date.parse(timestamp);
 if(!Number.isFinite(timeMs)||Math.abs(Date.now()-timeMs)>5*60*1000)return reply({ok:false,error:"Webhook timestamp is invalid or expired."},401);
 if(!safeEqual(signature(timestamp,rawBody).toLowerCase(),supplied.toLowerCase()))return reply({ok:false,error:"Invalid JJuma signature."},401);
 let payload:any;try{payload=JSON.parse(rawBody)}catch{return reply({ok:false,error:"Invalid JSON payload."},400)}
 const eventName=String(payload?.event??payload?.event_type??req.headers.get("X-Jjuma-Event")??"");
 const data=payload?.data??{},transactionId=String(data.transaction_id??payload?.transaction_id??"");
 if(!transactionId)return reply({ok:false,error:"Webhook has no transaction ID."},400);
 const {data:payment,error}=await db.from("upgrade_payments").select("*").eq("provider","jjuma").eq("provider_transaction_id",transactionId).maybeSingle();
 if(error)return reply({ok:false,error:"Could not look up the upgrade payment."},500);
 if(!payment)return reply({ok:false,error:"No matching JJuma upgrade payment."},404);
 if(payment.status==="paid")return reply({ok:true,already_processed:true});
 if(payment.status!=="pending")return reply({ok:true,ignored:true,payment_status:payment.status});
 if(eventName==="payment.failed"||eventName==="payment.cancelled"){
   const {error:updateError}=await db.from("upgrade_payments").update({status:"failed",updated_at:new Date().toISOString(),metadata:{...(payment.metadata||{}),jjuma_event:eventName,delivery_id:req.headers.get("X-Jjuma-Delivery-Id")}}).eq("id",payment.id).eq("status","pending");
   if(updateError)return reply({ok:false,error:"Could not record failed payment."},500);
   return reply({ok:true,payment_status:"failed"});
 }
 if(eventName!=="payment.completed")return reply({ok:true,ignored:true,event:eventName});
 let verification:any;
 try{
  const response=await fetch(API_BASE+"/payments/verify/"+encodeURIComponent(transactionId),{headers:{Authorization:"Bearer "+JJUMA_SECRET_KEY,Accept:"application/json"}});
  verification=await response.json().catch(()=>({}));
  if(!response.ok||verification?.status!=="success"||String(verification?.data?.status??"").toLowerCase()!=="successful")return reply({ok:false,error:"JJuma Pay has not verified this payment as successful."},409);
 }catch{return reply({ok:false,error:"Could not verify payment with JJuma Pay."},502)}
 const verified=verification.data,amount=Number(verified.amount??data.amount),currency=String(verified.currency??data.currency??"").toUpperCase();
 if(!Number.isFinite(amount)||Math.round(amount*100)!==Math.round(Number(payment.amount)*100)||currency!==String(payment.currency).toUpperCase())return reply({ok:false,error:"Verified amount or currency does not match the pending upgrade."},409);
 const {data:result,error:confirmError}=await db.rpc("confirm_jjuma_upgrade",{p_payment_id:payment.id,p_transaction_id:transactionId,p_amount:amount,p_currency:currency,p_payment_method:String(verified.payment_method??data.payment_method??""),p_confirmation_code:String(verified.reference??data.reference??transactionId)});
 if(confirmError){console.error("JJuma upgrade confirmation failed:",confirmError.message);return reply({ok:false,error:"Payment verified but upgrade activation needs retry."},500)}
 return reply({ok:true,activated:true,result});
});
