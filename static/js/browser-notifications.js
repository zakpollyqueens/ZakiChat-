(function () {
  "use strict";

  const BrowserNotifications = {
    db: null,
    userId: null,
    channel: null,
    enabled: false,

    init(config, userId) {
      if (!config || !userId || !window.supabase) {
        return;
      }

      this.userId = userId;

      this.db =
        window.ZakiChatAuth?.client ||
        window.supabase.createClient(
          config.supabaseUrl,
          config.supabaseKey,
          {
            auth: {
              persistSession: true,
              autoRefreshToken: true,
              detectSessionInUrl: true,
              storageKey: "zakichat-auth"
            }
          }
        );

      this.enabled =
        "Notification" in window &&
        Notification.permission === "granted";

      this.subscribe();
    },

    async requestPermission() {
      if (!("Notification" in window)) {
        this.enabled = false;
        return "unsupported";
      }

      const permission =
        await Notification.requestPermission();

      this.enabled = permission === "granted";

      return permission;
    },

    subscribe() {
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
            icon: "../static/images/icon.jpg",
            badge: "../static/images/icon.jpg",
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

    destroy() {
      if (this.db && this.channel) {
        this.db.removeChannel(this.channel);
      }

      this.channel = null;
      this.db = null;
      this.userId = null;
      this.enabled = false;
    }
  };

  window.ZakiBrowserNotifications =
    BrowserNotifications;
})();
