(() => {
  "use strict";

  const STORAGE_KEY = "zakichat_keyboard_settings";

  const defaults = {
    theme: "dark",
    keyboardMode: "zaki",
    keyboardProvider: "gboard",
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
  let hasPremium = false;
  const PREMIUM_PROVIDERS = ["swiftkey", "samsung", "fleksy", "grammarly"];
  const BASIC_THEMES = ["dark", "light", "cyan"];
  async function verifyPlan() {
    try {
      await window.ZakiChatAppearance?.loadPlan?.();
      hasPremium = Boolean(window.ZakiChatAppearance?.isPremium?.());
    } catch (error) { console.warn("Unable to verify keyboard theme entitlement", error); }
    // A staff member receives Business keyboard entitlements through the active
    // workspace owner's subscription, never through a client-side flag alone.
    try {
      const client = window.ZakiChatAuth?.client;
      const { data: sessionData } = await client?.auth?.getSession?.() || {};
      const userId = sessionData?.session?.user?.id;
      if (!hasPremium && userId && client) {
        const { data: memberships } = await client.from("business_members")
          .select("business_id").eq("user_id", userId).eq("status", "active");
        for (const membership of memberships || []) {
          const { data: workspace } = await client.from("business_workspaces")
            .select("owner_user_id").eq("id", membership.business_id).maybeSingle();
          if (!workspace?.owner_user_id) continue;
          const { data: upgrade } = await client.from("user_upgrades")
            .select("plan").eq("user_id", workspace.owner_user_id).eq("plan", "business_monthly")
            .eq("status", "active").gt("expires_at", new Date().toISOString())
            .order("expires_at", { ascending: false }).limit(1).maybeSingle();
          if (upgrade) { hasPremium = true; break; }
        }
      }
    } catch (error) { console.warn("Unable to verify business keyboard entitlement", error); }
    if (!hasPremium && !BASIC_THEMES.includes(settings.theme)) { settings.theme = "dark"; save(settings); }
    if (!hasPremium && PREMIUM_PROVIDERS.includes(settings.keyboardProvider)) {
      settings.keyboardProvider = "gboard"; save(settings);
    }
    apply();
  }

  function apply() {
    const themeButtons =
      document.querySelectorAll(".keyboard-theme");

    themeButtons.forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.theme === settings.theme
      );
    });

    const modeZaki = $("#keyboardModeZaki");
    const modeSystem = $("#keyboardModeSystem");
    if (modeZaki) modeZaki.checked = settings.keyboardMode !== "system";
    if (modeSystem) modeSystem.checked = settings.keyboardMode === "system";
    document.querySelectorAll('input[name="keyboardProvider"]').forEach(input => {
      input.checked = input.value === (settings.keyboardProvider || "gboard");
      const option = input.closest("[data-provider-option]");
      option?.classList.toggle("premium-locked", !hasPremium);
      input.setAttribute("aria-label", input.value + (hasPremium ? "" : " (locked; Customized plan required)"));
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
    document.querySelectorAll('input[name="keyboardProvider"]').forEach(input => {
      input.addEventListener("change", () => {
        if (!input.checked) return;
        if (PREMIUM_PROVIDERS.includes(input.value) && !hasPremium) {
          input.checked = false;
          if (confirm("This keyboard preference is included with Customized Personal or Customized Business. View upgrade plans?")) {
            window.location.href = "about.html?upgrade=personal_monthly#paid-upgrades";
          }
          apply();
          return;
        }
        settings.keyboardProvider = input.value;
        settings.keyboardMode = "system";
        save(settings);
        apply();
        updateStatus("Preference saved. Select this keyboard in Android settings if it is installed.");
      });
    });

    document.querySelectorAll('input[name="keyboardMode"]').forEach(input => {
      input.addEventListener("change", () => {
        if (!input.checked) return;
        settings.keyboardMode = input.value === "system" ? "system" : "zaki";
        if (settings.keyboardMode === "zaki") settings.keyboardProvider = "zaki";
        else if (!settings.keyboardProvider || settings.keyboardProvider === "zaki") settings.keyboardProvider = "gboard";
        save(settings);
        apply();
        updateStatus(settings.keyboardMode === "system"
          ? "Device keyboard selected. Gboard will open if it is your Android keyboard."
          : "ZakiChat Keyboard selected.");
      });
    });

    document
      .querySelectorAll(".keyboard-theme")
      .forEach(button => {
        button.addEventListener("click", () => {
          if (!BASIC_THEMES.includes(button.dataset.theme) && !hasPremium) {
            if (confirm("This keyboard theme is included with Customized Personal. Open upgrade plans?")) {
              window.location.href = "about.html?upgrade=personal_monthly#paid-upgrades";
            }
            return;
          }
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

  async function init() {
    await verifyPlan();
    apply();
    bind();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
