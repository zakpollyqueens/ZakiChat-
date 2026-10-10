import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const secretKeysRaw = Deno.env.get("SUPABASE_SECRET_KEYS");
let secretKey: string | undefined;

if (secretKeysRaw) {
  try {
    const parsed = JSON.parse(secretKeysRaw);
    if (typeof parsed?.default === "string") secretKey = parsed.default;
  } catch {
    console.error("SUPABASE_SECRET_KEYS is not valid JSON.");
  }
}

secretKey ||= Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || undefined;
if (!SUPABASE_URL || !secretKey) {
  throw new Error("Release management requires Supabase URL and a server-side secret key.");
}

const db = createClient(SUPABASE_URL, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const BUCKET = "app-releases";
const MAX_FILE_BYTES = 100 * 1024 * 1024;
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin"
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}

function clean(value: unknown, max = 4000): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function safeFileName(value: string): string {
  const leaf = value.split(/[\\/]/).pop() || "";
  return leaf.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 140);
}

function validExtension(fileName: string): boolean {
  return /\.(apk|aab|zip)$/i.test(fileName);
}

async function verifySuperAdmin(token: string) {
  if (!token) return null;
  const { data: userId, error: sessionError } = await db.rpc(
    "admin_session_user",
    { p_token: token }
  );
  if (sessionError || !userId) return null;

  const { data: admin, error } = await db
    .from("admin_users")
    .select("user_id, role, active")
    .eq("user_id", userId)
    .eq("active", true)
    .maybeSingle();

  if (error || !admin || admin.role !== "super_admin") return null;
  return { userId: admin.user_id as string, role: admin.role as string };
}

