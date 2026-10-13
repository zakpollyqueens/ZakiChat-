(function () {
"use strict";
const client = window.ZakiChatAuth?.client;
const title = document.getElementById("callbackTitle");
const status = document.getElementById("callbackMessage");
const profile = document.getElementById("callbackProfile");
const action = document.getElementById("returnToApp");
const PENDING = "zakichat_pending_email_registration";
const PENDING_ADD_ACCOUNT = "zakichat_pending_add_account_storage_key";
const PAYMENT_URL = "https://xdpevlurgtvgduwzyoue.supabase.co/functions/v1/registration-payment";
function show(text, type) { status.textContent = text; status.className = "auth-message " + (type || ""); }
async function finish() {
 if (!client) { title.textContent = "Verification unavailable"; show("Zamivox could not initialize. Return to the application and try again.", "error"); action.hidden = false; return; }
 try {
   // Supabase's confirmation link normally supplies token_hash + type. PKCE links may instead
   // supply ?code= and are exchanged by the SDK. Never trust profile fields from URL parameters.
   const params = new URLSearchParams(location.search);
   const tokenHash = params.get("token_hash"), type = params.get("type");
   if (tokenHash && (type === "signup" || type === "email" || type === "magiclink" || type === "recovery")) {
     const { error } = await client.auth.verifyOtp({ token_hash: tokenHash, type });
     if (error) throw error;
     params.delete("token_hash"); params.delete("type");
     history.replaceState({}, document.title, location.pathname + (params.toString() ? "?" + params.toString() : "") + location.hash);
   } else if (params.has("code")) {
     const { error } = await client.auth.exchangeCodeForSession(params.get("code"));
     if (error) throw error;
     history.replaceState({}, document.title, location.pathname);
   } else if (location.hash.includes("access_token=") || location.hash.includes("error=")) {
     // Let the Supabase client parse implicit-flow callback tokens, then confirm a session exists.
     await new Promise(resolve => setTimeout(resolve, 350));
   }
   const { data, error } = await client.auth.getSession();
   if (error) throw error;
   const user = data.session?.user;
   if (!user || !user.email_confirmed_at) throw new Error("This link is invalid, expired, or the email has not been verified. Request a fresh verification email and try again.");
   const meta = user.user_metadata || {};
   let pending = null;
   try { pending = JSON.parse(localStorage.getItem(PENDING) || "null"); } catch (_) {}
   if (pending && pending.email && pending.email.toLowerCase() === (user.email || "").toLowerCase()) {
     if (pending.paymentId && pending.phone) {
       const response = await fetch(PAYMENT_URL, { method:"POST", headers:{ "Content-Type":"application/json", apikey:window.ZakiChatConfig.supabaseKey, Authorization:"Bearer " + data.session.access_token }, body:JSON.stringify({ action:"claim-paid-registration", phone:pending.phone, userId:user.id, paymentId:pending.paymentId }) });
       const result = await response.json().catch(() => ({}));
       if (!response.ok || result.success !== true) throw new Error(result.error || "Email verified, but we could not link your registration payment. Please contact support.");
     }
     localStorage.removeItem(PENDING);
   }
   const addAccountStorageKey = localStorage.getItem(PENDING_ADD_ACCOUNT);
   await window.ZakiChatAccounts?.registerCurrentSession(client, {
     email:user.email,
     phone:meta.phone || pending?.phone || "",
     displayName:meta.display_name || meta.full_name || user.email,
     ...(addAccountStorageKey ? { storageKey:addAccountStorageKey } : {})
   });
   if (addAccountStorageKey) {
     window.ZakiChatAccounts.setActiveStorageKey(addAccountStorageKey);
     localStorage.removeItem(PENDING_ADD_ACCOUNT);
   }
   title.textContent = "Welcome to Zamivox!";
   show("Your account has been verified successfully. You are signed in.", "success");
   profile.hidden = false;
   profile.className = "signup-info-box";
   const name = meta.display_name || meta.full_name || user.email;
   const username = meta.username ? "@" + meta.username : "Not set";
   profile.textContent = "Profile: " + name + " · Username: " + username + " · Status: Verified and signed in.";
   action.href = "chats.html"; action.textContent = "Open Zamivox"; action.hidden = false;
   // Web/PWA returns to chats. Native app deep-link handoff will be added when Android source and verified app links are available.
   setTimeout(() => { location.replace("chats.html"); }, 1400);
 } catch (e) {
   console.error("Zamivox email callback failed:", e);
   title.textContent = "We couldn't verify this link";
   show(e.message || "The verification link may have expired. Request a new link and try again.", "error");
   action.href = "login.html"; action.textContent = "Return to sign in"; action.hidden = false;
 }
}
finish();
})();