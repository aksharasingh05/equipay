// equipay.js  (all money in integer paise)

// Equal split with remainder distribution: 10000 / 3 -> 3334, 3333, 3333
function splitEqual(total, ids) {
  const base = Math.floor(total / ids.length);
  let rem = total - base * ids.length;
  const shares = {};
  ids.forEach((id) => {
    shares[id] = base + (rem-- > 0 ? 1 : 0);
  });
  return shares;
}

// net: userId -> paise (positive = is owed money, negative = owes money)
function computeNet(expenses, settlements) {
  const net = {};
  const add = (id, v) => {
    net[id] = (net[id] || 0) + v;
  };
  expenses.forEach((e) => {
    add(e.payer, e.amountPaise);
    Object.entries(e.shares).forEach(([uid, p]) => add(uid, -p));
  });
  settlements
    .filter((s) => s.status === "confirmed")
    .forEach((s) => {
      add(s.from, s.amountPaise);
      add(s.to, -s.amountPaise);
    });
  return net;
}

// Greedy: largest debtor pays largest creditor. Gives at most n-1 payments.
function simplify(net) {
  const cred = [],
    debt = [];
  for (const [id, v] of Object.entries(net)) {
    if (v > 0) cred.push({ id, amt: v });
    else if (v < 0) debt.push({ id, amt: -v });
  }
  const out = [];
  while (cred.length && debt.length) {
    cred.sort((a, b) => b.amt - a.amt);
    debt.sort((a, b) => b.amt - a.amt);
    const c = cred[0],
      d = debt[0];
    const x = Math.min(c.amt, d.amt);
    out.push({ from: d.id, to: c.id, amount: x });
    c.amt -= x;
    d.amt -= x;
    if (c.amt === 0) cred.shift();
    if (d.amt === 0) debt.shift();
  }
  return out;
}

// "Before" view: raw pairwise debts, opposite directions cancelled
function pairwiseDebts(expenses) {
  const m = {};
  expenses.forEach((e) => {
    Object.entries(e.shares).forEach(([uid, p]) => {
      if (uid === e.payer || p === 0) return;
      const k = uid + ">" + e.payer;
      m[k] = (m[k] || 0) + p;
    });
  });
  const out = [],
    seen = new Set();
  for (const k of Object.keys(m)) {
    if (seen.has(k)) continue;
    const [a, b] = k.split(">");
    const rev = b + ">" + a;
    seen.add(k);
    seen.add(rev);
    const diff = (m[k] || 0) - (m[rev] || 0);
    if (diff > 0) out.push({ from: a, to: b, amount: diff });
    else if (diff < 0) out.push({ from: b, to: a, amount: -diff });
  }
  return out;
}

// Safe-to-spend uses PERSONAL-scope spending only (business is kept separate)
function safeToSpend(limitPaise, personalSpentPaise, netPaise) {
  const owes = netPaise < 0 ? -netPaise : 0;
  const receivable = netPaise > 0 ? netPaise : 0;
  return { safe: limitPaise - personalSpentPaise - owes, owes, receivable };
}

function upiLink(vpa, name, paise, note) {
  return (
    "upi://pay?pa=" +
    encodeURIComponent(vpa) +
    "&pn=" +
    encodeURIComponent(name) +
    "&am=" +
    (paise / 100).toFixed(2) +
    "&cu=INR&tn=" +
    encodeURIComponent(note)
  );
}

function rupees(paise) {
  return (
    "₹" + (paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })
  );
}

// Personas / use cases
const PERSONAS = {
  student: {
    label: "Student",
    scope: "personal",
    defaultLimitPaise: 1000000,
    categories: ["Food & Outings", "Clothes", "Trips", "Fees", "Rent", "Other"],
  },
  personal: {
    label: "Personal",
    scope: "personal",
    defaultLimitPaise: 3000000,
    categories: ["EMI", "Electricity", "Grocery", "Commute", "Rent", "Other"],
  },
  business: {
    label: "Small Business",
    scope: "business",
    defaultLimitPaise: 20000000,
    categories: ["Salary", "Loan EMI", "Tax/GST", "Rent", "Supplies", "Other"],
  },
};

// Live listener helper: this is your entire real-time sync engine
function listen(collectionName, callback) {
  return db.collection(collectionName).onSnapshot((snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}
// Your own share of all personal-scope shared expenses (business excluded)
function myShareSpent(expenses, uid) {
  return expenses
    .filter((e) => e.module !== "business")
    .reduce((t, e) => t + (Number(e.shares && e.shares[uid]) || 0), 0);
}
