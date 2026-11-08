/* ============================================================
   ZAKICHAT CONTACT & SUPPORT COMPOSER
   Sends user messages to public.support_requests
   ============================================================ */

(function () {
  "use strict";

  const form = document.getElementById("supportComposeForm");
  const category = document.getElementById("supportCategory");
  const subject = document.getElementById("supportSubject");
  const message = document.getElementById("supportMessage");
  const counter = document.getElementById("supportCharacterCount");
  const feedback = document.getElementById("supportFeedback");
  const button = document.getElementById("supportSubmitButton");
  const BRIDGE_URL = "https://mmozesoarwkimhyloivu.supabase.co/functions/v1/zakitech-product-bridge";
  const THREAD_KEY = "molan_chat_zakitech_support_thread_v1";

  if (!form || !category || !subject || !message || !button) {
    return;
  }

  function applyReportPrefill() {
    const params = new URLSearchParams(window.location.search);
    const requestedCategory = String(params.get("category") || "").trim();
    const requestedSubject = String(params.get("subject") || "").trim();

    if (
      requestedCategory &&
      [...category.options].some(
        option => option.value === requestedCategory
      )
    ) {
      category.value = requestedCategory;
    }

    if (requestedSubject && !subject.value.trim()) {
      subject.value = requestedSubject;
    }
  }

  function updateCounter() {
    counter.textContent = `${message.value.length} / 5000`;
  }

  function showFeedback(text, type) {
    feedback.hidden = false;
    feedback.textContent = text;
    feedback.className = `support-feedback ${type || ""}`;
  }

  function clearFeedback() {
    feedback.hidden = true;
    feedback.textContent = "";
    feedback.className = "support-feedback";
  }

  function getClient() {
    if (
      window.ZakiChatAuth &&
      window.ZakiChatAuth.client
    ) {
      return window.ZakiChatAuth.client;
    }

    if (window.supabaseClient) {
      return window.supabaseClient;
    }

    if (window.supabase) {
      return window.supabase;
    }

    return null;
  }

  async function getCurrentUser(client) {
    const result = await client.auth.getUser();

    if (result.error) {
      throw result.error;
    }

    if (!result.data || !result.data.user) {
      throw new Error("Please sign in to contact ZakiChat Support.");
    }

    return result.data.user;
  }


  async function bridgeRequest(payload) {
    const client = getClient();
    const sessionResult = client ? await client.auth.getSession() : { data: { session: null } };
    const headers = { "Content-Type": "application/json" };
    if (sessionResult.data?.session?.access_token) headers.Authorization = "Bearer " + sessionResult.data.session.access_token;
    const response = await fetch(BRIDGE_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success === false) throw new Error(data.error || "ZakiTech support connection failed.");
    return data;
  }

  function renderThread(thread) {
    let host = document.getElementById("zakitechSupportThread");
    if (!host) {
      host = document.createElement("section");
      host.id = "zakitechSupportThread";
      host.className = "support-compose-card";
      host.setAttribute("aria-live", "polite");
      form.closest(".support-compose-card")?.after(host);
    }
    host.replaceChildren();
    const heading = document.createElement("h2");
    heading.textContent = "Your ZakiTech support conversation";
    const summary = document.createElement("p");
    summary.textContent = (thread.ticket?.subject || "Support request") + " · " + (thread.ticket?.status || "new");
    host.append(heading, summary);
    (thread.replies || []).forEach(reply => {
      const item = document.createElement("article");
      item.className = "support-thread-message";
      const meta = document.createElement("small");
      meta.textContent = (reply.sender_name || reply.sender_type || "Support") + " · " + new Date(reply.created_at).toLocaleString();
      const body = document.createElement("p");
      body.textContent = reply.body || "";
      item.append(meta, body);
      host.append(item);
    });
    const replyForm = document.createElement("form");
    replyForm.className = "support-thread-reply";
    const input = document.createElement("textarea");
    input.name = "message"; input.required = true; input.maxLength = 10000;
    input.placeholder = "Reply to the ZakiTech support team…";
    const send = document.createElement("button");
    send.type = "submit"; send.textContent = "Send reply";
    replyForm.append(input, send);
    replyForm.addEventListener("submit", async event => {
      event.preventDefault(); send.disabled = true;
      try {
        const saved = JSON.parse(localStorage.getItem(THREAD_KEY) || "{}");
        await bridgeRequest({action:"reply-support-thread",product_slug:"molan-chat",conversation_id:saved.id,conversation_token:saved.token,message:input.value.trim()});
        const refreshed = await bridgeRequest({action:"get-support-thread",product_slug:"molan-chat",conversation_id:saved.id,conversation_token:saved.token});
        renderThread(refreshed);
      } catch (error) { showFeedback(error.message || "Could not send your reply.", "error"); }
      finally { send.disabled = false; }
    });
    host.append(replyForm);
  }

  async function restoreThread() {
    try {
      const saved = JSON.parse(localStorage.getItem(THREAD_KEY) || "{}");
      if (!saved.id || !saved.token) return;
      const thread = await bridgeRequest({action:"get-support-thread",product_slug:"molan-chat",conversation_id:saved.id,conversation_token:saved.token});
      renderThread(thread);
    } catch (error) { console.warn("Could not restore ZakiTech support thread:", error.message); }
  }

  message.addEventListener("input", updateCounter);

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    clearFeedback();

    const selectedCategory = category.value;
    const cleanSubject = subject.value.trim();
    const cleanMessage = message.value.trim();

    if (cleanSubject.length < 2) {
      showFeedback("Please enter a subject.", "error");
      subject.focus();
      return;
    }

    if (cleanMessage.length < 5) {
      showFeedback("Please enter a little more detail in your message.", "error");
      message.focus();
      return;
    }

    if (cleanMessage.length > 5000) {
      showFeedback("Your message is too long.", "error");
      return;
    }

    const client = getClient();

    if (!client) {
      showFeedback(
        "ZakiChat security services are not ready. Please refresh the page and try again.",
        "error"
      );
      return;
    }

    button.disabled = true;
    button.querySelector("span:last-child").textContent = "Sending...";

    try {
      const user = await getCurrentUser(client);

      const { error } = await client
        .from("support_requests")
        .insert({
          user_id: user.id,
          category: selectedCategory,
          subject: cleanSubject,
          message: cleanMessage
        });

      if (error) {
        throw error;
      }

      let centralMessage = "Your message was saved in the Molan Chat support inbox.";
      try {
        const bridge = await bridgeRequest({
          action: "submit-support",
          product_slug: "molan-chat",
          sender_name: user.user_metadata?.display_name || user.user_metadata?.full_name || user.email?.split("@")[0] || "Molan Chat customer",
          sender_email: user.email || "",
          subject: cleanSubject,
          message: cleanMessage,
          category: selectedCategory
        });
        localStorage.setItem(THREAD_KEY, JSON.stringify({id:bridge.conversation_id,token:bridge.conversation_token}));
        const thread = await bridgeRequest({action:"get-support-thread",product_slug:"molan-chat",conversation_id:bridge.conversation_id,conversation_token:bridge.conversation_token});
        renderThread(thread);
        centralMessage = "Your message has also reached the ZakiTech Molan Chat Control Station. You can follow staff replies below.";
      } catch (bridgeError) {
        console.error("ZakiTech support bridge failed:", bridgeError);
        centralMessage += " The ZakiTech copy could not be confirmed, so the local Molan Chat team still has your request.";
      }

      showFeedback(centralMessage, "success");

      form.reset();
      updateCounter();

    } catch (error) {
      console.error("Support request failed:", error);

      showFeedback(
        error && error.message
          ? error.message
          : "We could not send your support request. Please try again.",
        "error"
      );
    } finally {
      button.disabled = false;
      button.querySelector("span:last-child").textContent = "Send to Support";
    }
  });

  applyReportPrefill();
  updateCounter();
  restoreThread();
})();
