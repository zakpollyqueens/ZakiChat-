(function () {
  "use strict";

  const STORAGE_KEY = "zakichat-appearance";
  const DB_NAME = "ZakiChatAppearance";
  const DB_VERSION = 1;
  const STORE_NAME = "settings";

  let wallpaperUrl = null;

  const defaults = {
    theme: "dark",
    fontFamily:
      'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontSize: 16
  };

  function getSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return { ...defaults, ...saved };
    } catch {
      return { ...defaults };
    }
  }

  function saveSettings(settings) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }

  function applyTheme(theme) {
    const root = document.documentElement;

    if (theme === "system") {
      root.removeAttribute("data-theme");
      root.setAttribute("data-theme-mode", "system");
    } else {
      root.setAttribute("data-theme", theme);
      root.setAttribute("data-theme-mode", theme);
    }

    document.body.dataset.theme = theme;
  }

  function applyFont(fontFamily, fontSize) {
    document.documentElement.style.setProperty(
      "--zakichat-font-family",
      fontFamily
    );

    document.documentElement.style.setProperty(
      "--zakichat-font-size",
      `${fontSize}px`
    );

    document.body.style.fontFamily = fontFamily;
    document.body.style.fontSize = `${fontSize}px`;
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function saveWallpaper(blob) {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);

      store.put(blob, "wallpaper");

      transaction.oncomplete = () => {
        db.close();
        resolve();
      };

      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    });
  }

  async function getWallpaper() {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get("wallpaper");

      request.onsuccess = () => {
        db.close();
        resolve(request.result || null);
      };

      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  }

  async function removeWallpaper() {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);

      store.delete("wallpaper");

      transaction.oncomplete = () => {
        db.close();
        resolve();
      };

      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    });
  }

  function setWallpaperUrl(url) {
    const preview = document.getElementById("wallpaperPreview");

    if (!preview) return;

    if (wallpaperUrl) {
      URL.revokeObjectURL(wallpaperUrl);
      wallpaperUrl = null;
    }

    if (url) {
      wallpaperUrl = url;
      preview.style.backgroundImage =
        `linear-gradient(rgba(0,0,0,.15), rgba(0,0,0,.15)), url("${url}")`;
    } else {
      preview.style.backgroundImage = "";
    }
  }

  async function loadWallpaper() {
    try {
      const blob = await getWallpaper();

      if (blob) {
        setWallpaperUrl(URL.createObjectURL(blob));
      }
    } catch (error) {
      console.warn("Unable to load ZakiChat wallpaper.", error);
    }
  }

  function updateThemeButtons(theme) {
    document.querySelectorAll("[data-theme-choice]").forEach(button => {
      const active = button.dataset.themeChoice === theme;

      button.classList.toggle("active", active);
      button.setAttribute("aria-checked", String(active));
    });
  }

  function updateFontPreview(fontFamily, fontSize) {
    const preview = document.getElementById("fontPreview");

    if (!preview) return;

    preview.style.fontFamily = fontFamily;
    preview.style.fontSize = `${fontSize}px`;
  }

  function showWallpaperStatus(message) {
    const status = document.getElementById("wallpaperStatus");

    if (status) {
      status.textContent = message;
    }
  }

  async function handleWallpaperChange(event) {
    const file = event.target.files && event.target.files[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showWallpaperStatus("Please choose an image file.");
      return;
    }

    try {
      await saveWallpaper(file);

      setWallpaperUrl(URL.createObjectURL(file));
      showWallpaperStatus("Wallpaper saved on this device.");
    } catch (error) {
      console.error(error);
      showWallpaperStatus("Unable to save this wallpaper.");
    }

    event.target.value = "";
  }

  async function handleWallpaperRemove() {
    try {
      await removeWallpaper();
      setWallpaperUrl(null);
      showWallpaperStatus("Wallpaper removed.");
    } catch (error) {
      console.error(error);
      showWallpaperStatus("Unable to remove the wallpaper.");
    }
  }

  function initControls() {
    const settings = getSettings();

    const fontFamily = document.getElementById("fontFamily");
    const fontSize = document.getElementById("fontSize");
    const fontSizeValue = document.getElementById("fontSizeValue");
    const wallpaperInput = document.getElementById("wallpaperInput");
    const removeButton = document.getElementById("removeWallpaper");

    applyTheme(settings.theme);
    applyFont(settings.fontFamily, settings.fontSize);
    updateThemeButtons(settings.theme);

    if (fontFamily) {
      fontFamily.value = settings.fontFamily;

      fontFamily.addEventListener("change", () => {
        const next = getSettings();

        next.fontFamily = fontFamily.value;

        saveSettings(next);
        applyFont(next.fontFamily, next.fontSize);
        updateFontPreview(next.fontFamily, next.fontSize);
      });
    }

    if (fontSize) {
      fontSize.value = settings.fontSize;

      fontSize.addEventListener("input", () => {
        const next = getSettings();
        const value = Number(fontSize.value);

        next.fontSize = value;

        saveSettings(next);
        applyFont(next.fontFamily, value);

        if (fontSizeValue) {
          fontSizeValue.value = `${value}px`;
          fontSizeValue.textContent = `${value}px`;
        }

        updateFontPreview(next.fontFamily, value);
      });
    }

    if (fontSizeValue) {
      fontSizeValue.value = `${settings.fontSize}px`;
      fontSizeValue.textContent = `${settings.fontSize}px`;
    }

    updateFontPreview(settings.fontFamily, settings.fontSize);

    document.querySelectorAll("[data-theme-choice]").forEach(button => {
      button.addEventListener("click", () => {
        const next = getSettings();

        next.theme = button.dataset.themeChoice;

        saveSettings(next);
        applyTheme(next.theme);
        updateThemeButtons(next.theme);
      });
    });

    if (wallpaperInput) {
      wallpaperInput.addEventListener("change", handleWallpaperChange);
    }

    if (removeButton) {
      removeButton.addEventListener("click", handleWallpaperRemove);
    }

    loadWallpaper();
  }

  function applySavedAppearance() {
    const settings = getSettings();

    applyTheme(settings.theme);
    applyFont(settings.fontFamily, settings.fontSize);
  }

  window.ZakiChatAppearance = Object.freeze({
    getSettings,
    applySavedAppearance,
    loadWallpaper
  });

  applySavedAppearance();

  document.addEventListener("DOMContentLoaded", () => {
    initControls();
  });
})();
