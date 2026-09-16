document.addEventListener("DOMContentLoaded", async () => {
  if (!window.supabase || !window.ZakiChatConfig) {
    console.error("ZakiChat: Supabase configuration unavailable.");
    return;
  }

  const db = window.supabase.createClient(
    window.ZakiChatConfig.supabaseUrl,
    window.ZakiChatConfig.supabaseKey
  );

  const messagesPanel = document.querySelector(".messages-panel");
  const composer = document.querySelector(".message-composer");
  const messageInput = composer?.querySelector("input");
  const chatUserName = document.querySelector(".chat-user strong");
  const chatUserStatus = document.querySelector(".chat-user span");
  const chatAvatar = document.querySelector(".chat-user .conversation-avatar");

  const params = new URLSearchParams(window.location.search);
  const targetUserId = params.get("user");

  let currentUser = null;
  let targetProfile = null;
  let conversationId = null;
  let realtimeChannel = null;

  function escapeText(value) {
    return String(value ?? "");
  }

  function initials(profile) {
    const name =
      profile?.full_name ||
      profile?.username ||
      "Z";

    return name
      .split(/\s+/)
      .slice(0, 2)
      .map(word => word.charAt(0).toUpperCase())
      .join("") || "Z";
  }

  function formatTime(value) {
    if (!value) return "";

    return new Date(value).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function showStatus(text, error = false) {
    if (!chatUserStatus) return;

    chatUserStatus.textContent = text;
    chatUserStatus.style.color = error ? "#ff8f9c" : "";
  }

  function updateHeader() {
    if (!targetProfile) return;

    const name =
      targetProfile.full_name ||
      targetProfile.username ||
      "ZakiChat User";

    if (chatUserName) {
      chatUserName.textContent = name;
    }

    if (chatAvatar) {
      if (targetProfile.avatar_url) {
        chatAvatar.style.backgroundImage =
          `url("${targetProfile.avatar_url}")`;
        chatAvatar.style.backgroundSize = "cover";
        chatAvatar.style.backgroundPosition = "center";
        chatAvatar.textContent = "";
      } else {
        chatAvatar.style.backgroundImage = "";
        chatAvatar.textContent = initials(targetProfile);
      }
    }

    showStatus(
      targetProfile.is_online
        ? "online"
        : targetProfile.last_seen
          ? `last seen ${formatTime(targetProfile.last_seen)}`
          : "offline"
    );
  }

  function clearMessages() {
    if (!messagesPanel) return;

    messagesPanel.innerHTML = "";
  }

  function renderMessage(message) {
    if (!messagesPanel) return;

    const bubble = document.createElement("div");

    const mine = message.sender_id === currentUser.id;

    bubble.className =
      `bubble ${mine ? "sent-bubble" : "received-bubble"}`;

    bubble.dataset.messageId = message.id;

    const content = document.createTextNode(
      escapeText(message.content)
    );

    const meta = document.createElement("small");
    meta.textContent =
      `${formatTime(message.created_at)}${mine ? " ✓" : ""}`;

    bubble.appendChild(content);
    bubble.appendChild(meta);

    messagesPanel.appendChild(bubble);
  }

  function scrollToBottom() {
    if (!messagesPanel) return;

    messagesPanel.scrollTop = messagesPanel.scrollHeight;
  }

  async function loadTargetProfile() {
    const { data, error } = await db
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

    if (error) throw error;

    if (!data) {
      throw new Error("ZakiChat user not found.");
    }

    targetProfile = data;
    updateHeader();
  }

  async function getConversation() {
    const { data, error } = await db.rpc(
      "get_or_create_direct_conversation",
      {
        p_other_user_id: targetUserId
      }
    );

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error("Unable to create conversation.");
    }

    conversationId = data;
  }

  async function loadMessages() {
    if (!conversationId) return;

    const { data, error } = await db
      .from("messages")
      .select(`
        id,
        conversation_id,
        sender_id,
        content,
        created_at,
        read_at
      `)
      .eq("conversation_id", conversationId)
      .order("created_at", {
        ascending: true
      });

    if (error) throw error;

    clearMessages();

    (data || []).forEach(renderMessage);

    scrollToBottom();

    await markMessagesRead(data || []);
  }

  async function markMessagesRead(messages) {
    const unreadIds = messages
      .filter(
        message =>
          message.sender_id !== currentUser.id &&
          !message.read_at
      )
      .map(message => message.id);

    if (!unreadIds.length) return;

    const { error } = await db
      .from("messages")
      .update({
        read_at: new Date().toISOString()
      })
      .in("id", unreadIds);

    if (error) {
      console.warn(
        "Unable to mark messages as read:",
        error
      );
    }
  }

  function subscribeToMessages() {
    if (!conversationId) return;

    realtimeChannel = db
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`
        },
        payload => {
          const message = payload.new;

          if (!message?.id) return;

          const existing = document.querySelector(
            `[data-message-id="${message.id}"]`
          );

          if (existing) return;

          renderMessage(message);
          scrollToBottom();

          if (message.sender_id !== currentUser.id) {
            markMessagesRead([message]);
          }
        }
      )
      .subscribe(status => {
        console.log(
          "ZakiChat realtime:",
          status
        );
      });
  }

  async function sendMessage() {
    if (!currentUser || !conversationId) return;

    const content =
      messageInput?.value.trim() || "";

    if (!content) return;

    if (messageInput) {
      messageInput.disabled = true;
    }

    try {
      const { data, error } = await db
        .
cd ~/downloads/ZakiChat-

cat > static/js/chat.js <<'EOF'
document.addEventListener("DOMContentLoaded", async () => {
  if (!window.supabase || !window.ZakiChatConfig) {
    console.error("ZakiChat: Supabase configuration unavailable.");
    return;
  }

  const db = window.supabase.createClient(
    window.ZakiChatConfig.supabaseUrl,
    window.ZakiChatConfig.supabaseKey
  );

  const messagesPanel = document.querySelector(".messages-panel");
  const composer = document.querySelector(".message-composer");
  const messageInput = composer?.querySelector("input");
  const chatUserName = document.querySelector(".chat-user strong");
  const chatUserStatus = document.querySelector(".chat-user span");
  const chatAvatar = document.querySelector(".chat-user .conversation-avatar");

  const params = new URLSearchParams(window.location.search);
  const targetUserId = params.get("user");

  let currentUser = null;
  let targetProfile = null;
  let conversationId = null;
  let realtimeChannel = null;

  function escapeText(value) {
    return String(value ?? "");
  }

  function initials(profile) {
    const name =
      profile?.full_name ||
      profile?.username ||
      "Z";

    return name
      .split(/\s+/)
      .slice(0, 2)
      .map(word => word.charAt(0).toUpperCase())
      .join("") || "Z";
  }

  function formatTime(value) {
    if (!value) return "";

    return new Date(value).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function showStatus(text, error = false) {
    if (!chatUserStatus) return;

    chatUserStatus.textContent = text;
    chatUserStatus.style.color = error ? "#ff8f9c" : "";
  }

  function updateHeader() {
    if (!targetProfile) return;

    const name =
      targetProfile.full_name ||
      targetProfile.username ||
      "ZakiChat User";

    if (chatUserName) {
      chatUserName.textContent = name;
    }

    if (chatAvatar) {
      if (targetProfile.avatar_url) {
        chatAvatar.style.backgroundImage =
          `url("${targetProfile.avatar_url}")`;
        chatAvatar.style.backgroundSize = "cover";
        chatAvatar.style.backgroundPosition = "center";
        chatAvatar.textContent = "";
      } else {
        chatAvatar.style.backgroundImage = "";
        chatAvatar.textContent = initials(targetProfile);
      }
    }

    showStatus(
      targetProfile.is_online
        ? "online"
        : targetProfile.last_seen
          ? `last seen ${formatTime(targetProfile.last_seen)}`
          : "offline"
    );
  }

  function clearMessages() {
    if (!messagesPanel) return;

    messagesPanel.innerHTML = "";
  }

  function renderMessage(message) {
    if (!messagesPanel) return;

    const bubble = document.createElement("div");

    const mine = message.sender_id === currentUser.id;

    bubble.className =
      `bubble ${mine ? "sent-bubble" : "received-bubble"}`;

    const content = document.createTextNode(
      escapeText(message.content)
    );

    const meta = document.createElement("small");
    meta.textContent =
      `${formatTime(message.created_at)}${mine ? " ✓" : ""}`;

    bubble.appendChild(content);
    bubble.appendChild(meta);

    messagesPanel.appendChild(bubble);
  }

  function scrollToBottom() {
    if (!messagesPanel) return;

    messagesPanel.scrollTop = messagesPanel.scrollHeight;
  }

  async function loadTargetProfile() {
    const { data, error } = await db
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

    if (error) throw error;

    if (!data) {
      throw new Error("ZakiChat user not found.");
    }

    targetProfile = data;
    updateHeader();
  }

  async function getConversation() {
    const { data, error } = await db.rpc(
      "get_or_create_direct_conversation",
      {
        p_other_user_id: targetUserId
      }
    );

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error("Unable to create conversation.");
    }

    conversationId = data;
  }

  async function loadMessages() {
    if (!conversationId) return;

    const { data, error } = await db
      .from("messages")
      .select(`
        id,
        conversation_id,
        sender_id,
        content,
        created_at,
        read_at
      `)
      .eq("conversation_id", conversationId)
      .order("created_at", {
        ascending: true
      });

    if (error) throw error;

    clearMessages();

    (data || []).forEach(renderMessage);

    scrollToBottom();

    await markMessagesRead(data || []);
  }

  async function markMessagesRead(messages) {
    const unreadIds = messages
      .filter(
        message =>
          message.sender_id !== currentUser.id &&
          !message.read_at
      )
      .map(message => message.id);

    if (!unreadIds.length) return;

    const { error } = await db
      .from("messages")
      .update({
        read_at: new Date().toISOString()
      })
      .in("id", unreadIds);

    if (error) {
      console.warn(
        "Unable to mark messages as read:",
        error
      );
    }
  }

  function subscribeToMessages() {
    if (!conversationId) return;

    realtimeChannel = db
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`
        },
        payload => {
          const message = payload.new;

          if (!message?.id) return;

          const existing = document.querySelector(
            `[data-message-id="${message.id}"]`
          );

          if (existing) return;

          renderMessage(message);
          scrollToBottom();

          if (message.sender_id !== currentUser.id) {
            markMessagesRead([message]);
          }
        }
      )
      .subscribe(status => {
        console.log(
          "ZakiChat realtime:",
          status
        );
      });
  }

  async function sendMessage() {
    if (!currentUser || !conversationId) return;

    const content =
      messageInput?.value.trim() || "";

    if (!content) return;

    if (messageInput) {
      messageInput.disabled = true;
    }

    try {
      const { data, error } = await db
        .from("messages")
        .insert({
          conversation_id: conversationId,
          sender_id: currentUser.id,
          content
        })
        .select()
        .single();

      if (error) throw error;

      if (messageInput) {
        messageInput.value = "";
      }

      /*
       * Realtime normally renders the inserted message.
       * This fallback makes the sender see it immediately
       * if the realtime subscription has not fired yet.
       */
      if (data) {
        renderMessage(data);
        scrollToBottom();
      }

    } catch (error) {
      console.error(
        "Failed to send message:",
        error
      );

      alert(
        "Unable to send the message right now."
      );

    } finally {
      if (messageInput) {
        messageInput.disabled = false;
        messageInput.focus();
      }
    }
  }

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
      }
    );
  }

  window.addEventListener(
    "beforeunload",
    async () => {
      if (realtimeChannel) {
        await db.removeChannel(
          realtimeChannel
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

    currentUser = user || null;

    if (!currentUser) {
      showStatus("Please sign in", true);
      return;
    }

    if (!targetUserId) {
      clearMessages();

      if (messagesPanel) {
        const notice =
          document.createElement("div");

        notice.className = "empty-messages";
        notice.textContent =
          "Open a chat from your Contacts.";

        messagesPanel.appendChild(notice);
      }

      showStatus("No conversation selected");
      return;
    }

    if (targetUserId === currentUser.id) {
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
