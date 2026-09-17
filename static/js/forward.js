(function () {
  "use strict";

  let db = null;
  let currentUserId = null;
  let sourceMessageId = null;
  let modal = null;
  let list = null;
  let status = null;

  function init(client, userId) {
    db = client;
    currentUserId = userId || null;

    modal = document.querySelector("#forward-modal");
    list = document.querySelector("#forward-list");
    status = document.querySelector("#forward-status");

    if (!modal || !list) {
      return;
    }

    document
      .querySelector("#forward-close")
      ?.addEventListener("click", close);

    modal
      .querySelectorAll("[data-forward-close]")
      .forEach(element => {
        element.addEventListener("click", close);
      });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && !modal.hidden) {
        close();
      }
    });
  }

  async function open(messageId) {
    if (!db || !currentUserId || !messageId) {
      return;
    }

    sourceMessageId = messageId;

    show();
    setStatus("Loading conversations...");

    try {
      if (!window.ZakiConversations) {
        throw new Error(
          "Conversation system is unavailable."
        );
      }

      const result =
        await window.ZakiConversations.load();

      if (result?.error) {
        throw result.error;
      }

      const conversations =
        Array.isArray(result)
          ? result
          : result?.data || [];

      render(conversations);

      if (!list.children.length) {
        setStatus(
          "No other conversations available."
        );
      } else {
        setStatus("");
      }
    } catch (error) {
      console.error(
        "Failed to load forwarding conversations:",
        error
      );

      setStatus(
        error?.message ||
        "Unable to load conversations."
      );
    }
  }

  function render(conversations) {
    if (!list) {
      return;
    }

    list.innerHTML = "";

    (Array.isArray(conversations)
      ? conversations
      : []
    ).forEach(conversation => {
      const id =
        conversation?.id ||
        conversation?.conversation_id;

      if (!id) {
        return;
      }

      const name =
        conversation?.display_name ||
        conversation?.name ||
        conversation?.title ||
        "Conversation";

      const avatar =
        conversation?.avatar_url ||
        conversation?.avatar ||
        "";

      const button =
        document.createElement("button");

      button.type = "button";
      button.className =
        "forward-conversation";
      button.dataset.conversationId = id;

      button.innerHTML = `
        <span class="forward-avatar">
          ${
            avatar
              ? `<img src="${escapeAttribute(
                  avatar
                )}" alt="">`
              : escapeText(
                  String(name || "?")
                    .charAt(0)
                    .toUpperCase()
                )
          }
        </span>

        <span class="forward-conversation-info">
          <strong>${escapeText(
            name
          )}</strong>
          <small>Tap to forward</small>
        </span>
      `;

      button.addEventListener(
        "click",
        () => forwardTo(id, button)
      );

      list.appendChild(button);
    });
  }

  async function forwardTo(
    conversationId,
    button
  ) {
    if (
      !sourceMessageId ||
      !conversationId ||
      !currentUserId ||
      !window.ZakiMessages
    ) {
      return;
    }

    const buttons =
      list.querySelectorAll("button");

    buttons.forEach(item => {
      item.disabled = true;
    });

    button.classList.add("is-forwarding");
    setStatus("Forwarding...");

    try {
      const result =
        await window.ZakiMessages.forward(
          sourceMessageId,
          conversationId,
          currentUserId
        );

      if (result?.error) {
        throw result.error;
      }

      button.classList.add("is-forwarded");
      setStatus("Message forwarded.");

      setTimeout(close, 500);
    } catch (error) {
      console.error(
        "Failed to forward message:",
        error
      );

      setStatus(
        error?.message ||
        "Unable to forward message."
      );

      buttons.forEach(item => {
        item.disabled = false;
      });

      button.classList.remove(
        "is-forwarding"
      );
    }
  }

  function show() {
    if (!modal) {
      return;
    }

    modal.hidden = false;
    modal.setAttribute(
      "aria-hidden",
      "false"
    );

    document.body.classList.add(
      "forward-modal-open"
    );
  }

  function close() {
    if (!modal) {
      return;
    }

    modal.hidden = true;
    modal.setAttribute(
      "aria-hidden",
      "true"
    );

    document.body.classList.remove(
      "forward-modal-open"
    );

    sourceMessageId = null;

    if (list) {
      list.innerHTML = "";
    }

    setStatus("");
  }

  function setStatus(text) {
    if (!status) {
      return;
    }

    status.textContent =
      String(text || "");

    status.hidden =
      !String(text || "");
  }

  function escapeText(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeAttribute(value) {
    return escapeText(value);
  }

  window.ZakiForward =
    Object.freeze({
      init,
      open,
      close
    });
})();
