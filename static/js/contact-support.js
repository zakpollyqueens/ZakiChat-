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

  if (!form || !category || !subject || !message || !button) {
    return;
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

      showFeedback(
        "Your message has been sent successfully. The support team can now view it in the Admin Control Center.",
        "success"
      );

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

  updateCounter();
})();
