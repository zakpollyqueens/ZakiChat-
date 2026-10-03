import { createClient } from "npm:@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL")!;
const secretKeys = JSON.parse(
  Deno.env.get("SUPABASE_SECRET_KEYS") || "{}"
);
const serviceKey = secretKeys.default;
const encKey = Deno.env.get("ZAKICHAT_2FA_ENCRYPTION_KEY");
const adminEmail = Deno.env.get("ZAKICHAT_ADMIN_EMAIL");
const adminPassword = Deno.env.get("ZAKICHAT_ADMIN_PASSWORD");
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
    const body = await req.json().catch(() => ({}));
    const action = body.action || "status";

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
