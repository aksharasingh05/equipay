// pay.js
(function () {
  "use strict";

  let users = [],
    settlements = [];
  let errorMsg = "";

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

  const getMe = () => sessionStorage.getItem("equipayUserId") || "";
  const nm = (id) => esc((users.find((u) => u.id === id) || {}).name || id);

  async function setStatus(id, status) {
    try {
      errorMsg = "";
      await db.collection("settlements").doc(id).update({ status });
    } catch (e) {
      console.error(e);
      errorMsg = "Could not update the payment. Check your connection.";
      render();
    }
  }

  function render() {
    const box = document.getElementById("payCard");
    if (!box) return;

    const me = getMe();
    if (!users.some((u) => u.id === me)) {
      box.innerHTML =
        '<h3>Your payments</h3><p class="muted">Select a profile first.</p>';
      return;
    }

    const active = settlements.filter(
      (s) => s.status !== "confirmed" && (s.from === me || s.to === me),
    );
    const toPay = active.filter((s) => s.from === me);
    const toReceive = active.filter((s) => s.to === me);

    const payRow = (s) => {
      const rcv = users.find((u) => u.id === s.to) || {};
      const upi = rcv.upi || "";
      const upiOk = /^[\w.\-]{2,}@[A-Za-z]{2,}$/.test(upi);
      const link = upiLink(
        upi,
        rcv.name || "",
        s.amountPaise,
        "Equipay settle up",
      );
      const linkNoAmt =
        "upi://pay?pa=" +
        encodeURIComponent(upi) +
        "&pn=" +
        encodeURIComponent(rcv.name || "") +
        "&cu=INR";

      let actions;
      if (s.status !== "pending") {
        actions = `<span class="tag">Waiting for ${nm(s.to)} to confirm</span>`;
      } else if (upiOk) {
        actions = `
          <a class="btn" href="${esc(link)}">Pay via UPI</a>
          <a class="btn alt" href="${esc(linkNoAmt)}">Open without amount</a>
          <button type="button" class="secondary" data-copy="${esc(upi)}">Copy UPI ID</button>
          <button type="button" data-paid="${esc(s.id)}">I've paid</button>`;
      } else {
        actions = `
          <span class="tag">${nm(s.to)} has no valid UPI ID yet</span>
          <button type="button" data-paid="${esc(s.id)}">I've paid</button>`;
      }

      return `<div class="pay-item">
        <div class="row" style="border:0"><span>Pay <b>${nm(s.to)}</b></span><b>${rupees(s.amountPaise)}</b></div>
        ${actions}
      </div>`;
    };

    const rcvRow = (s) => `<div class="pay-item">
      <div class="row" style="border:0"><span><b>${nm(s.from)}</b> pays you</span><b>${rupees(s.amountPaise)}</b></div>
      ${
        s.status === "paid"
          ? `<button type="button" data-confirm="${esc(s.id)}">Confirm received</button>`
          : `<span class="tag">Not paid yet</span>`
      }
    </div>`;

    box.innerHTML = `
      <h3>Your payments</h3>
      <h4>You need to pay</h4>
      ${toPay.length ? toPay.map(payRow).join("") : '<p class="muted">Nothing to pay 🎉</p>'}
      <h4>You will receive</h4>
      ${toReceive.length ? toReceive.map(rcvRow).join("") : '<p class="muted">Nothing incoming</p>'}
      ${errorMsg ? `<p class="muted">${esc(errorMsg)}</p>` : ""}`;

    box
      .querySelectorAll("[data-paid]")
      .forEach((b) => (b.onclick = () => setStatus(b.dataset.paid, "paid")));
    box
      .querySelectorAll("[data-confirm]")
      .forEach(
        (b) => (b.onclick = () => setStatus(b.dataset.confirm, "confirmed")),
      );
    box.querySelectorAll("[data-copy]").forEach(
      (b) =>
        (b.onclick = async () => {
          try {
            await navigator.clipboard.writeText(b.dataset.copy);
            b.textContent = "Copied ✓";
          } catch (e) {
            b.textContent = b.dataset.copy;
          }
        }),
    );
  }

  window.addEventListener("equipay:user-changed", render);
  listen("users", (d) => {
    users = d;
    render();
  });
  listen("settlements", (d) => {
    settlements = d;
    render();
  });
})();
