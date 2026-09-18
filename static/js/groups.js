(() => {
  "use strict";

  const supabaseUrl = window.ZakiChatConfig?.supabaseUrl;
  const supabaseKey = window.ZakiChatConfig?.supabaseKey;

  if (!supabaseUrl || !supabaseKey || !window.supabase) {
    console.error("Groups: Supabase configuration is unavailable.");
    return;
  }

  const db = window.supabase.createClient(
    supabaseUrl,
    supabaseKey
  );

  const state = {
    user: null,
    groups: []
  };

  const elements = {
    searchInput: document.getElementById("groupSearch"),
    groupsList: document.getElementById("groupsList"),
    createButton: document.getElementById("openCreateGroup"),
    modal: document.getElementById("createGroupModal"),
    closeModal: document.getElementById("closeCreateGroup"),
    form: document.getElementById("createGroupForm"),
    nameInput: document.getElementById("groupName"),
    descriptionInput: document.getElementById("groupDescription"),
    error: document.getElementById("groupMessage")
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function openModal() {
    if (!elements.modal) return;

    elements.modal.classList.add("active");
    elements.modal.setAttribute("aria-hidden", "false");

    if (elements.nameInput) {
      setTimeout(() => elements.nameInput.focus(), 50);
    }
  }

  function closeModal() {
    if (!elements.modal) return;

    elements.modal.classList.remove("active");
    elements.modal.setAttribute("aria-hidden", "true");

    if (elements.form) {
      elements.form.reset();
    }

    if (elements.error) {
      elements.error.textContent = "";
    }
  }

  function showError(message) {
    if (elements.error) {
      elements.error.textContent = message;
    }
  }

  function renderGroups(searchTerm = "") {
    if (!elements.groupsList) return;

    const query = searchTerm.trim().toLowerCase();

    const filtered = state.groups.filter((group) => {
      const name = String(group.name || "").toLowerCase();
      const description = String(group.description || "").toLowerCase();

      return !query ||
        name.includes(query) ||
        description.includes(query);
    });

    if (!filtered.length) {
      elements.groupsList.innerHTML = `
        <div class="groups-empty-state">
          <div class="groups-empty-icon">👥</div>
          <h3>${query ? "No groups found" : "No groups yet"}</h3>
          <p>
            ${
              query
                ? "Try a different search."
                : "Create your first ZakiChat group to get started."
            }
          </p>
        </div>
      `;
      return;
    }

    elements.groupsList.innerHTML = filtered.map((group) => {
      const title = escapeHtml(group.name);
      const description = escapeHtml(
        group.description || "ZakiChat group"
      );

      const avatar = group.avatar_url
        ? `<img src="${escapeHtml(group.avatar_url)}" alt="" class="group-card-avatar">`
        : `<div class="group-card-avatar group-card-avatar-fallback">👥</div>`;

      return `
        <article class="group-card" data-group-id="${escapeHtml(group.id)}">
          ${avatar}
          <div class="group-card-content">
            <h3>${title}</h3>
            <p>${description}</p>
          </div>
          <button
            type="button"
            class="group-open-button"
            data-open-group="${escapeHtml(group.id)}"
          >
            Open
          </button>
        </article>
      `;
    }).join("");

    elements.groupsList
      .querySelectorAll("[data-open-group]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          const groupId = button.dataset.openGroup;

          if (groupId) {
            window.location.href =
              `group.html?id=${encodeURIComponent(groupId)}`;
          }
        });
      });
  }

  async function loadGroups() {
    if (!state.user || !elements.groupsList) {
      return;
    }

    elements.groupsList.innerHTML = `
      <div class="groups-loading-state">
        <div class="groups-loading-spinner"></div>
        <p>Loading your groups...</p>
      </div>
    `;

    const { data, error } = await db
      .from("group_members")
      .select(`
        group_id,
        role,
        joined_at,
        groups (
          id,
          name,
          description,
          avatar_url,
          created_by,
          created_at,
          updated_at,
          conversation_id
        )
      `)
      .eq("user_id", state.user.id)
      .order("joined_at", { ascending: false });

    if (error) {
      console.error("Groups load error:", error);

      elements.groupsList.innerHTML = `
        <div class="groups-empty-state">
          <div class="groups-empty-icon">⚠️</div>
          <h3>Unable to load groups</h3>
          <p>Please refresh and try again.</p>
        </div>
      `;

      return;
    }

    state.groups = (data || [])
      .map((membership) => membership.groups)
      .filter(Boolean);

    renderGroups(elements.searchInput?.value || "");
  }

  async function createGroup(event) {
    event.preventDefault();

    if (!state.user) {
      showError("Please sign in before creating a group.");
      return;
    }

    const name = elements.nameInput?.value.trim() || "";
    const description =
      elements.descriptionInput?.value.trim() || null;

    if (name.length < 2 || name.length > 80) {
      showError("Group name must be between 2 and 80 characters.");
      return;
    }

    if (description && description.length > 180) {
      showError("Group description must be 180 characters or less.");
      return;
    }

    const submitButton =
      elements.form?.querySelector('button[type="submit"]');

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Creating...";
    }

    showError("");

    const { data, error } = await db.rpc("create_group", {
      p_name: name,
      p_description: description,
      p_avatar_url: null
    });

    if (error) {
      console.error("Create group error:", error);
      showError(error.message || "Unable to create group.");

      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "Create Group";
      }

      return;
    }

    closeModal();

    if (data) {
      const createdGroup = Array.isArray(data)
        ? data[0]
        : data;

      if (createdGroup) {
        state.groups.unshift(createdGroup);
      }
    }

    renderGroups(elements.searchInput?.value || "");

    if (data) {
      const createdGroup = Array.isArray(data)
        ? data[0]
        : data;

      if (createdGroup?.id) {
        window.location.href =
          `group.html?id=${encodeURIComponent(createdGroup.id)}`;
      }
    }

    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "Create Group";
    }
  }

  async function init() {
    const {
      data: { user },
      error
    } = await db.auth.getUser();

    if (error || !user) {
      window.location.href = "login.html";
      return;
    }

    state.user = user;

    await loadGroups();

    if (elements.searchInput) {
      elements.searchInput.addEventListener("input", () => {
        renderGroups(elements.searchInput.value);
      });
    }

    if (elements.createButton) {
      elements.createButton.addEventListener(
        "click",
        openModal
      );
    }

    if (elements.closeModal) {
      elements.closeModal.addEventListener(
        "click",
        closeModal
      );
    }

    if (elements.modal) {
      elements.modal.addEventListener("click", (event) => {
        if (event.target === elements.modal) {
          closeModal();
        }
      });
    }

    if (elements.form) {
      elements.form.addEventListener(
        "submit",
        createGroup
      );
    }

    const channel = db
      .channel("groups-directory")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "group_members",
          filter: `user_id=eq.${state.user.id}`
        },
        () => loadGroups()
      )
      .subscribe();

    window.addEventListener("beforeunload", () => {
      db.removeChannel(channel);
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
