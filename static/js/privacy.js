(function () {
  "use strict";

  const Privacy = {
    client: null,
    userId: null,

    defaults: {
      last_seen_visibility: "contacts",
      online_visibility: "everyone",
      profile_photo_visibility: "everyone",
      about_visibility: "contacts",
      status_visibility: "contacts",
      read_receipts: true,
      groups_visibility: "everyone",
      calls_visibility: "everyone"
    },

    elements: {},

    async init() {
      this.cacheElements();

      if (!window.ZakiChatConfig || !window.supabase) {
        this.showMessage(
          "Privacy configuration is unavailable.",
          true
        );
        return;
      }

      this.client = window.ZakiChatAuth?.client;

      if (!this.client) {
        this.showMessage(
          "Secure account connection is unavailable.",
          true
        );
        return;
      }

      const { data, error } =
        await this.client.auth.getSession();

      if (error) {
        console.error(
          "ZakiChat Privacy session:",
          error
        );

        this.showMessage(
          "Unable to load your account session.",
          true
        );

        return;
      }

      this.userId = data?.session?.user?.id || null;

      if (!this.userId) {
        return;
      }

      this.bindEvents();
      await this.load();
    },

    cacheElements() {
      this.elements = {
        lastSeen:
          document.getElementById(
            "lastSeenVisibility"
          ),

        online:
          document.getElementById(
            "onlineVisibility"
          ),

        profilePhoto:
          document.getElementById(
            "profilePhotoVisibility"
          ),

        about:
          document.getElementById(
            "aboutVisibility"
          ),

        status:
          document.getElementById(
            "statusVisibility"
          ),

        readReceipts:
          document.getElementById(
            "readReceiptsToggle"
          ),

        groups:
          document.getElementById(
            "groupsVisibility"
          ),

        calls:
          document.getElementById(
            "callsVisibility"
          ),

        save:
          document.getElementById(
            "savePrivacy"
          ),

        message:
          document.getElementById(
            "privacyMessage"
          )
      };
    },

    bindEvents() {
      const readReceipts =
        this.elements.readReceipts;

      if (readReceipts) {
        readReceipts.addEventListener(
          "click",
          () => {
            const enabled =
              readReceipts.getAttribute(
                "aria-pressed"
              ) === "true";

            this.setReadReceipts(!enabled);
          }
        );
      }

      if (this.elements.save) {
        this.elements.save.addEventListener(
          "click",
          () => this.save()
        );
      }
    },

    async load() {
      this.showMessage(
        "Loading privacy settings…"
      );

      const { data, error } =
        await this.client
          .from("privacy_settings")
          .select("*")
          .eq("user_id", this.userId)
          .maybeSingle();

      if (error) {
        console.error(
          "ZakiChat Privacy load:",
          error
        );

        this.showMessage(
          "Unable to load privacy settings.",
          true
        );

        return;
      }

      const settings = {
        ...this.defaults,
        ...(data || {})
      };

      this.apply(settings);

      this.showMessage("");
    },

    apply(settings) {
      this.setValue(
        this.elements.lastSeen,
        settings.last_seen_visibility
      );

      this.setValue(
        this.elements.online,
        settings.online_visibility
      );

      this.setValue(
        this.elements.profilePhoto,
        settings.profile_photo_visibility
      );

      this.setValue(
        this.elements.about,
        settings.about_visibility
      );

      this.setValue(
        this.elements.status,
        settings.status_visibility
      );

      this.setValue(
        this.elements.groups,
        settings.groups_visibility
      );

      this.setValue(
        this.elements.calls,
        settings.calls_visibility
      );

      this.setReadReceipts(
        settings.read_receipts !== false
      );
    },

    setValue(element, value) {
      if (!element || value == null) {
        return;
      }

      const exists = Array.from(
        element.options || []
      ).some(
        option => option.value === value
      );

      if (exists) {
        element.value = value;
      }
    },

    setReadReceipts(enabled) {
      const button =
        this.elements.readReceipts;

      if (!button) {
        return;
      }

      button.setAttribute(
        "aria-pressed",
        String(Boolean(enabled))
      );

      button.classList.toggle(
        "enabled",
        Boolean(enabled)
      );

      const label =
        button.querySelector("b");

      if (label) {
        label.textContent =
          enabled ? "On" : "Off";
      }
    },

    collect() {
      const button =
        this.elements.readReceipts;

      return {
        user_id: this.userId,

        last_seen_visibility:
          this.elements.lastSeen.value,

        online_visibility:
          this.elements.online.value,

        profile_photo_visibility:
          this.elements.profilePhoto.value,

        about_visibility:
          this.elements.about.value,

        status_visibility:
          this.elements.status.value,

        read_receipts:
          button.getAttribute(
            "aria-pressed"
          ) === "true",

        groups_visibility:
          this.elements.groups.value,

        calls_visibility:
          this.elements.calls.value,

        updated_at:
          new Date().toISOString()
      };
    },

    async save() {
      const button =
        this.elements.save;

      if (!button || !this.userId) {
        return;
      }

      const originalText =
        button.textContent;

      button.disabled = true;
      button.textContent =
        "Saving…";

      this.showMessage("");

      const payload =
        this.collect();

      const { error } =
        await this.client
          .from("privacy_settings")
          .upsert(
            payload,
            {
              onConflict: "user_id"
            }
          );

      button.disabled = false;
      button.textContent =
        originalText;

      if (error) {
        console.error(
          "ZakiChat Privacy save:",
          error
        );

        this.showMessage(
          "Privacy settings could not be saved.",
          true
        );

        return;
      }

      this.showMessage(
        "Privacy settings saved."
      );
    },

    showMessage(message, isError = false) {
      const element =
        this.elements.message;

      if (!element) {
        return;
      }

      element.textContent =
        message || "";

      element.style.color =
        isError
          ? "#ff8f9f"
          : "";
    }
  };

  window.ZakiChatPrivacy = Privacy;

  document.addEventListener(
    "DOMContentLoaded",
    () => {
      Privacy.init().catch(error => {
        console.error(
          "ZakiChat Privacy:",
          error
        );

        Privacy.showMessage(
          "Privacy settings failed to initialize.",
          true
        );
      });
    }
  );
})();
