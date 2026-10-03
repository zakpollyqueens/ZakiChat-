(() => {
  "use strict";

  const FUNCTION_URL =
    "https://xdpevlurgtvgduwzyoue.supabase.co/functions/v1/two-step";

  const TOKEN_KEY = "zakichat-admin-session";
  const ROLE_KEY = "zakichat-admin-role";
  const EXPIRY_KEY = "zakichat-admin-expiry";

  const $ = (id) => document.getElementById(id);

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
        console.error("Admin verification error:", error);
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

    const expiry = new Date(value).getTime();

    if (!Number.isFinite(expiry)) {
      return "Expiry unavailable";
    }

    const remaining = expiry - Date.now();

    if (remaining <= 0) {
      return "Session expired";
    }

    const days = Math.floor(remaining / 86400000);
    const hours = Math.floor((remaining % 86400000) / 3600000);
    const minutes = Math.floor((remaining % 3600000) / 60000);

    if (days > 0) {
      return `Expires in ${days}d ${hours}h`;
    }

    if (hours > 0) {
      return `Expires in ${hours}h ${minutes}m`;
    }

    return `Expires in ${Math.max(1, minutes)}m`;
  }

  function updateSession() {
    if ($("admin-role")) {
      $("admin-role").textContent = Admin.role();
    }

    if ($("admin-expiry")) {
      $("admin-expiry").textContent = expiryText(Admin.expiry());
    }
  }

  function showApp() {
    $("analytics-loading")?.classList.add("hidden");
    $("analytics-denied")?.classList.add("hidden");
    $("analytics-app")?.classList.remove("hidden");

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
    $("analytics-loading")?.classList.add("hidden");
    $("analytics-app")?.classList.add("hidden");
    $("analytics-denied")?.classList.remove("hidden");
  }

  /*
   * Real analytics are intentionally not fabricated here.
   *
   * The next secure backend connection will expose privileged,
   * aggregated analytics through the Admin Edge Function.
   *
   * Never place a Supabase service-role key in this browser file.
   */
  function prepareAnalytics() {
    const state = $("data-state");

    if (state) {
      state.textContent = "Secure analytics backend ready for connection";
    }
  }

  async function initialize() {
    const valid = await Admin.verify();

    if (!valid) {
      Admin.clear();
      showDenied();
      return;
    }

    prepareAnalytics();
    showApp();
  }

  $("go-login")?.addEventListener("click", () => {
    window.location.href = "admin.html";
  });

  $("refresh-analytics")?.addEventListener("click", () => {
    window.location.reload();
  });

  $("load-data")?.addEventListener("click", () => {
    window.location.reload();
  });

  $("activity-focus")?.addEventListener("click", () => {
    document.querySelector(".activity-grid")?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  });

  $("logout")?.addEventListener("click", () => {
    Admin.revoke();
  });

  initialize();
})();
