document.addEventListener("DOMContentLoaded", async () => {
  if (!window.supabase || !window.ZakiChatConfig) {
    console.error("ZakiChat: Supabase configuration unavailable.");
    return;
  }

  const list = document.querySelector("#conversation-list");

  if (!list) {
    console.error("ZakiChat: conversation list not found.");
    return;
  }

  const db = window.supabase.createClient(
    window.ZakiChatConfig.supabaseUrl,
    window.ZakiChatConfig.supabaseKey
  );

  window.ZakiRealtime.init(
    window.ZakiChatConfig
  );

  let currentUser = null;
  let refreshTimer = null;
  let refreshing = false;

  function initials(conversation) {
    const name =
      window.ZakiConversations.getDisplayName(conversation);

    return name
      .split(/\s+/)
      .slice(0, 2)
      .map(word => word.charAt(0).toUpperCase())
      .join("") || "Z";
  }

  function renderAvatar(conversation) {
    const avatar = document.createElement("div");

    avatar.className = "conversation-avatar";

    const url =
      window.ZakiConversations.getAvatar(conversation);

    if (url) {
      avatar.style.backgroundImage = `url("${url}")`;
      avatar.style.backgroundSize = "cover";
      avatar.style.backgroundPosition = "center";
    } else {
      avatar.textContent = initials(conversation);
    }

    if (conversation.type === "group") {
      avatar.classList.add("group-avatar");
    }

    return avatar;
  }

  function renderConversation(conversation) {
    const link = document.createElement("a");

    link.href =
      conversation.type === "group"
        ? `group.html?id=${encodeURIComponent(conversation.id)}`
        : `chats.html?user=${encodeURIComponent(
            conversation.profile?.id || ""
          )}`;

    link.className = "conversation";

    if (conversation.profile?.is_online) {
      link.dataset.online = "true";
    }

    const avatar = renderAvatar(conversation);

    const info = document.createElement("div");
    info.className = "conversation-info";

    const firstLine = document.createElement("div");
    firstLine.className = "conversation-line";

    const name = document.createElement("strong");

    name.textContent =
      window.ZakiConversations.getDisplayName(
        conversation
      );

    const time = document.createElement("span");

    time.textContent =
      window.ZakiConversations.getTime(
        conversation
      );

    firstLine.appendChild(name);
    firstLine.appendChild(time);

    const secondLine = document.createElement("div");
    secondLine.className = "conversation-line";

    const preview = document.createElement("span");

    preview.className = "conversation-preview";

    preview.textContent =
      window.ZakiConversations.getPreview(
        conversation
      );

    secondLine.appendChild(preview);

    if (conversation.unreadCount > 0) {
      const badge = document.createElement("span");

      badge.className = "unread-badge";

      badge.textContent =
        conversation.unreadCount > 99
          ? "99+"
          : String(conversation.unreadCount);

      secondLine.appendChild(badge);
    }

    info.appendChild(firstLine);
    info.appendChild(secondLine);

    link.appendChild(avatar);
    link.appendChild(info);

    link.addEventListener("click", () => {
      window.ZakiConversations.select(
        conversation.id
      );
    });

    return link;
  }

  function render(conversations) {
    list.innerHTML = "";

    if (!conversations.length) {
      const empty = document.createElement("div");

      empty.className = "conversation-empty";
      empty.textContent = "No conversations yet.";

      list.appendChild(empty);
      return;
    }

    conversations.forEach(conversation => {
      list.appendChild(
        renderConversation(conversation)
      );
    });
  }

  async function refresh() {
    if (!currentUser || refreshing) {
      return;
    }

    refreshing = true;

    try {
      const {
        data,
        error
      } = await window.ZakiConversations.load();

      if (error) {
        console.error(
          "ZakiChat conversation refresh:",
          error
        );
        return;
      }

      render(data || []);
    } catch (error) {
      console.error(
        "ZakiChat conversation refresh failed:",
        error
      );
    } finally {
      refreshing = false;
    }
  }

  function scheduleRefresh() {
    clearTimeout(refreshTimer);

    refreshTimer = setTimeout(() => {
      refresh();
    }, 250);
  }

  function subscribeToRealtime() {
    if (!currentUser || !window.ZakiRealtime) {
      return;
    }

    window.ZakiRealtime.subscribeToAllMessages(
      () => {
        scheduleRefresh();
      }
    );

    window.ZakiRealtime.subscribe(
      "conversation-list-members",
      "conversation_members",
      `user_id=eq.${currentUser.id}`,
      () => {
        scheduleRefresh();
      }
    );

    window.ZakiRealtime.subscribe(
      "conversation-list-conversations",
      "conversations",
      "*",
      () => {
        scheduleRefresh();
      }
    );
  }

  async function load() {
    const {
      data: {
        user
      }
    } = await db.auth.getUser();

    currentUser = user || null;

    if (!currentUser) {
      list.innerHTML = "";

      const notice = document.createElement("div");

      notice.className = "conversation-empty";
      notice.textContent =
        "Please sign in to view your conversations.";

      list.appendChild(notice);
      return;
    }

    window.ZakiConversations.init(
      window.ZakiChatConfig,
      currentUser
    );

    const {
      data,
      error
    } = await window.ZakiConversations.load();

    if (error) {
      console.error(
        "ZakiChat conversations:",
        error
      );

      list.innerHTML = "";

      const notice = document.createElement("div");

      notice.className = "conversation-empty";
      notice.textContent =
        "Unable to load conversations.";

      list.appendChild(notice);
      return;
    }

    render(data || []);

    subscribeToRealtime();
  }

  await load();

  window.addEventListener("beforeunload", () => {
    clearTimeout(refreshTimer);

    if (window.ZakiRealtime) {
      window.ZakiRealtime.unsubscribe(
        "messages:all"
      );

      window.ZakiRealtime.unsubscribe(
        "conversation-list-members"
      );

      window.ZakiRealtime.unsubscribe(
        "conversation-list-conversations"
      );
    }
  });
});
