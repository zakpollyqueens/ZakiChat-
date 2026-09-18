(function () {
  "use strict";

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
  let signupPhoneInput = null;

  function setupInternationalPhoneInput() {
    const input = document.getElementById("phone");

    if (!input || !window.intlTelInput) {
      return;
    }

    signupPhoneInput = window.intlTelInput(input, {
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
        signupPhoneInput &&
        input.value.trim() &&
        signupPhoneInput.isValidNumber()
      ) {
        input.classList.remove("input-error");
      }
    });
  }

  function getSignupPhoneE164() {
    if (!signupPhoneInput) {
      return "";
    }

    if (!signupPhoneInput.isValidNumber()) {
      return "";
    }

    return signupPhoneInput.getNumber();
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
    const email =
      document.getElementById("email").value.trim();
    const password =
      document.getElementById("password").value;
    const message =
      document.getElementById("loginMessage");
    const button =
      form.querySelector('button[type="submit"]');

    showMessage(message, "", "");

    if (!email || !password) {
      showMessage(
        message,
        "Please enter your email and password.",
        "error"
      );
      return;
    }

    setLoading(button, true, "Sign In");

    try {
      const { data, error } =
        await supabaseClient.auth.signInWithPassword({
          email,
          password
        });

      if (error) {
        throw error;
      }

      if (!data.session) {
        throw new Error(
          "Sign-in succeeded, but no session was created."
        );
      }

      showMessage(
        message,
        "Signed in successfully. Opening ZakiChat...",
        "success"
      );

      setTimeout(redirectToChats, 250);
    } catch (error) {
      console.error("Login error:", error);

      showMessage(
        message,
        error.message ||
          "Unable to sign in. Please try again.",
        "error"
      );

      setLoading(button, false, "Sign In");
    }
  }

  /* =======================================================
     SIGNUP WIZARD
     ======================================================= */

  const signupState = {
    step: 1,
    accountCreated: false,
    email: "",
    username: "",
    displayName: "",
    phone: "",
    location: ""
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

    const phoneE164 = getSignupPhoneE164();

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

      showMessage(
        message,
        "Phone verified successfully. Opening ZakiChat...",
        "success"
      );

      setTimeout(redirectToChats, 500);

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

  async function handleForgotPassword(event) {
    event.preventDefault();

    const emailInput =
      document.getElementById("email");

    const email =
      emailInput
        ? emailInput.value.trim()
        : "";

    const message =
      document.getElementById(
        "loginMessage"
      );

    if (!email) {
      showMessage(
        message,
        "Enter your email address first, then choose Forgot password.",
        "error"
      );
      emailInput?.focus();
      return;
    }

    try {
      const redirectUrl =
        new URL(
          "reset-password.html",
          window.location.href
        ).href;

      const { error } =
        await supabaseClient.auth.resetPasswordForEmail(
          email,
          {
            redirectTo: redirectUrl
          }
        );

      if (error) {
        throw error;
      }

      showMessage(
        message,
        "If an account exists for that email, a password-reset link has been sent.",
        "success"
      );

    } catch (error) {
      console.error(
        "Password reset error:",
        error
      );

      showMessage(
        message,
        error.message ||
          "Unable to send the password-reset email.",
        "error"
      );
    }
  }

  /* =======================================================
     PAGE SETUP
     ======================================================= */

  function setupSignupPage() {
    redirectIfAlreadySignedIn();

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

  if (isSignupPage) {
    setupInternationalPhoneInput();
  }

  if (isLoginPage) {
    setupLoginPage();
  }

  if (isSignupPage) {
    setupSignupPage();

  }
})();
