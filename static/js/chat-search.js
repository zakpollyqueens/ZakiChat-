(function () {
  "use strict";

  const bar = document.getElementById("chat-search-bar");
  const input = document.getElementById("chat-search-input");
  const count = document.getElementById("chat-search-count");
  const previous = document.getElementById("chat-search-prev");
  const next = document.getElementById("chat-search-next");
  const close = document.getElementById("chat-search-close");
  const searchButton = document.getElementById("search-chat-button");
  const panel = document.querySelector(".messages-panel");

  if (
    !bar ||
    !input ||
    !count ||
    !previous ||
    !next ||
    !close ||
    !searchButton ||
    !panel
  ) {
    return;
  }

  let results = [];
  let currentIndex = -1;

  function clearHighlights() {
    panel
      .querySelectorAll(".message-search-match")
      .forEach(function (element) {
        element.classList.remove("message-search-match");
      });

    panel
      .querySelectorAll(".message-search-current")
      .forEach(function (element) {
        element.classList.remove("message-search-current");
      });
  }

  function getSearchableMessages() {
    return Array.from(
      panel.querySelectorAll("[data-message-id]")
    );
  }

  function searchMessages() {
    clearHighlights();

    const query =
      input.value.trim().toLowerCase();

    results = [];
    currentIndex = -1;

    if (!query) {
      count.textContent = "";
      return;
    }

    getSearchableMessages().forEach(function (message) {
      const text =
        message.textContent
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();

      if (text.includes(query)) {
        message.classList.add(
          "message-search-match"
        );

        results.push(message);
      }
    });

    if (!results.length) {
      count.textContent = "No results";
      return;
    }

    currentIndex = 0;
    updateCurrentResult();
  }

  function updateCurrentResult() {
    results.forEach(function (message) {
      message.classList.remove(
        "message-search-current"
      );
    });

    if (!results.length) {
      count.textContent = "No results";
      return;
    }

    const current =
      results[currentIndex];

    if (!current) {
      return;
    }

    current.classList.add(
      "message-search-current"
    );

    current.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });

    count.textContent =
      `${currentIndex + 1} of ${results.length}`;
  }

  function move(direction) {
    if (!results.length) {
      return;
    }

    currentIndex =
      (currentIndex + direction + results.length) %
      results.length;

    updateCurrentResult();
  }

  function openSearch() {
    bar.hidden = false;

    input.focus();

    input.select();

    searchMessages();
  }

  function closeSearch() {
    input.value = "";

    clearHighlights();

    results = [];
    currentIndex = -1;

    count.textContent = "";

    bar.hidden = true;

    searchButton.focus();
  }

  searchButton.addEventListener(
    "click",
    openSearch
  );

  close.addEventListener(
    "click",
    closeSearch
  );

  input.addEventListener(
    "input",
    searchMessages
  );

  previous.addEventListener(
    "click",
    function () {
      move(-1);
    }
  );

  next.addEventListener(
    "click",
    function () {
      move(1);
    }
  );

  input.addEventListener(
    "keydown",
    function (event) {
      if (event.key === "Enter") {
        event.preventDefault();

        if (event.shiftKey) {
          move(-1);
        } else {
          move(1);
        }
      }

      if (event.key === "Escape") {
        closeSearch();
      }
    }
  );
})();
