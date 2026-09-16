(function () {
  "use strict";

  const ZakiMessages = {
    db: null,

    init(config) {
      if (!window.supabase || !config) return null;
      if (this.db) return this;

      this.db = window.supabase.createClient(
        config.supabaseUrl,
        config.supabaseKey
      );

      return this;
    },

    escapeText(value) {
      return String(value ?? "");
    },

    formatTime(value) {
      if (!value) return "";

      const date = new Date(value);

      if (Number.isNaN(date.getTime())) return "";

      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      });
    },

    getMessageType(message) {
      return message?.message_type || "text";
    },

    getReadMark(message, currentUserId) {
      if (message?.sender_id !== currentUserId) return "";
      return message.read_at ? " ✓✓" : " ✓";
    },

    async load(conversationId) {
      if (!this.db || !conversationId) {
        return {
          data: [],
          error: new Error("Conversation is not available.")
        };
      }

      return await this.db
        .from("messages")
        .select(`
          id,
          conversation_id,
          sender_id,
          content,
          message_type,
          created_at,
          updated_at,
          edited_at,
          read_at
        `)
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
    },

    async send(conversationId, senderId, content) {
      if (!this.db) {
        return {
          data: null,
          error: new Error("Messages client is not initialized.")
        };
      }

      const text = this.escapeText(content).trim();

      if (!conversationId || !senderId || !text) {
        return {
          data: null,
          error: new Error("Message content is required.")
        };
      }

      return await this.db
        .from("messages")
        .insert({
          conversation_id: conversationId,
          sender_id: senderId,
          content: text,
          message_type: "text"
        })
        .select(`
          id,
          conversation_id,
          sender_id,
          content,
          message_type,
          created_at,
          updated_at,
          edited_at,
          read_at
        `)
        .single();
    },

    async edit(messageId, currentUserId, content) {
      if (!this.db || !messageId || !currentUserId) {
        return {
          data: null,
          error: new Error("Message information is missing.")
        };
      }

      const text = this.escapeText(content).trim();

      if (!text) {
        return {
          data: null,
          error: new Error("Message content is required.")
        };
      }

      return await this.db
        .from("messages")
        .update({ content: text })
        .eq("id", messageId)
        .eq("sender_id", currentUserId)
        .select(`
          id,
          conversation_id,
          sender_id,
          content,
          message_type,
          created_at,
          updated_at,
          edited_at,
          read_at
        `)
        .single();
    },

    async markRead(conversationId, currentUserId) {
      if (!this.db || !conversationId || !currentUserId) {
        return { data: null, error: null };
      }

      const {
        data: unread,
        error: loadError
      } = await this.db
        .from("messages")
        .select("id")
        .eq("conversation_id", conversationId)
        .neq("sender_id", currentUserId)
        .is("read_at", null);

      if (loadError) {
        return { data: null, error: loadError };
      }

      const ids = (unread || []).map(message => message.id);

      if (!ids.length) {
        return { data: [], error: null };
      }

      return await this.db
        .from("messages")
        .update({
          read_at: new Date().toISOString()
        })
        .in("id", ids)
        .select("id, read_at");
    },

    render(message, currentUserId) {
      const bubble = document.createElement("div");

      const mine = message.sender_id === currentUserId;

      bubble.className =
        `bubble ${mine ? "sent-bubble" : "received-bubble"}`;

      bubble.dataset.messageId = message.id;
      bubble.dataset.messageType = this.getMessageType(message);

      const content = document.createElement("span");
      content.className = "message-text";
      content.textContent = this.escapeText(message.content);

      const meta = document.createElement("small");

      meta.textContent =
        `${this.formatTime(message.created_at)}` +
        `${message.edited_at ? " · edited" : ""}` +
        `${this.getReadMark(message, currentUserId)}`;

      const body = document.createElement("div");
      body.className = "bubble-content";
      body.appendChild(content);
      body.appendChild(meta);
      bubble.appendChild(body);

      if (mine) {
        const actions = document.createElement("div");
        actions.className = "message-actions";

        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.className = "message-action message-edit";
        editButton.textContent = "Edit";
        editButton.dataset.messageAction = "edit";
        editButton.dataset.messageId = message.id;

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "message-action message-delete";
        deleteButton.textContent = "Delete";
        deleteButton.dataset.messageAction = "delete";
        deleteButton.dataset.messageId = message.id;

        actions.appendChild(editButton);
        actions.appendChild(deleteButton);
        bubble.appendChild(actions);
      }

      return bubble;
    },

    renderInto(container, messages, currentUserId) {
      if (!container) return;

      container.innerHTML = "";

      (messages || []).forEach(message => {
        container.appendChild(
          this.render(message, currentUserId)
        );
      });

      container.scrollTop = container.scrollHeight;
    },

    appendIfMissing(container, message, currentUserId) {
      if (!container || !message?.id) return false;

      const existing =
        container.querySelector(
          `[data-message-id="${message.id}"]`
        );

      if (existing) return false;

      container.appendChild(
        this.render(message, currentUserId)
      );

      container.scrollTop = container.scrollHeight;
      return true;
    },

    updateMessage(container, message, currentUserId) {
      if (!container || !message?.id) return false;

      const existing =
        container.querySelector(
          `[data-message-id="${message.id}"]`
        );

      if (!existing) {
        return this.appendIfMissing(
          container,
          message,
          currentUserId
        );
      }

      existing.replaceWith(
        this.render(message, currentUserId)
      );

      return true;
    },

    removeMessage(container, messageId) {
      if (!container || !messageId) return false;

      const element =
        container.querySelector(
          `[data-message-id="${messageId}"]`
        );

      if (!element) return false;

      element.remove();
      return true;
    },

    async delete(messageId, currentUserId) {
      if (!this.db || !messageId || !currentUserId) {
        return {
          data: null,
          error: new Error("Message information is missing.")
        };
      }

      return await this.db
        .from("messages")
        .delete()
        .eq("id", messageId)
        .eq("sender_id", currentUserId)
        .select()
        .single();
    }
  };

  window.ZakiMessages = ZakiMessages;
})();
