(() => {
  "use strict";

  const FUNCTION_URL =
    "https://xdpevlurgtvgduwzyoue.supabase.co/functions/v1/two-step";
  const CONTENT_URL =
    "https://xdpevlurgtvgduwzyoue.supabase.co/functions/v1/admin-content";

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
            "Content-Type": "application/json",
            "apikey": window.ZakiChatConfig?.supabaseKey || ""
          },
          body: JSON.stringify({
            action: "admin-session-verify",
            adminSessionToken: token
          })
        });

        if (!response.ok) return false;

        const data = await response.json();

        if (!(data.success === true || data.valid === true || data.active === true)) return false;

        if (data.role) {
          localStorage.setItem(ROLE_KEY, data.role);
        }

        if (data.expiresAt || data.expires_at) {
          localStorage.setItem(EXPIRY_KEY, data.expiresAt || data.expires_at);
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
              "Content-Type": "application/json",
              "apikey": window.ZakiChatConfig?.supabaseKey || ""
            },
            body: JSON.stringify({
              action: "admin-session-revoke",
              adminSessionToken: token
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

  async function loadAnalytics() {
    const cfg = window.ZakiChatConfig;
    if (!cfg?.supabaseKey) throw new Error("Supabase configuration is unavailable.");
    const response = await fetch(CONTENT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": cfg.supabaseKey,
        "Authorization": `Bearer ${cfg.supabaseKey}`
      },
      body: JSON.stringify({
        action: "admin-analytics-summary",
        adminSessionToken: Admin.token()
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success !== true) throw new Error(data.error || "Unable to load platform analytics.");
    const m = data.metrics || {};
    $("total-users").textContent = String(m.totalUsers ?? 0);
    $("users-note").textContent = `${m.onlineUsers ?? 0} currently online · ${m.newUsers7d ?? 0} new in 7 days`;
    $("total-messages").textContent = String(m.totalMessages ?? 0);
    $("messages-note").textContent = `${m.messages7d ?? 0} messages in the last 7 days`;
    $("total-groups").textContent = String(m.totalGroups ?? 0);
    $("groups-note").textContent = "Groups currently recorded in the database";
    $("total-channels").textContent = String(m.totalChannels ?? 0);
    $("channels-note").textContent = "Channels currently recorded in the database";
    $("total-support").textContent = String(m.totalSupport ?? 0);
    $("support-note").textContent = `${m.openSupport ?? 0} open support requests`;
    $("total-payments").textContent = String(m.totalRegistrationPayments ?? 0);
    $("payments-note").textContent = `${m.paidRegistrationPayments ?? 0} marked paid · upgrade payments: ${m.paidPayments ?? 0}`;
    $("activity-value").textContent = String(m.onlineUsers ?? 0);
    $("activity-messages").textContent = String(m.messages7d ?? 0);
    $("activity-groups").textContent = String(m.totalGroups ?? 0);
    $("activity-support").textContent = String(m.openSupport ?? 0);
    $("data-state").textContent = `Live database summary refreshed ${new Date().toLocaleTimeString()}`;
  }

  async function initialize() {
    const valid = await Admin.verify();

    if (!valid) {
      Admin.clear();
      showDenied();
      return;
    }

    showApp();
    try {
      await loadAnalytics();
    } catch (error) {
      console.error("Analytics backend request failed:", error);
      $("data-state").textContent = error.message || "Analytics backend unavailable";
    }
  }

  $("go-login")?.addEventListener("click", () => {
    window.location.href = "admin.html";
  });

  $("refresh-analytics")?.addEventListener("click", () => {
    loadAnalytics().catch(error => { $("data-state").textContent = error.message; });
  });

  $("load-data")?.addEventListener("click", () => {
    loadAnalytics().catch(error => { $("data-state").textContent = error.message; });
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
