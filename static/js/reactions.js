(function () {
  "use strict";

  const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

  let db = null;
  let currentUserId = null;
  let panel = null;
  let channel = null;
  let refreshTimer = null;
  let picker = null;
  let pickerMessageId = null;

  function init(client, userId, messagesPanel) {
    db = client;
    currentUserId = userId || null;
    panel = messagesPanel || null;

    if (!db || !currentUserId || !panel) {
      return;
    }

    observeMessages();
    subscribe();
    refresh();
  }

  function observeMessages() {
    const observer = new MutationObserver(function () {
      scheduleRefresh();
    });

    observer.observe(panel, {
      childList: true,
      subtree: true
    });
  }

  function scheduleRefresh() {
    clearTimeout(refreshTimer);

    refreshTimer = setTimeout(function () {
      refresh();
    }, 80);
  }

  async function refresh() {
    if (!db || !currentUserId || !panel) {
      return;
    }

    const bubbles = Array.from(
      panel.querySelectorAll("[data-message-id]")
    );

    if (!bubbles.length) {
      return;
    }

    const messageIds = bubbles
      .map(function (bubble) {
        return bubble.dataset.messageId;
      })
      .filter(Boolean);

    if (!messageIds.length) {
      return;
    }

    const result = await getForMessages(messageIds);

    if (result.error) {
      console.error(
        "ZakiChat reactions load failed:",
        result.error
      );
      return;
    }

    const grouped = {};

    (result.data || []).forEach(function (reaction) {
      if (!grouped[reaction.message_id]) {
        grouped[reaction.message_id] = [];
      }

      grouped[reaction.message_id].push(reaction);
    });

    bubbles.forEach(function (bubble) {
      renderForMessage(
        bubble,
        grouped[bubble.dataset.messageId] || []
      );
    });
  }

  async function getForMessages(messageIds) {
    if (!db || !messageIds?.length) {
      return {
        data: [],
        error: null
      };
    }

    return db
      .from("message_reactions")
      .select(
        "id,message_id,user_id,emoji,created_at"
      )
      .in("message_id", messageIds)
      .order("created_at", {
        ascending: true
      });
  }

  function renderForMessage(bubble, reactions) {
    let container =
      bubble.querySelector(".message-reactions");

    if (!reactions.length) {
      if (container) {
        container.remove();
      }

      return;
    }

    if (!container) {
      container =
        document.createElement("div");

      container.className =
        "message-reactions";

      bubble.appendChild(container);
    }

    const grouped = group(reactions);

    container.innerHTML = grouped
      .map(function (reaction) {
        return `
          <button
            type="button"
            class="message-reaction ${
              reaction.reactedByMe
                ? "reacted-by-me"
                : ""
            }"
            data-reaction-emoji="${escapeAttribute(
              reaction.emoji
            )}"
            aria-label="${escapeAttribute(
              reaction.emoji
            )} ${reaction.count}"
            title="React with ${escapeAttribute(
              reaction.emoji
            )}"
          >
            <span>${reaction.emoji}</span>
            <b>${reaction.count}</b>
          </button>
        `;
      })
      .join("");

    if (!container.dataset.bound) {
      container.dataset.bound = "true";

      container.addEventListener(
        "click",
        async function (event) {
          const button =
            event.target.closest(
              "[data-reaction-emoji]"
            );

          if (!button) {
            return;
          }

          const messageId =
            bubble.dataset.messageId;

          const emoji =
            button.dataset.reactionEmoji;

          if (!messageId || !emoji) {
            return;
          }

          button.disabled = true;

          const result =
            await toggle(
              messageId,
              emoji
            );

          button.disabled = false;

          if (result.error) {
            console.error(
              "ZakiChat reaction failed:",
              result.error
            );
            return;
          }

          await refresh();
        }
      );
    }
  }

  function closePicker() {
    if (picker) {
      picker.remove();
      picker = null;
    }

    pickerMessageId = null;
  }

  function openPicker(messageId, anchor) {
    if (!messageId || !anchor) {
      return;
    }

    closePicker();

    pickerMessageId = messageId;

    picker = document.createElement("div");
    picker.className = "reaction-picker";
    picker.setAttribute("role", "menu");
    picker.setAttribute("aria-label", "Choose a reaction");

    EMOJIS.forEach(function (emoji) {
      const button = document.createElement("button");

      button.type = "button";
      button.className = "reaction-picker-button";
      button.textContent = emoji;
      button.dataset.reactionEmoji = emoji;
      button.setAttribute("role", "menuitem");
      button.setAttribute("aria-label", "React with " + emoji);

      button.addEventListener("click", async function (event) {
        event.stopPropagation();

        const result = await toggle(
          pickerMessageId,
          emoji
        );

        if (result.error) {
          console.error(
            "ZakiChat reaction failed:",
            result.error
          );
          return;
        }

        closePicker();
        await refresh();
      });

      picker.appendChild(button);
    });

    document.body.appendChild(picker);

    const rect = anchor.getBoundingClientRect();
    const pickerRect = picker.getBoundingClientRect();

    let left =
      rect.left +
      (rect.width / 2) -
      (pickerRect.width / 2);

    let top =
      rect.top -
      pickerRect.height -
      8;

    const margin = 8;

    left = Math.max(
      margin,
      Math.min(
        left,
        window.innerWidth -
          pickerRect.width -
          margin
      )
    );

    if (top < margin) {
      top = rect.bottom + 8;
    }

    picker.style.left = `${left}px`;
    picker.style.top = `${top}px`;
  }

  async function toggle(messageId, emoji) {
    if (!db || !currentUserId) {
      return {
        data: null,
        error: new Error(
          "You must be signed in to react."
        )
      };
    }

    if (!EMOJIS.includes(emoji)) {
      return {
        data: null,
        error: new Error(
          "Unsupported reaction."
        )
      };
    }

    const {
      data: existing,
      error: findError
    } = await db
      .from("message_reactions")
      .select("id")
      .eq("message_id", messageId)
      .eq("user_id", currentUserId)
      .eq("emoji", emoji)
      .maybeSingle();

    if (findError) {
      return {
        data: null,
        error: findError
      };
    }

    if (existing) {
      return db
        .from("message_reactions")
        .delete()
        .eq("id", existing.id)
        .select()
        .maybeSingle();
    }

    return db
      .from("message_reactions")
      .insert({
        message_id: messageId,
        user_id: currentUserId,
        emoji
      })
      .select()
      .single();
  }

  function group(reactions) {
    const grouped = {};

    (reactions || []).forEach(
      function (reaction) {
        if (!grouped[reaction.emoji]) {
          grouped[reaction.emoji] = {
            emoji: reaction.emoji,
            count: 0,
            reactedByMe: false
          };
        }

        grouped[reaction.emoji].count += 1;

        if (
          reaction.user_id ===
          currentUserId
        ) {
          grouped[
            reaction.emoji
          ].reactedByMe = true;
        }
      }
    );

    return Object.values(grouped);
  }

  function escapeAttribute(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function subscribe() {
    if (!db || channel) {
      return;
    }

    channel = db
      .channel(
        "zakichat-message-reactions"
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "message_reactions"
        },
        function () {
          scheduleRefresh();
        }
      )
      .subscribe();
  }

  window.ZakiReactions =
    Object.freeze({
      EMOJIS,
      init,
      refresh,
      getForMessages,
      toggle,
      group,
      open: openPicker,
      close: closePicker
    });
})();


document.addEventListener("click", function (event) {
  if (
    picker &&
    !picker.contains(event.target) &&
    !event.target.closest("[data-message-action='react']")
  ) {
    closePicker();
  }
});

document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    closePicker();
  }
});
