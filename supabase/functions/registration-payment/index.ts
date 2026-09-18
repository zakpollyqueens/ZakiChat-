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
    const feeUsd = calculateRegistrationFee(countryCode);
    const isAfrican = AFRICAN_COUNTRIES.has(countryCode);

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

    /*
     * Free countries do not need a payment record.
     * The signup flow can proceed directly to Supabase Auth.
     */
    if (feeUsd === 0) {
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

    /*
     * Paid registration:
     * Create a pending payment record.
     *
     * Jjuma checkout will be connected later.
     */
    const { data: payment, error } =
      await supabaseAdmin
        .from("registration_payments")
        .insert({
          phone: phoneE164,
          country_code: countryCode,
          country_name: countryCode,
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
