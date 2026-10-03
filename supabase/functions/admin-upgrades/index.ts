import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SECRET_KEYS = JSON.parse(
  Deno.env.get("SUPABASE_SECRET_KEYS") || "{}"
);
const SERVICE_KEY = SECRET_KEYS.default;

const db = createClient(SUPABASE_URL, SERVICE_KEY);

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });

async function hashToken(token: string) {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token)
  );

  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function verifyAdminSession(token: string) {
  if (!token) return null;

  const tokenHash = await hashToken(token);

  const { data: session, error: sessionError } = await db
    .from("admin_sessions")
    .select("admin_user_id,expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (sessionError || !session) return null;

  if (
    new Date(session.expires_at).getTime() <= Date.now()
  ) {
    return null;
  }

  const { data: adminRow, error: adminError } = await db
    .from("admin_users")
    .select("user_id,role,active")
    .eq("user_id", session.admin_user_id)
    .maybeSingle();

  if (adminError || !adminRow?.active) {
    return null;
  }

  return {
    userId: adminRow.user_id,
    role: adminRow.role,
    expiresAt: session.expires_at,
  };
}

function clean(value: unknown) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function validPlan(plan: string) {
  return (
    plan === "personal_monthly" ||
    plan === "business_monthly"
  );
}

function planPrice(plan: string) {
  return plan === "personal_monthly"
    ? 2
    : plan === "business_monthly"
      ? 10
      : null;
}

function addOneMonth(date = new Date()) {
  const result = new Date(date);
  result.setUTCMonth(result.getUTCMonth() + 1);
  return result;
}

async function findUser(identifier: string) {
  const value = clean(identifier);

  if (!value) return null;

  const normalizedPhone = value.replace(/\s+/g, "");

  const { data: phoneProfile } = await db
    .from("profiles")
    .select("id,phone,full_name,username")
    .eq("phone", normalizedPhone)
    .maybeSingle();

  if (phoneProfile?.id) {
    return {
      id: phoneProfile.id,
      email: null,
      phone: phoneProfile.phone,
      fullName: phoneProfile.full_name,
      username: phoneProfile.username,
    };
  }

  const targetEmail = value.toLowerCase();

  for (let page = 1; page <= 10; page++) {
    const { data, error } =
      await db.auth.admin.listUsers({
        page,
        perPage: 1000,
      });

    if (error) throw error;

    const match = data.users.find(
      (user) =>
        (user.email || "").toLowerCase() === targetEmail ||
        (user.phone || "").replace(/\s+/g, "") === normalizedPhone
    );

    if (match) {
      const { data: profile } = await db
        .from("profiles")
        .select("id,phone,full_name,username")
        .eq("id", match.id)
        .maybeSingle();

      return {
        id: match.id,
        email: match.email || null,
        phone: profile?.phone || match.phone || null,
        fullName: profile?.full_name || null,
        username: profile?.username || null,
      };
    }

    if (!data.users || data.users.length < 1000) {
      break;
    }
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return json({ ok: true });
  }

  if (req.method !== "POST") {
    return json(
      { error: "Method not allowed." },
      405
    );
  }

  try {
    const body = await req.json().catch(() => ({}));

    const token =
      typeof body.adminSessionToken === "string"
        ? body.adminSessionToken
        : "";

    const adminSession =
      await verifyAdminSession(token);

    if (!adminSession) {
      return json(
        {
          error:
            "Administrator session is invalid or expired.",
        },
        401
      );
    }

    const action = clean(body.action) || "manual-upgrade";

    if (action !== "manual-upgrade") {
      return json(
        { error: "Unknown upgrade action." },
        400
      );
    }

    const identifier = clean(
      body.email || body.phone
    );

    const plan = clean(body.plan);

    const paymentMethod =
      clean(body.paymentMethod) || "manual";

    const reference =
      clean(body.reference) || null;

    const notes =
      clean(body.notes) || null;

    const suppliedAmount =
      Number(body.amount);

    if (!identifier) {
      return json(
        { error: "Customer email or phone is required." },
        400
      );
    }

    if (!validPlan(plan)) {
      return json(
        { error: "Invalid ZakiChat upgrade plan." },
        400
      );
    }

    const officialAmount = planPrice(plan);

    if (officialAmount === null) {
      return json(
        { error: "Unable to determine plan price." },
        400
      );
    }

    if (
      !Number.isFinite(suppliedAmount) ||
      suppliedAmount !== officialAmount
    ) {
      return json(
        {
          error:
            `Incorrect amount. ${plan} requires USD ${officialAmount.toFixed(2)}.`,
        },
        400
      );
    }

    const user = await findUser(identifier);

    if (!user) {
      return json(
        {
          error:
            "No ZakiChat account was found for that email or phone number.",
        },
        404
      );
    }

    const now = new Date();

    const { data: existing } = await db
      .from("user_upgrades")
      .select(
        "id,plan,status,starts_at,expires_at"
      )
      .eq("user_id", user.id)
      .eq("status", "active")
      .gt("expires_at", now.toISOString())
      .order("expires_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    let startsAt = now;
    let expiresAt = addOneMonth(now);

    if (
      existing &&
      existing.plan === plan &&
      new Date(existing.expires_at).getTime() >
        now.getTime()
    ) {
      startsAt = new Date(existing.starts_at);
      expiresAt = addOneMonth(
        new Date(existing.expires_at)
      );
    }

    if (existing && existing.plan !== plan) {
      await db
        .from("user_upgrades")
        .update({
          status: "cancelled",
          updated_at: now.toISOString(),
        })
        .eq("id", existing.id);
    }

    const { data: upgrade, error: upgradeError } =
      await db
        .from("user_upgrades")
        .insert({
          user_id: user.id,
          plan,
          price_usd: officialAmount,
          currency: "USD",
          status: "active",
          starts_at: startsAt.toISOString(),
          expires_at: expiresAt.toISOString(),
          source: "manual",
        })
        .select()
        .single();

    if (upgradeError) throw upgradeError;

    const { data: payment, error: paymentError } =
      await db
        .from("upgrade_payments")
        .insert({
          user_id: user.id,
          upgrade_id: upgrade.id,
          plan,
          amount: officialAmount,
          currency: "USD",
          status: "paid",
          payment_type: "manual",
          payment_method: paymentMethod,
          provider: "admin_manual",
          payment_reference: reference,
          metadata: {
            notes,
            identifier,
            admin_role: adminSession.role,
          },
          paid_at: now.toISOString(),
        })
        .select()
        .single();

    if (paymentError) throw paymentError;

    const { error: auditError } = await db
      .from("upgrade_audit_log")
      .insert({
        user_id: user.id,
        upgrade_id: upgrade.id,
        payment_id: payment.id,
        actor_user_id: adminSession.userId,
        actor_type: "admin",
        action: "upgrade",
        details: {
          plan,
          amount: officialAmount,
          currency: "USD",
          payment_method: paymentMethod,
          payment_reference: reference,
          customer_email: user.email,
          customer_phone: user.phone,
          expires_at: expiresAt.toISOString(),
          notes,
        },
      });

    if (auditError) throw auditError;

    return json({
      ok: true,
      message: "Account upgraded successfully.",
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        fullName: user.fullName,
        username: user.username,
      },
      upgrade: {
        id: upgrade.id,
        plan,
        amount: officialAmount,
        currency: "USD",
        status: "active",
        startsAt: startsAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
      },
      payment: {
        id: payment.id,
        status: "paid",
        type: "manual",
        method: paymentMethod,
        reference,
      },
    });
  } catch (error) {
    console.error(error);

    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Secure upgrade service error.",
      },
      500
    );
  }
});
