import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

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

function getBearerToken(
  req: Request
) {
  const authorization =
    req.headers.get("Authorization") ||
    req.headers.get("authorization") ||
    "";

  if (!authorization.startsWith("Bearer ")) {
    return null;
  }

  const token =
    authorization.slice("Bearer ".length).trim();

  return token || null;
}

function getAuthTime(
  user: {
    aud?: string;
    user_metadata?: Record<string, unknown>;
  },
  token: string
) {
  /*
   * Supabase access tokens are JWTs. The auth_time
   * claim records when the authentication occurred.
   *
   * We read it only to enforce a short recent-auth
   * window. The token signature itself is verified by
   * Supabase Auth below.
   */
  try {
    const parts = token.split(".");

    if (parts.length !== 3) {
      return null;
    }

    const payload =
      JSON.parse(
        atob(
          parts[1]
            .replace(/-/g, "+")
            .replace(/_/g, "/")
        )
      );

    const authTime =
      Number(payload?.auth_time);

    if (!Number.isFinite(authTime)) {
      return null;
    }

    return authTime;
  } catch {
    return null;
  }
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
    const token =
      getBearerToken(req);

    if (!token) {
      return jsonResponse(
        {
          error:
            "Authentication is required."
        },
        401
      );
    }

    const supabaseUrl =
      Deno.env.get("SUPABASE_URL");

    const secretKeysRaw =
      Deno.env.get("SUPABASE_SECRET_KEYS");

    if (
      !supabaseUrl ||
      !secretKeysRaw
    ) {
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

    /*
     * The service/secret client is used only on the
     * server. The browser never receives this key.
     */
    const supabaseAdmin =
      createClient(
        supabaseUrl,
        secretKey,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false
          }
        }
      );

    /*
     * Ask Supabase Auth to validate the supplied
     * access token and identify the authenticated user.
     *
     * We deliberately do NOT accept a user ID from the
     * request body.
     */
    const {
      data: userData,
      error: userError
    } =
      await supabaseAdmin.auth.getUser(
        token
      );

    if (
      userError ||
      !userData?.user
    ) {
      console.error(
        "Delete account authentication failed:",
        userError
      );

      return jsonResponse(
        {
          error:
            "Your authentication session is invalid or expired."
        },
        401
      );
    }

    const user =
      userData.user;

    /*
     * Require recent authentication.
     *
     * The Account page first re-authenticates the user
     * with the existing ZakiChat password. Supabase then
     * issues a fresh access token containing auth_time.
     *
     * Five minutes gives enough time to complete the
     * final confirmation without leaving a long window.
     */
    const authTime =
      getAuthTime(
        user,
        token
      );

    if (!authTime) {
      return jsonResponse(
        {
          error:
            "Recent password authentication could not be verified. Please verify your password again."
        },
        403
      );
    }

    const now =
      Math.floor(
        Date.now() / 1000
      );

    const recentAuthWindow =
      5 * 60;

    if (
      authTime > now + 30 ||
      now - authTime >
        recentAuthWindow
    ) {
      return jsonResponse(
        {
          error:
            "Your security verification has expired. Please verify your password again."
        },
        403
      );
    }

    /*
     * Delete only the user represented by the
     * cryptographically verified access token.
     *
     * Any profile/data tables that reference auth.users
     * with ON DELETE CASCADE will be removed according
     * to their database constraints.
     */
    const {
      error: deleteError
    } =
      await supabaseAdmin.auth.admin.deleteUser(
        user.id
      );

    if (deleteError) {
      console.error(
        "Supabase account deletion failed:",
        deleteError
      );

      return jsonResponse(
        {
          error:
            "The account could not be deleted. No successful deletion was confirmed."
        },
        500
      );
    }

    return jsonResponse({
      success: true,
      message:
        "Your ZakiChat account has been permanently deleted."
    });

  } catch (error) {
    console.error(
      "Delete account function error:",
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
