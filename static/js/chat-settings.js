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

  function loadSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return { ...defaults, ...saved };
    } catch (error) {
      console.warn("Unable to load ZakiChat chat settings.", error);
      return { ...defaults };
    }
  }

  function saveSettings(settings) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.warn("Unable to save ZakiChat chat settings.", error);
    }
  }

  let settings = loadSettings();

  function render() {
    elements.enterKeySends.checked = settings.enterKeySends;
    elements.inChatSounds.checked = settings.inChatSounds;
    elements.linkPreviews.checked = settings.linkPreviews;
    elements.mediaVisibility.checked = settings.mediaVisibility;
    elements.messageVibration.checked = settings.messageVibration;
    elements.messageRingtone.value = settings.messageRingtone;
    elements.groupMessageRingtone.value = settings.groupMessageRingtone;
    elements.customRingtoneName.textContent =
      settings.customRingtoneName || "No custom ringtone selected.";
    elements.removeCustomRingtone.hidden = !settings.customRingtoneData;
    elements.disappearingMessagesValue.textContent =
      settings.disappearingMessages;
  }

  function showStatus(message) {
    if (!elements.status) return;

    elements.status.textContent = message;
    elements.status.hidden = false;

    window.clearTimeout(showStatus.timer);
    showStatus.timer = window.setTimeout(function () {
      elements.status.hidden = true;
    }, 1800);
  }

  function bindToggle(element, key) {
    element?.addEventListener("change", function () {
      settings[key] = element.checked;
      saveSettings(settings);
      showStatus("Chat settings saved.");
    });
  }

  elements.disappearingMessagesButton?.addEventListener("click", function () {
    const options = ["Off", "24 hours", "7 days", "90 days"];
    const currentIndex = options.indexOf(settings.disappearingMessages);
    const nextIndex = (currentIndex + 1) % options.length;

    settings.disappearingMessages = options[nextIndex];
    saveSettings(settings);
    render();
    showStatus("Default disappearing-message setting updated.");
  });

  bindToggle(elements.enterKeySends, "enterKeySends");
  bindToggle(elements.inChatSounds, "inChatSounds");
  bindToggle(elements.linkPreviews, "linkPreviews");
  bindToggle(elements.mediaVisibility, "mediaVisibility");
  bindToggle(elements.messageVibration, "messageVibration");

  [elements.messageRingtone, elements.groupMessageRingtone].forEach(function (element) {
    element?.addEventListener("change", function () {
      settings[element.id] = element.value;
      saveSettings(settings);
      showStatus("Chat settings saved.");
    });
  });

  elements.customRingtoneFile?.addEventListener("change", function () {
    const file = this.files && this.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = function () {
      settings.customRingtoneName = file.name;
      settings.customRingtoneData = reader.result;
      settings.messageRingtone = "custom";
      saveSettings(settings);
      render();
      showStatus("Custom ringtone saved.");
    };

    reader.onerror = function () {
      showStatus("Unable to save that audio file.");
    };

    reader.readAsDataURL(file);
  });

  elements.removeCustomRingtone?.addEventListener("click", function () {
    settings.customRingtoneName = "";
    settings.customRingtoneData = "";
    if (settings.messageRingtone === "custom") {
      settings.messageRingtone = "default";
    }
    saveSettings(settings);
    render();
    showStatus("Custom ringtone removed.");
  });

  render();
})();
