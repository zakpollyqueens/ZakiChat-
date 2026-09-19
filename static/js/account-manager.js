(function () {
  "use strict";

  const REGISTRY_KEY = "zakichat-account-registry";
  const ACTIVE_KEY = "zakichat-active-storage-key";
  const LEGACY_KEY = "zakichat-auth";
  const ACCOUNT_PREFIX = "zakichat-auth-account-";

  function readRegistry() {
    try {
      const raw = localStorage.getItem(REGISTRY_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error(
        "ZakiChat account registry read failed:",
        error
      );
      return [];
    }
  }

  function writeRegistry(accounts) {
    localStorage.setItem(
      REGISTRY_KEY,
      JSON.stringify(accounts)
    );
  }

  function getActiveStorageKey() {
    return (
      localStorage.getItem(ACTIVE_KEY) ||
      LEGACY_KEY
    );
  }

  function setActiveStorageKey(storageKey) {
    localStorage.setItem(
      ACTIVE_KEY,
      storageKey
    );
  }

  function getAccounts() {
    return readRegistry();
  }

  function getActiveAccount() {
    const activeKey =
      getActiveStorageKey();

    return (
      readRegistry().find(
        account =>
          account.storageKey === activeKey
      ) || null
    );
  }

  function createStorageKey() {
    return (
      ACCOUNT_PREFIX +
      crypto.randomUUID()
    );
  }

  function saveAccount(account) {
    const accounts =
      readRegistry();

    const existingIndex =
      accounts.findIndex(
        item =>
          item.userId === account.userId
      );

    if (existingIndex >= 0) {
      accounts[existingIndex] = {
        ...accounts[existingIndex],
        ...account
      };
    } else {
      accounts.push(account);
    }

    writeRegistry(accounts);

    return accounts;
  }

  function removeAccount(userId) {
    const accounts =
      readRegistry().filter(
        account =>
          account.userId !== userId
      );

    writeRegistry(accounts);

    return accounts;
  }

  function removeAccountByStorageKey(
    storageKey
  ) {
    const accounts =
      readRegistry().filter(
        account =>
          account.storageKey !== storageKey
      );

    writeRegistry(accounts);

    return accounts;
  }

  function createClient(storageKey) {
    if (
      !window.supabase ||
      !window.ZakiChatConfig
    ) {
      throw new Error(
        "ZakiChat Supabase configuration is unavailable."
      );
    }

    return window.supabase.createClient(
      window.ZakiChatConfig.supabaseUrl,
      window.ZakiChatConfig.supabaseKey,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storageKey
        }
      }
    );
  }

  async function migrateLegacySession() {
    if (
      localStorage.getItem(ACTIVE_KEY) ||
      readRegistry().length
    ) {
      return false;
    }

    const legacyClient =
      createClient(LEGACY_KEY);

    const {
      data,
      error
    } = await legacyClient.auth.getSession();

    if (
      error ||
      !data?.session?.user
    ) {
      return false;
    }

    const user =
      data.session.user;

    const storageKey =
      createStorageKey();

    const accountClient =
      createClient(storageKey);

    const {
      error: setSessionError
    } =
      await accountClient.auth.setSession({
        access_token:
          data.session.access_token,
        refresh_token:
          data.session.refresh_token
      });

    if (setSessionError) {
      console.error(
        "ZakiChat legacy session migration failed:",
        setSessionError
      );
      return false;
    }

    saveAccount({
      userId: user.id,
      phone: user.phone || "",
      email: user.email || "",
      displayName:
        user.user_metadata?.display_name ||
        user.user_metadata?.full_name ||
        user.phone ||
        user.email ||
        "ZakiChat user",
      storageKey
    });

    setActiveStorageKey(
      storageKey
    );

    await legacyClient.auth.signOut({
      scope: "local"
    });

    console.log(
      "ZakiChat legacy session migrated successfully."
    );

    return true;
  }

  async function initialize() {
    const migrated =
      await migrateLegacySession();

    return {
      migrated,
      accounts: getAccounts(),
      activeAccount:
        getActiveAccount(),
      activeStorageKey:
        getActiveStorageKey()
    };
  }

  async function switchAccount(
    storageKey,
    currentClient = null
  ) {
    const account =
      readRegistry().find(
        item =>
          item.storageKey === storageKey
      );

    if (!account) {
      throw new Error(
        "The selected ZakiChat account was not found."
      );
    }

    const currentAccount =
      getActiveAccount();

    /*
     * Never switch to the requested account if it is
     * already the active account.
     */
    if (
      currentAccount &&
      currentAccount.storageKey === storageKey
    ) {
      window.location.reload();
      return;
    }

    /*
     * Cleanly sign out the CURRENT local Supabase
     * session before changing the active storage key.
     *
     * The account remains in the registry. Its own
     * storage namespace is preserved so it can be
     * selected again later.
     */
    if (currentClient) {
      const {
        error
      } = await currentClient.auth.signOut({
        scope: "local"
      });

      if (error) {
        throw error;
      }
    }

    /*
     * Activate the selected account only after the
     * current session has been locally signed out.
     */
    setActiveStorageKey(
      storageKey
    );

    window.location.reload();
  }

  async function registerCurrentSession(
    client,
    metadata = {}
  ) {
    const {
      data,
      error
    } = await client.auth.getSession();

    if (error) {
      throw error;
    }

    if (!data?.session?.user) {
      throw new Error(
        "No authenticated ZakiChat session was found."
      );
    }

    const user =
      data.session.user;

    const storageKey =
      getActiveStorageKey();

    saveAccount({
      userId: user.id,
      phone:
        metadata.phone ||
        user.phone ||
        "",
      email:
        metadata.email ||
        user.email ||
        "",
      displayName:
        metadata.displayName ||
        user.user_metadata?.display_name ||
        user.user_metadata?.full_name ||
        user.phone ||
        user.email ||
        "ZakiChat user",
      storageKey
    });

    return getActiveAccount();
  }

  async function signOutCurrentAccount(
    client
  ) {
    const activeAccount =
      getActiveAccount();

    const {
      error
    } = await client.auth.signOut({
      scope: "local"
    });

    if (error) {
      throw error;
    }

    if (activeAccount) {
      removeAccount(
        activeAccount.userId
      );
    }

    const remaining =
      readRegistry();

    if (remaining.length) {
      setActiveStorageKey(
        remaining[0].storageKey
      );
    } else {
      localStorage.removeItem(
        ACTIVE_KEY
      );
    }

    window.location.reload();
  }

  window.ZakiChatAccounts =
    Object.freeze({
      getAccounts,
      getActiveAccount,
      getActiveStorageKey,
      setActiveStorageKey,
      createStorageKey,
      createClient,
      saveAccount,
      removeAccount,
      removeAccountByStorageKey,
      switchAccount,
      registerCurrentSession,
      signOutCurrentAccount,
      migrateLegacySession,
      initialize
    });
})();
