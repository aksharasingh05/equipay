/* =========================================
   EQUIPAY — EXPENSE MANAGEMENT
   ========================================= */

(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const expenseForm = $("expenseForm");
  const expenseStatus = $("expenseStatus");
  const expenseCategory = $("expenseCategory");
  const expensePayer = $("expensePayer");
  const participantList = $("participantList");
  const splitPreview = $("splitPreview");
  const saveExpenseBtn = $("saveExpenseBtn");
  const expenseAmount = $("expenseAmount");

  function getCurrentUserId() {
    return sessionStorage.getItem("equipayUserId");
  }

  function getUsers() {
    // Support either a global users array or an app state array.
    if (Array.isArray(window.users)) return window.users;

    if (typeof users !== "undefined" && Array.isArray(users)) {
      return users;
    }

    return [];
  }

  function addPlaceholder(select, message) {
    if (!select) return;

    select.replaceChildren();

    const option = document.createElement("option");
    option.value = "";
    option.textContent = message;
    option.disabled = true;
    option.selected = true;

    select.appendChild(option);
  }

  function showExpenseStatus(message, isError = false) {
    if (!expenseStatus) return;

    expenseStatus.textContent = message;
    expenseStatus.classList.toggle("error", isError);
    expenseStatus.classList.toggle("success", !isError && Boolean(message));
  }

  function loadExpenseForm(availableUsers = getUsers()) {
    const currentId = getCurrentUserId();

    addPlaceholder(expenseCategory, "Loading categories...");
    addPlaceholder(expensePayer, "Loading people...");

    if (participantList) participantList.replaceChildren();

    if (!Array.isArray(availableUsers) || availableUsers.length === 0) {
      addPlaceholder(expenseCategory, "Create a profile first");
      addPlaceholder(expensePayer, "No profiles available");

      if (participantList) {
        const message = document.createElement("p");
        message.className = "muted empty-state";
        message.textContent =
          "Create or load a profile before adding shared expenses.";
        participantList.appendChild(message);
      }

      if (splitPreview) {
        splitPreview.textContent =
          "A profile is needed before calculating the split.";
      }

      return;
    }

    const currentUser = availableUsers.find(
      (user) => String(user.id) === String(currentId),
    );

    if (!currentUser) {
      addPlaceholder(expenseCategory, "Select a valid profile");
      addPlaceholder(expensePayer, "Select a valid profile");

      if (participantList) {
        const message = document.createElement("p");
        message.className = "muted empty-state";
        message.textContent =
          "Your current profile could not be found. Please select or create a profile first.";
        participantList.appendChild(message);
      }

      if (splitPreview) {
        splitPreview.textContent =
          "Select a valid profile to preview the split.";
      }

      return;
    }

    // Categories
    const categories =
      Array.isArray(currentUser.categories) && currentUser.categories.length > 0
        ? currentUser.categories
        : ["Food", "Travel", "Shopping", "Bills", "Other"];

    expenseCategory.replaceChildren();

    categories.forEach((category) => {
      const option = document.createElement("option");
      option.value = category;
      option.textContent = category;
      expenseCategory.appendChild(option);
    });

    // Payer options and participants
    expensePayer.replaceChildren();
    participantList.replaceChildren();

    availableUsers.forEach((user) => {
      const payerOption = document.createElement("option");
      payerOption.value = user.id;
      payerOption.textContent = user.name || user.id;
      expensePayer.appendChild(payerOption);

      const label = document.createElement("label");
      label.className = "participant-option";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = user.id;
      checkbox.name = "expenseParticipant";
      checkbox.checked = String(user.id) === String(currentId);

      const name = document.createElement("span");
      name.textContent = user.name || user.id;

      label.append(checkbox, name);
      participantList.appendChild(label);
    });

    expensePayer.value = currentId;

    updateSplitPreview();
  }

  function getSelectedParticipants() {
    if (!participantList) return [];

    return [
      ...participantList.querySelectorAll(
        'input[name="expenseParticipant"]:checked',
      ),
    ].map((input) => input.value);
  }

  function formatRupeesFromPaise(paise) {
    if (typeof window.rupees === "function") {
      return window.rupees(paise);
    }

    return (paise / 100).toLocaleString("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    });
  }

  function updateSplitPreview() {
    if (!splitPreview || !expenseAmount) return;

    const amount = Number(expenseAmount.value);
    const members = getSelectedParticipants();

    if (!Number.isFinite(amount) || amount <= 0) {
      splitPreview.textContent =
        "Enter an amount and select at least one participant.";
      return;
    }

    if (members.length === 0) {
      splitPreview.textContent =
        "Select at least one participant to calculate the split.";
      return;
    }

    if (
      typeof window.splitEqual !== "function" &&
      typeof splitEqual !== "function"
    ) {
      splitPreview.textContent = `Expense shared by ${members.length} participant(s).`;
      return;
    }

    const totalPaise = Math.round((amount + Number.EPSILON) * 100);

    const shares =
      typeof window.splitEqual === "function"
        ? window.splitEqual(totalPaise, members)
        : splitEqual(totalPaise, members);

    const firstShare = Object.values(shares)[0] || 0;

    splitPreview.textContent =
      `Split among ${members.length} participant(s). ` +
      `Approx. share: ${formatRupeesFromPaise(firstShare)} per person.`;
  }

  async function handleExpenseSubmit(event) {
    event.preventDefault();

    const availableUsers = getUsers();
    const currentId = getCurrentUserId();

    const currentUser = availableUsers.find(
      (user) => String(user.id) === String(currentId),
    );

    if (!currentUser) {
      showExpenseStatus("Please create or select a profile first.", true);
      return;
    }

    const title = $("expenseTitle")?.value.trim();
    const amount = Number(expenseAmount?.value);
    const payer = expensePayer?.value;
    const category = expenseCategory?.value;
    const participants = getSelectedParticipants();

    if (!title) {
      showExpenseStatus("Enter an expense name.", true);
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0 || amount > 100000000) {
      showExpenseStatus("Enter a valid amount.", true);
      return;
    }

    if (!category) {
      showExpenseStatus("Please select an expense category.", true);
      return;
    }

    if (!availableUsers.some((user) => String(user.id) === String(payer))) {
      showExpenseStatus("Please select a valid payer.", true);
      return;
    }

    if (participants.length === 0) {
      showExpenseStatus("Select at least one participant.", true);
      return;
    }

    const amountPaise = Math.round((amount + Number.EPSILON) * 100);

    if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) {
      showExpenseStatus("Invalid amount.", true);
      return;
    }

    const splitFunction =
      typeof window.splitEqual === "function"
        ? window.splitEqual
        : typeof splitEqual === "function"
          ? splitEqual
          : null;

    if (!splitFunction) {
      showExpenseStatus(
        "Split calculator is not available. Please check equipay.js.",
        true,
      );
      return;
    }

    const shares = splitFunction(amountPaise, participants);

    if (!window.db && typeof db === "undefined") {
      showExpenseStatus(
        "Firebase database is not initialized. Check firebase-config.js.",
        true,
      );
      return;
    }

    const database = window.db || (typeof db !== "undefined" ? db : null);

    if (!database) {
      showExpenseStatus("Database is unavailable.", true);
      return;
    }

    if (!window.firebase) {
      showExpenseStatus("Firebase SDK is unavailable.", true);
      return;
    }

    if (saveExpenseBtn) saveExpenseBtn.disabled = true;

    showExpenseStatus("Saving expense...");

    try {
      await database.collection("expenses").add({
        title,
        amountPaise,
        payer,
        category,
        module: currentUser.primary || "personal",
        shares,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });

      expenseForm.reset();

      loadExpenseForm(availableUsers);

      showExpenseStatus("Expense saved successfully!");

      if (typeof window.renderDashboard === "function") {
        window.renderDashboard();
      }

      if (typeof window.refreshEquipay === "function") {
        await window.refreshEquipay();
      }
    } catch (error) {
      console.error("Expense save failed:", error);

      showExpenseStatus(
        "Could not save expense. Check Firestore rules and connection.",
        true,
      );
    } finally {
      if (saveExpenseBtn) saveExpenseBtn.disabled = false;
      updateSplitPreview();
    }
  }

  function initExpenseForm() {
    if (
      !expenseForm ||
      !expenseCategory ||
      !expensePayer ||
      !participantList ||
      !splitPreview ||
      !expenseAmount
    ) {
      console.error(
        "Equipay: expense form elements are missing from index.html.",
      );
      return;
    }

    expenseAmount.addEventListener("input", updateSplitPreview);
    participantList.addEventListener("change", updateSplitPreview);
    expenseForm.addEventListener("submit", handleExpenseSubmit);

    loadExpenseForm();
  }

  // Allow app.js to reload the dropdowns after profiles load/change.
  window.loadExpenseForm = loadExpenseForm;
  window.updateSplitPreview = updateSplitPreview;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initExpenseForm);
  } else {
    initExpenseForm();
  }
})();
