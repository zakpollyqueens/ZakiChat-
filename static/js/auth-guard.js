(function () {
  "use strict";
  if (!window.supabase || !window.ZakiChatConfig) {
    console.error("Molan Chat auth guard could not start.");
    return;
  }
  const auth = window.ZakiChatAuth;
  const supabaseClient = auth?.client;
  if (!supabaseClient) {
    console.error("Molan Chat auth guard: centralized Supabase client unavailable.");
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
            "Molan Chat user"
        });
      } catch (registryError) {
        console.warn("Could not refresh the saved-account list:", registryError);
      }
    } catch (error) {
      console.error("Auth guard session check failed:", error);
      // A temporary network/storage initialization error is not proof that the
      // user signed out. Keep the current page and offer a retry; only a
      // successful getSession() with no user or an explicit SIGNED_OUT event
      // should send the user to login.
      let panel = document.getElementById("zaki-session-retry");
      if (!panel) {
        panel = document.createElement("section");
        panel.id = "zaki-session-retry";
        panel.setAttribute("role", "alert");
        panel.style.cssText = "position:fixed;z-index:100000;left:16px;right:16px;top:16px;padding:16px;border:1px solid #80dff2;border-radius:16px;background:#0b2035;color:#f4fbff;box-shadow:0 12px 36px #0005;font:14px/1.5 system-ui,sans-serif";
        panel.innerHTML = '<strong>Reconnecting to Molan Chat</strong><p style="margin:6px 0 12px">Your saved sign-in has not been removed. Check your connection and try again.</p><button type="button" style="padding:9px 14px;border:0;border-radius:10px;background:#7cecff;color:#052035;font-weight:700">Retry</button>';
        panel.querySelector("button").addEventListener("click", async () => {
          panel.remove();
          await protectPage();
        });
        document.body.appendChild(panel);
      }
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
