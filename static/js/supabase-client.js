(function () {
  "use strict";

  if (
    !window.supabase ||
    !window.ZakiChatConfig
  ) {
    console.error(
      "ZakiChat Supabase client could not start."
    );
    return;
  }

  const accounts =
    window.ZakiChatAccounts;

  if (!accounts) {
    console.error(
      "ZakiChat account manager is unavailable."
    );
    return;
  }

  const storageKey =
    accounts.getActiveStorageKey();

  const client =
    accounts.createClient(
      storageKey
    );

  window.ZakiChatAuth =
    Object.freeze({
      client,
      storageKey
    });

  accounts
    .initialize()
    .then(result => {
      if (result.migrated) {
        window.location.reload();
        return;
      }

      const activeAccount =
        result.activeAccount;

      if (
        activeAccount &&
        activeAccount.storageKey ===
          storageKey
      ) {
        return;
      }

      if (
        !activeAccount &&
        result.accounts.length === 0
      ) {
        return;
      }
    })
    .catch(error => {
      console.error(
        "ZakiChat account initialization failed:",
        error
      );
    });

  let modeRefreshInFlight = false;
  async function applyAccountMode() {
    if (modeRefreshInFlight) return;
    modeRefreshInFlight = true;
    try {
      const { data: sessionResult, error: sessionError } = await client.auth.getSession();
      if (sessionError) throw sessionError;
      const user = sessionResult?.session?.user;
      if (!user) return;

      const { data: upgrades, error: upgradeError } = await client
        .from("user_upgrades")
        .select("plan,status,expires_at")
        .eq("user_id", user.id)
        .eq("status", "active")
        .gt("expires_at", new Date().toISOString())
        .in("plan", ["personal_monthly", "business_monthly"]);
      if (upgradeError) throw upgradeError;

      const plans = new Set((upgrades || []).map(item => item.plan));
      const { data: preference, error: preferenceError } = await client
        .from("user_account_preferences")
        .select("account_mode")
        .eq("user_id", user.id)
        .maybeSingle();
      if (preferenceError) {
        // Existing deployments may not have applied migration 050 yet.
        console.info("ZakiChat account modes are awaiting database migration 050.");
        window.ZakiChatMode = Object.freeze({ current: "local", plans, ready: false });
        document.documentElement.dataset.zakichatAccountMode = "local";
        return;
      }

      let mode = preference?.account_mode || (plans.has("business_monthly") ? "business_customized" : plans.has("personal_monthly") ? "personal_customized" : "local");
      if (!preference && mode !== "local") {
        const { error } = await client.from("user_account_preferences").upsert(
          { user_id: user.id, account_mode: mode, updated_at: new Date().toISOString() },
          { onConflict: "user_id" }
        );
        if (error) { console.warn("Could not save initial customized mode:", error); mode = "local"; }
      }
      const permitted = mode === "local" ||
        (mode === "personal_customized" && plans.has("personal_monthly")) ||
        (mode === "business_customized" && plans.has("business_monthly"));

      if (!permitted) {
        mode = "local";
        const { error } = await client.from("user_account_preferences").upsert(
          { user_id: user.id, account_mode: mode, updated_at: new Date().toISOString() },
          { onConflict: "user_id" }
        );
        if (error) console.warn("Could not persist Local fallback for expired mode:", error);
      }

      window.ZakiChatMode = Object.freeze({ current: mode, plans, ready: true });
      document.documentElement.dataset.zakichatAccountMode = mode;
      document.body?.setAttribute("data-zakichat-account-mode", mode);
      window.dispatchEvent(new CustomEvent("zakichat:modechange", { detail: { mode } }));
    } catch (error) {
      console.warn("ZakiChat account mode could not be resolved:", error);
      window.ZakiChatMode = Object.freeze({ current: "local", plans: new Set(), ready: false });
      document.documentElement.dataset.zakichatAccountMode = "local";
    } finally {
      modeRefreshInFlight = false;
    }
  }

  // Re-check on return to the app and periodically so an expired paid plan
  // falls back to Local without interrupting the user's signed-in session.
  window.ZakiChatRefreshMode = applyAccountMode;
  window.addEventListener("focus", applyAccountMode);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") applyAccountMode();
  });
  window.setInterval(applyAccountMode, 60000);

  client.auth.getSession().then(() => applyAccountMode()).catch(error => console.warn("ZakiChat mode bootstrap failed:", error));

  console.log(
    "ZakiChat Supabase client initialized:",
    storageKey
  );
})();
