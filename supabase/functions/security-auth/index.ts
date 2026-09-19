import { createClient } from "npm:@supabase/supabase-js@2.57.4";

import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from "npm:@simplewebauthn/server@14.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin":
    "https://zakpollyqueens.github.io",

  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",

  "Access-Control-Allow-Methods":
    "POST, OPTIONS",

  "Content-Type":
    "application/json",
};

function jsonResponse(
  body: unknown,
  status = 200,
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: corsHeaders,
    },
  );
}

function errorResponse(
  message: string,
  status = 400,
) {
  return jsonResponse(
    {
      error: message,
    },
    status,
  );
}

function base64ToBytes(
  value: string,
): Uint8Array {
  const binary =
    atob(value);

  const bytes =
    new Uint8Array(
      binary.length,
    );

  for (
    let index = 0;
    index < binary.length;
    index += 1
  ) {
    bytes[index] =
      binary.charCodeAt(index);
  }

  return bytes;
}

function bytesToBase64(
  bytes: Uint8Array,
) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(
      byte,
    );
  }

  return btoa(binary);
}

async function getAuthenticatedUser(
  req: Request,
) {
  const authorization =
    req.headers.get(
      "Authorization",
    );

  if (
    !authorization?.startsWith(
      "Bearer ",
    )
  ) {
    return null;
  }

  const token =
    authorization
      .slice(7)
      .trim();

  if (!token) {
    return null;
  }

  const supabase =
    createClient(
      Deno.env.get(
        "SUPABASE_URL",
      )!,
      Deno.env.get(
        "SUPABASE_ANON_KEY",
      )!,
      {
        global: {
          headers: {
            Authorization:
              `Bearer ${token}`,
          },
        },
      },
    );

  const {
    data: {
      user,
    },
    error,
  } =
    await supabase.auth.getUser(
      token,
    );

  if (
    error ||
    !user
  ) {
    return null;
  }

  return {
    user,
    supabase,
  };
}

function getWebAuthnConfig(
  req: Request,
) {
  const rpName =
    Deno.env.get(
      "WEBAUTHN_RP_NAME",
    ) ||
    "ZakiChat";

  const rpID =
    Deno.env.get(
      "WEBAUTHN_RP_ID",
    );

  const origin =
    Deno.env.get(
      "WEBAUTHN_ORIGIN",
    );

  if (!rpID) {
    throw new Error(
      "WEBAUTHN_RP_ID is not configured",
    );
  }

  if (!origin) {
    throw new Error(
      "WEBAUTHN_ORIGIN is not configured",
    );
  }

  const requestOrigin =
    req.headers.get(
      "Origin",
    );

  if (
    requestOrigin &&
    requestOrigin !== origin
  ) {
    throw new Error(
      "Origin is not authorized",
    );
  }

  return {
    rpName,
    rpID,
    origin,
  };
}

async function createRegistrationOptions(
  req: Request,
) {
  const auth =
    await getAuthenticatedUser(
      req,
    );

  if (!auth) {
    return errorResponse(
      "Authentication required",
      401,
    );
  }

  const {
    user,
    supabase,
  } = auth;

  const {
    rpName,
    rpID,
  } =
    getWebAuthnConfig(
      req,
    );

  const {
    data:
      existingPasskeys,
    error:
      passkeyError,
  } =
    await supabase
      .from("passkeys")
      .select(
        "credential_id, transports",
      )
      .eq(
        "user_id",
        user.id,
      );

  if (passkeyError) {
    return errorResponse(
      passkeyError.message,
      500,
    );
  }

  const options =
    await generateRegistrationOptions(
      {
        rpName,
        rpID,

        userName:
          user.email ||
          user.id,

        userDisplayName:
          user.user_metadata
            ?.full_name ||
          user.user_metadata
            ?.name ||
          user.email ||
          "ZakiChat user",

        attestationType:
          "none",

        excludeCredentials:
          (
            existingPasskeys ||
            []
          ).map(
            passkey => ({
              id:
                passkey.credential_id,

              transports:
                passkey.transports ||
                undefined,
            }),
          ),

        authenticatorSelection: {
          residentKey:
            "preferred",

          userVerification:
            "preferred",
        },
      },
    );

  await supabase
    .from("passkey_challenges")
    .delete()
    .eq(
      "user_id",
      user.id,
    )
    .eq(
      "challenge_type",
      "registration",
    );

  const {
    error:
      challengeError,
  } =
    await supabase
      .from(
        "passkey_challenges",
      )
      .insert({
        user_id:
          user.id,

        challenge:
          options.challenge,

        challenge_type:
          "registration",

        expires_at:
          new Date(
            Date.now() +
              5 * 60 * 1000,
          ).toISOString(),
      });

  if (challengeError) {
    return errorResponse(
      challengeError.message,
      500,
    );
  }

  return jsonResponse(
    options,
  );
}

