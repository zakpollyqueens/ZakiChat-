(function () {
  "use strict";

  const CONFIG_PREFIX = "zakichat-app-lock-";
  const ITERATIONS = 210000;

  const Security = {
    client: null,
    userId: null,
    config: null,
    locked: false,
    unlocking: false,

    storageKey() {
      return `${CONFIG_PREFIX}${this.userId || "unknown"}`;
    },

    readConfig() {
      try {
        const raw =
          localStorage.getItem(this.storageKey());

        if (!raw) {
          return {
            enabled: false,
            method: null,
            salt: null,
            verifier: null,
            autoLock: "immediately",
            hideNotificationPreviews: false
          };
        }

        return {
          enabled: false,
          method: null,
          salt: null,
          verifier: null,
          autoLock: "immediately",
          hideNotificationPreviews: false,
          ...JSON.parse(raw)
        };
      } catch (error) {
        console.error(
          "ZakiChat App Lock config read failed:",
          error
        );

        return {
          enabled: false,
          method: null,
          salt: null,
          verifier: null,
          autoLock: "immediately",
          hideNotificationPreviews: false
        };
      }
    },

    saveConfig(config) {
      localStorage.setItem(
        this.storageKey(),
        JSON.stringify(config)
      );

      this.config = config;
    },

    removeConfig() {
      if (!this.userId) return;

      localStorage.removeItem(
        this.storageKey()
      );

      this.config = null;
    },

    bytesToBase64(bytes) {
      let binary = "";

      for (const byte of bytes) {
        binary += String.fromCharCode(byte);
      }

      return btoa(binary);
    },

    base64ToBytes(value) {
      const binary = atob(value);
      const bytes = new Uint8Array(
        binary.length
      );

      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] =
          binary.charCodeAt(index);
      }

      return bytes;
    },

    async deriveVerifier(secret, salt) {
      const encoder =
        new TextEncoder();

      const baseKey =
        await crypto.subtle.importKey(
          "raw",
          encoder.encode(secret),
          "PBKDF2",
          false,
          ["deriveBits"]
        );

      const bits =
        await crypto.subtle.deriveBits(
          {
            name: "PBKDF2",
            salt,
            iterations: ITERATIONS,
            hash: "SHA-256"
          },
          baseKey,
          256
        );

      return new Uint8Array(bits);
    },

    async createVerifier(secret) {
      const salt =
        crypto.getRandomValues(
          new Uint8Array(16)
        );

      const verifier =
        await this.deriveVerifier(
          secret,
          salt
        );

      return {
        salt: this.bytesToBase64(salt),
        verifier:
          this.bytesToBase64(verifier)
      };
    },

    async verifySecret(secret) {
      if (
        !this.config?.salt ||
        !this.config?.verifier
      ) {
        return false;
      }

      const salt =
        this.base64ToBytes(
          this.config.salt
        );

      const expected =
        this.base64ToBytes(
          this.config.verifier
        );

      const actual =
        await this.deriveVerifier(
          secret,
          salt
        );

      if (
        actual.length !==
        expected.length
      ) {
        return false;
      }

      let difference = 0;

      for (
        let index = 0;
        index < actual.length;
        index += 1
      ) {
        difference |=
          actual[index] ^
          expected[index];
      }

      return difference === 0;
    },

    async enable(method, secret) {
      if (!this.userId) {
        throw new Error(
          "No authenticated ZakiChat account is active."
        );
      }

      if (
        method !== "pin" &&
        method !== "password"
      ) {
        throw new Error(
          "Unsupported App Lock method."
        );
      }

      if (
        typeof secret !== "string" ||
        secret.length < 4
      ) {
        throw new Error(
          method === "pin"
            ? "PIN must contain at least 4 characters."
            : "Password must contain at least 4 characters."
        );
      }

      if (
        method === "pin" &&
        !/^[0-9]+$/.test(secret)
      ) {
        throw new Error(
          "PIN must contain numbers only."
        );
      }

      const verifier =
        await this.createVerifier(
          secret
        );

      this.saveConfig({
        ...this.readConfig(),
        enabled: true,
        method,
        salt: verifier.salt,
        verifier: verifier.verifier
      });

      return true;
    },

    disable() {
      if (!this.userId) return;

      this.removeConfig();
    },

    isEnabled() {
      return Boolean(
        this.config?.enabled &&
        this.config?.method &&
        this.config?.salt &&
        this.config?.verifier
      );
    },

    async init() {
      if (
        !window.ZakiChatAuth?.client
      ) {
        return;
      }

      this.client =
        window.ZakiChatAuth.client;

      const {
        data,
        error
      } =
        await this.client.auth.getSession();

      if (error) {
        console.error(
          "ZakiChat Security session check failed:",
          error
        );

        return;
      }

      this.userId =
        data?.session?.user?.id || null;

      if (!this.userId) {
        return;
      }

      this.config =
        this.readConfig();
    }
  };

  window.ZakiChatSecurity =
    Object.freeze(Security);

  document.addEventListener(
    "DOMContentLoaded",
    () => {
      Security.init().catch(error => {
        console.error(
          "ZakiChat Security:",
          error
        );
      });
    }
  );
})();
