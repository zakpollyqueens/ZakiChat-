(function () {
  "use strict";

  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("../service-worker.js", {
        scope: "../"
      })
      .then(registration => {
        console.log(
          "ZakiChat service worker registered:",
          registration.scope
        );
      })
      .catch(error => {
        console.error(
          "ZakiChat service worker registration failed:",
          error
        );
      });
  });
})();
