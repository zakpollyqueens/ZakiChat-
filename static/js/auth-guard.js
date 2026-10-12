(function () {
  "use strict";
  if (!window.supabase || !window.ZakiChatConfig) {
    console.error("ZakiChat auth guard could not start.");
    return;
  }
  const auth = window.ZakiChatAuth;
  const supabaseClient = auth?.client;
  if (!supabaseClient) {
    console.error("ZakiChat auth guard: centralized Supabase client unavailable.");
    return;
  }

  (function loadAppLock() {
    if (!document.querySelector('link[data-zaki-lock-styles]')) {
      const style = document.createElement("link");
      style.rel = "stylesheet";
      style.href = "../static/css/app-lock.css";
      style.dataset.zakiLockStyles = "true";
      document.head.appendChild(style);
    }
    if (!document.querySelector('script[data-zaki-lock-script]')) {
      const script = document.createElement("script");
      script.src = "../static/js/app-lock.js";
      script.dataset.zakiLockScript = "true";
      script.defer = true;
      document.head.appendChild(script);
    }
  })();

  let redirecting = false;
  function openLogin() {
    if (redirecting) return;
    redirecting = true;
    window.location.replace("login.html");
  }

  async function protectPage() {
    try {
      if (auth.ready) await auth.ready;
      const { data, error } = await supabaseClient.auth.getSession();
      if (error) throw error;
      if (!data?.session?.user) {
        openLogin();
        return;
      }
      try {
        await window.ZakiChatAccounts?.registerCurrentSession(supabaseClient, {
          storageKey: auth.storageKey,
          email: data.session.user.email || "",
          phone: data.session.user.phone || "",
          displayName:
            data.session.user.user_metadata?.display_name ||
            data.session.user.user_metadata?.full_name ||
            data.session.user.email ||
            data.session.user.phone ||
            "ZakiChat user"
        });
      } catch (registryError) {
        console.warn("Could not refresh the saved-account list:", registryError);
      }
    } catch (error) {
      console.error("Auth guard session check failed:", error);
      openLogin();
    }
  }

  // Do not treat Supabase's initial hydration event (which can briefly carry
  // a null session) as a real logout. protectPage checks the restored session
  // after auth.ready has completed.
  supabaseClient.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") openLogin();
  });
  protectPage();
})();
