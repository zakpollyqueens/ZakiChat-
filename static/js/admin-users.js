(() => {
  "use strict";

  const FUNCTION_URL =
    "https://xdpevlurgtvgduwzyoue.supabase.co/functions/v1/two-step";

  const TOKEN_KEY = "zakichat-admin-session";
  const ROLE_KEY = "zakichat-admin-role";
  const EXPIRY_KEY = "zakichat-admin-expiry";

  const $ = id => document.getElementById(id);

  const Admin = {
    token() {
      return localStorage.getItem(TOKEN_KEY);
    },

    role() {
      return localStorage.getItem(ROLE_KEY) || "Administrator";
    },

    expiry() {
      return localStorage.getItem(EXPIRY_KEY);
    },

    clear() {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(ROLE_KEY);
      localStorage.removeItem(EXPIRY_KEY);
    },

    async verify() {
      const token = this.token();

      if (!token) return false;

      try {
        const response = await fetch(FUNCTION_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            action: "admin-session-verify",
            token
          })
        });

        if (!response.ok) return false;

        const data = await response.json();

        if (!data.valid) return false;

        if (data.role) {
          localStorage.setItem(ROLE_KEY, data.role);
        }

        if (data.expires_at) {
          localStorage.setItem(EXPIRY_KEY, data.expires_at);
        }

        return true;
      } catch (error) {
        console.error("Admin verification failed:", error);
        return false;
      }
    },

    async revoke() {
      const token = this.token();

      try {
        if (token) {
          await fetch(FUNCTION_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              action: "admin-session-revoke",
              token
            })
          });
        }
      } catch (error) {
        console.warn("Admin revoke failed:", error);
      }

      this.clear();
      window.location.href = "admin.html";
    }
  };

  function expiryText(value) {
    if (!value) return "Expiry unavailable";

    const time = new Date(value).getTime();

    if (!Number.isFinite(time)) {
      return "Expiry unavailable";
    }

    const remaining = time - Date.now();

    if (remaining <= 0) {
      return "Session expired";
    }

    const days = Math.floor(remaining / 86400000);
    const hours = Math.floor((remaining % 86400000) / 3600000);
    const minutes = Math.floor((remaining % 3600000) / 60000);

    if (days > 0) return `Expires in ${days}d ${hours}h`;
    if (hours > 0) return `Expires in ${hours}h ${minutes}m`;

    return `Expires in ${Math.max(1, minutes)}m`;
  }

  function showApp() {
    $("loading")?.classList.add("hidden");
    $("denied")?.classList.add("hidden");
    $("app")?.classList.remove("hidden");

    updateSession();

    setInterval(() => {
      updateSession();

      const expiry = Admin.expiry();

      if (
        expiry &&
        new Date(expiry).getTime() <= Date.now()
      ) {
        Admin.clear();
        window.location.href = "admin.html";
      }
    }, 30000);
  }

  function showDenied() {
    $("loading")?.classList.add("hidden");
    $("app")?.classList.add("hidden");
    $("denied")?.classList.remove("hidden");
  }

  function updateSession() {
    if ($("session-info")) {
      $("session-info").textContent =
        `${Admin.role()} • ${expiryText(Admin.expiry())}`;
    }
  }

  function prepareDirectory() {
    /*
     * User records are intentionally not fabricated.
     * The privileged Admin User backend will supply real records.
     *
     * Never place a Supabase service-role key in this browser file.
     */
    $("result-count").textContent =
      "Secure user-data connection pending";
  }

  function handleTool(action) {
    if (action === "profiles") {
      $("search").focus();
      $("search").placeholder = "Search user profiles...";
      return;
    }

    if (action === "activity") {
      window.location.href = "admin-analytics.html?metric=activity";
      return;
    }

    if (action === "status") {
      window.location.href = "admin-moderation.html";
      return;
    }

    if (action === "payments") {
      window.location.href = "admin-payments.html";
    }
  }

  async function initialize() {
    const valid = await Admin.verify();

    if (!valid) {
      Admin.clear();
      showDenied();
      return;
    }

    prepareDirectory();
    showApp();
  }

  $("login")?.addEventListener("click", () => {
    window.location.href = "admin.html";
  });

  $("refresh")?.addEventListener("click", () => {
    window.location.reload();
  });

  $("logout")?.addEventListener("click", () => {
    Admin.revoke();
  });

  $("clear-search")?.addEventListener("click", () => {
    $("search").value = "";
    $("status-filter").value = "all";
    $("result-count").textContent =
      "Secure user-data connection pending";
  });

  $("search")?.addEventListener("input", () => {
    /*
     * Filtering will be applied to the real privileged user
     * directory once the backend endpoint is connected.
     */
  });

  $("status-filter")?.addEventListener("change", () => {
    /*
     * Account status filtering will use real backend records.
     */
  });

  document.querySelectorAll("[data-action]").forEach(button => {
    button.addEventListener("click", () => {
      handleTool(button.dataset.action);
    });
  });

  initialize();
})();
