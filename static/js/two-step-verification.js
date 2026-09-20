(function () {
  "use strict";

  const KEY = "zakichat_two_step_verification";

  const setup = document.getElementById("setupButton");
  const recovery = document.getElementById("recoveryButton");
  const dialog = document.getElementById("setupDialog");
  const close = document.getElementById("closeDialogButton");
  const status = document.getElementById("verificationStatus");
  const badge = document.getElementById("statusBadge");

  function getState() {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || { configured: false };
    } catch {
      return { configured: false };
    }
  }

  function render() {
    const on = Boolean(getState().configured);

    status.textContent = on ? "Configured" : "Not configured";
    badge.textContent = on ? "On" : "Off";
    badge.classList.toggle("active", on);
    setup.textContent = on
      ? "Manage two-step verification"
      : "Set up two-step verification";
  }

  function open() {
    if (dialog) dialog.hidden = false;
  }

  function closeDialog() {
    if (dialog) dialog.hidden = true;
  }

  setup?.addEventListener("click", open);

  recovery?.addEventListener("click", function () {
    alert(
      "Recovery options will be available after two-step verification is connected to the secure account backend."
    );
  });

  close?.addEventListener("click", closeDialog);

  dialog?.addEventListener("click", function (e) {
    if (e.target.hasAttribute("data-close-dialog")) closeDialog();
  });

  render();
})();
