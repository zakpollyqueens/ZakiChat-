(function () {
  "use strict";

  function init() {
    const header = document.querySelector(".chat-header");
    const userButton = document.getElementById("chat-user-button");
    const avatar = document.getElementById("chat-user-avatar");
    const details = document.querySelector(".chat-user-details");
    if (!header || !userButton || !avatar) return;

    userButton.setAttribute("role", "group");
    userButton.removeAttribute("tabindex");

    let viewer = document.getElementById("zaki-avatar-viewer");
    if (!viewer) {
      viewer = document.createElement("div");
      viewer.id = "zaki-avatar-viewer";
      viewer.className = "zaki-avatar-viewer";
      viewer.hidden = true;
      viewer.innerHTML = `
        <button type="button" class="zaki-avatar-viewer-close" aria-label="Close photo">×</button>
        <div class="zaki-avatar-viewer-content">
          <div class="zaki-avatar-viewer-image" role="img" aria-label="Contact profile photo"></div>
          <strong class="zaki-avatar-viewer-name"></strong>
          <button type="button" class="zaki-avatar-viewer-profile">View profile</button>
        </div>`;
      document.body.appendChild(viewer);
    }

    const userId = () => new URLSearchParams(location.search).get("user") || "";
    const nameText = () => details?.querySelector("strong")?.textContent?.trim() || "ZakiChat User";
    const imageUrl = () => {
      const match = getComputedStyle(avatar).backgroundImage.match(/^url\(["']?(.*?)["']?\)$/);
      return match?.[1] && match[1] !== "none" ? match[1] : "";
    };
    const openProfile = () => {
      const id = userId();
      if (id) location.href = "profile.html?user=" + encodeURIComponent(id);
    };
    const closeViewer = () => {
      viewer.hidden = true;
      document.body.classList.remove("zaki-avatar-viewer-open");
    };
    const openViewer = () => {
      const image = viewer.querySelector(".zaki-avatar-viewer-image");
      const url = imageUrl();
      if (!url) {
        openProfile();
        return;
      }
      image.style.backgroundImage = 'url("' + url.replace(/"/g, "%22") + '")';
      viewer.querySelector(".zaki-avatar-viewer-name").textContent = nameText();
      viewer.hidden = false;
      document.body.classList.add("zaki-avatar-viewer-open");
    };

    avatar.setAttribute("role", "button");
    avatar.setAttribute("tabindex", "0");
    avatar.setAttribute("aria-label", "View profile photo");
    avatar.addEventListener("click", event => {
      event.stopPropagation();
      openViewer();
    });
    avatar.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openViewer();
      }
    });

    details?.addEventListener("click", openProfile);
    details?.setAttribute("role", "link");
    details?.setAttribute("tabindex", "0");
    details?.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openProfile();
      }
    });

    viewer.querySelector(".zaki-avatar-viewer-close")?.addEventListener("click", closeViewer);
    viewer.querySelector(".zaki-avatar-viewer-profile")?.addEventListener("click", openProfile);
    viewer.addEventListener("click", event => {
      if (event.target === viewer) closeViewer();
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && !viewer.hidden) closeViewer();
    });

    // Keep touch targets predictable and expose menu state to assistive technology.
    document.querySelectorAll(".chat-header-actions button, .chat-back, .message-composer button").forEach(button => {
      if (!button.hasAttribute("type")) button.type = "button";
      button.addEventListener("pointerdown", () => button.classList.add("is-pressed"));
      ["pointerup", "pointercancel", "pointerleave"].forEach(name => button.addEventListener(name, () => button.classList.remove("is-pressed")));
    });

    const moreButton = document.getElementById("chat-more-button");
    const moreMenu = document.getElementById("chat-more-menu");
    if (moreButton && moreMenu) {
      moreButton.setAttribute("aria-haspopup", "menu");
      moreMenu.querySelectorAll("[data-chat-action]").forEach(item => item.setAttribute("role", "menuitem"));
      document.addEventListener("click", event => {
        if (!event.target.closest("#chat-more-wrapper") && !moreMenu.hidden) {
          moreMenu.hidden = true;
          moreButton.setAttribute("aria-expanded", "false");
        }
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();