async function verifyRegistration(
  req: Request,
  body: any,
) {
  const auth =
    await getAuthenticatedUser(
      req,
    );

  if (!auth) {
    return errorResponse(
      "Authentication required",
      401,
    );
  }

  const {
    user,
    supabase,
  } = auth;

  const {
    rpID,
    origin,
  } =
    getWebAuthnConfig(
      req,
    );

  const {
    data:
      challenge,
    error:
      challengeError,
  } =
    await supabase
      .from(
        "passkey_challenges",
      )
      .select("*")
      .eq(
        "user_id",
        user.id,
      )
      .eq(
        "challenge_type",
        "registration",
      )
      .gt(
        "expires_at",
        new Date().toISOString(),
      )
      .order(
        "created_at",
        {
          ascending: false,
        },
      )
      .limit(1)
      .maybeSingle();

  if (challengeError) {
    return errorResponse(
      challengeError.message,
      500,
    );
  }

  if (!challenge) {
    return errorResponse(
      "Registration challenge expired or could not be found",
      400,
    );
  }

  if (!body?.response) {
    return errorResponse(
      "Passkey response is missing",
      400,
    );
  }

  let verification;

  try {
    verification =
      await verifyRegistrationResponse(
        {
          response:
            body.response,

          expectedChallenge:
            challenge.challenge,

          expectedOrigin:
            origin,

          expectedRPID:
            rpID,

          requireUserVerification:
            false,
        },
      );
  } catch (error) {
    console.error(
      "WebAuthn registration verification error:",
      error,
    );

    return errorResponse(
      "Passkey verification failed",
      400,
    );
  }

  if (
    !verification.verified ||
    !verification.registrationInfo
  ) {
    return errorResponse(
      "Passkey verification failed",
      400,
    );
  }

  const {
    credential,
    credentialDeviceType,
    credentialBackedUp,
  } =
    verification.registrationInfo;

  const publicKeyBase64 =
    bytesToBase64(
      credential.publicKey,
    );

  const name =
    typeof body.name ===
      "string" &&
    body.name.trim()
      ? body.name
          .trim()
          .slice(0, 100)
      : "Passkey";

  const {
    error:
      insertError,
  } =
    await supabase
      .from("passkeys")
      .insert({
        user_id:
          user.id,

        credential_id:
          credential.id,

        public_key:
          publicKeyBase64,

        counter:
          credential.counter,

        device_type:
          credentialDeviceType,

        backed_up:
          credentialBackedUp,

        transports:
          body.response
            ?.response
            ?.transports ||
          [],

        name,
      });

  if (insertError) {
    /*
     * A duplicate credential should normally be
     * prevented by excludeCredentials(), but the
     * database constraint remains the final guard.
     */
    if (
      insertError.code ===
      "23505"
    ) {
      return errorResponse(
        "This passkey is already registered.",
        409,
      );
    }

    return errorResponse(
      insertError.message,
      500,
    );
  }

  await supabase
    .from(
      "passkey_challenges",
    )
    .delete()
    .eq(
      "user_id",
      user.id,
    )
    .eq(
      "challenge_type",
      "registration",
    );

  return jsonResponse({
    verified: true,

    message:
      "Passkey registered successfully.",
  });
}

async function listPasskeys(
  req: Request,
) {
  const auth =
    await getAuthenticatedUser(
      req,
    );

  if (!auth) {
    return errorResponse(
      "Authentication required",
      401,
    );
  }

  const {
    user,
    supabase,
  } = auth;

  const {
    data,
    error,
  } =
    await supabase
      .from("passkeys")
      .select(
        [
          "id",
          "name",
          "device_type",
          "backed_up",
          "created_at",
          "updated_at",
          "last_used_at",
        ].join(","),
      )
      .eq(
        "user_id",
        user.id,
      )
      .order(
        "created_at",
        {
          ascending: false,
        },
      );

  if (error) {
    return errorResponse(
      error.message,
      500,
    );
  }

  return jsonResponse({
    passkeys:
      data || [],
  });
}

async function deletePasskey(
  req: Request,
  body: any,
) {
  const auth =
    await getAuthenticatedUser(
      req,
    );

  if (!auth) {
    return errorResponse(
      "Authentication required",
      401,
    );
  }

  const {
    user,
    supabase,
  } = auth;

  const id =
    typeof body?.id ===
      "string"
      ? body.id.trim()
      : "";

  if (!id) {
    return errorResponse(
      "Passkey ID is required",
      400,
    );
  }

  const {
    data:
      existing,
    error:
      findError,
  } =
    await supabase
      .from("passkeys")
      .select("id")
      .eq(
        "id",
        id,
      )
      .eq(
        "user_id",
        user.id,
      )
      .maybeSingle();

  if (findError) {
    return errorResponse(
      findError.message,
      500,
    );
  }

  if (!existing) {
    return errorResponse(
      "Passkey not found",
      404,
    );
  }

  const {
    error:
      deleteError,
  } =
    await supabase
      .from("passkeys")
      .delete()
      .eq(
        "id",
        id,
      )
      .eq(
        "user_id",
        user.id,
      );

  if (deleteError) {
    return errorResponse(
      deleteError.message,
      500,
    );
  }

  return jsonResponse({
    deleted: true,
    message:
      "Passkey removed successfully.",
  });
}

Deno.serve(
  async (req) => {
    if (
      req.method ===
      "OPTIONS"
    ) {
      return new Response(
        "ok",
        {
          headers:
            corsHeaders,
        },
      );
    }

    if (
      req.method !==
      "POST"
    ) {
      return errorResponse(
        "POST required",
        405,
      );
    }

    try {
      const body =
        await req.json();

      switch (
        body?.action
      ) {
        case "registration-options":
          return await createRegistrationOptions(
            req,
          );

        case "registration-verify":
          return await verifyRegistration(
            req,
            body,
          );

        case "list-passkeys":
          return await listPasskeys(
            req,
          );

        case "delete-passkey":
          return await deletePasskey(
            req,
            body,
          );

        default:
          return errorResponse(
            "Unknown security action",
            400,
          );
      }
    } catch (error) {
      console.error(
        "security-auth error:",
        error,
      );

      return errorResponse(
        error instanceof Error
          ? error.message
          : "Security operation failed",
        500,
      );
    }
  },
);
