(function () {
  "use strict";

  if (!window.supabase || !window.ZakiChatConfig) {
    console.error("ZakiChat profile could not start.");
    return;
  }

  const { createClient } = window.supabase;

  const supabaseClient =
    window.ZakiChatAuth?.client ||
    createClient(
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

  const form = document.getElementById("profileForm");
  const usernameInput = document.getElementById("username");
  const fullNameInput = document.getElementById("fullName");
  const phoneInput = document.getElementById("phone");
  const locationInput = document.getElementById("location");
  const bioInput = document.getElementById("bio");

  const avatarUrlInput =
    document.getElementById("avatarUrl");

  const avatarUrlVisible =
    document.getElementById("avatarUrlVisible");

  const avatar = document.getElementById("profileAvatar");
  const initials = document.getElementById("avatarInitials");

  const displayName =
    document.getElementById("profileDisplayName");

  const profileUsername =
    document.getElementById("profileUsername");

  const presence =
    document.getElementById("profilePresence");

  const bioCount =
    document.getElementById("bioCount");

  const message =
    document.getElementById("profileMessage");

  const saveButton =
    document.getElementById("saveButton");

  const saveTopButton =
    document.getElementById("saveTopButton");

  const cancelButton =
    document.getElementById("cancelButton");

  const avatarEditButton =
    document.getElementById("avatarEditButton");

  const logoutButton =
    document.getElementById("logoutButton");

  let currentUser = null;
  let originalProfile = null;
  let viewedUserId = null;
  let isOwnProfile = true;
  let saving = false;

  function showMessage(text, type) {
    if (!message) return;

    message.textContent = text;
    message.className = "profile-message " + type;
    message.hidden = false;
  }

  function clearMessage() {
    if (!message) return;

    message.textContent = "";
    message.className = "profile-message";
    message.hidden = true;
  }

  function showToast(text) {
    const toast = document.getElementById("toast");

    if (!toast) return;

    toast.textContent = text;
    toast.hidden = false;

    clearTimeout(showToast.timer);

    showToast.timer = setTimeout(function () {
      toast.hidden = true;
    }, 2600);
  }

  function normalizeUsername(value) {
    return String(value || "")
      .trim()
      .replace(/^@+/, "")
      .toLowerCase();
  }

  function validUsername(username) {
    return (
      /^[a-z0-9_.]+$/i.test(username) &&
      username.length >= 3 &&
      username.length <= 30
    );
  }

  function getInitials(name, username) {
    const source =
      String(name || "").trim() ||
      String(username || "").trim() ||
      "?";

    const parts = source
      .split(/\s+/)
      .filter(Boolean);

    if (parts.length >= 2) {
      return (
        parts[0].charAt(0) +
        parts[1].charAt(0)
      ).toUpperCase();
    }

    return source
      .replace(/^@+/, "")
      .slice(0, 2)
      .toUpperCase() || "?";
  }

  function setAvatar(url, name, username) {
    if (!avatar) return;

    avatar.innerHTML = "";

    if (url) {
      const img = document.createElement("img");

      img.src = url;
      img.alt = "Profile photo";

      img.addEventListener("error", function () {
        avatar.innerHTML = "";

        const fallback =
          document.createElement("span");

        fallback.textContent =
          getInitials(name, username);

        avatar.appendChild(fallback);
      });

      avatar.appendChild(img);
      return;
    }

    const fallback =
      document.createElement("span");

    fallback.textContent =
      getInitials(name, username);

    avatar.appendChild(fallback);
  }

  function updateHeader(profile) {
    const name =
      profile.full_name ||
      profile.username ||
      "ZakiChat User";

    const username =
      profile.username ||
      "username";

    if (displayName) {
      displayName.textContent = name;
    }

    if (profileUsername) {
      profileUsername.textContent =
        "@" + username;
    }

    setAvatar(
      profile.avatar_url,
      profile.full_name,
      profile.username
    );

    updatePresence(profile);
  }

  function updatePresence(profile) {
    if (!presence) return;

    const dot = presence.querySelector("i");
    const label = presence.querySelector("span");

    const online = Boolean(profile.is_online);

    presence.classList.toggle("online", online);

    if (dot) {
      dot.setAttribute(
        "aria-label",
        online ? "Online" : "Offline"
      );
    }

    if (label) {
      label.textContent = online
        ? "Online"
        : "Offline";
    }
  }

  function updateBioCount() {
    if (!bioCount || !bioInput) return;

    bioCount.textContent =
      String(bioInput.value.length);
  }

  function fillForm(profile) {
    usernameInput.value =
      profile.username || "";

    fullNameInput.value =
      profile.full_name || "";

    phoneInput.value =
      profile.phone || "";

    locationInput.value =
      profile.location || "";

    bioInput.value =
      profile.bio || "";

    const avatarUrl =
      profile.avatar_url || "";

    avatarUrlInput.value = avatarUrl;
    avatarUrlVisible.value = avatarUrl;

    updateBioCount();
    updateHeader(profile);
  }

  function getFormData() {
    return {
      username: normalizeUsername(
        usernameInput.value
      ),

      full_name:
        fullNameInput.value.trim(),

      phone:
        phoneInput.value.trim(),

      location:
        locationInput.value.trim(),

      bio:
        bioInput.value.trim(),

      avatar_url:
        avatarUrlVisible.value.trim()
    };
  }

  function getRequestedProfileId() {
    const params =
      new URLSearchParams(
        window.location.search
      );

    const requestedId =
      String(
        params.get("user") || ""
      ).trim();

    return requestedId || null;
  }

  function setViewMode() {
    if (isOwnProfile) return;

    document.title =
      "Profile | ZakiChat";

    const heading =
      document.querySelector(
        ".profile-topbar h1"
      );

    if (heading) {
      heading.textContent = "Profile";
    }

    const sectionHeading =
      document.querySelector(
        ".section-heading h3"
      );

    const sectionDescription =
      document.querySelector(
        ".section-heading p"
      );

    if (sectionHeading) {
      sectionHeading.textContent =
        "About this person";
    }

    if (sectionDescription) {
      sectionDescription.textContent =
        "View this ZakiChat user's profile information.";
    }

    if (form) {
      form.addEventListener(
        "submit",
        function (event) {
          event.preventDefault();
        }
      );
    }

    [
      usernameInput,
      fullNameInput,
      phoneInput,
      locationInput,
      bioInput,
      avatarUrlVisible
    ].forEach(function (input) {
      if (!input) return;

      input.readOnly = true;
      input.setAttribute(
        "aria-readonly",
        "true"
      );
    });

    if (avatarEditButton) {
      avatarEditButton.hidden = true;
    }

    if (saveButton) {
      saveButton.hidden = true;
    }

    if (saveTopButton) {
      saveTopButton.hidden = true;
    }

    if (cancelButton) {
      cancelButton.hidden = true;
    }

    if (logoutButton) {
      logoutButton.hidden = true;
    }

    const infoCard =
      document.querySelector(
        ".profile-info-card"
      );

    if (infoCard) {
      infoCard.hidden = true;
    }
  }

  async function loadProfile() {
    clearMessage();

    const {
      data: sessionData,
      error: sessionError
    } = await supabaseClient.auth.getSession();

    if (
      sessionError ||
      !sessionData ||
      !sessionData.session
    ) {
      window.location.replace("login.html");
      return;
    }

    currentUser =
      sessionData.session.user;

    viewedUserId =
      getRequestedProfileId();

    isOwnProfile =
      !viewedUserId ||
      viewedUserId === currentUser.id;

    const profileId =
      isOwnProfile
        ? currentUser.id
        : viewedUserId;

    const {
      data: profile,
      error
    } = await supabaseClient
      .from("profiles")
      .select(
        "id,username,full_name,phone,avatar_url,bio,is_online,last_seen,location,created_at,updated_at"
      )
      .eq("id", profileId)
      .maybeSingle();

    if (error) {
      console.error(
        "Profile load failed:",
        error
      );

      showMessage(
        "We could not load this profile. Please try again.",
        "error"
      );

      return;
    }

    if (!profile) {
      showMessage(
        "This profile could not be found.",
        "error"
      );

      return;
    }

    originalProfile =
      JSON.parse(JSON.stringify(profile));

    fillForm(profile);

    if (!isOwnProfile) {
      setViewMode();
    }
  }

  async function saveProfile() {
    if (
      saving ||
      !currentUser ||
      !isOwnProfile
    ) {
      return;
    }

    clearMessage();

    const values =
      getFormData();

    if (!validUsername(values.username)) {
      showMessage(
        "Username must contain 3–30 letters, numbers, underscores or dots.",
        "error"
      );

      usernameInput.focus();
      return;
    }

    if (values.full_name.length > 80) {
      showMessage(
        "Full name is too long.",
        "error"
      );

      fullNameInput.focus();
      return;
    }

    if (values.location.length > 100) {
      showMessage(
        "Location is too long.",
        "error"
      );

      locationInput.focus();
      return;
    }

    if (values.bio.length > 160) {
      showMessage(
        "Your bio must be 160 characters or fewer.",
        "error"
      );

      bioInput.focus();
      return;
    }

    saving = true;

    if (saveButton) {
      saveButton.disabled = true;
      saveButton.querySelector("span").textContent =
        "Saving...";
    }

    if (saveTopButton) {
      saveTopButton.disabled = true;
      saveTopButton.textContent =
        "Saving...";
    }

    const {
      data,
      error
    } = await supabaseClient
      .from("profiles")
      .update({
        username: values.username,
        full_name: values.full_name || null,
        phone: values.phone || null,
        location: values.location || null,
        bio: values.bio || null,
        avatar_url: values.avatar_url || null,
        updated_at: new Date().toISOString()
      })
      .eq("id", currentUser.id)
      .select(
        "id,username,full_name,phone,avatar_url,bio,is_online,last_seen,location,created_at,updated_at"
      )
      .single();

    saving = false;

    if (saveButton) {
      saveButton.disabled = false;
      saveButton.querySelector("span").textContent =
        "Save Changes";
    }

    if (saveTopButton) {
      saveTopButton.disabled = false;
      saveTopButton.textContent =
        "Save";
    }

    if (error) {
      console.error(
        "Profile save failed:",
        error
      );

      const errorText =
        String(error.message || "").toLowerCase();

      if (
        errorText.includes("duplicate") ||
        errorText.includes("profiles_username_key") ||
        errorText.includes("unique")
      ) {
        showMessage(
          "That username is already in use. Please choose another one.",
          "error"
        );
      } else {
        showMessage(
          error.message ||
          "Could not save your profile.",
          "error"
        );
      }

      return;
    }

    originalProfile =
      JSON.parse(JSON.stringify(data));

    fillForm(data);

    showMessage(
      "Your profile was saved successfully.",
      "success"
    );

    showToast("Profile updated");
  }

  function cancelChanges() {
    if (!originalProfile) return;

    fillForm(originalProfile);
    clearMessage();
    showToast("Changes cancelled");
  }

  function focusAvatarUrl() {
    if (!avatarUrlVisible) return;

    avatarUrlVisible.hidden = false;
    avatarUrlVisible.focus();

    avatarUrlVisible.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  }

  async function logout() {
    if (!logoutButton) return;

    logoutButton.disabled = true;
    logoutButton.textContent = "Logging out...";

    const {
      error
    } = await supabaseClient.auth.signOut();

    if (error) {
      console.error(
        "Logout failed:",
        error
      );

      logoutButton.disabled = false;
      logoutButton.textContent = "Log Out";

      showToast(
        "Could not log out. Please try again."
      );

      return;
    }

    window.location.replace("login.html");
  }

  function bindEvents() {
    if (form) {
      form.addEventListener(
        "submit",
        function (event) {
          event.preventDefault();
          saveProfile();
        }
      );
    }

    if (saveTopButton) {
      saveTopButton.addEventListener(
        "click",
        saveProfile
      );
    }

    if (cancelButton) {
      cancelButton.addEventListener(
        "click",
        cancelChanges
      );
    }

    if (bioInput) {
      bioInput.addEventListener(
        "input",
        updateBioCount
      );
    }

    if (
      avatarEditButton &&
      isOwnProfile
    ) {
      avatarEditButton.addEventListener(
        "click",
        focusAvatarUrl
      );
    }

    if (avatarUrlVisible) {
      avatarUrlVisible.addEventListener(
        "input",
        function () {
          avatarUrlInput.value =
            avatarUrlVisible.value.trim();

          setAvatar(
            avatarUrlVisible.value.trim(),
            fullNameInput.value,
            usernameInput.value
          );
        }
      );
    }

    if (usernameInput) {
      usernameInput.addEventListener(
        "input",
        function () {
          usernameInput.value =
            usernameInput.value
              .replace(/^@+/, "")
              .toLowerCase();
        }
      );
    }

    if (
      logoutButton &&
      isOwnProfile
    ) {
      logoutButton.addEventListener(
        "click",
        logout
      );
    }
  }

  supabaseClient.auth.onAuthStateChange(
    function (event, session) {
      if (
        event === "SIGNED_OUT" ||
        !session
      ) {
        window.location.replace("login.html");
      }
    }
  );

  bindEvents();
  loadProfile();

})();
