(function () {
  "use strict";

  const NotificationBadge = {
    db: null,
    userId: null,

    init(config, userId) {
      if (!config || !userId || !window.supabase) return;

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

      this.render(0);
      this.load();
      this.subscribe();
    },

    getLink() {
      return document.querySelector(
        'a[href="notifications.html"]'
      );
    },

    render(count) {
      const link = this.getLink();
      if (!link) return;

      let badge = link.querySelector(
        ".notification-unread-badge"
      );

      if (!count) {
        if (badge) badge.remove();
        link.removeAttribute("aria-label");
        return;
      }

      if (!badge) {
        badge = document.createElement("span");
        badge.className = "notification-unread-badge";
        link.appendChild(badge);
      }

      badge.textContent =
        count > 99 ? "99+" : String(count);

      badge.setAttribute(
        "aria-label",
        `${count} unread notifications`
      );

      link.setAttribute(
        "aria-label",
        `Updates, ${count} unread notifications`
      );
    },

    async load() {
      if (!this.db || !this.userId) return;

      const { count, error } =
        await this.db
          .from("notifications")
          .select("id", {
            count: "exact",
            head: true
          })
          .eq("user_id", this.userId)
          .is("read_at", null);

      if (error) {
        console.error(
          "ZakiChat notification badge:",
          error
        );
        return;
      }

      this.render(count || 0);
    },

    subscribe() {
      if (!window.ZakiRealtime || !this.userId) {
        return;
      }

      window.ZakiRealtime.subscribeToNotifications(
        this.userId,
        () => {
          this.load();
        }
      );
    },

    destroy() {
      if (
        window.ZakiRealtime &&
        this.userId
      ) {
        window.ZakiRealtime.unsubscribe(
          `notifications:${this.userId}`
        );
      }

      this.db = null;
      this.userId = null;
    }
  };

  window.ZakiNotificationBadge =
    NotificationBadge;
})();
