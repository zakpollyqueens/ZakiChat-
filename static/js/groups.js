document.addEventListener("DOMContentLoaded", () => {
  const openCreateGroup = document.getElementById("openCreateGroup");
  const closeCreateGroup = document.getElementById("closeCreateGroup");
  const modal = document.getElementById("createGroupModal");
  const form = document.getElementById("createGroupForm");
  const groupName = document.getElementById("groupName");
  const groupDescription = document.getElementById("groupDescription");
  const groupMessage = document.getElementById("groupMessage");
  const groupSearch = document.getElementById("groupSearch");
  const groupsList = document.getElementById("groupsList");
  const emptyGroups = document.getElementById("emptyGroups");

  function openModal() {
    if (!modal) return;

    modal.setAttribute("aria-hidden", "false");
    modal.classList.add("show");

    setTimeout(() => {
      groupName?.focus();
    }, 100);
  }

  function closeModal() {
    if (!modal) return;

    modal.setAttribute("aria-hidden", "true");
    modal.classList.remove("show");

    if (groupMessage) {
      groupMessage.textContent = "";
    }

    form?.reset();
  }

  openCreateGroup?.addEventListener("click", openModal);

  closeCreateGroup?.addEventListener("click", closeModal);

  modal?.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      modal?.classList.contains("show")
    ) {
      closeModal();
    }
  });

  groupSearch?.addEventListener("input", () => {
    const query = groupSearch.value.trim().toLowerCase();
    const cards = groupsList?.querySelectorAll(".group-card") || [];

    let visibleCount = 0;

    cards.forEach((card) => {
      const text = card.textContent.toLowerCase();
      const matches = text.includes(query);

      card.hidden = !matches;

      if (matches) {
        visibleCount++;
      }
    });

    if (emptyGroups) {
      emptyGroups.hidden = visibleCount !== 0;
    }
  });

  form?.addEventListener("submit", (event) => {
    event.preventDefault();

    const name = groupName?.value.trim() || "";
    const description = groupDescription?.value.trim() || "";

    if (name.length < 2) {
      if (groupMessage) {
        groupMessage.textContent =
          "Please enter a valid group name.";
      }

      groupName?.focus();
      return;
    }

    if (groupMessage) {
      groupMessage.textContent =
        `"${name}" is ready to be connected to the database.`;
    }

    const initials = name
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase())
      .join("");

    const card = document.createElement("article");
    card.className = "group-card";

    const avatar = document.createElement("div");
    avatar.className = "group-avatar gradient-avatar";
    avatar.textContent = initials || "GC";

    const info = document.createElement("div");
    info.className = "group-info";

    const title = document.createElement("strong");
    title.textContent = name;

    const descriptionText = document.createElement("span");
    descriptionText.textContent =
      description || "A new ZakiChat community.";

    const members = document.createElement("small");
    members.textContent = "1 member";

    info.appendChild(title);
    info.appendChild(descriptionText);
    info.appendChild(members);

    const action = document.createElement("button");
    action.className = "group-action primary";
    action.type = "button";
    action.textContent = "Open";

    card.appendChild(avatar);
    card.appendChild(info);
    card.appendChild(action);

    groupsList?.prepend(card);

    setTimeout(() => {
      closeModal();
    }, 700);
  });

  groupsList?.addEventListener("click", (event) => {
    const button = event.target.closest(".group-action");

    if (!button) return;

    const card = button.closest(".group-card");

    const name = card
      ?.querySelector(".group-info strong")
      ?.textContent
      ?.trim();

    if (!name) return;

    window.location.href =
      `group.html?name=${encodeURIComponent(name)}`;
  });
});
