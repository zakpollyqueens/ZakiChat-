(function () {
  "use strict";

  const ZakiMessages = {
    db: null,

    init(config) {
      if (!window.supabase || !config) {
        console.error(
          "ZakiChat Messages: initialization data unavailable."
        );
        return null;
      }

      this.db = window.supabase.createClient(
        config.supabaseUrl,
        config.supabaseKey
      );

      return this;
    },

    escapeText(value) {
      const div = document.createElement("div");
      div.textContent = value == null ? "" : String(value);
      return div.innerHTML;
    },

    formatTime(value) {
      if (!value) return "";

      const date = new Date(value);

      if (Number.isNaN(date.getTime())) {
        return "";
      }

      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      });
    },

    getMessageType(message) {
      return message?.message_type || "text";
    },

    getReadMark(message, currentUserId) {
      if (!message || message.sender_id !== currentUserId) {
        return "";
      }

      if (message.read_at) {
        return "✓✓";
      }

      return "✓";
    },

    async attachReplyPreviews(messages) {
      if (!this.db || !Array.isArray(messages)) {
        return messages || [];
      }

      const replyIds = [
        ...new Set(
          messages
            .map(message => message.reply_to_message_id)
            .filter(Boolean)
        )
      ];

      if (!replyIds.length) {
        return messages;
      }

      const { data, error } =
        await this.db
          .from("messages")
          .select(`
            id,
            content,
            deleted_at
          `)
          .in("id", replyIds);

      if (error) {
        console.error(
          "Failed to load reply previews:",
          error
        );

        return messages;
      }

      const replyMap = new Map(
        (data || []).map(message => [
          message.id,
          message
        ])
      );

      return messages.map(message => {
        if (!message.reply_to_message_id) {
          return message;
        }

        const repliedTo =
          replyMap.get(message.reply_to_message_id);

        return {
          ...message,
          reply_to_content:
            repliedTo?.deleted_at
              ? "Message deleted"
              : repliedTo?.content ||
                "Message unavailable"
        };
      });
    },

    async load(conversationId) {
      if (!this.db || !conversationId) {
        return {
          data: [],
          error: new Error(
            "Messages client is not initialized."
          )
        };
      }

      const { data, error } =
        await this.db
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
            read_at,
            reply_to_message_id,
            deleted_at
          `)
          .eq("conversation_id", conversationId)
          .order("created_at", {
            ascending: true
          });

      if (error) {
        return {
          data: [],
          error
        };
      }

      const messages =
        await this.attachReplyPreviews(data || []);

      return {
        data: messages,
        error: null
      };
    },

    async send(
      conversationId,
      senderId,
      content,
      replyToMessageId = null
    ) {
      if (!this.db) {
        return {
          data: null,
          error: new Error(
            "Messages client is not initialized."
          )
        };
      }

      const payload = {
        conversation_id: conversationId,
        sender_id: senderId,
        content: content.trim(),
        message_type: "text"
      };

      if (replyToMessageId) {
        payload.reply_to_message_id =
          replyToMessageId;
      }

      const { data, error } =
        await this.db
          .from("messages")
          .insert(payload)
          .select(`
            id,
            conversation_id,
            sender_id,
            content,
            message_type,
            created_at,
            updated_at,
            edited_at,
            read_at,
            reply_to_message_id,
            deleted_at
          `)
          .single();

      if (error) {
        return {
          data: null,
          error
        };
      }

      const enriched =
        await this.attachReplyPreviews([data]);

      return {
        data: enriched[0] || data,
        error: null
      };
    },

    async edit(
      messageId,
      senderId,
      content
    ) {
      if (!this.db) {
        return {
          data: null,
          error: new Error(
            "Messages client is not initialized."
          )
        };
      }

      const { data, error } =
        await this.db
          .from("messages")
          .update({
            content: content.trim()
          })
          .eq("id", messageId)
          .eq("sender_id", senderId)
          .is("deleted_at", null)
          .select(`
            id,
            conversation_id,
            sender_id,
            content,
            message_type,
            created_at,
            updated_at,
            edited_at,
            read_at,
            reply_to_message_id,
            deleted_at
          `)
          .single();

      if (error) {
        return {
          data: null,
          error
        };
      }

      const enriched =
        await this.attachReplyPreviews([data]);

      return {
        data: enriched[0] || data,
        error: null
      };
    },

    async markRead(
      conversationId,
      currentUserId
    ) {
      if (!this.db || !conversationId || !currentUserId) {
        return {
          error: new Error(
            "Messages client is not initialized."
          )
        };
      }

      const { error } =
        await this.db
          .from("messages")
          .update({
            read_at: new Date().toISOString()
          })
          .eq("conversation_id", conversationId)
          .neq("sender_id", currentUserId)
          .is("read_at", null)
          .is("deleted_at", null);

      return { error };
    },

    async delete(
      messageId,
      currentUserId
    ) {
      if (!this.db) {
        return {
          data: null,
          error: new Error(
            "Messages client is not initialized."
          )
        };
      }

      const { data, error } =
        await this.db
          .from("messages")
          .update({
            deleted_at:
              new Date().toISOString(),
            content: "Message deleted"
          })
          .eq("id", messageId)
          .eq("sender_id", currentUserId)
          .is("deleted_at", null)
          .select(`
            id,
            conversation_id,
            sender_id,
            content,
            message_type,
            created_at,
            updated_at,
            edited_at,
            read_at,
            reply_to_message_id,
            deleted_at
          `)
          .single();

      if (error) {
        return {
          data: null,
          error
        };
      }

      const enriched =
        await this.attachReplyPreviews([data]);

      return {
        data: enriched[0] || data,
        error: null
      };
    },

    getReplyPreview(message) {
      if (!message?.reply_to_message_id) {
        return "";
      }

      return (
        message.reply_to_content ||
        "Message unavailable"
      );
    },

    renderMessage(
      message,
      currentUserId
    ) {
      const mine =
        message.sender_id === currentUserId;

      const deleted =
        Boolean(message.deleted_at);

      const messageType =
        this.getMessageType(message);

      const bubble =
        document.createElement("div");

      bubble.className =
        `message-bubble ${
          mine
            ? "sent-bubble"
            : "received-bubble"
        }`;

      if (deleted) {
        bubble.classList.add(
          "deleted-message"
        );
      }

      bubble.dataset.messageId =
        message.id;

      const replyPreview =
        this.getReplyPreview(message);

      let html = "";

      if (replyPreview) {
        html += `
          <div class="message-reply-preview">
            <strong>Reply</strong>
            <span>${this.escapeText(
              replyPreview
            )}</span>
          </div>
        `;
      }

      const displayedContent =
        deleted
          ? "Message deleted"
          : message.content || "";

      html += `
        <div class="message-text">
          ${this.escapeText(
            displayedContent
          )}
        </div>
      `;

      const edited =
        message.edited_at &&
        !deleted
          ? `<span class="message-edited">edited</span>`
          : "";

      const readMark =
        this.getReadMark(
          message,
          currentUserId
        );

      html += `
        <div class="message-meta">
          <time>${this.escapeText(
            this.formatTime(
              message.created_at
            )
          )}</time>
          ${edited}
          ${
            mine && !deleted
              ? `<span class="message-read-mark">${readMark}</span>`
              : ""
          }
        </div>
      `;

      if (!deleted) {
        html += `
          <div class="message-actions">
            <button
              type="button"
              data-message-action="reply"
              data-message-id="${this.escapeText(
                message.id
              )}"
              aria-label="Reply to message"
              title="Reply"
            >↩</button>

            ${
              mine
                ? `
                  <button
                    type="button"
                    data-message-action="edit"
                    data-message-id="${this.escapeText(
                      message.id
                    )}"
                    aria-label="Edit message"
                    title="Edit"
                  >✎</button>

                  <button
                    type="button"
                    data-message-action="delete"
                    data-message-id="${this.escapeText(
                      message.id
                    )}"
                    aria-label="Delete message"
                    title="Delete"
                  >🗑</button>
                `
                : ""
            }
          </div>
        `;
      }

      bubble.innerHTML = html;

      return bubble;
    },

    render(
      messages,
      currentUserId
    ) {
      return (messages || []).map(
        message =>
          this.renderMessage(
            message,
            currentUserId
          )
      );
    },

    renderInto(
      container,
      messages,
      currentUserId
    ) {
      if (!container) return;

      container.innerHTML = "";

      const rendered =
        this.render(
          messages,
          currentUserId
        );

      rendered.forEach(element => {
        container.appendChild(element);
      });
    },

    appendIfMissing(
      container,
      message,
      currentUserId
    ) {
      if (!container || !message?.id) {
        return false;
      }

      if (
        container.querySelector(
          `[data-message-id="${CSS.escape(
            message.id
          )}"]`
        )
      ) {
        return false;
      }

      const element =
        this.renderMessage(
          message,
          currentUserId
        );

      container.appendChild(element);

      return true;
    },

    updateMessage(
      container,
      message,
      currentUserId
    ) {
      if (!container || !message?.id) {
        return;
      }

      const existing =
        container.querySelector(
          `[data-message-id="${CSS.escape(
            message.id
          )}"]`
        );

      const replacement =
        this.renderMessage(
          message,
          currentUserId
        );

      if (existing) {
        existing.replaceWith(
          replacement
        );
      } else {
        container.appendChild(
          replacement
        );
      }
    },

    removeMessage(
      container,
      messageId
    ) {
      if (!container || !messageId) {
        return;
      }

      const element =
        container.querySelector(
          `[data-message-id="${CSS.escape(
            messageId
          )}"]`
        );

      element?.remove();
    }
  };

  window.ZakiMessages =
    ZakiMessages;
})();
