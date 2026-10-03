(() => {
"use strict";

const FN =
  "https://xdpevlurgtvgduwzyoue.supabase.co/functions/v1/two-step";

const form = document.getElementById("adminLoginForm");
const msg = document.getElementById("adminMessage");
const email = document.getElementById("adminEmail");
const passcode = document.getElementById("adminPasscode");
const password = document.getElementById("adminPassword");

if (!form || !window.ZakiChatAuth?.client) return;

const say = (text) => {
  if (msg) msg.textContent = text;
};

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    const e = email.value.trim();
    const pc = passcode.value.trim();
    const pw = password.value;

    if (!e || !pc || !pw) {
      say("Enter your admin email, passcode and password.");
      return;
    }

    say("Signing in...");

    const { data, error } =
      await window.ZakiChatAuth.client.auth.signInWithPassword({
        email: e,
        password: pw
      });

    if (error) throw error;

    const token = data?.session?.access_token;

    if (!token) {
      throw new Error("Authentication session was not created.");
    }

    say("Verifying administrator access...");

    const response = await fetch(FN, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        action: "admin-verify",
        passcode: pc
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
  }
});

})();
