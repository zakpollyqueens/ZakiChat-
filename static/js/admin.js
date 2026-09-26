(() => {
"use strict";

const FN =
  "https://xdpevlurgtvgduwzyoue.supabase.co/functions/v1/two-step";

const form = document.getElementById("adminLoginForm");
const msg = document.getElementById("adminMessage");
const email = document.getElementById("adminEmail");
const pass = document.getElementById("adminPassword");

if (!form || !window.ZakiChatAuth?.client) return;

let codeBox = null;

const say = (text) => {
  if (msg) msg.textContent = text;
};

function createCodeBox() {
  if (codeBox) return codeBox;

  codeBox = document.createElement("input");

  codeBox.type = "text";
  codeBox.inputMode = "numeric";
  codeBox.autocomplete = "one-time-code";
  codeBox.pattern = "[0-9]{6}";
  codeBox.maxLength = 6;
  codeBox.placeholder = "6-digit authenticator code";
  codeBox.setAttribute("aria-label", "6-digit authenticator code");
  codeBox.required = true;

  codeBox.style.cssText =
    "width:100%;box-sizing:border-box;margin-top:14px;" +
    "padding:14px;border-radius:14px;" +
    "background:#08101d;color:#fff;" +
    "border:1px solid rgba(0,255,210,.25);" +
    "font-size:16px;outline:none;";

  const button = form.querySelector("button");

  if (button) {
    form.insertBefore(codeBox, button);
  } else {
    form.appendChild(codeBox);
  }

  codeBox.addEventListener("input", () => {
    codeBox.value = codeBox.value.replace(/\D/g, "").slice(0, 6);
  });

  return codeBox;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    say("Signing in...");

    const { data, error } =
      await window.ZakiChatAuth.client.auth.signInWithPassword({
        email: email.value.trim(),
        password: pass.value
      });

    if (error) throw error;

    if (!data?.session?.access_token) {
      throw new Error("Authentication session was not created.");
    }

    const box = createCodeBox();
    const code = box.value.trim();

    if (!/^\d{6}$/.test(code)) {
      say("Enter the 6-digit authenticator code.");
      box.focus();
      return;
    }

    say("Verifying administrator authenticator code...");

    const response = await fetch(FN, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${data.session.access_token}`
      },
      body: JSON.stringify({
        action: "admin-verify",
        code
      })
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.adminSessionToken) {
      throw new Error(
        result.error || "Administrator verification failed."
      );
    }

    sessionStorage.setItem(
      "zakichat-admin-session",
      result.adminSessionToken
    );

    sessionStorage.setItem(
      "zakichat-admin-role",
      result.role || ""
    );

    sessionStorage.setItem(
      "zakichat-admin-expiry",
      result.expiresAt || ""
    );

    location.href = "admin-control.html";

  } catch (error) {
    say(error?.message || "Admin sign-in failed.");

    if (codeBox) {
      codeBox.value = "";
    }
  }
});

})();
