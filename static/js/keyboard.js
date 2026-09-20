(() => {
  "use strict";

  const STORAGE_KEY = "zakichat_keyboard_settings";

  const defaults = {
    theme: "dark",
    keySize: "medium",
    numberRow: false,
    emojiRow: true,
    suggestions: true,
    keySounds: false,
    keyVibration: true,
    quickTools: [
      "clipboard",
      "gif",
      "contact",
      "editor"
    ],
    oneHand: false
  };

  const $ = selector => document.querySelector(selector);

  function load() {
    try {
      return {
        ...defaults,
        ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}")
      };
    } catch {
      return { ...defaults };
    }
  }

  function save(settings) {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(settings)
    );

    window.dispatchEvent(
      new CustomEvent("zaki:keyboard-settings-changed", {
        detail: settings
      })
    );
  }

  let settings = load();

  function apply() {
    const themeButtons =
      document.querySelectorAll(".keyboard-theme");

    themeButtons.forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.theme === settings.theme
      );
    });

    const keySize = $("#keySize");
    const numberRow = $("#numberRow");
    const emojiRow = $("#emojiRow");
    const suggestions = $("#suggestions");
    const keySounds = $("#keySounds");
    const keyVibration = $("#keyVibration");

    if (keySize) keySize.value = settings.keySize;
    if (numberRow) numberRow.checked = !!settings.numberRow;
    if (emojiRow) emojiRow.checked = !!settings.emojiRow;
    if (suggestions) suggestions.checked = !!settings.suggestions;
    if (keySounds) keySounds.checked = !!settings.keySounds;
    if (keyVibration) keyVibration.checked = !!settings.keyVibration;

    document
      .querySelectorAll(".tool-option input")
      .forEach(input => {
        input.checked =
          Array.isArray(settings.quickTools) &&
          settings.quickTools.includes(input.value);
      });

    updatePreview();
  }

  function updatePreview() {
    const preview = $("#keyboardPreview");
    if (!preview) return;

    preview.dataset.theme = settings.theme;
    preview.dataset.size = settings.keySize;

    const numberRow = preview.querySelector(".preview-number-row");

    if (numberRow) {
      numberRow.style.display =
        settings.numberRow ? "flex" : "none";
    }

    const suggestion =
      preview.querySelector(".preview-suggestion");

    if (suggestion) {
      suggestion.style.display =
        settings.suggestions ? "flex" : "none";
    }
  }

  function updateStatus(message) {
    const status = $("#keyboardStatus");

    if (!status) return;

    status.textContent = message;

    clearTimeout(updateStatus.timer);

    updateStatus.timer = setTimeout(() => {
      status.textContent = "";
    }, 1800);
  }

  function bind() {
    document
      .querySelectorAll(".keyboard-theme")
      .forEach(button => {
        button.addEventListener("click", () => {
          settings.theme = button.dataset.theme;
          save(settings);
          apply();
          updateStatus("Keyboard theme saved.");
        });
      });

    $("#keySize")?.addEventListener("change", event => {
      settings.keySize = event.target.value;
      save(settings);
      apply();
      updateStatus("Key size saved.");
    });

    $("#numberRow")?.addEventListener("change", event => {
      settings.numberRow = event.target.checked;
      save(settings);
      apply();
      updateStatus("Number row updated.");
    });

    $("#emojiRow")?.addEventListener("change", event => {
      settings.emojiRow = event.target.checked;
      save(settings);
      apply();
      updateStatus("Emoji row updated.");
    });

    $("#suggestions")?.addEventListener("change", event => {
      settings.suggestions = event.target.checked;
      save(settings);
      apply();
      updateStatus("Suggestions updated.");
    });

    $("#keySounds")?.addEventListener("change", event => {
      settings.keySounds = event.target.checked;
      save(settings);
      updateStatus("Key sounds updated.");
    });

    $("#keyVibration")?.addEventListener("change", event => {
      settings.keyVibration = event.target.checked;
      save(settings);
      updateStatus("Key vibration updated.");
    });

    document
      .querySelectorAll(".tool-option input")
      .forEach(input => {
        input.addEventListener("change", () => {
          let tools = Array.isArray(settings.quickTools)
            ? [...settings.quickTools]
            : [];

          if (input.checked) {
            if (!tools.includes(input.value)) {
              tools.push(input.value);
            }
          } else {
            tools = tools.filter(
              tool => tool !== input.value
            );
          }

          settings.quickTools = tools;
          save(settings);
          apply();
          updateStatus("Quick tools updated.");
        });
      });
  }

  function init() {
    apply();
    bind();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
