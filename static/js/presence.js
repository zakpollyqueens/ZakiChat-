(function () {
  "use strict";

  if (!window.supabase || !window.ZakiChatConfig) {
    console.error("ZakiChat presence could not start.");
    return;
  }

  const { createClient } = window.supabase;

  const supabaseClient =
    window.ZakiChatAuth?.client ||
    createClient(
      window.ZakiChatConfig.supabaseUrl,
      window.ZakiChatConfig.supabaseKey,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storageKey: "zakichat-auth"
        }
      }
    );

  const HEARTBEAT_INTERVAL = 30000;

  let currentUser = null;
  let heartbeatTimer = null;
  let realtimeChannel = null;
  let started = false;

  function updatePresenceUI(isOnline) {
    const presence =
      document.getElementById("profilePresence");

    if (!presence) return;

    const label =
      presence.querySelector("span");

    presence.classList.toggle(
      "online",
      Boolean(isOnline)
    );

    if (label) {
      label.textContent =
        isOnline ? "Online" : "Offline";
    }
  }

  async function setPresence(isOnline) {
    if (!currentUser) return;

    const payload = {
      is_online: Boolean(isOnline),
      last_seen: new Date().toISOString()
    };

    const { error } =
      await supabaseClient
        .from("profiles")
        .update(payload)
        .eq("id", currentUser.id);

    if (error) {
      console.error(
        "Presence update failed:",
        error
      );

      return false;
    }

    updatePresenceUI(isOnline);

    return true;
  }

  async function markOnline() {
    return setPresence(true);
  }

  async function markOffline() {
    return setPresence(false);
  }

  function startHeartbeat() {
    stopHeartbeat();

    heartbeatTimer = setInterval(
      function () {
        if (
          document.visibilityState ===
          "visible"
        ) {
          markOnline();
        }
      },
      HEARTBEAT_INTERVAL
    );
  }

  function stopHeartbeat() {
    if (!heartbeatTimer) return;

    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }

  function handleVisibilityChange() {
    if (
      document.visibilityState ===
      "visible"
    ) {
      markOnline();
    } else {
      markOffline();
    }
  }

  function handlePageExit() {
    if (!currentUser) return;

    const url =
      window.ZakiChatConfig.supabaseUrl +
      "/rest/v1/profiles?id=eq." +
      encodeURIComponent(currentUser.id);

    const payload = JSON.stringify({
      is_online: false,
      last_seen: new Date().toISOString()
    });

    try {
      if (
        navigator.sendBeacon &&
        window.ZakiChatConfig.supabaseKey
      ) {
        const blob = new Blob(
          [payload],
          {
            type: "application/json"
          }
        );

        const sent =
          navigator.sendBeacon(
            url,
            blob
          );

        if (sent) return;
      }
    } catch (error) {
      console.warn(
        "Presence beacon failed:",
        error
      );
    }

    markOffline();
  }

  function subscribeToPresence() {
    if (!currentUser) return;

    if (realtimeChannel) {
      supabaseClient.removeChannel(
        realtimeChannel
      );
    }

    realtimeChannel =
      supabaseClient
        .channel(
          "zakichat-presence-" +
          currentUser.id
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "profiles",
            filter:
              "id=eq." +
              currentUser.id
          },
          function (payload) {
            if (
              payload.new &&
              typeof payload.new.is_online !==
                "undefined"
            ) {
              updatePresenceUI(
                payload.new.is_online
              );
            }
          }
        )
        .subscribe();
  }

  async function startPresence() {
    if (started) return;

    const {
      data,
      error
    } = await supabaseClient.auth.getSession();

    if (error) {
      console.error(
        "Presence session check failed:",
        error
      );

      return;
    }

    if (
      !data ||
      !data.session ||
      !data.session.user
    ) {
      return;
    }

    currentUser =
      data.session.user;

    started = true;

    await markOnline();

    startHeartbeat();
    subscribeToPresence();

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    window.addEventListener(
      "pagehide",
      handlePageExit
    );

    window.addEventListener(
      "beforeunload",
      handlePageExit
    );
  }

  async function stopPresence() {
    stopHeartbeat();

    document.removeEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    window.removeEventListener(
      "pagehide",
      handlePageExit
    );

    window.removeEventListener(
      "beforeunload",
      handlePageExit
    );

    if (realtimeChannel) {
      await supabaseClient.removeChannel(
        realtimeChannel
      );

      realtimeChannel = null;
    }

    if (currentUser) {
      await markOffline();
    }

    currentUser = null;
    started = false;
  }

  supabaseClient.auth.onAuthStateChange(
    function (event, session) {
      if (event === "SIGNED_IN") {
        startPresence();
      }

      if (event === "SIGNED_OUT") {
        stopPresence();
      }
    }
  );

  window.ZakiChatPresence = Object.freeze({
    start: startPresence,
    stop: stopPresence,
    markOnline: markOnline,
    markOffline: markOffline,
    updateUI: updatePresenceUI
  });

  startPresence();

})();
