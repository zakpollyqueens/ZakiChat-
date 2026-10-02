(function () {
  "use strict";

  const db = window.ZakiChatAuth?.client;

  if (!db) {
    console.error(
      "ZakiChat notifications: Supabase client unavailable."
    );
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const userId = String(params.get("user") || "").trim();

  const nameEl =
    document.getElementById("notificationName");

  const usernameEl =
    document.getElementById("notificationUsername");

  const avatarEl =
    document.getElementById("notificationAvatar");

  const initialsEl =
    document.getElementById("notificationInitials");

  const enabledEl =
    document.getElementById("notificationsEnabled");

  const soundEl =
    document.getElementById("soundEnabled");

  const vibrationEl =
    document.getElementById("vibrationEnabled");

  const previewEl =
    document.getElementById("previewEnabled");

  const statusEl =
    document.getElementById("notificationStatus");

  const messageEl =
    document.getElementById("notificationMessage");

  let currentUser = null;
  let conversationId = null;

  function storageKey(name) {
    return `zakichat:chat-notifications:${currentUser?.id || "unknown"}:${userId}:${name}`;
  }

  function getInitials(fullName, username) {
    const value =
      String(fullName || username || "?")
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
          getInitials(
            profile.full_name,
            profile.username
          );

        avatarEl.appendChild(fallback);
      };

      avatarEl.appendChild(image);
      return;
    }

    initialsEl.textContent =
      getInitials(
        profile.full_name,
        profile.username
      );

    avatarEl.appendChild(initialsEl);
  }

  function showMessage(text) {
    messageEl.textContent = text;
    messageEl.hidden = false;

    clearTimeout(showMessage.timer);

    showMessage.timer =
      setTimeout(() => {
        messageEl.hidden = true;
      }, 2200);
  }

  function updateStatus() {
    statusEl.textContent =
      enabledEl.checked
        ? "Notifications are enabled"
        : "Notifications are disabled";
  }

  function loadLocalPreferences() {
    const sound =
      localStorage.getItem(storageKey("sound"));

    const vibration =
      localStorage.getItem(storageKey("vibration"));

    const preview =
      localStorage.getItem(storageKey("preview"));

    if (sound !== null) {
      soundEl.checked = sound === "true";
    }

    if (vibration !== null) {
      vibrationEl.checked =
        vibration === "true";
    }

    if (preview !== null) {
      previewEl.checked =
        preview === "true";
    }
  }

  function saveLocal(name, value) {
    localStorage.setItem(
      storageKey(name),
      String(value)
    );
  }

  async function findConversation() {
    const { data, error } =
      await db.rpc(
        "get_or_create_direct_conversation",
        {
          p_other_user_id: userId
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
      return data[0]?.conversation_id || data[0]?.id || null;
    }

    return data?.conversation_id || data?.id || null;
  }

  async function loadSettings() {
    if (!conversationId || !currentUser) return;

    const { data, error } =
      await db
        .from("conversation_user_settings")
        .select(
          "notifications_enabled"
        )
        .eq(
          "conversation_id",
          conversationId
        )
        .eq(
          "user_id",
          currentUser.id
        )
        .maybeSingle();

    if (error) {
      console.error(
        "ZakiChat notification settings:",
        error
      );
      return;
    }

    if (data) {
      enabledEl.checked =
        data.notifications_enabled !== false;
    } else {
      enabledEl.checked = true;
    }

    updateStatus();
    loadLocalPreferences();
  }

  async function saveNotificationsEnabled() {
    if (!conversationId || !currentUser) {
      showMessage(
        "Conversation is not ready yet."
      );
      return;
    }

    const enabled =
      enabledEl.checked;

    const { error } =
      await db
        .from("conversation_user_settings")
        .upsert(
          {
            conversation_id: conversationId,
            user_id: currentUser.id,
            notifications_enabled: enabled,
            updated_at: new Date().toISOString()
          },
          {
            onConflict:
              "conversation_id,user_id"
          }
        );

    if (error) {
      console.error(
        "ZakiChat notification update:",
        error
      );

      enabledEl.checked = !enabled;
      updateStatus();

      showMessage(
        "Could not update notifications."
      );

      return;
    }

    updateStatus();

    showMessage(
      enabled
        ? "Chat notifications enabled."
        : "Chat notifications disabled."
    );
  }

  async function loadProfile() {
    const { data: profile, error } =
      await db
        .from("profiles")
        .select(
          "id,username,full_name,avatar_url"
        )
        .eq("id", userId)
        .maybeSingle();

    if (error || !profile) {
      nameEl.textContent =
        "Contact unavailable";

      usernameEl.textContent = "";
      return;
    }

    const displayName =
      profile.full_name ||
      profile.username ||
      "ZakiChat User";

    nameEl.textContent =
      displayName;

    usernameEl.textContent =
      "@" +
      (profile.username || "username");

    renderAvatar(profile);

    document.title =
      `${displayName} | Notifications`;
  }

  async function init() {
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

    currentUser =
      sessionData.session.user;

    await loadProfile();

    conversationId =
      await findConversation();

    await loadSettings();
  }

  enabledEl.addEventListener(
    "change",
    saveNotificationsEnabled
  );

  soundEl.addEventListener(
    "change",
    () => {
      saveLocal(
        "sound",
        soundEl.checked
      );

      showMessage(
        soundEl.checked
          ? "Notification sound enabled."
          : "Notification sound disabled."
      );
    }
  );

  vibrationEl.addEventListener(
    "change",
    () => {
      saveLocal(
        "vibration",
        vibrationEl.checked
      );

      showMessage(
        vibrationEl.checked
          ? "Vibration enabled."
          : "Vibration disabled."
      );
    }
  );

  previewEl.addEventListener(
    "change",
    () => {
      saveLocal(
        "preview",
        previewEl.checked
      );

      showMessage(
        previewEl.checked
          ? "Message previews enabled."
          : "Message previews disabled."
      );
    }
  );

  init();
})();
