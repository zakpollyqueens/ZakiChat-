(function () {
  "use strict";

  const STORAGE_KEY = "zakichat_data_storage_settings";

  const defaults = {
    callDataSaver: false,
    mobileAutoDownload: true,
    wifiAutoDownload: true
  };

  function loadSettings() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : {};

      return {
        ...defaults,
        ...(parsed && typeof parsed === "object" ? parsed : {})
      };
    } catch {
      return { ...defaults };
    }
  }

  function saveSettings(settings) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }

  function bindToggle(id, settings, key) {
    const input = document.getElementById(id);

    if (!input) return;

    input.checked = Boolean(settings[key]);

    input.addEventListener("change", function () {
      settings[key] = input.checked;
      saveSettings(settings);
    });
  }

  function calculateLocalStorageUsage() {
    let total = 0;
    let mediaItems = 0;

    try {
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        const value = localStorage.getItem(key) || "";

        total += key.length + value.length;

        if (
          /media|photo|video|file|attachment/i.test(key)
        ) {
          mediaItems += 1;
        }
      }
    } catch {
      return {
        total,
        mediaItems
      };
    }

    return {
      total,
      mediaItems
    };
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + " B";

    const units = ["KB", "MB", "GB"];
    let value = bytes / 1024;
    let unitIndex = 0;

    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex += 1;
    }

    return value.toFixed(value >= 10 ? 0 : 1) + " " + units[unitIndex];
  }

  function updateStorageSummary() {
    const summary = calculateLocalStorageUsage();

    const storageUsed = document.getElementById("storageUsed");
    const mediaCount = document.getElementById("mediaCount");

    if (storageUsed) {
      storageUsed.textContent = formatBytes(summary.total);
    }

    if (mediaCount) {
      mediaCount.textContent = String(summary.mediaItems);
    }
  }

  function clearCachedData() {
    const confirmed = window.confirm(
      "Clear locally cached ZakiChat data? Your account and cloud conversations will not be deleted."
    );

    if (!confirmed) return;

    const protectedKeys = new Set([
      STORAGE_KEY,
      "zakichat_chat_settings",
      "zakichat_chat_folders"
    ]);

    try {
      const keys = [];

      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);

        if (key && !protectedKeys.has(key)) {
          keys.push(key);
        }
      }

      keys.forEach((key) => localStorage.removeItem(key));
    } catch {
      window.alert("Some cached data could not be cleared.");
      return;
    }

    updateStorageSummary();
    window.alert("Local cached data has been cleared.");
  }

  const settings = loadSettings();

  bindToggle("callDataSaver", settings, "callDataSaver");
  bindToggle("mobileAutoDownload", settings, "mobileAutoDownload");
  bindToggle("wifiAutoDownload", settings, "wifiAutoDownload");

  document
    .getElementById("clearCachedData")
    ?.addEventListener("click", clearCachedData);

  updateStorageSummary();
})();
