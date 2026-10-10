// simplify.js
(function () {
  "use strict";

  let users = [],
    expenses = [],
    settlements = [];
  let busy = false;

  const esc = (v) =>
    String(v).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );

  function render() {
    const box = document.getElementById("simplifyCard");
    if (!box) return;

    const name = (id) => esc((users.find((u) => u.id === id) || {}).name || id);

    // Payments marked "paid" already count as settled, so Simplify never duplicates them.
    const effective = settlements.map((s) =>
      s.status === "paid" ? { ...s, status: "confirmed" } : s,
    );
    const net = computeNet(expenses, effective);
    const before = pairwiseDebts(expenses);
    const after = simplify(net);
    const active = settlements.filter((s) => s.status !== "confirmed");

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
      <button id="doSimplify" type="button" ${busy ? "disabled" : ""}>${busy ? "Working…" : "Simplify &amp; create payments"}</button>
      <p class="muted">${active.length} active settlement(s)</p>
      <p id="simplifyMsg" class="muted"></p>`;

    document.getElementById("doSimplify").onclick = async () => {
      busy = true;
      render();
      try {
        const batch = db.batch();
        // Replace only unpaid suggestions; keep paid and confirmed history.
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
      } catch (e) {
        console.error(e);
        busy = false;
        render();
        const m = document.getElementById("simplifyMsg");
        if (m)
          m.textContent = "Could not create payments. Check your connection.";
        return;
      }
      busy = false;
      render();
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
