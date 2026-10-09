// simplify.js
(function () {
  let users = [],
    expenses = [],
    settlements = [];
  const box = document.getElementById("simplifyCard");

  function render() {
    const name = (id) => (users.find((u) => u.id === id) || {}).name || id;
    const net = computeNet(expenses, settlements);
    const before = pairwiseDebts(expenses);
    const after = simplify(net);
    const pending = settlements.filter((s) => s.status !== "confirmed");

    const list = (arr) =>
      arr.length
        ? arr
            .map(
              (p) =>
                `<div class="row"><span>${name(p.from)} → ${name(p.to)}</span><b>${rupees(p.amount)}</b></div>`,
            )
            .join("")
        : '<p class="muted">Nothing to settle 🎉</p>';

    box.innerHTML = `
      <h3>Settle up</h3>
      <p><b>${before.length} payments → ${after.length} payments</b></p>
      <h4>Before (raw debts)</h4>${list(before)}
      <h4>After (simplified)</h4>${list(after)}
      <button id="doSimplify">Simplify &amp; create payments</button>
      <p class="muted">${pending.length} active settlement(s)</p>`;

    document.getElementById("doSimplify").onclick = async () => {
      const batch = db.batch();
      // remove old unpaid suggestions, keep paid/confirmed history
      settlements
        .filter((s) => s.status === "pending")
        .forEach((s) => batch.delete(db.collection("settlements").doc(s.id)));
      after.forEach((p) =>
        batch.set(db.collection("settlements").doc(), {
          from: p.from,
          to: p.to,
          amountPaise: p.amount,
          status: "pending",
        }),
      );
      await batch.commit();
    };
  }

  listen("users", (d) => {
    users = d;
    render();
  });
  listen("expenses", (d) => {
    expenses = d;
    render();
  });
  listen("settlements", (d) => {
    settlements = d;
    render();
  });
})();
