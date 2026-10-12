(function () {
  "use strict";

  const STORAGE_KEY = "zakichat_data_storage_settings";
  const NETWORK_KEY = "zakichat_network_usage_estimates_v1";
  const defaults = { callDataSaver: false, mobileAutoDownload: true, wifiAutoDownload: true };
  const $ = id => document.getElementById(id);
  let networkTimer = null;
  let lastResourceKeys = new Set();

  function loadSettings() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return { ...defaults, ...(parsed && typeof parsed === "object" ? parsed : {}) };
    } catch (_) { return { ...defaults }; }
  }
  function saveSettings(settings) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch (_) {}
  }
  function bindToggle(id, settings, key) {
    const input = $(id);
    if (!input) return;
    input.checked = Boolean(settings[key]);
    input.addEventListener("change", function () {
      settings[key] = input.checked;
      saveSettings(settings);
    });
  }
  function calculateLocalStorageUsage() {
    let total = 0, mediaItems = 0;
    try {
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i), value = localStorage.getItem(key) || "";
        total += key.length + value.length;
        if (/media|photo|video|file|attachment/i.test(key)) mediaItems += 1;
      }
    } catch (_) {}
    return { total, mediaItems };
  }
  function formatBytes(bytes) {
    if (!Number.isFinite(Number(bytes)) || Number(bytes) < 0) return "Not available";
    if (bytes < 1024) return Math.round(bytes) + " B";
    const units = ["KB", "MB", "GB", "TB"];
    let value = bytes / 1024, i = 0;
    while (value >= 1024 && i < units.length - 1) { value /= 1024; i += 1; }
    return value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2) + " " + units[i];
  }
  function updateStorageSummary() {
    const summary = calculateLocalStorageUsage();
    if ($("storageUsed")) $("storageUsed").textContent = formatBytes(summary.total);
    if ($("mediaCount")) $("mediaCount").textContent = String(summary.mediaItems);
  }
  function clearCachedData() {
    const confirmed = window.confirm("Clear locally cached ZakiChat data? Your account and cloud conversations will not be deleted.");
    if (!confirmed) return;
    const protectedKeys = new Set([STORAGE_KEY, NETWORK_KEY, "zakichat_chat_settings", "zakichat_chat_folders"]);
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key && !protectedKeys.has(key) && !/supabase|auth|session|account/i.test(key)) keys.push(key);
      }
      keys.forEach(key => localStorage.removeItem(key));
    } catch (_) { window.alert("Some cached data could not be cleared."); return; }
    updateStorageSummary();
    window.alert("Local cached data has been cleared. Sign-in and network usage records were preserved.");
  }
  function currentBrowserConnection() {
    const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!navigator.onLine) return "Offline";
    if (c && c.type === "wifi") return "Wi-Fi";
    if (c && (c.type === "cellular" || c.type === "mobile")) return "Mobile data";
    if (c && c.type === "ethernet") return "Ethernet";
    if (c && c.type === "none") return "Offline";
    return "Connected · type unknown";
  }
  function loadEstimates() {
    try {
      const v = JSON.parse(localStorage.getItem(NETWORK_KEY) || "{}");
      return { mobileBytes: Number(v.mobileBytes) || 0, wifiBytes: Number(v.wifiBytes) || 0, otherBytes: Number(v.otherBytes) || 0, updatedAt: Number(v.updatedAt) || 0 };
    } catch (_) { return { mobileBytes: 0, wifiBytes: 0, otherBytes: 0, updatedAt: 0 }; }
  }
  function saveEstimates(s) {
    try { localStorage.setItem(NETWORK_KEY, JSON.stringify(s)); } catch (_) {}
  }
  function updateNetworkUI(data, nativeMode) {
    const mobile = Math.max(0, Number(data.mobileBytes) || 0);
    const wifi = Math.max(0, Number(data.wifiBytes) || 0);
    const other = Math.max(0, Number(data.otherBytes) || 0);
    const total = mobile + wifi + other;
    if ($("mobileUsage")) $("mobileUsage").textContent = formatBytes(mobile);
    if ($("wifiUsage")) $("wifiUsage").textContent = formatBytes(wifi);
    if ($("networkTotal")) $("networkTotal").textContent = formatBytes(total);
    const type = nativeMode ? data.connectionType : currentBrowserConnection();
    if ($("networkConnection")) $("networkConnection").textContent = ({ mobile: "Mobile data", wifi: "Wi-Fi", other: "Other network", unknown: "Connection type unknown" })[type] || type;
    const dot = document.querySelector(".network-live-dot");
    if (dot) dot.classList.toggle("is-offline", !navigator.onLine || type === "Offline");
    if ($("networkUpdated")) {
      const stamp = Number(data.updatedAt || data.sampledAt) || Date.now();
      $("networkUpdated").textContent = (nativeMode ? "Android app traffic · sampled while app is active" : "Browser estimate · available resource transfers only") + " · Updated " + new Date(stamp).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"});
    }
    if ($("networkUsageNote")) {
      $("networkUsageNote").textContent = nativeMode
        ? "These are app-level Android traffic estimates sampled while ZakiChat is active. Mobile/Wi-Fi totals are assigned to the connection seen at each sample, so a network change between samples can affect the split. Traffic while the app is closed may be missed; Android's total UID counter is not the same as carrier billing."
        : "Browser-only mode cannot read Android's app-wide network counters. These estimates count visible resource transfers when the browser exposes their sizes and can undercount cached or cross-origin requests. Install the Android APK for app-level sampling.";
    }
  }
  function updateBrowserEstimates() {
    const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const kind = c && c.type === "wifi" ? "wifi" : c && (c.type === "cellular" || c.type === "mobile") ? "mobile" : "other";
    let state = loadEstimates(), changed = false;
    try {
      const entries = performance.getEntriesByType("resource");
      entries.forEach(entry => {
        const key = entry.name + "|" + Math.round(entry.startTime) + "|" + entry.initiatorType;
        if (lastResourceKeys.has(key)) return;
        lastResourceKeys.add(key);
        const size = Number(entry.transferSize) || Number(entry.encodedBodySize) || 0;
        if (size > 0) { state[kind + "Bytes"] = (state[kind + "Bytes"] || 0) + size; changed = true; }
      });
      if (lastResourceKeys.size > 2500) lastResourceKeys = new Set(Array.from(lastResourceKeys).slice(-1200));
    } catch (_) {}
    if (changed) { state.updatedAt = Date.now(); saveEstimates(state); }
    updateNetworkUI(state, false);
  }
  function updateNetworkUsage() {
    try {
      if (window.ZakiChatNative && typeof window.ZakiChatNative.getNetworkUsage === "function") {
        const raw = window.ZakiChatNative.getNetworkUsage();
        const data = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (data && data.supported) { updateNetworkUI(data, true); return; }
      }
    } catch (_) {}
    updateBrowserEstimates();
  }

  const settings = loadSettings();
  bindToggle("callDataSaver", settings, "callDataSaver");
  bindToggle("mobileAutoDownload", settings, "mobileAutoDownload");
  bindToggle("wifiAutoDownload", settings, "wifiAutoDownload");
  $("clearCachedData")?.addEventListener("click", clearCachedData);
  updateStorageSummary();
  updateNetworkUsage();
  networkTimer = window.setInterval(updateNetworkUsage, 5000);
  window.addEventListener("online", updateNetworkUsage);
  window.addEventListener("offline", updateNetworkUsage);
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  connection?.addEventListener?.("change", updateNetworkUsage);
  window.addEventListener("pagehide", () => { if (networkTimer) clearInterval(networkTimer); });
})();