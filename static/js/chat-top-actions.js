document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const searchButton =
    document.getElementById("top-search-button");

  const moreButton =
    document.getElementById("top-more-button");

  const moreMenu =
    document.getElementById("top-more-menu");

  const moreWrapper =
    document.getElementById("top-more-wrapper");

  const conversationSearch =
    document.querySelector(
      '.search-box input[type="search"]'
    );

  const menuSearch =
    document.getElementById("menu-search");

  function closeMoreMenu() {
    if (!moreMenu || !moreButton) return;

    moreMenu.hidden = true;
    moreButton.setAttribute(
      "aria-expanded",
      "false"
    );
  }

  function toggleMoreMenu() {
    if (!moreMenu || !moreButton) return;

    const willOpen = moreMenu.hidden;

    moreMenu.hidden = !willOpen;
    moreButton.setAttribute(
      "aria-expanded",
      String(willOpen)
    );
  }

  function focusConversationSearch() {
    if (!conversationSearch) return;

    conversationSearch.focus();
    conversationSearch.select();

    conversationSearch.scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });
  }

  searchButton?.addEventListener(
    "click",
    () => {
      focusConversationSearch();
    }
  );

  moreButton?.addEventListener(
    "click",
    event => {
      event.stopPropagation();
      toggleMoreMenu();
    }
  );

  moreMenu?.addEventListener(
    "click",
    event => {
      event.stopPropagation();
    }
  );

  menuSearch?.addEventListener(
    "click",
    () => {
      closeMoreMenu();
      focusConversationSearch();
    }
  );

  document.addEventListener(
    "click",
    event => {
      if (
        moreWrapper &&
        !moreWrapper.contains(event.target)
      ) {
        closeMoreMenu();
      }
    }
  );

  document.addEventListener(
    "keydown",
    event => {
      if (event.key === "Escape") {
        closeMoreMenu();
      }
    }
  );

  window.addEventListener(
    "resize",
    () => {
      if (
        window.innerWidth <= 700
      ) {
        closeMoreMenu();
      }
    }
  );
});
