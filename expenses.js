const expenseForm = document.getElementById("expenseForm");
const expenseStatus = document.getElementById("expenseStatus");
const expenseCategory = document.getElementById("expenseCategory");
const expensePayer = document.getElementById("expensePayer");
const participantList = document.getElementById("participantList");
const splitPreview = document.getElementById("splitPreview");
const saveExpenseBtn = document.getElementById("saveExpenseBtn");

function getCurrentUserId() {
  return sessionStorage.getItem("equipayUserId");
}

function loadExpenseForm(users) {
  const currentId = getCurrentUserId();
  const currentUser = users.find((user) => user.id === currentId);

  if (!currentUser) return;

  // Load categories for the selected profile.
  const categories = currentUser.categories || ["Other"];
  expenseCategory.replaceChildren();

  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    expenseCategory.appendChild(option);
  });

  // MVP: all available profiles form one demo group.
  // Real group membership will be implemented separately.
  expensePayer.replaceChildren();
  participantList.replaceChildren();

  users.forEach((user) => {
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
    checkbox.checked = user.id === currentId;

    const name = document.createElement("span");
    name.textContent = user.name || user.id;

    label.append(checkbox, name);
    participantList.appendChild(label);
  });

  expensePayer.value = currentId;
  updateSplitPreview();
}

function getSelectedParticipants() {
  return [
    ...document.querySelectorAll('input[name="expenseParticipant"]:checked'),
  ].map((input) => input.value);
}

function updateSplitPreview() {
  const amount = Number(document.getElementById("expenseAmount").value);
  const members = getSelectedParticipants();

  if (!Number.isFinite(amount) || amount <= 0 || members.length === 0) {
    splitPreview.textContent =
      "Enter an amount and select at least one participant.";
    return;
  }

  const totalPaise = Math.round((amount + Number.EPSILON) * 100);
  const shares = splitEqual(totalPaise, members);
  const firstShare = Object.values(shares)[0] || 0;

  splitPreview.textContent =
    `Split among ${members.length} participant(s). ` +
    `Approx. share: ${rupees(firstShare)} per person.`;
}

document
  .getElementById("expenseAmount")
  .addEventListener("input", updateSplitPreview);

participantList.addEventListener("change", updateSplitPreview);

expenseForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const currentId = getCurrentUserId();
  const currentUser = users.find((user) => user.id === currentId);

  if (!currentUser) {
    expenseStatus.textContent = "Please create or select a profile first.";
    return;
  }

  const title = document.getElementById("expenseTitle").value.trim();
  const amount = Number(document.getElementById("expenseAmount").value);
  const payer = expensePayer.value;
  const category = expenseCategory.value;
  const participants = getSelectedParticipants();

  if (!title) {
    expenseStatus.textContent = "Enter an expense name.";
    return;
  }

  if (!Number.isFinite(amount) || amount <= 0 || amount > 100000000) {
    expenseStatus.textContent = "Enter a valid amount.";
    return;
  }

  if (!users.some((user) => user.id === payer)) {
    expenseStatus.textContent = "Select a valid payer.";
    return;
  }

  if (participants.length === 0) {
    expenseStatus.textContent = "Select at least one participant.";
    return;
  }

  const amountPaise = Math.round((amount + Number.EPSILON) * 100);

  if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) {
    expenseStatus.textContent = "Invalid amount.";
    return;
  }

  const shares = splitEqual(amountPaise, participants);

  saveExpenseBtn.disabled = true;
  expenseStatus.textContent = "Saving expense...";

  try {
    await db.collection("expenses").add({
      title,
      amountPaise,
      payer,
      category,
      module: currentUser.primary || "personal",
      shares,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    expenseForm.reset();
    expensePayer.value = currentId;

    // Restore the category list and default participant selection.
    loadExpenseForm(users);
    expenseStatus.textContent = "Expense saved successfully!";
  } catch (error) {
    console.error("Expense save failed:", error);
    expenseStatus.textContent =
      "Could not save expense. Check Firestore rules and connection.";
  } finally {
    saveExpenseBtn.disabled = false;
    updateSplitPreview();
  }
});
