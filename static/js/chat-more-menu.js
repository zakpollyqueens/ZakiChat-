document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const wrapper =
    document.getElementById("chat-more-wrapper");

  const button =
    document.getElementById("chat-more-button");

  const menu =
    document.getElementById("chat-more-menu");

  const searchButton =
    document.getElementById("search-chat-button");

  if (!wrapper || !button || !menu) {
    return;
  }

  const db =
    window.ZakiChatAuth?.client;

  function closeMenu() {
    menu.hidden = true;
    button.setAttribute(
      "aria-expanded",
      "false"
    );
  }

  function openMenu() {
    menu.hidden = false;
    button.setAttribute(
      "aria-expanded",
      "true"
    );
  }

  function getChatUserId() {
    return String(
      new URLSearchParams(
        window.location.search
      ).get("user") || ""
    ).trim();
  }

  function getConversationId() {
    return (
      window.ZakiChatConversationId ||
      window.chatConversationId ||
      null
    );
  }

  function getChatUserName() {
    return (
      document
        .querySelector(
          ".chat-user strong"
        )
        ?.textContent
        ?.trim() ||
      "this contact"
    );
  }

  async function getCurrentUser() {
    if (!db) return null;

    const { data } =
      await db.auth.getUser();

    return data?.user || null;
  }

  async function blockCurrentUser() {
    const userId =
      getChatUserId();

    if (!userId) {
      alert(
        "Unable to identify this contact."
      );
      return;
    }

    const currentUser =
      await getCurrentUser();

    if (!currentUser) {
      alert(
        "Please sign in again."
      );
      return;
    }

    if (
      currentUser.id === userId
    ) {
      alert(
        "You cannot block yourself."
      );
      return;
    }

    const name =
      getChatUserName();

    if (
      !window.confirm(
        `Block ${name}?`
      )
    ) {
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
              userId
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
        "Unable to block this contact right now."
      );
      return;
    }

    window.location.href =
      "blocked-users.html";
  }

  async function clearChat() {
    const conversationId =
      getConversationId();

    const currentUser =
      await getCurrentUser();

    if (
      !conversationId ||
      !currentUser ||
      !window.ZakiMessages
    ) {
      alert(
        "Unable to clear this chat right now."
      );
      return;
    }

    if (
      !window.confirm(
        "Clear your messages from this chat?"
      )
    ) {
      return;
    }

    const result =
      await window.ZakiMessages.clearConversation(
        conversationId,
        currentUser.id
      );

    if (result?.error) {
      console.error(
        "ZakiChat clear chat:",
        result.error
      );

      alert(
        result.error.message ||
        "Unable to clear this chat."
      );
      return;
    }

    document
      .querySelector(
        ".messages-list"
      )
      ?.replaceChildren();

    alert(
      "Your messages have been cleared from this chat."
    );
  }

  async function exportChat() {
    const conversationId =
      getConversationId();

    if (
      !conversationId ||
      !window.ZakiMessages
    ) {
      alert(
        "Unable to export this chat right now."
      );
      return;
    }

    const result =
      await window.ZakiMessages.exportConversation(
        conversationId
      );

    if (result?.error) {
      console.error(
        "ZakiChat export chat:",
        result.error
      );

      alert(
        result.error.message ||
        "Unable to export this chat."
      );
      return;
    }

    const messages =
      result.data || [];

    if (!messages.length) {
      alert(
        "There are no messages to export."
      );
      return;
    }

    const lines = [
      "ZakiChat Conversation Export",
      `Contact: ${getChatUserName()}`,
      `Exported: ${new Date().toLocaleString()}`,
      "",
      "----------------------------------------",
      ""
    ];

    messages.forEach(message => {
      const time =
        message.created_at
          ? new Date(
              message.created_at
            ).toLocaleString()
          : "";

      const content =
        message.deleted_at
          ? "[Message deleted]"
          : (
              message.content ||
              message.attachment_name ||
              "[Attachment]"
            );

      lines.push(
        `[${time}] ${content}`
      );
    });

    const blob =
      new Blob(
        [lines.join("\n")],
        {
          type:
            "text/plain;charset=utf-8"
        }
      );

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;
    link.download =
      `ZakiChat-${getChatUserName()
        .replace(/[^a-z0-9-_]+/gi, "-")
        .replace(/^-+|-+$/g, "") || "chat"
      }.txt`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(
      () => URL.revokeObjectURL(url),
      1000
    );
  }

  function openWithUser(page) {
    const userId =
      getChatUserId();

    if (!userId) {
      window.location.href =
        page;
      return;
    }

    window.location.href =
      `${page}?user=${encodeURIComponent(
        userId
      )}`;
  }

  button.addEventListener(
    "click",
    event => {
      event.stopPropagation();

      if (menu.hidden) {
        openMenu();
      } else {
        closeMenu();
      }
    }
  );

  menu.addEventListener(
    "click",
    async event => {
      event.stopPropagation();

      const item =
        event.target.closest(
          "[data-chat-action]"
        );

      if (!item) return;

      const action =
        item.dataset.chatAction;

      if (action === "search") {
        closeMenu();
        searchButton?.click();
        return;
      }

      if (action === "info") {
        closeMenu();
        openWithUser(
          "profile.html"
        );
        return;
      }

      if (action === "block") {
        closeMenu();
        await blockCurrentUser();
        return;
      }

      if (action === "media") {
        closeMenu();
        openWithUser(
          "media.html"
        );
        return;
      }

      if (action === "notifications") {
        closeMenu();
        openWithUser(
          "notifications.html"
        );
        return;
      }

      if (action === "disappearing") {
        closeMenu();
        openWithUser(
          "disappearing-messages.html"
        );
        return;
      }

      if (action === "theme") {
        closeMenu();
        openWithUser(
          "appearance.html"
        );
        return;
      }

      if (action === "starred") {
        closeMenu();
        openWithUser(
          "starred-messages.html"
        );
        return;
      }

      if (action === "clear") {
        closeMenu();
        await clearChat();
        return;
      }

      if (action === "export") {
        closeMenu();
        await exportChat();
        return;
      }

      if (action === "report") {
        closeMenu();

        const userId =
          getChatUserId();

        if (userId) {
          window.location.href =
            `contact-support.html?category=Report%20a%20user&subject=${encodeURIComponent(
              `Report ZakiChat user ${userId}`
            )}`;
        }

        return;
      }
    }
  );

  document.addEventListener(
    "click",
    event => {
      if (
        !wrapper.contains(
          event.target
        )
      ) {
        closeMenu();
      }
    }
  );

  document.addEventListener(
    "keydown",
    event => {
      if (
        event.key === "Escape"
      ) {
        closeMenu();
      }
    }
  );
});
