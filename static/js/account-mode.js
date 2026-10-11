(function () {
  "use strict";

  const MODE_KEY = "account_mode";
  const MODE_LABELS = {
    local: "Local",
    personal_customized: "Customized Personal",
    business_customized: "Customized Business"
  };

  function $(selector) { return document.querySelector(selector); }

  function setMessage(message, state) {
    const el = $("#accountModeMessage");
    if (!el) return;
    el.textContent = message;
    if (state) el.dataset.state = state;
    else delete el.dataset.state;
  }

  function setCardAvailability(mode, available, active, detail) {
    const card = document.querySelector('[data-account-mode="' + mode + '"]');
    if (!card) return;
    card.disabled = !available;
    card.setAttribute("aria-pressed", String(active));
    card.classList.toggle("is-active", active);
    const state = card.querySelector(".account-mode-state");
    if (state) state.textContent = active ? "Currently active" : (available ? "Available to switch" : detail);
  }

  function getPreferredFallback(plans) {
    if (plans.has("business_monthly")) return "business_customized";
    if (plans.has("personal_monthly")) return "personal_customized";
    return "local";
  }

  async function init() {
    const grid = $("#accountModeGrid");
    if (!grid) return;

    const client = window.ZakiChatAuth && window.ZakiChatAuth.client;
    if (!client) {
      setMessage("Your secure session is not ready. Refresh this page and sign in again.", "error");
      return;
    }

    const sessionResult = await client.auth.getSession();
    if (sessionResult.error) throw sessionResult.error;
    const user = sessionResult.data && sessionResult.data.session && sessionResult.data.session.user;
    if (!user) {
      setMessage("Please sign in to manage your ZakiChat account mode.", "error");
      return;
    }

    const now = new Date().toISOString();
    const upgradesResult = await client.from("user_upgrades")
      .select("plan,status,expires_at")
      .eq("user_id", user.id)
      .eq("status", "active")
      .gt("expires_at", now)
      .in("plan", ["personal_monthly", "business_monthly"]);

    if (upgradesResult.error) {
      console.error("ZakiChat account mode subscription check failed:", upgradesResult.error);
      setCardAvailability("local", true, true, "Available");
      setCardAvailability("personal_customized", false, false, "Could not verify subscription");
      setCardAvailability("business_customized", false, false, "Could not verify subscription");
      setMessage("We couldn't verify your subscription status. Local mode remains available; paid modes stay locked until verification succeeds.", "error");
      return;
    }

    const plans = new Set((upgradesResult.data || []).map(row => row.plan));
    const personalAvailable = plans.has("personal_monthly");
    const businessAvailable = plans.has("business_monthly");

    const preferenceResult = await client.from("user_account_preferences")
      .select("account_mode")
      .eq("user_id", user.id)
      .maybeSingle();

    if (preferenceResult.error) {
      console.error("ZakiChat account mode preference could not be loaded:", preferenceResult.error);
      setMessage("Your subscriptions were checked, but saved mode settings couldn't be loaded. Apply migration 050_account_mode_preferences.sql, then refresh.", "error");
      setCardAvailability("local", true, true, "Available");
      setCardAvailability("personal_customized", personalAvailable, false, personalAvailable ? "Available to switch" : "Active plan required");
      setCardAvailability("business_customized", businessAvailable, false, businessAvailable ? "Available to switch" : "Active plan required");
      return;
    }

    let currentMode = preferenceResult.data && preferenceResult.data.account_mode || "local";
    const modeIsAvailable = mode => mode === "local" ||
      (mode === "personal_customized" && personalAvailable) ||
      (mode === "business_customized" && businessAvailable);

    let expiredFallback = false;
    if (!modeIsAvailable(currentMode)) {
      currentMode = "local";
      expiredFallback = true;
      const { error } = await client.from("user_account_preferences").upsert({
        user_id: user.id,
        account_mode: currentMode,
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id" });
      if (error) console.warn("Could not persist Local fallback after an upgrade expired:", error);
    }

    function render() {
      setCardAvailability("local", true, currentMode === "local", "Available");
      setCardAvailability("personal_customized", personalAvailable, currentMode === "personal_customized", personalAvailable ? "Available to switch" : "Active Personal plan required");
      setCardAvailability("business_customized", businessAvailable, currentMode === "business_customized", businessAvailable ? "Available to switch" : "Active Business plan required");
    }

    render();
    if (expiredFallback) {
      setMessage("Your previously selected paid mode is no longer active. You've been switched to Local so you can keep messaging. Renew or upgrade, then select the paid mode again.", "success");
    } else {
      setMessage("Current mode: " + MODE_LABELS[currentMode] + ". Your sign-in and chat history stay the same when you switch modes.", "success");
    }

    grid.addEventListener("click", async event => {
      const card = event.target.closest("[data-account-mode]");
      if (!card || card.disabled) return;
      const nextMode = card.dataset.accountMode;
      if (!modeIsAvailable(nextMode)) return;
      if (nextMode === currentMode) {
        setMessage("You're already using " + MODE_LABELS[currentMode] + ".", "success");
        return;
      }

      grid.querySelectorAll("button").forEach(button => { button.disabled = true; });
      setMessage("Switching to " + MODE_LABELS[nextMode] + "…");
      try {
        const { error } = await client.from("user_account_preferences").upsert({
          user_id: user.id,
          account_mode: nextMode,
          updated_at: new Date().toISOString()
        }, { onConflict: "user_id" });
        if (error) throw error;

        currentMode = nextMode;
        render();
        setMessage("You're now using " + MODE_LABELS[currentMode] + ". Your login and conversations have not changed.", "success");

        if (currentMode === "business_customized") {
          const notice = document.createElement("a");
          notice.href = "business.html";
          notice.className = "account-mode-workspace-link";
          notice.textContent = "Open Business Workspace";
          const footer = $(".account-mode-footer");
          const old = $("#accountModeWorkspaceLink");
          if (old) old.remove();
          notice.id = "accountModeWorkspaceLink";
          footer && footer.appendChild(notice);
        } else {
          $("#accountModeWorkspaceLink")?.remove();
        }
      } catch (error) {
        console.error("ZakiChat account mode switch failed:", error);
        setMessage(error.message || "Couldn't switch modes. Please try again.", "error");
        render();
      }
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    init().catch(error => {
      console.error("ZakiChat account mode setup failed:", error);
      setMessage("Account modes couldn't be loaded. Please refresh and try again.", "error");
    });
  }, { once: true });
})();