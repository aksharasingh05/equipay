// onboarding.js
(function () {
  "use strict";

  const profileForm = document.getElementById("profileForm");
  const profileStatus = document.getElementById("profileStatus");
  const createProfileBtn = document.getElementById("createProfileBtn");

  const personaSettings = {
    student: {
      label: "Student",
      scope: "personal",
      categories: [
        "Food & Outings",
        "Clothes",
        "Trips",
        "Fees",
        "Rent",
        "Commute",
        "Subscriptions",
        "Other",
      ],
    },
    personal: {
      label: "Personal Finance",
      scope: "personal",
      categories: [
        "EMI",
        "Electricity",
        "Groceries",
        "Commute",
        "Rent",
        "Health",
        "Subscriptions",
        "Other",
      ],
    },
    business: {
      label: "Small Business",
      scope: "business",
      categories: [
        "Sales",
        "Supplies",
        "Salary",
        "Loan EMI",
        "Tax/GST",
        "Rent",
        "Vendor Payments",
        "Other",
      ],
    },
  };
  window.personaSettings = personaSettings;

  if (!profileForm) {
    console.error("Equipay: #profileForm not found.");
    return;
  }

  profileForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const name = document.getElementById("userName").value.trim();
    const upi = (document.getElementById("userUpi")?.value || "").trim();
    const persona = document.getElementById("persona").value;
    const budget = Number(document.getElementById("budget").value);

    if (!name) {
      profileStatus.textContent = "Please enter your name.";
      return;
    }
    if (!Number.isFinite(budget) || budget <= 0 || budget > 100000000) {
      profileStatus.textContent = "Enter a valid monthly budget.";
      return;
    }
    if (upi && !/^[\w.\-]{2,}@[A-Za-z]{2,}$/.test(upi)) {
      profileStatus.textContent = "UPI ID should look like name@bank.";
      return;
    }

    const settings = personaSettings[persona];
    if (!settings) {
      profileStatus.textContent = "Please select a valid profile.";
      return;
    }

    const limitPaise = Math.round((budget + Number.EPSILON) * 100);
    if (!Number.isSafeInteger(limitPaise)) {
      profileStatus.textContent = "Budget amount is too large.";
      return;
    }

    createProfileBtn.disabled = true;
    profileStatus.textContent = "Creating your profile...";

    try {
      const profile = {
        name,
        upi,
        primary: persona,
        modules: [persona],
        scope: settings.scope,
        categories: settings.categories,
        limitPaise,
        spentPaise: 0,
        businessSpentPaise: 0,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      };

      const docRef = await db.collection("users").add(profile);

      // One shared place for "current user"
      if (typeof window.setCurrentUser === "function")
        window.setCurrentUser(docRef.id);
      else sessionStorage.setItem("equipayUserId", docRef.id);

      document.getElementById("onboarding").classList.add("hidden");
      document.getElementById("welcome").classList.remove("hidden");

      document.getElementById("welcomeTitle").textContent = `Welcome, ${name}!`;
      document.getElementById("welcomeDescription").textContent =
        `Your ${settings.label} profile is ready.`;
      document.getElementById("budgetSummary").textContent =
        `Monthly budget: ${rupees(limitPaise)}`;

      const categoryList = document.getElementById("categoryList");
      categoryList.replaceChildren();
      settings.categories.forEach((category) => {
        const chip = document.createElement("span");
        chip.className = "chip";
        chip.textContent = category;
        categoryList.appendChild(chip);
      });

      profileForm.reset();
      profileStatus.textContent = "";
    } catch (error) {
      console.error("Profile creation error:", error);
      profileStatus.textContent =
        "Could not save profile. Check Firebase connection and Firestore rules.";
    } finally {
      createProfileBtn.disabled = false;
    }
  });

  // FIX: this button now goes to the dashboard
  document.getElementById("backBtn")?.addEventListener("click", () => {
    document.getElementById("welcome").classList.add("hidden");
    if (typeof window.showPage === "function") window.showPage("dashboard");
  });
})();
