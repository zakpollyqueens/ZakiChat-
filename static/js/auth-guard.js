(function () {
  "use strict";
  if (!window.ZakiChatAuth?.client) {
    console.error("ZakiChat auth guard could not start.");
    return;
  }
  const client = window.ZakiChatAuth.client;
  (function loadAppLock() {
    if (!document.querySelector('link[data-zaki-lock-styles]')) {
      const style = document.createElement("link");
      style.rel = "stylesheet"; style.href = "../static/css/app-lock.css";
      style.dataset.zakiLockStyles = "true"; document.head.appendChild(style);
    }
    if (!document.querySelector('script[data-zaki-lock-script]')) {
      const script = document.createElement("script");
      script.src = "../static/js/app-lock.js"; script.dataset.zakiLockScript = "true";
      script.defer = true; document.head.appendChild(script);
    }
  })();
  let redirecting = false;
  function sendToLogin() {
    if (redirecting) return;
    redirecting = true;
    location.replace("login.html");
  }
  async function protectPage() {
    try {
      const { data: sessionData, error: sessionError } = await client.auth.getSession();
      if (sessionError || !sessionData.session) { sendToLogin(); return; }
      // Validate the user with Supabase Auth, not only the locally stored session.
      const { data, error } = await client.auth.getUser();
      const user = data?.user;
      // New email-based accounts must have a confirmed email. Keep already-authenticated
      // legacy phone-confirmed sessions working during the migration so existing users
      // are not unexpectedly locked out of their chats.
      const verifiedEmail = Boolean(user?.email && user.email_confirmed_at);
      const legacyVerifiedPhone = Boolean(user?.phone && user.phone_confirmed_at);
      if (error || !user || (!verifiedEmail && !legacyVerifiedPhone)) {
        await client.auth.signOut({ scope: "local" });
        sendToLogin();
        return;
      }
      await window.ZakiChatAccounts?.registerCurrentSession(client, {
        email: user.email,
        phone: user.user_metadata?.phone || user.phone || "",
        displayName: user.user_metadata?.display_name || user.user_metadata?.full_name || user.email
      });
    } catch (error) {
      console.error("ZakiChat protected-page validation failed:", error);
      sendToLogin();
    }
  }
  client.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT" || !session) sendToLogin();
  });
  protectPage();
})();