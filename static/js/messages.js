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
      const div =
        document.createElement("div");

      div.textContent =
        value == null
          ? ""
          : String(value);

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
      return (
        message?.message_type ||
        "text"
      );
    },

    getReadMark(
      message,
      currentUserId
    ) {
      if (
        !message ||
        message.sender_id !==
          currentUserId
      ) {
        return "";
      }

      return message.read_at
        ? "✓✓"
        : "✓";
    },

    async attachReplyPreviews(
      messages
    ) {
      if (
        !this.db ||
        !Array.isArray(messages)
      ) {
        return messages || [];
      }

      const replyIds = [
        ...new Set(
          messages
            .map(
              message =>
                message.reply_to_message_id
            )
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

      const replyMap =
        new Map(
          (data || []).map(
            message => [
              message.id,
              message
            ]
          )
        );

      return messages.map(
        message => {
          if (
            !message.reply_to_message_id
          ) {
            return message;
          }

          const repliedTo =
            replyMap.get(
              message.reply_to_message_id
            );

          return {
            ...message,
            reply_to_content:
              repliedTo?.deleted_at
                ? "Message deleted"
                : repliedTo?.content ||
                  "Message unavailable"
          };
        }
      );
    },

    async enrichAttachments(
      messages
    ) {
      if (
        !window.ZakiMedia ||
        !Array.isArray(messages)
      ) {
        return messages || [];
      }

      return window.ZakiMedia.enrichMessages(
        messages
      );
    },

    async load(
      conversationId
    ) {
      if (
        !this.db ||
        !conversationId
      ) {
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
            deleted_at,
            attachment_path,
            attachment_name,
            attachment_mime_type,
            attachment_size
          `)
          .eq(
            "conversation_id",
            conversationId
          )
          .order(
            "created_at",
            {
              ascending: true
            }
          );

      if (error) {
        return {
          data: [],
          error
        };
      }

      let messages =
        await this.attachReplyPreviews(
          data || []
        );

      messages =
        await this.enrichAttachments(
          messages
        );

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

      const text =
        String(content || "").trim();

      if (!text) {
        return {
          data: null,
          error: new Error(
            "Message cannot be empty."
          )
        };
      }

      const payload = {
        conversation_id:
          conversationId,
        sender_id:
          senderId,
        content: text,
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
            deleted_at,
            attachment_path,
            attachment_name,
            attachment_mime_type,
            attachment_size
          `)
          .single();

      if (error) {
        return {
          data: null,
          error
        };
      }

      const enrichedReplies =
        await this.attachReplyPreviews([
          data
        ]);

      const enriched =
        await this.enrichAttachments(
          enrichedReplies
        );

      return {
        data:
          enriched[0] ||
          data,
        error: null
      };
    },

    async forward(
      sourceMessageId,
      targetConversationId,
      senderId
    ) {
      if (!this.db) {
        return {
          data: null,
          error: new Error(
            "Messages client is not initialized."
          )
        };
      }

      if (
        !sourceMessageId ||
        !targetConversationId ||
        !senderId
      ) {
        return {
          data: null,
          error: new Error(
            "Missing forwarding information."
          )
        };
      }

      const {
        data: source,
        error: sourceError
      } =
        await this.db
          .from("messages")
          .select(`
            id,
            sender_id,
            content,
            message_type,
            attachment_path,
            attachment_name,
            attachment_mime_type,
            attachment_size
          `)
          .eq("id", sourceMessageId)
          .maybeSingle();

      if (sourceError) {
        return {
          data: null,
          error: sourceError
        };
      }

      if (!source) {
        return {
          data: null,
          error: new Error(
            "The original message could not be found."
          )
        };
      }

      if (source.message_type !== "text") {
        return {
          data: null,
          error: new Error(
            "Forwarding attachments is not available yet."
          )
        };
      }

      if (!String(source.content || "").trim()) {
        return {
          data: null,
          error: new Error(
            "This message cannot be forwarded."
          )
        };
      }

      const payload = {
        conversation_id:
          targetConversationId,
        sender_id:
          senderId,
        content:
          String(source.content).trim(),
        message_type:
          "text",
        forwarded_from_message_id:
          source.id,
        forwarded_from_user_id:
          source.sender_id
      };

      const {
        data,
        error
      } =
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
            deleted_at,
            attachment_path,
            attachment_name,
            attachment_mime_type,
            attachment_size,
            forwarded_from_message_id,
            forwarded_from_user_id
          `)
          .single();

      if (error) {
        return {
          data: null,
          error
        };
      }

      return {
        data,
        error: null
      };
    },

    async sendAttachment(
      conversationId,
      senderId,
      attachment,
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

      if (!attachment?.path) {
        return {
          data: null,
          error: new Error(
            "Attachment information is missing."
          )
        };
      }

      const payload = {
        conversation_id:
          conversationId,
        sender_id:
          senderId,
        content:
          attachment.name ||
          "Attachment",
        message_type:
          attachment.message_type ||
          "file",
        attachment_path:
          attachment.path,
        attachment_name:
          attachment.name ||
          "Attachment",
        attachment_mime_type:
          attachment.mime_type ||
          "application/octet-stream",
        attachment_size:
          attachment.size || 0
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
            deleted_at,
            attachment_path,
            attachment_name,
            attachment_mime_type,
            attachment_size
          `)
          .single();

      if (error) {
        return {
          data: null,
          error
        };
      }

      const replies =
        await this.attachReplyPreviews([
          data
        ]);

      const enriched =
        await this.enrichAttachments(
          replies
        );

      return {
        data:
          enriched[0] ||
          data,
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

      const text =
        String(content || "").trim();

      if (!text) {
        return {
          data: null,
          error: new Error(
            "Message cannot be empty."
          )
        };
      }

      const { data, error } =
        await this.db
          .from("messages")
          .update({
            content: text
          })
          .eq("id", messageId)
          .eq("sender_id", senderId)
          .is("deleted_at", null)
          .eq(
            "message_type",
            "text"
          )
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
            deleted_at,
            attachment_path,
            attachment_name,
            attachment_mime_type,
            attachment_size
          `)
          .single();

      if (error) {
        return {
          data: null,
          error
        };
      }

      const replies =
        await this.attachReplyPreviews([
          data
        ]);

      const enriched =
        await this.enrichAttachments(
          replies
        );

      return {
        data:
          enriched[0] ||
          data,
        error: null
      };
    },

    async markRead(
      conversationId,
      currentUserId
    ) {
      if (
        !this.db ||
        !conversationId ||
        !currentUserId
      ) {
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
            read_at:
              new Date().toISOString()
          })
          .eq(
            "conversation_id",
            conversationId
          )
          .neq(
            "sender_id",
            currentUserId
          )
          .is(
            "read_at",
            null
          )
          .is(
            "deleted_at",
            null
          );

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
            content:
              "Message deleted"
          })
          .eq(
            "id",
            messageId
          )
          .eq(
            "sender_id",
            currentUserId
          )
          .is(
            "deleted_at",
            null
          )
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
            deleted_at,
            attachment_path,
            attachment_name,
            attachment_mime_type,
            attachment_size
          `)
          .single();

      if (error) {
        return {
          data: null,
          error
        };
      }

      const replies =
        await this.attachReplyPreviews([
          data
        ]);

      const enriched =
        await this.enrichAttachments(
          replies
        );

      return {
        data:
          enriched[0] ||
          data,
        error: null
      };
    },

    getReplyPreview(message) {
      if (
        !message?.reply_to_message_id
      ) {
        return "";
      }

      return (
        message.reply_to_content ||
        "Message unavailable"
      );
    },

    getAttachmentIcon(type) {
      if (type === "image") return "🖼️";
      if (type === "video") return "🎥";
      if (type === "audio") return "🎵";
      return "📎";
    },

    formatFileSize(size) {
      if (!size || size < 1) {
        return "";
      }

      const units = [
        "B",
        "KB",
        "MB",
        "GB"
      ];

      let value = Number(size);
      let index = 0;

      while (
        value >= 1024 &&
        index < units.length - 1
      ) {
        value /= 1024;
        index++;
      }

      return `${value < 10 && index > 0
        ? value.toFixed(1)
        : Math.round(value)
      } ${units[index]}`;
    },

    renderAttachment(
      message
    ) {
      const type =
        this.getMessageType(
          message
        );

      const url =
        message.attachment_url;

      const name =
        message.attachment_name ||
        "Attachment";

      if (!message.attachment_path) {
        return "";
      }

      if (!url) {
        return `
          <div class="message-attachment attachment-unavailable">
            <span>${this.escapeText(
              this.getAttachmentIcon(type)
            )}</span>
            <span>
              ${this.escapeText(name)}
            </span>
          </div>
        `;
      }

      if (type === "image") {
        return `
          <a
            class="message-attachment attachment-image"
            href="${this.escapeText(url)}"
            target="_blank"
            rel="noopener noreferrer"
          >
            <img
              src="${this.escapeText(url)}"
              alt="${this.escapeText(name)}"
              loading="lazy"
            >
          </a>
        `;
      }

      if (type === "video") {
        return `
          <div class="message-attachment attachment-video">
            <video
              controls
              preload="metadata"
              src="${this.escapeText(url)}"
            ></video>
          </div>
        `;
      }

      if (type === "audio") {
        return `
          <div class="message-attachment attachment-audio">
            <div class="attachment-file-name">
              🎵 ${this.escapeText(name)}
            </div>
            <audio
              controls
              preload="metadata"
              src="${this.escapeText(url)}"
            ></audio>
          </div>
        `;
      }

      return `
        <a
          class="message-attachment attachment-file"
          href="${this.escapeText(url)}"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span class="attachment-file-icon">📎</span>
          <span class="attachment-file-info">
            <strong>${this.escapeText(name)}</strong>
            <small>${this.escapeText(
              this.formatFileSize(
                message.attachment_size
              )
            )}</small>
          </span>
        </a>
      `;
    },

    renderMessage(
      message,
      currentUserId
    ) {
      const mine =
        message.sender_id ===
        currentUserId;

      const deleted =
        Boolean(message.deleted_at);

      const messageType =
        this.getMessageType(
          message
        );

      const bubble =
        document.createElement(
          "div"
        );

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
        this.getReplyPreview(
          message
        );

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

      if (
        !deleted &&
        message.attachment_path
      ) {
        html += this.renderAttachment(
          message
        );
      }

      const displayedContent =
        deleted
          ? "Message deleted"
          : message.attachment_path
            ? (
                message.content &&
                message.content !==
                  message.attachment_name
                  ? message.content
                  : ""
              )
            : message.content || "";

      if (displayedContent) {
        html += `
          <div class="message-text">
            ${this.escapeText(
              displayedContent
            )}
          </div>
        `;
      }

      const edited =
        message.edited_at &&
        !deleted &&
        messageType === "text"
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

            <button
              type="button"
              data-message-action="forward"
              data-message-id="${this.escapeText(
                message.id
              )}"
              aria-label="Forward message"
              title="Forward"
            >↗</button>

            ${
              mine &&
              messageType === "text"
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
                `
                : ""
            }

            ${
              mine
                ? `
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

      bubble.innerHTML =
        html;

      return bubble;
    },

    render(
      messages,
      currentUserId
    ) {
      return (
        messages || []
      ).map(message =>
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

      this.render(
        messages,
        currentUserId
      ).forEach(element => {
        container.appendChild(
          element
        );
      });
    },

    appendIfMissing(
      container,
      message,
      currentUserId
    ) {
      if (
        !container ||
        !message?.id
      ) {
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

      container.appendChild(
        this.renderMessage(
          message,
          currentUserId
        )
      );

      return true;
    },

    updateMessage(
      container,
      message,
      currentUserId
    ) {
      if (!container || !message?.id) {
        return false;
      }

      const existing = container.querySelector(
        `[data-message-id="${CSS.escape(message.id)}"]`
      );

      if (!existing) {
        return this.appendIfMissing(
          container,
          message,
          currentUserId
        );
      }

      const replacement = this.renderMessage(
        message,
        currentUserId
      );

      existing.replaceWith(replacement);

      return true;
    },

    removeMessage(
      container,
      messageId
    ) {
      if (!container || !messageId) {
        return false;
      }

      const existing = container.querySelector(
        `[data-message-id="${CSS.escape(messageId)}"]`
      );

      if (!existing) {
        return false;
      }

      existing.remove();

      return true;
    }
  };

  window.ZakiMessages = ZakiMessages;
})();
