(function () {
  "use strict";

  const STORAGE_KEY = "zakichat_chat_settings";

  const defaults = {
    enterKeySends: false,
    inChatSounds: true,
    linkPreviews: true,
    mediaVisibility: true,
    messageVibration: true,
    messageRingtone: "default",
    groupMessageRingtone: "default",
    customRingtoneName: "",
    customRingtoneData: "",
    disappearingMessages: "Off"
  };

  const elements = {
    enterKeySends: document.getElementById("enterKeySends"),
    inChatSounds: document.getElementById("inChatSounds"),
    linkPreviews: document.getElementById("linkPreviews"),
    mediaVisibility: document.getElementById("mediaVisibility"),
    messageVibration: document.getElementById("messageVibration"),
    messageRingtone: document.getElementById("messageRingtone"),
    groupMessageRingtone: document.getElementById("groupMessageRingtone"),
    customRingtoneFile: document.getElementById("customRingtoneFile"),
    customRingtoneName: document.getElementById("customRingtoneName"),
    removeCustomRingtone: document.getElementById("removeCustomRingtone"),
    disappearingMessagesButton:
      document.getElementById("disappearingMessagesButton"),
    disappearingMessagesValue:
      document.getElementById("disappearingMessagesValue"),
    status: document.getElementById("chatSettingsStatus")
  };

  const db =
    window.ZakiChatAuth?.client || null;

  let currentUser = null;
  let conversationId = null;
  let settings = loadLocalSettings();

  function loadLocalSettings() {
    try {
      const saved = JSON.parse(
        localStorage.getItem(STORAGE_KEY) || "{}"
      );

      return {
        ...defaults,
        ...saved
      };
    } catch (error) {
      console.warn(
        "Unable to load local ZakiChat chat settings.",
        error
      );

      return {
        ...defaults
      };
    }
  }

  function saveLocalSettings() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(settings)
      );
    } catch (error) {
      console.warn(
        "Unable to save local ZakiChat chat settings.",
        error
      );
    }
  }

  function getTargetUserId() {
    return String(
      new URLSearchParams(
        window.location.search
      ).get("user") || ""
    ).trim();
  }

  async function resolveConversation() {
    if (!db || !currentUser) {
      return null;
    }

    const explicitConversation =
      String(
        new URLSearchParams(
          window.location.search
        ).get("conversation") || ""
      ).trim();

    if (explicitConversation) {
      return explicitConversation;
    }

    const targetUserId =
      getTargetUserId();

    if (!targetUserId) {
      return null;
    }

    const { data: mine, error: mineError } =
      await db
        .from("conversation_members")
        .select("conversation_id")
        .eq(
          "user_id",
          currentUser.id
        );

    if (mineError || !mine?.length) {
      return null;
    }

    const ids =
      mine.map(row => row.conversation_id);

    const { data: theirs, error: theirsError } =
      await db
        .from("conversation_members")
        .select("conversation_id")
        .eq(
          "user_id",
          targetUserId
        )
        .in(
          "conversation_id",
          ids
        );

    if (theirsError || !theirs?.length) {
      return null;
    }

    return theirs[0].conversation_id;
  }

  async function loadRemoteSettings() {
    if (!db || !currentUser) {
      return;
    }

    conversationId =
      await resolveConversation();

    if (!conversationId) {
      return;
    }

    const { data, error } =
      await db
        .from("conversation_user_settings")
        .select(
          "notifications_enabled, disappearing_seconds"
        )
        .eq(
          "conversation_id",
          conversationId
        )
        .eq(
          "user_id",
          currentUser.id
        )
        .maybeSingle();

    if (error) {
      console.warn(
        "Unable to load conversation settings.",
        error
      );
      return;
    }

    if (!data) {
      return;
    }

    settings.notificationsEnabled =
      data.notifications_enabled !== false;

    settings.disappearingMessages =
      secondsToLabel(
        data.disappearing_seconds
      );
  }

  function secondsToLabel(seconds) {
    switch (Number(seconds)) {
      case 86400:
        return "24 hours";
      case 604800:
        return "7 days";
      case 7776000:
        return "90 days";
      default:
        return "Off";
    }
  }

  function labelToSeconds(label) {
    switch (label) {
      case "24 hours":
        return 86400;
      case "7 days":
        return 604800;
      case "90 days":
        return 7776000;
      default:
        return null;
    }
  }

  async function saveRemoteSettings() {
    if (
      !db ||
      !currentUser ||
      !conversationId
    ) {
      return;
    }

    const payload = {
      conversation_id: conversationId,
      user_id: currentUser.id,
      notifications_enabled:
        settings.notificationsEnabled !== false,
      disappearing_seconds:
        labelToSeconds(
          settings.disappearingMessages
        )
    };

    const { error } =
      await db
        .from("conversation_user_settings")
        .upsert(
          payload,
          {
            onConflict:
              "conversation_id,user_id"
          }
        );

    if (error) {
      console.warn(
        "Unable to save conversation settings.",
        error
      );
    }
  }

  function render() {
    if (elements.enterKeySends) {
      elements.enterKeySends.checked =
        settings.enterKeySends;
    }

    if (elements.inChatSounds) {
      elements.inChatSounds.checked =
        settings.inChatSounds;
    }

    if (elements.linkPreviews) {
      elements.linkPreviews.checked =
        settings.linkPreviews;
    }

    if (elements.mediaVisibility) {
      elements.mediaVisibility.checked =
        settings.mediaVisibility;
    }

    if (elements.messageVibration) {
      elements.messageVibration.checked =
        settings.messageVibration;
    }

    if (elements.messageRingtone) {
      elements.messageRingtone.value =
        settings.messageRingtone;
    }

    if (elements.groupMessageRingtone) {
      elements.groupMessageRingtone.value =
        settings.groupMessageRingtone;
    }

    if (elements.customRingtoneName) {
      elements.customRingtoneName.textContent =
        settings.customRingtoneName ||
        "No custom ringtone selected.";
    }

    if (elements.removeCustomRingtone) {
      elements.removeCustomRingtone.hidden =
        !settings.customRingtoneData;
    }

    if (elements.disappearingMessagesValue) {
      elements.disappearingMessagesValue.textContent =
        settings.disappearingMessages;
    }
  }

  function showStatus(message) {
    if (!elements.status) return;

    elements.status.textContent =
      message;

    elements.status.hidden = false;

    window.clearTimeout(
      showStatus.timer
    );

    showStatus.timer =
      window.setTimeout(
        function () {
          elements.status.hidden = true;
        },
        1800
      );
  }

  function addNotificationsControl() {
    const group =
      elements.disappearingMessagesButton
        ?.closest(".chat-settings-group");

    if (!group ||
        document.getElementById(
          "chatNotificationsEnabled"
        )) {
      return;
    }

    const label =
      document.createElement("label");

    label.className =
      "chat-setting-item";

    label.innerHTML = `
      <span class="chat-setting-icon">🔔</span>
      <span class="chat-setting-copy">
        <strong>Notifications</strong>
        <small>Allow notifications from this conversation.</small>
      </span>
      <input
        type="checkbox"
        id="chatNotificationsEnabled"
        class="chat-setting-toggle"
      >
    `;

    group.insertBefore(
      label,
      elements.disappearingMessagesButton
    );

    const toggle =
      label.querySelector(
        "#chatNotificationsEnabled"
      );

    toggle.checked =
      settings.notificationsEnabled !== false;

    toggle.addEventListener(
      "change",
      async function () {
        settings.notificationsEnabled =
          toggle.checked;

        saveLocalSettings();
        await saveRemoteSettings();

        showStatus(
          toggle.checked
            ? "Chat notifications enabled."
            : "Chat notifications muted."
        );
      }
    );
  }

  function bindToggle(element, key) {
    element?.addEventListener(
      "change",
      function () {
        settings[key] =
          element.checked;

        saveLocalSettings();

        showStatus(
          "Chat settings saved."
        );
      }
    );
  }

  elements.disappearingMessagesButton?.addEventListener(
    "click",
    async function () {
      const options = [
        "Off",
        "24 hours",
        "7 days",
        "90 days"
      ];

      const currentIndex =
        options.indexOf(
          settings.disappearingMessages
        );

      const nextIndex =
        (currentIndex + 1) %
        options.length;

      settings.disappearingMessages =
        options[nextIndex];

      saveLocalSettings();

      await saveRemoteSettings();

      render();

      showStatus(
        "Disappearing-message setting updated."
      );
    }
  );

  bindToggle(
    elements.enterKeySends,
    "enterKeySends"
  );

  bindToggle(
    elements.inChatSounds,
    "inChatSounds"
  );

  bindToggle(
    elements.linkPreviews,
    "linkPreviews"
  );

  bindToggle(
    elements.mediaVisibility,
    "mediaVisibility"
  );

  bindToggle(
    elements.messageVibration,
    "messageVibration"
  );

  [
    elements.messageRingtone,
    elements.groupMessageRingtone
  ].forEach(function (element) {
    element?.addEventListener(
      "change",
      function () {
        settings[element.id] =
          element.value;

        saveLocalSettings();

        showStatus(
          "Chat settings saved."
        );
      }
    );
  });

  elements.customRingtoneFile?.addEventListener(
    "change",
    function () {
      const file =
        this.files &&
        this.files[0];

      if (!file) return;

      const reader =
        new FileReader();

      reader.onload =
        function () {
          settings.customRingtoneName =
            file.name;

          settings.customRingtoneData =
            reader.result;

          settings.messageRingtone =
            "custom";

          saveLocalSettings();

          render();

          showStatus(
            "Custom ringtone saved."
          );
        };

      reader.onerror =
        function () {
          showStatus(
            "Unable to save that audio file."
          );
        };

      reader.readAsDataURL(file);
    }
  );

  elements.removeCustomRingtone?.addEventListener(
    "click",
    function () {
      settings.customRingtoneName =
        "";

      settings.customRingtoneData =
        "";

      if (
        settings.messageRingtone ===
        "custom"
      ) {
        settings.messageRingtone =
          "default";
      }

      saveLocalSettings();

      render();

      showStatus(
        "Custom ringtone removed."
      );
    }
  );

  async function init() {
    if (db) {
      const { data } =
        await db.auth.getUser();

      currentUser =
        data?.user || null;

      if (currentUser) {
        await loadRemoteSettings();
      }
    }

    settings.notificationsEnabled =
      settings.notificationsEnabled !== false;

    addNotificationsControl();
    render();
  }

  init();
})();
