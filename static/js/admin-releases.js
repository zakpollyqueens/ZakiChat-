(() => {
  "use strict";

  const TWO_STEP_URL = "https://xdpevlurgtvgduwzyoue.supabase.co/functions/v1/two-step";
  const RELEASE_URL = "https://xdpevlurgtvgduwzyoue.supabase.co/functions/v1/release-management";
  const BUCKET = "app-releases";
  const SESSION_KEY = "zakichat-admin-session";
  const ROLE_KEY = "zakichat-admin-role";
  const EXPIRY_KEY = "zakichat-admin-expiry";
  const $ = id => document.getElementById(id);
  let editingRelease = null;
  let allReleases = [];
  let storageClient = null;

  function show(id) { $(id)?.classList.remove("hidden"); }
  function hide(id) { $(id)?.classList.add("hidden"); }

  function getSession() {
    return {
      token: localStorage.getItem(SESSION_KEY),
      role: localStorage.getItem(ROLE_KEY),
      expiry: localStorage.getItem(EXPIRY_KEY) || ""
    };
  }

  function expiryTime(value) {
    return Date.parse(value) || Number(value) || 0;
  }

  function config() {
    const cfg = window.ZakiChatConfig;
    if (!cfg?.supabaseUrl || !cfg?.supabaseKey) {
      throw new Error("ZakiChat Supabase configuration is unavailable.");
    }
    return cfg;
  }

  async function request(url, body) {
    const cfg = config();
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
    if (!response.ok || data.success === false) {
      throw new Error(data.error || `Request failed (${response.status}).`);
    }
    return data;
  }

  async function verifyAdminSession() {
    const session = getSession();
    if (!session.token || session.role !== "admin" ||
        !expiryTime(session.expiry) || Date.now() >= expiryTime(session.expiry)) {
      return false;
    }
    try {
      const data = await request(TWO_STEP_URL, {
        action: "admin-session-verify",
        adminSessionToken: session.token
      });
      return data.success === true || data.valid === true || data.active === true;
    } catch (error) {
      console.error("Release page admin verification failed:", error);
      return false;
    }
  }

  async function signOut() {
    const session = getSession();
    try {
      if (session.token) {
        await request(TWO_STEP_URL, {
          action: "admin-session-revoke",
          adminSessionToken: session.token
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

  function setStatus(message, error = false) {
    const status = $("formStatus");
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("error", error);
    status.setAttribute("role", "status");
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
  }

  function previewRelease() {
    const version = $("versionInput")?.value.trim() || "Release version";
    const title = $("titleInput")?.value.trim() || "Release Preview";
    const description = $("descriptionInput")?.value.trim() || "Release description will appear here.";
    const notes = $("notesInput")?.value.trim() || "No release notes entered.";
    $("previewVersion").textContent = version;
    $("previewTitle").textContent = title;
    $("previewDescription").textContent = description;
    $("previewNotes").textContent = notes;
    show("previewModal");
  }

  function closePreview() { hide("previewModal"); }

  function storage() {
    if (storageClient) return storageClient;
    const cfg = config();
    if (!window.supabase?.createClient) {
      throw new Error("Supabase Storage client library did not load.");
    }
    storageClient = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    return storageClient;
  }

  async function uploadReleaseFile(file) {
    const session = getSession();
    const upload = await request(RELEASE_URL, {
      action: "admin-upload-url",
      adminSessionToken: session.token,
      fileName: file.name,
      fileSize: file.size,
      contentType: file.type || "application/octet-stream"
    });
    const { error } = await storage().storage.from(BUCKET).uploadToSignedUrl(
      upload.path,
      upload.token,
      file,
      { contentType: file.type || "application/octet-stream", upsert: false }
    );
    if (error) throw error;
    return {
      downloadPath: upload.path,
      fileName: upload.fileName || file.name,
      fileSize: file.size,
      contentType: file.type || "application/octet-stream"
    };
  }

  async function saveRelease(event) {
    event.preventDefault();
    const form = $("releaseForm");
    const submit = form?.querySelector('button[type="submit"]');
    const file = $("downloadFile")?.files?.[0] || null;
    const version = $("versionInput")?.value.trim() || "";
    const title = $("titleInput")?.value.trim() || "";
    const description = $("descriptionInput")?.value.trim() || "";
    const channel = $("channelInput")?.value || "stable";
    const releaseNotes = $("notesInput")?.value.trim() || "";
    const status = $("statusInput")?.value || "draft";

    if (!version || !title || !description) {
      setStatus("Enter the version, title and description first.", true);
      return;
    }
    if (!editingRelease && !file) {
      setStatus("Choose an .apk, .aab or .zip package to upload.", true);
      return;
    }
    if (file && file.size > 100 * 1024 * 1024) {
      setStatus("The release package must be 100 MB or smaller.", true);
      return;
    }
    if (file && !/\.(apk|aab|zip)$/i.test(file.name)) {
      setStatus("Only .apk, .aab and .zip release packages are supported.", true);
      return;
    }

    const oldText = submit?.textContent || "Save Release";
    if (submit) { submit.disabled = true; submit.textContent = "Saving Release..."; }
    try {
      setStatus(file ? "Preparing secure upload..." : "Saving release details...");
      const uploaded = file ? await uploadReleaseFile(file) : {
        downloadPath: editingRelease.download_path,
        fileName: editingRelease.download_file_name,
        fileSize: Number(editingRelease.download_size_bytes),
        contentType: editingRelease.download_content_type || "application/octet-stream"
      };
      setStatus("Saving release metadata...");
      const session = getSession();
      const result = await request(RELEASE_URL, {
        action: "admin-save",
        adminSessionToken: session.token,
        id: editingRelease?.id || "",
        version,
        title,
        description,
        channel,
        releaseNotes,
        status,
        downloadPath: uploaded.downloadPath,
        fileName: uploaded.fileName,
        fileSize: uploaded.fileSize,
        contentType: uploaded.contentType
      });
      setStatus(`Release ${result.release.version} saved as ${result.release.status}.`);
      form.reset();
      editingRelease = null;
      $("downloadFile").required = true;
      if (submit) submit.textContent = "Save Release";
      await loadReleases();
    } catch (error) {
      console.error("Release save failed:", error);
      setStatus(error.message || "Unable to save the release.", true);
    } finally {
      if (submit) { submit.disabled = false; if (submit.textContent === "Saving Release...") submit.textContent = oldText; }
    }
  }

  function editRelease(id) {
    const release = allReleases.find(item => item.id === id);
    if (!release) return;
    editingRelease = release;
    $("versionInput").value = release.version || "";
    $("channelInput").value = release.channel || "stable";
    $("titleInput").value = release.title || "";
    $("descriptionInput").value = release.description || "";
    $("notesInput").value = release.release_notes || "";
    $("statusInput").value = release.status || "draft";
    $("downloadFile").required = false;
    setStatus("Editing existing release. Choose a new package only if you want to replace the current file.");
    $("releaseForm").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderReleases() {
    const list = $("releaseList");
    if (!list) return;
    const search = ($("searchInput")?.value || "").trim().toLowerCase();
    const channel = $("channelFilter")?.value || "all";
    const status = $("statusFilter")?.value || "all";
    const releases = allReleases.filter(item =>
      (channel === "all" || item.channel === channel) &&
      (status === "all" || item.status === status) &&
      (!search || [item.version, item.title, item.description, item.download_file_name]
        .some(value => String(value || "").toLowerCase().includes(search)))
    );

    if (!releases.length) {
      list.innerHTML = '<p class="empty-state">No releases match these filters.</p>';
    } else {
      list.innerHTML = releases.map(item => `
        <article class="release-history-item">
          <div>
            <span class="history-version">${escapeHtml(item.version)}</span>
            <strong>${escapeHtml(item.title)}</strong>
            <small>${escapeHtml(item.description)}</small>
            <small>${escapeHtml(item.channel)} · ${escapeHtml(item.status)} · ${escapeHtml(item.download_file_name)} · ${escapeHtml(formatDate(item.created_at))}</small>
          </div>
          <button type="button" class="small-btn" data-edit-release="${escapeHtml(item.id)}">Edit</button>
        </article>
      `).join("");
      list.querySelectorAll("[data-edit-release]").forEach(button => {
        button.addEventListener("click", () => editRelease(button.dataset.editRelease));
      });
    }

    const published = allReleases.filter(item => item.status === "published");
    const current = published.find(item => item.channel === "stable") || published[0] || null;
    if (current) {
      document.querySelector(".version-chip")?.replaceChildren(document.createTextNode(current.version));
      $("currentReleaseTitle").textContent = current.title;
      $("currentReleaseDescription").textContent = current.description;
      $("currentChannel").textContent = current.channel;
      $("currentReleaseDate").textContent = formatDate(current.published_at);
      $("currentDownload").href = current.download_url_signed || "#";
      $("currentDownload").setAttribute("aria-disabled", current.download_url_signed ? "false" : "true");
    } else {
      document.querySelector(".version-chip")?.replaceChildren(document.createTextNode("No published release"));
      $("currentReleaseTitle").textContent = "No published release yet";
      $("currentReleaseDescription").textContent = "Upload a package and publish it to make it available from the public About page.";
      $("currentChannel").textContent = "—";
      $("currentReleaseDate").textContent = "—";
      $("currentDownload").href = "#";
      $("currentDownload").setAttribute("aria-disabled", "true");
    }
  }

  async function loadReleases() {
    const session = getSession();
    const data = await request(RELEASE_URL, {
      action: "admin-list",
      adminSessionToken: session.token
    });
    allReleases = Array.isArray(data.releases) ? data.releases : [];
    renderReleases();
  }

  function clearFilters() {
    $("searchInput").value = "";
    $("channelFilter").value = "all";
    $("statusFilter").value = "all";
    renderReleases();
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
    try {
      await loadReleases();
    } catch (error) {
      console.error("Unable to load releases:", error);
      setStatus(error.message || "Unable to load releases from the backend.", true);
      $("releaseList").innerHTML = '<p class="empty-state">Release backend is unavailable. Refresh after the connection is restored.</p>';
    }
  }

  $("signOutBtn")?.addEventListener("click", signOut);
  $("refreshBtn")?.addEventListener("click", () => loadReleases().catch(error => setStatus(error.message, true)));
  $("previewBtn")?.addEventListener("click", previewRelease);
  $("closePreviewBtn")?.addEventListener("click", closePreview);
  $("releaseForm")?.addEventListener("submit", saveRelease);
  $("clearFiltersBtn")?.addEventListener("click", clearFilters);
  $("searchInput")?.addEventListener("input", renderReleases);
  $("channelFilter")?.addEventListener("change", renderReleases);
  $("statusFilter")?.addEventListener("change", renderReleases);
  $("previewModal")?.addEventListener("click", event => {
    if (event.target === $("previewModal")) closePreview();
  });

  document.addEventListener("DOMContentLoaded", init);
})();
