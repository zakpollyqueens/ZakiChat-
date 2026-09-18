import { createClient } from "supabase";
import webpush from "web-push";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get(
  "SUPABASE_SERVICE_ROLE_KEY"
);
const vapidPublicKey = Deno.env.get(
  "VAPID_PUBLIC_KEY"
);
const vapidPrivateKey = Deno.env.get(
  "VAPID_PRIVATE_KEY"
);
const vapidSubject = Deno.env.get(
  "VAPID_SUBJECT"
);

if (
  !supabaseUrl ||
  !serviceRoleKey ||
  !vapidPublicKey ||
  !vapidPrivateKey ||
  !vapidSubject
) {
  throw new Error(
    "Missing required notification function secrets."
  );
}

const supabase = createClient(
  supabaseUrl,
  serviceRoleKey
);

webpush.setVapidDetails(
  vapidSubject,
  vapidPublicKey,
  vapidPrivateKey
);

interface NotificationRecord {
  id: string;
  user_id: string;
  actor_id: string | null;
  conversation_id: string | null;
  message_id: string | null;
  type: string;
  title: string;
  body: string | null;
}

interface PushSubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

interface WebhookPayload {
  type: string;
  table: string;
  record: NotificationRecord;
}

const handler = async (
  request: Request
): Promise<Response> => {
  if (request.method !== "POST") {
    return Response.json(
      {
        error: "Method not allowed"
      },
      {
        status: 405
      }
    );
  }

  try {
    const payload =
      (await request.json()) as WebhookPayload;

    if (
      payload.type !== "INSERT" ||
      !payload.record?.user_id
    ) {
      return Response.json({
        ok: true,
        skipped: true
      });
    }

    const notification =
      payload.record;

    const { data: subscriptions, error } =
      await supabase
        .from("push_subscriptions")
        .select(
          "id,user_id,endpoint,p256dh,auth"
        )
        .eq(
          "user_id",
          notification.user_id
        );

    if (error) {
      throw error;
    }

    if (!subscriptions?.length) {
      return Response.json({
        ok: true,
        sent: 0,
        removed: 0
      });
    }

    const pushPayload =
      JSON.stringify({
        title:
          notification.title ||
          "ZakiChat",
        body:
          notification.body ||
          "You have a new notification.",
        actorId:
          notification.actor_id || "",
        conversationId:
          notification.conversation_id || "",
        messageId:
          notification.message_id || "",
        notificationId:
          notification.id || ""
      });

    let sent = 0;
    let removed = 0;

    for (
      const subscription
      of subscriptions as PushSubscriptionRow[]
    ) {
      const pushSubscription = {
        endpoint:
          subscription.endpoint,
        keys: {
          p256dh:
            subscription.p256dh,
          auth:
            subscription.auth
        }
      };

      try {
        await webpush.sendNotification(
          pushSubscription,
          pushPayload,
          {
            TTL: 86400,
            urgency: "high",
            contentEncoding:
              "aes128gcm"
          }
        );

        sent++;
      } catch (error) {
        const statusCode =
          typeof error === "object" &&
          error !== null &&
          "statusCode" in error
            ? Number(
                (error as {
                  statusCode?: number
                }).statusCode
              )
            : 0;

        console.error(
          "Web Push delivery failed:",
          error
        );

        if (
          statusCode === 404 ||
          statusCode === 410
        ) {
          const { error:
            deleteError
          } = await supabase
            .from("push_subscriptions")
            .delete()
            .eq(
              "id",
              subscription.id
            );

          if (!deleteError) {
            removed++;
          }
        }
      }
    }

    return Response.json({
      ok: true,
      sent,
      removed
    });
  } catch (error) {
    console.error(
      "ZakiChat notification function error:",
      error
    );

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unknown error"
      },
      {
        status: 500
      }
    );
  }
};

export default {
  fetch: handler
};
