(function () {
  "use strict";

  const FUNCTION_NAME = "security-auth";

  const supportStatus =
    document.getElementById("supportStatus");

  const supportBadge =
    document.getElementById("supportBadge");

  const addPasskeyButton =
    document.getElementById("addPasskeyButton");

  const passkeysList =
    document.getElementById("passkeysList");

  const passkeyDialog =
    document.getElementById("passkeyDialog");

  const dialogTitle =
    document.getElementById("dialogTitle");

  const dialogMessage =
    document.getElementById("dialogMessage");

  const closeDialogButton =
    document.getElementById("closeDialogButton");

  let supabaseClient = null;

  function getClient() {
    return window.ZakiChatAuth?.client || null;
  }

  function isSupported() {
    return (
      window.isSecureContext &&
      "PublicKeyCredential" in window &&
      typeof window.PublicKeyCredential === "function"
    );
  }

  function openDialog(title, message) {
    if (dialogTitle) {
      dialogTitle.textContent =
        title || "Passkey";
    }

    if (dialogMessage) {
      dialogMessage.textContent =
        message || "";
    }

    if (passkeyDialog) {
      passkeyDialog.hidden = false;
    }
  }

  function closeDialog() {
    if (passkeyDialog) {
      passkeyDialog.hidden = true;
    }
  }

  function setButtonLoading(loading) {
    if (!addPasskeyButton) {
      return;
    }

    addPasskeyButton.disabled = loading;
    addPasskeyButton.textContent =
      loading
        ? "Registering..."
        : "Add a passkey";
  }

  function setSupportStatus() {
    if (!supportStatus || !supportBadge) {
      return;
    }

    if (isSupported()) {
      supportStatus.textContent =
        "This browser supports passkey technology.";

      supportBadge.textContent =
        "Supported";

      supportBadge.classList.add("supported");
      supportBadge.classList.remove("unsupported");

      if (addPasskeyButton) {
        addPasskeyButton.disabled = false;
      }

      return;
    }

    supportStatus.textContent =
      "Passkeys are not available in this browser or secure context.";

    supportBadge.textContent =
      "Unavailable";

    supportBadge.classList.add("unsupported");
    supportBadge.classList.remove("supported");

    if (addPasskeyButton) {
      addPasskeyButton.disabled = true;
    }
  }

  async function waitForClient() {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const client = getClient();

      if (client) {
        supabaseClient = client;
        return client;
      }

      await new Promise(resolve =>
        setTimeout(resolve, 100)
      );
    }

    throw new Error(
      "ZakiChat authentication client is unavailable."
    );
  }

  async function getAccessToken() {
    const client = await waitForClient();

    const {
      data,
      error
    } = await client.auth.getSession();

    if (error) {
      throw error;
    }

    const token =
      data?.session?.access_token;

    if (!token) {
      throw new Error(
        "Your ZakiChat session has expired. Please sign in again."
      );
    }

    return token;
  }

  async function callSecurityAuth(body) {
    const client = await waitForClient();

    const {
      data,
      error
    } = await client.functions.invoke(
      FUNCTION_NAME,
      {
        body
      }
    );

    if (error) {
      let message =
        error.message ||
        "Security service request failed.";

      if (error.context) {
        try {
          const responseText =
            await error.context.text();

          if (responseText) {
            const parsed =
              JSON.parse(responseText);

            if (parsed?.error) {
              message = parsed.error;
            }
          }
        } catch {
          // Keep the original error message.
        }
      }

      throw new Error(message);
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    return data;
  }

  async function loadPasskeys() {
    const data =
      await callSecurityAuth({
        action: "list-passkeys"
      });

    return Array.isArray(data?.passkeys)
      ? data.passkeys
      : [];
  }

  function formatDate(value) {
    if (!value) {
      return "Registered passkey";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "Registered passkey";
    }

    return (
      "Added " +
      date.toLocaleDateString()
    );
  }

  function renderEmpty(message) {
    if (!passkeysList) {
      return;
    }

    passkeysList.innerHTML = "";

    const empty =
      document.createElement("div");

    empty.className =
      "empty-passkeys";

    empty.textContent =
      message ||
      "No passkeys have been registered.";

    passkeysList.appendChild(empty);
  }

  function renderPasskeys(passkeys) {
    if (!passkeysList) {
      return;
    }

    passkeysList.innerHTML = "";

    if (!passkeys.length) {
      renderEmpty(
        "No passkeys have been registered for this ZakiChat account."
      );
      return;
    }

    passkeys.forEach(passkey => {
      const item =
        document.createElement("div");

      item.className =
        "passkey-item";

      const icon =
        document.createElement("span");

      icon.className =
        "passkey-item-icon";

      icon.textContent = "🔑";

      const info =
        document.createElement("div");

      info.className =
        "passkey-item-info";

      const name =
        document.createElement("strong");

      name.textContent =
        passkey.name ||
        "ZakiChat passkey";

      const date =
        document.createElement("small");

      date.textContent =
        formatDate(
          passkey.created_at
        );

      if (passkey.last_used_at) {
        date.textContent +=
          " • Last used " +
          new Date(
            passkey.last_used_at
          ).toLocaleDateString();
      }

      info.appendChild(name);
      info.appendChild(date);

      const removeButton =
        document.createElement("button");

      removeButton.type =
        "button";

      removeButton.className =
        "remove-passkey-button";

      removeButton.textContent =
        "Remove";

      removeButton.setAttribute(
        "aria-label",
        "Remove " +
          (passkey.name ||
            "ZakiChat passkey")
      );

      removeButton.addEventListener(
        "click",
        function () {
          removePasskey(
            passkey.id,
            passkey.name
          );
        }
      );

      item.appendChild(icon);
      item.appendChild(info);
      item.appendChild(removeButton);

      passkeysList.appendChild(item);
    });
  }

  async function refreshPasskeys() {
    try {
      renderEmpty(
        "Loading your passkeys..."
      );

      const passkeys =
        await loadPasskeys();

      renderPasskeys(passkeys);
    } catch (error) {
      console.error(
        "ZakiChat passkey list error:",
        error
      );

      renderEmpty(
        error.message ||
          "Unable to load your passkeys."
      );
    }
  }

  async function loadRegistrationOptions() {
    return callSecurityAuth({
      action:
        "registration-options"
    });
  }

  async function startRegistration() {
    if (!isSupported()) {
      openDialog(
        "Passkeys unavailable",
        "This browser or connection does not support passkeys."
      );
      return;
    }

    setButtonLoading(true);

    try {
      const token =
        await getAccessToken();

      /*
       * The token check above makes the authentication
       * requirement explicit. Supabase functions.invoke()
       * will also attach the current session token.
       */
      if (!token) {
        throw new Error(
          "Authentication required."
        );
      }

      openDialog(
        "Passkey registration",
        "Preparing secure registration..."
      );

      const optionsJSON =
        await loadRegistrationOptions();

      const browserModule =
        await import(
          "https://cdn.jsdelivr.net/npm/@simplewebauthn/browser@14.0.0/+esm"
        );

      const startRegistration =
        browserModule.startRegistration;

      if (
        typeof startRegistration !==
        "function"
      ) {
        throw new Error(
          "WebAuthn browser library could not be loaded."
        );
      }

      openDialog(
        "Passkey registration",
        "Follow the security prompt from your device to finish registering this passkey."
      );

      const credential =
        await startRegistration({
          optionsJSON
        });

      const nameInput =
        window.prompt(
          "Give this passkey a name, or press Cancel to use 'Passkey'.",
          "Passkey"
        );

      const name =
        typeof nameInput === "string" &&
        nameInput.trim()
          ? nameInput.trim().slice(0, 100)
          : "Passkey";

      await callSecurityAuth({
        action:
          "registration-verify",
        response:
          credential,
        name
      });

      openDialog(
        "Passkey added",
        "Your passkey has been securely registered to this ZakiChat account."
      );

      await refreshPasskeys();
    } catch (error) {
      console.error(
        "ZakiChat passkey registration error:",
        error
      );

      if (
        error?.name ===
          "NotAllowedError"
      ) {
        openDialog(
          "Registration cancelled",
          "The passkey registration was cancelled or the device did not complete the security prompt."
        );
      } else {
        openDialog(
          "Passkey registration failed",
          error.message ||
            "Unable to register the passkey. Please try again."
        );
      }
    } finally {
      setButtonLoading(false);
    }
  }

  async function removePasskey(
    id,
    name
  ) {
    if (!id) {
      return;
    }

    const confirmed =
      window.confirm(
        `Remove "${name || "this passkey"}" from your ZakiChat account?`
      );

    if (!confirmed) {
      return;
    }

    try {
      await callSecurityAuth({
        action:
          "delete-passkey",
        id
      });

      await refreshPasskeys();

      openDialog(
        "Passkey removed",
        "The selected passkey has been removed from your ZakiChat account."
      );
    } catch (error) {
      console.error(
        "ZakiChat passkey removal error:",
        error
      );

      openDialog(
        "Unable to remove passkey",
        error.message ||
          "The passkey could not be removed."
      );
    }
  }

  addPasskeyButton?.addEventListener(
    "click",
    startRegistration
  );

  closeDialogButton?.addEventListener(
    "click",
    closeDialog
  );

  passkeyDialog?.addEventListener(
    "click",
    function (event) {
      if (
        event.target.hasAttribute(
          "data-close-dialog"
        )
      ) {
        closeDialog();
      }
    }
  );

  document.addEventListener(
    "DOMContentLoaded",
    async function () {
      setSupportStatus();
      await refreshPasskeys();
    }
  );
})();
