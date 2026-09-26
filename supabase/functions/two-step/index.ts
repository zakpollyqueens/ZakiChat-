import { createClient } from "npm:@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL")!;
const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
const serviceKey = secretKeys.default;
const encKey = Deno.env.get("ZAKICHAT_2FA_ENCRYPTION_KEY");

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

const b32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(bytes: Uint8Array) {
  let out = "", bits = 0, value = 0;
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += b32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits) out += b32[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(s: string) {
  s = s.replace(/=+$/,"").toUpperCase();
  const out: number[] = [];
  let bits = 0, value = 0;
  for (const c of s) {
    const n = b32.indexOf(c);
    if (n < 0) continue;
    value = (value << 5) | n;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

async function digest(data: string) {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data))
  );
}

async function encrypt(text: string) {
  if (!encKey) throw new Error("2FA encryption secret is missing.");
  const key = await crypto.subtle.importKey(
    "raw", await digest(encKey), "AES-GCM", false, ["encrypt"]
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv }, key, new TextEncoder().encode(text)
  );
  return btoa(JSON.stringify({
    iv: Array.from(iv),
    data: Array.from(new Uint8Array(data))
  }));
}

async function decrypt(value: string) {
  if (!encKey) throw new Error("2FA encryption secret is missing.");
  const x = JSON.parse(atob(value));
  const key = await crypto.subtle.importKey(
    "raw", await digest(encKey), "AES-GCM", false, ["decrypt"]
  );
  const data = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(x.iv) }, key,
    new Uint8Array(x.data)
  );
  return new TextDecoder().decode(data);
}

async function totp(secret: string, counter: number) {
  const key = await crypto.subtle.importKey(
    "raw", base32Decode(secret),
    { name: "HMAC", hash: "SHA-1" }, false, ["sign"]
  );
  const buf = new ArrayBuffer(8);
  new DataView(buf).setUint32(4, counter);
  const h = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, buf)
  );
  const offset = h[19] & 15;
  const n =
    ((h[offset] & 127) << 24) |
    (h[offset + 1] << 16) |
    (h[offset + 2] << 8) |
    h[offset + 3];
  return String(n % 1000000).padStart(6, "0");
}

async function validTotp(secret: string, code: string) {
  const now = Math.floor(Date.now() / 1000 / 30);
  for (const drift of [-1, 0, 1]) {
    if (await totp(secret, now + drift) === code) return true;
  }
  return false;
}

function randomSecret() {
  return base32Encode(crypto.getRandomValues(new Uint8Array(20)));
}
function randomSessionToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function hex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map(x => x.toString(16).padStart(2, "0"))
    .join("");
}
async function userFromRequest(req: Request) {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data } = await admin.auth.getUser(token);
  return data.user;
}


function b64url(bytes: Uint8Array) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}

async function sessionToken() {
  return b64url(crypto.getRandomValues(new Uint8Array(32)));
}

