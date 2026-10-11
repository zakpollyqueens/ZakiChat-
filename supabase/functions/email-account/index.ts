import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://zakpollyqueens.github.io",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
  "http://localhost:5500",
  "http://127.0.0.1:5500"
]);

const africanCountries = new Set([
  "DZ","AO","BJ","BW","BF","BI","CV","CM","CF","TD","KM","CG","CD","CI","DJ","EG",
  "GQ","ER","SZ","ET","GA","GM","GH","GN","GW","KE","LS","LR","LY","MG","MW","ML",
  "MR","MU","MA","MZ","NA","NE","NG","RW","ST","SN","SC","SL","SO","ZA","SS","SD",
  "TZ","TG","TN","UG","ZM","ZW"
]);

const corsHeaders = (origin: string) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
  "Content-Type": "application/json"
});

function reply(origin: string, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(origin) });
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin") || "";
  if (!allowedOrigins.has(origin)) return new Response("Origin not allowed", { status: 403 });
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });
  if (req.method !== "POST") return reply(origin, { success: false, error: "Method not allowed." }, 405);

  try {
    const body = await req.json();
    const username = String(body?.username || "").trim().toLowerCase();
    const fullName = String(body?.fullName || "").trim();
    const phone = String(body?.phone || "").trim();
    const email = String(body?.email || "").trim().toLowerCase();
    const location = String(body?.location || "").trim();
    const password = String(body?.password || "");

    if (!/^[a-z0-9_.]{3,30}$/.test(username)) {
      return reply(origin, { success: false, error: "Choose a valid username (3–30 letters, numbers, dots or underscores)." }, 400);
    }
    if (fullName.length < 2 || fullName.length > 80 || location.length < 1 || location.length > 120) {
      return reply(origin, { success: false, error: "Please check your full name and location." }, 400);
    }
    if (!/^\+?[1-9]\d{7,14}$/.test(phone)) {
      return reply(origin, { success: false, error: "Enter a valid international phone number." }, 400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return reply(origin, { success: false, error: "Enter a valid recovery email." }, 400);
    }
    if (password.length < 8 || password.length > 128) {
      return reply(origin, { success: false, error: "Your password must contain 8–128 characters." }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      console.error("Email account function is missing server-side Supabase credentials.");
      return reply(origin, { success: false, error: "Secure signup is not configured yet. Please try again later." }, 503);
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Server-side fee enforcement prevents callers from bypassing the public preflight check.
    const { parsePhoneNumberFromString } = await import("npm:libphonenumber-js@1.12.17");
    const parsed = parsePhoneNumberFromString(phone);
    if (!parsed?.isValid() || !parsed.country) {
      return reply(origin, { success: false, error: "Enter a valid international phone number." }, 400);
    }
    const country = parsed.country;
    if (!(country === "UG" || country === "KE" || country === "TZ")) {
      const feeUsd = africanCountries.has(country) ? 1 : 5;
      return reply(origin, {
        success: false,
        paymentRequired: true,
        feeUsd,
        countryCode: country,
        error: "Your country requires the one-time registration fee to be verified before account creation."
      }, 402);
    }

    // Prevent username collisions across auth users. This is a best-effort check;
    // any database-level unique constraint should remain the final authority.
    const { data: existingUsers, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listError) throw listError;
    const usernameTaken = (existingUsers.users || []).some(user =>
      String(user.user_metadata?.username || "").toLowerCase() === username
    );
    if (usernameTaken) {
      return reply(origin, { success: false, error: "That username is already in use. Please choose another." }, 409);
    }

    const { data, error } = await admin.auth.admin.createUser({
      email,
      phone: parsed.number,
      password,
      email_confirm: false,
      // Email verification is the required gate. Phone is a contact/login identifier,
      // not the verification factor, so no SMS confirmation is requested.
      phone_confirm: true,
      user_metadata: {
        username,
        full_name: fullName,
        display_name: fullName,
        phone: parsed.number,
        location,
        recovery_email: email
      }
    });

    if (error) {
      // Keep duplicate-account responses useful without returning internal details.
      if (/already|registered|duplicate/i.test(error.message)) {
        return reply(origin, { success: false, error: "An account already exists for that phone number or email. Try signing in or use account recovery." }, 409);
      }
      console.error("Admin createUser failed:", error.message);
      return reply(origin, { success: false, error: "We couldn't create the account. Please check the details and try again." }, 400);
    }

    return reply(origin, { success: true, userId: data.user?.id, email });
  } catch (error) {
    console.error("Email account endpoint error:", error);
    return reply(origin, { success: false, error: "Secure signup is temporarily unavailable. Please try again later." }, 500);
  }
});
