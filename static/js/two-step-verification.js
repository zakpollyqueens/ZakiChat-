(function () {
  "use strict";

  const FN =
    "https://xdpevlurgtvgduwzyoue.supabase.co/functions/v1/two-step";

  const setup = document.getElementById("setupButton");
  const recovery = document.getElementById("recoveryButton");
  const dialog = document.getElementById("setupDialog");
  const close = document.getElementById("closeDialogButton");
  const verify = document.getElementById("verifyButton");
  const code = document.getElementById("verificationCode");
  const secretBox = document.getElementById("setupSecretBox");
  const secret = document.getElementById("setupSecret");
  const recoveryBox = document.getElementById("recoveryBox");
  const recoveryCodes = document.getElementById("recoveryCodes");
  const message = document.getElementById("setupMessage");
  const status = document.getElementById("verificationStatus");
  const badge = document.getElementById("statusBadge");

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
    if (!res.ok) throw new Error(data.error || "Two-step verification request failed.");
    return data;
  }

  function render(on) {
    status.textContent = on ? "Configured" : "Not configured";
    badge.textContent = on ? "On" : "Off";
    badge.classList.toggle("active", on);
    setup.textContent = on
      ? "Manage two-step verification"
      : "Set up two-step verification";
  }

  function open() {
    dialog.hidden = false;
  }

  function closeDialog() {
    dialog.hidden = true;
  }

  async function load() {
    try {
      const data = await call("status");
      render(data.enabled);
    } catch (e) {
      console.error(e);
    }
  }

  setup?.addEventListener("click", async function () {
    open();
    message.textContent = "Preparing secure setup...";
    secretBox.hidden = true;
    recoveryBox.hidden = true;
    code.value = "";

    try {
      const data = await call("setup");
      secret.textContent = data.secret;
      secretBox.hidden = false;
      message.textContent =
        "Add this secret to your authenticator app, then enter the 6-digit code.";
    } catch (e) {
      message.textContent = e.message;
    }
  });

  verify?.addEventListener("click", async function () {
    const value = code.value.trim();

    if (!/^\d{6}$/.test(value)) {
      message.textContent = "Enter the 6-digit verification code.";
      return;
    }

    verify.disabled = true;

    try {
      const data = await call("enable", { code: value });
      render(true);
      recoveryCodes.textContent = data.recoveryCodes.join("\n");
      recoveryBox.hidden = false;
      message.textContent =
        "Two-step verification is enabled. Save these recovery codes somewhere safe.";
      verify.hidden = true;
    } catch (e) {
      message.textContent = e.message;
    } finally {
      verify.disabled = false;
    }
  });

  recovery?.addEventListener("click", async function () {
    const data = await call("status");

    if (!data.enabled) {
      alert("Two-step verification is not enabled.");
      return;
    }

    if (confirm("Disable two-step verification for this account?")) {
      try {
        await call("disable");
        render(false);
        alert("Two-step verification has been disabled.");
      } catch (e) {
        alert(e.message);
      }
    }
  });

  close?.addEventListener("click", closeDialog);

  dialog?.addEventListener("click", function (e) {
    if (e.target.hasAttribute("data-close-dialog")) closeDialog();
  });

  load();
})();
