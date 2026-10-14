(function () {
  "use strict";

  const RELEASE_API = "https://api.github.com/repos/zakpollyqueens/ZakiChat-/releases/latest";
  const ID = "molan-update-float";
  let latest = null;
  let busy = false;

  function nativeReady() {
    return !!(window.ZakiChatNative &&
      typeof window.ZakiChatNative.getInstalledOtaVersion === "function" &&
      typeof window.ZakiChatNative.downloadAndApplyOta === "function");
  }

  function showUpdateCelebration() {
    const params = new URLSearchParams(location.search);
    if (params.get("molanUpdateComplete") !== "1") return;
    const version = params.get("version") || "the latest version";
    const overlay = document.createElement("div");
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-live", "polite");
    overlay.setAttribute("aria-label", "Update complete");
    overlay.style.cssText = "position:fixed;inset:0;z-index:100000;display:grid;place-items:center;padding:24px;background:rgba(3,12,25,.72);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)";
    overlay.innerHTML = '<section style="max-width:360px;width:100%;text-align:center;padding:28px 22px;border:1px solid #7cecff66;border-radius:26px;background:linear-gradient(145deg,#0b233b,#10445a);color:#f2fbff;box-shadow:0 22px 80px #0008"><div style="font-size:48px;line-height:1.2">🎉</div><h2 style="margin:12px 0 8px">Thank you for updating!</h2><p style="margin:0;color:#c8e9f6">Molan Chat is ready on '+version.replace(/[&<>"]/g, "")+'. Your chats and saved sign-in stay with you.</p><div style="height:4px;margin-top:20px;border-radius:5px;background:linear-gradient(90deg,#70e9ff,#b4fff0)"></div></section>';
    document.body.append(overlay);
    history.replaceState({}, "", location.pathname + location.hash);
    setTimeout(() => { overlay.style.transition = "opacity .35s"; overlay.style.opacity = "0"; setTimeout(() => overlay.remove(), 380); }, 2600);
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
      #${ID} .muf-progress>i{display:block;width:35%;height:100%;border-radius:4px;background:#78e7ff;animation:molanUpdateProgress 1.25s ease-in-out infinite}#${ID} .muf-progress>i.is-determinate{animation:none;transform:none;transition:width .18s ease;width:0%}
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
    bar.querySelector("button").addEventListener("click", () => { if (latest && !busy) installUpdate(); else if (!busy) void checkForUpdate(true); });
    return bar;
  }

  function show(title, detail, action, disabled, progress) {
    const bar = ensureUI();
    bar.classList.add("is-visible");
    bar.querySelector(".muf-title").textContent = title;
    bar.querySelector(".muf-detail").textContent = detail || "";
    bar.querySelector(".muf-action").textContent = action || "Update Now";
    bar.querySelector(".muf-action").disabled = !!disabled;
    bar.querySelector(".muf-progress").hidden = !progress; if(!progress){const fill=bar.querySelector(".muf-progress>i");fill.classList.remove("is-determinate");fill.style.width="35%";}
  }

  function hide() {
    const bar = document.getElementById(ID);
    if (bar) bar.classList.remove("is-visible");
  }

  async function checkForUpdate(userRequested = false) {
    if (!nativeReady()) return;
    if (!navigator.onLine) { if (userRequested) show("You’re offline", "Connect to the internet to check for the latest Molan Chat update.", "Check again", false, false); else hide(); return; }
    if (userRequested) show("Checking for updates…", "Checking the official Molan Chat release and verifying its package.", "Checking…", true, true);
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
      const bundle = Array.isArray(release.assets) ? release.assets.find(asset =>
        asset && asset.name === "ota-bundle.zip" &&
        typeof asset.browser_download_url === "string" &&
        /^https:\/\/github\.com\/zakpollyqueens\/ZakiChat-\/releases\/download\/[A-Za-z0-9._-]+\/ota-bundle\.zip$/.test(asset.browser_download_url)
      ) : null;
      if (!versionMatch || !hashMatch || !bundle) { latest = null; if (userRequested) show("Update could not be verified", "The latest release does not yet have a complete, verified feature package. Your current app has not been changed.", "Check again", false, false); else hide(); return; }
      const declaredDigest = String(bundle.digest || "").replace(/^sha256:/i, "").toLowerCase();
      const expectedDigest = hashMatch[1].toLowerCase();
      if (declaredDigest && declaredDigest !== expectedDigest) {
        console.warn("Molan Chat release metadata has mismatched OTA digests.");
        latest = null;
        if (userRequested) show("Update could not be verified", "The release checksum does not match its package. Nothing was changed.", "Check again", false, false); else hide();
        return;
      }
      latest = {
        version: versionMatch[1],
        sha256: expectedDigest,
        url: bundle.browser_download_url,
        name: release.name || "Molan Chat update"
      };
      const installed = String(window.ZakiChatNative.getInstalledOtaVersion() || "");
      if (installed === latest.version) {
        latest = null;
        if (userRequested) show("Molan Chat is up to date ✓", "You have the latest verified feature version (" + installed.slice(0, 12) + ").", "Check again", false, false); else hide();
        return;
      }
      show("Molan Chat update available", latest.name + " is ready. Tap Update Now to download, verify and apply it.", "Update Now", false, false);
    } catch (error) {
      // A failed background check is not an update and must not create a banner.
      console.warn("Molan Chat update check failed:", error);
      latest = null;
      if (userRequested) show("Could not check for updates", "Your app is unchanged. Check your connection and try again.", "Retry check", false, false); else hide();
    }
  }

  function installUpdate() {
    if (!latest || busy || !nativeReady()) return;
    busy = true;
    show("Preparing feature update…", "Your chat will reopen after the feature files are verified.", "Updating…", true, true);
    try {
      window.ZakiChatNative.downloadAndApplyOta(latest.version, latest.url, latest.sha256);
    } catch (error) {
      busy = false;
      show("Update could not start", error.message || "Please try again when connected.", "Retry update", false, false);
    }
  }

  window.addEventListener("zaki-ota-event", event => {
    const detail = event.detail || {};
    if (detail.type === "progress") {
      busy = true;
      show("Updating Molan Chat features…", detail.message || "Downloading and verifying files.", "Updating…", true, true); if(Number.isFinite(Number(detail.percent))){const fill=ensureUI().querySelector(".muf-progress>i");fill.classList.add("is-determinate");fill.style.width=Math.max(0,Math.min(100,Number(detail.percent)))+"%";}
    } else if (detail.type === "applied") {
      busy = false;
      show("Feature update complete ✓", detail.message || "Molan Chat features are up to date.", "Done", true, false);
      window.setTimeout(hide, 2500);
    } else if (detail.type === "error") {
      busy = false;
      show("Update failed", detail.message || "Your current app was not changed. Try again.", "Retry update", false, false);
    }
  });

  window.addEventListener("online", checkForUpdate);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => { ensureUI(); showUpdateCelebration(); checkForUpdate(); });
  } else {
    ensureUI();
    showUpdateCelebration();
    checkForUpdate();
  }
})();
