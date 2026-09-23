document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const wrapper = document.getElementById("chat-more-wrapper");
  const button = document.getElementById("chat-more-button");
  const menu = document.getElementById("chat-more-menu");
  const searchButton = document.getElementById("search-chat-button");

  if (!wrapper || !button || !menu) return;

  function closeMenu() {
    menu.hidden = true;
    button.setAttribute("aria-expanded", "false");
  }

  function openMenu() {
    menu.hidden = false;
    button.setAttribute("aria-expanded", "true");
  }

  button.addEventListener("click", event => {
    event.stopPropagation();

    if (menu.hidden) {
      openMenu();
    } else {
      closeMenu();
    }
  });

  menu.addEventListener("click", event => {
    event.stopPropagation();

    const item = event.target.closest("[data-chat-action]");
    if (!item) return;

    const action = item.dataset.chatAction;

    if (action === "search") {
      closeMenu();
      searchButton?.click();
      return;
    }

    if (action === "info") {
      closeMenu();

      const params = new URLSearchParams(window.location.search);
      const userId = String(params.get("user") || "").trim();

      if (userId) {
        window.location.href =
          `profile.html?user=${encodeURIComponent(userId)}`;
      }

      return;
    }

    if (action === "media") {
      alert("Media, links and documents will be available here.");
      return;
    }

    if (action === "notifications") {
      alert("Chat notification settings will be available here.");
      return;
    }

    if (action === "disappearing") {
      alert("Disappearing message settings will be available here.");
      return;
    }

    if (action === "theme") {
      alert("Chat wallpaper and theme settings will be available here.");
      return;
    }

    if (action === "starred") {
      alert("Starred messages will be available here.");
      return;
    }

    if (action === "clear") {
      alert("Clear chat will be connected here.");
      return;
    }

    if (action === "export") {
      alert("Chat export will be connected here.");
      return;
    }

    if (action === "block") {
      alert("Block will be connected here.");
      return;
    }

    if (action === "report") {
      alert("Report will be connected here.");
    }
  });

  document.addEventListener("click", event => {
    if (!wrapper.contains(event.target)) {
      closeMenu();
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      closeMenu();
    }
  });
});
