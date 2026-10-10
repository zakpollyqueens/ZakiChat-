(() => {
  "use strict";

  const FUNCTION_URL =
    "https://xdpevlurgtvgduwzyoue.supabase.co/functions/v1/two-step";
  const CONTENT_URL =
    "https://xdpevlurgtvgduwzyoue.supabase.co/functions/v1/admin-content";
  let reports = [];
  let communityStatuses = [];
  let moderationMetrics = {};

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
        "Authorization": "Bearer " + cfg.supabaseKey
      },
      body: JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success === false) throw new Error(data.error || "Moderation request failed.");
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

  function renderModeration() {
    const list = $("record-list");
    const query = ($("search").value || "").trim().toLowerCase();
    const status = $("status").value || "all";
    const type = $("type").value || "all";
    const filtered = reports.filter(report => {
      const matchesStatus = status === "all" || report.status === status;
      const matchesType = type === "all" || report.community_type === type;
      const searchable = [report.subject, report.details, report.category, report.community_type, report.community_id, report.id].join(" ").toLowerCase();
      return matchesStatus && matchesType && (!query || searchable.includes(query));
    });
    $("open-reports").textContent = String(moderationMetrics.openReports ?? reports.filter(item => item.status === "open").length);
    $("reported-users").textContent = String(moderationMetrics.groupReports ?? reports.filter(item => item.community_type === "group").length);
    $("reported-content").textContent = String(moderationMetrics.channelReports ?? reports.filter(item => item.community_type === "channel").length);
    $("blocked-users").textContent = String(moderationMetrics.restrictedCommunities ?? communityStatuses.filter(item => ["restricted", "suspended"].includes(item.status)).length);
    $("backend-state").textContent = "Protected backend connected";
    $("record-count").textContent = filtered.length + " report(s) shown";

    if (!filtered.length) {
      list.innerHTML = "";
      $("empty").classList.remove("hidden");
      $("empty").innerHTML = "<div>🛡️</div><h3>No matching reports</h3><p>There are no reports matching the selected filters.</p>";
      return;
    }
    $("empty").classList.add("hidden");
    list.innerHTML = filtered.map(report => {
      const statusRow = communityStatuses.find(item => item.community_type === report.community_type && item.community_id === report.community_id);
      const actions = [
        report.status !== "reviewing" ? ["mark_under_review", "Mark Review"] : null,
        report.status !== "action_required" ? ["require_changes", "Request Changes"] : null,
        ["restrict", "Restrict"],
        ["suspend", "Suspend"],
        statusRow && ["restricted", "suspended"].includes(statusRow.status) ? ["restore", "Restore"] : null,
        report.status !== "dismissed" ? ["dismiss_report", "Dismiss Report"] : null
      ].filter(Boolean);
      let buttons = "";
      actions.forEach(pair => {
        buttons += '<button type="button" data-moderation-action="' + escapeHtml(pair[0]) +
          '" data-community-type="' + escapeHtml(report.community_type) +
          '" data-community-id="' + escapeHtml(report.community_id) +
          '" data-report-id="' + escapeHtml(report.id) + '">' + escapeHtml(pair[1]) + '</button>';
      });
      return '<article class="moderation-record">' +
        '<div class="record-head"><span class="record-type">' + escapeHtml(report.community_type || "community") +
        ' · ' + escapeHtml(report.category || "report") + '</span><span class="record-status">' +
        escapeHtml(report.status || "open") + '</span></div><h3>' +
        escapeHtml(report.subject || "Community report") + '</h3><p>' +
        escapeHtml(report.details || "No additional details provided.") + '</p><small>Community ID: ' +
        escapeHtml(report.community_id || "—") + ' · Report ID: ' + escapeHtml(report.id || "—") +
        '</small><small>Submitted: ' + escapeHtml(formatDate(report.created_at)) +
        '</small><div class="record-actions">' + buttons + '</div></article>';
    }).join("");

    list.querySelectorAll("[data-moderation-action]").forEach(button => {
      button.addEventListener("click", () => runModerationAction(
        button.dataset.moderationAction, button.dataset.communityType,
        button.dataset.communityId, button.dataset.reportId
      ));
    });
  }

  async function loadModeration() {
    const data = await adminRequest({
      action: "admin-moderation-list",
      adminSessionToken: Admin.token(),
      status: "all",
      communityType: "all"
    });
    reports = Array.isArray(data.reports) ? data.reports : [];
    communityStatuses = Array.isArray(data.communityStatuses) ? data.communityStatuses : [];
    moderationMetrics = data.metrics || {};
    renderModeration();
  }

  async function runModerationAction(action, communityType, communityId, reportId) {
    if (!communityType || !communityId) {
      window.alert("This report does not contain a valid group or channel ID.");
      return;
    }
    const reason = window.prompt("Enter the reason for this moderation action:");
    if (!reason || reason.trim().length < 2) return;
    if (!window.confirm("Confirm moderation action: " + action.replaceAll("_", " ") + "?")) return;
    try {
      await adminRequest({
        action: "admin-moderation-action",
        adminSessionToken: Admin.token(),
        communityType,
        communityId,
        moderationAction: action,
        reason: reason.trim(),
        reportId
      });
      await loadModeration();
    } catch (error) {
      window.alert(error.message || "Unable to apply moderation action.");
    }
  }

  function clearFilters() {
    $("search").value = "";
    $("status").value = "all";
    $("type").value = "all";
    renderModeration();
  }
  function selectView(view) {
    if (view === "reports") $("status").value = "open";
    else if (view === "users") $("type").value = "group";
    else if (view === "content") $("type").value = "channel";
    else { $("status").value = "all"; $("type").value = "all"; }
    renderModeration();
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
      await loadModeration();
    } catch (error) {
      console.error("Moderation backend request failed:", error);
      $("backend-state").textContent = error.message || "Moderation backend unavailable";
      $("empty").classList.remove("hidden");
      $("empty").innerHTML = "<div>!</div><h3>Could not load moderation records</h3><p>" + escapeHtml(error.message) + "</p>";
    }
  }

  $("login")?.addEventListener("click", () => {
    window.location.href = "admin.html";
  });

  $("refresh")?.addEventListener("click", () => {
    loadModeration().catch(error => { $("backend-state").textContent = error.message; });
  });

  $("logout")?.addEventListener("click", () => {
    Admin.revoke();
  });

  $("clear")?.addEventListener("click", clearFilters);
  $("search")?.addEventListener("input", renderModeration);
  $("status")?.addEventListener("change", renderModeration);
  $("type")?.addEventListener("change", renderModeration);

  document.querySelectorAll("[data-view]").forEach(button => {
    button.addEventListener("click", () => {
      selectView(button.dataset.view);
    });
  });

  document.querySelectorAll("[data-action]").forEach(button => {
    button.addEventListener("click", () => {
      const action = button.dataset.action;

      if (action === "support") {
        window.location.href = "admin-support.html";
      } else if (action === "users") {
        window.location.href = "admin-users.html";
      } else {
        selectView(action);
      }
    });
  });

  initialize();
})();
