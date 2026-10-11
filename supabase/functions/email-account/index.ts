import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * Retired endpoint.
 *
 * Email accounts are now created through Supabase Auth's public signUp flow so
 * Supabase can issue and validate its native email-confirmation link. Do not
 * recreate users through the service-role key in an unauthenticated endpoint.
 */
Deno.serve((req: Request) => {
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": req.headers.get("Origin") || "null",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin"
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  return new Response(JSON.stringify({
    success: false,
    error: "This endpoint has been retired. Use Supabase Auth email signup and verification."
  }), { status: 410, headers });
});
