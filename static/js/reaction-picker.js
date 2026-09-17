(function () {
  "use strict";

  const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

  let panel = null;
  let picker = null;
  let activeMessageId = null;

  function init(messagesPanel) {
    panel = messagesPanel || null;

    if (!panel || !window.ZakiReactions) {
      return;
    }

    createPicker();

    panel.addEventListener(
      "contextmenu",
      handleContextMenu
    );

    panel.addEventListener(
      "click",
      handleClick
    );

    document.addEventListener(
      "click",
      handleDocumentClick
    );

    document.addEventListener(
      "keydown",
      function (event) {
        if (event.key === "Escape") {
          hide();
        }
      }
    );
  }

  function createPicker() {
    picker = document.createElement("div");

    picker.className =
      "reaction-picker";

    picker.hidden = true;

    picker.setAttribute(
      "role",
      "menu"
    );

    picker.innerHTML = EMOJIS
      .map(function (emoji) {
        return `
          <button
            type="button"
            class="reaction-picker-item"
            data-picker-emoji="${emoji}"
            aria-label="React with ${emoji}"
            title="${emoji}"
          >${emoji}</button>
        `;
      })
      .join("");

    document.body.appendChild(picker);

    picker.addEventListener(
      "click",
      async function (event) {
        const button =
          event.target.closest(
            "[data-picker-emoji]"
          );

        if (!button || !activeMessageId) {
          return;
        }

        const emoji =
          button.dataset.pickerEmoji;

        const messageId =
          activeMessageId;

        hide();

        const result =
          await window.ZakiReactions.toggle(
            messageId,
            emoji
          );

        if (result.error) {
          console.error(
            "ZakiChat reaction failed:",
            result.error
          );
          return;
        }

        await window.ZakiReactions.refresh();
      }
    );
  }

  function handleContextMenu(event) {
    const message =
      event.target.closest(
        "[data-message-id]"
      );

    if (!message) {
      return;
    }

    event.preventDefault();

    openForMessage(
      message,
      event.clientX,
      event.clientY
    );
  }

  function handleClick(event) {
    const message =
      event.target.closest(
        "[data-message-id]"
      );

    if (!message) {
      return;
    }

    if (
      event.target.closest(
        ".message-actions"
      ) ||
      event.target.closest(
        ".message-reactions"
      )
    ) {
      return;
    }

    if (
      event.detail === 2
    ) {
      openForMessage(
        message,
        event.clientX,
        event.clientY
      );
    }
  }

  function openForMessage(
    message,
    x,
    y
  ) {
    if (!picker) {
      return;
    }

    activeMessageId =
      message.dataset.messageId;

    picker.hidden = false;

    const rect =
      picker.getBoundingClientRect();

    const margin = 8;

    let left =
      x - rect.width / 2;

    let top =
      y - rect.height - 12;

    if (
      left < margin
    ) {
      left = margin;
    }

    if (
      left + rect.width >
      window.innerWidth - margin
    ) {
      left =
        window.innerWidth -
        rect.width -
        margin;
    }

    if (
      top < margin
    ) {
      top =
        y + 12;
    }

    if (
      top + rect.height >
      window.innerHeight - margin
    ) {
      top =
        window.innerHeight -
        rect.height -
        margin;
    }

    picker.style.left =
      `${left}px`;

    picker.style.top =
      `${top}px`;
  }

  function handleDocumentClick(event) {
    if (
      picker &&
      !picker.hidden &&
      !picker.contains(event.target) &&
      !event.target.closest(
        "[data-message-id]"
      )
    ) {
      hide();
    }
  }

  function hide() {
    if (!picker) {
      return;
    }

    picker.hidden = true;
    activeMessageId = null;
  }

  window.ZakiReactionPicker =
    Object.freeze({
      init,
      hide
    });
})();
