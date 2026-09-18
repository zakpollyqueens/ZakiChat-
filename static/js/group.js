(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", async () => {
    const config = window.ZakiChatConfig;

    if (
      !window.supabase ||
      !config ||
      !window.ZakiMessages ||
      !window.ZakiRealtime
    ) {
      console.error(
        "ZakiChat Group: required modules are unavailable."
      );
      return;
    }

    const db = window.supabase.createClient(
      config.supabaseUrl,
      config.supabaseKey
    );

    window.ZakiMessages.init(config);
    window.ZakiRealtime.init(config);

    const groupAvatar =
      document.getElementById("groupAvatar");

    const groupTitle =
      document.getElementById("groupTitle");

    const groupMembers =
      document.getElementById("groupMembers");

    const messagesPanel =
      document.getElementById("groupMessages");

    const composer =
      document.getElementById("groupComposer");

    const messageInput =
      document.getElementById("groupMessageInput");

    const attachButton =
      document.getElementById("groupAttachButton");

    const menuButton =
      document.getElementById("groupMenuButton");

    const params =
      new URLSearchParams(
        window.location.search
      );

    const groupId = params.get("id");

    let currentUser = null;
    let group = null;
    let conversationId = null;
    let profiles = new Map();
    let loadingMessages = false;
    let sendingMessage = false;

    function escapeHtml(value) {
      const div =
        document.createElement("div");

      div.textContent =
        value == null
          ? ""
          : String(value);

      return div.innerHTML;
    }

    function initials(profileOrName) {
      const name =
        typeof profileOrName === "string"
          ? profileOrName
          : profileOrName?.full_name ||
            profileOrName?.username ||
            "Z";

      const letters =
        name
          .trim()
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map(word =>
            word
              .charAt(0)
              .toUpperCase()
          )
          .join("");

      return letters || "Z";
    }

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

    function formatDate(value) {
      if (!value) return "";

      const date = new Date(value);

      if (Number.isNaN(date.getTime())) {
        return "";
      }

      const today = new Date();

      const sameDay =
        date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate();

      if (sameDay) {
        return "Today";
      }

      return date.toLocaleDateString([], {
        weekday: "long",
        month: "short",
        day: "numeric"
      });
    }

    function setHeader() {
      if (!group) return;

      const name =
        group.name ||
        "ZakiChat Group";

      groupTitle.textContent = name;

      groupAvatar.textContent =
        initials(name);

      const count =
        Array.isArray(group.group_members)
          ? group.group_members.length
          : 0;

      groupMembers.textContent =
        `${count} member${count === 1 ? "" : "s"}`;
    }

    function showNotice(
      message,
      isError = false
    ) {
      if (!messagesPanel) return;

      messagesPanel.innerHTML = "";

      const notice =
        document.createElement("div");

      notice.className =
        "empty-groups";

      notice.style.margin = "auto";
      notice.style.maxWidth = "420px";

      const strong =
        document.createElement("strong");

      strong.textContent =
        isError
          ? "Unable to open group"
          : message;

      const span =
        document.createElement("span");

      span.textContent =
        isError
          ? message
          : "";

      notice.appendChild(strong);

      if (isError) {
        notice.appendChild(span);
      }

      messagesPanel.appendChild(notice);
    }

    function buildDateDivider(dateLabel) {
      const divider =
        document.createElement("div");

      divider.className =
        "group-date-divider";

      const span =
        document.createElement("span");

      span.textContent = dateLabel;

      divider.appendChild(span);

      return divider;
    }

    function buildMessage(message) {
      const isMine =
        message.sender_id ===
        currentUser.id;

      const profile =
        profiles.get(message.sender_id) ||
        null;

      const senderName =
        isMine
          ? "You"
          : profile?.full_name ||
            profile?.username ||
            "ZakiChat User";

      const wrapper =
        document.createElement("div");

      wrapper.className =
        `group-message ${
          isMine
            ? "sent"
            : "received"
        }`;

      wrapper.dataset.messageId =
        message.id;

      if (!isMine) {
        const avatar =
          document.createElement("div");

        avatar.className =
          "group-message-avatar";

        avatar.textContent =
          initials(profile || senderName);

        wrapper.appendChild(avatar);
      }

      const content =
        document.createElement("div");

      content.className =
        "group-message-content";

      if (!isMine) {
        const sender =
          document.createElement("strong");

        sender.textContent =
          senderName;

        content.appendChild(sender);
      }

      const text =
        document.createElement("p");

      if (message.deleted_at) {
        text.textContent =
          "Message deleted";
      } else {
        text.textContent =
          message.content || "";
      }

      content.appendChild(text);

      const time =
        document.createElement("small");

      let timeText =
        formatTime(message.created_at);

      if (
        isMine &&
        message.read_at
      ) {
        timeText += " ✓✓";
      } else if (isMine) {
        timeText += " ✓";
      }

      if (
        message.edited_at &&
        !message.deleted_at
      ) {
        timeText += " · edited";
      }

      time.textContent =
        timeText;

      content.appendChild(time);

      wrapper.appendChild(content);

      return wrapper;
    }

    function renderMessages(messages) {
      if (!messagesPanel) return;

      messagesPanel.innerHTML = "";

      if (!messages.length) {
        const empty =
          document.createElement("div");

        empty.className =
          "empty-groups";

        empty.style.margin = "auto";
        empty.style.maxWidth = "420px";

        const strong =
          document.createElement("strong");

        strong.textContent =
          "No messages yet";

        const span =
          document.createElement("span");

        span.textContent =
          "Be the first to send a message to this group.";

        empty.appendChild(strong);
        empty.appendChild(span);

        messagesPanel.appendChild(empty);
        return;
      }

      let previousDate = "";

      messages.forEach(message => {
        const dateLabel =
          formatDate(
            message.created_at
          );

        if (dateLabel !== previousDate) {
          messagesPanel.appendChild(
            buildDateDivider(
              dateLabel
            )
          );

          previousDate =
            dateLabel;
        }

        messagesPanel.appendChild(
          buildMessage(message)
        );
      });
    }

    function scrollToBottom(smooth = false) {
      if (!messagesPanel) return;

      messagesPanel.scrollTo({
        top: messagesPanel.scrollHeight,
        behavior: smooth
          ? "smooth"
          : "auto"
      });
    }

    async function loadProfiles(messages) {
      const userIds = [
        ...new Set(
          messages
            .map(
              message =>
                message.sender_id
            )
            .filter(Boolean)
        )
      ];

      const missingIds =
        userIds.filter(
          id => !profiles.has(id)
        );

      if (!missingIds.length) {
        return;
      }

      const {
        data,
        error
      } = await db
        .from("profiles")
        .select(`
          id,
          username,
          full_name,
          avatar_url,
          is_online,
          last_seen
        `)
        .in("id", missingIds);

      if (error) {
        console.error(
          "Failed to load group message profiles:",
          error
        );
        return;
      }

      (data || []).forEach(profile => {
        profiles.set(
          profile.id,
          profile
        );
      });
    }

    async function loadGroup() {
      const {
        data,
        error
      } = await db
        .from("groups")
        .select(`
          id,
          conversation_id,
          name,
          description,
          avatar_url,
          created_by,
          created_at,
          updated_at,
          group_members (
            user_id,
            role,
            joined_at,
            profiles (
              id,
              username,
              full_name,
              avatar_url,
              is_online,
              last_seen
            )
          )
        `)
        .eq("id", groupId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data) {
        throw new Error(
          "Group not found."
        );
      }

      group = data;
      conversationId =
        data.conversation_id;

      const membership =
        (data.group_members || [])
          .find(
            member =>
              member.user_id ===
              currentUser.id
          );

      if (!membership) {
        throw new Error(
          "You are not a member of this group."
        );
      }

      (data.group_members || [])
        .forEach(member => {
          if (member.profiles) {
            profiles.set(
              member.user_id,
              member.profiles
            );
          }
        });

      setHeader();
    }

    async function loadMessages() {
      if (
        !conversationId ||
        loadingMessages
      ) {
        return;
      }

      loadingMessages = true;

      try {
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

        const messages =
          data || [];

        await loadProfiles(messages);

        renderMessages(messages);

        await window.ZakiMessages.markRead(
          conversationId,
          currentUser.id
        );

        scrollToBottom();
      } finally {
        loadingMessages = false;
      }
    }

    async function sendMessage() {
      if (
        sendingMessage ||
        !conversationId ||
        !currentUser ||
        !messageInput
      ) {
        return;
      }

      const content =
        messageInput.value.trim();

      if (!content) {
        return;
      }

      sendingMessage = true;
      messageInput.disabled = true;

      try {
        const {
          data,
          error
        } =
          await window.ZakiMessages.send(
            conversationId,
            currentUser.id,
            content
          );

        if (error) {
          throw error;
        }

        messageInput.value = "";

        if (data) {
          profiles.set(
            currentUser.id,
            {
              id: currentUser.id,
              full_name:
                currentUser.user_metadata
                  ?.full_name ||
                currentUser.user_metadata
                  ?.display_name ||
                currentUser.email ||
                "You",
              username:
                currentUser.user_metadata
                  ?.username ||
                ""
            }
          );
        }

        await loadMessages();
      } catch (error) {
        console.error(
          "Group message send failed:",
          error
        );

        alert(
          error?.message ||
          "Unable to send message."
        );
      } finally {
        sendingMessage = false;
        messageInput.disabled = false;
        messageInput.focus();
      }
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

          try {
            if (
              message.sender_id
            ) {
              await loadProfiles([
                message
              ]);
            }

            /*
             * Reloading keeps the group UI synchronized
             * with reply previews, edits, deletes,
             * attachments and read state.
             */
            await loadMessages();
          } catch (error) {
            console.error(
              "Group realtime refresh failed:",
              error
            );
          }
        }
      );
    }

    function setupComposer() {
      composer?.addEventListener(
        "submit",
        async event => {
          event.preventDefault();
          await sendMessage();
        }
      );

      messageInput?.addEventListener(
        "keydown",
        async event => {
          if (
            event.key === "Enter" &&
            !event.shiftKey
          ) {
            event.preventDefault();
            await sendMessage();
          }
        }
      );

      attachButton?.addEventListener(
        "click",
        () => {
          alert(
            "Group attachments will be connected in the media/chat extensions phase."
          );
        }
      );

      menuButton?.addEventListener(
        "click",
        () => {
          alert(
            "Group management options will be added in the group controls phase."
          );
        }
      );
    }

    function cleanup() {
      if (
        conversationId &&
        window.ZakiRealtime
      ) {
        window.ZakiRealtime.unsubscribe(
          `messages:${conversationId}`
        );
      }
    }

    window.addEventListener(
      "beforeunload",
      cleanup
    );

    try {
      if (!groupId) {
        showNotice(
          "No group was selected.",
          true
        );
        return;
      }

      const {
        data: {
          user
        }
      } =
        await db.auth.getUser();

      currentUser =
        user || null;

      if (!currentUser) {
        window.location.href =
          "login.html";
        return;
      }

      setupComposer();

      await loadGroup();
      await loadMessages();

      subscribeToMessages();

      messageInput?.focus();
    } catch (error) {
      console.error(
        "ZakiChat group initialization failed:",
        error
      );

      showNotice(
        error?.message ||
        "Unable to load this group.",
        true
      );
    }
  });
})();
