(function () {
  "use strict";

  const SecurityPage = {
    async init() {
      const security =
        window.ZakiChatSecurity;

      if (!security) {
        console.error(
          "ZakiChat Security module is unavailable."
        );
        return;
      }

      await security.init();

      this.status =
        document.getElementById("appLockStatus");

      this.toggle =
        document.getElementById("appLockToggle");

      this.options =
        document.getElementById("appLockOptions");

      this.method =
        document.getElementById("lockMethod");

      this.secret =
        document.getElementById("lockSecret");

      this.secretLabel =
        document.querySelector(
          'label[for="lockSecret"]'
        );

      this.autoLock =
        document.getElementById("autoLock");

      this.saveButton =
        document.getElementById("saveAppLock");

      this.disableButton =
        document.getElementById("disableAppLock");

      this.message =
        document.getElementById("securityMessage");

      if (
        !this.status ||
        !this.toggle ||
        !this.options ||
        !this.method ||
        !this.secret ||
        !this.autoLock ||
        !this.saveButton ||
        !this.disableButton ||
        !this.message
      ) {
        console.error(
          "ZakiChat Security page controls are incomplete."
        );
        return;
      }

      this.bindEvents();
      this.updateUI();
    },

    bindEvents() {
      this.toggle.addEventListener(
        "click",
        () => {
          if (
            window.ZakiChatSecurity.isEnabled()
          ) {
            this.options.hidden =
              !this.options.hidden;

            return;
          }

          this.options.hidden = false;
          this.secret.focus();
        }
      );

      this.method.addEventListener(
        "change",
        () => {
          this.updateSecretField();
        }
      );

      this.saveButton.addEventListener(
        "click",
        () => {
          this.save().catch(error => {
            this.showError(error);
          });
        }
      );

      this.disableButton.addEventListener(
        "click",
        () => {
          window.ZakiChatSecurity.disable();

          this.options.hidden = true;

          this.showMessage(
            "App Lock has been disabled."
          );

          this.updateUI();
        }
      );
    },

    updateSecretField() {
      const method =
        this.method.value;

      if (method === "pin") {
        this.secretLabel.textContent =
          "Create PIN";

        this.secret.placeholder =
          "Enter a PIN";

        this.secret.inputMode =
          "numeric";

        this.secret.autocomplete =
          "new-password";
      } else {
        this.secretLabel.textContent =
          "Create password";

        this.secret.placeholder =
          "Enter a password";

        this.secret.inputMode =
          "text";

        this.secret.autocomplete =
          "new-password";
      }
    },

    updateUI() {
      const security =
        window.ZakiChatSecurity;

      const enabled =
        security.isEnabled();

      if (enabled) {
        const method =
          security.config.method === "pin"
            ? "PIN"
            : "Password";

        this.status.textContent =
          `Enabled · ${method}`;

        this.toggle.textContent =
          "Manage";

        this.toggle.classList.add(
          "enabled"
        );

        this.method.value =
          security.config.method || "pin";

        this.autoLock.value =
          security.config.autoLock ||
          "immediately";

        this.secret.value = "";

        this.updateSecretField();

        return;
      }

      this.status.textContent =
        "App Lock is currently disabled.";

      this.toggle.textContent =
        "Enable";

      this.toggle.classList.remove(
        "enabled"
      );

      this.options.hidden = true;

      this.method.value = "pin";
      this.autoLock.value = "immediately";

      this.updateSecretField();
    },

    async save() {
      const method =
        this.method.value;

      const secret =
        this.secret.value.trim();

      if (!secret) {
        throw new Error(
          method === "pin"
            ? "Enter a PIN first."
            : "Enter a password first."
        );
      }

      await window.ZakiChatSecurity.enable(
        method,
        secret
      );

      const config =
        window.ZakiChatSecurity.config;

      config.autoLock =
        this.autoLock.value;

      window.ZakiChatSecurity.saveConfig(
        config
      );

      this.secret.value = "";
      this.options.hidden = true;

      this.showMessage(
        "App Lock has been enabled successfully."
      );

      this.updateUI();
    },

    showMessage(message) {
      this.message.textContent =
        message;

      this.message.className =
        "settings-message security-success";
    },

    showError(error) {
      console.error(
        "ZakiChat App Lock:",
        error
      );

      this.message.textContent =
        error?.message ||
        "Unable to update App Lock.";

      this.message.className =
        "settings-message security-error";
    }
  };

  document.addEventListener(
    "DOMContentLoaded",
    () => {
      SecurityPage.init().catch(error => {
        console.error(
          "ZakiChat Security page:",
          error
        );
      });
    }
  );
})();
