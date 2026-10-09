// pay.js  (uses the same "viewing as" user as the safe-to-spend card)
(function () {
  let users = [],
    settlements = [];
  const box = document.getElementById("payCard");

  const getMe = () =>
    localStorage.getItem("equipay_safe_user") || (users[0] && users[0].id);
  const nm = (id) => (users.find((u) => u.id === id) || {}).name || id;
  const setStatus = (id, status) =>
    db.collection("settlements").doc(id).update({ status });

  function render() {
    const me = getMe();
    const active = settlements.filter(
      (s) => s.status !== "confirmed" && (s.from === me || s.to === me),
    );
    const toPay = active.filter((s) => s.from === me);
    const toReceive = active.filter((s) => s.to === me);

    const payRow = (s) => {
      const rcv = users.find((u) => u.id === s.to) || {};
      const link = upiLink(
        rcv.upi || "",
        rcv.name || "",
        s.amountPaise,
        "Equipay settle up",
      );
      return `<div class="pay-item">
        <div class="row" style="border:0"><span>Pay <b>${nm(s.to)}</b></span><b>${rupees(s.amountPaise)}</b></div>
        ${
          s.status === "pending"
            ? `<a class="btn" href="${link}">Pay via UPI</a>
             <button data-paid="${s.id}">I've paid</button>`
            : `<span class="tag">Waiting for ${nm(s.to)} to confirm</span>`
        }
      </div>`;
    };

    const rcvRow = (s) => `<div class="pay-item">
      <div class="row" style="border:0"><span><b>${nm(s.from)}</b> pays you</span><b>${rupees(s.amountPaise)}</b></div>
      ${
        s.status === "paid"
          ? `<button data-confirm="${s.id}">Confirm received</button>`
          : `<span class="tag">Not paid yet</span>`
      }
    </div>`;

    box.innerHTML = `
      <h3>Your payments</h3>
      <h4>You need to pay</h4>
      ${toPay.length ? toPay.map(payRow).join("") : '<p class="muted">Nothing to pay 🎉</p>'}
      <h4>You will receive</h4>
      ${toReceive.length ? toReceive.map(rcvRow).join("") : '<p class="muted">Nothing incoming</p>'}`;

    box
      .querySelectorAll("[data-paid]")
      .forEach((b) => (b.onclick = () => setStatus(b.dataset.paid, "paid")));
    box
      .querySelectorAll("[data-confirm]")
      .forEach(
        (b) => (b.onclick = () => setStatus(b.dataset.confirm, "confirmed")),
      );
  }

  listen("users", (d) => {
    users = d;
    render();
  });
  listen("settlements", (d) => {
    settlements = d;
    render();
  });
  // re-render when the "Viewing as" dropdown changes
  document.addEventListener("change", (e) => {
    if (e.target.id === "safeUser") setTimeout(render, 0);
  });
})();
