/* =========================================================
   EQUIPAY — MAIN APPLICATION
   ========================================================= */
"use strict";

let users = [];
let expenses = [];
let settlements = [];

let unsubscribeUsers = null;
let unsubscribeExpenses = null;
let unsubscribeSettlements = null;
let firstLoadDone = false;

const personaLabels = {
  student: "Student",
  personal: "Personal Finance",
  business: "Small Business",
};

/* -------------------- HELPERS -------------------- */

function byId(id) {
  return document.getElementById(id);
}

function setText(id, value) {
  const el = byId(id);
  if (el) el.textContent = value;
}

function formatMoney(paise) {
  const v = Number(paise);
  return rupees(Number.isFinite(v) ? v : 0);
}

function currentId() {
  return sessionStorage.getItem("equipayUserId");
}

function getSelectedUser() {
  const id = currentId();
  return users.find((u) => u.id === id) || null;
}

function setStatus(message, target = "dashboardStatus") {
  const el = byId(target);
  if (el) el.textContent = message;
}

/* Shared "who am I" for every file */
window.currentUserId = currentId;
window.setCurrentUser = function (id) {
  if (id) sessionStorage.setItem("equipayUserId", id);
  else sessionStorage.removeItem("equipayUserId");
  window.dispatchEvent(
    new CustomEvent("equipay:user-changed", { detail: { id } }),
  );
};

window.addEventListener("equipay:user-changed", () => {
  if (typeof window.loadExpenseForm === "function")
    window.loadExpenseForm(users);
  renderDashboard();
  renderAccount();
});

/* -------------------- PAGE NAVIGATION -------------------- */

const pageIds = {
  dashboard: "dashboard",
  expenses: "expensesPage",
  settle: "settlePage",
  reminders: "remindersPage",
  modules: "modulesPage",
  about: "aboutPage",
  account: "accountPage",
  onboarding: "onboarding",
  login: "loginPage",
};

const pageTitles = {
  dashboard: "Dashboard",
  expenses: "Expenses",
  settle: "Settle up",
  reminders: "Reminders",
  modules: "Your use case",
  about: "About Equipay",
  account: "Account",
  onboarding: "Welcome",
  login: "Welcome to Equipay",
};

function hideAllViews() {
  document
    .querySelectorAll("[data-page-view]")
    .forEach((v) => v.classList.add("hidden"));
}

function showPage(pageName) {
  if (!pageIds[pageName]) return;

  if (pageName !== "login" && pageName !== "onboarding" && !getSelectedUser()) {
    showOnboarding();
    return;
  }

  hideAllViews();

  const page = byId(pageIds[pageName]);
  if (!page) {
    console.warn(`Equipay page element not found: ${pageIds[pageName]}`);
    return;
  }
  page.classList.remove("hidden");

  document.querySelectorAll("[data-page]").forEach((btn) => {
    const active = btn.dataset.page === pageName;
    btn.classList.toggle("active", active);
    if (active) btn.setAttribute("aria-current", "page");
    else btn.removeAttribute("aria-current");
  });

  setText("pageTitle", pageTitles[pageName] || "Equipay");
  closeMobileSidebar();

  try {
    history.replaceState(null, "", `#${pageName}`);
  } catch (e) {}

  if (pageName === "dashboard") renderDashboard();
  if (pageName === "expenses") renderAllExpenses();
  if (pageName === "account") renderAccount();
}

function showOnboarding() {
  hideAllViews();
  const onboarding = byId("onboarding");
  if (onboarding) onboarding.classList.remove("hidden");
  setText("pageTitle", pageTitles.onboarding);
  document.querySelectorAll("[data-page]").forEach((btn) => {
    btn.classList.remove("active");
    btn.removeAttribute("aria-current");
  });
}

function showDashboard() {
  showPage("dashboard");
}

function isPublicPageVisible() {
  return ["loginPage", "onboarding", "welcome"].some((id) => {
    const el = byId(id);
    return el && !el.classList.contains("hidden");
  });
}

window.showPage = showPage;
window.showOnboarding = showOnboarding;
window.showDashboard = showDashboard;

/* -------------------- SIDEBAR AND MENUS -------------------- */

function closeMobileSidebar() {
  const sidebar = document.querySelector(".sidebar");
  const btn = byId("mobileMenuBtn");
  if (sidebar) sidebar.classList.remove("mobile-open");
  if (btn) btn.setAttribute("aria-expanded", "false");
}

