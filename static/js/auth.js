(function () {
  "use strict";

  /*
   * ZakiChat Authentication
   *
   * Supabase sessions are persisted in the browser/device storage.
   * This means users normally remain signed in after closing or
   * reopening ZakiChat.
   */

  if (!window.supabase || !window.ZakiChatConfig) {
    console.error("ZakiChat authentication could not start.");
    return;
  }

  const { createClient } = window.supabase;

  const supabaseClient = createClient(
    window.ZakiChatConfig.supabaseUrl,
    window.ZakiChatConfig.supabaseKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "zakichat-auth"
      }
    }
  );

  window.ZakiChatAuth = Object.freeze({
    client: supabaseClient
  });

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

  async function redirectIfAlreadySignedIn() {
    const { data, error } = await supabaseClient.auth.getSession();

    if (error) {
      console.error("Session check failed:", error);
      return;
    }

    if (data && data.session) {
      redirectToChats();
    }
  }

  async function handleLogin(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const message = document.getElementById("loginMessage");
    const button = form.querySelector('button[type="submit"]');

    showMessage(message, "", "");

    if (!email || !password) {
      showMessage(message, "Please enter your email and password.", "error");
      return;
    }

    setLoading(button, true, "Sign In");

    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        throw error;
      }

      if (!data.session) {
        throw new Error("Sign-in succeeded, but no session was created.");
      }

      showMessage(message, "Signed in successfully. Opening ZakiChat...", "success");

      setTimeout(redirectToChats, 250);
    } catch (error) {
      console.error("Login error:", error);

      showMessage(
        message,
        error.message || "Unable to sign in. Please try again.",
        "error"
      );

      setLoading(button, false, "Sign In");
    }
  }

  async function handleSignup(event) {
    event.preventDefault();

    const form = event.currentTarget;

    const displayName =
      document.getElementById("displayName").value.trim();

    const email =
      document.getElementById("email").value.trim();

    const password =
      document.getElementById("password").value;

    const confirmPassword =
      document.getElementById("confirmPassword").value;

    const message =
      document.getElementById("signupMessage");

    const button =
      form.querySelector('button[type="submit"]');

    showMessage(message, "", "");

    if (!displayName || !email || !password || !confirmPassword) {
      showMessage(
        message,
        "Please complete all required fields.",
        "error"
      );
      return;
    }

    if (password.length < 8) {
      showMessage(
        message,
        "Your password must contain at least 8 characters.",
        "error"
      );
      return;
    }

    if (password !== confirmPassword) {
      showMessage(
        message,
        "The passwords do not match.",
        "error"
      );
      return;
    }

    setLoading(button, true, "Create Account");

    try {
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName
          }
        }
      });

      if (error) {
        throw error;
      }

      /*
       * If email confirmation is disabled in Supabase,
       * a session is returned immediately.
       *
       * If email confirmation is enabled, the user must
       * confirm their email before a session becomes active.
       */

      if (data.session) {
        showMessage(
          message,
          "Account created successfully. Opening ZakiChat...",
          "success"
        );

        setTimeout(redirectToChats, 250);
        return;
      }

      showMessage(
        message,
        "Account created. Please check your email to confirm your account, then sign in.",
        "success"
      );

      setLoading(button, false, "Create Account");
    } catch (error) {
      console.error("Signup error:", error);

      showMessage(
        message,
        error.message || "Unable to create your account. Please try again.",
        "error"
      );

      setLoading(button, false, "Create Account");
    }
  }

  async function handleForgotPassword(event) {
    event.preventDefault();

    const emailInput = document.getElementById("email");
    const email = emailInput ? emailInput.value.trim() : "";

    const message = document.getElementById("loginMessage");

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
        new URL("reset-password.html", window.location.href).href;

      const { error } =
        await supabaseClient.auth.resetPasswordForEmail(email, {
          redirectTo: redirectUrl
        });

      if (error) {
        throw error;
      }

      showMessage(
        message,
        "If an account exists for that email, a password-reset link has been sent.",
        "success"
      );
    } catch (error) {
      console.error("Password reset error:", error);

      showMessage(
        message,
        error.message || "Unable to send the password-reset email.",
        "error"
      );
    }
  }

  function setupAuthPages() {
    if (isLoginPage) {
      redirectIfAlreadySignedIn();

      const loginForm = document.getElementById("loginForm");

      if (loginForm) {
        loginForm.addEventListener("submit", handleLogin);
      }

      const forgotPassword =
        document.getElementById("forgotPassword");

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

    if (isSignupPage) {
      redirectIfAlreadySignedIn();

      const signupForm =
        document.getElementById("signupForm");

      if (signupForm) {
        signupForm.addEventListener(
          "submit",
          handleSignup
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
    }
  }

  /*
   * Keep the client session alive and react to authentication changes.
   */
  supabaseClient.auth.onAuthStateChange(function (event, session) {
    console.log("ZakiChat auth event:", event);

    if (
      session &&
      (event === "SIGNED_IN" ||
        event === "INITIAL_SESSION" ||
        event === "TOKEN_REFRESHED")
    ) {
      if (isLoginPage || isSignupPage) {
        redirectToChats();
      }
    }
  });

  setupAuthPages();
})();
