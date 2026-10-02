(function () {
  "use strict";

  const STORAGE_KEY = "zakichat_disappearing_messages_default";

  const currentTimer = document.getElementById("currentTimer");
  const saveMessage = document.getElementById("saveMessage");
  const timerInputs = document.querySelectorAll(
    'input[name="disappearingTimer"]'
  );

  const db = window.ZakiChatAuth?.client;
  const params = new URLSearchParams(window.location.search);

  let conversationId =
    String(params.get("conversation") || "").trim();

  const targetUserId =
    String(params.get("user") || "").trim();

  const timerValues = {
    "Off": null,
    "24 hours": 86400,
    "7 days": 604800,
    "90 days": 7776000
  };

  const DEFAULT_TIMER = "Off";

  function loadLocalTimer() {
    try {
      const saved =
        localStorage.getItem(STORAGE_KEY);

      return Object.prototype.hasOwnProperty.call(
        timerValues,
        saved
      )
        ? saved
        : DEFAULT_TIMER;
    } catch {
      return DEFAULT_TIMER;
    }
  }

  function updateDisplay(value) {
    if (currentTimer) {
      currentTimer.textContent = value;
    }
  }

  function showSavedMessage(message) {
    if (!saveMessage) return;

    saveMessage.textContent = message;
    saveMessage.hidden = false;

    window.clearTimeout(showSavedMessage.timeout);

    showSavedMessage.timeout =
      window.setTimeout(function () {
        saveMessage.hidden = true;
      }, 1800);
  }

  function setRadio(value) {
    timerInputs.forEach(function (input) {
      input.checked = input.value === value;
    });

    updateDisplay(value);
  }

  async function resolveConversationId() {
    if (!db || conversationId || !targetUserId) {
      return conversationId;
    }

    const {
      data: { user }
    } = await db.auth.getUser();

    if (!user) {
      return "";
    }

    const { data: mine, error: mineError } = await db
      .from("conversation_members")
      .select("conversation_id")
      .eq("user_id", user.id);

    if (mineError || !mine?.length) {
      return "";
    }

    const mineIds = mine.map(row => row.conversation_id);

    const { data: theirs, error: theirsError } = await db
      .from("conversation_members")
      .select("conversation_id")
      .eq("user_id", targetUserId)
      .in("conversation_id", mineIds);

    if (theirsError || !theirs?.length) {
      return "";
    }

    conversationId = theirs[0].conversation_id;

    return conversationId;
  }

  async function loadConversationSetting() {
    await resolveConversationId();

    if (!db || !conversationId) {
      return loadLocalTimer();
    }

    const {
      data: { user }
    } = await db.auth.getUser();

    if (!user) {
      return loadLocalTimer();
    }

    const { data, error } = await db
      .from("conversation_user_settings")
      .select("disappearing_seconds")
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.warn(
        "Unable to load conversation disappearing setting:",
        error
      );
      return loadLocalTimer();
    }

    if (!data) {
      return loadLocalTimer();
    }

    const match = Object.keys(timerValues).find(
      key =>
        timerValues[key] === data.disappearing_seconds
    );

    return match || DEFAULT_TIMER;
  }

  async function saveConversationSetting(value) {
    if (!db || !conversationId) {
      return false;
    }

    const {
      data: { user }
    } = await db.auth.getUser();

    if (!user) {
      return false;
    }

    const { error } = await db
      .from("conversation_user_settings")
      .upsert(
        {
          conversation_id: conversationId,
          user_id: user.id,
          disappearing_seconds: timerValues[value]
        },
        {
          onConflict: "conversation_id,user_id"
        }
      );

    if (error) {
      console.error(
        "Unable to save conversation disappearing setting:",
        error
      );
      return false;
    }

    return true;
  }

  async function setTimer(value) {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        value
      );
    } catch {}

    const savedToDatabase =
      await saveConversationSetting(value);

    setRadio(value);

    showSavedMessage(
      savedToDatabase
        ? "Disappearing-message setting saved."
        : "Default disappearing-message setting saved."
    );
  }

  timerInputs.forEach(function (input) {
    input.addEventListener(
      "change",
      function () {
        if (input.checked) {
          setTimer(input.value);
        }
      }
    );
  });

  (async function init() {
    const initialTimer =
      await loadConversationSetting();

    setRadio(initialTimer);
  })();
})();
