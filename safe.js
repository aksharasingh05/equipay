// safe.js
(function () {
  let users = [],
    expenses = [],
    settlements = [];
  const box = document.getElementById("safeCard");
  let me = localStorage.getItem("equipay_safe_user") || "";

  function render() {
    if (!users.length) {
      box.innerHTML = '<p class="muted">No users yet.</p>';
      return;
    }
    if (!users.find((u) => u.id === me)) me = users[0].id;
    const u = users.find((x) => x.id === me);

    const net = computeNet(expenses, settlements);
    const myNet = net[me] || 0;
    const limit = u.limitPaise || 0;
    const spent = u.spentPaise || 0;
    const r = safeToSpend(limit, spent, myNet);

    const cls = r.safe <= 0 ? "bad" : r.safe < limit * 0.2 ? "warn" : "good";

    box.innerHTML = `
      <label class="muted">Viewing as
        <select id="safeUser">
          ${users.map((x) => `<option value="${x.id}" ${x.id === me ? "selected" : ""}>${x.name}</option>`).join("")}
        </select>
      </label>
      <p class="muted" style="margin-bottom:0">Safe to spend</p>
      <div class="big ${cls}">${rupees(r.safe)}</div>
      <div class="row"><span>Monthly limit</span><span>${rupees(limit)}</span></div>
      <div class="row"><span>Spent so far</span><span>− ${rupees(spent)}</span></div>
      <div class="row"><span>Owed to the flat</span><span>− ${rupees(r.owes)}</span></div>
      <div class="row muted"><span>Others owe you (not counted)</span><span>${rupees(r.receivable)}</span></div>`;

    document.getElementById("safeUser").onchange = (e) => {
      me = e.target.value;
      localStorage.setItem("equipay_safe_user", me);
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