function toggleMobileSidebar() {
  const sidebar = document.querySelector(".sidebar");
  const btn = byId("mobileMenuBtn");
  if (!sidebar) return;
  const open = sidebar.classList.toggle("mobile-open");
  if (btn) btn.setAttribute("aria-expanded", String(open));
}

function toggleAccountMenu() {
  const menu = byId("accountMenu");
  const btn = byId("accountMenuBtn");
  if (!menu) {
    showPage("account");
    return;
  }
  const hidden = menu.classList.toggle("hidden");
  if (btn) btn.setAttribute("aria-expanded", String(!hidden));
}

/* "Switch profile" opens the developer profile switcher */
function switchProfile() {
  const dev = byId("developerTools");
  if (dev) {
    dev.open = true;
    dev.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

/* -------------------- EXPENSE LISTS -------------------- */

function getExpenseTimestamp(e) {
  if (e.createdAt?.toMillis) return e.createdAt.toMillis();
  if (typeof e.createdAt === "number") return e.createdAt;
  if (typeof e.createdAt?.seconds === "number")
    return e.createdAt.seconds * 1000;
  return 0;
}

function renderExpenseRows(container, records) {
  if (!container) return;
  container.replaceChildren();

  if (!records.length) {
    const empty = document.createElement("p");
    empty.className = "muted empty-state";
    empty.textContent =
      "No expenses yet. Add your first expense to get started.";
    container.appendChild(empty);
    return;
  }

  records.forEach((expense) => {
    const row = document.createElement("div");
    row.className = "expense-row";

    const info = document.createElement("div");
    info.className = "expense-info";

    const title = document.createElement("strong");
    title.textContent = expense.title || "Untitled expense";

    const detail = document.createElement("small");
    const payer = users.find((u) => u.id === expense.payer);
    detail.textContent = `${expense.category || "Other"} · Paid by ${payer?.name || expense.payer || "Unknown"}`;

    const amount = document.createElement("span");
    amount.className = "expense-amount";
    amount.textContent = formatMoney(Number(expense.amountPaise) || 0);

    info.append(title, detail);
    row.append(info, amount);
    container.appendChild(row);
  });
}

function renderRecentExpenses() {
  const recent = [...expenses]
    .sort((a, b) => getExpenseTimestamp(b) - getExpenseTimestamp(a))
    .slice(0, 5);
  setText(
    "expenseCount",
    `${expenses.length} expense${expenses.length === 1 ? "" : "s"}`,
  );
  renderExpenseRows(byId("recentExpenses"), recent);
}

function renderAllExpenses() {
  const container = byId("allExpensesList");
  if (!container) return;
  const sorted = [...expenses].sort(
    (a, b) => getExpenseTimestamp(b) - getExpenseTimestamp(a),
  );
  setText(
    "allExpensesCount",
    `${sorted.length} expense${sorted.length === 1 ? "" : "s"}`,
  );
  renderExpenseRows(container, sorted);
}

/* -------------------- ACCOUNT -------------------- */

function renderAccount() {
  const user = getSelectedUser();
  const persona =
    personaLabels[user?.primary || "personal"] || "Personal Finance";
  const initial = (user?.name || "U").trim().charAt(0).toUpperCase();

  setText("accountName", user?.name || "Your account");
  setText("accountPageName", user?.name || "Your account");
  setText("accountPersona", persona);
  setText("accountPagePersona", persona);
  setText("accountAvatar", initial);
  setText("accountPageAvatar", initial);
  setText("topbarAvatar", initial);
}

/* -------------------- DASHBOARD (never changes page visibility) -------------------- */

function renderDashboard() {
  renderRecentExpenses();
  renderAllExpenses();

  const user = getSelectedUser();
  if (!user) return;

  const persona = user.primary || "personal";
  const budget = Number(user.limitPaise) || 0;
  const spent =
    (Number(user.spentPaise) || 0) + myShareSpent(expenses, user.id);

  const net = computeNet(expenses, settlements);
  const balance = Number(net[user.id]) || 0;
  const owed = Math.max(balance, 0);
  const owes = Math.max(-balance, 0);

  const remaining = budget - spent;
  const progress =
    budget > 0 ? Math.max(0, Math.min(100, (spent / budget) * 100)) : 0;

  setText("dashboardGreeting", `Hello, ${user.name || "there"}!`);
  setText(
    "dashboardPersona",
    `${personaLabels[persona] || "Personal Finance"} profile`,
  );
  setText("budgetValue", formatMoney(budget));
  setText("spentValue", formatMoney(spent));
  setText("oweValue", formatMoney(owes));
  setText("owedValue", formatMoney(owed));
  setText("remainingValue", formatMoney(remaining));

  const bar = byId("budgetProgress");
  if (bar) {
    bar.style.width = `${progress}%`;
    bar.setAttribute("role", "progressbar");
    bar.setAttribute("aria-valuemin", "0");
    bar.setAttribute("aria-valuemax", "100");
    bar.setAttribute("aria-valuenow", String(Math.round(progress)));
  }

  setText(
    "budgetMessage",
    remaining < 0
      ? `You're over your budget by ${formatMoney(-remaining)}.`
      : `After your spending and your share of group expenses, ${formatMoney(remaining)} remains.`,
  );
  renderAccount();
}

/* -------------------- DEVELOPER DEBUG -------------------- */

function renderDebug() {
  const debug = byId("debug");
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

/* -------------------- DEMO DATA TOOLS -------------------- */

const seedButton = byId("seedBtn");
if (seedButton) {
  seedButton.addEventListener("click", async () => {
    setStatus("Loading demo data...", "status");
    seedButton.disabled = true;
    try {
      const ids = await seedDemo();
      if (!getSelectedUser()) window.setCurrentUser(ids.parth);
      setStatus("Demo data loaded successfully.", "status");
    } catch (error) {
      console.error("Could not load demo data:", error);
      setStatus(
        `Could not load demo data: ${error.message || "Unknown error"}`,
        "status",
      );
    } finally {
      seedButton.disabled = false;
    }
  });
}

const clearButton = byId("clearBtn");
if (clearButton) {
  clearButton.addEventListener("click", async () => {
    if (!confirm("Delete all users, expenses and settlements?")) return;
    setStatus("Clearing data...", "status");
    clearButton.disabled = true;
    try {
      await clearAll();
      window.setCurrentUser(null);
      setStatus("Data cleared.", "status");
      showOnboarding();
    } catch (error) {
      console.error("Could not clear data:", error);
      setStatus(
        `Could not clear data: ${error.message || "Unknown error"}`,
        "status",
      );
    } finally {
      clearButton.disabled = false;
    }
  });
}

/* -------------------- EVENT HANDLERS -------------------- */

byId("switchProfileBtn")?.addEventListener("click", switchProfile);
byId("mobileMenuBtn")?.addEventListener("click", toggleMobileSidebar);
byId("accountMenuBtn")?.addEventListener("click", toggleAccountMenu);

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const navButton = target.closest("[data-page]");
  if (navButton) {
    event.preventDefault();
    byId("accountMenu")?.classList.add("hidden");
    showPage(navButton.dataset.page);
    return;
  }

  const actionButton = target.closest("[data-action]");
  if (actionButton) {
    const action = actionButton.dataset.action;
    if (action === "add-expense") {
      showPage("expenses");
      byId("expenseTitle")?.focus();
    }
    if (action === "view-expenses") showPage("expenses");
    if (action === "view-account") showPage("account");
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeMobileSidebar();
    byId("accountMenu")?.classList.add("hidden");
  }
});

/* -------------------- FIRESTORE LISTENERS -------------------- */

function startListeners() {
  if (unsubscribeUsers) unsubscribeUsers();
  if (unsubscribeExpenses) unsubscribeExpenses();
  if (unsubscribeSettlements) unsubscribeSettlements();

  unsubscribeUsers = listen("users", (data) => {
    users = data;
    window.users = data;

    if (typeof window.loadExpenseForm === "function")
      window.loadExpenseForm(users);

    const id = currentId();
    if (id && !users.some((u) => u.id === id))
      sessionStorage.removeItem("equipayUserId");

    if (!firstLoadDone) {
      firstLoadDone = true;
      if (getSelectedUser()) {
        const hash = location.hash.replace("#", "");
        const target =
          pageIds[hash] && hash !== "login" && hash !== "onboarding"
            ? hash
            : "dashboard";
        showPage(target);
      } else {
        showOnboarding();
      }
    } else if (!getSelectedUser() && !isPublicPageVisible()) {
      showOnboarding();
    }

    renderDashboard();
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
