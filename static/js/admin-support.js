(() => {
  "use strict";

  const FUNCTION_URL =
    "https://xdpevlurgtvgduwzyoue.supabase.co/functions/v1/two-step";
  const CONTENT_URL =
    "https://xdpevlurgtvgduwzyoue.supabase.co/functions/v1/admin-content";
  let supportRows = [];

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

  function updateSession() {
    const info = $("session-info");

    if (info) {
      info.textContent =
        `${Admin.role()} • ${expiryText(Admin.expiry())}`;
    }
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
    if (!response.ok || data.success === false) throw new Error(data.error || "Support request failed.");
    return data;
  }

  function escapeHtml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }
  function formatDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
  }

  function renderRequests(metrics = {}) {
    const list = $("request-list");
    const query = ($("search").value || "").trim().toLowerCase();
    const status = $("status-filter").value || "all";
    const category = $("category-filter").value || "all";
    const rows = supportRows.filter(row => {
      const user = row.user || {};
      const matchesStatus = status === "all" || row.status === status;
      const matchesCategory = category === "all" || row.category === category;
      const searchable = [row.subject, row.message, row.category, user.username, user.full_name, user.phone, row.user_id].join(" ").toLowerCase();
      return matchesStatus && matchesCategory && (!query || searchable.includes(query));
    });
    $("open-count").textContent = String(metrics.open ?? supportRows.filter(row => row.status === "open").length);
    $("read-count").textContent = String(metrics.read ?? supportRows.filter(row => row.status === "read").length);
    $("resolved-count").textContent = String(metrics.resolved ?? supportRows.filter(row => row.status === "resolved").length);
    $("total-count").textContent = String(metrics.total ?? supportRows.length);
    $("request-state").textContent = `Protected backend connected · ${rows.length} shown`;

    list.innerHTML = rows.map(row => `
      <article class="request-card">
        <div class="request-card-head">
          <span class="request-category">${escapeHtml(row.category || "general")}</span>
          <span class="request-status ${escapeHtml(row.status || "open")}">${escapeHtml(row.status || "open")}</span>
        </div>
        <h3>${escapeHtml(row.subject || "Support request")}</h3>
        <p>${escapeHtml(row.message || "")}</p>
        <small>From ${escapeHtml(row.user?.full_name || row.user?.username || row.user?.phone || row.user_id || "User")} · ${escapeHtml(formatDate(row.created_at))}</small>
        <div class="request-actions">
          ${row.status !== "read" ? `<button type="button" data-request-status="read" data-request-id="${escapeHtml(row.id)}">Mark Read</button>` : ""}
          ${row.status !== "resolved" ? `<button type="button" data-request-status="resolved" data-request-id="${escapeHtml(row.id)}">Resolve</button>` : `<button type="button" data-request-status="open" data-request-id="${escapeHtml(row.id)}">Reopen</button>`}
        </div>
      </article>
    `).join("");
    $("empty")?.classList.toggle("hidden", rows.length > 0);
    if (!rows.length) {
      $("empty").innerHTML = "<div class='empty-icon'>💬</div><h3>No matching requests</h3><p>Try another search or filter.</p>";
    }
    list.querySelectorAll("[data-request-status]").forEach(button => {
      button.addEventListener("click", () => updateRequestStatus(button.dataset.requestId, button.dataset.requestStatus));
    });
  }

  async function loadRequests() {
    const data = await adminRequest({
      action: "admin-support-list",
      adminSessionToken: Admin.token()
    });
    supportRows = Array.isArray(data.requests) ? data.requests : [];
    renderRequests(data.metrics || {});
  }

  async function updateRequestStatus(id, status) {
    try {
      const result = await adminRequest({
        action: "admin-support-update",
        adminSessionToken: Admin.token(),
        id,
        status
      });
      supportRows = supportRows.map(row => row.id === id ? { ...row, ...result.request } : row);
      renderRequests();
    } catch (error) {
      console.error("Support status update failed:", error);
      $("request-state").textContent = error.message || "Unable to update request.";
    }
  }

  function clearFilters() {
    $("search").value = "";
    $("status-filter").value = "all";
    $("category-filter").value = "all";
    renderRequests();
  }
  function selectCategory(category) {
    $("category-filter").value = category;
    renderRequests();
    $("search").focus();
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
      await loadRequests();
    } catch (error) {
      console.error("Unable to load support requests:", error);
      $("request-state").textContent = error.message || "Support backend unavailable.";
      $("empty").classList.remove("hidden");
      $("empty").innerHTML = "<div class='empty-icon'>!</div><h3>Could not load support requests</h3><p>" + escapeHtml(error.message) + "</p>";
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

  $("clear")?.addEventListener("click", clearFilters);
  $("search")?.addEventListener("input", renderRequests);
  $("status-filter")?.addEventListener("change", renderRequests);
  $("category-filter")?.addEventListener("change", renderRequests);

  document.querySelectorAll(".category").forEach(button => {
    button.addEventListener("click", () => {
      selectCategory(button.dataset.category);
    });
  });

  initialize();
})();
