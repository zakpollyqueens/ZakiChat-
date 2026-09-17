document.addEventListener("DOMContentLoaded", async () => {
  "use strict";

  if (
    !window.supabase ||
    !window.ZakiChatConfig ||
    !window.ZakiMessages ||
    !window.ZakiRealtime
  ) {
    console.error(
      "ZakiChat: required modules are unavailable."
    );
    return;
  }

  const db =
    window.supabase.createClient(
      window.ZakiChatConfig.supabaseUrl,
      window.ZakiChatConfig.supabaseKey
    );

  window.ZakiMessages.init(
    window.ZakiChatConfig
  );

  window.ZakiRealtime.init(
    window.ZakiChatConfig
  );

  const messagesPanel =
    document.querySelector(
      ".messages-panel"
    );

  const composer =
    document.querySelector(
      ".message-composer"
    );

  const messageInput =
    composer?.querySelector("input");

  const chatUserName =
    document.querySelector(
      ".chat-user strong"
    );

  const chatUserStatus =
    document.querySelector(
      ".chat-user span"
    );

  const chatAvatar =
    document.querySelector(
      ".chat-user .conversation-avatar"
    );

  const editBar =
    document.querySelector(
      "#message-edit-bar"
    );

  const editPreview =
    document.querySelector(
      "#message-edit-preview"
    );

  const replyBar =
    document.querySelector(
      "#message-reply-bar"
    );

  const replyPreview =
    document.querySelector(
      "#message-reply-preview"
    );

  const sendButton =
    document.querySelector(
      "#send-message-button"
    );

  const params =
    new URLSearchParams(
      window.location.search
    );

  const targetUserId =
    params.get("user");

  let currentUser = null;
  let targetProfile = null;
  let conversationId = null;
  let editingMessageId = null;
  let replyingToMessageId = null;

  function formatTime(value) {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function initials(profile) {
    const name =
      profile?.full_name ||
      profile?.username ||
      "Z";

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

  function showStatus(
    text,
    error = false
  ) {
    if (!chatUserStatus) return;

    chatUserStatus.textContent =
      text;

    chatUserStatus.style.color =
      error ? "#ff8f9c" : "";
  }

  function updateHeader() {
    if (!targetProfile) return;

    const name =
      targetProfile.full_name ||
      targetProfile.username ||
      "ZakiChat User";

    if (chatUserName) {
      chatUserName.textContent =
        name;
    }

    if (chatAvatar) {
      if (targetProfile.avatar_url) {
        chatAvatar.style.backgroundImage =
          `url("${targetProfile.avatar_url}")`;

        chatAvatar.style.backgroundSize =
          "cover";

        chatAvatar.style.backgroundPosition =
          "center";

        chatAvatar.textContent = "";
      } else {
        chatAvatar.style.backgroundImage =
          "";

        chatAvatar.textContent =
          initials(targetProfile);
      }
    }

    showStatus(
      targetProfile.is_online
        ? "online"
        : targetProfile.last_seen
          ? `last seen ${formatTime(
              targetProfile.last_seen
            )}`
          : "offline"
    );
  }

  function clearMessages() {
    if (!messagesPanel) return;

    messagesPanel.innerHTML = "";
  }

  function scrollToBottom() {
    if (!messagesPanel) return;

    messagesPanel.scrollTop =
      messagesPanel.scrollHeight;
  }

  function renderMessages(
    messages
  ) {
    if (!messagesPanel) return;

    window.ZakiMessages.renderInto(
      messagesPanel,
      messages,
      currentUser.id
    );

    scrollToBottom();
  }

  async function loadTargetProfile() {
    const {
      data,
      error
    } = await db
      .from("profiles")
      .select(`
        id,
        username,
        full_name,
        phone,
        avatar_url,
        bio,
        is_online,
        last_seen
      `)
      .eq("id", targetUserId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error(
        "ZakiChat user not found."
      );
    }

    targetProfile = data;

    updateHeader();
  }

  async function getConversation() {
    const {
      data,
      error
    } = await db.rpc(
      "get_or_create_direct_conversation",
      {
        p_other_user_id:
          targetUserId
      }
    );

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error(
        "Unable to create conversation."
      );
    }

    conversationId = data;
  }

  async function loadMessages() {
    if (!conversationId) return;

    const {
      data,
      error
    } =
      await window.ZakiMessages.load(
        conversationId
      );

    if (error) {
      throw error;
    }

    clearMessages();

    renderMessages(
      data || []
    );

    await window.ZakiMessages.markRead(
      conversationId,
      currentUser.id
    );
  }

  function getMessageById(
    messageId
  ) {
    if (!messagesPanel || !messageId) {
      return null;
    }

    const element =
      messagesPanel.querySelector(
        `[data-message-id="${CSS.escape(
          messageId
        )}"]`
      );

    if (!element) return null;

    return element;
  }

  function getMessageText(
    messageId
  ) {
    const element =
      getMessageById(messageId);

    if (!element) return "";

    return (
      element.querySelector(
        ".message-text"
      )?.textContent || ""
    ).trim();
  }

  function showReplyBar(
    messageId,
    preview
  ) {
    if (!replyBar) return;

    replyingToMessageId =
      messageId;

    if (replyPreview) {
      replyPreview.textContent =
        preview ||
        "Message";
    }

    replyBar.hidden = false;

    if (messageInput) {
      messageInput.focus();
    }
  }

  function cancelReply() {
    replyingToMessageId = null;

    if (replyBar) {
      replyBar.hidden = true;
    }

    if (replyPreview) {
      replyPreview.textContent = "";
    }

    if (messageInput) {
      messageInput.focus();
    }
  }

  function enterReplyMode(
    messageId
  ) {
    if (!messageId) return;

    if (editingMessageId) {
      cancelEdit();
    }

    const text =
      getMessageText(messageId);

    showReplyBar(
      messageId,
      text || "Message"
    );
  }

  function enterEditMode(
    messageId
  ) {
    if (!messagesPanel || !messageInput) {
      return;
    }

    if (replyingToMessageId) {
      cancelReply();
    }

    const bubble =
      getMessageById(messageId);

    if (!bubble) return;

    if (
      !bubble.classList.contains(
        "sent-bubble"
      )
    ) {
      return;
    }

    if (
      bubble.classList.contains(
        "deleted-message"
      )
    ) {
      return;
    }

    const text =
      bubble.querySelector(
        ".message-text"
      )?.textContent || "";

    editingMessageId =
      messageId;

    messageInput.value = text;

    messageInput.focus();

    messageInput.setSelectionRange(
      messageInput.value.length,
      messageInput.value.length
    );

    if (editBar) {
      editBar.hidden = false;
    }

    if (editPreview) {
      editPreview.textContent =
        text;
    }

    if (sendButton) {
      sendButton.textContent = "✓";

      sendButton.setAttribute(
        "aria-label",
        "Save edited message"
      );

      sendButton.title =
        "Save edited message";
    }
  }

  function cancelEdit() {
    editingMessageId = null;

    if (editBar) {
      editBar.hidden = true;
    }

    if (editPreview) {
      editPreview.textContent = "";
    }

    if (sendButton) {
      sendButton.textContent = "➤";

      sendButton.setAttribute(
        "aria-label",
        "Send message"
      );

      sendButton.title =
        "Send message";
    }

    if (messageInput) {
      messageInput.value = "";
      messageInput.focus();
    }
  }

  async function saveEditedMessage() {
    const content =
      messageInput?.value.trim() || "";

    if (
      !editingMessageId ||
      !content
    ) {
      return;
    }

    messageInput.disabled = true;

    try {
      const {
        data,
        error
      } =
        await window.ZakiMessages.edit(
          editingMessageId,
          currentUser.id,
          content
        );

      if (error) {
        throw error;
      }

      if (data && messagesPanel) {
        window.ZakiMessages.updateMessage(
          messagesPanel,
          data,
          currentUser.id
        );
      }

      cancelEdit();
    } catch (error) {
      console.error(
        "Failed to edit message:",
        error
      );

      alert(
        error?.message ||
        "Unable to edit the message right now."
      );
    } finally {
      messageInput.disabled = false;
      messageInput.focus();
    }
  }

  async function deleteMessage(
    messageId
  ) {
    if (
      !messageId ||
      !currentUser
    ) {
      return;
    }

    const bubble =
      getMessageById(messageId);

    if (
      !bubble ||
      !bubble.classList.contains(
        "sent-bubble"
      ) ||
      bubble.classList.contains(
        "deleted-message"
      )
    ) {
      return;
    }

    if (
      !window.confirm(
        "Delete this message?"
      )
    ) {
      return;
    }

    try {
      const {
        data,
        error
      } =
        await window.ZakiMessages.delete(
          messageId,
          currentUser.id
        );

      if (error) {
        throw error;
      }

      if (data && messagesPanel) {
        window.ZakiMessages.updateMessage(
          messagesPanel,
          data,
          currentUser.id
        );
      }

      if (
        editingMessageId ===
        messageId
      ) {
        cancelEdit();
      }

      if (
        replyingToMessageId ===
        messageId
      ) {
        cancelReply();
      }
    } catch (error) {
      console.error(
        "Failed to delete message:",
        error
      );

      alert(
        error?.message ||
        "Unable to delete the message right now."
      );
    }
  }

  async function refreshChat() {
    if (!conversationId) return;

    const button =
      document.querySelector(
        "#refresh-chat"
      );

    if (button) {
      button.disabled = true;
      button.classList.add(
        "is-refreshing"
      );
    }

    try {
      await loadMessages();
    } catch (error) {
      console.error(
        "Refresh failed:",
        error
      );

      alert(
        "Unable to refresh the chat right now."
      );
    } finally {
      if (button) {
        button.disabled = false;
        button.classList.remove(
          "is-refreshing"
        );
      }
    }
  }

  async function sendMessage() {
    if (
      !currentUser ||
      !conversationId
    ) {
      return;
    }

    if (editingMessageId) {
      await saveEditedMessage();
      return;
    }

    const content =
      messageInput?.value.trim() || "";

    if (!content) return;

    const replyId =
      replyingToMessageId;

    if (messageInput) {
      messageInput.disabled = true;
    }

    try {
      const {
        data,
        error
      } =
        await window.ZakiMessages.send(
          conversationId,
          currentUser.id,
          content,
          replyId
        );

      if (error) {
        throw error;
      }

      if (messageInput) {
        messageInput.value = "";
      }

      cancelReply();

      if (
        data &&
        messagesPanel
      ) {
        window.ZakiMessages.appendIfMissing(
          messagesPanel,
          data,
          currentUser.id
        );

        scrollToBottom();
      }
    } catch (error) {
      console.error(
        "Failed to send message:",
        error
      );

      alert(
        error?.message ||
        "Unable to send the message right now."
      );
    } finally {
      if (messageInput) {
        messageInput.disabled = false;
        messageInput.focus();
      }
    }
  }

  messagesPanel?.addEventListener(
    "click",
    async event => {
      const button =
        event.target.closest(
          "[data-message-action]"
        );

      if (!button) return;

      const action =
        button.dataset.messageAction;

      const messageId =
        button.dataset.messageId;

      if (action === "reply") {
        enterReplyMode(
          messageId
        );
        return;
      }

      if (action === "edit") {
        enterEditMode(
          messageId
        );
        return;
      }

      if (action === "delete") {
        await deleteMessage(
          messageId
        );
      }
    }
  );

  document
    .querySelector(
      "#cancel-message-edit"
    )
    ?.addEventListener(
      "click",
      cancelEdit
    );

  document
    .querySelector(
      "#cancel-message-reply"
    )
    ?.addEventListener(
      "click",
      cancelReply
    );

  document
    .querySelector(
      "#refresh-chat"
    )
    ?.addEventListener(
      "click",
      refreshChat
    );

  composer?.addEventListener(
    "submit",
    async event => {
      event.preventDefault();
      await sendMessage();
    }
  );

  if (messageInput) {
    messageInput.addEventListener(
      "keydown",
      async event => {
        if (
          event.key === "Enter" &&
          !event.shiftKey
        ) {
          event.preventDefault();
          await sendMessage();
        }

        if (
          event.key === "Escape"
        ) {
          if (editingMessageId) {
            cancelEdit();
          } else if (
            replyingToMessageId
          ) {
            cancelReply();
          }
        }
      }
    );
  }

  function subscribeToMessages() {
    if (!conversationId) return;

    window.ZakiRealtime.subscribeToMessages(
      conversationId,
      async (
        message,
        payload
      ) => {
        if (!message?.id) {
          return;
        }

        if (!messagesPanel) {
          return;
        }

        if (
          payload?.eventType ===
          "DELETE"
        ) {
          window.ZakiMessages.removeMessage(
            messagesPanel,
            message.id
          );

          if (
            editingMessageId ===
            message.id
          ) {
            cancelEdit();
          }

          if (
            replyingToMessageId ===
            message.id
          ) {
            cancelReply();
          }

          return;
        }

        if (
          message.reply_to_message_id &&
          !message.reply_to_content
        ) {
          const preview =
            getMessageText(
              message.reply_to_message_id
            );

          message.reply_to_content =
            preview ||
            "Message unavailable";
        }

        if (
          payload?.eventType ===
          "UPDATE"
        ) {
          window.ZakiMessages.updateMessage(
            messagesPanel,
            message,
            currentUser.id
          );

          return;
        }

        const added =
          window.ZakiMessages.appendIfMissing(
            messagesPanel,
            message,
            currentUser.id
          );

        if (added) {
          scrollToBottom();
        }

        if (
          message.sender_id !==
          currentUser.id
        ) {
          await window.ZakiMessages.markRead(
            conversationId,
            currentUser.id
          );
        }
      }
    );
  }

  window.addEventListener(
    "beforeunload",
    () => {
      if (
        window.ZakiRealtime &&
        conversationId
      ) {
        window.ZakiRealtime.unsubscribe(
          `messages:${conversationId}`
        );
      }
    }
  );

  try {
    const {
      data: {
        user
      }
    } = await db.auth.getUser();

    currentUser =
      user || null;

    if (!currentUser) {
      showStatus(
        "Please sign in",
        true
      );
      return;
    }

    if (!targetUserId) {
      clearMessages();

      if (messagesPanel) {
        const notice =
          document.createElement(
            "div"
          );

        notice.className =
          "empty-messages";

        notice.textContent =
          "Open a chat from your Contacts.";

        messagesPanel.appendChild(
          notice
        );
      }

      showStatus(
        "No conversation selected"
      );

      return;
    }

    if (
      targetUserId ===
      currentUser.id
    ) {
      showStatus(
        "You cannot chat with yourself",
        true
      );

      return;
    }

    showStatus("Loading...");

    await loadTargetProfile();
    await getConversation();
    await loadMessages();

    subscribeToMessages();
  } catch (error) {
    console.error(
      "ZakiChat chat initialization failed:",
      error
    );

    showStatus(
      "Unable to load chat",
      true
    );
  }
});
