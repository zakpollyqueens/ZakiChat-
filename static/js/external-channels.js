(function () {
  "use strict";

  const STORAGE_KEY = "zakichat.externalChannels.v1";
  const PLATFORM_LABELS = {
    telegram: "Telegram",
    whatsapp: "WhatsApp",
    imo: "imo",
    web: "External web"
  };
  let selectedPlatform = "all";

  const byId = id => document.getElementById(id);
  const safeUrl = value => {
    try {
      const url = new URL(String(value || "").trim());
      if (url.protocol !== "https:" && url.protocol !== "http:") return null;
      if (url.username || url.password) return null;
      return url;
    } catch (_) {
      return null;
    }
  };
  const escapeHtml = value => String(value || "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
  const detectPlatform = url => {
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (host === "t.me" || host.endsWith(".telegram.me") || host === "telegram.me") return "telegram";
    if (host === "whatsapp.com" || host.endsWith(".whatsapp.com") || host === "wa.me") return "whatsapp";
    if (host === "imo.im" || host.endsWith(".imo.im")) return "imo";
    return "web";
  };
  const loadSaved = () => {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(value) ? value.filter(item => item && safeUrl(item.url)) : [];
    } catch (_) { return []; }
  };
  const saveAll = items => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      return true;
    } catch (_) {
      showMessage("Your browser could not save this link. Check available device storage.", true);
      return false;
    }
  };
  const showMessage = (message, isError) => {
    const el = byId("external-channel-message");
    if (!el) return;
    el.textContent = message;
    el.classList.toggle("error", Boolean(isError));
    el.classList.toggle("success", !isError);
    el.hidden = false;
  };
  const renderSaved = () => {
    const list = byId("external-saved-channels");
    const empty = byId("external-saved-empty");
    if (!list || !empty) return;
    const saved = loadSaved();
    empty.hidden = saved.length > 0;
    list.innerHTML = saved.map(item => {
      const url = safeUrl(item.url);
      if (!url) return "";
      const platform = PLATFORM_LABELS[item.platform] || "External web";
      const name = item.name || url.hostname;
      return `<article class="channel-card external-channel-card">
        <div class="channel-avatar" aria-hidden="true">${item.platform === "telegram" ? "✈" : item.platform === "whatsapp" ? "◉" : item.platform === "imo" ? "i" : "↗"}</div>
        <div class="channel-card-main">
          <div class="channel-card-name"><strong>${escapeHtml(name)}</strong></div>
          <span class="channel-card-handle">${escapeHtml(url.hostname + url.pathname)}</span>
          <span class="external-channel-platform">${escapeHtml(platform)} · External channel</span>
        </div>
        <div class="external-channel-actions">
          <a class="channels-secondary-button" href="${escapeHtml(url.href)}" target="_blank" rel="noopener noreferrer">Open channel ↗</a>
          <button type="button" class="channels-secondary-button" data-remove-external="${escapeHtml(item.id)}">Remove</button>
        </div>
      </article>`;
    }).join("");
    list.querySelectorAll("[data-remove-external]").forEach(button => {
      button.addEventListener("click", () => {
        const next = loadSaved().filter(item => item.id !== button.dataset.removeExternal);
        if (saveAll(next)) renderSaved();
      });
    });
  };
  const search = () => {
    const input = byId("external-channel-query");
    const query = String(input?.value || "").trim();
    if (!query) {
      input?.focus();
      showMessage("Enter a topic or channel name to search.", true);
      return;
    }
    const siteFilters = {
      telegram: "site:t.me",
      whatsapp: "(site:whatsapp.com/channel OR site:whatsapp.com)",
      imo: "site:imo.im",
      all: "(site:t.me OR site:whatsapp.com/channel OR site:imo.im)"
    };
    const searchQuery = [siteFilters[selectedPlatform] || siteFilters.all, query, "public channel"].join(" ");
    const url = "https://www.google.com/search?q=" + encodeURIComponent(searchQuery);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  document.addEventListener("DOMContentLoaded", () => {
    if (!byId("external-channel-save-form")) return;
    document.querySelectorAll("[data-external-platform]").forEach(button => {
      button.addEventListener("click", () => {
        selectedPlatform = button.dataset.externalPlatform || "all";
        document.querySelectorAll("[data-external-platform]").forEach(other => {
          const active = other === button;
          other.classList.toggle("is-selected", active);
          other.setAttribute("aria-pressed", String(active));
        });
      });
    });
    byId("external-channel-search-button")?.addEventListener("click", search);
    byId("external-channel-query")?.addEventListener("keydown", event => {
      if (event.key === "Enter") { event.preventDefault(); search(); }
    });
    byId("external-channel-save-form")?.addEventListener("submit", event => {
      event.preventDefault();
      const url = safeUrl(byId("external-channel-url")?.value);
      if (!url) {
        showMessage("Enter a valid public channel link beginning with https://.", true);
        return;
      }
      const saved = loadSaved();
      if (saved.some(item => safeUrl(item.url)?.href === url.href)) {
        showMessage("That channel link is already saved.", true);
        return;
      }
      const platform = detectPlatform(url);
      const name = String(byId("external-channel-name")?.value || "").trim().slice(0, 100);
      saved.unshift({
        id: (window.crypto?.randomUUID && window.crypto.randomUUID()) || (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)),
        name,
        url: url.href,
        platform,
        savedAt: new Date().toISOString()
      });
      if (saveAll(saved)) {
        byId("external-channel-save-form").reset();
        showMessage("Channel link saved to My external channels on this device.", false);
        renderSaved();
      }
    });
    renderSaved();
  });
})();