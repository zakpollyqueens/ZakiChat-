(function () {
  "use strict";

  const STORAGE_KEY = "zakichat_two_step_verification";

  const setupButton = document.getElementById("setupButton");
  const recoveryButton = document.getElementById("recoveryButton");
  const setupDialog = document.getElementById("setupDialog");
  const closeDialogButton = document.getElementById("closeDialogButton");
  const verificationStatus = document.getElementById("verificationStatus");
  const statusBadge = document.getElementById("statusBadge");

  function loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);

      if (!saved) {
        return {
          configured: false
        };
      }

      const parsed = JSON.parse(saved);

      return {
        configured: Boolean(parsed?.configured)
      };
    } catch {
      return {
        configured: false
      };
    }
  }

  function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function render(state) {
    if (state.configured) {
      verificationStatus.textContent = "Configured";
      statusBadge.textContent = "On";
      statusBadge.classList.add("active");
      setupButton.textContent = "Manage two-step verification";
    } else {
      verificationStatus.textContent = "Not configured";
      statusBadge.textContent = "Off";
      statusBadge.classList.remove("active");
      setupButton.textContent = "Set up two-step verification";
    }
  }

  function openDialog() {
    setupDialog.hidden = false;
  }

  function closeDialog() {
    setupDialog.hidden = true;
  }

  function showUnavailableMessage() {
    openDialog();
  }

  setupButton?.addEventListener("click", showUnavailableMessage);

  recoveryButton?.addEventListener("click", function () {
    window.alert(
      "Recovery management will be available when the secure two-step verification backend is connected."
    );
  });

  closeDialogButton?.addEventListener("click", closeDialog);

  setupDialog?.addEventListener("click", function (event) {
    if (event.target.hasAttribute("data-close-dialog")) {
      closeDialog();
    }
  });

  const state = loadState();

  /*
   * The configured flag is intentionally not changed by this page.
   * Real activation must happen through the authenticated backend flow.
   */
  saveState(state);
  render(state);
})();
