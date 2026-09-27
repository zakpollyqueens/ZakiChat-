/* =========================================================
   ZakiChat Global Appearance
   Controls the application-wide theme.
   Chat-specific themes can override this later.
   ========================================================= */

(function () {
  "use strict";

  const STORAGE_KEY = "zakichat-appearance";

  const defaults = {
    theme: "dark",
    fontFamily: "system",
    fontSize: "medium",
    wallpaper: ""
  };

  function loadSettings() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return {
        ...defaults,
        ...(saved ? JSON.parse(saved) : {})
      };
    } catch (error) {
      console.warn("ZakiChat Appearance: unable to load settings.", error);
      return { ...defaults };
    }
  }

  function saveSettings(settings) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    apply(settings);
  }

  function apply(settings) {
    const root = document.documentElement;

    root.dataset.zakichatTheme = settings.theme;
    root.dataset.zakichatFont = settings.fontFamily;
    root.dataset.zakichatFontSize = settings.fontSize;

    document.body?.style.setProperty(
      "--zakichat-wallpaper",
      settings.wallpaper
        ? `url("${settings.wallpaper}")`
        : "none"
    );

    if (settings.fontFamily === "system") {
      root.style.setProperty(
        "--zakichat-font-family",
        "system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
      );
    }

    if (settings.fontFamily === "sans") {
      root.style.setProperty(
        "--zakichat-font-family",
        "Arial, sans-serif"
      );
    }

    if (settings.fontFamily === "serif") {
      root.style.setProperty(
        "--zakichat-font-family",
        "Georgia, serif"
      );
    }

    if (settings.fontSize === "small") {
      root.style.setProperty("--zakichat-font-size", "14px");
    }

    if (settings.fontSize === "medium") {
      root.style.setProperty("--zakichat-font-size", "16px");
    }

    if (settings.fontSize === "large") {
      root.style.setProperty("--zakichat-font-size", "18px");
    }
  }

  function update(changes) {
    const settings = {
      ...loadSettings(),
      ...changes
    };

    saveSettings(settings);
    return settings;
  }

  window.ZakiChatAppearance = {
    get: loadSettings,
    save: saveSettings,
    update,
    apply
  };

  document.addEventListener("DOMContentLoaded", function () {
    apply(loadSettings());
  });

  apply(loadSettings());
})();
