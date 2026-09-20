(() => {
  "use strict";

  const SETTINGS_KEY = "zakichat_keyboard_settings";
  const KEYBOARD_ID = "zaki-keyboard";

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
    ]
  };

  let settings = loadSettings();
  let activeInput = null;
  let shifted = false;
  let numeric = false;
  let toolsOpen = false;

  function loadSettings() {
    try {
      return {
        ...defaults,
        ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}")
      };
    } catch {
      return { ...defaults };
    }
  }

  function saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  function vibrate() {
    if (settings.keyVibration && navigator.vibrate) {
      navigator.vibrate(8);
    }
  }

  function playKeySound() {
    if (!settings.keySounds) return;

    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;

      const ctx = new AudioContext();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();

      oscillator.frequency.value = 180;
      gain.gain.value = 0.025;

      oscillator.connect(gain);
      gain.connect(ctx.destination);

      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.025);
    } catch {}
  }

  function feedback() {
    vibrate();
    playKeySound();
  }

  function createKeyboard() {
    if (document.getElementById(KEYBOARD_ID)) return;

    const keyboard = document.createElement("div");
    keyboard.id = KEYBOARD_ID;
    keyboard.className = "zaki-keyboard";
    keyboard.innerHTML = `
      <div class="zaki-keyboard-tools" id="zaki-keyboard-tools"></div>

      <div class="zaki-keyboard-panel" id="zaki-keyboard-panel"></div>

      <div class="zaki-suggestion-row" id="zaki-suggestions"></div>

      <div class="zaki-keyboard-keys" id="zaki-keyboard-keys"></div>
    `;

    document.body.appendChild(keyboard);

    render();
  }

  function render() {
    const keyboard = document.getElementById(KEYBOARD_ID);
    if (!keyboard) return;

    keyboard.dataset.theme = settings.theme;
    keyboard.dataset.size = settings.keySize;
    keyboard.classList.toggle("tools-open", toolsOpen);
    keyboard.classList.toggle("one-hand", settings.oneHand === true);

    renderTools();
    renderPanel();
    renderSuggestions();
    renderKeys();
  }

  function renderTools() {
    const bar = document.getElementById("zaki-keyboard-tools");
    if (!bar) return;

    const labels = {
      clipboard: "📋",
      gif: "GIF",
      contact: "👤",
      editor: "✍️",
      screenshot: "📸",
      "view-once": "◉",
      "one-hand": "☝️",
      themes: "🎨",
      voice: "🎙️",
      attachments: "📎",
      emoji: "😊"
    };

    const tools = Array.isArray(settings.quickTools)
      ? settings.quickTools
      : defaults.quickTools;

    bar.innerHTML = `
      <div class="zaki-front-tools">
        ${tools.slice(0, 4).map(tool => `
          <button type="button"
                  class="zaki-tool-button"
                  data-tool="${tool}">
            ${labels[tool] || "•"}
          </button>
        `).join("")}
      </div>

      <button type="button"
              class="zaki-four-dots ${toolsOpen ? "active" : ""}"
              id="zaki-four-dots"
              aria-label="More keyboard tools"
              title="More tools">
        <i></i><i></i><i></i><i></i>
      </button>
    `;

    bar.querySelectorAll("[data-tool]").forEach(button => {
      button.addEventListener("click", () => {
        useTool(button.dataset.tool);
      });
    });

    bar.querySelector("#zaki-four-dots")?.addEventListener("click", () => {
      toolsOpen = !toolsOpen;
      feedback();
      render();
    });
  }

  function renderPanel() {
    const panel = document.getElementById("zaki-keyboard-panel");
    if (!panel) return;

    if (!toolsOpen) {
      panel.innerHTML = "";
      return;
    }

    const tools = [
      ["clipboard", "📋", "Clipboard"],
      ["gif", "GIF", "GIFs"],
      ["contact", "👤", "Share Contact"],
      ["editor", "✍️", "Text Editor"],
      ["screenshot", "📸", "Screenshot"],
      ["view-once", "◉", "View Once"],
      ["one-hand", "☝️", "One-hand"],
      ["themes", "🎨", "Themes"],
      ["voice", "🎙️", "Voice Note"],
      ["attachments", "📎", "Attachments"],
      ["emoji", "😊", "Emoji"]
    ];

    panel.innerHTML = tools.map(([id, icon, name]) => `
      <button type="button"
              class="zaki-panel-tool"
              data-tool="${id}">
        <span>${icon}</span>
        <small>${name}</small>
      </button>
    `).join("");

    panel.querySelectorAll("[data-tool]").forEach(button => {
      button.addEventListener("click", () => {
        useTool(button.dataset.tool);
      });
    });
  }

  function renderSuggestions() {
    const row = document.getElementById("zaki-suggestions");
    if (!row) return;

    if (!settings.suggestions) {
      row.innerHTML = "";
      row.hidden = true;
      return;
    }

    row.hidden = false;

    const value = activeInput?.value?.trim() || "";

    const suggestions = value
      ? [value, `${value} 👍`, `${value}!`]
      : ["Hi", "Hello", "Hey"];

    row.innerHTML = suggestions.map(text => `
      <button type="button" data-suggestion="${escapeHtml(text)}">
        ${escapeHtml(text)}
      </button>
    `).join("");

    row.querySelectorAll("[data-suggestion]").forEach(button => {
      button.addEventListener("click", () => {
        setInputValue(button.dataset.suggestion);
      });
    });
  }

  function renderKeys() {
    const keys = document.getElementById("zaki-keyboard-keys");
    if (!keys) return;

    if (numeric) {
      keys.innerHTML = `
        <div class="zaki-key-row">
          ${["1","2","3"].map(keyButton).join("")}
        </div>
        <div class="zaki-key-row">
          ${["4","5","6"].map(keyButton).join("")}
        </div>
        <div class="zaki-key-row">
          ${["7","8","9"].map(keyButton).join("")}
        </div>
        <div class="zaki-key-row">
          ${[".","0","@","⌫"].map(keyButton).join("")}
        </div>
        <div class="zaki-key-row zaki-bottom-row">
          ${keyButton("ABC", "wide")}
          ${keyButton("space", "space")}
          ${keyButton("↵", "wide")}
        </div>
      `;
    } else {
      const rows = [
        ["Q","W","E","R","T","Y","U","I","O","P"],
        ["A","S","D","F","G","H","J","K","L"],
        ["⇧","Z","X","C","V","B","N","M","⌫"]
      ];

      keys.innerHTML = rows.map((row, index) => `
        <div class="zaki-key-row ${index === 2 ? "third-row" : ""}">
          ${row.map(keyButton).join("")}
        </div>
      `).join("") + `
        <div class="zaki-key-row zaki-bottom-row">
          ${keyButton("123", "wide")}
          ${keyButton("☺", "wide")}
          ${keyButton("space", "space")}
          ${keyButton("↵", "wide")}
        </div>
      `;
    }

    keys.querySelectorAll("[data-key]").forEach(button => {
      button.addEventListener("click", () => pressKey(button.dataset.key));
    });
  }

  function keyButton(key, extra = "") {
    const display = key === "space" ? "" : key;
    return `
      <button type="button"
              class="zaki-key ${extra}"
              data-key="${key}">
        ${display}
      </button>
    `;
  }

  function pressKey(key) {
    feedback();

    if (!activeInput) return;

    if (key === "⌫") {
      const start = activeInput.selectionStart ?? activeInput.value.length;
      const end = activeInput.selectionEnd ?? start;

      if (start !== end) {
        replaceSelection("", start, end);
      } else if (start > 0) {
        replaceSelection("", start - 1, start);
      }

      return;
    }

    if (key === "space") {
      insertText(" ");
      return;
    }

    if (key === "↵") {
      const form = activeInput.closest("form");

      if (form) {
        const sendButton = form.querySelector(
          '[type="submit"], #send-message-button'
        );

        if (sendButton) {
          sendButton.click();
          return;
        }
      }

      insertText("\n");
      return;
    }

    if (key === "123") {
      numeric = true;
      render();
      return;
    }

    if (key === "ABC") {
      numeric = false;
      render();
      return;
    }

    if (key === "☺") {
      insertText("😊");
      return;
    }

    if (key === "⇧") {
      shifted = !shifted;
      render();
      return;
    }

    let output = key;

    if (!shifted) {
      output = key.toLowerCase();
    }

    insertText(output);

    if (shifted) {
      shifted = false;
      render();
    }
  }

  function insertText(text) {
    if (!activeInput) return;

    const start = activeInput.selectionStart ?? activeInput.value.length;
    const end = activeInput.selectionEnd ?? start;

    replaceSelection(text, start, end);
  }

  function replaceSelection(text, start, end) {
    const value = activeInput.value;

    activeInput.value =
      value.slice(0, start) +
      text +
      value.slice(end);

    const cursor = start + text.length;

    activeInput.setSelectionRange(cursor, cursor);

    activeInput.dispatchEvent(
      new Event("input", { bubbles: true })
    );

    renderSuggestions();
  }

  function setInputValue(text) {
    if (!activeInput) return;

    activeInput.value = text;
    activeInput.dispatchEvent(
      new Event("input", { bubbles: true })
    );

    activeInput.focus();
  }

  function useTool(tool) {
    feedback();

    switch (tool) {
      case "emoji":
        insertText("😊");
        break;

      case "voice":
        document.querySelector("#voice-note-button")?.click();
        break;

      case "attachments":
        document.querySelector("#attach-file-button")?.click();
        break;

      case "themes":
        window.location.href = "keyboard.html";
        break;

      case "one-hand":
        settings.oneHand = !settings.oneHand;
        saveSettings();
        render();
        break;

      case "clipboard":
        if (navigator.clipboard?.readText) {
          navigator.clipboard.readText()
            .then(text => {
              if (text) insertText(text);
            })
            .catch(() => {});
        }
        break;

      case "contact":
        window.dispatchEvent(
          new CustomEvent("zaki:share-contact")
        );
        break;

      case "gif":
        window.dispatchEvent(
          new CustomEvent("zaki:open-gif")
        );
        break;

      case "editor":
        window.dispatchEvent(
          new CustomEvent("zaki:open-text-editor")
        );
        break;

      case "screenshot":
        window.dispatchEvent(
          new CustomEvent("zaki:screenshot-share")
        );
        break;

      case "view-once":
        window.dispatchEvent(
          new CustomEvent("zaki:view-once")
        );
        break;
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function attachInput(input) {
    if (!input || input.dataset.zakiKeyboardAttached) return;

    input.dataset.zakiKeyboardAttached = "true";

    input.setAttribute("readonly", "readonly");

    input.addEventListener("focus", () => {
      activeInput = input;
      createKeyboard();

      const keyboard = document.getElementById(KEYBOARD_ID);
      keyboard?.classList.add("visible");

      renderSuggestions();
    });

    input.addEventListener("click", () => {
      activeInput = input;
      createKeyboard();

      const keyboard = document.getElementById(KEYBOARD_ID);
      keyboard?.classList.add("visible");
    });
  }

  function attachInputs() {
    document
      .querySelectorAll(
        ".message-composer input[type='text'], " +
        ".message-composer textarea, " +
        "#chat-search-input, " +
        "input[data-zaki-keyboard], " +
        "textarea[data-zaki-keyboard], " +
        "input[type='search'], " +
        "form input[type='text']:not([data-native-keyboard]), " +
        "form textarea:not([data-native-keyboard])"
      )
      .forEach(attachInput);
  }

  function hideKeyboard() {
    const keyboard = document.getElementById(KEYBOARD_ID);
    keyboard?.classList.remove("visible");
  }

  function init() {
    createKeyboard();
    attachInputs();

    document.addEventListener("focusin", event => {
      if (
        event.target.matches?.(
".message-composer input[type='text'], " +
          ".message-composer textarea, " +
          "#chat-search-input, " +
          "input[data-zaki-keyboard], " +
          "textarea[data-zaki-keyboard], " +
          "input[type='search'], " +
          "form input[type='text']:not([data-native-keyboard]), " +
          "form textarea:not([data-native-keyboard])"
        )
      ) {
        attachInput(event.target);
      }
    });

    document.addEventListener("click", event => {
      const keyboard = document.getElementById(KEYBOARD_ID);

      if (!keyboard) return;

      if (
        !keyboard.contains(event.target) &&
        !event.target.matches?.(
".message-composer input[type='text'], " +
          ".message-composer textarea, " +
          "#chat-search-input, " +
          "input[data-zaki-keyboard], " +
          "textarea[data-zaki-keyboard], " +
          "input[type='search'], " +
          "form input[type='text']:not([data-native-keyboard]), " +
          "form textarea:not([data-native-keyboard])"
        )
      ) {
        if (!activeInput?.matches?.(":focus")) {
          hideKeyboard();
        }
      }
    });
  }

  window.ZakiKeyboard = {
    init,
    refresh() {
      settings = loadSettings();
      render();
    },
    focus(input) {
      activeInput = input;
      createKeyboard();
      input?.focus();
      renderSuggestions();
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
