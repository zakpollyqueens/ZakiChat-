(function () {
  "use strict";

  const ZakiRealtime = {
    db: null,
    channels: new Map(),

    init(config) {
      if (!window.supabase || !config) {
        console.error(
          "ZakiChat Realtime: configuration unavailable."
        );
        return null;
      }

      if (this.db) {
        return this;
      }

      this.db = window.supabase.createClient(
        config.supabaseUrl,
        config.supabaseKey
      );

      return this;
    },

    subscribeToMessages(conversationId, callback) {
      if (!this.db || !conversationId) {
        return null;
      }

      const channelName =
        `messages:${conversationId}`;

      this.unsubscribe(channelName);

      const channel = this.db
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter:
              `conversation_id=eq.${conversationId}`
          },
          payload => {
            if (typeof callback === "function") {
              callback(payload.new, payload);
            }
          }
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "messages",
            filter:
              `conversation_id=eq.${conversationId}`
          },
          payload => {
            if (typeof callback === "function") {
              callback(payload.old, payload);
            }
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "messages",
            filter:
              `conversation_id=eq.${conversationId}`
          },
          payload => {
            if (typeof callback === "function") {
              callback(payload.new, payload);
            }
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "messages",
            filter:
              `conversation_id=eq.${conversationId}`
          },
          payload => {
            if (typeof callback === "function") {
              callback(payload.new, payload);
            }
          }
        )
        .subscribe(status => {
          console.log(
            "ZakiChat message realtime:",
            status
          );
        });

      this.channels.set(channelName, channel);

      return channel;
    },

    subscribeToAllMessages(callback) {
      if (!this.db) {
        return null;
      }

      const channelName = "messages:all";

      this.unsubscribe(channelName);

      const channel = this.db
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages"
          },
          payload => {
            if (typeof callback === "function") {
              callback(payload.new, payload);
            }
          }
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "messages"
          },
          payload => {
            if (typeof callback === "function") {
              callback(payload.old, payload);
            }
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "messages"
          },
          payload => {
            if (typeof callback === "function") {
              callback(payload.new, payload);
            }
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "messages"
          },
          payload => {
            if (typeof callback === "function") {
              callback(payload.new, payload);
            }
          }
        )
        .subscribe(status => {
          console.log(
            "ZakiChat all-message realtime:",
            status
          );
        });

      this.channels.set(channelName, channel);

      return channel;
    },

    subscribeToConversationChanges(
      conversationId,
      callback
    ) {
      if (!this.db || !conversationId) {
        return null;
      }

      const channelName =
        `conversation:${conversationId}`;

      this.unsubscribe(channelName);

      const channel = this.db
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "conversations",
            filter:
              `id=eq.${conversationId}`
          },
          payload => {
            if (typeof callback === "function") {
              callback(payload);
            }
          }
        )
        .subscribe(status => {
          console.log(
            "ZakiChat conversation realtime:",
            status
          );
        });

      this.channels.set(channelName, channel);

      return channel;
    },

    subscribeToNotifications(userId, callback) {
      if (!this.db || !userId) {
        return null;
      }

      const channelName =
        `notifications:${userId}`;

      this.unsubscribe(channelName);

      const channel = this.db
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter:
              `user_id=eq.${userId}`
          },
          payload => {
            if (typeof callback === "function") {
              callback(payload.new, payload);
            }
          }
        )
        .subscribe(status => {
          console.log(
            "ZakiChat notification realtime:",
            status
          );
        });

      this.channels.set(channelName, channel);

      return channel;
    },

    subscribe(
      channelName,
      table,
      filter,
      callback,
      event = "*"
    ) {
      if (!this.db || !channelName || !table) {
        return null;
      }

      this.unsubscribe(channelName);

      const channel = this.db
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event,
            schema: "public",
            table,
            ...(filter ? { filter } : {})
          },
          payload => {
            if (typeof callback === "function") {
              callback(payload.new, payload);
            }
          }
        )
        .subscribe(status => {
          console.log(
            `ZakiChat realtime [${channelName}]:`,
            status
          );
        });

      this.channels.set(channelName, channel);

      return channel;
    },

    unsubscribe(channelName) {
      const channel =
        this.channels.get(channelName);

      if (!channel || !this.db) {
        return false;
      }

      this.db.removeChannel(channel);
      this.channels.delete(channelName);

      return true;
    },

    async unsubscribeAll() {
      if (!this.db) {
        return;
      }

      const channels =
        Array.from(this.channels.entries());

      this.channels.clear();

      for (const [, channel] of channels) {
        await this.db.removeChannel(channel);
      }
    },

    getChannel(channelName) {
      return (
        this.channels.get(channelName) || null
      );
    }
  };

  window.ZakiRealtime = ZakiRealtime;
})();
