(function () {
  "use strict";

  if (!window.supabase || !window.ZakiChatConfig) {
    console.error("ZakiChat auth guard could not start.");
    return;
  }

  const supabaseClient =
    window.ZakiChatAuth?.client;

  if (!supabaseClient) {
    console.error(
      "ZakiChat auth guard: centralized Supabase client unavailable."
    );
    return;
  }

  // Load the shared app-lock layer on every page protected by this guard.
  // The lock overlay persists across navigation and refreshes.
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

  async function protectPage() {
    const { data, error } =
      await supabaseClient.auth.getSession();

    if (error) {
      console.error("Auth guard session check failed:", error);
      window.location.replace("login.html");
      return;
    }

    if (!data.session) {
      window.location.replace("login.html");
    }
  }

  supabaseClient.auth.onAuthStateChange(function (event, session) {
    if (event === "SIGNED_OUT" || !session) {
      window.location.replace("login.html");
    }
  });

  protectPage();
})();
