(() => {
  "use strict";

  const FUNCTION_URL =
    "https://xdpevlurgtvgduwzyoue.supabase.co/functions/v1/two-step";

  const SESSION_KEY = "zakichat-admin-session";
  const ROLE_KEY = "zakichat-admin-role";
  const EXPIRY_KEY = "zakichat-admin-expiry";

  const $ = id => document.getElementById(id);

  const show = id => $(id)?.classList.remove("hidden");
  const hide = id => $(id)?.classList.add("hidden");

  function getSession() {
    return {
      token: localStorage.getItem(SESSION_KEY),
      role: localStorage.getItem(ROLE_KEY),
      expiry: localStorage.getItem(EXPIRY_KEY) || ""
    };
  }

  async function verifyAdminSession() {
    const session = getSession();

    const expiryMs = Date.parse(session.expiry) || Number(session.expiry);

    if (
      !session.token ||
      !["admin", "super_admin"].includes(session.role) ||
      !expiryMs ||
      Date.now() >= expiryMs
    ) {
      return false;
    }

    try {
      const response = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": window.ZakiChatConfig?.supabaseKey || "",
          "Authorization": `Bearer ${session.token}`
        },
        body: JSON.stringify({
          action: "admin-session-verify",
          adminSessionToken: session.token
        })
      });

      if (!response.ok) return false;

      const data = await response.json().catch(() => ({}));
      return data.valid === true ||
             data.success === true ||
             data.active === true;
    } catch {
      return false;
    }
  }

  async function signOut() {
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

  function preview() {
    const title =
      $("noticeTitle").value.trim() || "Update Preview";

    const message =
      $("noticeMessage").value.trim() ||
      "Your public update will appear here.";

    const type =
      $("updateType").selectedOptions[0]?.text || "Public Notice";

    const visibility =
      $("visibility").selectedOptions[0]?.text || "Public";

    const priority =
      $("priority").selectedOptions[0]?.text || "Normal";

    $("previewTitle").textContent = title;
    $("previewMessage").textContent = message;
    $("previewType").textContent = type;
    $("previewVisibility").textContent = `Visibility: ${visibility}`;
    $("previewPriority").textContent = `Priority: ${priority}`;

    show("previewModal");
  }

  function closePreview() {
    hide("previewModal");
  }

  function publish(event) {
    event.preventDefault();

    const title = $("noticeTitle").value.trim();
    const message = $("noticeMessage").value.trim();

    if (!title || !message) {
      $("formStatus").textContent =
        "Enter an update title and message before publishing.";
      return;
    }

    $("formStatus").textContent =
      "Publishing will be enabled when the protected admin updates endpoint is connected.";
  }

  function clearFilters() {
    $("searchInput").value = "";
    $("typeFilter").value = "all";
    $("statusFilter").value = "all";
  }

  $("signOutBtn")?.addEventListener("click", signOut);
  $("refreshBtn")?.addEventListener("click", () => location.reload());
  $("previewBtn")?.addEventListener("click", preview);
  $("closePreviewBtn")?.addEventListener("click", closePreview);
  $("notificationForm")?.addEventListener("submit", publish);
  $("noticeForm")?.addEventListener("submit", publish);
  $("clearFiltersBtn")?.addEventListener("click", clearFilters);

  $("previewModal")?.addEventListener("click", event => {
    if (event.target === $("previewModal")) closePreview();
  });

  async function init() {
    hide("adminContent");
    hide("deniedState");
    show("loadingState");

    const valid = await verifyAdminSession();

    hide("loadingState");

    if (!valid) {
      show("deniedState");
      return;
    }

    show("adminContent");
  }

  init();
})();
