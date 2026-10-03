import { createClient } from "npm:@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL")!;
const secretKeys = JSON.parse(
  Deno.env.get("SUPABASE_SECRET_KEYS") || "{}"
);
const serviceKey = secretKeys.default;
const encKey = Deno.env.get("ZAKICHAT_2FA_ENCRYPTION_KEY");
const adminPasscode = Deno.env.get("ZAKICHAT_ADMIN_PASSCODE");

const admin = createClient(url, serviceKey);

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, content-type",
    },
  });

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveKey(secret: string) {
  const raw = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(secret)
  );

  return crypto.subtle.importKey(
    "raw",
    raw,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encrypt(value: string) {
  if (!encKey) throw new Error("2FA encryption key is not configured.");

  const key = await deriveKey(encKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(value)
  );

  return `${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(encrypted))}`;
}

async function decrypt(value: string) {
  if (!encKey) throw new Error("2FA encryption key is not configured.");

  const [ivPart, dataPart] = value.split(".");

  if (!ivPart || !dataPart) {
    throw new Error("Invalid encrypted secret.");
  }

  const key = await deriveKey(encKey);

  const decrypted = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: base64ToBytes(ivPart),
    },
    key,
    base64ToBytes(dataPart)
  );

  return new TextDecoder().decode(decrypted);
}

function base32ToBytes(value: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = value
    .toUpperCase()
    .replace(/=+$/, "")
    .replace(/\s+/g, "");

  let bits = "";

  for (const char of clean) {
    const index = alphabet.indexOf(char);

    if (index < 0) {
      throw new Error("Invalid TOTP secret.");
    }

    bits += index.toString(2).padStart(5, "0");
  }

  const bytes: number[] = [];

  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }

  return new Uint8Array(bytes);
}

async function hmacSha1(
  keyBytes: Uint8Array,
  data: Uint8Array
) {
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );

  return new Uint8Array(
    await crypto.subtle.sign("HMAC", key, data)
  );
}

async function totp(secret: string, counter: number) {
  const key = base32ToBytes(secret);

  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);

  view.setUint32(0, Math.floor(counter / 0x100000000));
  view.setUint32(4, counter >>> 0);

  const hash = await hmacSha1(
    key,
    new Uint8Array(buffer)
  );

  const offset = hash[hash.length - 1] & 0x0f;

  const code =
    ((hash[offset] & 0x7f) << 24) |
    (hash[offset + 1] << 16) |
    (hash[offset + 2] << 8) |
    hash[offset + 3];

  return String(code % 1000000).padStart(6, "0");
}

async function validTotp(
  secret: string,
  input: string
) {
  const normalized = input.replace(/\s+/g, "");

  if (!/^\d{6}$/.test(normalized)) {
    return false;
  }

  const current = Math.floor(Date.now() / 1000 / 30);

  for (let offset = -1; offset <= 1; offset++) {
    if (
      (await totp(secret, current + offset)) === normalized
    ) {
      return true;
    }
  }

  return false;
}

async function userFromRequest(req: Request) {
  const token = req.headers
    .get("Authorization")
    ?.replace("Bearer ", "");

  if (!token) return null;

  const { data } = await admin.auth.getUser(token);

  return data.user;
}

