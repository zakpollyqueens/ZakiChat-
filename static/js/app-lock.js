(() => {
  "use strict";
  const PASS_KEY = "zakichat_app_lock_pass_v1";
  const LOCK_KEY = "zakichat_app_locked_v1";
  const OVERLAY_ID = "zakichat-lock-screen";
  const ICON_LOCKED = "🔒";
  const ICON_OPEN = "🔓";

  const enc = new TextEncoder();
  const toHex = bytes => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, "0")).join("");
  async function hashPasscode(passcode, salt) {
    if (!crypto?.subtle) throw new Error("Secure passcode storage requires HTTPS or a secure browser context.");
    const material = await crypto.subtle.importKey("raw", enc.encode(passcode), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({name:"PBKDF2", salt:enc.encode(salt), iterations:150000, hash:"SHA-256"}, material, 256);
    return toHex(bits);
  }
  function getPass() {
    try { return JSON.parse(localStorage.getItem(PASS_KEY) || "null"); } catch (_) { return null; }
  }
  function setLocked(value) { localStorage.setItem(LOCK_KEY, value ? "1" : "0"); }
  function isLocked() { return localStorage.getItem(LOCK_KEY) === "1"; }
  function iconButton() {
    return document.querySelector("[data-zaki-app-lock]");
  }
  function syncButton() {
    const button = iconButton();
    if (!button) return;
    const locked = isLocked();
    button.textContent = locked ? ICON_LOCKED : ICON_OPEN;
    button.setAttribute("aria-label", locked ? "Unlock Zamivox" : "Lock Zamivox");
    button.title = locked ? "Unlock app" : "Lock app";
    button.setAttribute("aria-pressed", locked ? "true" : "false");
  }
  function ensureOverlay() {
    let overlay = document.getElementById(OVERLAY_ID);
    if (overlay) return overlay;
    overlay = document.createElement("section");
    overlay.id = OVERLAY_ID;
    overlay.className = "zaki-lock-screen";
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="zaki-lock-card" role="dialog" aria-modal="true" aria-labelledby="zaki-lock-title">
        <div class="zaki-lock-mark" aria-hidden="true">🔒</div>
        <h1 id="zaki-lock-title">Zamivox is locked</h1>
        <p id="zaki-lock-message">Enter your app passcode to continue.</p>
        <form id="zaki-lock-form" autocomplete="off">
          <label for="zaki-lock-passcode">Passcode</label>
          <input id="zaki-lock-passcode" name="passcode" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="12" autocomplete="current-password" required>
          <button type="submit" id="zaki-lock-submit">Unlock</button>
          <p id="zaki-lock-error" role="alert" aria-live="polite"></p>
        </form>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector("#zaki-lock-form").addEventListener("submit", async event => {
      event.preventDefault();
      const input = overlay.querySelector("#zaki-lock-passcode");
      const error = overlay.querySelector("#zaki-lock-error");
      const pass = getPass();
      const value = input.value.trim();
      error.textContent = "";
      if (!pass) { showSetup(); return; }
      if (!/^\d{4,12}$/.test(value)) { error.textContent = "Enter your 4–12 digit passcode."; return; }
      const submit = overlay.querySelector("#zaki-lock-submit");
      submit.disabled = true;
      try {
        const actual = await hashPasscode(value, pass.salt);
        if (actual !== pass.hash) {
          error.textContent = "Incorrect passcode. Try again.";
          input.value = "";
          input.focus();
          return;
        }
        setLocked(false);
        overlay.hidden = true;
        document.body.classList.remove("zaki-app-is-locked");
        syncButton();
      } catch (e) {
        error.textContent = e.message || "Could not verify passcode.";
      } finally { submit.disabled = false; }
    });

    return overlay;
  }
  function showLocked() {
    const overlay = ensureOverlay();
    overlay.hidden = false;
    document.body.classList.add("zaki-app-is-locked");
    syncButton();
    setTimeout(() => overlay.querySelector("#zaki-lock-passcode")?.focus(), 80);
  }
  async function showSetup() {
    const first = prompt("Create a 4–12 digit Zamivox app passcode. Keep it private.");
    if (first === null) return;
    if (!/^\d{4,12}$/.test(first)) { alert("Choose a passcode containing 4–12 digits."); return; }
    const second = prompt("Enter the same passcode again to confirm.");
    if (second === null) return;
    if (first !== second) { alert("The passcodes do not match. Please try again."); return; }
    try {
      const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
      const hash = await hashPasscode(first, salt);
      localStorage.setItem(PASS_KEY, JSON.stringify({salt, hash, version:1}));
      alert("App passcode created. Tap the lock icon any time to lock Zamivox.");
      syncButton();
    } catch (e) { alert(e.message || "Unable to set up app lock."); }
  }
  async function toggleLock() {
    if (isLocked()) { showLocked(); return; }
    if (!getPass()) { await showSetup(); return; }
    setLocked(true);
    showLocked();
  }
  function init() {
    ensureOverlay();
    iconButton()?.addEventListener("click", toggleLock);
    syncButton();
    if (isLocked()) showLocked();
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && isLocked()) showLocked();
    });
    window.addEventListener("pageshow", () => { if (isLocked()) showLocked(); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, {once:true});
  else init();
})();