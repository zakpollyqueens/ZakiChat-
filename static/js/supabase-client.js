(function () {
  "use strict";
  if (!window.supabase || !window.ZakiChatConfig) {
    console.error("ZakiChat Supabase client could not start.");
    return;
  }
  const accounts = window.ZakiChatAccounts;
  if (!accounts) {
    console.error("ZakiChat account manager is unavailable.");
    return;
  }
  const pendingAddAccountKey =
    location.pathname.toLowerCase().endsWith("/auth-callback.html")
      ? localStorage.getItem("zakichat_pending_add_account_storage_key")
      : null;
  const storageKey = pendingAddAccountKey || accounts.getActiveStorageKey();
  const client = accounts.createClient(storageKey);

  // Pages wait for account migration/initialization before checking the session.
  const ready = accounts.initialize().then(result => {
    if (result.migrated) window.location.reload();
    return result;
  }).catch(error => {
    console.error("ZakiChat account initialization failed:", error);
    throw error;
  });

  window.ZakiChatAuth = Object.freeze({ client, storageKey, ready });
  console.log("ZakiChat Supabase client initialized:", storageKey);
})();
