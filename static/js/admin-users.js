(() => {
  "use strict";

  const FUNCTION_URL =
    "https://xdpevlurgtvgduwzyoue.supabase.co/functions/v1/two-step";
  const CONTENT_URL =
    "https://xdpevlurgtvgduwzyoue.supabase.co/functions/v1/admin-content";
  let userRows = [];
  let userMetrics = [];

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

  async function adminRequest(body) {
    const cfg = window.ZakiChatConfig;
    if (!cfg?.supabaseKey) throw new Error("Supabase configuration is unavailable.");
    const response = await fetch(CONTENT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": cfg.supabaseKey,
        "Authorization": `Bearer ${cfg.supabaseKey}`
      },
      body: JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success === false) {
      throw new Error(data.error || `User directory request failed (${response.status}).`);
    }
    return data;
  }

  function escapeHtml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  function renderUsers(metrics = userMetrics) {
    const list = $("users-list");
    const empty = $("empty");
    const query = ($("search").value || "").trim().toLowerCase();
    const status = $("status-filter").value || "all";
    const rows = userRows.filter(user => {
      const matchesStatus = status === "all" ||
        (status === "active" && user.account_status === "active") ||
        (status === "suspended" && user.account_status === "suspended");
      const searchable = [user.username, user.full_name, user.phone, user.id].join(" ").toLowerCase();
      return matchesStatus && (!query || searchable.includes(query));
    });

    $("total-users").textContent = String(metrics.total ?? userRows.length);
    $("active-users").textContent = String(metrics.online ?? userRows.filter(user => user.is_online).length);
    $("restricted-users").textContent = metrics.restricted == null ? "—" : String(metrics.restricted);
    $("new-users").textContent = String(metrics.newUsers ?? "—");
    $("result-count").textContent = `${rows.length} user(s) shown`;

    list.innerHTML = rows.map(user => `
      <article class="user-row">
        <div class="user-avatar">${escapeHtml((user.full_name || user.username || "U").slice(0, 1).toUpperCase())}</div>
        <div class="user-details">
          <strong>${escapeHtml(user.full_name || user.username || "ZakiChat user")}</strong>
          <span>@${escapeHtml(user.username || "no-username")}</span>
          <small>${escapeHtml(user.email || "Email not available")} · ${escapeHtml(user.phone || "Phone not available")}</small>
          <small>Joined ${escapeHtml(user.created_at ? new Date(user.created_at).toLocaleDateString() : "date unavailable")} · ${user.is_online ? "Online" : "Offline"}</small>
          <small>ID: ${escapeHtml(user.id)}</small>
        </div>
        <span class="user-status ${user.account_status === "suspended" ? "offline" : "online"}">${escapeHtml(user.account_status || "active")}</span>
        ${user.account_status === "suspended"
          ? `<button type="button" data-user-action="restore" data-user-id="${escapeHtml(user.id)}">Restore</button>`
          : `<button type="button" data-user-action="suspend" data-user-id="${escapeHtml(user.id)}">Suspend</button>`}
      </article>
    `).join("");

    empty?.classList.toggle("hidden", rows.length > 0);
    if (!rows.length) {
      empty.innerHTML = "<div>👤</div><h3>No matching users</h3><p>Try another search or account activity filter.</p>";
    }
  }

  async function updateUserStatus(userId, action) {
    const current = userRows.find(user => user.id === userId);
    if (!current) return;
    let reason = "";
    if (action === "suspend") {
      reason = window.prompt("Enter a reason for suspending this account:");
      if (!reason || reason.trim().length < 3) return;
      if (!window.confirm("Suspend " + (current.username || current.full_name || "this user") + "? They will not be able to sign in until restored.")) return;
    } else if (!window.confirm("Restore " + (current.username || current.full_name || "this user") + "'s sign-in access?")) {
      return;
    }
    try {
      await adminRequest({
        action: action === "suspend" ? "admin-user-suspend" : "admin-user-restore",
        adminSessionToken: Admin.token(),
        userId,
        reason
      });
      await loadUsers();
    } catch (error) {
      window.alert(error.message || "Unable to update this account.");
    }
  }

  async function loadUsers() {
    const data = await adminRequest({
      action: "admin-users-list",
      adminSessionToken: Admin.token(),
      search: $("search").value,
      status: $("status-filter").value
    });
    userRows = Array.isArray(data.users) ? data.users : [];
    userMetrics = data.metrics || {};
    renderUsers();
    if (data.truncated) $("result-count").textContent += " (latest 1,000; refine search)";
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
    showApp();
    try {
      await loadUsers();
    } catch (error) {
      console.error("Unable to load users:", error);
      $("result-count").textContent = "User backend unavailable";
      $("empty").classList.remove("hidden");
      $("empty").innerHTML = "<div>!</div><h3>Could not load users</h3><p>" + escapeHtml(error.message) + "</p>";
    }
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
    renderUsers();
  });

  $("search")?.addEventListener("input", () => renderUsers());
  $("status-filter")?.addEventListener("change", () => renderUsers());

  document.querySelectorAll("[data-action]").forEach(button => {
    button.addEventListener("click", () => {
      handleTool(button.dataset.action);
    });
  });

  initialize();
})();
