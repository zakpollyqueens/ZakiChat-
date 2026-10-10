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
  throw new Error("Admin content API requires Supabase URL and a server-side secret key.");
}

const db = createClient(SUPABASE_URL, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});
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

async function verifySuperAdmin(token: string) {
  if (!token) return null;
  const { data: userId, error: sessionError } = await db.rpc("admin_session_user", { p_token: token });
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

async function audit(adminId: string, action: string, targetType: string, targetId: string, details: Record<string, unknown>) {
  const { error } = await db.from("admin_audit_logs").insert({
    admin_user_id: adminId,
    action,
    target_type: targetType,
    target_id: targetId,
    details
  });
  if (error) console.error("Admin content audit insert failed:", error.message);
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
    if (action === "public-notices") {
      const now = new Date().toISOString();
      const { data, error } = await db
        .from("admin_system_notices")
        .select("id, title, message, notice_type, priority, starts_at, ends_at, created_at")
        .eq("is_active", true)
        .eq("status", "published")
        .eq("visibility", "public")
        .or(`starts_at.is.null,starts_at.lte.${now}`)
        .or(`ends_at.is.null,ends_at.gte.${now}`)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return json({ success: true, notices: data || [] });
    }

    const admin = await verifySuperAdmin(clean(body.adminSessionToken, 500));
    if (!admin) return json({ success: false, error: "An active super-administrator session is required." }, 403);

    if (action === "admin-notices-list") {
      const { data, error } = await db.from("admin_system_notices")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return json({ success: true, notices: data || [] });
    }

    if (action === "admin-notice-save") {
      const id = clean(body.id, 80);
      const title = clean(body.title, 160);
      const message = clean(body.message, 6000);
      const type = clean(body.type, 40);
      const visibility = clean(body.visibility, 20);
      const priority = clean(body.priority, 20);
      const status = clean(body.status, 20);
      const startsAt = clean(body.startsAt, 80);
      const endsAt = clean(body.endsAt, 80);
      const validTypes = ["notice", "whats-new", "status", "maintenance", "release", "general", "announcement"];
      if (!title || !message) return json({ success: false, error: "A title and message are required." }, 400);
      if (!validTypes.includes(type)) return json({ success: false, error: "Choose a valid notice type." }, 400);
      if (!["public", "users", "hidden"].includes(visibility)) return json({ success: false, error: "Choose a valid visibility." }, 400);
      if (!["normal", "important", "urgent"].includes(priority)) return json({ success: false, error: "Choose a valid priority." }, 400);
      if (!["draft", "published", "archived"].includes(status)) return json({ success: false, error: "Choose a valid publication status." }, 400);
      if (status === "published" && visibility === "hidden") return json({ success: false, error: "A hidden notice must be saved as a draft or archived." }, 400);

      const parseDate = (value: string) => {
        if (!value) return null;
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) throw new Error("Notice start/end dates must be valid.");
        return date.toISOString();
      };
      const now = new Date().toISOString();
      const record = {
        title,
        message,
        notice_type: type,
        visibility,
        priority,
        status,
        is_active: status === "published",
        starts_at: parseDate(startsAt),
        ends_at: parseDate(endsAt),
        created_by: admin.userId,
        updated_at: now
      };
      if (record.starts_at && record.ends_at && record.ends_at < record.starts_at) {
        return json({ success: false, error: "The notice end date must be after its start date." }, 400);
      }

      const query = id
        ? db.from("admin_system_notices").update(record).eq("id", id)
        : db.from("admin_system_notices").insert(record);
      const { data: saved, error } = await query.select("*").single();
      if (error) throw error;
      await audit(admin.userId, id ? "notice_updated" : "notice_created", "system_notice", saved.id, {
        title, notice_type: type, visibility, priority, status
      });
      return json({ success: true, notice: saved });
    }

    if (action === "admin-notifications-list") {
      const { data, error } = await db.from("admin_audit_logs")
        .select("id, action, details, created_at")
        .eq("action", "notification_broadcast")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      const campaigns = (data || []).map(row => ({
        id: row.id,
        ...(row.details || {}),
        created_at: row.created_at
      }));
      const [{ count: totalCount, error: totalError }, { count: unreadCount, error: unreadError }] = await Promise.all([
        db.from("notifications").select("id", { count: "exact", head: true }),
        db.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null)
      ]);
      if (totalError) throw totalError;
      if (unreadError) throw unreadError;
      return json({
        success: true,
        campaigns,
        metrics: {
          total: totalCount || 0,
          delivered: totalCount || 0,
          unread: unreadCount || 0,
          broadcasts: campaigns.length
        }
      });
    }

    if (action === "admin-notification-broadcast") {
      const title = clean(body.title, 160);
      const message = clean(body.message, 5000);
      const type = clean(body.type, 40);
      const audience = clean(body.audience, 20);
      const rawIds = Array.isArray(body.userIds) ? body.userIds : [];
      const userIds = rawIds.filter((value): value is string =>
        typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
      );
      if (audience === "selected" && userIds.length !== rawIds.length) {
        return json({ success: false, error: "Recipient IDs must be valid user UUIDs." }, 400);
      }
      const { data, error } = await db.rpc("admin_broadcast_notification", {
        p_token: clean(body.adminSessionToken, 500),
        p_title: title,
        p_body: message,
        p_type: type,
        p_audience: audience,
        p_user_ids: audience === "selected" ? userIds : null
      });
      if (error) throw error;
      return json({ success: true, campaign: data });
    }

    return json({ success: false, error: "Unknown admin-content action." }, 400);
  } catch (error) {
    console.error("Admin content API error:", error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : "Admin content request failed."
    }, 500);
  }
});
