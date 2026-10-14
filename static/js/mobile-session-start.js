(function () {
  "use strict";

  // Only change startup routing inside the native Android WebView.
  // The public website must continue to show its normal landing page.
  if (!window.ZakiChatNative || !window.ZakiChatAuth) return;

  const handoffPending = new URLSearchParams(location.search).has("auth_handoff");
  if (handoffPending || location.pathname.toLowerCase().endsWith("/mobile-handoff.html")) return;

  const auth = window.ZakiChatAuth;
  const client = auth.client;
  let routed = false;

  async function openChatsIfSignedIn() {
    if (routed) return;
    try {
      if (auth.ready) await auth.ready;
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      if (data && data.session && data.session.user) {
        routed = true;
        window.location.replace("pages/chats.html");
      }
    } catch (error) {
      // Keep the landing page available if the network/auth service is down.
      console.warn("Molan Chat startup session check could not complete:", error);
    }
  }

  openChatsIfSignedIn();
  client.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN" && session && session.user) {
      openChatsIfSignedIn();
    }
  });
})();
