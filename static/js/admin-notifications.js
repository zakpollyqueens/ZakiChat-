(() => {
  "use strict";

  const TWO_STEP_URL = "https://xdpevlurgtvgduwzyoue.supabase.co/functions/v1/two-step";
  const CONTENT_URL = "https://xdpevlurgtvgduwzyoue.supabase.co/functions/v1/admin-content";
  const SESSION_KEY = "zakichat-admin-session";
  const ROLE_KEY = "zakichat-admin-role";
  const EXPIRY_KEY = "zakichat-admin-expiry";
  const $ = id => document.getElementById(id);
  let campaigns = [];

  function show(id) { $(id)?.classList.remove("hidden"); }
  function hide(id) { $(id)?.classList.add("hidden"); }
  function sessionData() {
    return {
      token: localStorage.getItem(SESSION_KEY),
      role: localStorage.getItem(ROLE_KEY),
      expiry: localStorage.getItem(EXPIRY_KEY) || ""
    };
  }
  function expiryMs(value) { return Date.parse(value) || Number(value) || 0; }
  function escapeHtml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }
  function formatDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
  }
  function setStatus(message, error = false) {
    const el = $("formStatus");
    if (!el) return;
    el.textContent = message;
    el.classList.toggle("error", error);
    el.setAttribute("role", "status");
  }
  async function request(url, body) {
    const cfg = window.ZakiChatConfig;
    if (!cfg?.supabaseKey) throw new Error("Supabase configuration is unavailable.");
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": cfg.supabaseKey,
        "Authorization": `Bearer ${cfg.supabaseKey}`
      },
      body: JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success === false) throw new Error(data.error || `Request failed (${response.status}).`);
    return data;
  }
  async function verifyAdminSession() {
    const s = sessionData();
    if (!s.token || !["admin", "super_admin"].includes(s.role) ||
        !expiryMs(s.expiry) || Date.now() >= expiryMs(s.expiry)) return false;
    try {
      const data = await request(TWO_STEP_URL, {
        action: "admin-session-verify",
        adminSessionToken: s.token
      });
      return data.success === true || data.valid === true || data.active === true;
    } catch (error) {
      console.error("Notification admin session verification failed:", error);
      return false;
    }
  }
  async function secureSignOut() {
    const token = sessionData().token;
    try {
      if (token) await request(TWO_STEP_URL, { action: "admin-session-revoke", adminSessionToken: token });
    } catch (error) {
      console.warn("Remote admin sign-out failed:", error);
    } finally {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(ROLE_KEY);
      localStorage.removeItem(EXPIRY_KEY);
      window.location.href = "admin.html";
    }
  }

  function previewNotification() {
    $("previewTitle").textContent = $("notificationTitle").value.trim() || "Notification Preview";
    $("previewMessage").textContent = $("notificationMessage").value.trim() || "Your notification message will appear here.";
    $("previewType").textContent = $("notificationType").selectedOptions[0]?.text || "General";
    $("previewAudience").textContent = `Audience: ${$("notificationAudience").selectedOptions[0]?.text || "All Users"}`;
    show("previewModal");
  }
  function closePreview() { hide("previewModal"); }

  function toggleSelectedRecipients() {
    const selected = $("notificationAudience").value === "selected";
    $("selectedRecipientsField").hidden = !selected;
    $("selectedUserIds").required = selected;
  }

  async function submitNotification(event) {
    event.preventDefault();
    const title = $("notificationTitle").value.trim();
    const message = $("notificationMessage").value.trim();
    const audience = $("notificationAudience").value;
    const userIds = ($("selectedUserIds")?.value || "")
      .split(/[\s,;]+/)
      .map(value => value.trim())
      .filter(Boolean);
    if (!title || !message) {
      setStatus("Enter a notification title and message first.", true);
      return;
    }
    if (audience === "selected" && !userIds.length) {
      setStatus("Enter at least one recipient user ID for a targeted notification.", true);
      return;
    }

    const button = $("notificationForm").querySelector('button[type="submit"]');
    const oldText = button?.textContent || "Send Notification";
    if (button) { button.disabled = true; button.textContent = "Sending..."; }
    try {
      setStatus("Sending in-app notifications to the selected audience...");
      const data = await request(CONTENT_URL, {
        action: "admin-notification-broadcast",
        adminSessionToken: sessionData().token,
        title,
        message,
        type: $("notificationType").value,
        audience,
        userIds
      });
      const count = Number(data.campaign?.recipients_count || 0);
      setStatus(`Notification saved and delivered to ${count} in-app inbox(es).`);
      $("notificationForm").reset();
      toggleSelectedRecipients();
      await loadHistory();
      await loadZakiTechNotifications();
    } catch (error) {
      console.error("Notification broadcast failed:", error);
      setStatus(error.message || "Unable to send the notification.", true);
    } finally {
      if (button) { button.disabled = false; button.textContent = oldText; }
    }
  }

  function renderHistory() {
    const list = $("historyList");
    if (!list) return;
    const filter = $("historyFilter")?.value || "all";
    const query = ($("searchInput")?.value || "").trim().toLowerCase();
    const filtered = campaigns.filter(item =>
      (filter === "all" || item.type === filter) &&
      (!query || [item.title, item.message, item.type, item.audience].some(value => String(value || "").toLowerCase().includes(query)))
    );
    if (!filtered.length) {
      list.innerHTML = '<div class="empty-card"><span>◎</span><h3>No broadcasts found</h3><p>Sent administrator notifications will appear here.</p></div>';
      return;
    }
    list.innerHTML = filtered.map(item => `
      <article class="history-item">
        <div>
          <span class="notification-type">${escapeHtml(item.type || "general")}</span>
          <strong>${escapeHtml(item.title || "Notification")}</strong>
          <p>${escapeHtml(item.message || "")}</p>
          <small>${escapeHtml(item.audience || "all")} · ${escapeHtml(String(item.recipients_count ?? 0))} recipients · ${escapeHtml(formatDate(item.created_at))}</small>
        </div>
      </article>
    `).join("");
  }

  async function loadHistory() {
    const data = await request(CONTENT_URL, {
      action: "admin-notifications-list",
      adminSessionToken: sessionData().token
    });
    campaigns = Array.isArray(data.campaigns) ? data.campaigns : [];
    const metrics = data.metrics || {};
    $("totalNotifications").textContent = String(metrics.total ?? 0);
    $("deliveredNotifications").textContent = String(metrics.delivered ?? 0);
    $("unreadNotifications").textContent = String(metrics.unread ?? 0);
    $("broadcastCount").textContent = String(metrics.broadcasts ?? campaigns.length);
    renderHistory();
  }

  async function loadZakiTechNotifications() {
    const status = $("zakitechNotificationsStatus");
    const list = $("zakitechNotificationsList");
    if (status) status.textContent = "Loading published notifications from ZakiTech…";
    if (list) list.replaceChildren();
    try {
      const response = await fetch("https://mmozesoarwkimhyloivu.supabase.co/functions/v1/zakitech-zakichat-bridge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list-published-notifications", adminSessionToken: sessionData().token })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.success !== true) throw new Error(result.error || "Could not load ZakiTech notifications.");
      const items = Array.isArray(result.notifications) ? result.notifications : [];
      if (!items.length) {
        const empty = document.createElement("div");
        empty.className = "empty-card";
        empty.textContent = "No published ZakiTech notifications are available yet.";
        list.append(empty);
      } else {
        items.forEach(item => {
          const card = document.createElement("article");
          card.className = "history-item";
          const content = document.createElement("div");
          const kicker = document.createElement("span");
          kicker.className = "notification-type";
          kicker.textContent = (item.product?.name || "ZakiTech") + " · " + (item.notification_type || "general");
          const title = document.createElement("strong");
          title.textContent = item.title || "Notification";
          const message = document.createElement("p");
          message.textContent = item.body || "";
          const meta = document.createElement("small");
          meta.textContent = (item.audience || "product_users").replaceAll("_", " ") + " · Published " + (item.published_at ? new Date(item.published_at).toLocaleString() : "date unavailable");
          const use = document.createElement("button");
          use.type = "button";
          use.className = "small-btn";
          use.textContent = "Load into composer";
          use.addEventListener("click", () => {
            $("notificationTitle").value = item.title || "";
            $("notificationMessage").value = item.body || "";
            const type = ["general", "update", "maintenance", "security", "announcement"].includes(item.notification_type) ? item.notification_type : "general";
            $("notificationType").value = type;
            $("notificationAudience").value = "all";
            toggleSelectedRecipients();
            setStatus("ZakiTech notification loaded. Review the content and choose the intended audience, then press Send Notification.");
            $("notificationForm").scrollIntoView({ behavior: "smooth", block: "start" });
          });
          content.append(kicker, title, message, meta, use);
          card.append(content);
          list.append(card);
        });
      }
      if (status) status.textContent = items.length + " published ZakiTech notification(s) loaded. Select one to review it in the composer.";
    } catch (error) {
      if (status) status.textContent = error.message || "Could not load ZakiTech notifications.";
      if (list) {
        const empty = document.createElement("div");
        empty.className = "empty-card";
        empty.textContent = error.message || "ZakiTech notification feed unavailable.";
        list.append(empty);
      }
    }
  }

  function clearFilters() {
    $("searchInput") && ($("searchInput").value = "");
    $("historyFilter").value = "all";
    renderHistory();
  }

  async function init() {
    hide("deniedState");
    hide("adminContent");
    show("loadingState");
    const valid = await verifyAdminSession();
    hide("loadingState");
    if (!valid) { show("deniedState"); return; }
    show("adminContent");
    toggleSelectedRecipients();
    try {
      await loadHistory();
    } catch (error) {
      console.error("Unable to load notification history:", error);
      setStatus(error.message || "Unable to load notification history.", true);
      $("historyList").innerHTML = '<div class="empty-card"><span>!</span><h3>Notification backend unavailable</h3><p>Refresh after the connection is restored.</p></div>';
    }
  }

  $("signOutBtn")?.addEventListener("click", secureSignOut);
  $("refreshBtn")?.addEventListener("click", () => loadHistory().catch(error => setStatus(error.message, true)));
  $("refreshZakiTechNotifications")?.addEventListener("click", loadZakiTechNotifications);
  $("previewBtn")?.addEventListener("click", previewNotification);
  $("closePreviewBtn")?.addEventListener("click", closePreview);
  $("notificationForm")?.addEventListener("submit", submitNotification);
  $("notificationAudience")?.addEventListener("change", toggleSelectedRecipients);
  $("clearFiltersBtn")?.addEventListener("click", clearFilters);
  $("historyFilter")?.addEventListener("change", renderHistory);
  $("searchInput")?.addEventListener("input", renderHistory);
  $("previewModal")?.addEventListener("click", event => {
    if (event.target === $("previewModal")) closePreview();
  });
  document.addEventListener("DOMContentLoaded", init);
})();
