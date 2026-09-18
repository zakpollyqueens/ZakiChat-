(function () {
  "use strict";

  const BrowserNotifications = {
    db: null,
    userId: null,
    channel: null,
    enabled: false,
    subscription: null,

    init(config, userId) {
      if (!config || !userId || !window.supabase) {
        return;
      }

      this.userId = userId;

      this.db =
        window.ZakiChatAuth?.client;

      if (!this.db) {
        console.error(
          "ZakiChat Browser Notifications: centralized Supabase client unavailable."
        );
        return;
      }

      this.enabled =
        "Notification" in window &&
        Notification.permission === "granted";

      this.subscribeRealtime();
      this.loadExistingSubscription();
    },

    isSupported() {
      return (
        "Notification" in window &&
        "serviceWorker" in navigator &&
        "PushManager" in window
      );
    },

    async requestPermission() {
      if (!this.isSupported()) {
        this.enabled = false;
        return "unsupported";
      }

      const permission =
        await Notification.requestPermission();

      this.enabled = permission === "granted";

      if (permission !== "granted") {
        return permission;
      }

      const subscription =
        await this.subscribeToPush();

      if (!subscription) {
        this.enabled = false;
        return "subscription_failed";
      }

      return "granted";
    },

    async subscribeToPush() {
      if (!this.isSupported() || !this.userId) {
        return null;
      }

      const vapidPublicKey =
        window.ZakiChatConfig?.vapidPublicKey;

      if (!vapidPublicKey) {
        console.error(
          "ZakiChat: VAPID public key is missing."
        );
        return null;
      }

      try {
        const registration =
          await navigator.serviceWorker.ready;

        let subscription =
          await registration.pushManager.getSubscription();

        if (!subscription) {
          subscription =
            await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey:
                this.urlBase64ToUint8Array(
                  vapidPublicKey
                )
            });
        }

        this.subscription = subscription;

        const json = subscription.toJSON();

        if (
          !json.endpoint ||
          !json.keys ||
          !json.keys.p256dh ||
          !json.keys.auth
        ) {
          throw new Error(
            "Invalid Push subscription."
          );
        }

        const { error } =
          await this.db
            .from("push_subscriptions")
            .upsert(
              {
                user_id: this.userId,
                endpoint: json.endpoint,
                p256dh: json.keys.p256dh,
                auth: json.keys.auth,
                user_agent:
                  navigator.userAgent || null,
                updated_at:
                  new Date().toISOString()
              },
              {
                onConflict:
                  "user_id,endpoint"
              }
            );

        if (error) {
          console.error(
            "ZakiChat push subscription save failed:",
            error
          );
          return null;
        }

        this.enabled = true;

        return subscription;
      } catch (error) {
        console.error(
          "ZakiChat push subscription failed:",
          error
        );
        return null;
      }
    },

    async loadExistingSubscription() {
      if (!this.isSupported()) {
        return;
      }

      try {
        const registration =
          await navigator.serviceWorker.ready;

        const subscription =
          await registration.pushManager.getSubscription();

        if (!subscription) {
          return;
        }

        this.subscription = subscription;

        if (
          "Notification" in window &&
          Notification.permission === "granted"
        ) {
          this.enabled = true;
        }
      } catch (error) {
        console.error(
          "ZakiChat push subscription lookup failed:",
          error
        );
      }
    },

    async unsubscribeFromPush() {
      if (!this.userId || !this.db) {
        return false;
      }

      try {
        const registration =
          await navigator.serviceWorker.ready;

        const subscription =
          await registration.pushManager.getSubscription();

        if (subscription) {
          const endpoint =
            subscription.endpoint;

          await subscription.unsubscribe();

          const { error } =
            await this.db
              .from("push_subscriptions")
              .delete()
              .eq("user_id", this.userId)
              .eq("endpoint", endpoint);

          if (error) {
            console.error(
              "ZakiChat push subscription removal failed:",
              error
            );
            return false;
          }
        }

        this.subscription = null;
        this.enabled = false;

        return true;
      } catch (error) {
        console.error(
          "ZakiChat push unsubscribe failed:",
          error
        );
        return false;
      }
    },

    urlBase64ToUint8Array(base64String) {
      const padding =
        "=".repeat(
          (4 - (base64String.length % 4)) % 4
        );

      const base64 =
        (base64String + padding)
          .replace(/-/g, "+")
          .replace(/_/g, "/");

      const rawData =
        window.atob(base64);

      return Uint8Array.from(
        [...rawData].map(char =>
          char.charCodeAt(0)
        )
      );
    },

    subscribeRealtime() {
      if (!this.db || !this.userId) {
        return;
      }

      if (this.channel) {
        this.db.removeChannel(this.channel);
      }

      const channelName =
        `browser-notifications:${this.userId}`;

      this.channel =
        this.db
          .channel(channelName)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "notifications",
              filter:
                `user_id=eq.${this.userId}`
            },
            payload => {
              this.handleNotification(payload.new);
            }
          )
          .subscribe();
    },

    async handleNotification(notification) {
      if (!notification || !this.enabled) {
        return;
      }

      if (
        !("Notification" in window) ||
        Notification.permission !== "granted"
      ) {
        return;
      }

      if (!("serviceWorker" in navigator)) {
        return;
      }

      try {
        const registration =
          await navigator.serviceWorker.ready;

        await registration.showNotification(
          notification.title || "ZakiChat",
          {
            body:
              notification.body ||
              "You have a new notification.",
            icon: "/static/images/icon.jpg",
            badge: "/static/images/icon.jpg",
            tag: notification.id
              ? `zakichat-${notification.id}`
              : "zakichat-notification",
            data: {
              actorId:
                notification.actor_id || "",
              conversationId:
                notification.conversation_id || "",
              messageId:
                notification.message_id || "",
              notificationId:
                notification.id || ""
            }
          }
        );
      } catch (error) {
        console.error(
          "ZakiChat browser notification:",
          error
        );
      }
    },

    async destroy() {
      if (this.db && this.channel) {
        this.db.removeChannel(this.channel);
      }

      this.channel = null;
      this.db = null;
      this.userId = null;
      this.enabled = false;
      this.subscription = null;
    }
  };

  window.ZakiBrowserNotifications =
    BrowserNotifications;
})();
