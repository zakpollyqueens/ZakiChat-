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
    customCallRingtoneName: "",
    customCallRingtoneData: "",
    videoQuality: "auto"
  };

  const controls = {
    lowDataCalls: document.getElementById("lowDataCalls"),
    cameraStartsEnabled: document.getElementById("cameraStartsEnabled"),
    callSounds: document.getElementById("callSounds"),
    allowIncomingCalls: document.getElementById("allowIncomingCalls"),
    callVibration: document.getElementById("callVibration"),
    microphoneStartsEnabled:
      document.getElementById("microphoneStartsEnabled"),
    speakerStartsEnabled:
      document.getElementById("speakerStartsEnabled")
  };

  const callRingtone =
    document.getElementById("callRingtone");

  const videoQuality =
    document.getElementById("videoQuality");

  const customFile =
    document.getElementById("customCallRingtoneFile");

  const customName =
    document.getElementById("customCallRingtoneName");

  const removeButton =
    document.getElementById("removeCustomCallRingtone");

  const testButton =
    document.getElementById("testCallRingtone");

  const message =
    document.getElementById("callSettingsMessage");

  function loadSettings() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);

      if (!saved) {
        return { ...defaults };
      }

      const parsed = JSON.parse(saved);

      return {
        ...defaults,
        ...(parsed && typeof parsed === "object"
          ? parsed
          : {})
      };
    } catch {
      return { ...defaults };
    }
  }

  function saveSettings(settings) {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(settings)
    );
  }

  function showSavedMessage(text) {
    if (!message) return;

    message.textContent =
      text || "Call preference saved.";

    message.hidden = false;

    window.clearTimeout(
      showSavedMessage.timeout
    );

    showSavedMessage.timeout =
      window.setTimeout(function () {
        message.hidden = true;
      }, 1800);
  }

  const settings = loadSettings();

  function renderCustomRingtone() {
    if (customName) {
      customName.textContent =
        settings.customCallRingtoneName ||
        "No custom ringtone selected.";
    }

    if (removeButton) {
      removeButton.hidden =
        !settings.customCallRingtoneData;
    }
  }

  if (callRingtone) {
    callRingtone.value =
      settings.callRingtone;

    callRingtone.addEventListener(
      "change",
      function () {
        settings.callRingtone =
          callRingtone.value;

        saveSettings(settings);

        showSavedMessage(
          "Call ringtone saved."
        );
      }
    );
  }

  if (customFile) {
    customFile.addEventListener(
      "change",
      function () {
        const file =
          this.files && this.files[0];

        if (!file) return;

        if (
          !file.type ||
          !file.type.startsWith("audio/")
        ) {
          showSavedMessage(
            "Please choose an audio file."
          );
          this.value = "";
          return;
        }

        const reader =
          new FileReader();

        reader.onload = function () {
          settings.customCallRingtoneName =
            file.name;

          settings.customCallRingtoneData =
            reader.result;

          settings.callRingtone =
            "custom";

          saveSettings(settings);

          if (callRingtone) {
            callRingtone.value =
              "custom";
          }

          renderCustomRingtone();

          showSavedMessage(
            "Phone ringtone saved."
          );
        };

        reader.onerror = function () {
          showSavedMessage(
            "Unable to read that audio file."
          );
        };

        reader.readAsDataURL(file);
      }
    );
  }

  if (removeButton) {
    removeButton.addEventListener(
      "click",
      function () {
        settings.customCallRingtoneName =
          "";

        settings.customCallRingtoneData =
          "";

        if (
          settings.callRingtone ===
          "custom"
        ) {
          settings.callRingtone =
            "default";
        }

        saveSettings(settings);

        if (callRingtone) {
          callRingtone.value =
            settings.callRingtone;
        }

        renderCustomRingtone();

        if (window.ZakiRingtones) {
          window.ZakiRingtones.stop();
        }

        showSavedMessage(
          "Custom ringtone removed."
        );
      }
    );
  }

  if (testButton) {
    testButton.addEventListener(
      "click",
      async function () {
        if (!window.ZakiRingtones) {
          showSavedMessage(
            "Ringtone engine is unavailable."
          );
          return;
        }

        await window.ZakiRingtones.test();

        showSavedMessage(
          "Playing ringtone."
        );
      }
    );
  }

  if (videoQuality) {
    videoQuality.value =
      settings.videoQuality;

    videoQuality.addEventListener(
      "change",
      function () {
        settings.videoQuality =
          videoQuality.value;

        saveSettings(settings);

        showSavedMessage();
      }
    );
  }

  Object.keys(controls).forEach(
    function (key) {
      const control =
        controls[key];

      if (!control) return;

      control.checked =
        Boolean(settings[key]);

      control.addEventListener(
        "change",
        function () {
          settings[key] =
            control.checked;

          saveSettings(settings);

          showSavedMessage();
        }
      );
    }
  );

  renderCustomRingtone();
})();
