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
      expiry: Number(localStorage.getItem(EXPIRY_KEY) || 0)
    };
  }

  async function verifyAdminSession() {
    const session = getSession();

    if (
      !session.token ||
      session.role !== "admin" ||
      !session.expiry ||
      Date.now() >= session.expiry
    ) {
      return false;
    }

    try {
      const response = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.token}`
        },
        body: JSON.stringify({ action: "admin-session-verify" })
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

  function signOut() {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(ROLE_KEY);
    localStorage.removeItem(EXPIRY_KEY);
    window.location.href = "admin-control.html";
  }

  function previewRelease() {
    const version =
      $("versionInput").value.trim() || "zc-vr16";

    const title =
      $("titleInput").value.trim() || "Release Preview";

    const description =
      $("descriptionInput").value.trim() ||
      "Release description will appear here.";

    const notes =
      $("notesInput").value.trim() ||
      "No release notes entered.";

    $("previewVersion").textContent = version;
    $("previewTitle").textContent = title;
    $("previewDescription").textContent = description;
    $("previewNotes").textContent = notes;

    show("previewModal");
  }

  function closePreview() {
    hide("previewModal");
  }

  function saveRelease(event) {
    event.preventDefault();

    const version = $("versionInput").value.trim();
    const title = $("titleInput").value.trim();
    const description = $("descriptionInput").value.trim();

    if (!version || !title || !description) {
      $("formStatus").textContent =
        "Enter the version, release title and description first.";
      return;
    }

    $("formStatus").textContent =
      "Saving releases will be enabled when the protected admin release endpoint is connected.";
  }

  function clearFilters() {
    $("searchInput").value = "";
    $("channelFilter").value = "all";
    $("statusFilter").value = "all";
  }

  $("signOutBtn")?.addEventListener("click", signOut);
  $("refreshBtn")?.addEventListener("click", () => location.reload());
  $("previewBtn")?.addEventListener("click", previewRelease);
  $("closePreviewBtn")?.addEventListener("click", closePreview);
  $("releaseForm")?.addEventListener("submit", saveRelease);
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
