document.addEventListener(
  "DOMContentLoaded",
  async () => {
    "use strict";

    if (
      !window.supabase ||
      !window.ZakiChatConfig ||
      !window.ZakiMessages ||
      !window.ZakiRealtime ||
      !window.ZakiReactions ||
      !window.ZakiMedia
    ) {
      console.error(
        "ZakiChat: required modules are unavailable."
      );
      return;
    }

    const db =
      window.ZakiChatAuth?.client;

    if (!db) {
      console.error(
        "ZakiChat Chat: centralized Supabase client unavailable."
      );
      return;
    }

    window.ZakiMessages.init(
      window.ZakiChatConfig
    );

    window.ZakiRealtime.init(
      window.ZakiChatConfig
    );

    window.ZakiMedia.init(
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

    if (
      window.ZakiReactions &&
      messagesPanel
    ) {
      window.ZakiReactions.init(
        db,
        null,
        messagesPanel
      );
    }

    const messageInput =
      composer?.querySelector(
        "input[type='text']"
      );

    const attachButton =
      document.querySelector(
        "#attach-file-button"
      );

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

    if (messageInput) {
      messageInput.addEventListener(
        "input",
        function () {
          if (
            window.ZakiTyping &&
            currentUser &&
            conversationId
          ) {
            window.ZakiTyping.handleInput(
              db,
              messageInput.value
            );
          }
        }
      );
    }

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
    let uploadingAttachment = false;

    function formatTime(value) {
      if (!value) return "";

      const date =
        new Date(value);

      if (
        Number.isNaN(
          date.getTime()
        )
      ) {
        return "";
      }

      return date.toLocaleTimeString(
        [],
        {
          hour: "2-digit",
          minute: "2-digit"
        }
      );
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
            word
              .charAt(0)
              .toUpperCase()
          )
          .join("") || "Z"
      );
    }

    function showStatus(
      text,
      error = false
    ) {
      if (!chatUserStatus) {
        return;
      }

      chatUserStatus.textContent =
        text;

      chatUserStatus.style.color =
        error
          ? "#ff8f9c"
          : "";
    }

    function updateHeader() {
      if (!targetProfile) {
        return;
      }

      const name =
        targetProfile.full_name ||
        targetProfile.username ||
        "ZakiChat User";

      if (chatUserName) {
        chatUserName.textContent =
          name;
      }

      if (chatAvatar) {
        if (
          targetProfile.avatar_url
        ) {
          chatAvatar.style.backgroundImage =
            `url("${targetProfile.avatar_url}")`;

          chatAvatar.style.backgroundSize =
            "cover";

          chatAvatar.style.backgroundPosition =
            "center";

          chatAvatar.textContent =
            "";
        } else {
          chatAvatar.style.backgroundImage =
            "";

          chatAvatar.textContent =
            initials(
              targetProfile
            );
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
      if (messagesPanel) {
        messagesPanel.innerHTML =
          "";
      }
    }

    function scrollToBottom() {
      if (!messagesPanel) {
        return;
      }

      messagesPanel.scrollTop =
        messagesPanel.scrollHeight;
    }

    function renderMessages(
      messages
    ) {
      if (!messagesPanel) {
        return;
      }

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
        .eq(
          "id",
          targetUserId
        )
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
      if (!conversationId) {
        return;
      }

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
      if (
        !messagesPanel ||
        !messageId
      ) {
        return null;
      }

      return messagesPanel.querySelector(
        `[data-message-id="${CSS.escape(
          messageId
        )}"]`
      );
    }

    function getMessageText(
      messageId
    ) {
      const element =
        getMessageById(
          messageId
        );

      if (!element) {
        return "";
      }

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
      if (!replyBar) {
        return;
      }

      replyingToMessageId =
        messageId;

      if (replyPreview) {
        replyPreview.textContent =
          preview ||
          "Message";
      }

      replyBar.hidden =
        false;

      messageInput?.focus();
    }

    function cancelReply() {
      replyingToMessageId =
        null;

      if (replyBar) {
        replyBar.hidden =
          true;
      }

      if (replyPreview) {
        replyPreview.textContent =
          "";
      }

      messageInput?.focus();
    }

    function enterReplyMode(
      messageId
    ) {
      if (!messageId) {
        return;
      }

      if (editingMessageId) {
        cancelEdit();
      }

      const text =
        getMessageText(
          messageId
        );

      showReplyBar(
        messageId,
        text || "Message"
      );
    }

    function enterEditMode(
      messageId
    ) {
      if (
        !messagesPanel ||
        !messageInput
      ) {
        return;
      }

      if (replyingToMessageId) {
        cancelReply();
      }

      const bubble =
        getMessageById(
          messageId
        );

      if (!bubble) {
        return;
      }

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

      messageInput.value =
        text;

      messageInput.focus();

      messageInput.setSelectionRange(
        messageInput.value.length,
        messageInput.value.length
      );

      if (editBar) {
        editBar.hidden =
          false;
      }

      if (editPreview) {
        editPreview.textContent =
          text;
      }

      if (sendButton) {
        sendButton.textContent =
          "✓";

        sendButton.setAttribute(
          "aria-label",
          "Save edited message"
        );

        sendButton.title =
          "Save edited message";
      }
    }

    function cancelEdit() {
      editingMessageId =
        null;

      if (editBar) {
        editBar.hidden =
          true;
      }

      if (editPreview) {
        editPreview.textContent =
          "";
      }

      if (sendButton) {
        sendButton.textContent =
          "➤";

        sendButton.setAttribute(
          "aria-label",
          "Send message"
        );

        sendButton.title =
          "Send message";
      }

      if (messageInput) {
        messageInput.value =
          "";

        messageInput.focus();
      }
    }

    async function saveEditedMessage() {
      const content =
        messageInput?.value.trim() ||
        "";

      if (
        !editingMessageId ||
        !content
      ) {
        return;
      }

      messageInput.disabled =
        true;

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

        if (
          data &&
          messagesPanel
        ) {
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
        messageInput.disabled =
          false;

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
        getMessageById(
          messageId
        );

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

        if (
          data &&
          messagesPanel
        ) {
          window.ZakiMessages.updateMessage(
            messagesPanel,
            data,
            currentUser.id
          );
        }

        if (
          data?.attachment_path &&
          window.ZakiMedia
        ) {
          await window.ZakiMedia.remove(
            data.attachment_path
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
      if (!conversationId) {
        return;
      }

      const button =
        document.querySelector(
          "#refresh-chat"
        );

      if (button) {
        button.disabled =
          true;

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
          button.disabled =
            false;

          button.classList.remove(
            "is-refreshing"
          );
        }
      }
    }

    async function sendMessage() {
      if (
        !currentUser ||
        !conversationId ||
        uploadingAttachment
      ) {
        return;
      }

      if (editingMessageId) {
        await saveEditedMessage();
        return;
      }

      const content =
        messageInput?.value.trim() ||
        "";

      if (!content) {
        return;
      }

      const replyId =
        replyingToMessageId;

      if (window.ZakiTyping) {
        window.ZakiTyping.stopTyping();
      }

      if (messageInput) {
        messageInput.disabled =
          true;
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
          messageInput.value =
            "";
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
          messageInput.disabled =
            false;

          messageInput.focus();
        }
      }
    }

    async function handleAttachment(
      file
    ) {
      if (
        !file ||
        !currentUser ||
        !conversationId ||
        uploadingAttachment
      ) {
        return;
      }

      const validation =
        window.ZakiMedia.validate(
          file
        );

      if (!validation.ok) {
        alert(
          validation.error
        );
        return;
      }

      uploadingAttachment =
        true;

      if (attachButton) {
        attachButton.disabled =
          true;

        attachButton.textContent =
          "…";

        attachButton.title =
          "Uploading attachment...";
      }

      if (messageInput) {
        messageInput.disabled =
          true;
      }

      const replyId =
        replyingToMessageId;

      try {
        showStatus(
          "Uploading attachment..."
        );

        const attachment =
          await window.ZakiMedia.upload(
            file,
            conversationId,
            currentUser.id
          );

        const {
          data,
          error
        } =
          await window.ZakiMessages.sendAttachment(
            conversationId,
            currentUser.id,
            attachment,
            replyId
          );

        if (error) {
          await window.ZakiMedia.remove(
            attachment.path
          );

          throw error;
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

        updateHeader();
      } catch (error) {
        console.error(
          "Failed to send attachment:",
          error
        );

        alert(
          error?.message ||
          "Unable to upload the attachment right now."
        );
      } finally {
        uploadingAttachment =
          false;

        if (attachButton) {
          attachButton.disabled =
            false;

          attachButton.textContent =
            "＋";

          attachButton.title =
            "Attach file";
        }

        if (messageInput) {
          messageInput.disabled =
            false;

          messageInput.focus();
        }

        updateHeader();
      }
    }

    attachButton?.addEventListener(
      "click",
      () => {
        if (
          uploadingAttachment ||
          !currentUser ||
          !conversationId
        ) {
          return;
        }

        window.ZakiMedia.createPicker({
          onSelect:
            handleAttachment
        });
      }
    );

    messagesPanel?.addEventListener(
      "click",
      async event => {
        const button =
          event.target.closest(
            "[data-message-action]"
          );

        if (!button) {
          return;
        }

        const action =
          button.dataset
            .messageAction;

        const messageId =
          button.dataset
            .messageId;

        if (action === "reply") {
          enterReplyMode(
            messageId
          );
          return;
        }

        if (action === "forward") {
          if (window.ZakiForward) {
            await window.ZakiForward.open(
              messageId
            );
          }
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
      if (!conversationId) {
        return;
      }

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

            message.replly_to_content =
              preview ||
              "Message unavailable";
          }

          if (
            message.attachment_path &&
            !message.attachment_url &&
            window.ZakiMedia
          ) {
            message =
              await window.ZakiMedia.enrichMessage(
                message
              );
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
      } =
        await db.auth.getUser();

      currentUser =
        user || null;

      if (
        currentUser &&
        window.ZakiReactions &&
        messagesPanel
      ) {
        window.ZakiReactions.init(
          db,
          currentUser.id,
          messagesPanel
        );
      }

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

      showStatus(
        "Loading..."
      );

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
  }
);
