const status = document.getElementById("status");
const dashboardStatus = document.getElementById("dashboardStatus");

let users = [];
let expenses = [];
let settlements = [];

let selectedUserId = sessionStorage.getItem("equipayUserId");
let unsubscribeUsers = null;
let unsubscribeExpenses = null;
let unsubscribeSettlements = null;

const personaLabels = {
  student: "Student",
  personal: "Personal Finance",
  business: "Small Business",
};

function formatMoney(paise) {
  return rupees(Number.isFinite(paise) ? paise : 0);
}

function getSelectedUser() {
  return users.find((user) => user.id === selectedUserId) || null;
}

function showOnboarding() {
  document.getElementById("onboarding").classList.remove("hidden");
  document.getElementById("welcome").classList.add("hidden");
  document.getElementById("dashboard").classList.add("hidden");
}

function showDashboard() {
  document.getElementById("onboarding").classList.add("hidden");
  document.getElementById("welcome").classList.add("hidden");
  document.getElementById("dashboard").classList.remove("hidden");
}

function renderRecentExpenses(user) {
  const container = document.getElementById("recentExpenses");

  // Newest first. Firestore timestamps may not exist yet for every record.
  const recent = [...expenses]
    .sort((a, b) => {
      const timeA = a.createdAt?.toMillis?.() || 0;
      const timeB = b.createdAt?.toMillis?.() || 0;
      return timeB - timeA;
    })
    .slice(0, 5);

  document.getElementById("expenseCount").textContent =
    `${expenses.length} expense${expenses.length === 1 ? "" : "s"}`;

  container.replaceChildren();

  if (recent.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent =
      "No expenses recorded yet. Add an expense in the next step!";
    container.appendChild(empty);
    return;
  }

  recent.forEach((expense) => {
    const row = document.createElement("div");
    row.className = "expense-row";

    const info = document.createElement("div");
    info.className = "expense-info";

    const title = document.createElement("strong");
    title.textContent = expense.title || "Untitled expense";

    const detail = document.createElement("small");
    const payer = users.find((u) => u.id === expense.payer);
    const payerName = payer?.name || expense.payer || "Unknown";
    detail.textContent = `${expense.category || "Other"} · Paid by ${payerName}`;

    const amount = document.createElement("span");
    amount.className = "expense-amount";
    amount.textContent = formatMoney(Number(expense.amountPaise) || 0);

    info.append(title, detail);
    row.append(info, amount);
    container.appendChild(row);
  });
}

function renderDashboard() {
  const user = getSelectedUser();

  if (!user) {
    document.getElementById("dashboard").classList.add("hidden");
    return;
  }

  showDashboard();

  const persona = user.primary || "personal";
  const budget = Number(user.limitPaise) || 0;

  // Spending is the selected user's allocated share of expenses
  // in their personal scope. This is not necessarily the cash they paid.
  const personalExpenses = expenses.filter(
    (expense) =>
      (expense.module || user.primary || "personal") ===
      (user.primary || "personal"),
  );

  const spent = personalExpenses.reduce((total, expense) => {
    return total + (Number(expense.shares?.[user.id]) || 0);
  }, 0);

  // Balances are calculated for the whole group, then the selected
  // user's net position is displayed.
  const net = computeNet(expenses, settlements);
  const balance = Number(net[user.id]) || 0;

  // Positive = others owe this user; negative = this user owes others.
  const owed = Math.max(balance, 0);
  const owes = Math.max(-balance, 0);

  // Conservative remaining budget: don't count money owed to the user
  // as cash already received.
  const remaining = budget - spent - owes;
  const progress =
    budget > 0 ? Math.max(0, Math.min(100, (spent / budget) * 100)) : 0;

  document.getElementById("dashboardGreeting").textContent =
    `Hello, ${user.name || "there"}!`;

  document.getElementById("dashboardPersona").textContent =
    `${personaLabels[persona] || "Personal Finance"} profile`;

  document.getElementById("budgetValue").textContent = formatMoney(budget);
  document.getElementById("spentValue").textContent = formatMoney(spent);
  document.getElementById("oweValue").textContent = formatMoney(owes);
  document.getElementById("owedValue").textContent = formatMoney(owed);
  document.getElementById("remainingValue").textContent =
    formatMoney(remaining);

  document.getElementById("budgetProgress").style.width = `${progress}%`;

  document.getElementById("budgetMessage").textContent =
    remaining < 0
      ? `You're over your planned budget by ${formatMoney(-remaining)}.`
      : `After your recorded spending and outstanding debts, ${formatMoney(remaining)} remains.`;

  renderRecentExpenses(user);
}

function renderDebug() {
  const debug = document.getElementById("debug");
  if (!debug) return;

  const net = computeNet(expenses, settlements);
  const simplified = simplify(net);

  debug.replaceChildren();

  const heading = document.createElement("strong");
  heading.textContent = "Group net balances";
  debug.appendChild(heading);

  Object.entries(net).forEach(([id, balance]) => {
    const user = users.find((u) => u.id === id);
    const row = document.createElement("div");
    row.className = "row";

    const name = document.createElement("span");
    name.textContent = user?.name || id;

    const amount = document.createElement("span");
    amount.textContent = `${balance >= 0 ? "is owed " : "owes "}${formatMoney(Math.abs(balance))}`;

    row.append(name, amount);
    debug.appendChild(row);
  });

  const summary = document.createElement("p");
  summary.textContent = `Simplified settlement transfers: ${simplified.length}`;
  debug.appendChild(summary);
}

// Developer tools remain available.
document.getElementById("seedBtn").onclick = async () => {
  status.textContent = "Loading demo data...";
  try {
    await seedDemo();
    status.textContent = "Demo data loaded.";
  } catch (error) {
    console.error(error);
    status.textContent = `Could not load demo data: ${error.message}`;
  }
};

document.getElementById("clearBtn").onclick = async () => {
  if (!confirm("Delete all users, expenses and settlements?")) return;

  status.textContent = "Clearing data...";
  try {
    await clearAll();
    status.textContent = "Data cleared.";
  } catch (error) {
    console.error(error);
    status.textContent = `Could not clear data: ${error.message}`;
  }
};

document.getElementById("switchProfileBtn").onclick = () => {
  sessionStorage.removeItem("equipayUserId");
  selectedUserId = null;
  showOnboarding();
};

function startListeners() {
  if (unsubscribeUsers) unsubscribeUsers();
  if (unsubscribeExpenses) unsubscribeExpenses();
  if (unsubscribeSettlements) unsubscribeSettlements();

  unsubscribeUsers = listen("users", (data) => {
    users = data;
    loadExpenseForm(users);

    // The onboarding flow saves the Firestore document ID.
    selectedUserId = sessionStorage.getItem("equipayUserId");

    // Keep the dashboard hidden until a profile is selected.
    if (selectedUserId && getSelectedUser()) {
      renderDashboard();
    } else {
      showOnboarding();
    }

    renderDebug();
  });

  unsubscribeExpenses = listen("expenses", (data) => {
    expenses = data;
    renderDashboard();
    renderDebug();
  });

  unsubscribeSettlements = listen("settlements", (data) => {
    settlements = data;
    renderDashboard();
    renderDebug();
  });
}

startListeners();
