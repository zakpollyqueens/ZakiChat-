(function () {
  "use strict";

  const REGISTRATION_PAYMENT_URL =
    "https://xdpevlurgtvgduwzyoue.supabase.co/functions/v1/registration-payment";

  if (!window.supabase || !window.ZakiChatConfig) {
    console.error("ZakiChat authentication could not start.");
    return;
  }

  const supabaseClient =
    window.ZakiChatAuth?.client;

  if (!supabaseClient) {
    console.error(
      "ZakiChat authentication client is unavailable."
    );
    return;
  }

  const page = window.location.pathname.toLowerCase();
  const isLoginPage = page.endsWith("/login.html");
  const isSignupPage = page.endsWith("/signup.html");

  const redirectToChats = () => {
    window.location.href = "chats.html";
  };

  function showMessage(element, message, type) {
    if (!element) return;

    element.textContent = message;
    element.className = "auth-message";

    if (type) {
      element.classList.add(type);
    }
  }

  function setLoading(button, loading, normalText) {
    if (!button) return;

    button.disabled = loading;
    button.textContent = loading ? "Please wait..." : normalText;
  }

  /* INTERNATIONAL PHONE INPUT */
  let authPhoneInput = null;
  let passwordResetInProgress = false;

  function setupInternationalPhoneInput() {
    const input = document.getElementById("phone");

    if (!input || !window.intlTelInput) {
      return;
    }

    authPhoneInput = window.intlTelInput(input, {
      initialCountry: "ug",
      separateDialCode: true,
      nationalMode: true,
      autoPlaceholder: "polite",
      formatOnDisplay: true,
      loadUtils: () =>
        import(
          "https://cdn.jsdelivr.net/npm/intl-tel-input@25.12.4/build/js/utils.js"
        )
    });

    input.addEventListener("blur", function () {
      if (
        authPhoneInput &&
        input.value.trim() &&
        authPhoneInput.isValidNumber()
      ) {
        input.classList.remove("input-error");
      }
    });
  }

  function getPhoneE164() {
    if (!authPhoneInput) {
      return "";
    }

    if (!authPhoneInput.isValidNumber()) {
      return "";
    }

    return authPhoneInput.getNumber();
  }

  function setupPasswordToggle(buttonId, inputId) {
    const button = document.getElementById(buttonId);
    const input = document.getElementById(inputId);

    if (!button || !input) return;

    button.addEventListener("click", function () {
      const showing = input.type === "text";

      input.type = showing ? "password" : "text";
      button.textContent = showing ? "Show" : "Hide";
      button.setAttribute(
        "aria-label",
        showing ? "Show password" : "Hide password"
      );
    });
  }

  async function getCurrentSession() {
    const { data, error } =
      await supabaseClient.auth.getSession();

    if (error) {
      console.error("Session check failed:", error);
      return null;
    }

    return data?.session || null;
  }

  async function redirectIfAlreadySignedIn() {
    const session = await getCurrentSession();

    if (session) {
      redirectToChats();
    }
  }

  /* =======================================================
     LOGIN
     ======================================================= */

  async function handleLogin(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const phone = getPhoneE164();
    const password = document.getElementById("password").value;
    const message = document.getElementById("loginMessage");
    const button = form.querySelector('button[type="submit"]');
    showMessage(message, "", "");

    if (!phone || !password) {
      showMessage(message, "Enter a valid phone number and your password.", "error");
      document.getElementById("phone")?.focus();
      return;
    }

    setLoading(button, true, "Sign In");
    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({ phone, password });
      if (error) throw error;
      if (!data.session) throw new Error("Sign-in succeeded, but no session was created.");
      showMessage(message, "Signed in successfully. Opening ZakiChat...", "success");
      setTimeout(redirectToChats, 250);
    } catch (error) {
      console.error("Login error:", error);
      showMessage(message, error.message || "Unable to sign in. Check your phone number and password.", "error");
      setLoading(button, false, "Sign In");
    }
  }

  /* =======================================================
     SIGNUP WIZARD
     ======================================================= */

  const PENDING_UPGRADE_KEY = "zakichat_pending_upgrade";
  const signupState = {
    step: 1,
    accountCreated: false,
    email: "",
    username: "",
    displayName: "",
    phone: "",
    location: "",
    paidRegistrationPaymentId: null
  };

  function getSignupSteps() {
    return Array.from(
      document.querySelectorAll(".signup-step")
    );
  }

  function updateSignupProgress() {
    const total = 6;
    const step = signupState.step;
    const percent = Math.round((step / total) * 100);

    const bar =
      document.getElementById("signupProgressBar");
    const label =
      document.getElementById("signupStepLabel");
    const percentLabel =
      document.getElementById("signupStepPercent");

    if (bar) {
      bar.style.width = percent + "%";
    }

    if (label) {
      label.textContent =
        "Step " + step + " of " + total;
    }

    if (percentLabel) {
      percentLabel.textContent = percent + "%";
    }
  }

  function showSignupStep(step) {
    const steps = getSignupSteps();

    signupState.step = Math.max(
      1,
      Math.min(6, step)
    );

    steps.forEach(function (section) {
      const sectionStep =
        Number(section.dataset.step);

      const active =
        sectionStep === signupState.step;

      section.hidden = !active;
      section.classList.toggle(
        "active",
        active
      );
    });

    updateSignupProgress();

    const message =
      document.getElementById("signupMessage");

    if (message) {
      showMessage(message, "", "");
    }

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  function validateUsername() {
    const input =
      document.getElementById("username");

    if (!input) return false;

    const username = input.value.trim();

    if (username.length < 3) {
      showMessage(
        document.getElementById("signupMessage"),
        "Your username must contain at least 3 characters.",
        "error"
      );
      input.focus();
      return false;
    }

    if (username.length > 30) {
      showMessage(
        document.getElementById("signupMessage"),
        "Your username cannot exceed 30 characters.",
        "error"
      );
      input.focus();
      return false;
    }

    if (!/^[A-Za-z0-9_.]+$/.test(username)) {
      showMessage(
        document.getElementById("signupMessage"),
        "Username can only contain letters, numbers, underscores and dots.",
        "error"
      );
      input.focus();
      return false;
    }

    signupState.username = username.toLowerCase();

    return true;
  }

  function validateProfile() {
    const displayName =
      document.getElementById("displayName");
    const phone =
      document.getElementById("phone");
    const location =
      document.getElementById("location");

    const message =
      document.getElementById("signupMessage");

    if (!displayName.value.trim()) {
      showMessage(
        message,
        "Please enter your full name.",
        "error"
      );
      displayName.focus();
      return false;
    }

    if (!phone.value.trim()) {
      showMessage(
        message,
        "Please enter your phone number.",
        "error"
      );
      phone.focus();
      return false;
    }

    if (!location.value.trim()) {
      showMessage(
        message,
        "Please enter your general location.",
        "error"
      );
      location.focus();
      return false;
    }

    signupState.displayName =
      displayName.value.trim();

    const phoneE164 = getPhoneE164();

    if (!phoneE164) {
      showMessage(
        message,
        "Please enter a valid mobile phone number.",
        "error"
      );
      phone.focus();
      return false;
    }

    signupState.phone = phoneE164;

    signupState.location =
      location.value.trim();

    return true;
  }

  function validateEmail() {
    const input =
      document.getElementById("email");

    const message =
      document.getElementById("signupMessage");

    const email =
      input.value.trim();

    if (!email) {
      showMessage(
        message,
        "Please enter your recovery email.",
        "error"
      );
      input.focus();
      return false;
    }

    if (!input.checkValidity()) {
      showMessage(
        message,
        "Please enter a valid email address.",
        "error"
      );
      input.focus();
      return false;
    }

    signupState.email = email.toLowerCase();

    return true;
  }

  function validatePasswordStep() {
    const password =
      document.getElementById("password").value;

    const confirmPassword =
      document.getElementById("confirmPassword").value;

    const terms =
      document.getElementById("terms").checked;

    const message =
      document.getElementById("signupMessage");

    if (password.length < 8) {
      showMessage(
        message,
        "Your password must contain at least 8 characters.",
        "error"
      );
      return false;
    }

    if (password !== confirmPassword) {
      showMessage(
        message,
        "The passwords do not match.",
        "error"
      );
      return false;
    }

    if (!terms) {
      showMessage(
        message,
        "Please agree to the ZakiChat terms and privacy rules.",
        "error"
      );
      return false;
    }

    return true;
  }

  async function createSignupAccount() {
    const message =
      document.getElementById("signupMessage");

    const button =
      document.querySelector(
        '.signup-step[data-step="4"] button[type="submit"]'
      );

    const password =
      document.getElementById("password").value;

    setLoading(button, true, "Create Account");

    try {
      const cfg = window.ZakiChatConfig;
      if (!cfg?.supabaseKey) {
        throw new Error("Registration payment configuration is unavailable. Please try again later.");
      }

      const feeResponse = await fetch(REGISTRATION_PAYMENT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": cfg.supabaseKey,
          "Authorization": "Bearer " + cfg.supabaseKey
        },
        body: JSON.stringify({ action: "preflight", phone: signupState.phone })
      });
      const feeData = await feeResponse.json().catch(() => ({}));
      if (!feeResponse.ok || feeData.success !== true) {
        throw new Error(feeData.error || "Unable to verify the registration fee. Your account has not been created.");
      }

      signupState.paidRegistrationPaymentId = feeData.paidRegistrationPaymentId || null;

      if (feeData.paymentRequired) {
        showMessage(
          message,
          "A one-time registration fee of $" + Number(feeData.feeUsd).toFixed(2) +
            " USD is required for your country" +
            (window.ZakiChatCurrency ? " (approximately " + window.ZakiChatCurrency.formatUsd(Number(feeData.feeUsd), feeData.countryCode) + ")" : "") +
            ". The USD amount is canonical; the local amount is only an estimate. Automatic checkout is not configured yet, so your account has not been created. Your pending request has been recorded. Contact ZakiChat support for approved payment instructions, and retry signup with this phone after your payment is verified.",
          "error"
        );
        setLoading(button, false, "Create Account");
        return;
      }

      const { data, error } =
        await supabaseClient.auth.signUp({
          phone: signupState.phone,
          password,
          options: {
            channel: "sms",
            data: {
              username: signupState.username,
              full_name: signupState.displayName,
              display_name: signupState.displayName,
              phone: signupState.phone,
              location: signupState.location,
              recovery_email: signupState.email
            }
          }
        });

      if (error) {
        throw error;
      }

      signupState.accountCreated = true;

      const otpDescription =
        document.getElementById("otpDescription");

      if (otpDescription) {
        otpDescription.textContent =
          "A 6-digit verification code has been sent to your phone.";
      }

      showSignupStep(5);

      showMessage(
        message,
        "Your account was created. A verification code has been sent to your phone.",
        "success"
      );

    } catch (error) {
      console.error(
        "Signup account creation error:",
        error
      );

      let errorMessage =
        error.message ||
        "Unable to create your account.";

      if (/duplicate|unique|username/i.test(errorMessage)) {
        errorMessage =
          "That username may already be in use. Please choose another username.";
      }

      showMessage(
        message,
        errorMessage,
        "error"
      );

    } finally {
      setLoading(button, false, "Create Account");
    }
  }

  async function sendSignupOtp() {
    if (!signupState.accountCreated) {
      showMessage(
        message,
        "Please create your account first.",
        "error"
      );
      return;
    }

    showSignupStep(6);

    const otpInput =
      document.getElementById("otpCode");

    if (otpInput) {
      setTimeout(() => otpInput.focus(), 50);
    }
  }

  async function resendSignupOtp() {
    const button =
      document.getElementById("resendOtpButton");

    const message =
      document.getElementById("signupMessage");

    if (!signupState.accountCreated || !signupState.phone) {
      showMessage(
        message,
        "Please create your account first.",
        "error"
      );
      return;
    }

    if (button) {
      button.disabled = true;
      button.textContent = "Sending...";
    }

    try {
      const { error } =
        await supabaseClient.auth.resend({
          type: "sms",
          phone: signupState.phone
        });

      if (error) {
        throw error;
      }

      showMessage(
        message,
        "A new verification code has been sent to your phone.",
        "success"
      );
    } catch (error) {
      console.error("Resend OTP error:", error);

      showMessage(
        message,
        error?.message ||
          "Unable to resend the verification code. Please try again.",
        "error"
      );
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = "Resend code";
      }
    }
  }

  async function verifySignupOtp() {
    const input =
      document.getElementById("otpCode");

    const button =
      document.getElementById("verifyOtpButton");

    const message =
      document.getElementById("signupMessage");

    const token = input.value.trim();

    if (!/^[0-9]{6}$/.test(token)) {
      showMessage(
        message,
        "Please enter the 6-digit verification code.",
        "error"
      );
      input.focus();
      return;
    }

    button.disabled = true;
    button.textContent = "Verifying...";

    try {
      const { data, error } =
        await supabaseClient.auth.verifyOtp({
          phone: signupState.phone,
          token,
          type: "sms"
        });

      if (error) {
        throw error;
      }

      if (!data.session) {
        throw new Error(
          "Verification succeeded, but no session was created."
        );
      }

      if (signupState.paidRegistrationPaymentId && data.user?.id) {
        try {
          const cfg = window.ZakiChatConfig;
          const claimResponse = await fetch(REGISTRATION_PAYMENT_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "apikey": cfg.supabaseKey,
              "Authorization": "Bearer " + data.session.access_token
            },
            body: JSON.stringify({
              action: "claim-paid-registration",
              phone: signupState.phone,
              userId: data.user.id,
              paymentId: signupState.paidRegistrationPaymentId
            })
          });
          const claimData = await claimResponse.json().catch(() => ({}));
          if (!claimResponse.ok || claimData.success !== true) {
            throw new Error(claimData.error || "Unable to link the paid registration reference.");
          }
          signupState.paidRegistrationPaymentId = null;
        } catch (claimError) {
          console.error("Paid registration claim failed:", claimError);
          showMessage(
            message,
            "Your phone is verified, but we could not link the registration payment automatically. Please contact support before retrying signup.",
            "error"
          );
          setTimeout(redirectToChats, 1800);
          return;
        }
      }

      showMessage(
        message,
        "Phone verified successfully. Opening ZakiChat...",
        "success"
      );

      const pendingUpgrade = localStorage.getItem(PENDING_UPGRADE_KEY);
      if (pendingUpgrade === "personal_monthly" || pendingUpgrade === "business_monthly") {
        localStorage.removeItem(PENDING_UPGRADE_KEY);
        showMessage(message, "Phone verified. Your account is ready. Opening your selected upgrade plan...", "success");
        setTimeout(() => {
          window.location.href = "about.html?upgrade=" + encodeURIComponent(pendingUpgrade) + "#paid-upgrades";
        }, 650);
      } else {
        setTimeout(redirectToChats, 500);
      }

    } catch (error) {
      console.error("OTP verification error:", error);

      showMessage(
        message,
        error.message ||
          "The verification code is invalid or expired.",
        "error"
      );

    } finally {
      button.disabled = false;
      button.textContent = "Verify phone";
    }
  }

  function handleSignupNext() {

    const step = signupState.step;

    if (step === 1) {
      if (validateUsername()) {
        showSignupStep(2);
      }
      return;
    }

    if (step === 2) {
      if (validateProfile()) {
        showSignupStep(3);
      }
      return;
    }

    if (step === 3) {
      if (validateEmail()) {
        showSignupStep(4);
      }
      return;
    }

    if (step === 5) {
      sendSignupOtp();
    }
  }

  function handleSignupPrevious() {
    if (signupState.step <= 1) {
      return;
    }

    /*
     * Once the account has been created, don't allow
     * going backwards into account-creation fields.
     */
    if (
      signupState.accountCreated &&
      signupState.step === 5
    ) {
      return;
    }

    showSignupStep(
      signupState.step - 1
    );
  }

  async function handleSignup(event) {
    event.preventDefault();

    if (signupState.step !== 4) {
      return;
    }

    showMessage(
      document.getElementById("signupMessage"),
      "",
      ""
    );

    if (!validatePasswordStep()) {
      return;
    }

    await createSignupAccount();
  }

  /* =======================================================
     FORGOT PASSWORD
     ======================================================= */

  function ensurePasswordResetPanel() {
    let panel = document.getElementById("passwordResetPanel");
    if (panel) return panel;

    panel = document.createElement("section");
    panel.id = "passwordResetPanel";
    panel.className = "auth-card password-reset-panel";
    panel.hidden = true;
    panel.innerHTML = `
      <h2>Reset your password</h2>
      <p id="passwordResetStatus" class="auth-message" role="status">We'll send a verification code to your phone number.</p>
      <button type="button" class="button button-secondary" id="sendPasswordResetCode">Send verification code</button>
      <div id="passwordResetFields" hidden>
        <label for="passwordResetOtp">SMS verification code</label>
        <input id="passwordResetOtp" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}">
        <label for="newPassword">New password</label>
        <input id="newPassword" type="password" autocomplete="new-password" minlength="8">
        <label for="confirmNewPassword">Confirm new password</label>
        <input id="confirmNewPassword" type="password" autocomplete="new-password" minlength="8">
        <button type="button" class="button button-primary" id="confirmPasswordReset">Verify code &amp; change password</button>
      </div>
      <button type="button" class="button auth-secondary" id="cancelPasswordReset">Cancel</button>
    `;
    document.getElementById("loginForm")?.insertAdjacentElement("afterend", panel);

    document.getElementById("sendPasswordResetCode")?.addEventListener("click", async () => {
      const phone = getPhoneE164();
      const status = document.getElementById("passwordResetStatus");
      const button = document.getElementById("sendPasswordResetCode");
      if (!phone) {
        showMessage(status, "Enter a valid phone number on the sign-in form first.", "error");
        document.getElementById("phone")?.focus();
        return;
      }
      button.disabled = true;
      button.textContent = "Sending...";
      passwordResetInProgress = true;
      try {
        const { error } = await supabaseClient.auth.signInWithOtp({
          phone,
          options: { shouldCreateUser: false }
        });
        if (error) throw error;
        showMessage(status, "Verification code sent by SMS. Enter it below with your new password.", "success");
        document.getElementById("passwordResetFields").hidden = false;
        document.getElementById("passwordResetOtp")?.focus();
      } catch (error) {
        passwordResetInProgress = false;
        showMessage(status, error.message || "Unable to send a reset code. Check the phone number and try again.", "error");
      } finally {
        button.disabled = false;
        button.textContent = "Resend verification code";
      }
    });

    document.getElementById("passwordResetOtp")?.addEventListener("input", event => {
      event.target.value = event.target.value.replace(/[^0-9]/g, "").slice(0, 6);
    });

    document.getElementById("confirmPasswordReset")?.addEventListener("click", async () => {
      const phone = getPhoneE164();
      const token = document.getElementById("passwordResetOtp")?.value.trim() || "";
      const password = document.getElementById("newPassword")?.value || "";
      const confirm = document.getElementById("confirmNewPassword")?.value || "";
      const status = document.getElementById("passwordResetStatus");
      const button = document.getElementById("confirmPasswordReset");

      if (!phone || !/^[0-9]{6}$/.test(token)) {
        showMessage(status, "Enter the valid phone number and the 6-digit SMS code.", "error");
        return;
      }
      if (password.length < 8) {
        showMessage(status, "Your new password must contain at least 8 characters.", "error");
        return;
      }
      if (password !== confirm) {
        showMessage(status, "The new passwords do not match.", "error");
        return;
      }

      button.disabled = true;
      button.textContent = "Verifying...";
      passwordResetInProgress = true;
      try {
        const { error: verifyError } = await supabaseClient.auth.verifyOtp({ phone, token, type: "sms" });
        if (verifyError) throw verifyError;
        const { error: updateError } = await supabaseClient.auth.updateUser({ password });
        if (updateError) throw updateError;
        showMessage(status, "Password changed successfully. You're now signed in; opening ZakiChat...", "success");
        setTimeout(redirectToChats, 700);
      } catch (error) {
        showMessage(status, error.message || "Unable to reset the password. The code may be invalid or expired.", "error");
      } finally {
        button.disabled = false;
        button.textContent = "Verify code & change password";
      }
    });

    document.getElementById("cancelPasswordReset")?.addEventListener("click", () => {
      passwordResetInProgress = false;
      panel.hidden = true;
    });
    return panel;
  }

  async function handleForgotPassword(event) {
    event.preventDefault();
    const panel = ensurePasswordResetPanel();
    panel.hidden = false;
    panel.scrollIntoView({ behavior: "smooth", block: "center" });
    if (!getPhoneE164()) {
      showMessage(
        document.getElementById("passwordResetStatus"),
        "Enter a valid phone number above, then request a verification code.",
        "error"
      );
      document.getElementById("phone")?.focus();
    }
  }

  /* =======================================================
     PAGE SETUP
     ======================================================= */

  function initAccountPlanShowcase() {
    const slides = Array.from(document.querySelectorAll("[data-account-slide]"));
    const dots = Array.from(document.querySelectorAll("[data-plan-slide-to]"));
    if (!slides.length) return;
    let activeIndex = 0;
    const showSlide = index => {
      activeIndex = (index + slides.length) % slides.length;
      slides.forEach((slide, i) => {
        slide.hidden = i !== activeIndex;
        slide.classList.toggle("is-active", i === activeIndex);
      });
      dots.forEach((dot, i) => {
        dot.classList.toggle("is-active", i === activeIndex);
        dot.setAttribute("aria-pressed", String(i === activeIndex));
      });
    };
    document.getElementById("accountPlanPrevious")?.addEventListener("click", () => showSlide(activeIndex - 1));
    document.getElementById("accountPlanNext")?.addEventListener("click", () => showSlide(activeIndex + 1));
    dots.forEach(dot => dot.addEventListener("click", () => showSlide(Number(dot.dataset.planSlideTo) || 0)));
    document.querySelectorAll("[data-plan-choice]").forEach(button => {
      button.addEventListener("click", () => {
        const choice = button.dataset.planChoice;
        if (choice === "local") {
          localStorage.removeItem(PENDING_UPGRADE_KEY);
          document.getElementById("signupForm")?.scrollIntoView({ behavior: "smooth", block: "start" });
          document.getElementById("username")?.focus({ preventScroll: true });
          return;
        }
        if (choice !== "personal_monthly" && choice !== "business_monthly") return;
        localStorage.setItem(PENDING_UPGRADE_KEY, choice);
        document.getElementById("signupForm")?.scrollIntoView({ behavior: "smooth", block: "start" });
        document.getElementById("username")?.focus({ preventScroll: true });
        const message = document.getElementById("signupMessage");
        if (message) {
          message.className = "auth-message";
          message.textContent = (choice === "personal_monthly" ? "Customized Personal" : "Customized Business") +
            " selected. Complete account setup and phone verification; your selected upgrade page will open next. Payment must be verified before premium features unlock.";
        }
      });
    });
    const requested = new URLSearchParams(location.search).get("upgrade");
    if (requested === "personal_monthly" || requested === "business_monthly") {
      localStorage.setItem(PENDING_UPGRADE_KEY, requested);
      showSlide(requested === "personal_monthly" ? 1 : 2);
    } else {
      showSlide(0);
    }
  }

  function setupSignupPage() {
    redirectIfAlreadySignedIn();
    initAccountPlanShowcase();

    document
      .querySelectorAll(".next-step")
      .forEach(function (button) {
        button.addEventListener(
          "click",
          handleSignupNext
        );
      });

    document
      .querySelectorAll(".previous-step")
      .forEach(function (button) {
        button.addEventListener(
          "click",
          handleSignupPrevious
        );
      });

    const signupForm =
      document.getElementById(
        "signupForm"
      );

    if (signupForm) {
      signupForm.addEventListener(
        "submit",
        handleSignup
      );
    }

    const sendOtpButton =
      document.getElementById("sendOtpButton");

    if (sendOtpButton) {
      sendOtpButton.addEventListener(
        "click",
        sendSignupOtp
      );
    }

    const verifyOtpButton =
      document.getElementById("verifyOtpButton");

    if (verifyOtpButton) {
      verifyOtpButton.addEventListener(
        "click",
        verifySignupOtp
      );
    }

    const resendOtpButton =
      document.getElementById("resendOtpButton");

    if (resendOtpButton) {
      resendOtpButton.addEventListener(
        "click",
        resendSignupOtp
      );
    }

    const otpInput =
      document.getElementById("otpCode");

    if (otpInput) {
      otpInput.addEventListener(
        "input",
        function () {
          otpInput.value =
            otpInput.value
              .replace(/[^0-9]/g, "")
              .slice(0, 6);
        }
      );
    }

    setupPasswordToggle(
      "togglePassword",
      "password"
    );

    setupPasswordToggle(
      "toggleConfirmPassword",
      "confirmPassword"
    );

    updateSignupProgress();
  }

  function setupLoginPage() {
    redirectIfAlreadySignedIn();

    const loginForm =
      document.getElementById(
        "loginForm"
      );

    if (loginForm) {
      loginForm.addEventListener(
        "submit",
        handleLogin
      );
    }

    const forgotPassword =
      document.getElementById(
        "forgotPassword"
      );

    if (forgotPassword) {
      forgotPassword.addEventListener(
        "click",
        handleForgotPassword
      );
    }

    setupPasswordToggle(
      "togglePassword",
      "password"
    );
  }

  /*
   * Do NOT redirect a signup page merely because an auth
   * event occurs while the verification wizard is running.
   * Verification itself decides when signup is complete.
   */
  supabaseClient.auth.onAuthStateChange(
    function (event, session) {
      console.log(
        "ZakiChat auth event:",
        event
      );

      if (
        isLoginPage &&
        !passwordResetInProgress &&
        session &&
        (
          event === "SIGNED_IN" ||
          event === "INITIAL_SESSION" ||
          event === "TOKEN_REFRESHED"
        )
      ) {
        redirectToChats();
      }
    }
  );

  if (isSignupPage || isLoginPage) {
    setupInternationalPhoneInput();
  }

  if (isLoginPage) {
    setupLoginPage();
  }

  if (isSignupPage) {
    setupSignupPage();

  }
})();
