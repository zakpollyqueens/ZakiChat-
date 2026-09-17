document.addEventListener("DOMContentLoaded", async () => {
  "use strict";

  if (!window.supabase || !window.ZakiChatConfig) {
    console.error(
      "ZakiChat: Supabase configuration unavailable."
    );
    return;
  }

  const list =
    document.querySelector("#conversation-list");

  if (!list) {
    console.error(
      "ZakiChat: conversation list not found."
    );
    return;
  }

  const db =
    window.supabase.createClient(
      window.ZakiChatConfig.supabaseUrl,
      window.ZakiChatConfig.supabaseKey
    );

  if (window.ZakiRealtime) {
    window.ZakiRealtime.init(
      window.ZakiChatConfig
    );
  }

  let currentUser = null;
  let refreshTimer = null;
  let refreshing = false;
  let refreshAgain = false;
  let destroyed = false;

  function initials(conversation) {
    const name =
      window.ZakiConversations
        .getDisplayName(conversation);

    return (
      name
        .split(/\s+/)
        .slice(0, 2)
        .map(word =>
          word.charAt(0).toUpperCase()
        )
        .join("") || "Z"
    );
  }

  function renderAvatar(conversation) {
    const avatar =
      document.createElement("div");

    avatar.className =
      "conversation-avatar";

    const url =
      window.ZakiConversations
        .getAvatar(conversation);

    if (url) {
      avatar.style.backgroundImage =
        `url("${url}")`;
      avatar.style.backgroundSize =
        "cover";
      avatar.style.backgroundPosition =
        "center";
      avatar.setAttribute(
        "aria-hidden",
        "true"
      );
    } else {
      avatar.textContent =
        initials(conversation);
    }

    if (
      conversation.type === "group"
    ) {
      avatar.classList.add(
        "group-avatar"
      );
    }

    return avatar;
  }

  function renderConversation(
    conversation
  ) {
    const link =
      document.createElement("a");

    const destination =
      conversation.type === "group"
        ? `group.html?id=${encodeURIComponent(
            conversation.id
          )}`
        : `chats.html?user=${encodeURIComponent(
            conversation.profile?.id || ""
          )}`;

    link.href = destination;
    link.className = "conversation";

    if (
      conversation.profile?.is_online
    ) {
      link.dataset.online = "true";
    }

    if (
      window.ZakiConversations
        .selectedConversationId ===
      conversation.id
    ) {
      link.classList.add("active");
    }

    const avatar =
      renderAvatar(conversation);

    const info =
      document.createElement("div");

    info.className =
      "conversation-info";

    const firstLine =
      document.createElement("div");

    firstLine.className =
      "conversation-line";

    const name =
      document.createElement("strong");

    name.textContent =
      window.ZakiConversations
        .getDisplayName(
          conversation
        );

    const time =
      document.createElement("time");

    time.textContent =
      window.ZakiConversations
        .getTime(conversation);

    firstLine.appendChild(name);
    firstLine.appendChild(time);

    const secondLine =
      document.createElement("div");

    secondLine.className =
      "conversation-line";

    const preview =
      document.createElement("span");

    preview.className =
      "conversation-preview";

    preview.textContent =
      window.ZakiConversations
        .getPreview(conversation);

    secondLine.appendChild(preview);

    if (
      conversation.unreadCount > 0
    ) {
      const badge =
        document.createElement("span");

      badge.className =
        "unread-badge";

      badge.textContent =
        conversation.unreadCount > 99
          ? "99+"
          : String(
              conversation.unreadCount
            );

      badge.setAttribute(
        "aria-label",
        `${conversation.unreadCount} unread messages`
      );

      secondLine.appendChild(badge);
    }

    info.appendChild(firstLine);
    info.appendChild(secondLine);

    link.appendChild(avatar);
    link.appendChild(info);

    link.addEventListener(
      "click",
      () => {
        window.ZakiConversations.select(
          conversation.id
        );
      }
    );

    return link;
  }

  function render(conversations) {
    list.innerHTML = "";

    if (!conversations.length) {
      const empty =
        document.createElement("div");

      empty.className =
        "conversation-empty";

      empty.textContent =
        "No conversations yet.";

      list.appendChild(empty);

      return;
    }

    conversations.forEach(
      conversation => {
        list.appendChild(
          renderConversation(
            conversation
          )
        );
      }
    );
  }

  async function refresh() {
    if (
      destroyed ||
      !currentUser
    ) {
      return;
    }

    if (refreshing) {
      refreshAgain = true;
      return;
    }

    refreshing = true;

    try {
      const {
        data,
        error
      } =
        await window.ZakiConversations
          .load();

      if (error) {
        console.error(
          "ZakiChat conversation refresh:",
          error
        );
        return;
      }

      if (!destroyed) {
        render(data || []);
      }
    } catch (error) {
      console.error(
        "ZakiChat conversation refresh failed:",
        error
      );
    } finally {
      refreshing = false;

      if (
        refreshAgain &&
        !destroyed
      ) {
        refreshAgain = false;
        scheduleRefresh();
      }
    }
  }

  function scheduleRefresh() {
    if (destroyed) {
      return;
    }

    clearTimeout(refreshTimer);

    refreshTimer =
      setTimeout(() => {
        refreshTimer = null;
        refresh();
      }, 250);
  }

  function subscribeToRealtime() {
    if (
      !currentUser ||
      !window.ZakiRealtime
    ) {
      return;
    }

    /*
     * Message changes affect:
     * - latest message
     * - preview
     * - time
     * - unread count
     */
    window.ZakiRealtime.subscribeToAllMessages(
      () => {
        scheduleRefresh();
      }
    );

    /*
     * Membership changes affect which
     * conversations belong to this user.
     */
    window.ZakiRealtime.subscribe(
      "conversation-list-members",
      "conversation_members",
      `user_id=eq.${currentUser.id}`,
      () => {
        scheduleRefresh();
      },
      "*"
    );

    /*
     * Conversation metadata changes affect:
     * - title
     * - avatar
     * - updated_at
     */
    window.ZakiRealtime.subscribe(
      "conversation-list-conversations",
      "conversations",
      null,
      () => {
        scheduleRefresh();
      },
      "*"
    );
  }

  async function load() {
    const {
      data: {
        user
      }
    } =
      await db.auth.getUser();

    currentUser =
      user || null;

    if (!currentUser) {
      list.innerHTML = "";

      const notice =
        document.createElement("div");

      notice.className =
        "conversation-empty";

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
    } =
      await window.ZakiConversations
        .load();

    if (error) {
      console.error(
        "ZakiChat conversations:",
        error
      );

      list.innerHTML = "";

      const notice =
        document.createElement("div");

      notice.className =
        "conversation-empty";

      notice.textContent =
        "Unable to load conversations.";

      list.appendChild(notice);

      return;
    }

    render(data || []);

    subscribeToRealtime();
  }

  function cleanup() {
    if (destroyed) {
      return;
    }

    destroyed = true;

    clearTimeout(refreshTimer);

    refreshTimer = null;
    refreshAgain = false;

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
  }

  await load();

  window.addEventListener(
    "beforeunload",
    cleanup
  );
});
