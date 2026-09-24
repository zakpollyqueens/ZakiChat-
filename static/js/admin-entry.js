(function () {
  "use strict";

  const trigger = document.getElementById("admin-secret-trigger");
  if (!trigger) return;

  let taps = 0;
  let timer = null;

  trigger.addEventListener("click", function () {
    taps += 1;

    clearTimeout(timer);

    timer = setTimeout(function () {
      taps = 0;
    }, 2500);

    if (taps >= 7) {
      taps = 0;
      window.location.href = "admin.html";
    }
  });
})();