function randomToken(length = 32) {
  const bytes = crypto.getRandomValues(
    new Uint8Array(length)
  );

  return bytesToBase64(bytes)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

async function hashToken(token: string) {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token)
  );

  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function sessionToken() {
  return randomToken(48);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return json({ ok: true });
  }

  try {
    const user = await userFromRequest(req);

    if (!user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || "status";

    const { data: row } = await admin
      .from("two_step_verification")
      .select(
        "enabled,encrypted_secret,verified_at"
      )
      .eq("user_id", user.id)
      .maybeSingle();

    if (action === "status") {
      return json({
        enabled: !!row?.enabled,
        verifiedAt: row?.verified_at || null,
      });
    }

    if (action === "setup") {
      const secretBytes = crypto.getRandomValues(
        new Uint8Array(20)
      );

      const secret = bytesToBase64(secretBytes)
        .replace(/=/g, "")
        .replace(/\+/g, "")
        .replace(/\//g, "");

      const encryptedSecret = await encrypt(secret);

      await admin
        .from("two_step_verification")
        .upsert(
          {
            user_id: user.id,
            enabled: false,
            encrypted_secret: encryptedSecret,
            verified_at: null,
          },
          {
            onConflict: "user_id",
          }
        );

      return json({
        secret,
        enabled: false,
      });
    }

    if (action === "enable") {
      if (!row?.encrypted_secret) {
        return json(
          { error: "Two-step verification is not configured." },
          400
        );
      }

      const secret = await decrypt(row.encrypted_secret);

      const code = String(body.code || "")
        .replace(/\s+/g, "");

      if (!await validTotp(secret, code)) {
        return json(
          { error: "Invalid verification code." },
          401
        );
      }

      const { error } = await admin
        .from("two_step_verification")
        .update({
          enabled: true,
          verified_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (error) throw error;

      return json({
        ok: true,
        enabled: true,
      });
    }

    if (action === "regenerate-recovery") {
      const recoveryCodes = Array.from(
        { length: 8 },
        () => randomToken(6).slice(0, 8).toUpperCase()
      );

      return json({
        recoveryCodes,
      });
    }

    if (action === "admin-verify") {
      const { data: adminRow } = await admin
        .from("admin_users")
        .select(
          "user_id,role,active,require_2fa"
        )
        .eq("user_id", user.id)
        .maybeSingle();

      if (!adminRow?.active) {
        return json(
          { error: "Administrator access denied." },
          403
        );
      }

      if (!adminPasscode) {
        return json(
          {
            error:
              "Administrator passcode is not configured on the server.",
          },
          500
        );
      }

      const suppliedPasscode =
        typeof body.passcode === "string"
          ? body.passcode
          : "";

      if (
        !suppliedPasscode ||
        suppliedPasscode !== adminPasscode
      ) {
        return json(
          { error: "Invalid administrator passcode." },
          401
        );
      }

      const token = await sessionToken();
      const tokenHash = await hashToken(token);
      const expires = new Date(
        Date.now() + 30 * 60 * 1000
      ).toISOString();

      const { error } = await admin
        .from("admin_sessions")
        .insert({
          admin_user_id: user.id,
          token_hash: tokenHash,
          expires_at: expires,
          ip_address: req.headers.get("x-forwarded-for"),
          user_agent: req.headers.get("user-agent"),
        });

      if (error) throw error;

      return json({
        adminSessionToken: token,
        role: adminRow.role,
        expiresAt: expires,
      });
    }

    if (action === "admin-session-verify") {
      const token =
        typeof body.token === "string"
          ? body.token
          : "";

      if (!token) {
        return json(
          { error: "Missing administrator session token." },
          401
        );
      }

      const tokenHash = await hashToken(token);

      const { data: session } = await admin
        .from("admin_sessions")
        .select(
          "admin_user_id,expires_at"
        )
        .eq("token_hash", tokenHash)
        .maybeSingle();

      if (!session) {
        return json(
          { error: "Invalid administrator session." },
          401
        );
      }

      if (
        new Date(session.expires_at).getTime() <=
        Date.now()
      ) {
        return json(
          { error: "Administrator session expired." },
          401
        );
      }

      const { data: adminRow } = await admin
        .from("admin_users")
        .select("user_id,role,active")
        .eq("user_id", session.admin_user_id)
        .maybeSingle();

      if (!adminRow?.active) {
        return json(
          { error: "Administrator access denied." },
          403
        );
      }

      return json({
        valid: true,
        role: adminRow.role,
        expiresAt: session.expires_at,
      });
    }

    if (action === "admin-session-revoke") {
      const token =
        typeof body.token === "string"
          ? body.token
          : "";

      if (!token) {
        return json({ ok: true });
      }

      const tokenHash = await hashToken(token);

      await admin
        .from("admin_sessions")
        .delete()
        .eq("token_hash", tokenHash);

      return json({ ok: true });
    }

    if (action === "disable") {
      const { error } = await admin
        .from("two_step_verification")
        .update({
          enabled: false,
          verified_at: null,
        })
        .eq("user_id", user.id);

      if (error) throw error;

      return json({
        ok: true,
        enabled: false,
      });
    }

    return json(
      { error: "Unknown action." },
      400
    );
  } catch (e) {
    return json(
      {
        error:
          e instanceof Error
            ? e.message
            : "Server error",
      },
      500
    );
  }
});
