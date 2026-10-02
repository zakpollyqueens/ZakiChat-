(function () {
  "use strict";

  const db = window.ZakiChatAuth?.client;

  if (!db) {
    console.error("ZakiChat contact info: Supabase client unavailable.");
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const userId = String(params.get("user") || "").trim();

  const avatar = document.getElementById("contactAvatar");
  const initials = document.getElementById("contactInitials");
  const name = document.getElementById("contactName");
  const username = document.getElementById("contactUsername");
  const phone = document.getElementById("contactPhone");
  const handle = document.getElementById("contactHandle");
  const location = document.getElementById("contactLocation");
  const bio = document.getElementById("contactBio");
  const presence = document.getElementById("contactPresence");

  function getInitials(fullName, userName) {
    const value = String(fullName || userName || "?")
      .replace(/^@/, "")
      .trim();

    const parts = value.split(/\s+/).filter(Boolean);

    if (parts.length > 1) {
      return (
        parts[0][0] +
        parts[1][0]
      ).toUpperCase();
    }

    return value.slice(0, 2).toUpperCase() || "?";
  }

  function renderAvatar(profile) {
    avatar.replaceChildren();

    if (profile.avatar_url) {
      const image = document.createElement("img");
      image.src = profile.avatar_url;
      image.alt = profile.full_name || profile.username || "Contact";
      image.onerror = function () {
        avatar.replaceChildren();
        const fallback = document.createElement("span");
        fallback.textContent =
          getInitials(profile.full_name, profile.username);
        avatar.appendChild(fallback);
      };
      avatar.appendChild(image);
      return;
    }

    const fallback = document.createElement("span");
    fallback.textContent =
      getInitials(profile.full_name, profile.username);
    avatar.appendChild(fallback);
  }

  function renderPresence(profile) {
    const online = Boolean(profile.is_online);
    presence.classList.toggle("online", online);

    const label = presence.querySelector("span");
    if (label) {
      label.textContent = online
        ? "Online"
        : "Offline";
    }
  }

  function openPage(page) {
    if (!userId) {
      window.location.href = "chats.html";
      return;
    }

    window.location.href =
      `${page}?user=${encodeURIComponent(userId)}`;
  }

  async function load() {
    if (!userId) {
      window.location.replace("chats.html");
      return;
    }

    const { data: sessionData } =
      await db.auth.getSession();

    if (!sessionData?.session) {
      window.location.replace("login.html");
      return;
    }

    const { data: profile, error } =
      await db
        .from("profiles")
        .select(
          "id,username,full_name,phone,avatar_url,bio,is_online,last_seen,location"
        )
        .eq("id", userId)
        .maybeSingle();

    if (error) {
      console.error("Contact info load failed:", error);
      name.textContent = "Unable to load contact";
      username.textContent = "";
      return;
    }

    if (!profile) {
      name.textContent = "Contact not found";
      username.textContent = "";
      return;
    }

    const displayName =
      profile.full_name ||
      profile.username ||
      "ZakiChat User";

    const userName =
      profile.username ||
      "username";

    name.textContent = displayName;
    username.textContent = "@" + userName;
    handle.textContent = "@" + userName;
    phone.textContent =
      profile.phone || "Not available";
    location.textContent =
      profile.location || "Not available";
    bio.textContent =
      profile.bio || "No bio available.";

    renderAvatar(profile);
    renderPresence(profile);

    document.title =
      `${displayName} | Contact Info`;
  }

  document
    .querySelectorAll("[data-info-page]")
    .forEach(button => {
      button.addEventListener("click", () => {
        const page = button.dataset.infoPage;

        const pages = {
          media: "media.html",
          notifications: "chat-notifications.html",
          disappearing: "disappearing-messages.html",
          theme: "chat-theme.html",
          starred: "starred-messages.html"
        };

        if (pages[page]) {
          openPage(pages[page]);
        }
      });
    });

  document.getElementById("infoMessageButton").href =
    userId
      ? `chat.html?user=${encodeURIComponent(userId)}`
      : "chats.html";

  document.getElementById("infoCallButton").href =
    userId
      ? `chat.html?user=${encodeURIComponent(userId)}#call`
      : "chats.html";

  document.getElementById("infoVideoButton").href =
    userId
      ? `chat.html?user=${encodeURIComponent(userId)}#video`
      : "chats.html";

  document
    .getElementById("reportContactButton")
    .addEventListener("click", () => {
      if (!userId) return;

      window.location.href =
        `contact-support.html?category=Report%20a%20user&subject=${
          encodeURIComponent(
            `Report ZakiChat user ${userId}`
          )
        }`;
    });

  document
    .getElementById("blockContactButton")
    .addEventListener("click", async () => {
      if (!userId) return;

      const { data } =
        await db.auth.getUser();

      const currentUser = data?.user;

      if (!currentUser) {
        alert("Please sign in again.");
        return;
      }

      if (currentUser.id === userId) {
        alert("You cannot block yourself.");
        return;
      }

      if (!window.confirm(
        `Block ${name.textContent}?`
      )) {
        return;
      }

      const { error } =
        await db
          .from("blocked_users")
          .upsert(
            {
              blocker_id: currentUser.id,
              blocked_id: userId
            },
            {
              onConflict:
                "blocker_id,blocked_id"
            }
          );

      if (error) {
        console.error(
          "Block contact failed:",
          error
        );

        alert(
          "Unable to block this contact right now."
        );
        return;
      }

      window.location.href =
        "blocked-users.html";
    });

  load();
})();
