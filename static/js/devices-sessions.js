(function () {
  "use strict";

  const currentDevice = document.getElementById("currentDevice");
  const currentBrowser = document.getElementById("currentBrowser");
  const signOutOtherSessions = document.getElementById("signOutOtherSessions");

  function detectDevice() {
    const ua = navigator.userAgent || "";

    if (/Android/i.test(ua)) {
      return "Android device";
    }

    if (/iPhone|iPad|iPod/i.test(ua)) {
      return "Apple mobile device";
    }

    if (/Windows/i.test(ua)) {
      return "Windows device";
    }

    if (/Macintosh|Mac OS X/i.test(ua)) {
      return "Mac device";
    }

    if (/Linux/i.test(ua)) {
      return "Linux device";
    }

    return "This device";
  }

  function detectBrowser() {
    const ua = navigator.userAgent || "";

    if (/Edg\//i.test(ua)) {
      return "Microsoft Edge";
    }

    if (/OPR\//i.test(ua)) {
      return "Opera";
    }

    if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) {
      return "Google Chrome";
    }

    if (/Firefox\//i.test(ua)) {
      return "Mozilla Firefox";
    }

    if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) {
      return "Safari";
    }

    return "Current browser session";
  }

  function loadCurrentSession() {
    if (currentDevice) {
      currentDevice.textContent = detectDevice();
    }

    if (currentBrowser) {
      currentBrowser.textContent = detectBrowser();
    }
  }

  function handleOtherSessions() {
    window.alert(
      "Other-session management will be enabled when ZakiChat server-side device session tracking is connected."
    );
  }

  signOutOtherSessions?.addEventListener(
    "click",
    handleOtherSessions
  );

  loadCurrentSession();
})();
