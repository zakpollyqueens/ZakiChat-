(function () {
  "use strict";

  const clearButton = document.getElementById("clearLocalDataButton");
  const storageMessage = document.getElementById("storageMessage");

  const storageSummary = document.getElementById("storageSummary");
  const storageBarFill = document.getElementById("storageBarFill");
  const mediaUsage = document.getElementById("mediaUsage");
  const cacheUsage = document.getElementById("cacheUsage");

  const mediaDetails = document.getElementById("mediaDetails");
  const mediaSize = document.getElementById("mediaSize");

  const appDataDetails = document.getElementById("appDataDetails");
  const appDataSize = document.getElementById("appDataSize");

  const PRESERVED_KEYS = new Set([
    "zakichat_data_storage_settings",
    "zakichat_chat_settings",
    "zakichat_chat_folders"
  ]);

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) {
      return "0 KB";
    }

    const units = ["B", "KB", "MB", "GB"];
    const index = Math.min(
      Math.floor(Math.log(bytes) / Math.log(1024)),
      units.length - 1
    );

    const value = bytes / Math.pow(1024, index);

    return value.toFixed(index === 0 ? 0 : 1) + " " + units[index];
  }

  function calculateLocalStorage() {
    let totalBytes = 0;
    let keyCount = 0;

    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);

      if (!key) {
        continue;
      }

      const value = localStorage.getItem(key) || "";

      totalBytes += (key.length + value.length) * 2;
      keyCount += 1;
    }

    return {
      bytes: totalBytes,
      keys: keyCount
    };
  }

  function calculateSessionStorage() {
    let totalBytes = 0;

    for (let index = 0; index < sessionStorage.length; index += 1) {
      const key = sessionStorage.key(index);

      if (!key) {
        continue;
      }

      const value = sessionStorage.getItem(key) || "";

      totalBytes += (key.length + value.length) * 2;
    }

    return totalBytes;
  }

  function countMediaItems() {
    const mediaKeys = [
      "zakichat_media",
      "zakichat_cached_media",
      "zakichat_media_cache"
    ];

    let count = 0;

    mediaKeys.forEach(function (key) {
      try {
        const value = localStorage.getItem(key);

        if (!value) {
          return;
        }

        const parsed = JSON.parse(value);

        if (Array.isArray(parsed)) {
          count += parsed.length;
        } else if (parsed && typeof parsed === "object") {
          count += Object.keys(parsed).length;
        }
      } catch {
        count += 1;
      }
    });

    return count;
  }

  function showMessage(message) {
    storageMessage.textContent = message;
    storageMessage.hidden = false;
  }

  function refreshUsage() {
    const local = calculateLocalStorage();
    const session = calculateSessionStorage();
    const mediaCount = countMediaItems();

    const totalBytes = local.bytes + session;
    const estimatedMediaBytes = Math.min(
      local.bytes,
      mediaCount * 1024 * 1024
    );

    const applicationBytes = Math.max(
      totalBytes - estimatedMediaBytes,
      0
    );

    storageSummary.textContent =
      formatBytes(totalBytes) + " estimated local application data";

    mediaUsage.textContent =
      "Media: " + mediaCount + " items";

    cacheUsage.textContent =
      "Local keys: " + local.keys;

    mediaDetails.textContent =
      mediaCount + " locally tracked item" +
      (mediaCount === 1 ? "" : "s");

    mediaSize.textContent =
      mediaCount ? "Estimated" : "0 KB";

    appDataDetails.textContent =
      local.keys + " local storage entr" +
      (local.keys === 1 ? "y" : "ies");

    appDataSize.textContent =
      formatBytes(applicationBytes);

    const percentage = totalBytes > 0
      ? Math.min((totalBytes / (50 * 1024 * 1024)) * 100, 100)
      : 0;

    storageBarFill.style.width = percentage + "%";
  }

  function clearLocalData() {
    const confirmed = window.confirm(
      "Clear locally cached ZakiChat data from this browser? Your server-side account and conversations will not be deleted."
    );

    if (!confirmed) {
      return;
    }

    const keysToRemove = [];

    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);

      if (key && !PRESERVED_KEYS.has(key)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(function (key) {
      localStorage.removeItem(key);
    });

    showMessage(
      "Local cache cleared. Your saved Settings preferences were preserved."
    );

    refreshUsage();
  }

  clearButton?.addEventListener("click", clearLocalData);

  refreshUsage();
})();
