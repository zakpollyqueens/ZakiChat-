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
