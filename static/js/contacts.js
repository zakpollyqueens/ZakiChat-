document.addEventListener("DOMContentLoaded", async () => {
  "use strict";

  if (!window.supabase || !window.ZakiChatConfig) {
    console.error("ZakiChat Contacts: Supabase configuration unavailable.");
    return;
  }

  const db =
    window.ZakiChatAuth?.client;

  if (!db) {
    console.error(
      "ZakiChat: centralized Supabase client unavailable."
    );
    return;
  };

  const $ = id => document.getElementById(id);

  const modal = $("contactModal");
  const peopleModal = $("peopleModal");
  const inviteModal = $("inviteModal");

  const openAddContact = $("openAddContact");
  const closeAddContact = $("closeAddContact");
  const emptyAddBtn = $("emptyAddBtn");

  const form = $("addContactForm");
  const countryCode = $("countryCode");
  const phoneInput = $("phoneNumber");
  const usernameInput = $("contactUsername");
  const nameInput = $("contactName");
  const formMessage = $("formMessage");

  const contactSearch = $("contactSearch");
  const clearSearch = $("clearSearch");
  const contactList = $("contactList");
  const emptyContacts = $("emptyContacts");
  const emptyTitle = $("emptyTitle");
  const emptyText = $("emptyText");
  const contactCount = $("contactCount");

  const findPeopleBtn = $("findPeopleBtn");
  const importContactsBtn = $("importContactsBtn");
  const inviteBtn = $("inviteBtn");

  const closePeopleModal = $("closePeopleModal");
  const peopleSearchInput = $("peopleSearchInput");
  const peopleResults = $("peopleResults");

  const modalInviteBtn = $("modalInviteBtn");
  const saveContactBtn = $("saveContactBtn");

  const closeInviteModal = $("closeInviteModal");
  const shareInviteBtn = $("shareInviteBtn");
  const copyInviteBtn = $("copyInviteBtn");
  const invitePreview = $("invitePreview");
  const inviteMessage = $("inviteMessage");

  let currentUser = null;
  let contacts = [];
  let peopleSearchTimer = null;

  const chatMode =
    new URLSearchParams(window.location.search).get("mode") === "chat";

  function showFormMessage(text, error = false) {
    if (!formMessage) return;

    formMessage.textContent = text;
    formMessage.classList.toggle("error", error);
    formMessage.style.display = "block";
  }

  function hideFormMessage() {
    if (!formMessage) return;

    formMessage.textContent = "";
    formMessage.classList.remove("error");
    formMessage.style.display = "none";
  }

  function showInviteMessage(text, error = false) {
    if (!inviteMessage) return;

    inviteMessage.textContent = text;
    inviteMessage.classList.toggle("error", error);
    inviteMessage.style.display = "block";
  }

  function hideInviteMessage() {
    if (!inviteMessage) return;

    inviteMessage.textContent = "";
    inviteMessage.classList.remove("error");
    inviteMessage.style.display = "none";
  }

  function openModal(target) {
    target?.classList.add("open");
    target?.setAttribute("aria-hidden", "false");
  }

  function closeModal(target) {
    target?.classList.remove("open");
    target?.setAttribute("aria-hidden", "true");
  }

  function openAddModal() {
    hideFormMessage();
    openModal(modal);

    setTimeout(() => {
      phoneInput?.focus();
    }, 100);
  }

  function closeAddModal() {
    closeModal(modal);
    form?.reset();
    hideFormMessage();
  }

  function normalizePhone(value) {
    return String(value || "")
      .replace(/[^\d+]/g, "")
      .replace(/(?!^)\+/g, "");
  }

  function buildPhone() {
    const raw = String(phoneInput?.value || "")
      .trim()
      .replace(/[^\d]/g, "");

    if (!raw) return "";

    const code = countryCode?.value || "+256";

    if (raw.startsWith("00")) {
      return "+" + raw.slice(2);
    }

    if (raw.startsWith("0")) {
      return code + raw.slice(1);
    }

    return code + raw;
  }

  function normalizeUsername(value) {
    return String(value || "")
      .trim()
      .replace(/^@+/, "")
      .toLowerCase();
  }

  function initials(profile) {
    const source =
      profile?.full_name ||
      profile?.username ||
      "Z";

    const parts = source
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    return parts
      .slice(0, 2)
      .map(part => part.charAt(0).toUpperCase())
      .join("") || "Z";
  }

  function profileStatus(profile) {
    if (profile?.is_online) {
      return "Online";
    }

    if (profile?.last_seen) {
      const date = new Date(profile.last_seen);

      if (!Number.isNaN(date.getTime())) {
        const diff = Date.now() - date.getTime();

        if (diff < 60000) {
          return "Last seen just now";
        }

        if (diff < 3600000) {
          return `Last seen ${Math.floor(diff / 60000)}m ago`;
        }

        if (diff < 86400000) {
          return `Last seen ${Math.floor(diff / 3600000)}h ago`;
        }

        return `Last seen ${date.toLocaleDateString()}`;
      }
    }

    return "ZakiChat user";
  }

  function updateCount(count) {
    if (!contactCount) return;

    contactCount.textContent =
      `${count} ${count === 1 ? "contact" : "contacts"}`;
  }

  function setLoading(loading) {
    if (!contactList) return;

    const existing = $("contactsLoading");

    if (loading) {
      if (!existing) {
        contactList.innerHTML = `
          <div class="contacts-loading" id="contactsLoading">
            <div class="loading-spinner"></div>
            <span>Loading contacts...</span>
          </div>
        `;
      }
    } else {
      existing?.remove();
    }
  }

  function setEmptyState(show, title, text) {
    if (!emptyContacts) return;

    emptyContacts.hidden = !show;

    if (emptyTitle && title) {
      emptyTitle.textContent = title;
    }

    if (emptyText && text) {
      emptyText.textContent = text;
    }
  }

  function renderContacts(query = "") {
    if (!contactList) return;

    const normalized = query.trim().toLowerCase();

    const filtered = contacts.filter(item => {
      const profile = item?.profile;

      const searchable = [
        profile?.full_name,
        profile?.username,
        profile?.phone,
        profile?.bio
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(normalized);
    });

    contactList.innerHTML = "";
    updateCount(contacts.length);

    if (!filtered.length) {
      setEmptyState(
        true,
        contacts.length
          ? "No matching contacts"
          : "No contacts yet",
        contacts.length
          ? "Try another name, username or phone number."
          : "Add someone using their phone number or username."
      );
      return;
    }

    setEmptyState(false);

    filtered.forEach(item => {
      const profile = item?.profile;

      if (!profile) return;

      const card = document.createElement("article");
      card.className = "contact-card";

      const avatar = document.createElement("div");
      avatar.className = "contact-avatar";

      if (profile.avatar_url) {
        const img = document.createElement("img");
        img.src = profile.avatar_url;
        img.alt = "";
        img.loading = "lazy";
        avatar.appendChild(img);
      } else {
        avatar.textContent = initials(profile);
      }

      if (profile.is_online) {
        const dot = document.createElement("span");
        dot.className = "online-dot";
        dot.title = "Online";
        avatar.appendChild(dot);
      }

      const info = document.createElement("div");
      info.className = "contact-info";

      const name = document.createElement("strong");
      name.textContent =
        profile.full_name ||
        profile.username ||
        "ZakiChat User";

      const username = document.createElement("span");
      username.className = "username";
      username.textContent =
        profile.username
          ? `@${profile.username}`
          : "ZakiChat user";

      const status = document.createElement("span");
      status.className = "status";
      status.textContent = profileStatus(profile);

      info.appendChild(name);
      info.appendChild(username);
      info.appendChild(status);

      const actions = document.createElement("div");
      actions.className = "contact-actions";

      const chat = document.createElement("button");
      chat.type = "button";
      chat.className = "contact-action primary";
      chat.innerHTML = "💬 <span class=\"action-label\">Chat</span>";

      chat.addEventListener("click", () => {
        window.location.href =
          `chat.html?user=${encodeURIComponent(profile.id)}`;
      });

      if (chatMode) {
        chat.innerHTML = '💬 <span class="action-label">Start chat</span>';
      }

      actions.appendChild(chat);

      const video = document.createElement("button");
      video.type = "button";
      video.className = "contact-action video";
      video.title = `Video call ${profile.full_name || profile.username || ""}`;
      video.innerHTML = '📹 <span class="action-label">Video</span>';

      video.addEventListener("click", () => {
        window.location.href =
          `chat.html?user=${encodeURIComponent(profile.id)}&call=video`;
      });

      actions.appendChild(video);

      if (profile.phone) {
        const call = document.createElement("button");
        call.type = "button";
        call.className = "contact-action call";
        call.title = `Voice call ${profile.full_name || profile.username || ""}`;
        call.innerHTML = '📞 <span class="action-label">Call</span>';

        call.addEventListener("click", () => {
          window.location.href =
            `chat.html?user=${encodeURIComponent(profile.id)}&call=voice`;
        });

        actions.appendChild(call);
      }

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "contact-action remove";
      remove.title = "Remove contact";
      remove.innerHTML = "🗑️";

      remove.addEventListener("click", async () => {
        await removeContact(item.id, profile);
      });

      actions.appendChild(remove);

      card.appendChild(avatar);
      card.appendChild(info);
      card.appendChild(actions);

      contactList.appendChild(card);
    });
  }

  function applyChatMode() {
    if (!chatMode) return;

    document.title = "New Chat | ZakiChat";

    const subtitle = document.getElementById("contactsSubtitle");
    if (subtitle) {
      subtitle.textContent =
        "Select one of your ZakiChat contacts to start a chat.";
    }

    const heading = document.querySelector(".section-heading h2");
    if (heading) {
      heading.textContent = "Choose a contact";
    }

    if (openAddContact) {
      openAddContact.innerHTML = '<span>＋</span><span class="label">Add Contact</span>';
    }
  }

  async function loadContacts() {
    if (!currentUser) return;

    setLoading(true);

    const { data, error } = await db
      .from("contacts")
      .select(`
        id,
        contact_user_id,
        created_at,
        profile:profiles!contacts_contact_user_id_fkey (
          id,
          username,
          full_name,
          phone,
          avatar_url,
          bio,
          is_online,
          last_seen
        )
      `)
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false });

    setLoading(false);

    if (error) {
      console.error("ZakiChat Contacts load error:", error);

      contactList.innerHTML = "";

      setEmptyState(
        true,
        "Contacts unavailable",
        "We could not load your contacts right now. Please try again."
      );

      return;
    }

    contacts = data || [];

    renderContacts(contactSearch?.value || "");
  }

  async function findUser({ phone, username, name }) {
    if (!currentUser) {
      throw new Error("You must be signed in.");
    }

    if (phone) {
      const result = await db
        .from("profiles")
        .select(`
          id,
          username,
          full_name,
          phone,
          avatar_url,
          bio,
          is_online,
          last_seen
        `)
        .eq("phone", normalizePhone(phone))
        .neq("id", currentUser.id)
        .limit(1)
        .maybeSingle();

      if (result.error) throw result.error;
      if (result.data) return result.data;
    }

    if (username) {
      const result = await db
        .from("profiles")
        .select(`
          id,
          username,
          full_name,
          phone,
          avatar_url,
          bio,
          is_online,
          last_seen
        `)
        .eq("username", normalizeUsername(username))
        .neq("id", currentUser.id)
        .limit(1)
        .maybeSingle();

      if (result.error) throw result.error;
      if (result.data) return result.data;
    }

    if (name) {
      const result = await db
        .from("profiles")
        .select(`
          id,
          username,
          full_name,
          phone,
          avatar_url,
          bio,
          is_online,
          last_seen
        `)
        .ilike("full_name", `%${name}%`)
        .neq("id", currentUser.id)
        .limit(10);

      if (result.error) throw result.error;
      if (result.data?.length) return result.data[0];
    }

    return null;
  }

  async function isAlreadyContact(userId) {
    const { data, error } = await db
      .from("contacts")
      .select("id")
      .eq("user_id", currentUser.id)
      .eq("contact_user_id", userId)
      .maybeSingle();

    if (error) throw error;

    return data || null;
  }

  async function addContact(profile) {
    if (!profile?.id) {
      throw new Error("Invalid ZakiChat user.");
    }

    const existing = await isAlreadyContact(profile.id);

    if (existing) {
      return {
        alreadyExists: true,
        contactId: existing.id
      };
    }

    const { data, error } = await db
      .from("contacts")
      .insert({
        user_id: currentUser.id,
        contact_user_id: profile.id
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") {
        return { alreadyExists: true };
      }

      throw error;
    }

    return {
      alreadyExists: false,
      contactId: data?.id
    };
  }

  async function removeContact(contactId, profile) {
    const name =
      profile?.full_name ||
      profile?.username ||
      "this contact";

    const confirmed = window.confirm(
      `Remove ${name} from your contacts?`
    );

    if (!confirmed) return;

    const { error } = await db
      .from("contacts")
      .delete()
      .eq("id", contactId)
      .eq("user_id", currentUser.id);

    if (error) {
      console.error("Remove contact error:", error);
      window.alert("Unable to remove this contact right now.");
      return;
    }

    await loadContacts();
  }

  function createInviteLink() {
    return new URL(
      "signup.html",
      window.location.href
    ).href;
  }

  function openInviteModal() {
    hideInviteMessage();

    const link = createInviteLink();

    if (invitePreview) {
      invitePreview.textContent =
        `You're invited to join ZakiChat. ${link}`;
    }

    openModal(inviteModal);
  }

  async function shareInvite() {
    const link = createInviteLink();

    const shareData = {
      title: "Join me on ZakiChat",
      text: "You're invited to join me on ZakiChat.",
      url: link
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        showInviteMessage("Invite shared.");
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(link);
        showInviteMessage("Invite link copied.");
      } else {
        showInviteMessage(
          "Sharing is unavailable. Use Copy link instead.",
          true
        );
      }
    } catch (error) {
      if (error?.name === "AbortError") return;

      console.error("Invite share error:", error);

      showInviteMessage(
        "Unable to share automatically. Use Copy link instead.",
        true
      );
    }
  }

  async function copyInvite() {
    const link = createInviteLink();

    try {
      if (!navigator.clipboard) {
        throw new Error("Clipboard unavailable");
      }

      await navigator.clipboard.writeText(link);

      showInviteMessage(
        "Invite link copied to clipboard."
      );
    } catch (error) {
      console.error("Copy invite error:", error);

      showInviteMessage(
        "Copy is unavailable in this browser.",
        true
      );
    }
  }

  async function importPhoneContacts() {
    if (
      !("contacts" in navigator) ||
      !navigator.contacts?.select
    ) {
      openInviteModal();

      showInviteMessage(
        "Phone contact import is not supported by this browser. You can still share an invite link."
      );

      return;
    }

    try {
      const selected =
        await navigator.contacts.select(
          ["name", "tel", "email"],
          { multiple: true }
        );

      if (!selected?.length) return;

      let found = 0;
      let added = 0;

      for (const contact of selected) {
        const telephone =
          contact?.tel?.find(Boolean) || "";

        const phone = normalizePhone(telephone);

        if (!phone) continue;

        found++;

        try {
          const profile = await findUser({ phone });

          if (!profile) continue;

          const result = await addContact(profile);

          if (!result.alreadyExists) {
            added++;
          }
        } catch (error) {
          console.error(
            "Phone contact lookup failed:",
            error
          );
        }
      }

      await loadContacts();

      if (found && added) {
        window.alert(
          `${added} ZakiChat contact${added === 1 ? "" : "s"} added.`
        );
      } else if (found) {
        window.alert(
          "No new ZakiChat contacts were found in the selected contacts."
        );
      }
    } catch (error) {
      if (error?.name === "AbortError") return;

      console.error("Phone contacts error:", error);

      window.alert(
        "Phone contact access was cancelled or unavailable."
      );
    }
  }

  async function runPeopleSearch(value) {
    const query = value.trim();

    if (!peopleResults) return;

    if (query.length < 2) {
      peopleResults.innerHTML = `
        <div class="people-hint">
          Enter at least 2 characters to search.
        </div>
      `;
      return;
    }

    peopleResults.innerHTML = `
      <div class="people-hint">
        Searching ZakiChat...
      </div>
    `;

    try {
      let result;

      const phoneQuery =
        query.replace(/[^\d+]/g, "");

      if (
        phoneQuery.length >= 5 &&
        /^[+\d]+$/.test(phoneQuery)
      ) {
        result = await db
          .from("profiles")
          .select(`
            id,
            username,
            full_name,
            phone,
            avatar_url,
            bio,
            is_online,
            last_seen
          `)
          .ilike("phone", `%${phoneQuery}%`)
          .neq("id", currentUser.id)
          .limit(10);
      } else {
        const clean = normalizeUsername(query);

        result = await db
          .from("profiles")
          .select(`
            id,
            username,
            full_name,
            phone,
            avatar_url,
            bio,
            is_online,
            last_seen
          `)
          .or(
            `username.ilike.%${clean}%,full_name.ilike.%${query}%`
          )
          .neq("id", currentUser.id)
          .limit(10);
      }

      if (result.error) throw result.error;

      const profiles = result.data || [];

      if (!profiles.length) {
        peopleResults.innerHTML = `
          <div class="people-hint">
            No ZakiChat users found.
            <br>
            You can invite them to join ZakiChat.
          </div>
        `;
        return;
      }

      peopleResults.innerHTML = "";

      for (const profile of profiles) {
        const row = document.createElement("div");
        row.className = "person-result";

        const avatar =
          document.createElement("div");

        avatar.className =
          "person-result-avatar";

        if (profile.avatar_url) {
          const img =
            document.createElement("img");

          img.src = profile.avatar_url;
          img.alt = "";
          avatar.appendChild(img);
        } else {
          avatar.textContent =
            initials(profile);
        }

        const info =
          document.createElement("div");

        info.className =
          "person-result-info";

        const name =
          document.createElement("strong");

        name.textContent =
          profile.full_name ||
          profile.username ||
          "ZakiChat User";

        const detail =
          document.createElement("span");

        detail.textContent =
          profile.username
            ? `@${profile.username} · ${profileStatus(profile)}`
            : profileStatus(profile);

        info.appendChild(name);
        info.appendChild(detail);

        const add =
          document.createElement("button");

        add.type = "button";
        add.className = "person-add-btn";
        add.textContent = "Add";

        const existing = contacts.some(
          item =>
            item.contact_user_id === profile.id
        );

        if (existing) {
          add.textContent = "Added";
          add.disabled = true;
        }

        add.addEventListener(
          "click",
          async () => {
            add.disabled = true;
            add.textContent = "...";

            try {
              const result =
                await addContact(profile);

              if (result.alreadyExists) {
                add.textContent = "Added";
              } else {
                add.textContent = "Added";
                await loadContacts();
              }
            } catch (error) {
              console.error(
                "Add search result error:",
                error
              );

              add.disabled = false;
              add.textContent = "Add";
            }
          }
        );

        row.appendChild(avatar);
        row.appendChild(info);
        row.appendChild(add);

        peopleResults.appendChild(row);
      }

    } catch (error) {
      console.error(
        "People search error:",
        error
      );

      peopleResults.innerHTML = `
        <div class="people-hint">
          Search is temporarily unavailable.
        </div>
      `;
    }
  }

  form?.addEventListener("submit", async event => {
    event.preventDefault();

    hideFormMessage();

    const phone = buildPhone();
    const username =
      normalizeUsername(usernameInput?.value);
    const name =
      nameInput?.value.trim() || "";

    if (!phone && !username) {
      showFormMessage(
        "Enter a phone number or ZakiChat username.",
        true
      );
      return;
    }

    saveContactBtn.disabled = true;
    saveContactBtn.textContent = "Finding...";

    try {
      const profile = await findUser({
        phone,
        username,
        name
      });

      if (!profile) {
        showFormMessage(
          "This person is not on ZakiChat yet. You can invite them instead.",
          true
        );
        return;
      }

      const result =
        await addContact(profile);

      if (result.alreadyExists) {
        showFormMessage(
          "This person is already in your contacts."
        );
      } else {
        showFormMessage(
          `${profile.full_name || profile.username || "Contact"} was added successfully.`
        );

        await loadContacts();

        setTimeout(
          closeAddModal,
          800
        );
      }

    } catch (error) {
      console.error(
        "Add contact error:",
        error
      );

      showFormMessage(
        "Something went wrong while adding the contact.",
        true
      );
    } finally {
      saveContactBtn.disabled = false;
      saveContactBtn.textContent =
        "Find & Save";
    }
  });


  contactSearch?.addEventListener(
    "input",
    () => {
      const value =
        contactSearch.value;

      if (clearSearch) {
        clearSearch.hidden =
          !value;
      }

      renderContacts(value);
    }
  );

  clearSearch?.addEventListener(
    "click",
    () => {
      contactSearch.value = "";
      clearSearch.hidden = true;
      renderContacts();
      contactSearch.focus();
    }
  );


  peopleSearchInput?.addEventListener(
    "input",
    () => {
      clearTimeout(
        peopleSearchTimer
      );

      peopleSearchTimer =
        setTimeout(() => {
          runPeopleSearch(
            peopleSearchInput.value
          );
        }, 350);
    }
  );


  openAddContact?.addEventListener(
    "click",
    openAddModal
  );

  emptyAddBtn?.addEventListener(
    "click",
    openAddModal
  );

  closeAddContact?.addEventListener(
    "click",
    closeAddModal
  );


  findPeopleBtn?.addEventListener(
    "click",
    () => {
      openModal(peopleModal);

      setTimeout(() => {
        peopleSearchInput?.focus();
      }, 100);
    }
  );

  closePeopleModal?.addEventListener(
    "click",
    () => closeModal(peopleModal)
  );


  importContactsBtn?.addEventListener(
    "click",
    importPhoneContacts
  );

  inviteBtn?.addEventListener(
    "click",
    openInviteModal
  );

  modalInviteBtn?.addEventListener(
    "click",
    openInviteModal
  );


  closeInviteModal?.addEventListener(
    "click",
    () => closeModal(inviteModal)
  );

  shareInviteBtn?.addEventListener(
    "click",
    shareInvite
  );

  copyInviteBtn?.addEventListener(
    "click",
    copyInvite
  );


  [modal, peopleModal, inviteModal]
    .forEach(backdrop => {
      backdrop?.addEventListener(
        "click",
        event => {
          if (
            event.target === backdrop
          ) {
            closeModal(backdrop);
          }
        }
      );
    });


  document.addEventListener(
    "keydown",
    event => {
      if (event.key !== "Escape") {
        return;
      }

      closeModal(modal);
      closeModal(peopleModal);
      closeModal(inviteModal);
    }
  );


  const {
    data: {
      user
    }
  } = await db.auth.getUser();

  currentUser = user || null;

  if (!currentUser) {
    return;
  }

  await loadContacts();
});
