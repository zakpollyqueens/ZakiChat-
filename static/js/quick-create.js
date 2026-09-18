document.addEventListener("DOMContentLoaded", () => {
  const button = document.getElementById("quick-create-button");
  const menu = document.getElementById("quick-create-menu");

  if (!button || !menu) return;

  function closeMenu() {
    menu.hidden = true;
    button.setAttribute("aria-expanded", "false");
  }

  function toggleMenu() {
    const open = menu.hidden;
    menu.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
  }

  button.addEventListener("click", event => {
    event.stopPropagation();
    toggleMenu();
  });

  menu.addEventListener("click", event => {
    event.stopPropagation();
  });

  document.addEventListener("click", closeMenu);

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      closeMenu();
      button.focus();
    }
  });
});
