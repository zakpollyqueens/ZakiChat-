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

    if (action === "admin-users-list") {
      const search = clean(body.search, 120).toLowerCase();
      const status = clean(body.status, 20) || "all";
      const [{ data: rows, error: rowsError }, { count: total, error: totalError }, { count: online, error: onlineError }, { count: newUsers, error: newError }, { data: authData, error: authError }] = await Promise.all([
        db.from("profiles").select("id, username, full_name, phone, is_online, last_seen, created_at").order("created_at", { ascending: false }).limit(1000),
        db.from("profiles").select("id", { count: "exact", head: true }),
        db.from("profiles").select("id", { count: "exact", head: true }).eq("is_online", true),
        db.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString()),
        db.auth.admin.listUsers({ page: 1, perPage: 1000 })
      ]);
      if (rowsError) throw rowsError;
      if (totalError) throw totalError;
      if (onlineError) throw onlineError;
      if (newError) throw newError;
      if (authError) throw authError;
      const authUsers = authData?.users || [];
      const authMap = new Map(authUsers.map(user => [user.id, user]));
      const suspendedCount = authUsers.filter(user => user.banned_until && new Date(user.banned_until).getTime() > Date.now()).length;
      const users = (rows || []).map(profile => {
        const authUser = authMap.get(profile.id);
        const bannedUntil = authUser?.banned_until || null;
        return {
          ...profile,
          email: authUser?.email || null,
          banned_until: bannedUntil,
          account_status: bannedUntil && new Date(bannedUntil).getTime() > Date.now() ? "suspended" : "active"
        };
      }).filter(user => {
        const matchesStatus = status === "all" ||
          (status === "active" && user.account_status === "active") ||
          (status === "suspended" && user.account_status === "suspended");
        const text = [user.username, user.full_name, user.phone, user.email, user.id].join(" ").toLowerCase();
        return matchesStatus && (!search || text.includes(search));
      });
      return json({
        success: true,
        users,
        metrics: {
          total: total || 0,
          online: online || 0,
          newUsers: newUsers || 0,
          restricted: suspendedCount
        },
        truncated: (rows || []).length === 1000
      });
    }

    if (action === "admin-user-suspend" || action === "admin-user-restore") {
      const userId = clean(body.userId, 80);
      const reason = clean(body.reason, 1000);
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
        return json({ success: false, error: "A valid user ID is required." }, 400);
      }
      if (action === "admin-user-suspend" && reason.length < 3) {
        return json({ success: false, error: "Enter a reason for suspending the account." }, 400);
      }
      const { data: adminTarget, error: adminTargetError } = await db.from("admin_users")
        .select("user_id").eq("user_id", userId).maybeSingle();
      if (adminTargetError) throw adminTargetError;
      if (adminTarget) return json({ success: false, error: "Administrator accounts cannot be suspended from the user directory." }, 403);

      const banDuration = action === "admin-user-suspend" ? "876000h" : "none";
      const { data: updated, error: updateError } = await db.auth.admin.updateUserById(userId, {
        ban_duration: banDuration
      });
      if (updateError) throw updateError;
      await audit(admin.userId, action === "admin-user-suspend" ? "account_suspended" : "account_restored", "user", userId, {
        reason: reason || "Account restored by super administrator"
      });
      return json({
        success: true,
        user: {
          id: userId,
          email: updated.user?.email || null,
          banned_until: updated.user?.banned_until || null,
          account_status: action === "admin-user-suspend" ? "suspended" : "active"
        }
      });
    }

    if (action === "admin-support-list") {
      const { data: requests, error } = await db.from("support_requests")
        .select("id, user_id, category, subject, message, status, created_at, read_at, resolved_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      const userIds = [...new Set((requests || []).map(row => row.user_id).filter(Boolean))];
      let profileMap = new Map<string, Record<string, unknown>>();
      if (userIds.length) {
        const { data: profiles, error: profileError } = await db.from("profiles")
          .select("id, username, full_name, phone")
          .in("id", userIds);
        if (profileError) throw profileError;
        profileMap = new Map((profiles || []).map(profile => [profile.id, profile]));
      }
      const items = (requests || []).map(row => ({
        ...row,
        user: profileMap.get(row.user_id) || null
      }));
      return json({
        success: true,
        requests: items,
        metrics: {
          total: items.length,
          open: items.filter(row => row.status === "open").length,
          read: items.filter(row => row.status === "read").length,
          resolved: items.filter(row => row.status === "resolved").length
        }
      });
    }

    if (action === "admin-support-update") {
      const id = clean(body.id, 80);
      const status = clean(body.status, 20);
      if (!id || !["open", "read", "resolved"].includes(status)) {
        return json({ success: false, error: "A valid support request and status are required." }, 400);
      }
      const now = new Date().toISOString();
      const update: Record<string, unknown> = { status };
      if (status === "read" || status === "resolved") update.read_at = now;
      if (status === "resolved") update.resolved_at = now;
      else update.resolved_at = null;
      const { data: saved, error } = await db.from("support_requests")
        .update(update).eq("id", id)
        .select("id, user_id, category, subject, message, status, created_at, read_at, resolved_at")
        .maybeSingle();
      if (error) throw error;
      if (!saved) return json({ success: false, error: "Support request not found." }, 404);
      await audit(admin.userId, "support_request_updated", "support_request", id, { status });
      return json({ success: true, request: saved });
    }

    if (action === "admin-analytics-summary") {
      const since = new Date(Date.now() - 7 * 86400000).toISOString();
      const count = async (table: string, column = "id", filter?: (query: any) => any) => {
        let query = db.from(table).select(column, { count: "exact", head: true });
        if (filter) query = filter(query);
        const { count: value, error } = await query;
        if (error) throw error;
        return value || 0;
      };
      const [users, online, newUsers, messages, recentMessages, groups, channels, support, openSupport, payments, paidPayments, registrationPayments, paidRegistrationPayments, conversations] = await Promise.all([
        count("profiles"),
        count("profiles", "id", q => q.eq("is_online", true)),
        count("profiles", "id", q => q.gte("created_at", since)),
        count("messages"),
        count("messages", "id", q => q.gte("created_at", since)),
        count("groups"),
        count("channels"),
        count("support_requests"),
        count("support_requests", "id", q => q.eq("status", "open")),
        count("upgrade_payments"),
        count("upgrade_payments", "id", q => q.eq("status", "paid")),
        count("registration_payments"),
        count("registration_payments", "id", q => q.eq("status", "paid")),
        count("conversations")
      ]);
      return json({
        success: true,
        metrics: {
          totalUsers: users, onlineUsers: online, newUsers7d: newUsers,
          totalMessages: messages, messages7d: recentMessages,
          totalGroups: groups, totalChannels: channels,
          totalSupport: support, openSupport,
          totalPayments: payments, paidPayments,
          totalRegistrationPayments: registrationPayments,
          paidRegistrationPayments,
          totalConversations: conversations
        }
      });
    }

    if (action === "admin-moderation-list") {
      const status = clean(body.status, 30) || "all";
      const communityType = clean(body.communityType, 20) || "all";
      const [{ data, error }, { data: communityStatuses, error: statusError }] = await Promise.all([
        db.rpc("admin_community_reports", {
          p_token: clean(body.adminSessionToken, 500),
          p_status: status,
          p_community_type: communityType
        }),
        db.from("community_admin_status").select("community_type, community_id, status")
      ]);
      if (error) throw error;
      if (statusError) throw statusError;
      const reports = Array.isArray(data) ? data : (data?.reports || []);
      const statuses = communityStatuses || [];
      return json({
        success: true,
        reports,
        communityStatuses: statuses,
        metrics: {
          openReports: reports.filter((report: any) => report.status === "open").length,
          groupReports: reports.filter((report: any) => report.community_type === "group").length,
          channelReports: reports.filter((report: any) => report.community_type === "channel").length,
          restrictedCommunities: statuses.filter(row => ["restricted", "suspended"].includes(row.status)).length
        }
      });
    }

    if (action === "admin-moderation-action") {
      const { data, error } = await db.rpc("admin_moderation_action", {
        p_token: clean(body.adminSessionToken, 500),
        p_community_type: clean(body.communityType, 20),
        p_community_id: clean(body.communityId, 80),
        p_action: clean(body.moderationAction, 40),
        p_reason: clean(body.reason, 2000),
        p_report_id: clean(body.reportId, 80) || null
      });
      if (error) throw error;
      await audit(admin.userId, "community_moderation_action", "community", clean(body.communityId, 80), {
        community_type: clean(body.communityType, 20),
        moderation_action: clean(body.moderationAction, 40),
        reason: clean(body.reason, 2000),
        report_id: clean(body.reportId, 80)
      });
      return json({ success: true, result: data });
    }

    if (action === "admin-communication-overview") {
      const { data, error } = await db.rpc("admin_communication_overview", {
        p_token: clean(body.adminSessionToken, 500)
      });
      if (error) throw error;
      return json({ success: true, result: data });
    }

    if (action === "admin-communication-conversations") {
      const { data, error } = await db.rpc("admin_list_conversations", {
        p_token: clean(body.adminSessionToken, 500),
        p_search: clean(body.search, 120),
        p_type: clean(body.type, 30) || "all"
      });
      if (error) throw error;
      return json({ success: true, result: data });
    }

    if (action === "admin-communication-conversation-details") {
      const conversationId = clean(body.conversationId, 80);
      const { data, error } = await db.rpc("admin_conversation_details", {
        p_token: clean(body.adminSessionToken, 500),
        p_conversation_id: conversationId
      });
      if (error) throw error;
      return json({ success: true, result: data });
    }

    if (action === "admin-communication-messages") {
      const conversationId = clean(body.conversationId, 80);
      const limit = Math.min(100, Math.max(1, Number(body.limit) || 50));
      const { data, error } = await db.rpc("admin_list_messages", {
        p_token: clean(body.adminSessionToken, 500),
        p_conversation_id: conversationId,
        p_limit: limit
      });
      if (error) throw error;
      return json({ success: true, result: data });
    }

    if (action === "admin-community-overview") {
      const { data, error } = await db.rpc("admin_community_overview", {
        p_token: clean(body.adminSessionToken, 500)
      });
      if (error) throw error;
      return json({ success: true, result: data });
    }

    if (action === "admin-list-groups" || action === "admin-list-channels") {
      const isGroups = action === "admin-list-groups";
      const { data, error } = await db.rpc(isGroups ? "admin_list_groups" : "admin_list_channels", {
        p_token: clean(body.adminSessionToken, 500),
        p_search: clean(body.search, 120),
        p_status: clean(body.status, 30) || "all"
      });
      if (error) throw error;
      return json({ success: true, result: data });
    }

    if (action === "admin-community-details") {
      const communityType = clean(body.communityType, 20);
      const communityId = clean(body.communityId, 80);
      const { data, error } = await db.rpc("admin_community_details", {
        p_token: clean(body.adminSessionToken, 500),
        p_community_type: communityType,
        p_community_id: communityId
      });
      if (error) throw error;
      return json({ success: true, result: data });
    }

    if (action === "admin-upgrade-overview") {
      const { data, error } = await db.rpc("admin_upgrade_overview", {
        p_token: clean(body.adminSessionToken, 500)
      });
      if (error) throw error;
      return json({ success: true, result: data });
    }

    if (action === "admin-upgrade-records") {
      const { data, error } = await db.rpc("admin_upgrade_records", {
        p_token: clean(body.adminSessionToken, 500),
        p_search: clean(body.p_search, 120),
        p_status: clean(body.p_status, 30) || "all",
        p_plan: clean(body.p_plan, 60) || "all"
      });
      if (error) throw error;
      return json({ success: true, result: data });
    }

    if (action === "admin-manual-upgrade") {
      const identifier = clean(body.p_identifier, 200);
      const plan = clean(body.p_plan, 60);
      const amount = Number(body.p_amount);
      const paymentMethod = clean(body.p_payment_method, 80);
      const paymentReference = clean(body.p_payment_reference, 200);
      const notes = clean(body.p_notes, 2000);
      if (!identifier || !plan || !Number.isFinite(amount) || amount <= 0) {
        return json({ success: false, error: "A customer, valid plan and positive amount are required." }, 400);
      }
      const { data, error } = await db.rpc("admin_manual_upgrade", {
        p_token: clean(body.adminSessionToken, 500),
        p_identifier: identifier,
        p_plan: plan,
        p_amount: amount,
        p_payment_method: paymentMethod,
        p_payment_reference: paymentReference,
        p_notes: notes
      });
      if (error) throw error;
      return json({ success: true, result: data });
    }

    if (action === "admin-upgrade-requests") {
      const { data: payments, error } = await db.from("upgrade_payments")
        .select("id, user_id, plan, amount, currency, status, created_at, metadata")
        .eq("status", "pending")
        .contains("metadata", { request_source: "public_upgrade_button" })
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      const userIds = [...new Set((payments || []).map(row => row.user_id).filter(Boolean))];
      let profileMap = new Map<string, Record<string, unknown>>();
      if (userIds.length) {
        const { data: profiles, error: profileError } = await db.from("profiles")
          .select("id, username, full_name, phone")
          .in("id", userIds);
        if (profileError) throw profileError;
        profileMap = new Map((profiles || []).map(profile => [profile.id, profile]));
      }
      return json({
        success: true,
        requests: (payments || []).map(row => ({
          ...row,
          user: profileMap.get(row.user_id) || null
        }))
      });
    }

    if (action === "admin-upgrade-request-close") {
      const id = clean(body.id, 80);
      const reason = clean(body.reason, 1000);
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
        return json({ success: false, error: "A valid upgrade request ID is required." }, 400);
      }
      if (reason.length < 3) return json({ success: false, error: "Enter a reason for closing this request." }, 400);
      const { data: existing, error: findError } = await db.from("upgrade_payments")
        .select("id, user_id, plan, status, metadata")
        .eq("id", id)
        .eq("status", "pending")
        .contains("metadata", { request_source: "public_upgrade_button" })
        .maybeSingle();
      if (findError) throw findError;
      if (!existing) return json({ success: false, error: "Pending upgrade request not found." }, 404);
      const metadata = {
        ...(existing.metadata || {}),
        closed_by_admin: admin.userId,
        close_reason: reason,
        closed_at: new Date().toISOString()
      };
      const { data: updated, error: updateError } = await db.from("upgrade_payments")
        .update({ status: "cancelled", metadata, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select("id, status, updated_at")
        .single();
      if (updateError) throw updateError;
      await audit(admin.userId, "upgrade_request_closed", "upgrade_payment", id, {
        user_id: existing.user_id, plan: existing.plan, reason
      });
      return json({ success: true, request: updated });
    }

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
