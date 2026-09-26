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
    window.ZakiChatAuth?.client;

  if (!db) {
    console.error(
      "ZakiChat Conversation List: centralized Supabase client unavailable."
    );
    return;
  }

  if (window.ZakiRealtime) {
    window.ZakiRealtime.init(
      window.ZakiChatConfig
    );
  }

  let currentUser = null;
  let activeFilter = "all";
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

  function closeConversationMenus() {
    document.querySelectorAll(".conversation-action-menu").forEach((menu) => {
      menu.remove();
    });
  }

  function createConversationMenu(link, conversation) {
    const menu = document.createElement("div");
    menu.className = "conversation-action-menu";

    const items = [
      [conversation.is_pinned ? "Unpin" : "Pin", "is_pinned"],
      [conversation.is_favorite ? "Remove favorite" : "Favorite", "is_favorite"],
      [conversation.marked_unread ? "Mark read" : "Mark unread", "marked_unread"],
      [conversation.is_muted ? "Unmute" : "Mute", "is_muted"],
      [conversation.is_archived ? "Unarchive" : "Archive", "is_archived"]
    ];

    items.forEach(([label, field]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;

      button.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeConversationMenus();

        const client = window.ZakiChatAuth?.client;
        const userResult = await client?.auth.getUser();
        const user = userResult?.data?.user;

        if (!client || !user) return;

        const { error } = await client
          .from("conversation_members")
          .update({ [field]: !conversation[field] })
          .eq("conversation_id", conversation.id)
          .eq("user_id", user.id);

        if (error) {
          console.error("Conversation preference update failed:", error);
          return;
        }

        await refresh();
      });

      menu.appendChild(button);
    });

    link.appendChild(menu);
  }

  function attachConversationMenu(link, conversation) {
    let timer = null;

    link.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      closeConversationMenus();
      createConversationMenu(link, conversation);
    });

    link.addEventListener("pointerdown", () => {
      timer = setTimeout(() => {
        closeConversationMenus();
        createConversationMenu(link, conversation);
      }, 600);
    });

    ["pointerup", "pointerleave", "pointercancel"].forEach((eventName) => {
      link.addEventListener(eventName, () => {
        clearTimeout(timer);
      });
    });
  }

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".conversation-action-menu")) {
      closeConversationMenus();
    }
  });

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
        : `chat.html?user=${encodeURIComponent(
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

    attachConversationMenu(link, conversation);
    return link;
  }

  function applyFilter(conversations) {
    return conversations.filter(
      conversation => {
        if (
          conversation.is_archived
        ) {
          return false;
        }

        if (
          activeFilter === "unread"
        ) {
          return (
            conversation.unreadCount > 0 ||
            conversation.marked_unread
          );
        }

        if (
          activeFilter === "favorites"
        ) {
          return conversation.is_favorite;
        }

        if (
          activeFilter === "groups"
        ) {
          return conversation.type === "group";
        }

        return true;
      }
    );
  }

  function render(conversations) {
    list.innerHTML = "";

    const filtered =
      applyFilter(conversations);

    if (!filtered.length) {
      const empty =
        document.createElement("div");

      empty.className =
        "conversation-empty";

      empty.textContent =
        "No conversations yet.";

      list.appendChild(empty);

      return;
    }

    filtered.forEach(
      conversation => {
        list.appendChild(
          renderConversation(
            conversation
          )
        );
      }
    );
  }

  function initChatTabs() {
    const tabs =
      document.querySelector("#chat-tabs");

    if (!tabs) {
      return;
    }

    tabs.addEventListener(
      "click",
      event => {
        const button =
          event.target.closest(
            "[data-filter]"
          );

        if (!button) {
          return;
        }

        activeFilter =
          button.dataset.filter ||
          "all";

        tabs
          .querySelectorAll(
            "[data-filter]"
          )
          .forEach(item => {
            item.classList.toggle(
              "active",
              item === button
            );
          });

        render(
          window.ZakiConversations
            .conversations || []
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

  initChatTabs();

  await load();

  window.addEventListener(
    "beforeunload",
    cleanup
  );
});
