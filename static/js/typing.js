(function () {
  "use strict";

  let channel = null;
  let currentUserId = null;
  let conversationId = null;
  let indicator = null;
  let restoreStatus = null;
  let typingTimer = null;
  let clearTimer = null;
  let lastBroadcast = 0;

  const TYPING_TIMEOUT = 1800;
  const BROADCAST_INTERVAL = 700;

  function init(
    db,
    userId,
    activeConversationId,
    targetIndicator,
    restoreCallback
  ) {
    cleanup();

    currentUserId =
      userId || null;

    conversationId =
      activeConversationId || null;

    indicator =
      targetIndicator || null;

    restoreStatus =
      typeof restoreCallback === "function"
        ? restoreCallback
        : null;

    if (
      !db ||
      !currentUserId ||
      !conversationId
    ) {
      return;
    }

    channel = db.channel(
      `typing:${conversationId}`
    );

    channel
      .on(
        "broadcast",
        {
          event: "typing"
        },
        function (payload) {
          handleTyping(
            payload?.payload
          );
        }
      )
      .subscribe();
  }

  function handleInput(
    db,
    text
  ) {
    if (
      !channel ||
      !currentUserId ||
      !conversationId
    ) {
      return;
    }

    if (
      !String(text || "").trim()
    ) {
      stopTyping();
      return;
    }

    const now =
      Date.now();

    if (
      now - lastBroadcast >=
      BROADCAST_INTERVAL
    ) {
      lastBroadcast = now;

      channel.send({
        type: "broadcast",
        event: "typing",
        payload: {
          user_id:
            currentUserId,
          typing: true
        }
      });
    }

    clearTimeout(
      typingTimer
    );

    typingTimer =
      setTimeout(
        stopTyping,
        TYPING_TIMEOUT
      );
  }

  function stopTyping() {
    clearTimeout(
      typingTimer
    );

    typingTimer = null;

    if (
      channel &&
      currentUserId
    ) {
      channel.send({
        type: "broadcast",
        event: "typing",
        payload: {
          user_id:
            currentUserId,
          typing: false
        }
      });
    }
  }

  function handleTyping(
    payload
  ) {
    if (
      !payload ||
      payload.user_id ===
        currentUserId
    ) {
      return;
    }

    clearTimeout(
      clearTimer
    );

    if (payload.typing) {
      show();

      clearTimer =
        setTimeout(
          hide,
          TYPING_TIMEOUT + 500
        );
    } else {
      hide();
    }
  }

  function show() {
    if (!indicator) {
      return;
    }

    indicator.textContent =
      "typing…";

    indicator.classList.add(
      "is-typing"
    );
  }

  function hide() {
    if (!indicator) {
      return;
    }

    indicator.classList.remove(
      "is-typing"
    );

    if (restoreStatus) {
      restoreStatus();
    }
  }

  function cleanup() {
    clearTimeout(
      typingTimer
    );

    clearTimeout(
      clearTimer
    );

    typingTimer = null;
    clearTimer = null;

    if (channel) {
      channel.unsubscribe();
    }

    channel = null;
    currentUserId = null;
    conversationId = null;
    indicator = null;
    restoreStatus = null;
    lastBroadcast = 0;
  }

  window.ZakiTyping =
    Object.freeze({
      init,
      handleInput,
      stopTyping,
      cleanup
    });
})();
