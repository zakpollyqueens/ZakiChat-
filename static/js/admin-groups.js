"use strict";

const FUNCTION_URL =
  "https://xdpevlurgtvgduwzyoue.supabase.co/functions/v1/two-step";

const SESSION_KEY = "zakichat-admin-session";
const ROLE_KEY = "zakichat-admin-role";
const EXPIRY_KEY = "zakichat-admin-expiry";

const $ = id => document.getElementById(id);

function show(id, visible = true) {
  const el = $(id);
  if (el) el.classList.toggle("hidden", !visible);
}

function getToken() {
  return localStorage.getItem(SESSION_KEY);
}

function clearAdminSession() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(EXPIRY_KEY);
}

async function verifyAdminSession() {
  const token = getToken();

  if (!token) return false;

  const expiry = Number(
    localStorage.getItem(EXPIRY_KEY) || 0
  );

  if (expiry && Date.now() >= expiry) {
    clearAdminSession();
    return false;
  }

  try {
    const response = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        action: "admin-session-verify"
      })
    });

    if (!response.ok) {
      clearAdminSession();
      return false;
    }

    const data = await response.json();

    if (!data?.valid) {
      clearAdminSession();
      return false;
    }

    if (data.expires_at) {
      localStorage.setItem(
        EXPIRY_KEY,
        String(new Date(data.expires_at).getTime())
      );
    }

    return true;
  } catch (error) {
    console.error(
      "Admin session verification failed:",
      error
    );
    return false;
  }
}

async function secureSignOut() {
  const token = getToken();

  try {
    if (token) {
      await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          action: "admin-session-revoke"
        })
      });
    }
  } catch (error) {
    console.warn(
      "Remote admin sign-out failed:",
      error
    );
  }

  clearAdminSession();
  location.href = "admin.html";
}

function setupTabs() {
  document.querySelectorAll(".tab").forEach(button => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(tab => {
        tab.classList.remove("active");
      });

      button.classList.add("active");

      const mode = button.dataset.tab;

      const search = $("searchInput");

      if (search) {
        search.placeholder =
          mode === "groups"
            ? "Search groups..."
            : "Search channels...";
      }

      renderProtectedState(mode);
    });
  });
}

function renderProtectedState(mode = "groups") {
  const list = $("directoryList");

  if (!list) return;

  const label =
    mode === "groups"
      ? "Groups"
      : "Channels";

  list.innerHTML = `
    <article class="empty-card">
      <div class="empty-icon">${mode === "groups" ? "👥" : "📢"}</div>
      <strong>${label} administration backend</strong>
      <p>
        Protected ${label.toLowerCase()} records will appear here
        after the privileged administration service is connected.
      </p>
    </article>
  `;
}

function setupSearch() {
  $("searchInput")?.addEventListener(
    "input",
    event => {
      const value = event.target.value.trim();

      if (!value) {
        const active =
          document.querySelector(".tab.active")
            ?.dataset.tab || "groups";

        renderProtectedState(active);
      }
    }
  );
}

function setupEvents() {
  $("refreshBtn")?.addEventListener(
    "click",
    () => location.reload()
  );

  $("signOutBtn")?.addEventListener(
    "click",
    secureSignOut
  );

  setupTabs();
  setupSearch();
}

async function init() {
  setupEvents();

  const valid =
    await verifyAdminSession();

  show("loadingState", false);

  if (!valid) {
    show("deniedState", true);
    show("adminContent", false);
    return;
  }

  show("deniedState", false);
  show("adminContent", true);

  renderProtectedState("groups");
}

document.addEventListener(
  "DOMContentLoaded",
  init
);
