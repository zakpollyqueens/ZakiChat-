(function () {
  "use strict";

  const Settings = {
    client: null,
    userId: null,

    async init() {
      if (window.ZakiChatI18n) {
        window.ZakiChatI18n.applyTranslations();

        const label =
          document.getElementById("currentLanguageLabel");

        if (label) {
          const language =
            window.ZakiChatI18n.getLanguage(
              window.ZakiChatI18n.getCurrentLanguage()
            );

          label.textContent =
            language.nativeName;
        }
      }

      if (!window.ZakiChatConfig || !window.supabase) {
        return;
      }

      this.client =
        window.ZakiChatAuth?.client;

      if (!this.client) {
        console.error(
          "Zamivox Settings: centralized Supabase client unavailable."
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

  function setupSettingsHubSearch() {
    const input = document.getElementById("settingsHubSearch");
    const results = document.getElementById("settingsSearchResults");
    const hint = document.getElementById("settingsSearchHint");
    const clear = document.getElementById("clearSettingsSearch");
    if (!input || !results || !hint || !clear) return;

    const items = Array.from(document.querySelectorAll(".settings-shell a.settings-item[href], .settings-shell a.settings-profile-link[href]"))
      .filter(item => !item.classList.contains("settings-item-disabled"))
      .map(item => {
        const group = item.closest(".settings-group");
        const title = item.querySelector(".settings-item-copy strong, .settings-profile-copy strong")?.textContent?.trim() || item.textContent.trim();
        const description = item.querySelector(".settings-item-copy small, .settings-profile-copy span")?.textContent?.trim() || "";
        const icon = item.querySelector(".settings-item-icon")?.textContent?.trim() || item.querySelector(".settings-profile-avatar")?.textContent?.trim() || "⚙️";
        return { href: item.getAttribute("href"), title, description, icon, category: group?.querySelector("h2")?.textContent?.trim() || (item.classList.contains("settings-profile-link") ? "Profile" : "Settings"), searchText: (title + " " + description + " " + (group?.querySelector("h2")?.textContent || "")).toLocaleLowerCase() };
      });

    const escapeHtml = value => String(value).replace(/[&<>"']/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#39;" }[ch]));
    function render() {
      const query = input.value.trim().toLocaleLowerCase();
      clear.hidden = !input.value;
      results.replaceChildren();
      if (!query) {
        results.hidden = true;
        hint.textContent = "Search by setting name or description. Matching options will appear below.";
        return;
      }
      const terms = query.split(/\\s+/).filter(Boolean);
      const matches = items.filter(item => terms.every(term => item.searchText.includes(term))).slice(0, 30);
      results.hidden = false;
      hint.textContent = matches.length ? matches.length + (matches.length === 1 ? " matching setting" : " matching settings") + " — tap one to open it." : "No matching settings found. Try another word, such as account, theme, sound or privacy.";
      if (!matches.length) {
        const empty = document.createElement("div");
        empty.className = "settings-search-empty";
        empty.textContent = "No settings matched “" + input.value.trim() + "”. Your settings have not been changed.";
        results.appendChild(empty);
        return;
      }
      matches.forEach(item => {
        const link = document.createElement("a");
        link.className = "settings-search-result";
        link.href = item.href;
        link.innerHTML = '<span class="settings-item-icon" aria-hidden="true">' + escapeHtml(item.icon) + '</span><span class="settings-search-result-copy"><strong>' + escapeHtml(item.title) + '</strong><small>' + escapeHtml(item.description) + '</small><span class="settings-search-category">' + escapeHtml(item.category) + '</span></span><span class="settings-chevron" aria-hidden="true">›</span>';
        results.appendChild(link);
      });
    }
    input.addEventListener("input", render);
    clear.addEventListener("click", () => { input.value = ""; render(); input.focus(); });
    input.addEventListener("keydown", event => {
      if (event.key === "Escape") { input.value = ""; render(); }
      if (event.key === "Enter") { const first = results.querySelector("a.settings-search-result"); if (first) { event.preventDefault(); first.click(); } }
    });
  }

  document.addEventListener(
    "DOMContentLoaded",
    () => {
      setupSettingsHubSearch();
      Settings.init().catch(error => {
        console.error(
          "Zamivox settings:",
          error
        );
      });
    }
  );
})();
