(function () {
  "use strict";

  const version =
    document.getElementById("current-version");

  if (!version) return;

  let taps = 0;
  let timer = null;

  version.addEventListener("click", function () {

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
