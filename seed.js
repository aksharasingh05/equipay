// seed.js  (demo data: 4 roommates, 7 expenses)
async function clearAll() {
  for (const name of ["users", "expenses", "settlements"]) {
    const snap = await db.collection(name).get();
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

async function seedDemo() {
  await clearAll();

  // Fixed ids so the data is easy to read
  const users = [
    {
      id: "parth",
      name: "Parth",
      upi: "PARTH_REAL_UPI@bank",
      primary: "student",
      modules: ["student", "personal"],
      limitPaise: 1000000,
      spentPaise: 420000,
    },
    {
      id: "akshara",
      name: "Akshara",
      upi: "AKSHARA_REAL_UPI@bank",
      primary: "student",
      modules: ["student"],
      limitPaise: 1000000,
      spentPaise: 310000,
    },
    {
      id: "abhishek",
      name: "Abhishek",
      upi: "ABHISHEK_REAL_UPI@bank",
      primary: "student",
      modules: ["student"],
      limitPaise: 800000,
      spentPaise: 450000,
    },
    {
      id: "meera",
      name: "Meera",
      upi: "meera@upi",
      primary: "student",
      modules: ["student", "personal"],
      limitPaise: 1200000,
      spentPaise: 280000,
    },
  ];
  const all = users.map((u) => u.id);

  const exp = (payer, title, amountPaise, members, category) => ({
    payer,
    title,
    amountPaise,
    category,
    module: "student",
    shares: splitEqual(amountPaise, members),
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });

  const expenses = [
    exp("parth", "Flat rent", 2400000, all, "Rent"),
    exp("akshara", "Groceries", 320000, all, "Food & Outings"),
    exp("abhishek", "Goa trip hotel", 1800000, all, "Trips"),
    exp("meera", "Electricity bill", 180000, all, "Rent"),
    exp(
      "parth",
      "Movie night",
      160000,
      ["parth", "akshara", "abhishek"],
      "Food & Outings",
    ),
    exp("akshara", "Cab to airport", 90000, ["akshara", "meera"], "Trips"),
    exp("abhishek", "Wifi recharge", 70000, all, "Rent"),
  ];
  const batch = db.batch();
  users.forEach((u) => {
    const { id, ...data } = u;
    batch.set(db.collection("users").doc(id), data);
  });
  expenses.forEach((e) => batch.set(db.collection("expenses").doc(), e));
  await batch.commit();
}
