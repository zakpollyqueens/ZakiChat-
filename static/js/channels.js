(function () {
  "use strict";

  const ZakiChannels = {
    db: null,
    user: null,
    config: null,
    currentChannel: null,
    channels: [],
    myChannels: [],
    memberships: new Map(),
    elements: {},
    realtimeChannels: [],

    async init(config) {
      this.config = config || window.ZakiChatConfig || null;

      this.db = window.ZakiChatAuth?.client || null;

      if (!this.db) {
        console.error(
          "ZakiChat Channels: Supabase client unavailable."
        );
        return;
      }

      const {
        data,
        error
      } = await this.db.auth.getSession();

      if (error) {
        console.error(
          "ZakiChat Channels: session error:",
          error
        );
        return;
      }

      this.user = data?.session?.user || null;

      if (!this.user) {
        console.error(
          "ZakiChat Channels: signed-in user unavailable."
        );
        return;
      }

      this.cacheElements();
      this.bindEvents();

      await this.loadChannels();
      this.subscribeRealtime();
    },

    cacheElements() {
      const ids = [
        "refresh-channels",
        "channel-search",
        "clear-channel-search",
        "my-channels-list",
        "my-channels-empty",
        "discover-channels-list",
        "discover-channels-empty",
        "channel-view",
        "close-channel-view",
        "channel-view-avatar",
        "channel-view-name",
        "channel-view-public",
        "channel-view-handle",
        "channel-follow-button",
        "channel-view-menu",
        "channel-view-description",
        "channel-member-count",
        "channel-post-count",
        "channel-owner-tools",
        "open-channel-post-composer",
        "channel-post-composer",
        "close-channel-post-composer",
        "channel-post-content",
        "channel-post-character-count",
        "publish-channel-post",
        "channel-post-error",
        "channel-posts-loading",
        "channel-posts-list",
        "channel-posts-empty",
        "open-create-channel",
        "create-channel-dialog",
        "close-create-channel",
        "cancel-create-channel",
        "create-channel-form",
        "channel-name-input",
        "channel-handle-input",
        "channel-description-input",
        "channel-public-input",
        "create-channel-message",
        "create-channel-submit",
        "channels-more-button",
        "channels-more-menu"
      ];

      ids.forEach(id => {
        this.elements[id] =
          document.getElementById(id);
      });
    },

    bindEvents() {
      this.elements[
        "refresh-channels"
      ]?.addEventListener(
        "click",
        () => this.loadChannels()
      );

      this.elements[
        "channel-search"
      ]?.addEventListener(
        "input",
        event => {
          this.handleSearch(
            event.target.value
          );
        }
      );

      this.elements[
        "clear-channel-search"
      ]?.addEventListener(
        "click",
        () => {
          const input =
            this.elements[
              "channel-search"
            ];

          if (input) {
            input.value = "";
          }

          this.handleSearch("");
        }
      );

      this.elements[
        "close-channel-view"
      ]?.addEventListener(
        "click",
        () => this.closeChannel()
      );

      this.elements[
        "channel-follow-button"
      ]?.addEventListener(
        "click",
        () => this.toggleFollow()
      );

      this.elements[
        "channel-view-menu"
      ]?.addEventListener(
        "click",
        () => this.showChannelMenu()
      );

      this.elements[
        "open-create-channel"
      ]?.addEventListener(
        "click",
        () => this.openCreateChannel()
      );

      this.elements[
        "close-create-channel"
      ]?.addEventListener(
        "click",
        () => this.closeCreateChannel()
      );

      this.elements[
        "cancel-create-channel"
      ]?.addEventListener(
        "click",
        () => this.closeCreateChannel()
      );

      this.elements[
        "create-channel-form"
      ]?.addEventListener(
        "submit",
        event => {
          event.preventDefault();
          this.createChannel();
        }
      );

      this.elements[
        "channel-handle-input"
      ]?.addEventListener(
        "input",
        event => {
          event.target.value =
            event.target.value
              .toLowerCase()
              .replace(/[^a-z0-9_]/g, "");
        }
      );

      this.elements[
        "open-channel-post-composer"
      ]?.addEventListener(
        "click",
        () => this.openPostComposer()
      );

      this.elements[
        "close-channel-post-composer"
      ]?.addEventListener(
        "click",
        () => this.closePostComposer()
      );

      this.elements[
        "channel-post-content"
      ]?.addEventListener(
        "input",
        event => {
          const count =
            event.target.value.length;

          if (
            this.elements[
              "channel-post-character-count"
            ]
          ) {
            this.elements[
              "channel-post-character-count"
            ].textContent =
              `${count} / 10000`;
          }
        }
      );

      this.elements[
        "publish-channel-post"
      ]?.addEventListener(
        "click",
        () => this.publishPost()
      );

      this.elements[
        "channels-more-button"
      ]?.addEventListener(
        "click",
        event => {
          event.stopPropagation();
          this.toggleMoreMenu();
        }
      );

      document.addEventListener(
        "click",
        event => {
          const wrapper =
            this.elements[
              "channels-more-menu"
            ]?.parentElement;

          if (
            wrapper &&
            !wrapper.contains(event.target)
          ) {
            this.closeMoreMenu();
          }
        }
      );

      this.elements[
        "create-channel-dialog"
      ]?.addEventListener(
        "click",
        event => {
          if (
            event.target ===
            this.elements[
              "create-channel-dialog"
            ]
          ) {
            this.closeCreateChannel();
          }
        }
      );
    },

    toggleMoreMenu() {
      const button =
        this.elements[
          "channels-more-button"
        ];

      const menu =
        this.elements[
          "channels-more-menu"
        ];

      if (!button || !menu) {
        return;
      }

      const isHidden = menu.hidden;

      menu.hidden = !isHidden;

      button.setAttribute(
        "aria-expanded",
        String(isHidden)
      );
    },

    closeMoreMenu() {
      const button =
        this.elements[
          "channels-more-button"
        ];

      const menu =
        this.elements[
          "channels-more-menu"
        ];

      if (!menu) {
        return;
      }

      menu.hidden = true;

      button?.setAttribute(
        "aria-expanded",
        "false"
      );
    },

    async loadChannels() {
      this.setLoading(
        "my-channels-list",
        "Loading your channels..."
      );

      this.setLoading(
        "discover-channels-list",
        "Loading channels..."
      );

      try {
        await this.loadMemberships();

        const {
          data,
          error
        } = await this.db
          .from("channels")
          .select("*")
          .eq("is_public", true)
          .order("created_at", {
            ascending: false
          });

        if (error) {
          throw error;
        }

        this.channels =
          Array.isArray(data)
            ? data
            : [];

        this.myChannels =
          this.channels.filter(
            channel =>
              channel.owner_id ===
                this.user.id ||
              this.memberships.has(
                channel.id
              )
          );

        this.renderMyChannels();
        this.renderDiscoverChannels(
          this.channels
        );

      } catch (error) {
        console.error(
          "ZakiChat Channels: load error:",
          error
        );

        this.showListError(
          "my-channels-list",
          "Unable to load your channels."
        );

        this.showListError(
          "discover-channels-list",
          "Unable to load channels."
        );
      }
    },

    async loadMemberships() {
      this.memberships.clear();

      const {
        data,
        error
      } = await this.db
        .from("channel_members")
        .select(
          "channel_id,user_id,role,joined_at"
        )
        .eq(
          "user_id",
          this.user.id
        );

      if (error) {
        throw error;
      }

      (data || []).forEach(
        membership => {
          this.memberships.set(
            membership.channel_id,
            membership
          );
        }
      );
    },

    handleSearch(value) {
      const query =
        String(value || "")
          .trim()
          .toLowerCase();

      const clearButton =
        this.elements[
          "clear-channel-search"
        ];

      if (clearButton) {
        clearButton.hidden =
          query.length === 0;
      }

      const filtered =
        this.channels.filter(
          channel => {
            if (!query) {
              return true;
            }

            const name =
              String(
                channel.name || ""
              ).toLowerCase();

            const handle =
              String(
                channel.handle || ""
              ).toLowerCase();

            const description =
              String(
                channel.description || ""
              ).toLowerCase();

            return (
              name.includes(query) ||
              handle.includes(query) ||
              description.includes(query)
            );
          }
        );

      this.renderDiscoverChannels(
        filtered
      );

      const myFiltered =
        this.myChannels.filter(
          channel => {
            if (!query) {
              return true;
            }

            const name =
              String(
                channel.name || ""
              ).toLowerCase();

            const handle =
              String(
                channel.handle || ""
              ).toLowerCase();

            return (
              name.includes(query) ||
              handle.includes(query)
            );
          }
        );

      this.renderMyChannels(
        myFiltered
      );
    },

    renderMyChannels(
      channels = this.myChannels
    ) {
      const container =
        this.elements[
          "my-channels-list"
        ];

      const empty =
        this.elements[
          "my-channels-empty"
        ];

      if (!container) {
        return;
      }

      if (!channels.length) {
        container.innerHTML = "";

        if (empty) {
          empty.hidden = false;
        }

        return;
      }

      if (empty) {
        empty.hidden = true;
      }

      container.innerHTML =
        channels
          .map(
            channel =>
              this.channelCardHTML(
                channel,
                true
              )
          )
          .join("");

      this.bindChannelCards(
        container
      );
    },

    renderDiscoverChannels(
      channels = []
    ) {
      const container =
        this.elements[
          "discover-channels-list"
        ];

      const empty =
        this.elements[
          "discover-channels-empty"
        ];

      if (!container) {
        return;
      }

      if (!channels.length) {
        container.innerHTML = "";

        if (empty) {
          empty.hidden = false;
        }

        return;
      }

      if (empty) {
        empty.hidden = true;
      }

      container.innerHTML =
        channels
          .map(
            channel =>
              this.channelCardHTML(
                channel,
                false
              )
          )
          .join("");

      this.bindChannelCards(
        container
      );
    },

    bindChannelCards(container) {
      container
        .querySelectorAll(
          "[data-channel-id]"
        )
        .forEach(card => {
          card.addEventListener(
            "click",
            event => {
              if (
                event.target.closest(
                  "[data-channel-follow]"
                )
              ) {
                return;
              }

              const channelId =
                card.dataset.channelId;

              this.openChannel(
                channelId
              );
            }
          );
        });

      container
        .querySelectorAll(
          "[data-channel-follow]"
        )
        .forEach(button => {
          button.addEventListener(
            "click",
            async event => {
              event.stopPropagation();

              const channelId =
                button.dataset.channelFollow;

              await this.toggleFollow(
                channelId
              );
            }
          );
        });
    },

    channelCardHTML(
      channel,
      isMine = false
    ) {
      const name =
        this.escape(
          channel.name ||
            "Unnamed channel"
        );

      const handle =
        this.escape(
          channel.handle ||
            "channel"
        );

      const description =
        this.escape(
          channel.description ||
            ""
        );

      const avatar =
        this.avatarHTML(
          channel,
          "channel-avatar"
        );

      const membership =
        this.memberships.get(
          channel.id
        );

      const following =
        Boolean(membership);

      const actionText =
        isMine
          ? "Manage"
          : following
            ? "Following"
            : "Follow";

      return `
        <article
          class="channel-card"
          data-channel-id="${this.escapeAttribute(
            channel.id
          )}"
        >

          ${avatar}

          <div class="channel-card-main">

            <div class="channel-card-name">

              <strong>
                ${name}
              </strong>

            </div>

            <span class="channel-card-handle">
              @${handle}
            </span>

            ${
              description
                ? `
                  <div class="channel-card-description">
                    ${description}
                  </div>
                `
                : ""
            }

          </div>

          <div class="channel-card-meta">

            <span class="channel-card-followers">
              ${following ? "Following" : "Public"}
            </span>

            <button
              type="button"
              class="channels-secondary-button channel-card-action ${
                following
                  ? "following"
                  : ""
              }"
              data-channel-follow="${this.escapeAttribute(
                channel.id
              )}"
            >
              ${actionText}
            </button>

          </div>

        </article>
      `;
    },

    avatarHTML(
      channel,
      className
    ) {
      if (channel.avatar_url) {
        return `
          <div class="${className}">
            <img
              src="${this.escapeAttribute(
                channel.avatar_url
              )}"
              alt=""
              loading="lazy"
            >
          </div>
        `;
      }

      const firstLetter =
        String(
          channel.name || "C"
        )
          .trim()
          .charAt(0)
          .toUpperCase();

      return `
        <div class="${className}">
          ${this.escape(firstLetter)}
        </div>
      `;
    },

    setLoading(id, message) {
      const element =
        this.elements[id];

      if (!element) {
        return;
      }

      element.innerHTML = `
        <div class="channels-loading">
          ${this.escape(message)}
        </div>
      `;
    },

    showListError(id, message) {
      const element =
        this.elements[id];

      if (!element) {
        return;
      }

      element.innerHTML = `
        <div class="channels-empty">
          <div
            class="channels-empty-icon"
            aria-hidden="true"
          >⚠️</div>

          <strong>
            Something went wrong
          </strong>

          <span>
            ${this.escape(message)}
          </span>
        </div>
      `;
    },

    escape(value) {
      return String(
        value ?? ""
      )
        .replace(
          /&/g,
          "&amp;"
        )
        .replace(
          /</g,
          "&lt;"
        )
        .replace(
          />/g,
          "&gt;"
        )
        .replace(
          /"/g,
          "&quot;"
        )
        .replace(
          /'/g,
          "&#039;"
        );
    },

    escapeAttribute(value) {
      return this.escape(value);
    }
  };

  window.ZakiChannels =
    ZakiChannels;

})();

