(function () {
  "use strict";

  const STORAGE_KEY = "zakichat_chat_folders";

  const foldersList = document.getElementById("foldersList");
  const createFolderButton = document.getElementById("createFolderButton");
  const folderDialog = document.getElementById("folderDialog");
  const folderName = document.getElementById("folderName");
  const saveFolderButton = document.getElementById("saveFolderButton");
  const cancelFolderButton = document.getElementById("cancelFolderButton");

  function loadFolders() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : [];

      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveFolders(folders) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(folders));
  }

  function renderFolders() {
    const folders = loadFolders();

    foldersList.innerHTML = "";

    if (!folders.length) {
      const empty = document.createElement("div");
      empty.className = "empty-folders";
      empty.textContent = "No custom folders yet.";
      foldersList.appendChild(empty);
      return;
    }

    folders.forEach((folder) => {
      const item = document.createElement("div");
      item.className = "folder-item";

      const info = document.createElement("div");
      info.className = "folder-info";

      const symbol = document.createElement("span");
      symbol.className = "folder-symbol";
      symbol.textContent = "📁";

      const copy = document.createElement("div");

      const name = document.createElement("div");
      name.className = "folder-name";
      name.textContent = folder.name;

      const meta = document.createElement("div");
      meta.className = "folder-meta";
      meta.textContent = "Custom chat folder";

      copy.appendChild(name);
      copy.appendChild(meta);

      info.appendChild(symbol);
      info.appendChild(copy);

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "delete-folder-button";
      deleteButton.textContent = "✕";
      deleteButton.setAttribute("aria-label", "Delete " + folder.name);

      deleteButton.addEventListener("click", function () {
        deleteFolder(folder.id);
      });

      item.appendChild(info);
      item.appendChild(deleteButton);

      foldersList.appendChild(item);
    });
  }

  function openDialog() {
    folderDialog.hidden = false;
    folderName.value = "";
    setTimeout(() => folderName.focus(), 0);
  }

  function closeDialog() {
    folderDialog.hidden = true;
  }

  function createFolder() {
    const name = folderName.value.trim();

    if (!name) {
      folderName.focus();
      return;
    }

    const folders = loadFolders();

    const duplicate = folders.some(
      (folder) => folder.name.toLowerCase() === name.toLowerCase()
    );

    if (duplicate) {
      alert("A folder with that name already exists.");
      return;
    }

    folders.push({
      id: Date.now().toString(),
      name: name
    });

    saveFolders(folders);
    renderFolders();
    closeDialog();
  }

  function deleteFolder(id) {
    const folders = loadFolders();
    const updated = folders.filter((folder) => folder.id !== id);

    saveFolders(updated);
    renderFolders();
  }

  createFolderButton?.addEventListener("click", openDialog);
  saveFolderButton?.addEventListener("click", createFolder);
  cancelFolderButton?.addEventListener("click", closeDialog);

  folderDialog?.addEventListener("click", function (event) {
    if (event.target.hasAttribute("data-close-dialog")) {
      closeDialog();
    }
  });

  folderName?.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      event.preventDefault();
      createFolder();
    }

    if (event.key === "Escape") {
      closeDialog();
    }
  });

  renderFolders();
})();
