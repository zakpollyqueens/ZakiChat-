document.addEventListener("DOMContentLoaded", async () => {
  const modal = document.getElementById("contactModal");
  const openBtn = document.getElementById("openAddContact");
  const closeBtn = document.getElementById("closeAddContact");
  const form = document.getElementById("addContactForm");
  const phone = document.getElementById("phoneNumber");
  const email = document.getElementById("contactEmail");
  const message = document.getElementById("formMessage");
  const search = document.getElementById("contactSearch");
  const list = document.getElementById("contactList");
  const empty = document.getElementById("emptyContacts");

  if (!window.supabase || !window.ZakiChatConfig) {
    console.error("ZakiChat Supabase configuration is unavailable.");
    return;
  }

  const db = window.supabase.createClient(
    window.ZakiChatConfig.supabaseUrl,
    window.ZakiChatConfig.supabaseKey
  );

  let currentUser = null;
  let contacts = [];

  function showMessage(text, error = false) {
    if (!message) return;

    message.textContent = text;
    message.style.display = "block";
    message.style.color = error ? "#ff8f9c" : "";
  }

  function hideMessage() {
    if (!message) return;

    message.textContent = "";
    message.style.display = "none";
  }

  function openModal() {
    modal?.classList.add("open");
    modal?.setAttribute("aria-hidden", "false");

    setTimeout(() => {
      document.getElementById("contactName")?.focus();
    }, 100);
  }

  function closeModal() {
    modal?.classList.remove("open");
    modal?.setAttribute("aria-hidden", "true");
    form?.reset();
    hideMessage();
  }

  function initials(profile) {
    const name =
      profile?.full_name ||
      profile?.username ||
      "Z";

    return name
      .split(/\s+/)
      .slice(0, 2)
      .map(word => word.charAt(0).toUpperCase())
      .join("") || "Z";
  }

  function renderContacts(query = "") {
    if (!list) return;

    list.innerHTML = "";

    const normalized = query.toLowerCase().trim();

    const filtered = contacts.filter(item => {
      const profile = item.profile;

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

    if (empty) {
      empty.style.display = filtered.length ? "none" : "block";
    }

    filtered.forEach(item => {
      const profile = item.profile;

      const card = document.createElement("article");
      card.className = "contact-card";

      const avatar = document.createElement("div");
      avatar.className = "contact-avatar gradient-avatar";

      if (profile?.avatar_url) {
        avatar.style.backgroundImage =
          `url("${profile.avatar_url}")`;
        avatar.style.backgroundSize = "cover";
        avatar.style.backgroundPosition = "center";
        avatar.textContent = "";
      } else {
        avatar.textContent = initials(profile);
      }

      const info = document.createElement("div");
      info.className = "contact-info";

      const name = document.createElement("strong");
      name.textContent =
        profile?.full_name ||
        profile?.username ||
        "ZakiChat User";

      const details = document.createElement("span");
      details.textContent =
        profile?.username
          ? `@${profile.username}`
          : profile?.phone || "ZakiChat contact";

      const action = document.createElement("button");
      action.type = "button";
      action.className = "contact-action";
      action.textContent = "Chat";

      action.addEventListener("click", () => {
        const target = profile?.id;

        if (!target) return;

        window.location.href =
          `chats.html?user=${encodeURIComponent(target)}`;
      });

      info.appendChild(name);
      info.appendChild(details);

      card.appendChild(avatar);
      card.appendChild(info);
      card.appendChild(action);

      list.appendChild(card);
    });
  }

  async function loadContacts() {
    if (!currentUser) {
      contacts = [];
      renderContacts();
      return;
    }

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

    if (error) {
      console.error("Failed to load contacts:", error);
      showMessage("Unable to load contacts right now.", true);
      return;
    }

    contacts = data || [];
    renderContacts(search?.value || "");
  }

  async function findUser(name, phoneValue, emailValue) {
    if (phoneValue) {
      const result = await db
        .from("profiles")
        .select("id,username,full_name,phone,avatar_url,bio")
        .eq("phone", phoneValue)
        .neq("id", currentUser.id)
        .limit(1)
        .maybeSingle();

      if (result.error) throw result.error;
      if (result.data) return result.data;
    }

    if (emailValue) {
      const result = await db
        .from("profiles")
        .select("id,username,full_name,phone,avatar_url,bio")
        .eq("username", emailValue)
        .neq("id", currentUser.id)
        .limit(1)
        .maybeSingle();

      if (result.error) throw result.error;
      if (result.data) return result.data;
    }

    if (name) {
      const result = await db
        .from("profiles")
        .select("id,username,full_name,phone,avatar_url,bio")
        .ilike("full_name", `%${name}%`)
        .neq("id", currentUser.id)
        .limit(1)
        .maybeSingle();

      if (result.error) throw result.error;
      if (result.data) return result.data;
    }

    return null;
  }

  openBtn?.addEventListener("click", openModal);
  closeBtn?.addEventListener("click", closeModal);

  modal?.addEventListener("click", event => {
    if (event.target === modal) {
      closeModal();
    }
  });

  document.addEventListener("keydown", event => {
    if (
      event.key === "Escape" &&
      modal?.classList.contains("open")
    ) {
      closeModal();
    }
  });

  form?.addEventListener("submit", async event => {
    event.preventDefault();

    hideMessage();

    if (!currentUser) {
      showMessage(
        "Please sign in to add contacts.",
        true
      );
      return;
    }

    const name =
      document.getElementById("contactName")
        ?.value
        .trim() || "";

    const phoneValue = phone?.value.trim() || "";
    const emailValue = email?.value.trim() || "";

    if (!name || (!phoneValue && !emailValue)) {
      showMessage(
        "Enter a contact name and either a phone number or email.",
        true
      );
      return;
    }

    showMessage("Finding ZakiChat user...");

    try {
      const profile = await findUser(
        name,
        phoneValue,
        emailValue
      );

      if (!profile) {
        showMessage(
          "No matching ZakiChat user was found.",
          true
        );
        return;
      }

      const { error } = await db
        .from("contacts")
        .insert({
          user_id: currentUser.id,
          contact_user_id: profile.id
        });

      if (error) {
        if (error.code === "23505") {
          showMessage("This contact is already saved.", true);
        } else {
          console.error(error);
          showMessage(
            "Could not save this contact.",
            true
          );
        }

        return;
      }

      showMessage("Contact added successfully.");

      await loadContacts();

      setTimeout(closeModal, 700);

    } catch (error) {
      console.error("Contact error:", error);

      showMessage(
        "Something went wrong while adding the contact.",
        true
      );
    }
  });

  search?.addEventListener("input", () => {
    renderContacts(search.value);
  });

  const {
    data: {
      user
    }
  } = await db.auth.getUser();

  currentUser = user || null;

  if (!currentUser) {
    console.log(
      "ZakiChat: no authenticated user."
    );

    if (empty) {
      empty.style.display = "block";
    }

    return;
  }

  await loadContacts();
});