async function hashToken(token: string) {
  return Array.from(await digest(token))
    .map(x => x.toString(16).padStart(2,"0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });

  try {
    const user = await userFromRequest(req);
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const action = body.action || "status";

    const { data: row } = await admin
      .from("two_step_verification")
      .select("enabled,encrypted_secret,verified_at")
      .eq("user_id", user.id)
      .maybeSingle();
    if (action === "status") {
      return json({
        enabled: Boolean(row?.enabled),
        verified: Boolean(row?.verified_at)
      });
    }

    if (action === "setup") {
      const secret = randomSecret();
      const encrypted = await encrypt(secret);

      await admin.from("two_step_verification").upsert({
        user_id: user.id,
        enabled: false,
        encrypted_secret: encrypted,
        recovery_code_hashes: [],
        verified_at: null,
        updated_at: new Date().toISOString()
      });

      const issuer = "ZakiChat";
      const label = encodeURIComponent(user.email || user.id);
      const uri =
        `otpauth://totp/${issuer}:${label}?secret=${secret}&issuer=${issuer}`;

      return json({ secret, otpauth: uri });
    }

    if (action === "enable") {
      if (!row?.encrypted_secret)
        return json({ error: "Setup has not been started." }, 400);

      const secret = await decrypt(row.encrypted_secret);
      if (!await validTotp(secret, String(body.code || "").replace(/\s+/g, "")))
        return json({ error: "Invalid verification code." }, 400);

      const recovery = Array.from({ length: 8 }, () =>
        crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()
      );
      const hashes = await Promise.all(recovery.map(async c =>
        Array.from(await digest(c)).map(x => x.toString(16).padStart(2, "0")).join("")
      ));

      await admin.from("two_step_verification").update({
        enabled: true,
        recovery_code_hashes: hashes,
        verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }).eq("user_id", user.id);

      return json({ enabled: true, recoveryCodes: recovery });
    }

    if (action === "regenerate-recovery") {
      if (!row?.enabled || !row?.encrypted_secret) {
        return json(
          { error: "Two-step verification is not enabled." },
          400
        );
      }

      const recovery = Array.from({ length: 8 }, () =>
        crypto.randomUUID()
          .replaceAll("-", "")
          .slice(0, 10)
          .toUpperCase()
      );

      const hashes = await Promise.all(
        recovery.map(async code =>
          Array.from(await digest(code))
            .map(x => x.toString(16).padStart(2, "0"))
            .join("")
        )
      );

      const { error } = await admin
        .from("two_step_verification")
        .update({
          recovery_code_hashes: hashes,
          updated_at: new Date().toISOString()
        })
        .eq("user_id", user.id);

      if (error) {
        throw error;
      }

      return json({
        enabled: true,
        recoveryCodes: recovery
      });
    }


    if (action === "admin-verify") {
      const { data: adminRow } = await admin
        .from("admin_users")
        .select("user_id,role,active,require_2fa")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!adminRow?.active)
        return json({ error: "Administrator access denied." }, 403);

      if (adminRow.require_2fa !== false) {
        if (!row?.enabled || !row?.encrypted_secret)
          return json({ error: "Administrator 2FA is not configured." }, 403);

        const secret = await decrypt(row.encrypted_secret);

        if (!await validTotp(secret, String(body.code || "").replace(/\s+/g, "")))
          return json({ error: "Invalid administrator 2FA code." }, 401);
      }

      const token = await sessionToken();
      const tokenHash = await hashToken(token);
      const expires = new Date(Date.now()+30*60*1000).toISOString();

      const { error } = await admin.from("admin_sessions").insert({
        admin_user_id: user.id,
        token_hash: tokenHash,
        expires_at: expires,
        ip_address: req.headers.get("x-forwarded-for"),
        user_agent: req.headers.get("user-agent")
      });

      if (error) throw error;

      return json({
        adminSessionToken: token,
        role: adminRow.role,
        expiresAt: expires
      });
    }

    if (action === "admin-session-verify") {
      const token = String(body.adminSessionToken || "");
      if (!token) return json({ valid:false },401);

      const hash = await hashToken(token);

      const { data: row2 } = await admin
        .from("admin_sessions")
        .select("id,admin_user_id,expires_at,revoked_at")
        .eq("token_hash",hash)
        .maybeSingle();

      if (!row2 || row2.revoked_at || new Date(row2.expires_at)<=new Date())
        return json({ valid:false },401);

      if (row2.admin_user_id !== user.id)
        return json({ valid:false },401);

      const { data: a } = await admin
        .from("admin_users")
        .select("role,active")
        .eq("user_id",user.id)
        .maybeSingle();

      if (!a?.active) return json({ valid:false },403);

      await admin.from("admin_sessions")
        .update({last_seen_at:new Date().toISOString()})
        .eq("id",row2.id);

      return json({
        valid:true,
        role:a.role,
        expiresAt:row2.expires_at
      });
    }

    if (action === "admin-session-revoke") {
      const token = String(body.adminSessionToken || "");
      if (!token) return json({ ok:true });

      const hash = await hashToken(token);

      await admin.from("admin_sessions")
        .update({revoked_at:new Date().toISOString()})
        .eq("token_hash",hash)
        .eq("admin_user_id",user.id);

      return json({ok:true});
    }

    if (action === "disable") {
      await admin.from("two_step_verification").update({
        enabled: false,
        encrypted_secret: null,
        recovery_code_hashes: [],
        verified_at: null,
        updated_at: new Date().toISOString()
      }).eq("user_id", user.id);

      return json({ enabled: false });
    }

    return json({ error: "Unknown action." }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Server error" }, 500);
  }
});
