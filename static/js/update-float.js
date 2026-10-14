(function () {
  "use strict";

  const RELEASE_API = "https://api.github.com/repos/zakpollyqueens/ZakiChat-/releases/latest";
  const OTA_URL = "https://github.com/zakpollyqueens/ZakiChat-/releases/latest/download/ota-bundle.zip";
  const ID = "molan-update-float";
  let latest = null;
  let busy = false;

  function nativeReady() {
    return !!(window.ZakiChatNative &&
      typeof window.ZakiChatNative.getInstalledOtaVersion === "function" &&
      typeof window.ZakiChatNative.downloadAndApplyOta === "function");
  }

  function ensureUI() {
    if (document.getElementById(ID)) return document.getElementById(ID);
    const style = document.createElement("style");
    style.textContent = `
      #${ID}{position:fixed;z-index:9998;left:12px;right:12px;bottom:calc(76px + env(safe-area-inset-bottom,0px));display:none;align-items:center;gap:10px;padding:10px 12px;border:1px solid rgba(122,231,255,.38);border-radius:18px;background:linear-gradient(115deg,rgba(7,25,46,.97),rgba(13,63,86,.97));color:#fff;box-shadow:0 12px 34px rgba(0,0,0,.34),inset 0 1px rgba(255,255,255,.12);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);font:inherit}
      #${ID}.is-visible{display:flex;animation:molanUpdateIn .24s ease-out}
      #${ID} .muf-icon{display:grid;place-items:center;flex:none;width:38px;height:38px;border-radius:13px;background:rgba(91,218,255,.16);border:1px solid rgba(133,231,255,.25);font-size:19px}
      #${ID} .muf-copy{flex:1;min-width:0}
      #${ID} .muf-title{display:block;font-size:13px;font-weight:850;line-height:1.25}
      #${ID} .muf-detail{display:block;margin-top:3px;color:#c8e9f6;font-size:11px;line-height:1.3;overflow-wrap:anywhere}
      #${ID} .muf-action{flex:none;border:0;border-radius:12px;padding:10px 12px;background:linear-gradient(135deg,#7cecff,#46c8ff);color:#052035;font-size:12px;font-weight:900;cursor:pointer}
      #${ID} .muf-action:disabled{opacity:.68;cursor:wait}
      #${ID} .muf-progress{height:3px;margin-top:6px;overflow:hidden;border-radius:4px;background:#ffffff22}
      #${ID} .muf-progress>i{display:block;width:35%;height:100%;border-radius:4px;background:#78e7ff;animation:molanUpdateProgress 1.25s ease-in-out infinite}
      @keyframes molanUpdateIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
      @keyframes molanUpdateProgress{0%{transform:translateX(-110%)}100%{transform:translateX(310%)}}
      @media(prefers-reduced-motion:reduce){#${ID}.is-visible{animation:none}#${ID} .muf-progress>i{animation:none;width:100%}}
    `;
    document.head.appendChild(style);
    const bar = document.createElement("section");
    bar.id = ID;
    bar.setAttribute("role", "status");
    bar.setAttribute("aria-live", "polite");
    bar.innerHTML = '<span class="muf-icon" aria-hidden="true">⇧</span><span class="muf-copy"><strong class="muf-title">Molan Chat update available</strong><span class="muf-detail">A newer version is ready.</span><span class="muf-progress" hidden><i></i></span></span><button class="muf-action" type="button">Update Now</button>';
    document.body.appendChild(bar);
    bar.querySelector("button").addEventListener("click", installUpdate);
    return bar;
  }

  function show(title, detail, action, disabled, progress) {
    const bar = ensureUI();
    bar.classList.add("is-visible");
    bar.querySelector(".muf-title").textContent = title;
    bar.querySelector(".muf-detail").textContent = detail || "";
    bar.querySelector(".muf-action").textContent = action || "Update Now";
    bar.querySelector(".muf-action").disabled = !!disabled;
    bar.querySelector(".muf-progress").hidden = !progress;
  }

  function hide() {
    const bar = document.getElementById(ID);
    if (bar) bar.classList.remove("is-visible");
  }

  async function checkForUpdate() {
    if (!nativeReady() || !navigator.onLine) return;
    try {
      const response = await fetch(RELEASE_API, {
        headers: { Accept: "application/vnd.github+json" },
        cache: "no-store"
      });
      if (!response.ok) throw new Error("Release check returned " + response.status);
      const release = await response.json();
      const body = String(release.body || "");
      const versionMatch = body.match(/^OTA_VERSION=([A-Za-z0-9._-]{1,100})$/m);
      const hashMatch = body.match(/^OTA_SHA256=([a-fA-F0-9]{64})$/m);
      if (!versionMatch || !hashMatch) return;
      latest = {
        version: versionMatch[1],
        sha256: hashMatch[1].toLowerCase(),
        name: release.name || "Molan Chat update"
      };
      const installed = String(window.ZakiChatNative.getInstalledOtaVersion() || "");
      if (installed === latest.version) {
        hide();
        return;
      }
      show("Molan Chat update available", latest.name + " is ready to install.", "Update Now", false, false);
    } catch (error) {
      // A failed check is not an update; keep the interface unobtrusive.
      console.warn("Molan Chat update check failed:", error);
    }
  }

  function installUpdate() {
    if (!latest || busy || !nativeReady()) return;
    busy = true;
    show("Preparing your update…", "Keep Molan Chat open while the update is downloaded and verified.", "Updating…", true, true);
    try {
      window.ZakiChatNative.downloadAndApplyOta(latest.version, OTA_URL, latest.sha256);
    } catch (error) {
      busy = false;
      show("Update could not start", error.message || "Please try again when connected.", "Retry update", false, false);
    }
  }

  window.addEventListener("zaki-ota-event", event => {
    const detail = event.detail || {};
    if (detail.type === "progress") {
      busy = true;
      show("Updating Molan Chat…", detail.message || "Downloading and verifying files.", "Updating…", true, true);
    } else if (detail.type === "applied") {
      busy = false;
      show("Update complete ✓", detail.message || "Molan Chat is up to date.", "Done", true, false);
      window.setTimeout(hide, 1800);
    } else if (detail.type === "error") {
      busy = false;
      show("Update failed", detail.message || "Your current app was not changed. Try again.", "Retry update", false, false);
    }
  });

  window.addEventListener("online", checkForUpdate);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => { ensureUI(); checkForUpdate(); });
  } else {
    ensureUI();
    checkForUpdate();
  }
})();