/*
 * ============================================================
 * ZakiChat Channels — Part 3B
 * Channel view, following and posts
 * ============================================================
 */

(function () {
  "use strict";

  const ZakiChannels =
    window.ZakiChannels;

  if (!ZakiChannels) {
    console.error(
      "ZakiChat Channels: Part 3A is not loaded."
    );
    return;
  }

  Object.assign(ZakiChannels, {

    async openChannel(channelId) {
      if (!channelId) {
        return;
      }

      const channel =
        this.channels.find(
          item =>
            item.id === channelId
        );

      if (!channel) {
        console.error(
          "ZakiChat Channels: channel not found:",
          channelId
        );
        return;
      }

      this.currentChannel =
        channel;

      this.renderChannelView(
        channel
      );

      const channelView =
        this.elements[
          "channel-view"
        ];

      if (channelView) {
        channelView.hidden = false;
      }

      const myChannels =
        this.elements[
          "my-channels-list"
        ];

      const discoverChannels =
        this.elements[
          "discover-channels-list"
        ];

      const myEmpty =
        this.elements[
          "my-channels-empty"
        ];

      const discoverEmpty =
        this.elements[
          "discover-channels-empty"
        ];

      if (myChannels) {
        myChannels.hidden = true;
      }

      if (discoverChannels) {
        discoverChannels.hidden = true;
      }

      if (myEmpty) {
        myEmpty.hidden = true;
      }

      if (discoverEmpty) {
        discoverEmpty.hidden = true;
      }

      await this.loadChannelPosts(
        channel.id
      );

      this.scrollToChannel();
    },

    closeChannel() {
      this.currentChannel =
        null;

      const channelView =
        this.elements[
          "channel-view"
        ];

      if (channelView) {
        channelView.hidden = true;
      }

      const myChannels =
        this.elements[
          "my-channels-list"
        ];

      const discoverChannels =
        this.elements[
          "discover-channels-list"
        ];

      if (myChannels) {
        myChannels.hidden = false;
      }

      if (discoverChannels) {
        discoverChannels.hidden = false;
      }

      this.closePostComposer();

      const error =
        this.elements[
          "channel-post-error"
        ];

      if (error) {
        error.hidden = true;
        error.textContent = "";
      }

      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });
    },

    scrollToChannel() {
      const channelView =
        this.elements[
          "channel-view"
        ];

      if (!channelView) {
        return;
      }

      window.setTimeout(() => {
        channelView.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      }, 40);
    },

    renderChannelView(
      channel
    ) {
      const avatar =
        this.elements[
          "channel-view-avatar"
        ];

      const name =
        this.elements[
          "channel-view-name"
        ];

      const handle =
        this.elements[
          "channel-view-handle"
        ];

      const publicBadge =
        this.elements[
          "channel-view-public"
        ];

      const description =
        this.elements[
          "channel-view-description"
        ];

      const followButton =
        this.elements[
          "channel-follow-button"
        ];

      const ownerTools =
        this.elements[
          "channel-owner-tools"
        ];

      if (avatar) {
        avatar.innerHTML =
          channel.avatar_url
            ? `
              <img
                src="${this.escapeAttribute(
                  channel.avatar_url
                )}"
                alt=""
              >
            `
            : this.escape(
                String(
                  channel.name ||
                    "C"
                )
                  .trim()
                  .charAt(0)
                  .toUpperCase()
              );
      }

      if (name) {
        name.textContent =
          channel.name ||
          "Channel";
      }

      if (handle) {
        handle.textContent =
          `@${channel.handle || "channel"}`;
      }

      if (publicBadge) {
        publicBadge.hidden =
          !channel.is_public;
      }

      if (description) {
        const text =
          String(
            channel.description ||
              ""
          ).trim();

        description.textContent =
          text;

        description.hidden =
          !text;
      }

      const membership =
        this.memberships.get(
          channel.id
        );

      const isOwner =
        channel.owner_id ===
        this.user.id;

      if (followButton) {
        followButton.disabled =
          isOwner;

        followButton.classList.toggle(
          "following",
          Boolean(membership)
        );

        followButton.textContent =
          isOwner
            ? "Owner"
            : membership
              ? "Following"
              : "Follow";
      }

      if (ownerTools) {
        ownerTools.hidden =
          !isOwner;
      }

      this.updateChannelStats(
        channel.id
      );
    },

    async updateChannelStats(
      channelId
    ) {
      if (!channelId) {
        return;
      }

      const memberCount =
        this.elements[
          "channel-member-count"
        ];

      const postCount =
        this.elements[
          "channel-post-count"
        ];

      try {
        const {
          count: members,
          error:
            memberError
        } = await this.db
          .from("channel_members")
          .select(
            "id",
            {
              count: "exact",
              head: true
            }
          )
          .eq(
            "channel_id",
            channelId
          );

        if (!memberError &&
            memberCount) {
          memberCount.textContent =
            String(
              members || 0
            );
        }

        const {
          count: posts,
          error:
            postError
        } = await this.db
          .from("channel_posts")
          .select(
            "id",
            {
              count: "exact",
              head: true
            }
          )
          .eq(
            "channel_id",
            channelId
          );

        if (!postError &&
            postCount) {
          postCount.textContent =
            String(
              posts || 0
            );
        }

      } catch (error) {
        console.error(
          "ZakiChat Channels: stats error:",
          error
        );
      }
    },

    async toggleFollow(
      channelId =
        this.currentChannel?.id
    ) {
      if (!channelId ||
          !this.user) {
        return;
      }

      const channel =
        this.channels.find(
          item =>
            item.id === channelId
        );

      if (!channel) {
        return;
      }

      if (
        channel.owner_id ===
        this.user.id
      ) {
        return;
      }

      const existing =
        this.memberships.get(
          channelId
        );

      try {
        if (existing) {
          const {
            error
          } = await this.db
            .from("channel_members")
            .delete()
            .eq(
              "channel_id",
              channelId
            )
            .eq(
              "user_id",
              this.user.id
            )
            .eq(
              "role",
              "subscriber"
            );

          if (error) {
            throw error;
          }

          this.memberships.delete(
            channelId
          );

        } else {
          const {
            error
          } = await this.db
            .from("channel_members")
            .insert({
              channel_id:
                channelId,
              user_id:
                this.user.id,
              role:
                "subscriber"
            });

          if (error) {
            throw error;
          }

          this.memberships.set(
            channelId,
            {
              channel_id:
                channelId,
              user_id:
                this.user.id,
              role:
                "subscriber",
              joined_at:
                new Date().toISOString()
            }
          );
        }

        this.myChannels =
          this.channels.filter(
            item =>
              item.owner_id ===
                this.user.id ||
              this.memberships.has(
                item.id
              )
          );

        this.renderMyChannels();

        const searchInput =
          this.elements[
            "channel-search"
          ];

        if (
          searchInput?.value
        ) {
          this.handleSearch(
            searchInput.value
          );
        } else {
          this.renderDiscoverChannels(
            this.channels
          );
        }

        if (
          this.currentChannel?.id ===
          channelId
        ) {
          this.renderChannelView(
            channel
          );
        }

        await this.updateChannelStats(
          channelId
        );

      } catch (error) {
        console.error(
          "ZakiChat Channels: follow error:",
          error
        );

        window.alert(
          "Unable to update the channel follow status."
        );
      }
    },

    async loadChannelPosts(
      channelId
    ) {
      const loading =
        this.elements[
          "channel-posts-loading"
        ];

      const list =
        this.elements[
          "channel-posts-list"
        ];

      const empty =
        this.elements[
          "channel-posts-empty"
        ];

      if (!list) {
        return;
      }

      if (loading) {
        loading.hidden = false;
      }

      if (empty) {
        empty.hidden = true;
      }

      list.innerHTML = "";

      try {
        const {
          data,
          error
        } = await this.db
          .from("channel_posts")
          .select("*")
          .eq(
            "channel_id",
            channelId
          )
          .order(
            "created_at",
            {
              ascending: false
            }
          );

        if (error) {
          throw error;
        }

        if (loading) {
          loading.hidden = true;
        }

        const posts =
          Array.isArray(data)
            ? data
            : [];

        if (!posts.length) {
          if (empty) {
            empty.hidden = false;
          }

          return;
        }

        list.innerHTML =
          posts
            .map(
              post =>
                this.postHTML(
                  post
                )
            )
            .join("");

        this.bindPostActions(
          list
        );

        const postCount =
          this.elements[
            "channel-post-count"
          ];

        if (postCount) {
          postCount.textContent =
            String(
              posts.length
            );
        }

      } catch (error) {
        console.error(
          "ZakiChat Channels: post load error:",
          error
        );

        if (loading) {
          loading.hidden = true;
        }

        list.innerHTML = `
          <div class="channels-empty">

            <div
              class="channels-empty-icon"
              aria-hidden="true"
            >⚠️</div>

            <strong>
              Unable to load posts
            </strong>

            <span>
              Please try again.
            </span>

          </div>
        `;
      }
    },

    postHTML(
      post
    ) {
      const channel =
        this.currentChannel;

      const isOwner =
        channel?.owner_id ===
        this.user.id;

      const isAuthor =
        post.author_id ===
        this.user.id;

      const created =
        this.formatDate(
          post.created_at
        );

      const content =
        this.escape(
          post.content || ""
        );

      const avatar =
        channel?.avatar_url
          ? `
            <img
              src="${this.escapeAttribute(
                channel.avatar_url
              )}"
              alt=""
              loading="lazy"
            >
          `
          : this.escape(
              String(
                channel?.name ||
                  "C"
              )
                .trim()
                .charAt(0)
                .toUpperCase()
            );

      return `
        <article
          class="channel-post"
          data-post-id="${this.escapeAttribute(
            post.id
          )}"
        >

          <div class="channel-post-header">

            <div class="channel-post-avatar">
              ${avatar}
            </div>

            <div class="channel-post-author">

              <strong>
                ${this.escape(
                  channel?.name ||
                    "Channel"
                )}
              </strong>

              <span>
                ${this.escape(
                  created
                )}
              </span>

            </div>

          </div>


          ${
            content
              ? `
                <div class="channel-post-content">
                  ${content}
                </div>
              `
              : ""
          }


          ${
            isOwner ||
            isAuthor
              ? `
                <div class="channel-post-footer">

                  <button
                    type="button"
                    class="channel-post-delete"
                    data-delete-post="${this.escapeAttribute(
                      post.id
                    )}"
                  >
                    Delete
                  </button>

                </div>
              `
              : ""
          }

        </article>
      `;
    },

    bindPostActions(
      container
    ) {
      container
        .querySelectorAll(
          "[data-delete-post]"
        )
        .forEach(button => {
          button.addEventListener(
            "click",
            event => {
              event.stopPropagation();

              const postId =
                button.dataset.deletePost;

              this.deletePost(
                postId
              );
            }
          );
        });
    },

    openPostComposer() {
      const composer =
        this.elements[
          "channel-post-composer"
        ];

      if (!composer) {
        return;
      }

      composer.hidden = false;

      const textarea =
        this.elements[
          "channel-post-content"
        ];

      textarea?.focus();

      this.clearPostError();
    },

    closePostComposer() {
      const composer =
        this.elements[
          "channel-post-composer"
        ];

      if (composer) {
        composer.hidden = true;
      }

      const textarea =
        this.elements[
          "channel-post-content"
        ];

      if (textarea) {
        textarea.value = "";
      }

      const counter =
        this.elements[
          "channel-post-character-count"
        ];

      if (counter) {
        counter.textContent =
          "0 / 10000";
      }

      this.clearPostError();
    },

    async publishPost() {
      const channel =
        this.currentChannel;

      if (!channel) {
        return;
      }

      if (
        channel.owner_id !==
        this.user.id
      ) {
        this.showPostError(
          "Only the channel owner can publish posts right now."
        );
        return;
      }

      const textarea =
        this.elements[
          "channel-post-content"
        ];

      const button =
        this.elements[
          "publish-channel-post"
        ];

      const content =
        String(
          textarea?.value || ""
        ).trim();

      if (!content) {
        this.showPostError(
          "Write something before publishing."
        );
        return;
      }

      if (content.length > 10000) {
        this.showPostError(
          "The post is too long."
        );
        return;
      }

      if (button) {
        button.disabled = true;
        button.textContent =
          "Publishing...";
      }

      this.clearPostError();

      try {
        const {
          error
        } = await this.db
          .from("channel_posts")
          .insert({
            channel_id:
              channel.id,
            author_id:
              this.user.id,
            content:
              content
          });

        if (error) {
          throw error;
        }

        this.closePostComposer();

        await this.loadChannelPosts(
          channel.id
        );

        await this.updateChannelStats(
          channel.id
        );

      } catch (error) {
        console.error(
          "ZakiChat Channels: publish error:",
          error
        );

        this.showPostError(
          error?.message ||
            "Unable to publish the post."
        );

      } finally {
        if (button) {
          button.disabled = false;
          button.textContent =
            "Publish";
        }
      }
    },

    async deletePost(
      postId
    ) {
      if (!postId ||
          !this.currentChannel) {
        return;
      }

      const confirmed =
        window.confirm(
          "Delete this channel post?"
        );

      if (!confirmed) {
        return;
      }

      try {
        const {
          error
        } = await this.db
          .from("channel_posts")
          .delete()
          .eq(
            "id",
            postId
          );

        if (error) {
          throw error;
        }

        await this.loadChannelPosts(
          this.currentChannel.id
        );

        await this.updateChannelStats(
          this.currentChannel.id
        );

      } catch (error) {
        console.error(
          "ZakiChat Channels: delete post error:",
          error
        );

        window.alert(
          error?.message ||
            "Unable to delete the post."
        );
      }
    },

    showPostError(
      message
    ) {
      const element =
        this.elements[
          "channel-post-error"
        ];

      if (!element) {
        return;
      }

      element.textContent =
        String(message || "");

      element.hidden = false;
    },

    clearPostError() {
      const element =
        this.elements[
          "channel-post-error"
        ];

      if (!element) {
        return;
      }

      element.textContent = "";
      element.hidden = true;
    },

    showChannelMenu() {
      const channel =
        this.currentChannel;

      if (!channel) {
        return;
      }

      if (
        channel.owner_id ===
        this.user.id
      ) {
        const action =
          window.confirm(
            "Press OK to delete this channel. Press Cancel to keep it."
          );

        if (!action) {
          return;
        }

        this.deleteChannel(
          channel.id
        );

        return;
      }

      const membership =
        this.memberships.get(
          channel.id
        );

      if (membership) {
        const leave =
          window.confirm(
            "Stop following this channel?"
          );

        if (leave) {
          this.toggleFollow(
            channel.id
          );
        }
      }
    },

    async deleteChannel(
      channelId
    ) {
      if (!channelId) {
        return;
      }

      try {
        const {
          error
        } = await this.db
          .from("channels")
          .delete()
          .eq(
            "id",
            channelId
          )
          .eq(
            "owner_id",
            this.user.id
          );

        if (error) {
          throw error;
        }

        this.currentChannel = null;

        await this.loadChannels();

        this.closeChannel();

      } catch (error) {
        console.error(
          "ZakiChat Channels: delete channel error:",
          error
        );

        window.alert(
          error?.message ||
            "Unable to delete the channel."
        );
      }
    },

    formatDate(value) {
      if (!value) {
        return "";
      }

      const date = new Date(value);

      if (Number.isNaN(date.getTime())) {
        return "";
      }

      const now = new Date();

      const sameDay =
        date.toDateString() ===
        now.toDateString();

      if (sameDay) {
        return date.toLocaleTimeString(
          [],
          {
            hour: "numeric",
            minute: "2-digit"
          }
        );
      }

      return date.toLocaleDateString(
        [],
        {
          year: "numeric",
          month: "short",
          day: "numeric"
        }
      );
    }

  });

})();

