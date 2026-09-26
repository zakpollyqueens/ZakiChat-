document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const client = window.ZakiChatAuth?.client;
  const picker = document.getElementById("new-chat-picker");
  const list = document.getElementById("new-chat-list");
  const search = document.getElementById("new-chat-search");

  if (!client || !picker || !list) return;

  let contacts = [];
  let currentUser = null;

  const initials = profile => {
    const text = profile?.full_name || profile?.username || "Z";
    return text.split(/\s+/).filter(Boolean).slice(0, 2)
      .map(x => x[0].toUpperCase()).join("") || "Z";
  };

  const open = async () => {
    picker.hidden = false;
    picker.setAttribute("aria-hidden", "false");
    document.body.classList.add("new-chat-open");

    if (search) {
      search.value = "";
      setTimeout(() => search.focus(), 50);
    }

    await loadContacts();
  };

  const close = () => {
    picker.hidden = true;
    picker.setAttribute("aria-hidden", "true");
    document.body.classList.remove("new-chat-open");
  };

  const render = (query = "") => {
    const q = query.trim().toLowerCase();

    const filtered = contacts.filter(item => {
      const p = item.profile || {};
      return [
        p.full_name,
        p.username,
        p.phone
      ].filter(Boolean).join(" ").toLowerCase().includes(q);
    });

    list.innerHTML = "";

    if (!filtered.length) {
      list.innerHTML = `
        <div class="new-chat-empty">
          <div>💬</div>
          <strong>${contacts.length ? "No matching contacts" : "No contacts yet"}</strong>
          <span>${contacts.length
            ? "Try another name, username or phone number."
            : "Add someone first using New Contact."}</span>
        </div>
      `;
      return;
    }

    filtered.forEach(item => {
      const p = item.profile;
      if (!p) return;

      const row = document.createElement("button");
      row.type = "button";
      row.className = "new-chat-contact";

      const avatar = p.avatar_url
        ? `<img src="${p.avatar_url}" alt="">`
        : `<span>${initials(p)}</span>`;

      row.innerHTML = `
        <div class="new-chat-avatar">${avatar}</div>
        <div class="new-chat-contact-info">
          <strong>${p.full_name || p.username || "ZakiChat User"}</strong>
          <span>${p.username ? "@" + p.username : (p.phone || "ZakiChat user")}</span>
        </div>
        <span class="new-chat-arrow">›</span>
      `;

      row.addEventListener("click", () => {
        window.location.href =
          "chats.html?user=" + encodeURIComponent(p.id);
      });

      list.appendChild(row);
    });
  };

  const loadContacts = async () => {
    if (!currentUser) {
      const result = await client.auth.getUser();
      currentUser = result.data?.user || null;
    }

    if (!currentUser) {
      list.innerHTML = `
        <div class="new-chat-empty">
          <strong>Please sign in</strong>
        </div>
      `;
      return;
    }

    list.innerHTML = `<div class="new-chat-loading">Loading contacts...</div>`;

    const { data, error } = await client
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
      console.error("New Chat contacts error:", error);
      list.innerHTML = `
        <div class="new-chat-empty">
          <strong>Contacts unavailable</strong>
          <span>We couldn't load your contacts. Try again.</span>
        </div>
      `;
      return;
    }

    contacts = data || [];
    render(search?.value || "");
  };

  document
    .querySelectorAll(".quick-create-item")
    .forEach(item => {
      if (item.textContent.trim().includes("New Chat")) {
        item.addEventListener("click", event => {
          event.preventDefault();
          event.stopPropagation();
          open();
        });
      }
    });

  picker.querySelectorAll("[data-new-chat-close]")
    .forEach(el => el.addEventListener("click", close));

  search?.addEventListener("input", () => {
    render(search.value);
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !picker.hidden) close();
  });
});
