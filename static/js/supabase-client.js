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

  console.log(
    "ZakiChat Supabase client initialized:",
    storageKey
  );
})();
