(function () {
  "use strict";

  const STORAGE_KEY = "zakichat_chat_settings";

  const defaults = {
    enterKeySends: false,
    inChatSounds: true,
    linkPreviews: true,
    mediaVisibility: true,
    disappearingMessages: "Off"
  };

  const elements = {
    enterKeySends: document.getElementById("enterKeySends"),
    inChatSounds: document.getElementById("inChatSounds"),
    linkPreviews: document.getElementById("linkPreviews"),
    mediaVisibility: document.getElementById("mediaVisibility"),
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

  render();
})();
