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

      if (!token) {
        return false;
      }

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

        if (!response.ok) {
          return false;
        }

        const data = await response.json();

        if (!data.valid) {
          return false;
        }

        if (data.role) {
          localStorage.setItem(ROLE_KEY, data.role);
        }

        if (data.expires_at) {
          localStorage.setItem(EXPIRY_KEY, data.expires_at);
        }

        return true;
      } catch (error) {
        console.error("Admin session verification failed:", error);
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
        console.warn("Admin revoke request failed:", error);
      }

      this.clear();
      window.location.href = "admin.html";
    }
  };

  window.ZakiChatAdmin = Admin;

  function formatExpiry(value) {
    if (!value) {
      return "Expiry unavailable";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "Expiry unavailable";
    }

    const remaining = date.getTime() - Date.now();

    if (remaining <= 0) {
      return "Session expired";
    }

    const days = Math.floor(remaining / 86400000);
    const hours = Math.floor((remaining % 86400000) / 3600000);

    if (days > 0) {
      return `Expires in ${days}d ${hours}h`;
    }

    const minutes = Math.floor(remaining / 60000);

    if (hours > 0) {
      return `Expires in ${hours}h ${minutes % 60}m`;
    }

    return `Expires in ${Math.max(1, minutes)}m`;
  }

  function updateSessionDisplay() {
    const role = $("admin-role");
    const expiry = $("admin-expiry");

    if (role) {
      role.textContent = Admin.role();
    }

    if (expiry) {
      expiry.textContent = formatExpiry(Admin.expiry());
    }
  }

  function showDashboard() {
    $("admin-loading")?.classList.add("hidden");
    $("admin-denied")?.classList.add("hidden");
    $("admin-app")?.classList.remove("hidden");

    updateSessionDisplay();

    setInterval(() => {
      updateSessionDisplay();

      const expiry = Admin.expiry();

      if (expiry && new Date(expiry).getTime() <= Date.now()) {
        Admin.clear();
        window.location.href = "admin.html";
      }
    }, 30000);
  }

  function showDenied() {
    $("admin-loading")?.classList.add("hidden");
    $("admin-app")?.classList.add("hidden");
    $("admin-denied")?.classList.remove("hidden");
  }

  async function initialize() {
    const valid = await Admin.verify();

    if (!valid) {
      Admin.clear();
      showDenied();
      return;
    }

    showDashboard();
  }

  $("go-admin-login")?.addEventListener("click", () => {
    window.location.href = "admin.html";
  });

  $("refresh-dashboard")?.addEventListener("click", () => {
    window.location.reload();
  });

  $("secure-logout")?.addEventListener("click", () => {
    Admin.revoke();
  });

  $("secure-logout-bottom")?.addEventListener("click", () => {
    Admin.revoke();
  });

  initialize();
})();