/*
 * ============================================================
 * ZakiChat Channels — Part 3C
 * Channel creation, realtime and initialization
 * ============================================================
 */

(function () {
  "use strict";

  const ZakiChannels =
    window.ZakiChannels;

  if (!ZakiChannels) {
    console.error(
      "ZakiChat Channels: core module unavailable."
    );
    return;
  }

  Object.assign(ZakiChannels, {

    openCreateChannel() {
      const dialog =
        this.elements[
          "create-channel-dialog"
        ];

      if (!dialog) {
        return;
      }

      dialog.hidden = false;

      const message =
        this.elements[
          "create-channel-message"
        ];

      if (message) {
        message.textContent = "";
        message.hidden = true;
        message.className =
          "channel-form-message";
      }

      const nameInput =
        this.elements[
          "channel-name-input"
        ];

      nameInput?.focus();

      this.closeMoreMenu();
    },

    closeCreateChannel() {
      const dialog =
        this.elements[
          "create-channel-dialog"
        ];

      if (dialog) {
        dialog.hidden = true;
      }

      const form =
        this.elements[
          "create-channel-form"
        ];

      form?.reset();

      const publicInput =
        this.elements[
          "channel-public-input"
        ];

      if (publicInput) {
        publicInput.checked = true;
      }

      const message =
        this.elements[
          "create-channel-message"
        ];

      if (message) {
        message.textContent = "";
        message.hidden = true;
        message.className =
          "channel-form-message";
      }
    },

    async createChannel() {
      if (!this.user) {
        return;
      }

      const nameInput =
        this.elements[
          "channel-name-input"
        ];

      const handleInput =
        this.elements[
          "channel-handle-input"
        ];

      const descriptionInput =
        this.elements[
          "channel-description-input"
        ];

      const publicInput =
        this.elements[
          "channel-public-input"
        ];

      const submitButton =
        this.elements[
          "create-channel-submit"
        ];

      const name =
        String(
          nameInput?.value || ""
        ).trim();

      const handle =
        String(
          handleInput?.value || ""
        )
          .trim()
          .toLowerCase();

      const description =
        String(
          descriptionInput?.value || ""
        ).trim();

      const isPublic =
        publicInput?.checked !== false;

      if (!name) {
        this.showCreateMessage(
          "Enter a channel name.",
          "error"
        );
        return;
      }

      if (
        name.length < 1 ||
        name.length > 80
      ) {
        this.showCreateMessage(
          "Channel names must be between 1 and 80 characters.",
          "error"
        );
        return;
      }

      if (
        !/^[a-z0-9_]{3,40}$/.test(
          handle
        )
      ) {
        this.showCreateMessage(
          "Handle must contain only lowercase letters, numbers and underscores, and be 3–40 characters long.",
          "error"
        );
        return;
      }

      if (description.length > 1000) {
        this.showCreateMessage(
          "Description must be 1000 characters or fewer.",
          "error"
        );
        return;
      }

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent =
          "Creating...";
      }

      this.showCreateMessage(
        "",
        ""
      );

      try {
        const {
          data,
          error
        } = await this.db
          .from("channels")
          .insert({
            owner_id:
              this.user.id,
            name:
              name,
            handle:
              handle,
            description:
              description || null,
            is_public:
              isPublic
          })
          .select("*")
          .single();

        if (error) {
          throw error;
        }

        this.closeCreateChannel();

        await this.loadChannels();

        if (data?.id) {
          const freshChannel =
            this.channels.find(
              channel =>
                channel.id === data.id
            ) || data;

          this.currentChannel =
            freshChannel;

          await this.openChannel(
            data.id
          );
        }

      } catch (error) {
        console.error(
          "ZakiChat Channels: create channel error:",
          error
        );

        let message =
          "Unable to create the channel.";

        if (
          error?.code ===
          "23505"
        ) {
          message =
            "That channel handle is already in use.";
        } else if (
          error?.message
        ) {
          message =
            error.message;
        }

        this.showCreateMessage(
          message,
          "error"
        );

      } finally {
        if (submitButton) {
          submitButton.disabled =
            false;

          submitButton.textContent =
            "Create channel";
        }
      }
    },

    showCreateMessage(
      message,
      type = "error"
    ) {
      const element =
        this.elements[
          "create-channel-message"
        ];

      if (!element) {
        return;
      }

      element.textContent =
        String(message || "");

      element.className =
        "channel-form-message";

      if (type) {
        element.classList.add(
          type
        );
      }

      element.hidden =
        !message;
    },

    subscribeRealtime() {
      if (
        !window.ZakiRealtime ||
        typeof window.ZakiRealtime.subscribe !==
          "function"
      ) {
        return;
      }

      this.realtimeChannels =
        [];

      try {
        const channelsSubscription =
          window.ZakiRealtime.subscribe(
            "channels",
            "channels",
            null,
            () => {
              this.loadChannels();
            },
            "*"
          );

        if (
          channelsSubscription
        ) {
          this.realtimeChannels.push(
            channelsSubscription
          );
        }
      } catch (error) {
        console.error(
          "ZakiChat Channels: channels realtime error:",
          error
        );
      }

      try {
        const postsSubscription =
          window.ZakiRealtime.subscribe(
            "channel_posts",
            "channel_posts",
            null,
            payload => {
              const channelId =
                payload?.new?.channel_id ||
                payload?.old?.channel_id;

              if (
                channelId &&
                this.currentChannel?.id ===
                  channelId
              ) {
                this.loadChannelPosts(
                  channelId
                );

                this.updateChannelStats(
                  channelId
                );
              }
            },
            "*"
          );

        if (
          postsSubscription
        ) {
          this.realtimeChannels.push(
            postsSubscription
          );
        }
      } catch (error) {
        console.error(
          "ZakiChat Channels: posts realtime error:",
          error
        );
      }

      try {
        const membersSubscription =
          window.ZakiRealtime.subscribe(
            "channel_members",
            "channel_members",
            null,
            payload => {
              const channelId =
                payload?.new?.channel_id ||
                payload?.old?.channel_id;

              if (channelId) {
                this.loadMemberships()
                  .then(() => {
                    this.myChannels =
                      this.channels.filter(
                        channel =>
                          channel.owner_id ===
                            this.user.id ||
                          this.memberships.has(
                            channel.id
                          )
                      );

                    this.renderMyChannels();

                    const searchInput =
                      this.elements[
                        "channel-search"
                      ];

                    if (
                      searchInput?.value
                    ) {
                      this.handleSearch(
                        searchInput.value
                      );
                    } else {
                      this.renderDiscoverChannels(
                        this.channels
                      );
                    }

                    if (
                      this.currentChannel?.id ===
                      channelId
                    ) {
                      this.renderChannelView(
                        this.currentChannel
                      );

                      this.updateChannelStats(
                        channelId
                      );
                    }
                  })
                  .catch(error => {
                    console.error(
                      "ZakiChat Channels: membership refresh error:",
                      error
                    );
                  });
              }
            },
            "*"
          );

        if (
          membersSubscription
        ) {
          this.realtimeChannels.push(
            membersSubscription
          );
        }
      } catch (error) {
        console.error(
          "ZakiChat Channels: members realtime error:",
          error
        );
      }
    },

    async refreshCurrentChannel() {
      if (!this.currentChannel) {
        return;
      }

      const channelId =
        this.currentChannel.id;

      const {
        data,
        error
      } = await this.db
        .from("channels")
        .select("*")
        .eq(
          "id",
          channelId
        )
        .maybeSingle();

      if (error) {
        console.error(
          "ZakiChat Channels: channel refresh error:",
          error
        );
        return;
      }

      if (!data) {
        this.closeChannel();
        await this.loadChannels();
        return;
      }

      this.currentChannel =
        data;

      const index =
        this.channels.findIndex(
          channel =>
            channel.id ===
            data.id
        );

      if (index >= 0) {
        this.channels[index] =
          data;
      }

      this.renderChannelView(
        data
      );

      await this.loadChannelPosts(
        data.id
      );
    }

  });


  document.addEventListener(
    "DOMContentLoaded",
    async () => {
      try {
        await ZakiChannels.init(
          window.ZakiChatConfig
        );
      } catch (error) {
        console.error(
          "ZakiChat Channels: initialization failed:",
          error
        );
      }
    }
  );

})();
