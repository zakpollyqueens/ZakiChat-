(function () {
  "use strict";

  const ZakiMedia = {
    db: null,
    bucket: "message-attachments",
    premiumBucket: "message-attachments-premium",

    resolveBucketPath(path) {
      const value = String(path || "");
      if (value.startsWith("premium/")) {
        return { bucket: this.premiumBucket, path: value.slice("premium/".length) };
      }
      return { bucket: this.bucket, path: value };
    },

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

      const premium = Boolean(window.ZakiChatAppearance?.isPremium?.());
      const maxSize = (premium ? 500 : 50) * 1024 * 1024;

      if (file.size > maxSize) {
        return {
          ok: false,
          error: premium ? "Files must be 500 MB or smaller for your current plan." : "Files must be 50 MB or smaller on a local account. Upgrade to Customized Personal for larger attachments."
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

    async uploadResumable(bucket, path, file) {
      const config = window.ZakiChatConfig || {};
      const apiKey = config.supabaseKey || "";
      const baseUrl = String(config.supabaseUrl || "").replace(".supabase.co", ".storage.supabase.co").replace(/\/$/, "");
      const { data: sessionData, error: sessionError } = await this.db.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (sessionError || !token || !apiKey || !baseUrl) {
        throw new Error("Secure large-file upload could not start. Please sign in again and retry.");
      }
      const encode = value => btoa(unescape(encodeURIComponent(String(value))));
      const metadata = [
        "bucketName " + encode(bucket),
        "objectName " + encode(path),
        "contentType " + encode(file.type || "application/octet-stream"),
        "cacheControl " + encode("3600")
      ].join(",");
      const headers = {
        "Authorization": "Bearer " + token,
        "apikey": apiKey,
        "Tus-Resumable": "1.0.0"
      };
      const start = await fetch(baseUrl + "/storage/v1/upload/resumable", {
        method: "POST",
        headers: {
          ...headers,
          "Upload-Length": String(file.size),
          "Upload-Metadata": metadata,
          "x-upsert": "false"
        }
      });
      if (start.status !== 201) {
        const detail = await start.text().catch(() => "");
        throw new Error(detail || "Unable to start a resumable file upload (" + start.status + ").");
      }
      const location = start.headers.get("Location");
      if (!location) throw new Error("The storage service did not return an upload location.");
      const uploadUrl = new URL(location, baseUrl).toString();
      const chunkSize = 8 * 1024 * 1024;
      let offset = Number(start.headers.get("Upload-Offset") || 0);
      while (offset < file.size) {
        const chunk = file.slice(offset, Math.min(offset + chunkSize, file.size));
        let completed = false;
        let lastError = null;
        for (let attempt = 0; attempt < 3 && !completed; attempt++) {
          try {
            const response = await fetch(uploadUrl, {
              method: "PATCH",
              headers: {
                ...headers,
                "Upload-Offset": String(offset),
                "Content-Type": "application/offset+octet-stream"
              },
              body: chunk
            });
            if (response.status === 204) {
              const nextOffset = Number(response.headers.get("Upload-Offset"));
              offset = Number.isFinite(nextOffset) && nextOffset > offset ? nextOffset : offset + chunk.size;
              completed = true;
            } else {
              const detail = await response.text().catch(() => "");
              lastError = new Error(detail || "Large-file upload failed (" + response.status + ").");
              if (response.status >= 400 && response.status < 500 && response.status !== 409) break;
            }
          } catch (error) {
            lastError = error;
          }
          if (!completed) {
            try {
              const head = await fetch(uploadUrl, {
                method: "HEAD",
                headers: { ...headers }
              });
              if (head.ok) {
                const serverOffset = Number(head.headers.get("Upload-Offset"));
                if (Number.isFinite(serverOffset) && serverOffset >= 0) {
                  offset = serverOffset;
                  if (offset >= file.size) completed = true;
                }
              }
            } catch (_) {}
          }
        }
        if (!completed && offset < file.size) throw lastError || new Error("Large-file upload could not continue.");
        window.dispatchEvent(new CustomEvent("zakichat:upload-progress", {
          detail: { uploaded: offset, total: file.size, percent: Math.min(100, Math.round(offset / file.size * 100)) }
        }));
      }
      return true;
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

      const storagePath =
        `${conversationId}/${userId}/${Date.now()}-${randomPart}.${extension}`;
      const premium = Boolean(window.ZakiChatAppearance?.isPremium?.());
      const targetBucket = premium ? this.premiumBucket : this.bucket;

      if (file.size > 6 * 1024 * 1024) {
        await this.uploadResumable(targetBucket, storagePath, file);
      } else {
        const { error } = await this.db.storage
          .from(targetBucket)
          .upload(storagePath, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type || "application/octet-stream"
          });
        if (error) throw error;
      }

      return {
        bucket: targetBucket,
        path: premium ? "premium/" + storagePath : storagePath,
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

      const target = this.resolveBucketPath(path);
      const { data, error } =
        await this.db.storage
          .from(target.bucket)
          .createSignedUrl(
            target.path,
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

      const target = this.resolveBucketPath(path);
      const { error } =
        await this.db.storage
          .from(target.bucket)
          .remove([target.path]);

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
