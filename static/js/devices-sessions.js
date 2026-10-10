(function () {
  "use strict";
  const currentDevice = document.getElementById("currentDevice");
  const currentBrowser = document.getElementById("currentBrowser");
  const signOutOtherSessions = document.getElementById("signOutOtherSessions");
  const status = document.getElementById("sessionStatus");
  const otherSessions = document.getElementById("otherSessions");
  const client = window.ZakiChatAuth?.client;

  function detectDevice() {
    const ua = navigator.userAgent || "";
    if (/Android/i.test(ua)) return "Android device";
    if (/iPhone|iPad|iPod/i.test(ua)) return "Apple mobile device";
    if (/Windows/i.test(ua)) return "Windows device";
    if (/Macintosh|Mac OS X/i.test(ua)) return "Mac device";
    if (/Linux/i.test(ua)) return "Linux device";
    return "This device";
  }
  function detectBrowser() {
    const ua = navigator.userAgent || "";
    if (/Edg\//i.test(ua)) return "Microsoft Edge";
    if (/OPR\//i.test(ua)) return "Opera";
    if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) return "Google Chrome";
    if (/Firefox\//i.test(ua)) return "Mozilla Firefox";
    if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) return "Safari";
    return "Current browser session";
  }
  function setStatus(message, error = false) {
    if (!status) return;
    status.textContent = message;
    status.dataset.state = error ? "error" : "success";
  }
  async function loadCurrentSession() {
    if (currentDevice) currentDevice.textContent = detectDevice();
    if (currentBrowser) currentBrowser.textContent = detectBrowser();
    if (!client) {
      setStatus("Secure session service is unavailable. Refresh and try again.", true);
      return;
    }
    const { data, error } = await client.auth.getSession();
    if (error || !data?.session) {
      setStatus("Your session has expired. Sign in again to manage sessions.", true);
      return;
    }
    if (otherSessions) {
      otherSessions.textContent = "Other active sessions are managed by the authentication service. For privacy, this page does not expose their tokens or sensitive device details.";
    }
  }
  async function handleOtherSessions() {
    if (!client) return setStatus("Secure session service is unavailable.", true);
    if (!confirm("Sign out this ZakiChat account from other devices and browsers? This device will remain signed in.")) return;
    signOutOtherSessions.disabled = true;
    const oldText = signOutOtherSessions.textContent;
    signOutOtherSessions.textContent = "Revoking sessions…";
    try {
      const { error } = await client.auth.signOut({ scope: "others" });
      if (error) throw error;
      setStatus("Other sessions have been signed out. This device remains signed in.");
    } catch (error) {
      console.error("Unable to sign out other sessions:", error);
      setStatus(error.message || "Unable to revoke other sessions. Please try again.", true);
    } finally {
      signOutOtherSessions.disabled = false;
      signOutOtherSessions.textContent = oldText;
    }
  }
  signOutOtherSessions?.addEventListener("click", handleOtherSessions);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", loadCurrentSession, { once: true });
  else void loadCurrentSession();
})();
