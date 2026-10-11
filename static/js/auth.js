(function () {
  "use strict";
  if (!window.ZakiChatAuth?.client || !window.ZakiChatConfig) {
    console.error("ZakiChat authentication could not start.");
    return;
  }
  const client = window.ZakiChatAuth.client;
  const page = location.pathname.toLowerCase();
  const isLogin = page.endsWith("/login.html");
  const isSignup = page.endsWith("/signup.html");
  const PAYMENT_URL = "https://xdpevlurgtvgduwzyoue.supabase.co/functions/v1/registration-payment";
  const PENDING_UPGRADE_KEY = "zakichat_pending_upgrade";
  const PENDING_REGISTRATION_KEY = "zakichat_pending_email_registration";

  function message(el, text, type) {
    if (!el) return;
    el.textContent = text;
    el.className = "auth-message" + (type ? " " + type : "");
  }
  function loading(button, yes, label) {
    if (!button) return;
    button.disabled = yes;
    button.textContent = yes ? "Please wait..." : label;
  }
  function chats() { location.replace("chats.html"); }
  function emailRedirect() { return new URL("auth-callback.html", location.href).href; }
  function resetRedirect() { return new URL("reset-password.html", location.href).href; }
  function togglePassword(buttonId, inputId) {
    const b = document.getElementById(buttonId), input = document.getElementById(inputId);
    if (!b || !input) return;
    b.addEventListener("click", () => {
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      b.textContent = show ? "Hide" : "Show";
      b.setAttribute("aria-label", show ? "Hide password" : "Show password");
    });
  }
  function validEmail(input) {
    const value = (input?.value || "").trim().toLowerCase();
    if (!value || !input.checkValidity()) throw new Error("Enter a valid email address.");
    return value;
  }
  async function currentSession() {
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    return data.session;
  }
  async function redirectIfSignedIn() {
    try {
      const session = await currentSession();
      if (session?.user?.email && session.user.email_confirmed_at) chats();
    } catch (e) { console.warn("Could not check existing session:", e); }
  }

  async function login(event) {
    event.preventDefault();
    const form = event.currentTarget, status = document.getElementById("loginMessage");
    const button = form.querySelector('button[type="submit"]');
    let email;
    try { email = validEmail(document.getElementById("email")); }
    catch (e) { message(status, e.message, "error"); return; }
    const password = document.getElementById("password").value;
    if (!password) { message(status, "Enter your password.", "error"); return; }
    loading(button, true, "Sign In");
    try {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data.session || !data.user?.email_confirmed_at) {
        await client.auth.signOut({ scope: "local" });
        throw new Error("Please verify your email using the link we sent before signing in.");
      }
      await window.ZakiChatAccounts?.registerCurrentSession(client, {
        email: data.user.email,
        displayName: data.user.user_metadata?.display_name || data.user.user_metadata?.full_name || data.user.email
      });
      message(status, "Signed in successfully. Opening your chats…", "success");
      setTimeout(chats, 250);
    } catch (e) {
      message(status, e.message || "Unable to sign in. Check your email and password.", "error");
      loading(button, false, "Sign In");
    }
  }

  function setupPhone() {
    const input = document.getElementById("phone");
    if (!input || !window.intlTelInput) return null;
    return window.intlTelInput(input, {
      initialCountry: "ug", separateDialCode: true, nationalMode: true,
      autoPlaceholder: "polite", formatOnDisplay: true,
      loadUtils: () => import("https://cdn.jsdelivr.net/npm/intl-tel-input@25.12.4/build/js/utils.js")
    });
  }

  function setupSignup() {
    redirectIfSignedIn();
    const phoneWidget = setupPhone();
    const state = { step: 1, username: "", fullName: "", phone: "", location: "", email: "" };
    const steps = Array.from(document.querySelectorAll(".signup-step"));
    const status = document.getElementById("signupMessage");
    const showStep = n => {
      state.step = Math.max(1, Math.min(4, n));
      steps.forEach(s => { const active = Number(s.dataset.step) === state.step; s.hidden = !active; s.classList.toggle("active", active); });
      const percent = Math.round(state.step / 4 * 100);
      const bar = document.getElementById("signupProgressBar");
      const label = document.getElementById("signupStepLabel");
      const pct = document.getElementById("signupStepPercent");
      if (bar) bar.style.width = percent + "%";
      if (label) label.textContent = "Step " + state.step + " of 4";
      if (pct) pct.textContent = percent + "%";
      message(status, "", "");
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    const nextButtons = document.querySelectorAll(".next-step");
    nextButtons.forEach(b => b.addEventListener("click", () => {
      try {
        if (state.step === 1) {
          const u = document.getElementById("username").value.trim().toLowerCase();
          if (!/^[a-z0-9_.]{3,30}$/.test(u)) throw new Error("Username must be 3–30 characters: letters, numbers, dots or underscores.");
          state.username = u;
        } else if (state.step === 2) {
          state.fullName = document.getElementById("displayName").value.trim();
          state.location = document.getElementById("location").value.trim();
          const phoneInput = document.getElementById("phone");
          state.phone = phoneWidget?.isValidNumber() ? phoneWidget.getNumber() : "";
          if (state.fullName.length < 2) throw new Error("Enter your full name.");
          if (!state.phone) { phoneInput.focus(); throw new Error("Enter a valid mobile number with its country selected."); }
          if (!state.location) throw new Error("Enter your general location.");
        } else if (state.step === 3) {
          state.email = validEmail(document.getElementById("email"));
        }
        showStep(state.step + 1);
      } catch (e) { message(status, e.message, "error"); }
    }));
    document.querySelectorAll(".previous-step").forEach(b => b.addEventListener("click", () => showStep(state.step - 1)));
    document.getElementById("signupForm")?.addEventListener("submit", async event => {
      event.preventDefault();
      if (state.step !== 4) return;
      const password = document.getElementById("password").value;
      const confirm = document.getElementById("confirmPassword").value;
      if (password.length < 8) { message(status, "Password must contain at least 8 characters.", "error"); return; }
      if (password !== confirm) { message(status, "The passwords do not match.", "error"); return; }
      if (!document.getElementById("terms").checked) { message(status, "Please agree to the Terms of Service and Privacy Policy.", "error"); return; }
      const button = event.currentTarget.querySelector('button[type="submit"]');
      loading(button, true, "Create Account");
      try {
        const cfg = window.ZakiChatConfig;
        const preflight = await fetch(PAYMENT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: cfg.supabaseKey, Authorization: "Bearer " + cfg.supabaseKey },
          body: JSON.stringify({ action: "preflight", phone: state.phone })
        });
        const fee = await preflight.json().catch(() => ({}));
        if (!preflight.ok || fee.success !== true) throw new Error(fee.error || "Could not verify your registration fee.");
        if (fee.paymentRequired) {
          const estimate = window.ZakiChatCurrency ? " (approximately " + window.ZakiChatCurrency.formatUsd(Number(fee.feeUsd), fee.countryCode) + ")" : "";
          throw new Error("A one-time registration fee of $" + Number(fee.feeUsd).toFixed(2) + " USD" + estimate + " is required for your country. Account creation is paused until payment is verified; automatic checkout is not configured yet.");
        }
        localStorage.setItem(PENDING_REGISTRATION_KEY, JSON.stringify({
          phone: state.phone, paymentId: fee.paidRegistrationPaymentId || null,
          username: state.username, displayName: state.fullName, location: state.location,
          email: state.email, createdAt: Date.now()
        }));
        const { data, error } = await client.auth.signUp({
          email: state.email, password,
          options: {
            emailRedirectTo: emailRedirect(),
            data: { username: state.username, full_name: state.fullName, display_name: state.fullName, phone: state.phone, location: state.location, recovery_email: state.email }
          }
        });
        if (error) throw error;
        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          throw new Error("An account already exists for this email. Sign in or use Reset password by email.");
        }
        if (data.session && data.user?.email_confirmed_at) {
          await window.ZakiChatAccounts?.registerCurrentSession(client, { email: state.email, displayName: state.fullName, phone: state.phone });
          message(status, "Your account is verified. Opening ZakiChat…", "success");
          setTimeout(chats, 350);
          return;
        }
        message(status, "Your account details have been submitted. We sent a verification link to " + state.email + ". Open that email and tap Verify My Account, then return to ZakiChat. Your account will open after verification.", "success");
        event.currentTarget.querySelectorAll("input,button").forEach(el => { if (el.type !== "button") el.disabled = true; });
      } catch (e) {
        localStorage.removeItem(PENDING_REGISTRATION_KEY);
        message(status, e.message || "Unable to create your account. Please try again.", "error");
      } finally { loading(button, false, "Create Account"); }
    });
    togglePassword("togglePassword", "password");
    togglePassword("toggleConfirmPassword", "confirmPassword");
    const showcase = document.querySelectorAll("[data-account-slide]");
    const dots = document.querySelectorAll("[data-plan-slide-to]");
    let active = 0;
    const showPlan = i => {
      if (!showcase.length) return;
      active = (i + showcase.length) % showcase.length;
      showcase.forEach((s, j) => { s.hidden = j !== active; s.classList.toggle("is-active", j === active); });
      dots.forEach((d, j) => d.classList.toggle("is-active", j === active));
    };
    document.getElementById("accountPlanPrevious")?.addEventListener("click", () => showPlan(active - 1));
    document.getElementById("accountPlanNext")?.addEventListener("click", () => showPlan(active + 1));
    dots.forEach(d => d.addEventListener("click", () => showPlan(Number(d.dataset.planSlideTo) || 0)));
  }

  function setupForgotPassword() {
    const link = document.getElementById("forgotPassword");
    if (!link) return;
    link.addEventListener("click", async event => {
      event.preventDefault();
      const status = document.getElementById("loginMessage");
      let email;
      try { email = validEmail(document.getElementById("email")); }
      catch (e) { message(status, "Enter your recovery email in the email field first.", "error"); document.getElementById("email")?.focus(); return; }
      link.setAttribute("aria-disabled", "true");
      try {
        const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: resetRedirect() });
        if (error) throw error;
        message(status, "If an account exists for that email, a password-reset link has been sent. Open it to choose a new password.", "success");
      } catch (e) { message(status, e.message || "Unable to request a password reset.", "error"); }
      finally { link.removeAttribute("aria-disabled"); }
    });
  }

  async function setupResetPassword() {
    const form = document.getElementById("resetPasswordForm");
    if (!form) return;
    const status = document.getElementById("resetPasswordMessage");
    const { data } = await client.auth.getSession();
    if (!data.session) message(status, "Open the password-reset link from your email on this device to continue.", "error");
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const password = document.getElementById("newPassword").value;
      const confirm = document.getElementById("confirmNewPassword").value;
      if (password.length < 8) { message(status, "Password must contain at least 8 characters.", "error"); return; }
      if (password !== confirm) { message(status, "The passwords do not match.", "error"); return; }
      const button = form.querySelector('button[type="submit"]');
      loading(button, true, "Save New Password");
      try {
        const { error } = await client.auth.updateUser({ password });
        if (error) throw error;
        message(status, "Password updated successfully. You can now open ZakiChat.", "success");
        setTimeout(chats, 700);
      } catch (e) { message(status, e.message || "Could not update the password.", "error"); }
      finally { loading(button, false, "Save New Password"); }
    });
  }

  client.auth.onAuthStateChange((event, session) => {
    if (session && (event === "PASSWORD_RECOVERY")) {
      document.getElementById("resetPasswordForm")?.scrollIntoView({ behavior: "smooth" });
    }
  });
  if (isLogin) {
    redirectIfSignedIn();
    document.getElementById("loginForm")?.addEventListener("submit", login);
    setupForgotPassword();
    togglePassword("togglePassword", "password");
  }
  if (isSignup) setupSignup();
  if (page.endsWith("/reset-password.html")) setupResetPassword();
})();