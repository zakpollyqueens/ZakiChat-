(function () {
  "use strict";

  const root = document.querySelector(".zc-chat-v2");
  if (!root) return;

  const menu = document.getElementById("chat-more-menu");
  const moreButton = document.getElementById("chat-more-button");

  function closeMenu() {
    if (!menu) return;

    menu.hidden = true;

    moreButton?.setAttribute(
      "aria-expanded",
      "false"
    );
  }

  document.addEventListener("click", event => {
    if (
      menu &&
      !menu.contains(event.target) &&
      !moreButton?.contains(event.target)
    ) {
      closeMenu();
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      closeMenu();
    }
  });

  window.ZakiChatV2 = {
    closeMenu
  };
})();
