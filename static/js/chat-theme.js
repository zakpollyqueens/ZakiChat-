(function () {
  "use strict";

  const db = window.ZakiChatAuth?.client;

  if (!db) {
    console.error(
      "ZakiChat theme: Supabase client unavailable."
    );
    return;
  }

  const params =
    new URLSearchParams(window.location.search);

  const targetUserId =
    String(params.get("user") || "").trim();

  const nameEl =
    document.getElementById("themeName");

  const usernameEl =
    document.getElementById("themeUsername");

  const avatarEl =
    document.getElementById("themeAvatar");

  const initialsEl =
    document.getElementById("themeInitials");

  const themeGrid =
    document.getElementById("themeGrid");

  const wallpaperGrid =
    document.getElementById("wallpaperGrid");

  const preview =
    document.getElementById("chatPreview");

  const messageEl =
    document.getElementById("themeMessage");

  const resetButton =
    document.getElementById("resetTheme");

  let currentUser = null;
  let conversationId = null;

  function key(name) {
    return [
      "zakichat",
      "chat-theme",
      currentUser?.id || "unknown",
      targetUserId,
      name
    ].join(":");
  }

  function initials(name, username) {
    const value =
      String(name || username || "?")
        .replace(/^@/, "")
        .trim();

    const parts =
      value.split(/\s+/).filter(Boolean);

    if (parts.length > 1) {
      return (
        parts[0][0] +
        parts[1][0]
      ).toUpperCase();
    }

    return value.slice(0, 2).toUpperCase() || "?";
  }

  function renderAvatar(profile) {
    avatarEl.replaceChildren();

    if (profile.avatar_url) {
      const image =
        document.createElement("img");

      image.src = profile.avatar_url;
      image.alt =
        profile.full_name ||
        profile.username ||
        "Contact";

      image.onerror = function () {
        avatarEl.replaceChildren();

        const fallback =
          document.createElement("span");

        fallback.textContent =
          initials(
            profile.full_name,
            profile.username
          );

        avatarEl.appendChild(fallback);
      };

      avatarEl.appendChild(image);
      return;
    }

    const fallback =
      document.createElement("span");

    fallback.textContent =
      initials(
        profile.full_name,
        profile.username
      );

    avatarEl.appendChild(fallback);
  }

  function notify(text) {
    messageEl.textContent = text;
    messageEl.hidden = false;

    clearTimeout(notify.timer);

    notify.timer =
      setTimeout(() => {
        messageEl.hidden = true;
      }, 1800);
  }

  function setActive(container, attribute, value) {
    container
      .querySelectorAll(
        `[${attribute}]`
      )
      .forEach(button => {
        button.classList.toggle(
          "active",
          button.getAttribute(attribute) === value
        );
      });
  }

  function applyTheme(theme) {
    document.documentElement.dataset.zakiChatTheme =
      theme;

    setActive(
      themeGrid,
      "data-theme",
      theme
    );
  }

  function applyWallpaper(wallpaper) {
    preview.classList.remove(
      "wallpaper-aurora",
      "wallpaper-mesh",
      "wallpaper-stars",
      "wallpaper-waves"
    );

    preview.classList.add(
      `wallpaper-${wallpaper}`
    );

    setActive(
      wallpaperGrid,
      "data-wallpaper",
      wallpaper
    );
  }

  async function findConversation() {
    const { data, error } =
      await db.rpc(
        "get_or_create_direct_conversation",
        {
          target_user_id: targetUserId
        }
      );

    if (error) {
      console.error(
        "ZakiChat conversation lookup:",
        error
      );
      return null;
    }

    if (typeof data === "string") {
      return data;
    }

    if (Array.isArray(data)) {
      return (
        data[0]?.conversation_id ||
        data[0]?.id ||
        null
      );
    }

    return (
      data?.conversation_id ||
      data?.id ||
      null
    );
  }

  async function saveWallpaper(wallpaper) {
    localStorage.setItem(
      key("wallpaper"),
      wallpaper
    );

    if (conversationId && currentUser) {
      const { error } =
        await db
          .from("conversation_user_settings")
          .upsert(
            {
              conversation_id: conversationId,
              user_id: currentUser.id,
              wallpaper,
              updated_at:
                new Date().toISOString()
            },
            {
              onConflict:
                "conversation_id,user_id"
            }
          );

      if (error) {
        console.error(
          "ZakiChat wallpaper save:",
          error
        );
      }
    }

    applyWallpaper(wallpaper);
    notify("Wallpaper updated.");
  }

  function saveTheme(theme) {
    localStorage.setItem(
      key("theme"),
      theme
    );

    applyTheme(theme);
    notify("Chat theme updated.");
  }

  async function loadPreferences() {
    const localTheme =
      localStorage.getItem(key("theme")) ||
      "aurora";

    const localWallpaper =
      localStorage.getItem(key("wallpaper"));

    let wallpaper =
      localWallpaper || "aurora";

    if (conversationId && currentUser) {
      const { data, error } =
        await db
          .from("conversation_user_settings")
          .select("wallpaper")
          .eq(
            "conversation_id",
            conversationId
          )
          .eq(
            "user_id",
            currentUser.id
          )
          .maybeSingle();

      if (!error && data?.wallpaper) {
        wallpaper = data.wallpaper;

        localStorage.setItem(
          key("wallpaper"),
          wallpaper
        );
      }
    }

    applyTheme(localTheme);
    applyWallpaper(wallpaper);
  }

  async function loadProfile() {
    const { data: profile, error } =
      await db
        .from("profiles")
        .select(
          "id,username,full_name,avatar_url"
        )
        .eq("id", targetUserId)
        .maybeSingle();

    if (error || !profile) {
      nameEl.textContent =
        "Contact unavailable";

      usernameEl.textContent = "";
      return;
    }

    const displayName =
      profile.full_name ||
      profile.username||
      "ZakiChat User";

    nameEl.textContent =
      displayName;

    usernameEl.textContent =
      "@" +
      (profile.username || "username");

    renderAvatar(profile);

    document.title =
      `${displayName} | Wallpaper & Theme`;
  }

  function resetAppearance() {
    localStorage.removeItem(
      key("theme")
    );

    localStorage.removeItem(
      key("wallpaper")
    );

    applyTheme("aurora");
    saveWallpaper("aurora");

    notify("Chat appearance reset.");
  }

  themeGrid.addEventListener(
    "click",
    event => {
      const button =
        event.target.closest(
          "[data-theme]"
        );

      if (!button) return;

      saveTheme(
        button.dataset.theme
      );
    }
  );

  wallpaperGrid.addEventListener(
    "click",
    event => {
      const button =
        event.target.closest(
          "[data-wallpaper]"
        );

      if (!button) return;

      saveWallpaper(
        button.dataset.wallpaper
      );
    }
  );

  resetButton.addEventListener(
    "click",
    resetAppearance
  );

  async function init() {
    if (!targetUserId) {
      window.location.replace(
        "chats.html"
      );
      return;
    }

    const { data } =
      await db.auth.getSession();

    if (!data?.session) {
      window.location.replace(
        "login.html"
      );
      return;
    }

    currentUser =
      data.session.user;

    await loadProfile();

    conversationId =
      await findConversation();

    await loadPreferences();
  }

  init();
})();
