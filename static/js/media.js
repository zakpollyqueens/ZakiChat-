(function () {
  "use strict";

  const ZakiMedia = {
    db: null,
    bucket: "message-attachments",

    init(config) {
      if (!window.supabase || !config) {
        console.error(
          "ZakiChat Media: initialization data unavailable."
        );
        return null;
      }

      this.db =
        window.ZakiChatAuth?.client;

      if (!this.db) {
        console.error(
          "ZakiChat Media: centralized Supabase client unavailable."
        );
        return null;
      }

      return this;
    },

    getType(file) {
      const type = file?.type || "";

      if (type.startsWith("image/")) return "image";
      if (type.startsWith("video/")) return "video";
      if (type.startsWith("audio/")) return "audio";

      return "file";
    },

    validate(file) {
      if (!file) {
        return {
          ok: false,
          error: "No file selected."
        };
      }

      const maxSize = 50 * 1024 * 1024;

      if (file.size > maxSize) {
        return {
          ok: false,
          error: "Files must be 50 MB or smaller."
        };
      }

      const type = file.type || "";

      const allowed =
        type.startsWith("image/") ||
        type.startsWith("video/") ||
        type.startsWith("audio/") ||
        type === "application/pdf" ||
        type.startsWith("text/") ||
        type.includes("document") ||
        type.includes("spreadsheet") ||
        type.includes("presentation") ||
        type === "application/zip" ||
        type === "application/x-zip-compressed";

      if (!allowed) {
        return {
          ok: false,
          error: "This file type is not supported."
        };
      }

      return {
        ok: true
      };
    },

    createPicker(options = {}) {
      const input = document.createElement("input");

      input.type = "file";
      input.accept =
        options.accept ||
        "image/*,video/*,audio/*,.pdf,.txt,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip";

      input.multiple = false;
      input.hidden = true;

      document.body.appendChild(input);

      input.addEventListener(
        "change",
        () => {
          const file =
            input.files?.[0] || null;

          input.remove();

          if (
            file &&
            typeof options.onSelect === "function"
          ) {
            options.onSelect(file);
          }
        },
        { once: true }
      );

      input.click();
    },

    async upload(file, conversationId, userId) {
      if (!this.db) {
        throw new Error(
          "Media system has not been initialized."
        );
      }

      if (!conversationId) {
        throw new Error(
          "A conversation is required."
        );
      }

      if (!userId) {
        throw new Error(
          "A signed-in user is required."
        );
      }

      const validation =
        this.validate(file);

      if (!validation.ok) {
        throw new Error(
          validation.error
        );
      }

      const messageType =
        this.getType(file);

      const extension =
        file.name.includes(".")
          ? file.name
              .split(".")
              .pop()
              .toLowerCase()
          : "bin";

      const randomPart =
        typeof crypto !== "undefined" &&
        typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()
              .toString(36)
              .slice(2)}`;

      const path =
        `${conversationId}/${userId}/${Date.now()}-${randomPart}.${extension}`;

      const { error } =
        await this.db.storage
          .from(this.bucket)
          .upload(path, file, {
            cacheControl: "3600",
            upsert: false,
            contentType:
              file.type ||
              "application/octet-stream"
          });

      if (error) {
        throw error;
      }

      return {
        bucket: this.bucket,
        path,
        name: file.name,
        size: file.size,
        mime_type:
          file.type ||
          "application/octet-stream",
        message_type: messageType
      };
    },

    async createSignedUrl(
      path,
      expiresIn = 3600
    ) {
      if (!this.db || !path) {
        return null;
      }

      const { data, error } =
        await this.db.storage
          .from(this.bucket)
          .createSignedUrl(
            path,
            expiresIn
          );

      if (error) {
        console.error(
          "ZakiChat Media: signed URL error:",
          error
        );

        return null;
      }

      return data?.signedUrl || null;
    },

    async enrichMessage(message) {
      if (
        !message?.attachment_path
      ) {
        return message;
      }

      const url =
        await this.createSignedUrl(
          message.attachment_path
        );

      return {
        ...message,
        attachment_url: url
      };
    },

    async enrichMessages(messages) {
      if (!Array.isArray(messages)) {
        return [];
      }

      return Promise.all(
        messages.map(message =>
          this.enrichMessage(message)
        )
      );
    },

    async remove(path) {
      if (!this.db || !path) {
        return false;
      }

      const { error } =
        await this.db.storage
          .from(this.bucket)
          .remove([path]);

      if (error) {
        console.error(
          "ZakiChat Media: delete error:",
          error
        );

        return false;
      }

      return true;
    }
  };

  window.ZakiMedia = ZakiMedia;
})();
