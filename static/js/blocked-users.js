(function () {
  "use strict";

  const list =
    document.getElementById("blockedUsersList");

  const openButton =
    document.getElementById("openBlockUser");

  const db =
    window.ZakiChatAuth?.client;

  let currentUser = null;

  function getInitial(name) {
    const value =
      String(name || "").trim();

    return value
      ? value.charAt(0).toUpperCase()
      : "?";
  }

  async function getCurrentUser() {
    if (!db) return null;

    const {
      data,
      error
    } = await db.auth.getUser();

    if (error) {
      console.error(
        "ZakiChat blocked users auth:",
        error
      );
      return null;
    }

    return data?.user || null;
  }

  async function getProfile(userId) {
    if (!db || !userId) return null;

    const { data } =
      await db
        .from("profiles")
        .select(
          "id, full_name, username, phone"
        )
        .eq("id", userId)
        .maybeSingle();

    return data || null;
  }

  function displayName(profile, userId) {
    return (
      profile?.full_name ||
      profile?.username ||
      profile?.phone ||
      "ZakiChat user"
    );
  }

  function displayIdentifier(profile, userId) {
    return (
      profile?.phone ||
      (profile?.username
        ? `@${profile.username}`
        : userId)
    );
  }

  async function loadBlockedUsers() {
    if (!db || !currentUser || !list) {
      return [];
    }

    const {
      data,
      error
    } = await db
      .from("blocked_users")
      .select(
        "id, blocked_id, created_at"
      )
      .eq(
        "blocker_id",
        currentUser.id
      )
      .order("created_at", {
        ascending: false
      });

    if (error) {
      console.error(
        "ZakiChat blocked users load:",
        error
      );

      list.innerHTML = "";

      const message =
        document.createElement("div");

      message.className =
        "empty-blocked-users";

      message.textContent =
        "Unable to load blocked users.";

      list.appendChild(message);

      return [];
    }

    return data || [];
  }

  async function renderBlockedUsers() {
    if (!list) return;

    const blocked =
      await loadBlockedUsers();

    list.innerHTML = "";

    if (!blocked.length) {
      const empty =
        document.createElement("div");

      empty.className =
        "empty-blocked-users";

      empty.textContent =
        "You have not blocked anyone yet.";

      list.appendChild(empty);

      return;
    }

    for (const entry of blocked) {
      const profile =
        await getProfile(
          entry.blocked_id
        );

      const name =
        displayName(
          profile,
          entry.blocked_id
        );

      const item =
        document.createElement("div");

      item.className =
        "blocked-user";

      const avatar =
        document.createElement("div");

      avatar.className =
        "blocked-avatar";

      avatar.textContent =
        getInitial(name);

      const info =
        document.createElement("div");

      info.className =
        "blocked-user-info";

      const nameElement =
        document.createElement("strong");

      nameElement.textContent =
        name;

      const identifier =
        document.createElement("small");

      identifier.textContent =
        displayIdentifier(
          profile,
          entry.blocked_id
        );

      info.appendChild(
        nameElement
      );

      info.appendChild(
        identifier
      );

      const unblockButton =
        document.createElement("button");

      unblockButton.type =
        "button";

      unblockButton.className =
        "unblock-button";

      unblockButton.textContent =
        "Unblock";

      unblockButton.addEventListener(
        "click",
        function () {
          unblockUser(
            entry.blocked_id,
            name
          );
        }
      );

      item.appendChild(avatar);
      item.appendChild(info);
      item.appendChild(
        unblockButton
      );

      list.appendChild(item);
    }
  }

  async function unblockUser(
    blockedId,
    name
  ) {
    if (!db || !currentUser) return;

    if (
      !window.confirm(
        `Unblock ${name}?`
      )
    ) {
      return;
    }

    const { error } =
      await db
        .from("blocked_users")
        .delete()
        .eq(
          "blocker_id",
          currentUser.id
        )
        .eq(
          "blocked_id",
          blockedId
        );

    if (error) {
      console.error(
        "ZakiChat unblock user:",
        error
      );

      alert(
        "Unable to unblock this user."
      );

      return;
    }

    await renderBlockedUsers();
  }

  async function blockUserFromPage() {
    if (!db || !currentUser) return;

    const value =
      window.prompt(
        "Enter the user's ZakiChat username or phone number:"
      );

    const query =
      String(value || "").trim();

    if (!query) return;

    let profile = null;

    const byUsername =
      await db
        .from("profiles")
        .select(
          "id, full_name, username, phone"
        )
        .eq(
          "username",
          query
        )
        .maybeSingle();

    if (!byUsername.error) {
      profile = byUsername.data;
    }

    if (!profile) {
      const byPhone =
        await db
          .from("profiles")
          .select(
            "id, full_name, username, phone"
          )
          .eq(
            "phone",
            query
          )
          .maybeSingle();

      if (!byPhone.error) {
        profile = byPhone.data;
      }
    }

    if (!profile) {
      alert(
        "No ZakiChat user was found with that username or phone number."
      );
      return;
    }

    if (
      profile.id ===
      currentUser.id
    ) {
      alert(
        "You cannot block your own account."
      );
      return;
    }

    const { error } =
      await db
        .from("blocked_users")
        .upsert(
          {
            blocker_id:
              currentUser.id,
            blocked_id:
              profile.id
          },
          {
            onConflict:
              "blocker_id,blocked_id"
          }
        );

    if (error) {
      console.error(
        "ZakiChat block user:",
        error
      );

      alert(
        "Unable to block this user."
      );

      return;
    }

    await renderBlockedUsers();
  }

  async function init() {
    if (!db) {
      console.error(
        "ZakiChat Blocked Users: centralized Supabase client unavailable."
      );
      return;
    }

    currentUser =
      await getCurrentUser();

    if (!currentUser) {
      return;
    }

    openButton?.addEventListener(
      "click",
      blockUserFromPage
    );

    await renderBlockedUsers();
  }

  document.addEventListener(
    "DOMContentLoaded",
    init
  );
})();
