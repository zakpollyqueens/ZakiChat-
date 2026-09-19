(function () {
  "use strict";

  const STORAGE_KEY = "zakichat_blocked_users";
  const list = document.getElementById("blockedUsersList");

  function loadBlockedUsers() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : [];

      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveBlockedUsers(users) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
  }

  function getInitial(name) {
    const value = String(name || "").trim();

    return value ? value.charAt(0).toUpperCase() : "?";
  }

  function renderBlockedUsers() {
    const users = loadBlockedUsers();

    list.innerHTML = "";

    if (!users.length) {
      const empty = document.createElement("div");
      empty.className = "empty-blocked-users";
      empty.textContent = "You have not blocked anyone yet.";
      list.appendChild(empty);
      return;
    }

    users.forEach((user) => {
      const item = document.createElement("div");
      item.className = "blocked-user";

      const avatar = document.createElement("div");
      avatar.className = "blocked-avatar";
      avatar.textContent = getInitial(user.name);

      const info = document.createElement("div");
      info.className = "blocked-user-info";

      const name = document.createElement("strong");
      name.textContent = user.name || "Unknown user";

      const identifier = document.createElement("small");
      identifier.textContent = user.identifier || "ZakiChat user";

      info.appendChild(name);
      info.appendChild(identifier);

      const unblockButton = document.createElement("button");
      unblockButton.type = "button";
      unblockButton.className = "unblock-button";
      unblockButton.textContent = "Unblock";

      unblockButton.addEventListener("click", function () {
        unblockUser(user.id);
      });

      item.appendChild(avatar);
      item.appendChild(info);
      item.appendChild(unblockButton);

      list.appendChild(item);
    });
  }

  function unblockUser(id) {
    const users = loadBlockedUsers();
    const updated = users.filter((user) => user.id !== id);

    saveBlockedUsers(updated);
    renderBlockedUsers();
  }

  renderBlockedUsers();
})();
