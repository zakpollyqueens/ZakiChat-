(function () {
  "use strict";

  const ZakiConversations = {
    db: null,
    currentUser: null,
    conversations: [],
    selectedConversationId: null,

    init(config, user) {
      if (!window.supabase || !config || !user) {
        console.error(
          "ZakiChat Conversations: initialization data unavailable."
        );
        return null;
      }

      this.db = window.supabase.createClient(
        config.supabaseUrl,
        config.supabaseKey
      );

      this.currentUser = user;

      return this;
    },

    async load() {
      if (!this.db || !this.currentUser) {
        return {
          data: [],
          error: new Error(
            "Conversations client is not initialized."
          )
        };
      }

      const { data, error } = await this.db
        .from("conversation_members")
        .select(`
          conversation_id,
          conversations (
            id,
            type,
            title,
            avatar_url,
            created_at,
            updated_at,
            conversation_members (
              user_id,
              profiles (
                id,
                username,
                full_name,
                avatar_url,
                is_online,
                last_seen
              )
            )
          )
        `)
        .eq("user_id", this.currentUser.id);

      if (error) {
        return {
          data: [],
          error
        };
      }

      const conversations =
        (data || [])
          .map(row => row.conversations)
          .filter(Boolean);

      const enriched = [];

      for (const conversation of conversations) {
        const members =
          conversation.conversation_members || [];

        const otherMember =
          members.find(
            member =>
              member.user_id !==
              this.currentUser.id
          );

        const profile =
          otherMember?.profiles || null;

        let latestMessage = null;
        let unreadCount = 0;

        /*
         * Only non-deleted messages are used for:
         * - latest message preview
         * - unread count
         */
        const latestResult =
          await this.db
            .from("messages")
            .select(`
              id,
              sender_id,
              content,
              message_type,
              created_at,
              read_at,
              edited_at,
              reply_to_message_id,
              deleted_at
            `)
            .eq(
              "conversation_id",
              conversation.id
            )
            .is("deleted_at", null)
            .order("created_at", {
              ascending: false
            })
            .limit(1);

        if (!latestResult.error) {
          latestMessage =
            latestResult.data?.[0] || null;
        }

        const unreadResult =
          await this.db
            .from("messages")
            .select("id", {
              count: "exact",
              head: true
            })
            .eq(
              "conversation_id",
              conversation.id
            )
            .neq(
              "sender_id",
              this.currentUser.id
            )
            .is("read_at", null)
            .is("deleted_at", null);

        if (!unreadResult.error) {
          unreadCount =
            unreadResult.count || 0;
        }

        enriched.push({
          ...conversation,
          profile,
          latestMessage,
          unreadCount
        });
      }

      enriched.sort((a, b) => {
        const aTime =
          new Date(
            a.latestMessage?.created_at ||
            a.updated_at ||
            a.created_at
          ).getTime();

        const bTime =
          new Date(
            b.latestMessage?.created_at ||
            b.updated_at ||
            b.created_at
          ).getTime();

        return bTime - aTime;
      });

      this.conversations = enriched;

      return {
        data: enriched,
        error: null
      };
    },

    getDisplayName(conversation) {
      if (!conversation) {
        return "Conversation";
      }

      if (conversation.type === "group") {
        return (
          conversation.title ||
          "Group"
        );
      }

      return (
        conversation.profile?.full_name ||
        conversation.profile?.username ||
        "ZakiChat User"
      );
    },

    getAvatar(conversation) {
      if (!conversation) {
        return "";
      }

      if (conversation.type === "group") {
        return (
          conversation.avatar_url || ""
        );
      }

      return (
        conversation.profile?.avatar_url ||
        ""
      );
    },

    getPreview(conversation) {
      const message =
        conversation?.latestMessage;

      if (!message) {
        return "No messages yet";
      }

      if (
        message.message_type &&
        message.message_type !== "text"
      ) {
        return (
          message.message_type
            .charAt(0)
            .toUpperCase() +
          message.message_type.slice(1)
        );
      }

      return (
        message.content ||
        "Message"
      );
    },

    getTime(conversation) {
      const value =
        conversation?.latestMessage
          ?.created_at ||
        conversation?.updated_at ||
        conversation?.created_at;

      if (!value) {
        return "";
      }

      const date =
        new Date(value);

      if (Number.isNaN(date.getTime())) {
        return "";
      }

      return date.toLocaleTimeString(
        [],
        {
          hour: "2-digit",
          minute: "2-digit"
        }
      );
    },

    select(conversationId) {
      const conversation =
        this.conversations.find(
          item =>
            item.id === conversationId
        );

      if (!conversation) {
        return null;
      }

      this.selectedConversationId =
        conversationId;

      return conversation;
    },

    find(conversationId) {
      return (
        this.conversations.find(
          item =>
            item.id === conversationId
        ) || null
      );
    },

    findByUserId(userId) {
      if (!userId) {
        return null;
      }

      return (
        this.conversations.find(
          conversation =>
            conversation.profile?.id ===
            userId
        ) || null
      );
    }
  };

  window.ZakiConversations =
    ZakiConversations;
})();
