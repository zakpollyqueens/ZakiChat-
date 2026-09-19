(function () {
  "use strict";

  if (
    !window.supabase ||
    !window.ZakiChatConfig ||
    !window.ZakiChatAuth?.client
  ) {
    console.error(
      "ZakiChat Account: centralized Supabase client unavailable."
    );
    return;
  }

  const supabaseClient =
    window.ZakiChatAuth.client;

  const accountAvatar =
    document.getElementById("accountAvatar");

  const accountAvatarInitials =
    document.getElementById(
      "accountAvatarInitials"
    );

  const accountDisplayName =
    document.getElementById(
      "accountDisplayName"
    );

  const accountIdentifier =
    document.getElementById(
      "accountIdentifier"
    );

  const accountUserId =
    document.getElementById(
      "accountUserId"
    );

  const accountStatus =
    document.getElementById(
      "accountStatus"
    );

  const switchAccountButton =
    document.getElementById(
      "switchAccountButton"
    );

  const signOutButton =
    document.getElementById(
      "signOutButton"
    );

  const deleteAccountButton =
    document.getElementById(
      "deleteAccountButton"
    );

  const accountMessage =
    document.getElementById(
      "accountMessage"
    );

  const passwordModal =
    document.getElementById(
      "passwordModal"
    );

  const closePasswordModal =
    document.getElementById(
      "closePasswordModal"
    );

  const passwordForm =
    document.getElementById(
      "passwordForm"
    );

  const accountPassword =
    document.getElementById(
      "accountPassword"
    );

  const passwordMessage =
    document.getElementById(
      "passwordMessage"
    );

  const verifyPasswordButton =
    document.getElementById(
      "verifyPasswordButton"
    );

  const deleteModal =
    document.getElementById(
      "deleteModal"
    );

  const closeDeleteModal =
    document.getElementById(
      "closeDeleteModal"
    );

  const cancelDeleteButton =
    document.getElementById(
      "cancelDeleteButton"
    );

  const deleteConfirmation =
    document.getElementById(
      "deleteConfirmation"
    );

  const deleteMessage =
    document.getElementById(
      "deleteMessage"
    );

  const confirmDeleteButton =
    document.getElementById(
      "confirmDeleteButton"
    );


  let currentUser = null;
  let currentProfile = null;
  let passwordVerified = false;
  let pendingDangerAction = null;
  let busy = false;
  let switchingAccount = false;


  function showAccountMessage(
    text,
    type
  ) {
    if (!accountMessage) return;

    accountMessage.textContent =
      text;

    accountMessage.className =
      "account-message " +
      (type || "");

    accountMessage.hidden = false;
  }


  function clearAccountMessage() {
    if (!accountMessage) return;

    accountMessage.textContent = "";
    accountMessage.className =
      "account-message";
    accountMessage.hidden = true;
  }


  function showPasswordMessage(
    text
  ) {
    if (!passwordMessage) return;

    passwordMessage.textContent =
      text;

    passwordMessage.hidden = false;
  }


  function clearPasswordMessage() {
    if (!passwordMessage) return;

    passwordMessage.textContent = "";
    passwordMessage.hidden = true;
  }


  function showDeleteMessage(
    text
  ) {
    if (!deleteMessage) return;

    deleteMessage.textContent =
      text;

    deleteMessage.hidden = false;
  }


  function clearDeleteMessage() {
    if (!deleteMessage) return;

    deleteMessage.textContent = "";
    deleteMessage.hidden = true;
  }


  function getInitials(
    name,
    identifier
  ) {
    const source =
      String(name || "").trim() ||
      String(identifier || "").trim() ||
      "?";

    const parts =
      source
        .split(/\s+/)
        .filter(Boolean);

    if (parts.length >= 2) {
      return (
        parts[0].charAt(0) +
        parts[1].charAt(0)
      ).toUpperCase();
    }

    return source
      .replace(/^@+/, "")
      .slice(0, 2)
      .toUpperCase() || "?";
  }


  function setAvatar(profile) {
    if (!accountAvatar) return;

    const name =
      profile?.full_name ||
      profile?.username ||
      currentUser?.phone ||
      currentUser?.email ||
      "ZakiChat User";

    const identifier =
      profile?.username ||
      currentUser?.phone ||
      currentUser?.email ||
      "";

    accountAvatar.innerHTML = "";

    if (profile?.avatar_url) {
      const image =
        document.createElement("img");

      image.src =
        profile.avatar_url;

      image.alt =
        "Profile photo";

      image.addEventListener(
        "error",
        function () {
          accountAvatar.innerHTML = "";

          const fallback =
            document.createElement("span");

          fallback.textContent =
            getInitials(
              name,
              identifier
            );

          accountAvatar.appendChild(
            fallback
          );
        }
      );

      accountAvatar.appendChild(
        image
      );

      return;
    }

    if (accountAvatarInitials) {
      accountAvatarInitials.textContent =
        getInitials(
          name,
          identifier
        );

      accountAvatar.appendChild(
        accountAvatarInitials
      );

      return;
    }

    const fallback =
      document.createElement("span");

    fallback.textContent =
      getInitials(
        name,
        identifier
      );

    accountAvatar.appendChild(
      fallback
    );
  }


  function updateIdentity() {
    if (!currentUser) return;

    const metadata =
      currentUser.user_metadata || {};

    const name =
      currentProfile?.full_name ||
      currentProfile?.username ||
      metadata.display_name ||
      metadata.full_name ||
      currentUser.phone ||
      currentUser.email ||
      "ZakiChat User";

    const identifier =
      currentProfile?.username
        ? "@" +
          currentProfile.username
        : (
            currentUser.email ||
            currentUser.phone ||
            "Account"
          );

    if (accountDisplayName) {
      accountDisplayName.textContent =
        name;
    }

    if (accountIdentifier) {
      accountIdentifier.textContent =
        identifier;
    }

    if (accountUserId) {
      accountUserId.textContent =
        "Account ID: " +
        currentUser.id;
    }

    if (accountStatus) {
      accountStatus.classList.add(
        "active"
      );

      const label =
        accountStatus.querySelector(
          "span"
        );

      if (label) {
        label.textContent =
          "Active";
      }
    }

    setAvatar(
      currentProfile || {}
    );
  }


  async function loadProfile() {
    if (!currentUser) return;

    const {
      data,
      error
    } = await supabaseClient
      .from("profiles")
      .select(
        "id,username,full_name,avatar_url"
      )
      .eq(
        "id",
        currentUser.id
      )
      .maybeSingle();

    if (error) {
      console.warn(
        "ZakiChat Account: profile lookup failed:",
        error
      );

      return;
    }

    currentProfile =
      data || null;

    updateIdentity();
  }


  async function getCurrentSession() {
    const {
      data,
      error
    } = await supabaseClient
      .auth
      .getSession();

    if (error) {
      throw error;
    }

    if (
      !data?.session?.user
    ) {
      return null;
    }

    return data.session;
  }


  function openModal(modal) {
    if (!modal) return;

    modal.hidden = false;
    modal.setAttribute(
      "aria-hidden",
      "false"
    );

    document.body.classList.add(
      "modal-open"
    );
  }


  function closeModal(modal) {
    if (!modal) return;

    modal.hidden = true;
    modal.setAttribute(
      "aria-hidden",
      "true"
    );

    const anyOpen =
      !passwordModal?.hidden ||
      !deleteModal?.hidden;

    if (!anyOpen) {
      document.body.classList.remove(
        "modal-open"
      );
    }
  }


  function openPasswordVerification(
    action
  ) {
    if (!currentUser) return;

    pendingDangerAction =
      action || null;

    clearPasswordMessage();

    if (accountPassword) {
      accountPassword.value = "";
    }

    openModal(
      passwordModal
    );

    window.setTimeout(
      function () {
        accountPassword?.focus();
      },
      50
    );
  }


  function openDeleteConfirmation() {
    clearDeleteMessage();

    if (deleteConfirmation) {
      deleteConfirmation.value = "";
    }

    if (confirmDeleteButton) {
      confirmDeleteButton.disabled =
        true;
    }

    openModal(
      deleteModal
    );

    window.setTimeout(
      function () {
        deleteConfirmation?.focus();
      },
      50
    );
  }


  async function verifyPassword(
    password
  ) {
    if (!currentUser) {
      throw new Error(
        "Your ZakiChat session is no longer active."
      );
    }

    const identifier =
      currentUser.email ||
      currentUser.phone;

    if (!identifier) {
      throw new Error(
        "No supported sign-in identifier is available for this account."
      );
    }

    const credentials =
      currentUser.email
        ? {
            email: currentUser.email,
            password
          }
        : {
            phone: currentUser.phone,
            password
          };

    const {
      data,
      error
    } =
      await supabaseClient
        .auth
        .signInWithPassword(
          credentials
        );

    if (error) {
      throw error;
    }

    if (!data?.session?.user) {
      throw new Error(
        "Password verification did not create a valid authenticated session."
      );
    }

    /*
     * Do not store the password.
     *
     * Supabase has now re-authenticated the existing
     * account and issued a fresh session. The fresh
     * access token is what the protected deletion
     * function will verify.
     */
    currentUser =
      data.session.user;

    passwordVerified =
      true;

    return data.session;
  }


  async function handlePasswordSubmit(
    event
  ) {
    event.preventDefault();

    if (
      busy ||
      !accountPassword
    ) {
      return;
    }

    clearPasswordMessage();

    const password =
      accountPassword.value;

    if (!password) {
      showPasswordMessage(
        "Enter your existing ZakiChat account password."
      );

      accountPassword.focus();

      return;
    }

    busy = true;

    if (verifyPasswordButton) {
      verifyPasswordButton.disabled =
        true;

      verifyPasswordButton.textContent =
        "Verifying...";
    }

    try {
      await verifyPassword(
        password
      );

      closeModal(
        passwordModal
      );

      if (
        pendingDangerAction ===
        "delete"
      ) {
        openDeleteConfirmation();
      }

      pendingDangerAction =
        null;

    } catch (error) {
      console.error(
        "ZakiChat password verification failed:",
        error
      );

      passwordVerified =
        false;

      showPasswordMessage(
        "The password could not be verified. Please check your existing account password and try again."
      );

    } finally {
      busy = false;

      if (verifyPasswordButton) {
        verifyPasswordButton.disabled =
          false;

        verifyPasswordButton.textContent =
          "Verify password";
      }
    }
  }


  async function signOut() {
    if (
      busy ||
      !currentUser
    ) {
      return;
    }

    busy = true;

    if (signOutButton) {
      signOutButton.disabled =
        true;

      signOutButton.textContent =
        "Signing out...";
    }

    clearAccountMessage();

    try {
      if (
        window.ZakiChatAccounts
          ?.signOutCurrentAccount
      ) {
        await window.ZakiChatAccounts
          .signOutCurrentAccount(
            supabaseClient
          );

        return;
      }

      const {
        error
      } =
        await supabaseClient
          .auth
          .signOut({
            scope: "local"
          });

      if (error) {
        throw error;
      }

      window.location.replace(
        "login.html"
      );

    } catch (error) {
      console.error(
        "ZakiChat sign out failed:",
        error
      );

      showAccountMessage(
        error.message ||
        "Could not sign out. Please try again.",
        "error"
      );

      busy = false;

      if (signOutButton) {
        signOutButton.disabled =
          false;

        signOutButton.textContent =
          "Sign out";
      }
    }
  }


  async function switchAccount() {
    if (
      busy ||
      !currentUser
    ) {
      return;
    }

    const accounts =
      window.ZakiChatAccounts
        ?.getAccounts?.() || [];

    const activeAccount =
      window.ZakiChatAccounts
        ?.getActiveAccount?.();

    const alternatives =
      accounts.filter(
        function (account) {
          return (
            account.userId !==
            currentUser.id
          );
        }
      );

    if (!alternatives.length) {
      showAccountMessage(
        "There is no other saved ZakiChat account on this device. Sign out first, then sign in with another account.",
        ""
      );

      return;
    }

    const selected =
      alternatives[0];

    if (
      !window.ZakiChatAccounts
        ?.switchAccount
    ) {
      showAccountMessage(
        "Account switching is unavailable right now.",
        "error"
      );

      return;
    }

    busy = true;

    if (switchAccountButton) {
      switchAccountButton.disabled =
        true;

      switchAccountButton.textContent =
        "Switching...";
    }

    try {
      /*
       * Cleanly sign out the current local session,
       * preserve this account in the local registry,
       * activate the selected account's storage
       * namespace, then reload the application.
       *
       * Each saved account therefore keeps its own
       * isolated Supabase session.
       */
      switchingAccount = true;

      await window.ZakiChatAccounts
        .switchAccount(
          selected.storageKey,
          supabaseClient
        );

    } catch (error) {
      switchingAccount = false;
      console.error(
        "ZakiChat account switch failed:",
        error
      );

      showAccountMessage(
        error.message ||
        "Could not switch accounts.",
        "error"
      );

      busy = false;

      if (switchAccountButton) {
        switchAccountButton.disabled =
          false;
      }
    }
  }


  function updateDeleteButton() {
    if (
      !confirmDeleteButton ||
      !deleteConfirmation
    ) {
      return;
    }

    confirmDeleteButton.disabled =
      deleteConfirmation.value
        .trim()
        .toUpperCase() !==
      "DELETE";
  }


  async function handleDeleteConfirmation() {
    if (
      busy ||
      !passwordVerified ||
      !currentUser ||
      !confirmDeleteButton
    ) {
      return;
    }

    if (
      deleteConfirmation.value
        .trim()
        .toUpperCase() !==
      "DELETE"
    ) {
      return;
    }

    clearDeleteMessage();

    busy = true;

    confirmDeleteButton.disabled =
      true;

    confirmDeleteButton.textContent =
      "Deleting...";

    try {
      /*
       * Obtain the current fresh session created by
       * the password re-authentication step.
       */
      const {
        data: sessionData,
        error: sessionError
      } =
        await supabaseClient
          .auth
          .getSession();

      if (
        sessionError ||
        !sessionData?.session?.access_token
      ) {
        throw new Error(
          "Your security session could not be verified. Please verify your password again."
        );
      }

      const accessToken =
        sessionData.session.access_token;

      /*
       * Send only the fresh access token to the
       * server-side deletion function.
       *
       * The user ID is intentionally NOT sent.
       * The Edge Function derives the account identity
       * from the verified Supabase access token.
       */
      const {
        data,
        error
      } =
        await supabaseClient.functions.invoke(
          "delete-account",
          {
            method: "POST",
            headers: {
              Authorization:
                "Bearer " +
                accessToken
            },
            body: {}
          }
        );

      if (error) {
        let serverMessage = "";

        try {
          if (
            typeof error.context?.json ===
            "function"
          ) {
            const body =
              await error.context.json();

            serverMessage =
              String(
                body?.error || ""
              );
          }
        } catch {
          /* Ignore response parsing failures. */
        }

        throw new Error(
          serverMessage ||
          error.message ||
          "The account deletion request failed."
        );
      }

      if (!data?.success) {
        throw new Error(
          data?.error ||
          "The server did not confirm account deletion."
        );
      }

      /*
       * The server confirmed deletion.
       *
       * Remove this account from the local account
       * registry and clear its local Supabase session.
       */
      const deletedUserId =
        currentUser.id;

      try {
        await supabaseClient.auth.signOut({
          scope: "local"
        });
      } catch (signOutError) {
        console.warn(
          "Local session cleanup after deletion reported an error:",
          signOutError
        );
      }

      if (
        window.ZakiChatAccounts
          ?.removeAccount
      ) {
        window.ZakiChatAccounts
          .removeAccount(
            deletedUserId
          );
      }

      if (
        window.ZakiChatAccounts
          ?.getAccounts
      ) {
        const remaining =
          window.ZakiChatAccounts
            .getAccounts();

        if (remaining.length) {
          window.ZakiChatAccounts
            .setActiveStorageKey(
              remaining[0].storageKey
            );
        } else {
          localStorage.removeItem(
            "zakichat-active-storage-key"
          );
        }
      }

      passwordVerified =
        false;

      showDeleteMessage(
        "Your ZakiChat account has been permanently deleted."
      );

      window.setTimeout(
        function () {
          window.location.replace(
            "login.html"
          );
        },
        1200
      );

    } catch (error) {
      console.error(
        "ZakiChat account deletion failed:",
        error
      );

      showDeleteMessage(
        error.message ||
        "The account could not be deleted. No successful deletion was confirmed."
      );

      passwordVerified =
        false;

      busy = false;

      if (confirmDeleteButton) {
        confirmDeleteButton.disabled =
          false;

        confirmDeleteButton.textContent =
          "Delete permanently";
      }

      return;
    }
  }


  function bindEvents() {
    switchAccountButton?.addEventListener(
      "click",
      switchAccount
    );

    signOutButton?.addEventListener(
      "click",
      signOut
    );

    deleteAccountButton?.addEventListener(
      "click",
      function () {
        openPasswordVerification(
          "delete"
        );
      }
    );

    passwordForm?.addEventListener(
      "submit",
      handlePasswordSubmit
    );

    closePasswordModal?.addEventListener(
      "click",
      function () {
        pendingDangerAction =
          null;

        closeModal(
          passwordModal
        );
      }
    );

    closeDeleteModal?.addEventListener(
      "click",
      function () {
        passwordVerified =
          false;

        closeModal(
          deleteModal
        );
      }
    );

    cancelDeleteButton?.addEventListener(
      "click",
      function () {
        passwordVerified =
          false;

        closeModal(
          deleteModal
        );
      }
    );

    document
      .querySelectorAll(
        "[data-close-modal]"
      )
      .forEach(
        function (element) {
          element.addEventListener(
            "click",
            function () {
              pendingDangerAction =
                null;

              closeModal(
                passwordModal
              );
            }
          );
        }
      );

    document
      .querySelectorAll(
        "[data-close-delete]"
      )
      .forEach(
        function (element) {
          element.addEventListener(
            "click",
            function () {
              passwordVerified =
                false;

              closeModal(
                deleteModal
              );
            }
          );
        }
      );

    deleteConfirmation?.addEventListener(
      "input",
      updateDeleteButton
    );

    confirmDeleteButton?.addEventListener(
      "click",
      handleDeleteConfirmation
    );

    document.addEventListener(
      "keydown",
      function (event) {
        if (
          event.key !== "Escape"
        ) {
          return;
        }

        if (
          passwordModal &&
          !passwordModal.hidden
        ) {
          pendingDangerAction =
            null;

          closeModal(
            passwordModal
          );

          return;
        }

        if (
          deleteModal &&
          !deleteModal.hidden
        ) {
          passwordVerified =
            false;

          closeModal(
            deleteModal
          );
        }
      }
    );
  }


  async function initialize() {
    try {
      const session =
        await getCurrentSession();

      if (!session) {
        window.location.replace(
          "login.html"
        );

        return;
      }

      currentUser =
        session.user;

      updateIdentity();

      await loadProfile();

    } catch (error) {
      console.error(
        "ZakiChat Account initialization failed:",
        error
      );

      window.location.replace(
        "login.html"
      );
    }
  }


  supabaseClient.auth.onAuthStateChange(
    function (event, session) {
      /*
       * During account switching the current local
       * session is intentionally signed out before
       * the new active storage namespace is selected.
       *
       * Do not redirect to login during that short
       * transition.
       */
      if (switchingAccount) {
        return;
      }

      if (
        event === "SIGNED_OUT" ||
        !session
      ) {
        window.location.replace(
          "login.html"
        );
      }
    }
  );


  bindEvents();
  initialize();

})();

/* Account activation/deactivation controls */
(function () {
  const deactivateButton = document.getElementById("deactivateAccountButton");
  const activateButton = document.getElementById("activateAccountButton");

  function showStatus(message, type) {
    const messageBox = document.getElementById("accountMessage");
    if (!messageBox) return;

    messageBox.textContent = message;
    messageBox.className = "account-message " + (type || "");
    messageBox.hidden = false;
  }

  deactivateButton?.addEventListener("click", function () {
    showStatus(
      "Account deactivation is not available yet because the account-status backend has not been enabled.",
      "error"
    );
  });

  activateButton?.addEventListener("click", function () {
    showStatus(
      "Account activation is not available yet because the account-status backend has not been enabled.",
      "error"
    );
  });
})();
