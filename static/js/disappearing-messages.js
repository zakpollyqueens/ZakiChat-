(function () {
  "use strict";

  const STORAGE_KEY = "zakichat_disappearing_messages_default";

  const currentTimer = document.getElementById("currentTimer");
  const saveMessage = document.getElementById("saveMessage");
  const timerInputs = document.querySelectorAll(
    'input[name="disappearingTimer"]'
  );

  const DEFAULT_TIMER = "Off";

  function loadTimer() {
    const saved = localStorage.getItem(STORAGE_KEY);

    const validTimers = [
      "Off",
      "24 hours",
      "7 days",
      "90 days"
    ];

    return validTimers.includes(saved) ? saved : DEFAULT_TIMER;
  }

  function updateDisplay(value) {
    currentTimer.textContent = value;
  }

  function showSavedMessage() {
    saveMessage.textContent = "Default disappearing-message timer saved.";
    saveMessage.hidden = false;

    window.clearTimeout(showSavedMessage.timeout);

    showSavedMessage.timeout = window.setTimeout(function () {
      saveMessage.hidden = true;
    }, 1800);
  }

  function setTimer(value) {
    localStorage.setItem(STORAGE_KEY, value);
    updateDisplay(value);
    showSavedMessage();

    /*
     * This setting is currently stored locally.
     * Actual disappearing-message enforcement will be handled by
     * the chat/message backend when that functionality is connected.
     */
  }

  const initialTimer = loadTimer();

  timerInputs.forEach(function (input) {
    input.checked = input.value === initialTimer;

    input.addEventListener("change", function () {
      if (input.checked) {
        setTimer(input.value);
      }
    });
  });

  updateDisplay(initialTimer);
})();
