/* =========================================
   EQUIPAY — AUTHENTICATION
   Login, Sign-up and Logout using Firebase
   ========================================= */

(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  let isSignUp = false;
  let authInitialized = false;

  function setStatus(message, isError = false) {
    const status = $("authStatus");
    if (!status) return;

    status.textContent = message;
    status.classList.toggle("error", isError);
    status.classList.toggle("success", !isError && Boolean(message));
  }

  function setAccountStatus(message) {
    const status = $("accountPageStatus");
    if (status) status.textContent = message;
  }

  function getFirebaseAuth() {
    if (!window.firebase) return null;

    try {
      if (typeof firebase.auth === "function") {
        return firebase.auth();
      }
    } catch (error) {
      console.error("Firebase Authentication error:", error);
    }

    return null;
  }

  function showAuthPage() {
    if (typeof window.showPage === "function") {
      window.showPage("login");
      return;
    }

    document.querySelectorAll("[data-page-view]").forEach((page) => {
      page.classList.add("hidden");
    });

    const loginPage = $("loginPage");
    if (loginPage) loginPage.classList.remove("hidden");

    const title = $("pageTitle");
    if (title) title.textContent = "Welcome to Equipay";
  }

  // Used only by "Continue without logging in"
  function showAppPage() {
    if (typeof window.showPage === "function") {
      window.showPage("dashboard");
      return;
    }

    document.querySelectorAll("[data-page-view]").forEach((page) => {
      page.classList.add("hidden");
    });

    const dashboard = $("dashboard");
    if (dashboard) dashboard.classList.remove("hidden");

    const title = $("pageTitle");
    if (title) title.textContent = "Dashboard";
  }

  function setAuthMode(signUp) {
    isSignUp = signUp;

    const title = $("authTitle");
    const description = $("authDescription");
    const nameField = $("authNameField");
    const nameInput = $("authName");
    const submit = $("authSubmitBtn");
    const switchText = $("authSwitchText");
    const switchButton = $("authSwitchBtn");
    const password = $("authPassword");

    if (title) {
      title.textContent = isSignUp ? "Create your account" : "Welcome back!";
    }

    if (description) {
      description.textContent = isSignUp
        ? "A few details and you're ready to go."
        : "Log in to continue to your Equipay account.";
    }

    if (nameField) {
      nameField.classList.toggle("hidden", !isSignUp);
    }

    if (nameInput) {
      nameInput.required = isSignUp;
    }

    if (password) {
      password.autocomplete = isSignUp ? "new-password" : "current-password";
    }

    if (submit) {
      submit.textContent = isSignUp ? "Create account" : "Log in";
      submit.disabled = false;
    }

    if (switchText) {
      switchText.textContent = isSignUp
        ? "Already have an account?"
        : "New to Equipay?";
    }

    if (switchButton) {
      switchButton.textContent = isSignUp ? "Log in" : "Create an account";
    }

    setStatus("");
  }

  function friendlyError(error) {
    const code = error && error.code ? error.code : "";

    const messages = {
      "auth/email-already-in-use":
        "This email already has an account. Try logging in.",
      "auth/invalid-email": "Please enter a valid email address.",
      "auth/weak-password":
        "Choose a stronger password with at least 6 characters.",
      "auth/user-not-found":
        "No account was found with this email. Please sign up first.",
      "auth/wrong-password": "Incorrect email or password. Please try again.",
      "auth/invalid-credential":
        "Incorrect email or password. Please try again.",
      "auth/too-many-requests":
        "Too many attempts. Please wait a little and try again.",
      "auth/network-request-failed":
        "Network error. Check your internet connection.",
      "auth/operation-not-allowed":
        "Email/password login is not enabled in Firebase Console.",
    };

    return (
      messages[code] ||
      (error && error.message) ||
      "Something went wrong. Please try again."
    );
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();

    const auth = getFirebaseAuth();

    if (!auth) {
      setStatus(
        "Firebase Authentication is not configured. Check firebase-config.js and your Firebase setup.",
        true,
      );
      return;
    }

    const email = $("authEmail")?.value.trim();
    const password = $("authPassword")?.value;
    const name = $("authName")?.value.trim();

    if (!email || !password) {
      setStatus("Please enter your email and password.", true);
      return;
    }

    if (isSignUp && !name) {
      setStatus("Please enter your name.", true);
      return;
    }

    const submit = $("authSubmitBtn");
    if (submit) {
      submit.disabled = true;
      submit.textContent = isSignUp ? "Creating account..." : "Logging in...";
    }

    try {
      let credential;

      if (isSignUp) {
        credential = await auth.createUserWithEmailAndPassword(email, password);

        if (name && credential.user) {
          await credential.user.updateProfile({
            displayName: name,
          });
        }

        // Save the display name for the app to use.
        if (name) {
          try {
            localStorage.setItem("equipay_user_name", name);
          } catch (_) {}
        }

        setStatus("Account created successfully!");
      } else {
        credential = await auth.signInWithEmailAndPassword(email, password);

        setStatus("Logged in successfully!");
      }

      const user = credential.user;

      if (user) {
        updateAccountUI(user);

        // Tell app.js who just logged in. It opens this person's profile,
        // or sends them to "Create my profile" if they don't have one yet.
        window.equipayAuthUid = user.uid;
        window.dispatchEvent(
          new CustomEvent("equipay:auth-ready", { detail: user }),
        );
      }

      // Refresh the app after authentication.
      if (typeof window.refreshEquipay === "function") {
        await window.refreshEquipay();
      }
    } catch (error) {
      console.error("Authentication failed:", error);
      setStatus(friendlyError(error), true);
    } finally {
      if (submit) {
        submit.disabled = false;
        submit.textContent = isSignUp ? "Create account" : "Log in";
      }
    }
  }

  function updateAccountUI(user) {
    const name =
      user?.displayName || user?.email?.split("@")[0] || "Your account";

    const email = user?.email || "Guest profile";
    const initial = name.charAt(0).toUpperCase();

    const nameTargets = ["accountName", "accountPageName", "sidebarUserName"];

    nameTargets.forEach((id) => {
      const element = $(id);
      if (element) element.textContent = name;
    });

    const emailTargets = ["accountPageEmail"];

    emailTargets.forEach((id) => {
      const element = $(id);
      if (element) element.textContent = email;
    });

    ["accountAvatar", "accountPageAvatar", "topbarAvatar"].forEach((id) => {
      const element = $(id);
      if (element) element.textContent = initial;
    });

    setAccountStatus("Logged in");

    const loginButton = $("loginNavBtn");
    const logoutButton = $("logoutBtn");
    const accountLoginButton = $("accountLoginBtn");
    const accountLogoutButton = $("accountLogoutBtn");

    if (loginButton) loginButton.classList.add("hidden");
    if (logoutButton) logoutButton.classList.remove("hidden");
    if (accountLoginButton) accountLoginButton.classList.add("hidden");
    if (accountLogoutButton) accountLogoutButton.classList.remove("hidden");
  }

  function updateGuestUI() {
    const name = "Your account";

    ["accountName", "accountPageName", "sidebarUserName"].forEach((id) => {
      const element = $(id);
      if (element) element.textContent = name;
    });

    const email = $("accountPageEmail");
    if (email) email.textContent = "Guest profile";

    ["accountAvatar", "accountPageAvatar", "topbarAvatar"].forEach((id) => {
      const element = $(id);
      if (element) element.textContent = "E";
    });

    setAccountStatus("Guest");

    const loginButton = $("loginNavBtn");
    const logoutButton = $("logoutBtn");
    const accountLoginButton = $("accountLoginBtn");
    const accountLogoutButton = $("accountLogoutBtn");

    if (loginButton) loginButton.classList.remove("hidden");
    if (logoutButton) logoutButton.classList.add("hidden");
    if (accountLoginButton) accountLoginButton.classList.remove("hidden");
    if (accountLogoutButton) accountLogoutButton.classList.add("hidden");
  }

  async function handleLogout() {
    const auth = getFirebaseAuth();

    if (!auth) {
      setStatus("Firebase Authentication is not configured.", true);
      return;
    }

    try {
      await auth.signOut();
      window.equipayAuthUid = null;

      // Forget the selected profile so the next person doesn't see it
      if (typeof window.setCurrentUser === "function") {
        window.setCurrentUser(null);
      }

      updateGuestUI();
      showAuthPage();
      setAuthMode(false);
      setStatus("You have logged out successfully.");
    } catch (error) {
      console.error("Logout failed:", error);
      setStatus(friendlyError(error), true);
    }
  }

  function bindEvents() {
    const form = $("authForm");
    if (form) {
      form.addEventListener("submit", handleAuthSubmit);
    }

    const switchButton = $("authSwitchBtn");
    if (switchButton) {
      switchButton.addEventListener("click", () => {
        setAuthMode(!isSignUp);
      });
    }

    const loginButton = $("loginNavBtn");
    if (loginButton) {
      loginButton.addEventListener("click", () => {
        showAuthPage();
        setAuthMode(false);
      });
    }

    const logoutButton = $("logoutBtn");
    if (logoutButton) {
      logoutButton.addEventListener("click", handleLogout);
    }

    const accountLoginButton = $("accountLoginBtn");
    if (accountLoginButton) {
      accountLoginButton.addEventListener("click", () => {
        showAuthPage();
        setAuthMode(false);
      });
    }

    const accountLogoutButton = $("accountLogoutBtn");
    if (accountLogoutButton) {
      accountLogoutButton.addEventListener("click", handleLogout);
    }

    const backButton = $("backToAppBtn");
    if (backButton) {
      backButton.addEventListener("click", showAppPage);
    }

    const accountShortcut = $("accountShortcutBtn");
    if (accountShortcut) {
      accountShortcut.addEventListener("click", () => {
        if (typeof window.showPage === "function") {
          window.showPage("account");
        } else {
          document.querySelectorAll("[data-page-view]").forEach((page) => {
            page.classList.add("hidden");
          });
          $("accountPage")?.classList.remove("hidden");
        }
      });
    }
  }

  function initAuth() {
    if (authInitialized) return;
    authInitialized = true;

    bindEvents();
    setAuthMode(false);

    const auth = getFirebaseAuth();

    if (!auth) {
      updateGuestUI();
      return;
    }

    auth.onAuthStateChanged((user) => {
      if (user) {
        updateAccountUI(user);
        window.equipayAuthUid = user.uid;
      } else {
        window.equipayAuthUid = null;
        updateGuestUI();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAuth);
  } else {
    initAuth();
  }

  // Expose functions for other app scripts if needed.
  window.EquipayAuth = {
    showLogin: () => {
      showAuthPage();
      setAuthMode(false);
    },
    showSignUp: () => {
      showAuthPage();
      setAuthMode(true);
    },
    logout: handleLogout,
  };
})();
