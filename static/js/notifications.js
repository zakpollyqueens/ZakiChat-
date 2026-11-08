(function () {
  "use strict";

  const NotificationsPage = {
    db: null,
    userId: null,
    notifications: [],
    companyNotifications: [],
    session: null,
    realtimeChannel: null,

    async init() {
      if (!window.supabase || !window.ZakiChatConfig) {
        return;
      }

      this.db =
        window.ZakiChatAuth?.client;

      if (!this.db) {
        console.error(
          "Molan Chat Notifications: centralized Supabase client unavailable."
        );
        return;
      }

      const { data, error } =
        await this.db.auth.getSession();

      if (error || !data?.session?.user?.id) {
        return;
      }

      this.session = data.session;
      this.userId = data.session.user.id;

      this.bindEvents();

      await this.load();
      await this.loadCompanyNotifications();
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

      this.addChatNotificationControl();
    },

    getTargetUserId() {
      return String(
        new URLSearchParams(
          window.location.search
        ).get("user") || ""
      ).trim();
    },

    async resolveConversationId() {
      const targetUserId =
        this.getTargetUserId();

      if (!targetUserId ||
          !this.db ||
          !this.userId) {
        return null;
      }

      const { data: mine } =
        await this.db
          .from("conversation_members")
          .select("conversation_id")
          .eq(
            "user_id",
            this.userId
          );

      if (!mine?.length) {
        return null;
      }

      const ids =
        mine.map(
          row => row.conversation_id
        );

      const { data: theirs } =
        await this.db
          .from("conversation_members")
          .select("conversation_id")
          .eq(
            "user_id",
            targetUserId
          )
          .in(
            "conversation_id",
            ids
          );

      return theirs?.[0]?.conversation_id ||
        null;
    },

    async loadChatNotificationSetting() {
      const conversationId =
        await this.resolveConversationId();

      if (!conversationId) {
        return;
      }

      const { data, error } =
        await this.db
          .from("conversation_user_settings")
          .select("notifications_enabled")
          .eq(
            "conversation_id",
            conversationId
          )
          .eq(
            "user_id",
            this.userId
          )
          .maybeSingle();

      if (error) {
        console.warn(
          "Unable to load chat notification setting:",
          error
        );
        return;
      }

      const enabled =
        data?.notifications_enabled !== false;

      this.setChatNotificationButton(
        enabled
      );
    },

    setChatNotificationButton(enabled) {
      const button =
        document.getElementById(
          "chatNotificationToggle"
        );

      if (!button) return;

      button.textContent =
        enabled
          ? "🔔 Notifications enabled"
          : "🔕 Notifications muted";

      button.dataset.enabled =
        enabled ? "true" : "false";
    },

    async toggleChatNotifications() {
      const conversationId =
        await this.resolveConversationId();

      if (!conversationId) {
        this.showError(
          "This notification setting is only available from a conversation."
        );
        return;
      }

      const button =
        document.getElementById(
          "chatNotificationToggle"
        );

      const currentEnabled =
        button?.dataset.enabled !== "false";

      const nextEnabled =
        !currentEnabled;

      const { error } =
        await this.db
          .from("conversation_user_settings")
          .upsert(
            {
              conversation_id:
                conversationId,
              user_id:
                this.userId,
              notifications_enabled:
                nextEnabled
            },
            {
              onConflict:
                "conversation_id,user_id"
            }
          );

      if (error) {
        console.error(
          "Molan Chat chat notification update:",
          error
        );

        this.showError(
          "We couldn't update this chat's notifications."
        );

        return;
      }

      this.setChatNotificationButton(
        nextEnabled
      );
    },

    addChatNotificationControl() {
      if (!this.getTargetUserId()) {
        return;
      }

      const header =
        document.querySelector(
          ".notifications-header"
        );

      if (!header ||
          document.getElementById(
            "chatNotificationToggle"
          )) {
        return;
      }

      const button =
        document.createElement("button");

      button.type = "button";
      button.id =
        "chatNotificationToggle";
      button.className =
        "notifications-action";
      button.textContent =
        "🔔 Chat notifications";

      button.addEventListener(
        "click",
        () => this.toggleChatNotifications()
      );

      header.appendChild(button);

      this.loadChatNotificationSetting();
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
          "Molan Chat notifications load:",
          error
        );

        this.showError(
          "We couldn't load your notifications. Please try again."
        );

        return;
      }

      this.notifications = data || [];
      await this.loadCompanyNotifications();
      this.render();
      this.updateBadge();
    },

    async loadCompanyNotifications() {
      if (!this.session?.access_token) return;
      try {
        const response = await fetch("https://mmozesoarwkimhyloivu.supabase.co/functions/v1/zakitech-product-bridge", {
          method: "POST",
          headers: {"Content-Type":"application/json","Authorization":"Bearer "+this.session.access_token},
          body: JSON.stringify({action:"list-customer-notifications",product_slug:"molan-chat"})
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Company notifications are unavailable.");
        this.companyNotifications = (data.notifications || []).map(item => ({...item,source:"zakitech",type:item.notification_type,created_at:item.published_at || item.created_at}));
      } catch (error) {
        console.warn("ZakiTech application notices could not be loaded:", error.message);
        this.companyNotifications = [];
      }
    },

    async markCompanyNotificationRead(id) {
      if (!this.session?.access_token) return;
      const response = await fetch("https://mmozesoarwkimhyloivu.supabase.co/functions/v1/zakitech-product-bridge", {
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":"Bearer "+this.session.access_token},
        body:JSON.stringify({action:"mark-notification-read",product_slug:"molan-chat",notification_id:id})
      });
      if(!response.ok)throw new Error("Could not mark the company notification as read.");
      this.companyNotifications=this.companyNotifications.map(n=>n.id===id?{...n,read:true}:n);
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

      const allNotifications = [...this.companyNotifications, ...this.notifications];
      if (!allNotifications.length) {
        empty.hidden = false;
        return;
      }

      empty.hidden = true;

      allNotifications.forEach(
        notification => {
          const item =
            document.createElement("article");

          item.className =
            "notification-card" +
            (notification.read_at
              ? ""
              : " is-unread");

          item.dataset.notificationId = notification.id;
          if (notification.source === "zakitech") item.dataset.source = "zakitech";

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
          if (notification.media_url) { const media = document.createElement("img"); media.src = notification.media_url; media.alt = "Notification attachment"; media.loading = "lazy"; media.style.maxWidth = "100%"; media.style.borderRadius = "12px"; content.appendChild(media); }

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
                  `chat.html?user=${encodeURIComponent(
                    notification.actor_id
                  )}`;
              }
            );
          }

          if (notification.source === "zakitech") {
            item.addEventListener("click", async () => {
              if (notification.read) return;
              try { await this.markCompanyNotificationRead(notification.id); item.classList.remove("is-unread"); }
              catch (error) { console.warn(error); }
            });
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
          "Molan Chat notifications mark read:",
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
      if (window.ZakiNotificationBadge) window.ZakiNotificationBadge.load();
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

        case "business_task_assigned":
          return "📋";

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
