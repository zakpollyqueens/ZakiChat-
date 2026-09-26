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

    chatAvatar?.addEventListener("click", () => {
      if (targetUserId) {
        window.location.href =
          `profile.html?user=${encodeURIComponent(targetUserId)}`;
      }
    });

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

    async function updateStatusRing() {
      if (!chatAvatar || !targetUserId || !currentUser) {
        return;
      }

      try {
        const { data: statuses, error } = await db
          .from("status_updates")
          .select("id")
          .eq("user_id", targetUserId)
          .gt("expires_at", new Date().toISOString());

        if (error) {
          throw error;
        }

        const ids = (statuses || []).map(
          status => status.id
        );

        if (!ids.length) {
          chatAvatar.classList.remove(
            "has-unviewed-update"
          );
          return;
        }

        const { data: views, error: viewError } = await db
          .from("status_views")
          .select("status_id")
          .eq("viewer_id", currentUser.id)
          .in("status_id", ids);

        if (viewError) {
          throw viewError;
        }

        const viewed = new Set(
          (views || []).map(
            view => view.status_id
          )
        );

        chatAvatar.classList.toggle(
          "has-unviewed-update",
          ids.some(id => !viewed.has(id))
        );

      } catch (error) {
        console.warn(
          "Unable to check unviewed status:",
          error
        );
      }
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

      if (chatUserStatus) {
        chatUserStatus.classList.remove(
          "online-status",
          "is-typing"
        );
      }

      if (targetProfile.is_online) {
        showStatus("online");

        chatUserStatus?.classList.add(
          "online-status"
        );
      } else {
        showStatus(
          targetProfile.last_seen
            ? `last seen ${formatTime(
                targetProfile.last_seen
              )}`
            : "offline"
        );
      }
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
      await updateStatusRing();
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

      if (window.ZakiCommunication) {
        window.ZakiCommunication.init(
          window.ZakiChatConfig,
          {
            currentUser,
            targetUser: targetProfile,
            conversationId
          }
        );

        window.ZakiCommunication.setConversation({
          currentUser,
          targetUser: targetProfile,
          conversationId
        });

        if (window.ZakiTyping) {
          window.ZakiTyping.init(
            db,
            currentUser.id,
            conversationId,
            chatUserStatus,
            updateHeader
          );
        }
      }
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

      await window.ZakiMessages.markDelivered(
        conversationId,
        currentUser.id
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

        selectedMessageIds.delete(
          String(messageId)
        );

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

    document
      .querySelector("#voice-note-button")
      ?.addEventListener("click", async () => {
        if (!window.ZakiCommunication) {
          alert("Voice notes are not available right now.");
          return;
        }

        if (!currentUser || !conversationId) {
          return;
        }

        window.ZakiCommunication.setConversation({
          currentUser,
          targetUser: targetProfile,
          conversationId
        });

        await window.ZakiCommunication.startRecording();
      });

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

    // ------------------------------------------------------------
    // Individual message long-press menu
    // ------------------------------------------------------------
    let messagePressTimer = null;
    let activeMessageMenu = null;
    let selectedMessageIds = new Set();

    function closeMessageMenu() {
      if (activeMessageMenu) {
        activeMessageMenu.remove();
        activeMessageMenu = null;
      }
    }

    function getStarredMessages() {
      try {
        return JSON.parse(
          localStorage.getItem(
            "zakichat-starred-messages"
          ) || "[]"
        );
      } catch {
        return [];
      }
    }

    function setStarredMessages(ids) {
      localStorage.setItem(
        "zakichat-starred-messages",
        JSON.stringify(ids)
      );
    }

    function isMessageStarred(messageId) {
      return getStarredMessages()
        .includes(String(messageId));
    }

    function toggleStarredMessage(messageId) {
      const id = String(messageId);
      const ids = getStarredMessages();
      const index = ids.indexOf(id);

      if (index >= 0) {
        ids.splice(index, 1);
      } else {
        ids.push(id);
      }

      setStarredMessages(ids);
      return index < 0;
    }

    function copyMessageText(messageId) {
      const text =
        getMessageText(messageId);

      if (!text) {
        return;
      }

      if (navigator.clipboard?.writeText) {
        navigator.clipboard
          .writeText(text)
          .then(() => showStatus("Message copied"))
          .catch(() => {});
      }
    }

    function selectMessage(messageId) {
      const id = String(messageId);

      if (selectedMessageIds.has(id)) {
        selectedMessageIds.delete(id);
      } else {
        selectedMessageIds.add(id);
      }

      const bubble =
        getMessageById(id);

      bubble?.classList.toggle(
        "message-selected",
        selectedMessageIds.has(id)
      );

      if (selectedMessageIds.size) {
        showStatus(
          `${selectedMessageIds.size} message${
            selectedMessageIds.size === 1 ? "" : "s"
          } selected`
        );
      } else {
        updateHeader();
      }
    }

    function showMessageMenu(messageId, x, y) {
      closeMessageMenu();

      const bubble =
        getMessageById(messageId);

      if (!bubble) {
        return;
      }

      const mine =
        bubble.classList.contains(
          "sent-bubble"
        );

      const deleted =
        bubble.classList.contains(
          "deleted-message"
        );

      if (deleted) {
        return;
      }

      const text =
        getMessageText(messageId);

      const menu =
        document.createElement("div");

      menu.className =
        "message-context-menu";

      menu.setAttribute(
        "role",
        "menu"
      );

      const actions = [
        ["reply", "↩", "Reply"],
        ["react", "😊", "React"],
        ["forward", "↗", "Forward"],
        ...(text
          ? [["copy", "⧉", "Copy"]]
          : []),
        ["star", "⭐",
          isMessageStarred(messageId)
            ? "Unstar"
            : "Star"],
        ["select", "☑", "Select"]
      ];

      if (
        mine &&
        text
      ) {
        actions.push(
          ["edit", "✎", "Edit"]
        );
      }

      if (mine) {
        actions.push(
          ["delete", "🗑", "Delete"]
        );
      }

      menu.innerHTML =
        actions
          .map(
            ([action, icon, label]) => `
              <button
                type="button"
                role="menuitem"
                data-context-action="${action}"
              >
                <span aria-hidden="true">${icon}</span>
                <span>${label}</span>
              </button>
            `
          )
          .join("");

      document.body.appendChild(menu);
      activeMessageMenu = menu;

      const width =
        menu.offsetWidth || 190;
      const height =
        menu.offsetHeight || 260;

      const left =
        Math.max(
          8,
          Math.min(
            x,
            window.innerWidth - width - 8
          )
        );

      const top =
        Math.max(
          8,
          Math.min(
            y,
            window.innerHeight - height - 8
          )
        );

      menu.style.left =
        `${left}px`;
      menu.style.top =
        `${top}px`;

      menu.addEventListener(
        "click",
        async event => {
          const button =
            event.target.closest(
              "[data-context-action]"
            );

          if (!button) {
            return;
          }

          const action =
            button.dataset.contextAction;

          closeMessageMenu();

          if (action === "reply") {
            enterReplyMode(messageId);
            return;
          }

          if (action === "react") {
            const emoji =
              window.ZakiReactions?.EMOJIS?.[0];

            if (
              emoji &&
              window.ZakiReactions
            ) {
              await window.ZakiReactions.toggle(
                messageId,
                emoji
              );
              await window.ZakiReactions.refresh();
            }

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

          if (action === "copy") {
            copyMessageText(messageId);
            return;
          }

          if (action === "star") {
            const starred =
              toggleStarredMessage(
                messageId
              );

            showStatus(
              starred
                ? "Message starred"
                : "Message unstarred"
            );

            return;
          }

          if (action === "select") {
            selectMessage(messageId);
            return;
          }

          if (action === "edit") {
            enterEditMode(messageId);
            return;
          }

          if (action === "delete") {
            await deleteMessage(messageId);
          }
        }
      );
    }

    function beginMessagePress(event) {
      const bubble =
        event.target.closest(
          "[data-message-id]"
        );

      if (
        !bubble ||
        !messagesPanel?.contains(bubble)
      ) {
        return;
      }

      if (
        event.target.closest(
          "button, a, input, audio, video"
        )
      ) {
        return;
      }

      const messageId =
        bubble.dataset.messageId;

      if (!messageId) {
        return;
      }

      const point =
        event.touches?.[0] ||
        event;

      clearTimeout(
        messagePressTimer
      );

      messagePressTimer =
        setTimeout(() => {
          showMessageMenu(
            messageId,
            point.clientX,
            point.clientY
          );
        }, 500);
    }

    function cancelMessagePress() {
      clearTimeout(
        messagePressTimer
      );
      messagePressTimer = null;
    }

    messagesPanel?.addEventListener(
      "pointerdown",
      beginMessagePress
    );

    messagesPanel?.addEventListener(
      "pointerup",
      cancelMessagePress
    );

    messagesPanel?.addEventListener(
      "pointercancel",
      cancelMessagePress
    );

    messagesPanel?.addEventListener(
      "pointermove",
      cancelMessagePress
    );

    document.addEventListener(
      "click",
      event => {
        if (
          activeMessageMenu &&
          !activeMessageMenu.contains(
            event.target
          )
        ) {
          closeMessageMenu();
        }
      }
    );

    // ------------------------------------------------------------
    // Reply preview: tap it to jump back to the original message
    // ------------------------------------------------------------
    messagesPanel?.addEventListener(
      "click",
      event => {
        const preview =
          event.target.closest(
            ".message-reply-preview"
          );

        if (!preview) {
          return;
        }

        const bubble =
          preview.closest(
            "[data-message-id]"
          );

        const targetId =
          bubble?.dataset.messageId;

        if (!targetId) {
          return;
        }

        const originalId =
          bubble.querySelector(
            "[data-reply-message-id]"
          )?.dataset.replyMessageId;

        if (!originalId) {
          return;
        }

        const original =
          getMessageById(
            originalId
          );

        if (!original) {
          showStatus(
            "Original message is unavailable"
          );
          return;
        }

        original.classList.add(
          "message-reply-target"
        );

        original.scrollIntoView({
          behavior: "smooth",
          block: "center"
        });

        setTimeout(() => {
          original.classList.remove(
            "message-reply-target"
          );
        }, 1200);
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

        if (action === "react") {
          const bubble =
            getMessageById(messageId);

          const reactionButton =
            bubble?.querySelector(
              ".message-reactions"
            );

          if (reactionButton) {
            reactionButton.scrollIntoView({
              behavior: "smooth",
              block: "nearest"
            });
          }

          if (window.ZakiReactions?.EMOJIS?.length) {
            const emoji =
              window.ZakiReactions.EMOJIS[0];

            await window.ZakiReactions.toggle(
              messageId,
              emoji
            );

            await window.ZakiReactions.refresh();
          }

          return;
        }

        if (action === "copy") {
          const text =
            getMessageText(messageId);

          if (!text) {
            return;
          }

          if (navigator.clipboard?.writeText) {
            try {
              await navigator.clipboard.writeText(text);
              showStatus("Message copied");
            } catch (error) {
              console.warn("Copy failed:", error);
            }
          }
          return;
        }

        if (action === "react") {
          if (
            window.ZakiReactions &&
            window.ZakiReactions.open
          ) {
            window.ZakiReactions.open(
              messageId,
              button
            );
          }
          return;
        }

        if (action === "copy") {
          const text = getMessageText(messageId);

          if (!text) {
            return;
          }

          if (navigator.clipboard?.writeText) {
            try {
              await navigator.clipboard.writeText(text);
              showStatus("Message copied");
            } catch (error) {
              console.warn(
                "Copy failed:",
                error
              );
            }
          }

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
            await window.ZakiMessages.markDelivered(
              conversationId,
              currentUser.id
            );

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

const callType =
  new URLSearchParams(window.location.search).get("call");

const voiceBtn =
  document.getElementById("voice-call-button");

const videoBtn =
  document.getElementById("video-call-button");

if (voiceBtn) {
  voiceBtn.onclick = () =>
    window.ZakiCommunication?.startCall("voice");
}

if (videoBtn) {
  videoBtn.onclick = () =>
    window.ZakiCommunication?.startCall("video");
}

if (
  callType === "voice" ||
  callType === "video"
) {
  setTimeout(() => {
    window.ZakiCommunication?.startCall(callType);
  }, 500);
}

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
