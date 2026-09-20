(function () {
  "use strict";

  const STORAGE_KEY = "zakichat_call_settings";

  const defaults = {
    lowDataCalls: false,
    cameraStartsEnabled: true,
    callSounds: true,
    allowIncomingCalls: true,
    callVibration: true,
    microphoneStartsEnabled: true,
    speakerStartsEnabled: false,
    callRingtone: "default",
    videoQuality: "auto"
  };

  const controls = {
    lowDataCalls: document.getElementById("lowDataCalls"),
    cameraStartsEnabled: document.getElementById("cameraStartsEnabled"),
    callSounds: document.getElementById("callSounds"),
    allowIncomingCalls: document.getElementById("allowIncomingCalls"),
    callVibration: document.getElementById("callVibration"),
    microphoneStartsEnabled: document.getElementById("microphoneStartsEnabled"),
    speakerStartsEnabled: document.getElementById("speakerStartsEnabled")
  };

  const callRingtone = document.getElementById("callRingtone");
  const videoQuality = document.getElementById("videoQuality");

  const message = document.getElementById("callSettingsMessage");

  function loadSettings() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);

      if (!saved) {
        return { ...defaults };
      }

      const parsed = JSON.parse(saved);

      return {
        ...defaults,
        ...(parsed && typeof parsed === "object" ? parsed : {})
      };
    } catch {
      return { ...defaults };
    }
  }

  function saveSettings(settings) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }

  function showSavedMessage() {
    message.textContent = "Call preference saved.";
    message.hidden = false;

    window.clearTimeout(showSavedMessage.timeout);

    showSavedMessage.timeout = window.setTimeout(function () {
      message.hidden = true;
    }, 1500);
  }

  const settings = loadSettings();

  if (callRingtone) {
    callRingtone.value = settings.callRingtone;
    callRingtone.addEventListener("change", function () {
      settings.callRingtone = callRingtone.value;
      saveSettings(settings);
      showSavedMessage();
    });
  }

  if (videoQuality) {
    videoQuality.value = settings.videoQuality;
    videoQuality.addEventListener("change", function () {
      settings.videoQuality = videoQuality.value;
      saveSettings(settings);
      showSavedMessage();
    });
  }

  Object.keys(controls).forEach(function (key) {
    const control = controls[key];

    if (!control) {
      return;
    }

    control.checked = Boolean(settings[key]);

    control.addEventListener("change", function () {
      settings[key] = control.checked;
      saveSettings(settings);
      showSavedMessage();
    });
  });
})();
