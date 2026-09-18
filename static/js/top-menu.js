document.addEventListener("DOMContentLoaded", () => {
  const button = document.getElementById("top-more-button");
  const menu = document.getElementById("top-more-menu");
  const wrapper = document.getElementById("top-more-wrapper");
  const searchButton = document.getElementById("top-search-button");
  const menuSearch = document.getElementById("menu-search");

  if (!button || !menu || !wrapper) return;

  const searchInput = document.querySelector(".search-box input");

  function closeMenu() {
    menu.hidden = true;
    button.setAttribute("aria-expanded", "false");
  }

  function openMenu() {
    menu.hidden = false;
    button.setAttribute("aria-expanded", "true");
  }

  function toggleMenu(event) {
    event.stopPropagation();

    if (menu.hidden) {
      openMenu();
    } else {
      closeMenu();
    }
  }

  function focusSearch() {
    closeMenu();

    if (searchInput) {
      searchInput.focus();
      searchInput.select();
    }
  }

  button.addEventListener("click", toggleMenu);

  searchButton?.addEventListener("click", focusSearch);
  menuSearch?.addEventListener("click", focusSearch);

  menu.addEventListener("click", event => {
    event.stopPropagation();
  });

  document.addEventListener("click", event => {
    if (!wrapper.contains(event.target)) {
      closeMenu();
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      closeMenu();
      button.focus();
    }
  });
});
