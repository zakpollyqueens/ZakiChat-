"use strict";

const SecurityPage = {
  elements: {},

  init() {
    this.cacheElements();
    this.bindEvents();
    this.setupSecretVisibility();
    this.setupMethodUI();
    this.refresh();

    window.addEventListener("storage", () => {
      this.refresh();
    });
  },

  cacheElements() {
    this.elements = {
      toggle: document.getElementById("appLockToggle"),
      status: document.getElementById("appLockStatus"),
      overviewBadge: document.getElementById("securityOverviewBadge"),
      options: document.getElementById("appLockOptions"),
      method: document.getElementById("lockMethod"),
      secret: document.getElementById("lockSecret"),
      secretLabel: document.getElementById("lockSecretLabel"),
      secretVisibility: document.getElementById("toggleSecretVisibility"),
      autoLock: document.getElementById("autoLock"),
      save: document.getElementById("saveAppLock"),
      disable: document.getElementById("disableAppLock"),
      message: document.getElementById("securityMessage")
    };
  },

  bindEvents() {
    this.elements.toggle?.addEventListener("click", () => {
      this.handleToggle();
    });

    this.elements.method?.addEventListener("change", () => {
      this.setupMethodUI();
    });

    this.elements.save?.addEventListener("click", () => {
      this.save();
    });

    this.elements.disable?.addEventListener("click", () => {
      this.disable();
    });
  },

  setupSecretVisibility() {
    const button = this.elements.secretVisibility;
    const input = this.elements.secret;

    if (!button || !input) return;

    button.addEventListener("click", () => {
      const hidden = input.type === "password";

      input.type = hidden ? "text" : "password";
      button.textContent = hidden ? "🙈" : "👁";

      button.setAttribute(
        "aria-label",
        hidden ? "Hide credential" : "Show credential"
      );

      button.setAttribute(
        "title",
        hidden ? "Hide credential" : "Show credential"
      );
    });
  },

  setupMethodUI() {
    const method = this.elements.method?.value || "pin";
    const input = this.elements.secret;
    const label = this.elements.secretLabel;

    if (!input || !label) return;

    if (method === "password") {
      label.textContent = "Create Password";
      input.inputMode = "text";
      input.autocomplete = "new-password";
      input.placeholder = "Enter your password";
    } else {
      label.textContent = "Create PIN";
      input.inputMode = "numeric";
      input.autocomplete = "new-password";
      input.placeholder = "Enter your PIN";
    }

    input.value = "";
  },

  detectEnabled() {
    try {
      const security = window.ZakiChatSecurity;

      if (
        security &&
        typeof security.isEnabled === "function"
      ) {
        return Boolean(security.isEnabled());
      }
    } catch (error) {
      console.error(
        "ZakiChat Security status check:",
        error
      );
    }

    return false;
  },

  refresh() {
    const enabled = this.detectEnabled();

    const {
      toggle,
      status,
      overviewBadge,
      options,
      disable
    } = this.elements;

    if (status) {
      status.textContent = enabled
        ? "App Lock is enabled on this device."
        : "App Lock is currently disabled.";
    }

    if (toggle) {
      toggle.textContent = enabled
        ? "Manage"
        : "Enable";

      toggle.classList.toggle(
        "enabled",
        enabled
      );
    }

    if (overviewBadge) {
      overviewBadge.textContent = enabled
        ? "Protected"
        : "Not enabled";

      overviewBadge.classList.toggle(
        "enabled",
        enabled
      );
    }

    if (options) {
      options.hidden = false;
    }

    if (disable) {
      disable.hidden = false;
    }
  },

  handleToggle() {
    const options = this.elements.options;

    if (!options) return;

    options.hidden = false;

    const enabled = this.detectEnabled();

    this.showMessage(
      enabled
        ? "App Lock is enabled. You can update your lock settings below."
        : "Choose a lock method and create your PIN or password."
    );

    options.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

    setTimeout(() => {
      this.elements.secret?.focus();
    }, 250);
  },

  async save() {
    const security = window.ZakiChatSecurity;

    if (
      !security ||
      typeof security.enable !== "function"
    ) {
      this.showMessage(
        "Security engine is unavailable.",
        true
      );
      return;
    }

    const secret =
      this.elements.secret?.value?.trim() || "";

    const method =
      this.elements.method?.value || "pin";

    if (!secret) {
      this.showMessage(
        method === "password"
          ? "Enter a password first."
          : "Enter a PIN first.",
        true
      );

      this.elements.secret?.focus();
      return;
    }

    if (
      method === "pin" &&
      !/^[0-9]+$/.test(secret)
    ) {
      this.showMessage(
        "A PIN must contain numbers only.",
        true
      );

      this.elements.secret?.focus();
      return;
    }

    if (
      method === "pin" &&
      (secret.length < 4 ||
        secret.length > 12)
    ) {
      this.showMessage(
        "Use a PIN between 4 and 12 digits.",
        true
      );

      this.elements.secret?.focus();
      return;
    }

    if (
      method === "password" &&
      secret.length < 4
    ) {
      this.showMessage(
        "Use a password with at least 4 characters.",
        true
      );

      this.elements.secret?.focus();
      return;
    }

    this.setSaving(true);

    try {
      const result = await security.enable(
        method,
        secret
      );

      if (result === false) {
        throw new Error(
          "Unable to enable App Lock."
        );
      }

      this.elements.secret.value = "";

      this.showMessage(
        "App Lock has been enabled successfully."
      );

      this.refresh();

    } catch (error) {
      console.error(
        "ZakiChat App Lock save:",
        error
      );

      this.showMessage(
        error?.message ||
          "App Lock could not be enabled.",
        true
      );
    } finally {
      this.setSaving(false);
    }
  },

  async disable() {
    const security = window.ZakiChatSecurity;

    if (
      !security ||
      typeof security.disable !== "function"
    ) {
      this.showMessage(
        "Security engine is unavailable.",
        true
      );
      return;
    }

    if (
      !window.confirm(
        "Disable App Lock on this device?"
      )
    ) {
      return;
    }

    this.setSaving(true);

    try {
      await security.disable();

      this.elements.secret.value = "";

      this.showMessage(
        "App Lock has been disabled."
      );

      this.refresh();

    } catch (error) {
      console.error(
        "ZakiChat App Lock disable:",
        error
      );

      this.showMessage(
        error?.message ||
          "App Lock could not be disabled.",
        true
      );
    } finally {
      this.setSaving(false);
    }
  },

  setSaving(saving) {
    const {
      save,
      disable,
      toggle
    } = this.elements;

    if (save) {
      if (!save.dataset.originalText) {
        save.dataset.originalText =
          save.textContent;
      }

      save.disabled = Boolean(saving);

      save.textContent = saving
        ? "Saving…"
        : save.dataset.originalText;
    }

    if (disable) {
      disable.disabled = Boolean(saving);
    }

    if (toggle) {
      toggle.disabled = Boolean(saving);
    }
  },

  showMessage(message, isError = false) {
    const element = this.elements.message;

    if (!element) return;

    element.textContent = message || "";

    element.classList.toggle(
      "error",
      Boolean(isError)
    );

    element.classList.toggle(
      "success",
      Boolean(message) && !isError
    );
  }
};

window.ZakiChatSecurityPage = SecurityPage;

document.addEventListener(
  "DOMContentLoaded",
  () => {
    SecurityPage.init();
  }
);
