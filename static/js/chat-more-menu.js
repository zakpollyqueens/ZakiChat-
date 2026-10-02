document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const wrapper = document.getElementById("chat-more-wrapper");
  const button = document.getElementById("chat-more-button");
  const menu = document.getElementById("chat-more-menu");
  const searchButton = document.getElementById("search-chat-button");

  if (!wrapper || !button || !menu) return;

  /* The menu must ALWAYS start closed when Chat opens. */
  menu.hidden = true;
  button.setAttribute("aria-expanded", "false");

  const db = window.ZakiChatAuth?.client;

  function closeMenu() {
    menu.hidden = true;
    button.setAttribute("aria-expanded", "false");
  }

  function openMenu() {
    menu.hidden = false;
    button.setAttribute("aria-expanded", "true");
  }

  function getUserId() {
    return String(
      new URLSearchParams(window.location.search).get("user") || ""
    ).trim();
  }

  function getConversationId() {
    return (
      window.ZakiChatConversationId ||
      window.chatConversationId ||
      null
    );
  }

  function getUserName() {
    return (
      document.querySelector(".chat-user strong")?.textContent?.trim() ||
      "this contact"
    );
  }

  function openChatPage(page) {
    const userId = getUserId();

    if (!userId) {
      window.location.href = page;
      return;
    }

    window.location.href =
      `${page}?user=${encodeURIComponent(userId)}`;
  }

  async function getCurrentUser() {
    if (!db) return null;

    const { data } = await db.auth.getUser();
    return data?.user || null;
  }

  async function blockCurrentUser() {
    const userId = getUserId();

    if (!userId) {
      alert("Unable to identify this contact.");
      return;
    }

    const currentUser = await getCurrentUser();

    if (!currentUser) {
      alert("Please sign in again.");
      return;
    }

    if (currentUser.id === userId) {
      alert("You cannot block yourself.");
      return;
    }

    if (!window.confirm(`Block ${getUserName()}?`)) {
      return;
    }

    const { data: existing, error: checkError } =
      await db
        .from("blocked_users")
        .select("id")
        .eq("blocker_id", currentUser.id)
        .eq("blocked_id", userId)
        .maybeSingle();

    if (checkError) {
      console.error(
        "ZakiChat block check:",
        checkError
      );
      alert(
        checkError.message ||
        "Unable to check the block status."
      );
      return;
    }

    if (!existing) {
      const { error } =
        await db
          .from("blocked_users")
          .insert({
            blocker_id: currentUser.id,
            blocked_id: userId
          });

      if (error) {
        console.error(
          "ZakiChat block user:",
          error
        );
        alert(
          error.message ||
          "Unable to block this contact right now."
        );
        return;
      }
    }

    window.location.href =
      "blocked-users.html";
  }

  async function clearChat() {
    const userId = getUserId();
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      alert("Please sign in again.");
      return;
    }

    if (!userId) {
      alert("Unable to identify this contact.");
      return;
    }

    let conversationId =
      getConversationId();

    /*
     * Resolve the conversation directly if the
     * chat page has not exposed its ID yet.
     */
    if (!conversationId) {
      const { data, error } =
        await db.rpc(
          "get_or_create_direct_conversation",
          {
            p_other_user_id: userId
          }
        );

      if (error) {
        console.error(
          "ZakiChat clear conversation lookup:",
          error
        );

        alert(
          error.message ||
          "Unable to open this conversation."
        );

        return;
      }

      conversationId = data;
    }

    if (!conversationId) {
      alert(
        "Unable to identify this conversation."
      );
      return;
    }

    if (
      !window.ZakiMessages ||
      typeof window.ZakiMessages.clearConversation !==
        "function"
    ) {
      alert(
        "Chat tools are not ready yet. Please try again."
      );
      return;
    }

    if (
      !window.confirm(
        `Clear your messages with ${getUserName()}?`
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
      .querySelector(".messages-list")
      ?.replaceChildren();

    alert(
      "Your messages from this conversation have been cleared from your chat view."
    );
  }

  async function exportChat() {
    const modal =
      document.getElementById("export-chat-modal");

    const contact =
      document.getElementById("export-chat-contact");

    if (!modal) {
      await performExport();
      return;
    }

    if (contact) {
      contact.textContent = getUserName();
    }

    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
  }

  function closeExportModal() {
    const modal =
      document.getElementById("export-chat-modal");

    if (!modal) return;

    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
  }

  async function performExport() {
    const conversationId = getConversationId();

    if (!conversationId || !window.ZakiMessages) {
      alert("Unable to export this chat right now.");
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

    const messages = result.data || [];

    if (!messages.length) {
      alert("There are no messages to export.");
      return;
    }

    const lines = [
      "ZakiChat Conversation Export",
      `Contact: ${getUserName()}`,
      `Exported: ${new Date().toLocaleString()}`,
      "",
      "----------------------------------------",
      ""
    ];

    messages.forEach(message => {
      const time = message.created_at
        ? new Date(
            message.created_at
          ).toLocaleString()
        : "";

      const content = message.deleted_at
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

    const blob = new Blob(
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
      `ZakiChat-${getUserName()
        .replace(
          /[^a-z0-9-_]+/gi,
          "-"
        )
        .replace(
          /^-+|-+$/g,
          ""
        ) || "chat"}.txt`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(
      () => URL.revokeObjectURL(url),
      1000
    );
  }

  button.addEventListener("click", event => {
    event.stopPropagation();

    if (menu.hidden) {
      openMenu();
    } else {
      closeMenu();
    }
  });

  menu.addEventListener("click", async event => {
    event.stopPropagation();

    const item = event.target.closest("[data-chat-action]");
    if (!item) return;

    const action = item.dataset.chatAction;

    switch (action) {

      case "info":
        closeMenu();
        openChatPage("chat-info.html");
        break;

      case "search":
        closeMenu();
        searchButton?.click();
        break;

      case "media":
        closeMenu();
        openChatPage("media.html");
        break;

      case "notifications":
        closeMenu();
        openChatPage("chat-notifications.html");
        break;

      case "disappearing":
        closeMenu();
        openChatPage("disappearing-messages.html");
        break;

      case "theme":
        closeMenu();
        openChatPage("chat-theme.html");
        break;

      case "starred":
        closeMenu();
        openChatPage("starred-messages.html");
        break;

      case "clear":
        closeMenu();
        await clearChat();
        break;

      case "export":
        closeMenu();
        await exportChat();
        break;

      case "block":
        closeMenu();
        await blockCurrentUser();
        break;

      case "report": {
        closeMenu();

        const userId = getUserId();

        if (userId) {
          window.location.href =
            `contact-support.html?category=Report%20a%20user&subject=${
              encodeURIComponent(
                `Report ZakiChat user ${userId}`
              )
            }`;
        }

        break;
      }

      default:
        closeMenu();
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
