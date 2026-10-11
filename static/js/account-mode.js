(function () {
  "use strict";
  const MODE_LABELS = { local: "Local", personal_customized: "Customized Personal", business_customized: "Customized Business" };
  const $ = selector => document.querySelector(selector);
  function setMessage(message, state) {
    const el = $("#accountModeMessage");
    if (!el) return;
    el.textContent = message;
    if (state) el.dataset.state = state;
    else delete el.dataset.state;
  }
  function setCard(mode, available, active, detail) {
    const card = document.querySelector('[data-account-mode="' + mode + '"]');
    if (!card) return;
    card.disabled = !available;
    card.setAttribute("aria-pressed", String(active));
    card.classList.toggle("is-active", active);
    const state = card.querySelector(".account-mode-state");
    if (state) state.textContent = active ? "Currently active" : (available ? "Available to switch" : detail);
  }
  function available(mode, plans) {
    return mode === "local" || (mode === "personal_customized" && plans.has("personal_monthly")) ||
      (mode === "business_customized" && plans.has("business_monthly"));
  }
  async function init() {
    if (!$("#accountModeGrid")) return;
    const client = window.ZakiChatAuth?.client;
    if (!client) { setMessage("Your secure session is not ready. Refresh this page and sign in again.", "error"); return; }
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError) throw sessionError;
    const user = sessionData?.session?.user;
    if (!user) { setMessage("Please sign in to manage your ZakiChat account mode.", "error"); return; }

    const { data: upgrades, error: upgradesError } = await client.from("user_upgrades")
      .select("plan,status,expires_at").eq("user_id", user.id).eq("status", "active")
      .gt("expires_at", new Date().toISOString())
      .lte("starts_at", new Date().toISOString()).in("plan", ["personal_monthly", "business_monthly"]);
    if (upgradesError) {
      console.error("ZakiChat account mode subscription check failed:", upgradesError);
      setCard("local", true, true, "Available");
      setCard("personal_customized", false, false, "Could not verify subscription");
      setCard("business_customized", false, false, "Could not verify subscription");
      setMessage("We couldn't verify your subscription. Local mode remains available; paid modes stay locked until verification succeeds.", "error");
      return;
    }
    const plans = new Set((upgrades || []).map(row => row.plan));
    const { data: preference, error: preferenceError } = await client.from("user_account_preferences")
      .select("account_mode").eq("user_id", user.id).maybeSingle();
    if (preferenceError) {
      console.error("ZakiChat account mode preference could not be loaded:", preferenceError);
      setMessage("The account-mode database setup is missing. Apply migration 050_account_mode_preferences.sql, then refresh.", "error");
      setCard("local", true, true, "Available");
      setCard("personal_customized", plans.has("personal_monthly"), false, "Active Personal plan required");
      setCard("business_customized", plans.has("business_monthly"), false, "Active Business plan required");
      return;
    }

    let currentMode = preference?.account_mode || (plans.has("business_monthly") ? "business_customized" : plans.has("personal_monthly") ? "personal_customized" : "local");
    if (!preference && currentMode !== "local") {
      const { error } = await client.from("user_account_preferences").upsert(
        { user_id: user.id, account_mode: currentMode, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
      if (error) { console.warn("Could not save the initial paid mode preference:", error); currentMode = "local"; }
    }
    let expiredFallback = false;
    if (!available(currentMode, plans)) {
      currentMode = "local";
      expiredFallback = true;
      const { error } = await client.from("user_account_preferences").upsert(
        { user_id: user.id, account_mode: "local", updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
      if (error) console.warn("Could not save Local fallback after plan expiry:", error);
    }

    const render = () => {
      setCard("local", true, currentMode === "local", "Available");
      setCard("personal_customized", plans.has("personal_monthly"), currentMode === "personal_customized", "Active Personal plan required");
      setCard("business_customized", plans.has("business_monthly"), currentMode === "business_customized", "Active Business plan required");
    };
    render();
    if (expiredFallback) setMessage("Your previously selected paid mode is no longer active. You've been switched to Local so you can keep messaging. Renew or upgrade, then select the paid mode again.", "success");
    else setMessage("Current mode: " + MODE_LABELS[currentMode] + ". Your sign-in and chat history stay the same when you switch modes.", "success");

    $("#accountModeGrid").addEventListener("click", async event => {
      const card = event.target.closest("[data-account-mode]");
      if (!card || card.disabled) return;
      const nextMode = card.dataset.accountMode;
      if (!available(nextMode, plans)) return;
      if (nextMode === currentMode) { setMessage("You're already using " + MODE_LABELS[currentMode] + ".", "success"); return; }
      $("#accountModeGrid").querySelectorAll("button").forEach(button => { button.disabled = true; });
      setMessage("Switching to " + MODE_LABELS[nextMode] + "…");
      try {
        const { error } = await client.from("user_account_preferences").upsert(
          { user_id: user.id, account_mode: nextMode, updated_at: new Date().toISOString() },
          { onConflict: "user_id" }
        );
        if (error) throw error;
        currentMode = nextMode;
        window.ZakiChatMode = Object.freeze({ current: currentMode, plans, ready: true });
        document.documentElement.dataset.zakichatAccountMode = currentMode;
        document.body?.setAttribute("data-zakichat-account-mode", currentMode);
        window.dispatchEvent(new CustomEvent("zakichat:modechange", { detail: { mode: currentMode } }));
        render();
        setMessage("You're now using " + MODE_LABELS[currentMode] + ". Your login and conversations have not changed.", "success");
        const footer = $(".account-mode-footer");
        $("#accountModeWorkspaceLink")?.remove();
        if (currentMode === "business_customized" && footer) {
          const link = document.createElement("a");
          link.href = "business.html";
          link.id = "accountModeWorkspaceLink";
          link.className = "account-mode-workspace-link";
          link.textContent = "Open Business Workspace";
          footer.appendChild(link);
        }
      } catch (error) {
        console.error("ZakiChat account mode switch failed:", error);
        setMessage(error.message || "Couldn't switch modes. Please try again.", "error");
        render();
      }
    });
  }
  document.addEventListener("DOMContentLoaded", () => {
    init().catch(error => {
      console.error("ZakiChat account mode setup failed:", error);
      setMessage("Account modes couldn't be loaded. Please refresh and try again.", "error");
    });
  }, { once: true });
})();