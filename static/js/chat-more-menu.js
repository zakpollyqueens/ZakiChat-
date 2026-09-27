document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const wrapper = document.getElementById("chat-more-wrapper");
  const button = document.getElementById("chat-more-button");
  const menu = document.getElementById("chat-more-menu");
  const searchButton = document.getElementById("search-chat-button");

  if (!wrapper || !button || !menu) return;

  const BLOCKED_USERS_KEY = "zakichat_blocked_users";

  function closeMenu() {
    menu.hidden = true;
    button.setAttribute("aria-expanded", "false");
  }

  function openMenu() {
    menu.hidden = false;
    button.setAttribute("aria-expanded", "true");
  }

  function getChatUserId() {
    return String(
      new URLSearchParams(window.location.search).get("user") || ""
    ).trim();
  }

  function loadBlockedUsers() {
    try {
      const saved = JSON.parse(
        localStorage.getItem(BLOCKED_USERS_KEY) || "[]"
      );
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  }

  function saveBlockedUsers(users) {
    localStorage.setItem(
      BLOCKED_USERS_KEY,
      JSON.stringify(users)
    );
  }

  function blockCurrentUser() {
    const userId = getChatUserId();

    if (!userId) {
      alert("Unable to identify this contact.");
      return;
    }

    const name =
      document.querySelector(".chat-user strong")?.textContent?.trim() ||
      "this contact";

    if (!window.confirm(`Block ${name}?`)) return;

    const blockedUsers = loadBlockedUsers();

    if (!blockedUsers.some(user => String(user?.id || "") === userId)) {
      blockedUsers.push({
        id: userId,
        name,
        identifier: userId
      });

      saveBlockedUsers(blockedUsers);
    }

    window.location.href = "blocked-users.html";
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

      const userId = getChatUserId();

      if (userId) {
        window.location.href =
          `profile.html?user=${encodeURIComponent(userId)}`;
      }

      return;
    }

    if (action === "block") {
      closeMenu();
      blockCurrentUser();
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
      alert("Wallpaper and theme settings will be available here.");
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
      alert("Export chat will be connected here.");
      return;
    }

    if (action === "report") {
      closeMenu();

      const userId = getChatUserId();

      if (userId) {
        window.location.href =
          `contact-support.html?category=Report%20a%20user&subject=${encodeURIComponent(
            `Report ZakiChat user ${userId}`
          )}`;
      }

      return;
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
