// safe.js  (profile switcher + safe-to-spend breakdown, shown in Developer tools)
(function () {
  "use strict";

  let users = [];
  let expenses = [];
  let settlements = [];

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

  function switchTo(id) {
    if (typeof window.setCurrentUser === "function") window.setCurrentUser(id);
    else {
      sessionStorage.setItem("equipayUserId", id);
      window.dispatchEvent(new CustomEvent("equipay:user-changed"));
    }
  }

  function render() {
    const box = document.getElementById("safeCard");
    if (!box) return;

    if (!users.length) {
      box.innerHTML =
        '<p class="muted">No users yet. Load demo data or create a profile.</p>';
      return;
    }

    const me = getMe();
    const user = users.find((u) => u.id === me);

    const select = `
      <label class="muted" for="safeUser">Viewing as
        <select id="safeUser">
          ${user ? "" : '<option value="" selected>Pick a profile…</option>'}
          ${users
            .map(
              (u) =>
                `<option value="${esc(u.id)}" ${u.id === me ? "selected" : ""}>${esc(u.name || "Unnamed")}</option>`,
            )
            .join("")}
        </select>
      </label>`;

    let body = '<p class="muted">Pick a profile to preview their numbers.</p>';

    if (user) {
      const net = computeNet(expenses, settlements);
      const limit = Number(user.limitPaise) || 0;
      const spent = (Number(user.spentPaise) || 0) + myShareSpent(expenses, me);
      const myNet = Number(net[me]) || 0;
      const r = {
        safe: limit - spent,
        owes: myNet < 0 ? -myNet : 0,
        receivable: myNet > 0 ? myNet : 0,
      };
      const cls = r.safe <= 0 ? "bad" : r.safe < limit * 0.2 ? "warn" : "good";

      body = `
        <p class="muted" style="margin-bottom:0">Safe to spend</p>
        <div class="big ${cls}">${rupees(r.safe)}</div>
        <div class="row"><span>Monthly limit</span><span>${rupees(limit)}</span></div>
        <div class="row"><span>Spent so far</span><span>− ${rupees(spent)}</span></div>
        <div class="row"><span>Owed to the group</span><span>− ${rupees(r.owes)}</span></div>
        <div class="row muted"><span>Others owe you (not counted)</span><span>${rupees(r.receivable)}</span></div>`;
    }

    box.innerHTML = select + body;

    box.querySelector("#safeUser").addEventListener("change", (e) => {
      if (e.target.value) switchTo(e.target.value);
    });
  }

  window.addEventListener("equipay:user-changed", render);
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
