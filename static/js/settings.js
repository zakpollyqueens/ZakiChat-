(function () {
  "use strict";

  const Settings = {
    client: null,
    userId: null,

    async init() {
      if (!window.ZakiChatConfig || !window.supabase) {
        return;
      }

      this.client =
        window.ZakiChatAuth?.client;

      if (!this.client) {
        console.error(
          "ZakiChat Settings: centralized Supabase client unavailable."
        );
        return;
      }

      const { data } =
        await this.client.auth.getSession();

      const userId = data?.session?.user?.id;

      if (!userId) {
        return;
      }

      this.userId = userId;

      if (window.ZakiBrowserNotifications) {
        window.ZakiBrowserNotifications.init(
          window.ZakiChatConfig,
          userId
        );
      }

      this.setupNotificationControl();
    },

    setupNotificationControl() {
      const button =
        document.getElementById(
          "notificationToggle"
        );

      const status =
        document.getElementById(
          "notificationStatus"
        );

      const message =
        document.getElementById(
          "notificationMessage"
        );

      if (!button || !status || !message) {
        return;
      }

      const updateUI = () => {
        if (!("Notification" in window)) {
          status.textContent =
            "Browser notifications are not supported.";

          button.textContent = "Not supported";
          button.disabled = true;

          return;
        }

        const permission =
          Notification.permission;

        if (permission === "granted") {
          status.textContent =
            "Notifications are enabled.";

          button.textContent =
            "Notifications enabled";

          button.disabled = false;

          button.classList.add("enabled");

          return;
        }

        if (permission === "denied") {
          status.textContent =
            "Notifications are blocked by your browser.";

          button.textContent =
            "Notifications blocked";

          button.disabled = true;

          button.classList.remove("enabled");

          return;
        }

        status.textContent =
          "Notifications are currently disabled.";

        button.textContent =
          "Enable notifications";

        button.disabled = false;

        button.classList.remove("enabled");
      };

      button.addEventListener(
        "click",
        async () => {
          if (
            !window.ZakiBrowserNotifications
          ) {
            return;
          }

          message.textContent =
            "Requesting notification permission…";

          const permission =
            await window.ZakiBrowserNotifications
              .requestPermission();

          if (permission === "granted") {
            message.textContent =
              "Browser notifications are now enabled.";

          } else if (permission === "denied") {
            message.textContent =
              "Notifications were blocked. You can change this in your browser settings.";

          } else if (permission === "unsupported") {
            message.textContent =
              "This browser does not support notifications.";

          } else {
            message.textContent =
              "Notification permission was not granted.";
          }

          updateUI();
        }
      );

      updateUI();
    }
  };

  document.addEventListener(
    "DOMContentLoaded",
    () => {
      Settings.init().catch(error => {
        console.error(
          "ZakiChat settings:",
          error
        );
      });
    }
  );
})();
