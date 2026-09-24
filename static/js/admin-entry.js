(function () {
  "use strict";

  function initAdminEntry() {
    const trigger = document.getElementById("admin-secret-trigger");
    if (!trigger || trigger.dataset.adminEntryReady === "true") return;

    trigger.dataset.adminEntryReady = "true";

    let taps = 0;
    let timer = null;

    function resetTaps() {
      taps = 0;
      timer = null;
    }

    function registerTap(event) {
      if (
        event.type === "keydown" &&
        event.key !== "Enter" &&
        event.key !== " "
      ) {
        return;
      }

      if (event.type === "keydown") {
        event.preventDefault();
      }

      taps += 1;

      clearTimeout(timer);
      timer = setTimeout(resetTaps, 5000);

      if (taps === 7) {
        clearTimeout(timer);
        resetTaps();
        window.location.href = "admin.html";
      }
    }

    trigger.addEventListener("click", registerTap);
    trigger.addEventListener("keydown", registerTap);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAdminEntry);
  } else {
    initAdminEntry();
  }
})();
