import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
let SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const keysRaw = Deno.env.get("SUPABASE_SECRET_KEYS");
if (keysRaw) {
  try {
    const parsed = JSON.parse(keysRaw);
    if (typeof parsed?.default === "string") SERVICE_KEY ||= parsed.default;
  } catch {
    console.error("SUPABASE_SECRET_KEYS is not valid JSON.");
  }
}
if (!SERVICE_KEY || !SUPABASE_URL) {
  throw new Error("Business workspace endpoint requires server-side Supabase credentials.");
}
const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};
function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: cors });
}
function normalizePhone(value: unknown): string {
  return String(value || "").replace(/[^0-9+]/g, "");
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return respond({ success: false, error: "Method not allowed." }, 405);
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return respond({ success: false, error: "Sign in to manage business invitations." }, 401);
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  const user = authData?.user;
  if (authError || !user?.id || !user.phone) {
    return respond({ success: false, error: "A valid signed-in ZakiChat phone account is required." }, 401);
  }
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return respond({ success: false, error: "Invalid JSON body." }, 400); }
  const action = String(body.action || "");
  const phone = normalizePhone(user.phone);

  try {
    if (action === "list-invitations") {
      const { data: invitations, error } = await admin.from("business_members")
        .select("id,business_id,role,created_at")
        .eq("phone", phone).eq("status", "invited")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const result = [];
      for (const invitation of invitations || []) {
        const { data: workspace, error: workspaceError } = await admin.from("business_workspaces")
          .select("business_name,business_title,logo_url")
          .eq("id", invitation.business_id).maybeSingle();
        if (workspaceError) throw workspaceError;
        result.push({ ...invitation, workspace });
      }
      return respond({ success: true, invitations: result });
    }
    if (action === "accept-invitation") {
      const invitationId = String(body.invitationId || "").trim();
      if (!invitationId) return respond({ success: false, error: "Invitation ID is required." }, 400);
      const { data: invitation, error: lookupError } = await admin.from("business_members")
        .select("id,business_id,phone,status,user_id")
        .eq("id", invitationId).eq("phone", phone).eq("status", "invited").maybeSingle();
      if (lookupError) throw lookupError;
      if (!invitation) return respond({ success: false, error: "No pending invitation matches this signed-in phone number." }, 404);
      const { data: ownerWorkspace, error: ownerWorkspaceError } = await admin.from("business_workspaces")
        .select("owner_user_id").eq("id", invitation.business_id).maybeSingle();
      if (ownerWorkspaceError) throw ownerWorkspaceError;
      if (!ownerWorkspace) return respond({ success: false, error: "This business workspace is unavailable." }, 404);
      const { data: ownerPlan, error: ownerPlanError } = await admin.from("user_upgrades")
        .select("id").eq("user_id", ownerWorkspace.owner_user_id).eq("plan", "business_monthly")
        .eq("status", "active").gt("expires_at", new Date().toISOString()).limit(1).maybeSingle();
      if (ownerPlanError) throw ownerPlanError;
      if (!ownerPlan) return respond({ success: false, error: "The business subscription is expired. The owner must renew it before staff can join." }, 403);
      if (invitation.user_id && invitation.user_id !== user.id) {
        return respond({ success: false, error: "This invitation has already been accepted by another account." }, 409);
      }
      const { error: updateError } = await admin.from("business_members")
        .update({ user_id: user.id, status: "active", updated_at: new Date().toISOString() })
        .eq("id", invitation.id).eq("status", "invited").eq("phone", phone);
      if (updateError) throw updateError;
      return respond({ success: true, businessId: invitation.business_id, message: "Business invitation accepted." });
    }
    return respond({ success: false, error: "Unsupported business workspace action." }, 400);
  } catch (error) {
    console.error("Business workspace request failed:", error);
    return respond({ success: false, error: error instanceof Error ? error.message : "Business workspace request failed." }, 500);
  }
});
