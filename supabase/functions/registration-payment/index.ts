import { createClient } from "npm:@supabase/supabase-js@2";
import {
  parsePhoneNumberFromString,
  type CountryCode
} from "npm:libphonenumber-js@1.12.17";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const AFRICAN_COUNTRIES = new Set<CountryCode>([
  "DZ", "AO", "BJ", "BW", "BF", "BI", "CV", "CM",
  "CF", "TD", "KM", "CG", "CD", "CI", "DJ", "EG",
  "GQ", "ER", "SZ", "ET", "GA", "GM", "GH", "GN",
  "GW", "KE", "LS", "LR", "LY", "MG", "MW", "ML",
  "MR", "MU", "MA", "MZ", "NA", "NE", "NG", "RW",
  "ST", "SN", "SC", "SL", "SO", "ZA", "SS", "SD",
  "TZ", "TG", "TN", "UG", "ZM", "ZW"
]);

function jsonResponse(
  body: unknown,
  status = 200
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    }
  );
}

function calculateRegistrationFee(
  countryCode: CountryCode
): number {
  if (
    countryCode === "UG" ||
    countryCode === "KE" ||
    countryCode === "TZ"
  ) {
    return 0;
  }

  if (AFRICAN_COUNTRIES.has(countryCode)) {
    return 1;
  }

  return 5;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      {
        error: "Method not allowed."
      },
      405
    );
  }

  try {
    const body = await req.json();
    const phone = String(body?.phone || "").trim();

    if (!phone) {
      return jsonResponse(
        {
          error: "Phone number is required."
        },
        400
      );
    }

    const parsed = parsePhoneNumberFromString(phone);

    if (!parsed || !parsed.isValid() || !parsed.country) {
      return jsonResponse(
        {
          error: "Please provide a valid international phone number."
        },
        400
      );
    }

    const countryCode = parsed.country;
    const phoneE164 = parsed.number;
    const countryName = countryCode
      ? (new Intl.DisplayNames(["en"], { type: "region" }).of(countryCode) || countryCode)
      : "Unknown";
    const feeUsd = calculateRegistrationFee(countryCode);
    const isAfrican = AFRICAN_COUNTRIES.has(countryCode);

    const action = String(body?.action || "preflight");

    if (action !== "preflight" && action !== "claim-paid-registration") {
      return jsonResponse({ success: false, error: "Unsupported registration payment action." }, 400);
    }

    /*
     * Uganda, Kenya and Tanzania are free-registration countries.
     * This public preflight path only calculates the fee; it must not
     * require an administrative secret key or create a payment record.
     */
    if (action === "preflight" && feeUsd === 0) {
      return jsonResponse({
        success: true,
        paymentRequired: false,
        feeUsd: 0,
        currency: "USD",
        phone: phoneE164,
        countryCode,
        isAfrican
      });
    }

    const supabaseUrl =
      Deno.env.get("SUPABASE_URL");

    const secretKeysRaw =
      Deno.env.get("SUPABASE_SECRET_KEYS");

    if (!supabaseUrl || !secretKeysRaw) {
      throw new Error(
        "Supabase server configuration is missing."
      );
    }

    const secretKeys =
      JSON.parse(secretKeysRaw);

    const secretKey =
      secretKeys.default;

    if (!secretKey) {
      throw new Error(
        "Supabase secret key is unavailable."
      );
    }

    const supabaseAdmin =
      createClient(
        supabaseUrl,
        secretKey
      );

    if (action === "claim-paid-registration") {
      const userId = String(body?.userId || "").trim();
      const paymentId = String(body?.paymentId || "").trim();
      const authorization = req.headers.get("Authorization") || "";
      const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
      if (!userId || !paymentId || !accessToken) {
        return jsonResponse({ success: false, error: "A valid signed-in session and payment reference are required." }, 401);
      }

      const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
      if (authError || !authData.user || authData.user.id !== userId) {
        return jsonResponse({ success: false, error: "The signed-in account could not be verified." }, 401);
      }
      const authenticatedPhone = parsePhoneNumberFromString(authData.user.phone || "");
      if (!authenticatedPhone || authenticatedPhone.number !== phoneE164) {
        return jsonResponse({ success: false, error: "The verified account phone does not match the paid registration phone." }, 403);
      }

      const { data: claimed, error: claimError } = await supabaseAdmin
        .from("registration_payments")
        .update({ user_id: userId, updated_at: new Date().toISOString() })
        .eq("id", paymentId)
        .eq("phone", phoneE164)
        .eq("status", "paid")
        .is("user_id", null)
        .select("id, user_id")
        .maybeSingle();
      if (claimError) throw claimError;
      if (claimed) return jsonResponse({ success: true, claimed: true, paymentId: claimed.id });

      const { data: alreadyClaimed, error: existingClaimError } = await supabaseAdmin
        .from("registration_payments")
        .select("id, user_id")
        .eq("id", paymentId)
        .eq("phone", phoneE164)
        .eq("status", "paid")
        .eq("user_id", userId)
        .maybeSingle();
      if (existingClaimError) throw existingClaimError;
      if (alreadyClaimed) return jsonResponse({ success: true, claimed: true, paymentId: alreadyClaimed.id });
      return jsonResponse({ success: false, error: "This paid registration request has already been claimed or is no longer available." }, 409);
    }

    const { data: paidPayment, error: paidPaymentError } = await supabaseAdmin
      .from("registration_payments")
      .select("id, phone, country_code, country_name, fee_usd, currency, status, paid_at")
      .eq("phone", phoneE164)
      .eq("status", "paid")
      .is("user_id", null)
      .order("paid_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (paidPaymentError) throw paidPaymentError;
    if (paidPayment) {
      return jsonResponse({
        success: true,
        paymentRequired: false,
        paidRegistrationFee: true,
        paidRegistrationPaymentId: paidPayment.id,
        feeUsd: Number(paidPayment.fee_usd),
        currency: paidPayment.currency,
        phone: phoneE164,
        countryCode,
        countryName,
        isAfrican,
        message: "A verified registration payment was found. You can create your account now."
      });
    }

    /*
     * Reuse an existing pending request for the same phone so repeated
     * signup attempts do not create duplicate unpaid registration rows.
     */
    const { data: existingPayment, error: existingError } = await supabaseAdmin
      .from("registration_payments")
      .select("id, phone, country_code, fee_usd, currency, status, provider, created_at")
      .eq("phone", phoneE164)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existingPayment) {
      return jsonResponse({
        success: true,
        paymentRequired: true,
        paymentId: existingPayment.id,
        feeUsd: Number(existingPayment.fee_usd),
        currency: existingPayment.currency,
        phone: existingPayment.phone,
        countryCode: existingPayment.country_code,
        countryName,
        isAfrican,
        provider: existingPayment.provider,
        status: existingPayment.status,
        checkoutReady: false,
        message: "A pending registration payment already exists for this phone number. Checkout is not configured yet."
      });
    }

    /*
     * Paid registration:
     * Create a pending payment record. Checkout must be configured before
     * signup is allowed to proceed for a fee-paying country.
     */
    const { data: payment, error } =
      await supabaseAdmin
        .from("registration_payments")
        .insert({
          phone: phoneE164,
          country_code: countryCode,
          country_name: countryName,
          fee_usd: feeUsd,
          currency: "USD",
          status: "pending",
          provider: "jjuma"
        })
        .select(
          "id, phone, country_code, fee_usd, currency, status, provider, created_at"
        )
        .single();

    if (error) {
      console.error(
        "Registration payment insert error:",
        error
      );

      return jsonResponse(
        {
          error:
            "Unable to create the registration payment request."
        },
        500
      );
    }

    return jsonResponse({
      success: true,
      paymentRequired: true,
      paymentId: payment.id,
      feeUsd: Number(payment.fee_usd),
      currency: payment.currency,
      phone: payment.phone,
      countryCode: payment.country_code,
      isAfrican,
      provider: payment.provider,
      status: payment.status,
      checkoutReady: false,
      message:
        "Registration payment request created. Jjuma checkout will be connected after merchant credentials are available."
    });

  } catch (error) {
    console.error(
      "Registration payment function error:",
      error
    );

    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected server error."
      },
      500
    );
  }
});
