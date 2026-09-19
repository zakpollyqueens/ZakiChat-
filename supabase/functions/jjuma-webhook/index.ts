import { createHmac } from "node:crypto";

const WEBHOOK_SECRET = Deno.env.get("JJUMA_WEBHOOK_SECRET");

function jsonResponse(
  body: Record<string, unknown>,
  status = 200
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        "Content-Type": "application/json"
      }
    }
  );
}

function timingSafeEqual(
  a: string,
  b: string
): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;

  for (let i = 0; i < a.length; i++) {
    result |=
      a.charCodeAt(i) ^
      b.charCodeAt(i);
  }

  return result === 0;
}

function createSignature(
  timestamp: string,
  rawBody: string
): string {
  if (!WEBHOOK_SECRET) {
    throw new Error(
      "JJUMA_WEBHOOK_SECRET is not configured."
    );
  }

  const signedPayload =
    `${timestamp}.${rawBody}`;

  return createHmac(
    "sha256",
    WEBHOOK_SECRET
  )
    .update(signedPayload)
    .digest("hex");
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return jsonResponse(
      {
        ok: false,
        error: "Method not allowed."
      },
      405
    );
  }

  if (!WEBHOOK_SECRET) {
    console.error(
      "JJUMA_WEBHOOK_SECRET is missing."
    );

    return jsonResponse(
      {
        ok: false,
        error: "Webhook configuration error."
      },
      500
    );
  }

  try {
    const rawBody =
      await request.text();

    const signature =
      request.headers.get(
        "X-Jjuma-Signature"
      );

    const timestamp =
      request.headers.get(
        "X-Jjuma-Timestamp"
      );

    if (!signature || !timestamp) {
      return jsonResponse(
        {
          ok: false,
          error: "Missing webhook signature."
        },
        401
      );
    }

    const expectedSignature =
      createSignature(
        timestamp,
        rawBody
      );

    const suppliedSignature =
      signature.startsWith("sha256=")
        ? signature.slice(7)
        : signature;

    if (
      !timingSafeEqual(
        suppliedSignature,
        expectedSignature
      )
    ) {
      console.warn(
        "Rejected webhook with invalid signature."
      );

      return jsonResponse(
        {
          ok: false,
          error: "Invalid signature."
        },
        401
      );
    }

    let payload: unknown;

    try {
      payload =
        JSON.parse(rawBody);
    } catch {
      return jsonResponse(
        {
          ok: false,
          error: "Invalid JSON payload."
        },
        400
      );
    }

    console.log(
      "Verified JJuma webhook:",
      JSON.stringify(payload)
    );

    /*
     * Payment processing will be connected here
     * after we establish the exact ZakiChat payment
     * record/table and JJuma event payload.
     *
     * IMPORTANT:
     * The webhook is considered verified before any
     * payment-processing logic is allowed to run.
     */

    return jsonResponse({
      ok: true,
      received: true
    });
  } catch (error) {
    console.error(
      "JJuma webhook error:",
      error
    );

    return jsonResponse(
      {
        ok: false,
        error: "Webhook processing failed."
      },
      500
    );
  }
});
