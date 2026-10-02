(function () {
  "use strict";

  const list = document.getElementById("starredMessagesList");
  const empty = document.getElementById("starredMessagesEmpty");

  if (!list) return;

  const client = window.ZakiChatAuth?.client;

  function showEmpty() {
    list.innerHTML = "";
    if (empty) empty.hidden = false;
  }

  function hideEmpty() {
    if (empty) empty.hidden = true;
  }

  function renderMessage(item) {
    const message = item?.messages;
    if (!message) return null;

    const card = document.createElement("article");

    card.style.cssText = [
      "padding:15px",
      "border-radius:16px",
      "border:1px solid rgba(255,255,255,.10)",
      "background:rgba(127,127,127,.08)",
      "backdrop-filter:blur(14px)"
    ].join(";");

    const content = document.createElement("div");
    content.textContent = message.content || "(Attachment)";
    content.style.cssText =
      "font-size:15px;line-height:1.5;word-break:break-word;";

    const meta = document.createElement("small");
    meta.textContent = new Date(message.created_at).toLocaleString();
    meta.style.cssText = "display:block;margin-top:8px;opacity:.55;";

    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "★ Unstar";
    remove.style.cssText = [
      "margin-top:10px",
      "border:0",
      "border-radius:10px",
      "padding:8px 12px",
      "background:rgba(127,127,127,.14)",
      "color:inherit",
      "font:inherit",
      "cursor:pointer"
    ].join(";");

    remove.addEventListener("click", async function () {
      if (!client) return;

      remove.disabled = true;

      const { error } = await client
        .from("starred_messages")
        .delete()
        .eq("id", item.id);

      if (error) {
        remove.disabled = false;
        return;
      }

      card.remove();

      if (!list.children.length) {
        showEmpty();
      }
    });

    card.appendChild(content);
    card.appendChild(meta);
    card.appendChild(remove);

    return card;
  }

  async function loadStarredMessages() {
    if (!client) {
      showEmpty();
      return;
    }

    const {
      data: { user }
    } = await client.auth.getUser();

    if (!user) {
      showEmpty();
      return;
    }

    const { data, error } = await client
      .from("starred_messages")
      .select(`
        id,
        created_at,
        messages (
          id,
          content,
          created_at,
          sender_id,
          conversation_id
        )
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error || !data?.length) {
      showEmpty();
      return;
    }

    hideEmpty();
    list.innerHTML = "";

    data.forEach(function (item) {
      const card = renderMessage(item);
      if (card) list.appendChild(card);
    });
  }

  loadStarredMessages();
})();
