(() => {
  "use strict";

  const FUNCTION_URL =
    "https://xdpevlurgtvgduwzyoue.supabase.co/functions/v1/two-step";

  const SESSION_KEY = "zakichat-admin-session";
  const ROLE_KEY = "zakichat-admin-role";
  const EXPIRY_KEY = "zakichat-admin-expiry";

  const $ = id => document.getElementById(id);

  function show(id) {
    $(id)?.classList.remove("hidden");
  }

  function hide(id) {
    $(id)?.classList.add("hidden");
  }

  function sessionData() {
    return {
      token: localStorage.getItem(SESSION_KEY),
      role: localStorage.getItem(ROLE_KEY),
      expiry: localStorage.getItem(EXPIRY_KEY) || ""
    };
  }

  async function verifyAdminSession() {
    const s = sessionData();

    const expiryMs = Date.parse(s.expiry) || Number(s.expiry);

    if (!s.token || s.role !== "admin" || !expiryMs || Date.now() >= expiryMs) {
      return false;
    }

    try {
      const response = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": window.ZakiChatConfig?.supabaseKey || "",
          "Authorization": `Bearer ${s.token}`
        },
        body: JSON.stringify({
          action: "admin-session-verify",
          adminSessionToken: s.token
        })
      });

      if (!response.ok) return false;

      const data = await response.json().catch(() => ({}));
      return data.valid === true || data.success === true || data.active === true;
    } catch {
      return false;
    }
  }

  async function secureSignOut() {
    const token = localStorage.getItem(SESSION_KEY);

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
      console.warn("Remote admin sign-out failed:", error);
    } finally {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(ROLE_KEY);
      localStorage.removeItem(EXPIRY_KEY);
      window.location.href = "admin.html";
    }
  }

  function previewNotification() {
    const title = $("notificationTitle").value.trim() || "Notification Preview";
    const message =
      $("notificationMessage").value.trim() ||
      "Your notification message will appear here.";
    const type =
      $("notificationType").selectedOptions[0]?.text || "General";
    const audience =
      $("notificationAudience").selectedOptions[0]?.text || "All Users";

    $("previewTitle").textContent = title;
    $("previewMessage").textContent = message;
    $("previewType").textContent = type;
    $("previewAudience").textContent = `Audience: ${audience}`;

    show("previewModal");
  }

  function closePreview() {
    hide("previewModal");
  }

  function submitNotification(event) {
    event.preventDefault();

    const title = $("notificationTitle").value.trim();
    const message = $("notificationMessage").value.trim();

    if (!title || !message) {
      $("formStatus").textContent =
        "Enter a notification title and message first.";
      return;
    }

    $("formStatus").textContent =
      "Notification sending will be enabled when the protected admin notification endpoint is connected.";
  }

  function clearFilters() {
    $("searchInput").value = "";
    $("historyFilter").value = "all";
  }

  function refreshPage() {
    window.location.reload();
  }

  async function init() {
    hide("deniedState");
    hide("adminContent");
    show("loadingState");

    const valid = await verifyAdminSession();

    hide("loadingState");

    if (!valid) {
      show("deniedState");
      return;
    }

    show("adminContent");
  }

  $("signOutBtn")?.addEventListener("click", secureSignOut);
  $("refreshBtn")?.addEventListener("click", refreshPage);
  $("previewBtn")?.addEventListener("click", previewNotification);
  $("closePreviewBtn")?.addEventListener("click", closePreview);
  $("previewModal")?.addEventListener("click", event => {
    if (event.target === $("previewModal")) closePreview();
  });
  $("notificationForm")?.addEventListener("submit", submitNotification);
  $("clearFiltersBtn")?.addEventListener("click", clearFilters);

  init();
})();
