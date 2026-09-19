(function () {
  "use strict";

  const STORAGE_KEY = "zakichat_passkeys";

  const supportStatus = document.getElementById("supportStatus");
  const supportBadge = document.getElementById("supportBadge");
  const addPasskeyButton = document.getElementById("addPasskeyButton");
  const passkeysList = document.getElementById("passkeysList");

  const passkeyDialog = document.getElementById("passkeyDialog");
  const dialogMessage = document.getElementById("dialogMessage");
  const closeDialogButton = document.getElementById("closeDialogButton");

  function isSupported() {
    return (
      window.isSecureContext &&
      "PublicKeyCredential" in window &&
      typeof window.PublicKeyCredential === "function"
    );
  }

  function loadPasskeys() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : [];

      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function savePasskeys(passkeys) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(passkeys));
  }

  function updateSupportStatus() {
    if (isSupported()) {
      supportStatus.textContent =
        "This browser supports passkey technology.";
      supportBadge.textContent = "Supported";
      supportBadge.classList.add("supported");
      supportBadge.classList.remove("unsupported");
      addPasskeyButton.disabled = false;
    } else {
      supportStatus.textContent =
        "Passkeys are not available in this browser or context.";
      supportBadge.textContent = "Unavailable";
      supportBadge.classList.add("unsupported");
      supportBadge.classList.remove("supported");
      addPasskeyButton.disabled = true;
    }
  }

  function renderPasskeys() {
    const passkeys = loadPasskeys();

    passkeysList.innerHTML = "";

    if (!passkeys.length) {
      const empty = document.createElement("div");
      empty.className = "empty-passkeys";
      empty.textContent =
        "No passkeys have been registered on this device.";
      passkeysList.appendChild(empty);
      return;
    }

    passkeys.forEach((passkey) => {
      const item = document.createElement("div");
      item.className = "passkey-item";

      const icon = document.createElement("span");
      icon.className = "passkey-item-icon";
      icon.textContent = "🔑";

      const info = document.createElement("div");
      info.className = "passkey-item-info";

      const name = document.createElement("strong");
      name.textContent = passkey.name || "ZakiChat passkey";

      const date = document.createElement("small");
      date.textContent = passkey.createdAt
        ? "Added " + new Date(passkey.createdAt).toLocaleDateString()
        : "Registered passkey";

      info.appendChild(name);
      info.appendChild(date);

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "remove-passkey-button";
      removeButton.textContent = "✕";
      removeButton.setAttribute("aria-label", "Remove passkey");

      removeButton.addEventListener("click", function () {
        removePasskey(passkey.id);
      });

      item.appendChild(icon);
      item.appendChild(info);
      item.appendChild(removeButton);

      passkeysList.appendChild(item);
    });
  }

  function openDialog(message) {
    if (message) {
      dialogMessage.textContent = message;
    }

    passkeyDialog.hidden = false;
  }

  function closeDialog() {
    passkeyDialog.hidden = true;
  }

  function startRegistration() {
    if (!isSupported()) {
      openDialog(
        "Passkeys are not supported by this browser or secure connection."
      );
      return;
    }

    openDialog(
      "The browser supports passkeys, but ZakiChat's authentication server must provide a secure WebAuthn registration challenge before a passkey can be registered."
    );
  }

  function removePasskey(id) {
    const passkeys = loadPasskeys();
    const updated = passkeys.filter((passkey) => passkey.id !== id);

    savePasskeys(updated);
    renderPasskeys();
  }

  addPasskeyButton?.addEventListener("click", startRegistration);
  closeDialogButton?.addEventListener("click", closeDialog);

  passkeyDialog?.addEventListener("click", function (event) {
    if (event.target.hasAttribute("data-close-dialog")) {
      closeDialog();
    }
  });

  updateSupportStatus();
  renderPasskeys();
})();
