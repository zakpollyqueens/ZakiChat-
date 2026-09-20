(function () {
  "use strict";

  const FN = "https://xdpevlurgtvgduwzyoue.supabase.co/functions/v1/two-step";

  const setup = document.getElementById("setupButton");
  const recovery = document.getElementById("recoveryButton");
  const dialog = document.getElementById("setupDialog");
  const close = document.getElementById("closeDialogButton");
  const verify = document.getElementById("verifyButton");
  const code = document.getElementById("verificationCode");
  const secretBox = document.getElementById("setupSecretBox");
  const secret = document.getElementById("setupSecret");
  const copySecret = document.getElementById("copySecretButton");
  const recoveryBox = document.getElementById("recoveryBox");
  const recoveryCodes = document.getElementById("recoveryCodes");
  const message = document.getElementById("setupMessage");
  const status = document.getElementById("verificationStatus");
  const badge = document.getElementById("statusBadge");

  let enabled = false;

  async function session() {
    const client = window.ZakiChatAuth?.client;
    if (!client) throw new Error("ZakiChat authentication is not ready.");

    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    if (!data.session) throw new Error("Please sign in again.");

    return data.session;
  }

  async function call(action, extra = {}) {
    const s = await session();

    const res = await fetch(FN, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + s.access_token,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ action, ...extra })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || "Two-step verification request failed.");
    }

    return data;
  }

  function render(on) {
    enabled = Boolean(on);

    status.textContent = enabled ? "Configured" : "Not configured";
    badge.textContent = enabled ? "On" : "Off";
    badge.classList.toggle("active", enabled);

    setup.textContent = enabled
      ? "Manage two-step verification"
      : "Set up two-step verification";
  }

  function openDialog() {
    if (!dialog) return;
    dialog.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeDialog() {
    if (!dialog) return;
    dialog.hidden = true;
    document.body.style.overflow = "";
  }

  async function load() {
    try {
      const data = await call("status");
      render(data.enabled);
    } catch (error) {
      console.error("Two-step status error:", error);
    }
  }

  setup?.addEventListener("click", async function () {
    openDialog();

    message.textContent =
      "Preparing secure setup. Your secret key will appear below.";

    secretBox.hidden = true;
    recoveryBox.hidden = true;
    verify.hidden = false;
    verify.disabled = false;
    code.value = "";

    if (enabled) {
      message.textContent =
        "Two-step verification is already enabled for this account.";
      return;
    }

    try {
      const data = await call("setup");

      if (!data.secret) {
        throw new Error("The server did not return a setup secret.");
      }

      secret.value = data.secret;
      secretBox.hidden = false;

      message.textContent =
        "Copy the secret key into your authenticator app, then enter the 6-digit code it generates.";

      code.focus();
    } catch (error) {
      message.textContent = error.message;
    }
  });

  copySecret?.addEventListener("click", async function (event) {
    event.preventDefault();
    event.stopPropagation();

    if (!secret.value) return;

    try {
      await navigator.clipboard.writeText(secret.value);
    } catch {
      secret.select();
      document.execCommand("copy");
    }

    copySecret.textContent = "Copied";

    setTimeout(function () {
      copySecret.textContent = "Copy secret";
    }, 1500);
  });

  verify?.addEventListener("click", async function (event) {
    event.preventDefault();
    event.stopPropagation();

    const value = code.value.trim();

    if (!/^\d{6}$/.test(value)) {
      message.textContent = "Enter the 6-digit verification code.";
      return;
    }

    verify.disabled = true;

    try {
      const data = await call("enable", { code: value });

      render(true);

      recoveryCodes.textContent =
        (data.recoveryCodes || []).join("\n");

      recoveryBox.hidden = false;

      message.textContent =
        "Two-step verification is enabled. Save these recovery codes somewhere safe.";

      verify.hidden = true;
    } catch (error) {
      message.textContent = error.message;
    } finally {
      verify.disabled = false;
    }
  });

  recovery?.addEventListener("click", async function (event) {
    event.preventDefault();
    event.stopPropagation();

    try {
      const data = await call("status");

      if (!data.enabled) {
        alert("Two-step verification is not enabled.");
        return;
      }

      if (confirm("Disable two-step verification for this account?")) {
        await call("disable");
        render(false);
        alert("Two-step verification has been disabled.");
      }
    } catch (error) {
      alert(error.message);
    }
  });

  close?.addEventListener("click", function (event) {
    event.preventDefault();
    event.stopPropagation();
    closeDialog();
  });

  dialog?.addEventListener("click", function (event) {
    if (
      event.target === dialog ||
      event.target.hasAttribute("data-close-dialog")
    ) {
      closeDialog();
    }
  });

  load();
})();
