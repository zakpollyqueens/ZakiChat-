(function () {
  "use strict";

  const NotificationsPage = {
    db: null,
    userId: null,
    notifications: [],
    realtimeChannel: null,

    async init() {
      if (!window.supabase || !window.ZakiChatConfig) {
        return;
      }

      this.db =
        window.ZakiChatAuth?.client ||
        window.supabase.createClient(
          window.ZakiChatConfig.supabaseUrl,
          window.ZakiChatConfig.supabaseKey,
          {
            auth: {
              persistSession: true,
              autoRefreshToken: true,
              detectSessionInUrl: true,
              storageKey: "zakichat-auth"
            }
          }
        );

      const { data, error } =
        await this.db.auth.getSession();

      if (error || !data?.session?.user?.id) {
        return;
      }

      this.userId = data.session.user.id;

      this.bindEvents();

      await this.load();

      await this.markAllAsRead();

      this.subscribe();
    },

    bindEvents() {
      const button =
        document.getElementById(
          "markAllReadButton"
        );

      if (button) {
        button.addEventListener(
          "click",
          () => this.markAllAsRead()
        );
      }
    },

    async load() {
      if (!this.db || !this.userId) return;

      this.hideError();

      const { data, error } =
        await this.db
          .from("notifications")
          .select(
            "id, actor_id, conversation_id, message_id, type, title, body, read_at, created_at"
          )
          .eq("user_id", this.userId)
          .order("created_at", {
            ascending: false
          })
          .limit(100);

      if (error) {
        console.error(
          "ZakiChat notifications load:",
          error
        );

        this.showError(
          "We couldn't load your notifications. Please try again."
        );

        return;
      }

      this.notifications = data || [];

      this.render();

      this.updateBadge();
    },

    render() {
      const list =
        document.getElementById(
          "notificationsList"
        );

      const empty =
        document.getElementById(
          "notificationsEmpty"
        );

      if (!list || !empty) return;

      list.innerHTML = "";

      if (!this.notifications.length) {
        empty.hidden = false;
        return;
      }

      empty.hidden = true;

      this.notifications.forEach(
        notification => {
          const item =
            document.createElement("article");

          item.className =
            "notification-card" +
            (notification.read_at
              ? ""
              : " is-unread");

          item.dataset.notificationId =
            notification.id;

          const icon =
            document.createElement("div");

          icon.className =
            "notification-card-icon";

          icon.textContent =
            this.getIcon(notification.type);

          const content =
            document.createElement("div");

          content.className =
            "notification-card-content";

          const title =
            document.createElement("h2");

          title.textContent =
            notification.title ||
            "New notification";

          const body =
            document.createElement("p");

          body.textContent =
            notification.body ||
            "You have a new update.";

          const meta =
            document.createElement("time");

          meta.dateTime =
            notification.created_at;

          meta.textContent =
            this.formatDate(
              notification.created_at
            );

          content.appendChild(title);
          content.appendChild(body);
          content.appendChild(meta);

          item.appendChild(icon);
          item.appendChild(content);

          if (notification.actor_id) {
            item.tabIndex = 0;
            item.setAttribute(
              "role",
              "button"
            );

            item.addEventListener(
              "click",
              () => {
                window.location.href =
                  `chats.html?user=${encodeURIComponent(
                    notification.actor_id
                  )}`;
              }
            );
          }

          list.appendChild(item);
        }
      );
    },

    async markAllAsRead() {
      if (!this.db || !this.userId) {
        return;
      }

      const unread =
        this.notifications.filter(
          notification =>
            !notification.read_at
        );

      if (!unread.length) {
        this.updateBadge();
        return;
      }

      const { error } =
        await this.db
          .from("notifications")
          .update({
            read_at:
              new Date().toISOString()
          })
          .eq("user_id", this.userId)
          .is("read_at", null);

      if (error) {
        console.error(
          "ZakiChat notifications mark read:",
          error
        );

        this.showError(
          "We couldn't mark the notifications as read."
        );

        return;
      }

      const readAt =
        new Date().toISOString();

      this.notifications =
        this.notifications.map(
          notification => ({
            ...notification,
            read_at:
              notification.read_at ||
              readAt
          })
        );

      this.render();
      this.updateBadge();
    },

    updateBadge() {
      if (
        window.ZakiNotificationBadge
      ) {
        window.ZakiNotificationBadge.load();
      }
    },

    subscribe() {
      if (
        !window.ZakiRealtime ||
        !this.userId
      ) {
        return;
      }

      this.realtimeChannel =
        window.ZakiRealtime.subscribeToNotifications(
          this.userId,
          async () => {
            await this.load();
          }
        );
    },

    getIcon(type) {
      switch (type) {
        case "mention":
          return "@";

        case "reply":
          return "↩";

        case "reaction":
          return "♥";

        case "system":
          return "ℹ";

        case "message":
        default:
          return "💬";
      }
    },

    formatDate(value) {
      if (!value) return "";

      const date =
        new Date(value);

      if (Number.isNaN(date.getTime())) {
        return "";
      }

      return date.toLocaleString(
        undefined,
        {
          dateStyle: "medium",
          timeStyle: "short"
        }
      );
    },

    showError(message) {
      const element =
        document.getElementById(
          "notificationsError"
        );

      if (!element) return;

      element.textContent = message;
      element.hidden = false;
    },

    hideError() {
      const element =
        document.getElementById(
          "notificationsError"
        );

      if (element) {
        element.hidden = true;
        element.textContent = "";
      }
    }
  };

  window.ZakiNotifications =
    NotificationsPage;

  document.addEventListener(
    "DOMContentLoaded",
    () => {
      NotificationsPage.init();
    }
  );
})();