async function audit(adminId: string, action: string, releaseId: string, details: Record<string, unknown>) {
  const { error } = await db.from("admin_audit_logs").insert({
    admin_user_id: adminId,
    action,
    target_type: "app_release",
    target_id: releaseId,
    details
  });
  if (error) console.error("Release audit log insert failed:", error.message);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed." }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: "A valid JSON request body is required." }, 400);
  }

  const action = clean(body.action, 80);

  try {
    if (action === "public-list") {
      const { data, error } = await db
        .from("app_releases")
        .select("id, version, title, description, channel, release_notes, download_path, download_file_name, download_size_bytes, published_at")
        .eq("status", "published")
        .not("published_at", "is", null)
        .lte("published_at", new Date().toISOString())
        .order("published_at", { ascending: false })
        .limit(30);
      if (error) throw error;

      const releases = await Promise.all((data || []).map(async (release) => {
        const { data: signed, error: signedError } = await db.storage
          .from(BUCKET)
          .createSignedUrl(release.download_path, 60 * 60);
        return {
          id: release.id,
          version: release.version,
          title: release.title,
          description: release.description,
          channel: release.channel,
          releaseNotes: release.release_notes,
          fileName: release.download_file_name,
          fileSizeBytes: release.download_size_bytes,
          publishedAt: release.published_at,
          downloadUrl: signedError ? null : signed?.signedUrl || null
        };
      }));
      return json({ success: true, releases });
    }

    const admin = await verifySuperAdmin(clean(body.adminSessionToken, 500));
    if (!admin) return json({ success: false, error: "An active super-administrator session is required." }, 403);

    if (action === "admin-list") {
      const { data, error } = await db
        .from("app_releases")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      const releases = await Promise.all((data || []).map(async (release) => {
        if (release.status !== "published") return release;
        const { data: signed, error: signedError } = await db.storage
          .from(BUCKET)
          .createSignedUrl(release.download_path, 60 * 60);
        return {
          ...release,
          download_url_signed: signedError ? null : signed?.signedUrl || null
        };
      }));
      return json({ success: true, releases });
    }

    if (action === "admin-upload-url") {
      const fileName = safeFileName(clean(body.fileName, 240));
      const size = Number(body.fileSize);
      const contentType = clean(body.contentType, 120) || "application/octet-stream";

      if (!fileName || !validExtension(fileName)) {
        return json({ success: false, error: "Upload an .apk, .aab, or .zip release file." }, 400);
      }
      if (!Number.isSafeInteger(size) || size < 1 || size > MAX_FILE_BYTES) {
        return json({ success: false, error: "The release file must be between 1 byte and 100 MB." }, 400);
      }
      const path = `${crypto.randomUUID()}/${fileName}`;
      const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(path, { upsert: false });
      if (error || !data) throw error || new Error("Unable to create a signed upload URL.");
      return json({ success: true, path, token: data.token, signedUrl: data.signedUrl, fileName, fileSize: size, contentType });
    }

    if (action === "admin-save") {
      const id = clean(body.id, 80);
      const version = clean(body.version, 40);
      const title = clean(body.title, 160);
      const description = clean(body.description, 2000);
      const channel = clean(body.channel, 20);
      const releaseNotes = clean(body.releaseNotes, 10000);
      const fileName = safeFileName(clean(body.fileName, 240));
      const downloadPath = clean(body.downloadPath, 500);
      const contentType = clean(body.contentType, 120) || "application/octet-stream";
      const fileSize = Number(body.fileSize);
      const status = clean(body.status, 20);

      if (!/^[A-Za-z0-9][A-Za-z0-9._+-]{0,39}$/.test(version)) {
        return json({ success: false, error: "Enter a valid version label (letters, numbers, dots, underscores, pluses or hyphens)." }, 400);
      }
      if (!title || !description) return json({ success: false, error: "Release title and description are required." }, 400);
      if (!["stable", "beta", "testing"].includes(channel)) return json({ success: false, error: "Choose a valid release channel." }, 400);
      if (!["draft", "published", "archived"].includes(status)) return json({ success: false, error: "Choose a valid release status." }, 400);
      if (!downloadPath || downloadPath.startsWith("/") || downloadPath.includes("..") || !validExtension(fileName)) {
        return json({ success: false, error: "The uploaded release file is invalid." }, 400);
      }
      if (!Number.isSafeInteger(fileSize) || fileSize < 1 || fileSize > MAX_FILE_BYTES) {
        return json({ success: false, error: "The release file size is invalid." }, 400);
      }

      const parts = downloadPath.split("/");
      if (parts.length !== 2) return json({ success: false, error: "The release storage path is invalid." }, 400);
      const { data: objects, error: listError } = await db.storage.from(BUCKET).list(parts[0], { limit: 100, search: fileName });
      if (listError) throw listError;
      if (!(objects || []).some((object) => object.name === fileName)) {
        return json({ success: false, error: "The file upload was not found in secure storage. Upload it again." }, 400);
      }

      const now = new Date().toISOString();
      let previousPublishedAt: string | null = null;
      if (id) {
        const { data: existing, error: existingError } = await db.from("app_releases").select("published_at").eq("id", id).maybeSingle();
        if (existingError) throw existingError;
        if (!existing) return json({ success: false, error: "Release not found." }, 404);
        previousPublishedAt = existing.published_at;
      }

      const record = {
        version,
        title,
        description,
        channel,
        release_notes: releaseNotes,
        download_path: downloadPath,
        download_file_name: fileName,
        download_content_type: contentType,
        download_size_bytes: fileSize,
        status,
        created_by: admin.userId,
        published_at: status === "published" ? (previousPublishedAt || now) : null,
        updated_at: now
      };

      const query = id
        ? db.from("app_releases").update(record).eq("id", id)
        : db.from("app_releases").insert(record);
      const { data: saved, error: saveError } = await query.select("*").single();
      if (saveError) {
        if (saveError.code === "23505") return json({ success: false, error: "That version already exists in this channel." }, 409);
        throw saveError;
      }

      await audit(admin.userId, id ? "release_updated" : "release_created", saved.id, { version, channel, status, fileName, fileSize });
      return json({ success: true, release: saved });
    }

    return json({ success: false, error: "Unknown release-management action." }, 400);
  } catch (error) {
    console.error("Release management error:", error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : "Release management request failed."
    }, 500);
  }
});
