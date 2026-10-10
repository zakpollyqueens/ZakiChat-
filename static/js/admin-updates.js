(() => {
  "use strict";

  const TWO_STEP_URL = "https://xdpevlurgtvgduwzyoue.supabase.co/functions/v1/two-step";
  const CONTENT_URL = "https://xdpevlurgtvgduwzyoue.supabase.co/functions/v1/admin-content";
  const SESSION_KEY = "zakichat-admin-session";
  const ROLE_KEY = "zakichat-admin-role";
  const EXPIRY_KEY = "zakichat-admin-expiry";
  const $ = id => document.getElementById(id);
  let notices = [];
  let editingNotice = null;

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
    const session = sessionData();
    if (!session.token || !["admin", "super_admin"].includes(session.role) ||
        !expiryMs(session.expiry) || Date.now() >= expiryMs(session.expiry)) return false;
    try {
      const data = await request(TWO_STEP_URL, {
        action: "admin-session-verify",
        adminSessionToken: session.token
      });
      return data.success === true || data.valid === true || data.active === true;
    } catch (error) {
      console.error("Admin updates session verification failed:", error);
      return false;
    }
  }
  async function signOut() {
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

  function preview() {
    $("previewTitle").textContent = $("noticeTitle").value.trim() || "Update Preview";
    $("previewMessage").textContent = $("noticeMessage").value.trim() || "Your public update will appear here.";
    $("previewType").textContent = $("updateType").selectedOptions[0]?.text || "Public Notice";
    $("previewVisibility").textContent = `Visibility: ${$("visibility").selectedOptions[0]?.text || "Public"}`;
    $("previewPriority").textContent = `Priority: ${$("priority").selectedOptions[0]?.text || "Normal"}`;
    show("previewModal");
  }
  function closePreview() { hide("previewModal"); }

  async function publish(event) {
    event.preventDefault();
    const title = $("noticeTitle").value.trim();
    const message = $("noticeMessage").value.trim();
    const visibility = $("visibility").value;
    const status = $("noticeStatus").value;
    if (!title || !message) {
      setStatus("Enter an update title and message before saving.", true);
      return;
    }
    if (status === "published" && visibility === "hidden") {
      setStatus("Choose Public or Signed-in Users to publish. Hidden notices must remain drafts.", true);
      return;
    }
    const button = $("noticeForm").querySelector('button[type="submit"]');
    const oldText = button?.textContent || "Publish Update";
    if (button) { button.disabled = true; button.textContent = "Saving..."; }
    try {
      const data = await request(CONTENT_URL, {
        action: "admin-notice-save",
        adminSessionToken: sessionData().token,
        id: editingNotice?.id || "",
        title,
        message,
        type: $("updateType").value,
        visibility,
        priority: $("priority").value,
        status
      });
      setStatus(`Notice saved as ${data.notice.status}.`);
      $("noticeForm").reset();
      $("noticeStatus").value = "draft";
      editingNotice = null;
      await loadNotices();
    } catch (error) {
      console.error("Saving notice failed:", error);
      setStatus(error.message || "Unable to save the notice.", true);
    } finally {
      if (button) { button.disabled = false; button.textContent = oldText; }
    }
  }

  function editNotice(id) {
    const item = notices.find(notice => notice.id === id);
    if (!item) return;
    editingNotice = item;
    $("noticeTitle").value = item.title || "";
    $("noticeMessage").value = item.message || "";
    $("updateType").value = item.notice_type || "notice";
    $("visibility").value = item.visibility || "public";
    $("priority").value = item.priority || "normal";
    $("noticeStatus").value = item.status || "draft";
    const submit = $("noticeForm").querySelector('button[type="submit"]');
    if (submit) submit.textContent = "Save Changes";
    setStatus("Editing an existing notice.");
    $("noticeForm").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderNotices() {
    const list = $("updatesList");
    if (!list) return;
    const query = ($("searchInput")?.value || "").trim().toLowerCase();
    const type = $("typeFilter")?.value || "all";
    const status = $("statusFilter")?.value || "all";
    const filtered = notices.filter(item =>
      (type === "all" || item.notice_type === type) &&
      (status === "all" || item.status === status) &&
      (!query || [item.title, item.message, item.notice_type].some(value => String(value || "").toLowerCase().includes(query)))
    );
    if (!filtered.length) {
      list.innerHTML = '<p class="empty-state">No notices match these filters.</p>';
    } else {
      list.innerHTML = filtered.map(item => `
        <article class="update-history-item">
          <div>
            <span class="update-type">${escapeHtml(item.notice_type)}</span>
            <strong>${escapeHtml(item.title)}</strong>
            <p>${escapeHtml(item.message)}</p>
            <small>${escapeHtml(item.visibility)} · ${escapeHtml(item.priority)} · ${escapeHtml(item.status)} · ${escapeHtml(formatDate(item.created_at))}</small>
          </div>
          <button type="button" class="small-btn" data-edit-notice="${escapeHtml(item.id)}">Edit</button>
        </article>
      `).join("");
      list.querySelectorAll("[data-edit-notice]").forEach(button =>
        button.addEventListener("click", () => editNotice(button.dataset.editNotice))
      );
    }
    const published = notices.filter(item => item.status === "published" && item.is_active);
    $("activeNotices").textContent = String(published.length);
    $("whatsNewCount").textContent = String(published.filter(item => item.notice_type === "whats-new").length);
    $("statusCount").textContent = String(published.filter(item => item.notice_type === "status").length);
    $("lastPublished").textContent = published.length ? formatDate(published[0].created_at) : "—";
    if (published.length) {
      const latest = published[0];
      $("currentTitle").textContent = latest.title || "Published notice";
      $("currentMessage").textContent = latest.message || "";
      $("currentDate").textContent = formatDate(latest.created_at);
      $("currentPriority").textContent = latest.priority || "normal";
    } else {
      $("currentTitle").textContent = "No published notice";
      $("currentMessage").textContent = "Publish a notice to display it here.";
      $("currentDate").textContent = "—";
      $("currentPriority").textContent = "—";
    }
  }

  async function loadNotices() {
    const data = await request(CONTENT_URL, {
      action: "admin-notices-list",
      adminSessionToken: sessionData().token
    });
    notices = Array.isArray(data.notices) ? data.notices : [];
    renderNotices();
  }
  function clearFilters() {
    $("searchInput").value = "";
    $("typeFilter").value = "all";
    $("statusFilter").value = "all";
    renderNotices();
  }

  async function init() {
    hide("deniedState");
    hide("adminContent");
    show("loadingState");
    const valid = await verifyAdminSession();
    hide("loadingState");
    if (!valid) { show("deniedState"); return; }
    show("adminContent");
    try {
      await loadNotices();
    } catch (error) {
      console.error("Unable to load admin notices:", error);
      setStatus(error.message || "Unable to load notices from the backend.", true);
      $("updatesList").innerHTML = '<p class="empty-state">Notice backend is unavailable.</p>';
    }
  }

  $("signOutBtn")?.addEventListener("click", signOut);
  $("refreshBtn")?.addEventListener("click", () => loadNotices().catch(error => setStatus(error.message, true)));
  $("previewBtn")?.addEventListener("click", preview);
  $("closePreviewBtn")?.addEventListener("click", closePreview);
  $("noticeForm")?.addEventListener("submit", publish);
  $("clearFiltersBtn")?.addEventListener("click", clearFilters);
  $("searchInput")?.addEventListener("input", renderNotices);
  $("typeFilter")?.addEventListener("change", renderNotices);
  $("statusFilter")?.addEventListener("change", renderNotices);
  $("previewModal")?.addEventListener("click", event => {
    if (event.target === $("previewModal")) closePreview();
  });
  document.addEventListener("DOMContentLoaded", init);
})();
