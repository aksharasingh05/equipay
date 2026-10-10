// seed.js  (demo data that keeps existing profiles and budgets)
async function wipe(names) {
  for (const name of names) {
    const snap = await db.collection(name).get();
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

// Full wipe, used only by the "Clear all data" button
async function clearAll() {
  await wipe(["users", "expenses", "settlements"]);
}

async function seedDemo() {
  // Reset activity only. Profiles are kept.
  await wipe(["expenses", "settlements"]);

  const studentCategories = [
    "Food & Outings",
    "Clothes",
    "Trips",
    "Fees",
    "Rent",
    "Commute",
    "Subscriptions",
    "Other",
  ];

  const base = {
    primary: "student",
    scope: "personal",
    categories: studentCategories,
    businessSpentPaise: 0,
    spentPaise: 50000,
  };

  const demoUsers = [
    {
      key: "parth",
      name: "Parth",
      upi: "9359167721@ybl",
      ...base,
      modules: ["student", "personal"],
      limitPaise: 1000000,
    },
    {
      key: "akshara",
      name: "Akshara",
      upi: "aksharasingh340@icici",
      ...base,
      modules: ["student"],
      limitPaise: 1000000,
    },
    {
      key: "abhishek",
      name: "Abhishek",
      upi: "ABHISHEK_REAL_UPI@bank",
      ...base,
      modules: ["student"],
      limitPaise: 800000,
    },
    {
      key: "meera",
      name: "Meera",
      upi: "meera@upi",
      ...base,
      modules: ["student", "personal"],
      limitPaise: 1200000,
    },
  ];

  // Find profiles that already exist (matched by name)
  const snap = await db.collection("users").get();
  const byName = {};
  snap.docs.forEach((d) => {
    byName[
      String((d.data() || {}).name || "")
        .trim()
        .toLowerCase()
    ] = d.id;
  });

  const ids = {}; // demo key -> real document id
  const batch = db.batch();

  demoUsers.forEach((u) => {
    const existingId = byName[u.name.toLowerCase()];
    if (existingId) {
      ids[u.key] = existingId; // keep their budget, UPI and everything else
    } else {
      const { key, ...data } = u;
      ids[u.key] = key; // fixed id for newly created demo people
      batch.set(db.collection("users").doc(key), data);
    }
  });

  const all = Object.values(ids);

  const exp = (payerKey, title, amountPaise, memberKeys, category) => ({
    payer: ids[payerKey],
    title,
    amountPaise,
    category,
    module: "student",
    shares: splitEqual(
      amountPaise,
      memberKeys.map((k) => ids[k]),
    ),
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });

  const keys = demoUsers.map((u) => u.key);

  const expenses = [
    exp("parth", "Flat rent", 2400000, keys, "Rent"),
    exp("akshara", "Groceries", 320000, keys, "Food & Outings"),
    exp("abhishek", "Goa trip hotel", 1800000, keys, "Trips"),
    exp("meera", "Electricity bill", 180000, keys, "Rent"),
    exp(
      "parth",
      "Movie night",
      160000,
      ["parth", "akshara", "abhishek"],
      "Food & Outings",
    ),
    exp("akshara", "Cab to airport", 90000, ["akshara", "meera"], "Trips"),
    exp("abhishek", "Wifi recharge", 70000, keys, "Rent"),
  ];

  expenses.forEach((e) => batch.set(db.collection("expenses").doc(), e));
  await batch.commit();

  return ids;
}
