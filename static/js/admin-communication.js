(() => {
  "use strict";

  const SUPABASE_URL = "https://xdpevlurgtvgduwzyoue.supabase.co";
  const SUPABASE_KEY = "sb_publishable_aMRHrU5gtNmpsytQNaz61w_Yc-yh_Pk";
  const TOKEN_KEY = "zakichat-admin-session";

  const $ = id => document.getElementById(id);

  const token = () => localStorage.getItem(TOKEN_KEY);

  async function rpc(name, params = {}) {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/${name}`,
      {
        method: "POST",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(params)
      }
    );

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        data?.message ||
        data?.hint ||
        data?.error ||
        "Protected administrator request failed."
      );
    }

    return data;
  }

  function formatDate(value) {
    if (!value) return "—";

    const d = new Date(value);

    if (Number.isNaN(d.getTime())) {
      return "—";
    }

    return d.toLocaleString();
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function verifySession() {
    const t = token();

    if (!t) {
      return false;
    }

    try {
      return await rpc(
        "admin_communication_session_valid",
        {
          p_token: t
        }
      ) === true;

    } catch (error) {
      console.error(
        "Communication admin session verification failed:",
        error
      );

      return false;
    }
  }

  async function loadOverview() {
    const data = await rpc(
      "admin_communication_overview",
      {
        p_token: token()
      }
    );

    $("totalConversations").textContent =
      data.total_conversations ?? 0;

    $("totalMessages").textContent =
      data.total_messages ?? 0;

    $("todayMessages").textContent =
      data.today_messages ?? 0;

    $("activeUsers").textContent =
      data.active_users_24h ?? 0;

    $("directConversations").textContent =
      data.direct_conversations ?? 0;

    $("groupConversations").textContent =
      data.group_conversations ?? 0;

    $("editedMessages").textContent =
      data.edited_messages ?? 0;

    $("deletedMessages").textContent =
      data.deleted_messages ?? 0;

    $("attachments").textContent =
      data.attachments ?? 0;
  }

  async function loadConversations() {
    const data = await rpc(
      "admin_list_conversations",
      {
        p_token: token(),
        p_search: $("searchInput").value.trim(),
        p_type: $("typeFilter").value
      }
    );

    const list = $("conversationList");

    list.innerHTML = "";

    const rows = Array.isArray(data) ? data : [];

    $("conversationCount").textContent =
      `${rows.length} records`;

    $("conversationEmpty").classList.toggle(
      "hidden",
      rows.length !== 0
    );

    rows.forEach(row => {
      const item = document.createElement("article");

      item.className = "conversation";

      const title =
        row.title ||
        (
          row.type === "direct"
            ? "Direct conversation"
            : "Untitled group"
        );

      item.innerHTML = `
        <span class="type-badge">
          ${escapeHtml(row.type || "unknown")}
        </span>

        <div>
          <strong>
            ${escapeHtml(title)}
          </strong>

          <small>
            ID: ${escapeHtml(row.id)}
          </small>
        </div>

        <div>
          <strong>
            ${row.participant_count ?? 0}
          </strong>

          <small>
            Participants
          </small>
        </div>

        <div>
          <strong>
            ${row.message_count ?? 0}
          </strong>

          <small>
            Messages
          </small>
        </div>

        <button
          class="open-btn"
          data-id="${escapeHtml(row.id)}"
        >
          Inspect
        </button>
      `;

      item
        .querySelector(".open-btn")
        .addEventListener(
          "click",
          () => openConversation(row.id)
        );

      list.appendChild(item);
    });
  }

  async function openConversation(id) {
    $("detailsPanel").classList.remove("hidden");

    $("detailsTitle").textContent =
      "Loading conversation…";

    $("detailsMeta").textContent = id;

    $("detailsStats").innerHTML = "";

    $("participantList").innerHTML = "";

    $("messageList").innerHTML = "";

    try {
      const [details, messages] = await Promise.all([
        rpc(
          "admin_conversation_details",
          {
            p_token: token(),
            p_conversation_id: id
          }
        ),

        rpc(
          "admin_list_messages",
          {
            p_token: token(),
            p_conversation_id: id,
            p_limit: 50
          }
        )
      ]);

      const conversation =
        details?.conversation || {};

      const stats =
        details?.statistics || {};

      const participants =
        Array.isArray(details?.participants)
          ? details.participants
          : [];

      $("detailsTitle").textContent =
        conversation.title ||
        (
          conversation.type === "direct"
            ? "Direct conversation"
            : "Conversation"
        );

      $("detailsMeta").textContent =
        `${conversation.type || "unknown"} • ` +
        `Created ${formatDate(conversation.created_at)} • ` +
        `${conversation.id || id}`;

      const statItems = [
        ["Messages", stats.message_count],
        ["Deleted", stats.deleted_message_count],
        ["Edited", stats.edited_message_count],
        ["Attachments", stats.attachment_count],
        ["Locations", stats.location_count]
      ];

      $("detailsStats").innerHTML =
        statItems
          .map(
            ([label, value]) => `
              <div class="detail">
                <span>${label}</span>
                <strong>${value ?? 0}</strong>
              </div>
            `
          )
          .join("");

      $("participantList").innerHTML =
        participants.length
          ? participants
              .map(
                p => `
                  <div class="participant">
                    <strong>
                      ${escapeHtml(
                        p.email || p.user_id
                      )}
                    </strong>

                    <small>
                      Joined
                      ${escapeHtml(
                        formatDate(p.joined_at)
                      )}
                    </small>
                  </div>
                `
              )
              .join("")
          : `
              <div class="empty">
                No participants found.
              </div>
            `;

      const rows =
        Array.isArray(messages)
          ? messages
          : [];

      $("messageList").innerHTML =
        rows.length
          ? rows
              .map(m => {
                const tags = [];

                if (m.edited_at) {
                  tags.push("edited");
                }

                if (m.deleted_at) {
                  tags.push("deleted");
                }

                if (m.attachment_name) {
                  tags.push("attachment");
                }

                if (m.location_label) {
                  tags.push("location");
                }

                if (m.reply_to_message_id) {
                  tags.push("reply");
                }

                if (m.forwarded_from_message_id) {
                  tags.push("forwarded");
                }

                return `
                  <article class="message">

                    <div class="message-head">
                      <span>
                        ${escapeHtml(
                          m.sender_email ||
                          m.sender_id ||
                          "Unknown sender"
                        )}
                      </span>

                      <span>
                        ${escapeHtml(
                          formatDate(m.created_at)
                        )}
                      </span>
                    </div>

                    <div class="message-content">
                      ${escapeHtml(
                        m.content ||
                        (
                          m.message_type
                            ? `[${m.message_type}]`
                            : "[No text content]"
                        )
                      )}
                    </div>

                    ${
                      tags.length
                        ? `
                          <div class="message-tags">
                            ${tags
                              .map(
                                tag => `
                                  <span class="tag">
                                    ${escapeHtml(tag)}
                                  </span>
                                `
                              )
                              .join("")}
                          </div>
                        `
                        : ""
                    }

                  </article>
                `;
              })
              .join("")
          : `
              <div class="empty">
                No messages found.
              </div>
            `;

      $("detailsPanel").scrollIntoView({
        behavior: "smooth",
        block: "start"
      });

    } catch (error) {
      $("detailsTitle").textContent =
        "Unable to inspect conversation";

      $("detailsMeta").textContent =
        error.message;
    }
  }

  async function loadAll() {
    await loadOverview();
    await loadConversations();
  }

  async function signOut() {
    localStorage.removeItem(
      TOKEN_KEY
    );

    localStorage.removeItem(
      "zakichat-admin-role"
    );

    localStorage.removeItem(
      "zakichat-admin-expiry"
    );

    window.location.href =
      "admin.html";
  }

  function showError(error) {
    console.error(
      "Communication center error:",
      error
    );

    $("conversationEmpty").textContent =
      error?.message ||
      "Unable to load communication data.";

    $("conversationEmpty")
      .classList
      .remove("hidden");
  }

  async function init() {
    $("refreshBtn")
      .addEventListener(
        "click",
        () => location.reload()
      );

    $("signOutBtn")
      .addEventListener(
        "click",
        signOut
      );

    $("searchBtn")
      .addEventListener(
        "click",
        () => loadConversations()
          .catch(showError)
      );

    $("searchInput")
      .addEventListener(
        "keydown",
        event => {
          if (event.key === "Enter") {
            loadConversations()
              .catch(showError);
          }
        }
      );

    $("typeFilter")
      .addEventListener(
        "change",
        () => loadConversations()
          .catch(showError)
      );

    $("closeDetails")
      .addEventListener(
        "click",
        () => {
          $("detailsPanel")
            .classList
            .add("hidden");
        }
      );

    if (!(await verifySession())) {
      $("loadingState")
        .classList
        .add("hidden");

      $("deniedState")
        .classList
        .remove("hidden");

      return;
    }

    $("loadingState")
      .classList
      .add("hidden");

    $("adminContent")
      .classList
      .remove("hidden");

    try {
      await loadAll();

    } catch (error) {
      showError(error);
    }
  }

  document.addEventListener(
    "DOMContentLoaded",
    init
  );

})();
