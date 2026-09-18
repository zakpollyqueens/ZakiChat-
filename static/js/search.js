(function () {
  "use strict";

  if (!window.supabase || !window.ZakiChatConfig) {
    console.error("ZakiChat People search could not start.");
    return;
  }

  const supabaseClient =
    window.ZakiChatAuth?.client;

  if (!supabaseClient) {
    console.error(
      "ZakiChat People search: centralized Supabase client unavailable."
    );
    return;
  }

  const searchInput =
    document.getElementById("peopleSearch");

  const clearButton =
    document.getElementById("clearSearch");

  const results =
    document.getElementById("peopleResults");

  const status =
    document.getElementById("peopleStatus");

  const resultsTitle =
    document.getElementById("resultsTitle");

  const resultCount =
    document.getElementById("resultCount");

  const toast =
    document.getElementById("toast");

  let currentUser = null;
  let contactIds = new Set();
  let people = [];
  let searchTimer = null;
  let presenceChannel = null;
  let searching = false;

  const SEARCH_DELAY = 280;
  const MAX_RESULTS = 30;

  function showToast(text) {
    if (!toast) return;

    toast.textContent = text;
    toast.hidden = false;

    clearTimeout(showToast.timer);

    showToast.timer = setTimeout(
      function () {
        toast.hidden = true;
      },
      2600
    );
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalizeUsername(value) {
    return String(value || "")
      .trim()
      .replace(/^@+/, "")
      .toLowerCase();
  }

  function getInitials(name, username) {
    const source =
      String(name || "").trim() ||
      String(username || "").trim() ||
      "?";

    const parts = source
      .split(/\s+/)
      .filter(Boolean);

    if (parts.length >= 2) {
      return (
        parts[0].charAt(0) +
        parts[1].charAt(0)
      ).toUpperCase();
    }

    return source
      .replace(/^@+/, "")
      .slice(0, 2)
      .toUpperCase() || "?";
  }

  function formatLastSeen(value) {
    if (!value) return "Offline";

    const date =
      new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "Offline";
    }

    const diff =
      Date.now() - date.getTime();

    if (diff < 60000) {
      return "Last seen just now";
    }

    if (diff < 3600000) {
      const minutes =
        Math.floor(diff / 60000);

      return (
        "Last seen " +
        minutes +
        "m ago"
      );
    }

    if (diff < 86400000) {
      const hours =
        Math.floor(diff / 3600000);

      return (
        "Last seen " +
        hours +
        "h ago"
      );
    }

    return (
      "Last seen " +
      date.toLocaleDateString(
        undefined,
        {
          day: "numeric",
          month: "short"
        }
      )
    );
  }

  function setStatus(
    title,
    text,
    icon
  ) {
    if (!status) return;

    status.hidden = false;

    status.innerHTML = `
      <div class="status-icon">${icon || "⌕"}</div>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(text)}</p>
    `;
  }

  function hideStatus() {
    if (status) {
      status.hidden = true;
    }
  }

  function updateCount(count) {
    if (!resultCount) return;

    resultCount.textContent =
      String(count);

    resultCount.hidden = count === 0;
  }

  function setSearchUi(value) {
    if (clearButton) {
      clearButton.hidden =
        !String(value || "").trim();
    }

    if (resultsTitle) {
      resultsTitle.textContent =
        String(value || "").trim()
          ? "Search results"
          : "People";
    }
  }

  async function loadContactIds() {
    if (!currentUser) return;

    const {
      data,
      error
    } = await supabaseClient
      .from("contacts")
      .select("contact_user_id")
      .eq("user_id", currentUser.id);

    if (error) {
      console.error(
        "Contacts lookup failed:",
        error
      );

      contactIds = new Set();
      return;
    }

    contactIds =
      new Set(
        (data || []).map(
          function (row) {
            return row.contact_user_id;
          }
        )
      );
  }

  async function searchPeople(term) {
    const query =
      String(term || "")
        .trim();

    if (!query) {
      people = [];
      updateCount(0);

      setStatus(
        "Find people on ZakiChat",
        "Search using a username, name or phone number.",
        "⌕"
      );

      return;
    }

    searching = true;

    setStatus(
      "Searching...",
      "Looking for matching ZakiChat profiles.",
      "⌕"
    );

    try {
      const normalized =
        normalizeUsername(query);

      const nameQuery =
        query.replace(/^@+/, "");

      const phoneQuery =
        query.replace(
          /[^\d+]/g,
          ""
        );

      let builder =
        supabaseClient
          .from("profiles")
          .select(
            "id,username,full_name,phone,avatar_url,bio,is_online,last_seen,location"
          )
          .neq(
            "id",
            currentUser.id
          )
          .limit(MAX_RESULTS);

      if (
        phoneQuery &&
        /^[+0-9]+$/.test(phoneQuery)
      ) {
        builder =
          builder.or(
            "phone.ilike.%" +
            phoneQuery +
            "%,username.ilike.%" +
            normalized +
            "%,full_name.ilike.%" +
            nameQuery +
            "%"
          );
      } else {
        builder =
          builder.or(
            "username.ilike.%" +
            normalized +
            "%,full_name.ilike.%" +
            nameQuery +
            "%"
          );
      }

      const {
        data,
        error
      } = await builder;

      if (error) {
        console.error(
          "People search failed:",
          error
        );

        people = [];
        updateCount(0);

        setStatus(
          "Search unavailable",
          "We could not complete the search. Please try again.",
          "!"
        );

        return;
      }

      people =
        Array.isArray(data)
          ? data
          : [];

      updateCount(
        people.length
      );

      if (!people.length) {
        setStatus(
          "No people found",
          "Try a different username, name or phone number.",
          "⌕"
        );

        return;
      }

      hideStatus();
      renderPeople();

    } finally {
      searching = false;
    }
  }

  function renderPeople() {
    if (!results) return;

    results.innerHTML = "";

    people.forEach(
      function (person) {
        const card =
          document.createElement("article");

        card.className =
          "person-card";

        card.dataset.userId =
          person.id;

        const isContact =
          contactIds.has(
            person.id
          );

        const name =
          person.full_name ||
          person.username ||
          "ZakiChat User";

        const username =
          person.username
            ? "@" + person.username
            : "@username";

        const initials =
          getInitials(
            person.full_name,
            person.username
          );

        const online =
          Boolean(person.is_online);

        const avatarHtml =
          person.avatar_url
            ? `
              <img
                src="${escapeHtml(person.avatar_url)}"
                alt=""
                loading="lazy"
              >
            `
            : `
              <span>${escapeHtml(initials)}</span>
            `;

        const location =
          person.location
            ? escapeHtml(
                person.location
              )
            : "";

        const presenceText =
          online
            ? "Online"
            : formatLastSeen(
                person.last_seen
              );

        card.innerHTML = `
          <div class="person-avatar">
            ${avatarHtml}
            <span
              class="online-dot ${online ? "online" : ""}"
              title="${online ? "Online" : "Offline"}"
            ></span>
          </div>

          <div
            class="person-main"
            data-action="profile"
          >
            <h3 class="person-name">
              ${escapeHtml(name)}
            </h3>

            <div class="person-username">
              ${escapeHtml(username)}
            </div>

            <div class="person-meta">
              ${escapeHtml(
                location
                  ? location +
                    " · " +
                    presenceText
                  : presenceText
              )}
            </div>
          </div>

          <div class="person-actions">

            <button
              type="button"
              class="person-action primary"
              data-action="message"
              data-user-id="${escapeHtml(person.id)}"
            >
              Message
            </button>

            <button
              type="button"
              class="person-action ${isContact ? "remove" : ""}"
              data-action="${isContact ? "remove" : "add"}"
              data-user-id="${escapeHtml(person.id)}"
            >
              ${isContact ? "Remove" : "Add Contact"}
            </button>

          </div>
        `;

        results.appendChild(card);

        const image =
          card.querySelector(
            ".person-avatar img"
          );

        if (image) {
          image.addEventListener(
            "error",
            function () {
              const avatar =
                card.querySelector(
                  ".person-avatar"
                );

              if (!avatar) return;

              avatar.innerHTML =
                "<span>" +
                escapeHtml(initials) +
                "</span>" +
                `<span class="online-dot ${online ? "online" : ""}"></span>`;
            }
          );
        }
      }
    );
  }

  async function addContact(userId) {
    if (!currentUser || !userId) {
      return;
    }

    const {
      error
    } = await supabaseClient
      .from("contacts")
      .insert({
        user_id: currentUser.id,
        contact_user_id: userId
      });

    if (error) {
      if (
        String(error.message || "")
          .toLowerCase()
          .includes("duplicate")
      ) {
        contactIds.add(userId);
        renderPeople();
        showToast(
          "Already in your contacts"
        );
        return;
      }

      console.error(
        "Add contact failed:",
        error
      );

      showToast(
        "Could not add this contact."
      );

      return;
    }

    contactIds.add(userId);
    renderPeople();
    showToast(
      "Added to contacts"
    );
  }

  async function removeContact(userId) {
    if (!currentUser || !userId) {
      return;
    }

    const {
      error
    } = await supabaseClient
      .from("contacts")
      .delete()
      .eq(
        "user_id",
        currentUser.id
      )
      .eq(
        "contact_user_id",
        userId
      );

    if (error) {
      console.error(
        "Remove contact failed:",
        error
      );

      showToast(
        "Could not remove this contact."
      );

      return;
    }

    contactIds.delete(
      userId
    );

    renderPeople();

    showToast(
      "Removed from contacts"
    );
  }

  function openMessage(userId) {
    if (!userId) return;

    window.location.href =
      "chats.html?user=" +
      encodeURIComponent(
        userId
      );
  }

  function openProfile(userId) {
    if (!userId) return;

    window.location.href =
      "profile.html?user=" +
      encodeURIComponent(
        userId
      );
  }

  async function handleResultAction(
    event
  ) {
    const button =
      event.target.closest(
        "[data-action]"
      );

    if (!button) return;

    const action =
      button.dataset.action;

    const userId =
      button.dataset.userId;

    if (
      action === "message"
    ) {
      openMessage(userId);
      return;
    }

    if (
      action === "add"
    ) {
      button.disabled = true;

      await addContact(
        userId
      );

      button.disabled = false;
      return;
    }

    if (
      action === "remove"
    ) {
      button.disabled = true;

      await removeContact(
        userId
      );

      button.disabled = false;
      return;
    }

    if (
      action === "profile"
    ) {
      openProfile(userId);
    }
  }

  function handleSearchInput() {
    const value =
      searchInput.value;

    setSearchUi(value);

    clearTimeout(
      searchTimer
    );

    searchTimer =
      setTimeout(
        function () {
          searchPeople(value);
        },
        SEARCH_DELAY
      );
  }

  function clearSearch() {
    if (!searchInput) return;

    searchInput.value = "";

    setSearchUi("");

    people = [];

    if (results) {
      results.innerHTML = "";
    }

    updateCount(0);

    setStatus(
      "Find people on ZakiChat",
      "Search using a username, name or phone number.",
      "⌕"
    );

    searchInput.focus();
  }

  function subscribeToPresence() {
    if (presenceChannel) {
      supabaseClient.removeChannel(
        presenceChannel
      );
    }

    presenceChannel =
      supabaseClient
        .channel(
          "zakichat-people-presence"
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "profiles"
          },
          function (payload) {
            if (
              !payload.new ||
              !payload.new.id
            ) {
              return;
            }

            const person =
              people.find(
                function (item) {
                  return (
                    item.id ===
                    payload.new.id
                  );
                }
              );

            if (!person) return;

            person.is_online =
              payload.new.is_online;

            person.last_seen =
              payload.new.last_seen;

            renderPeople();
          }
        )
        .subscribe();
  }

  async function initialize() {
    const {
      data,
      error
    } = await supabaseClient.auth.getSession();

    if (
      error ||
      !data ||
      !data.session
    ) {
      window.location.replace(
        "login.html"
      );

      return;
    }

    currentUser =
      data.session.user;

    await loadContactIds();

    subscribeToPresence();

    setSearchUi("");

    if (searchInput) {
      searchInput.focus();
    }
  }

  if (searchInput) {
    searchInput.addEventListener(
      "input",
      handleSearchInput
    );
  }

  if (clearButton) {
    clearButton.addEventListener(
      "click",
      clearSearch
    );
  }

  if (results) {
    results.addEventListener(
      "click",
      handleResultAction
    );
  }

  supabaseClient.auth.onAuthStateChange(
    function (
      event,
      session
    ) {
      if (
        event === "SIGNED_OUT" ||
        !session
      ) {
        window.location.replace(
          "login.html"
        );
      }
    }
  );

  initialize();

})();
