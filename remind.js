// remind.js  (gentle, group-level reminders; no one is named or shamed)
(function () {
  let users = [],
    expenses = [],
    settlements = [];
  const box = document.getElementById("remindCard");
  const getMe = () =>
    localStorage.getItem("equipay_safe_user") || (users[0] && users[0].id);

  // rotating, friendly templates ({amt} = the user's own pending amount)
  const GENTLE = [
    "Hey! A small settle-up of {amt} is waiting. Whenever you get a minute 🙂",
    "No rush: {amt} is pending for the flat. One tap and it is done.",
    "Quick nudge from Equipay: clearing {amt} keeps everyone's budget accurate.",
  ];
  const FIRM = [
    "Month-end is near. Settling {amt} now keeps your Safe-to-spend honest.",
    "Gentle reminder: {amt} is still pending. A quick UPI payment will clear it.",
  ];

  function render() {
    const me = getMe();
    const net = computeNet(expenses, settlements);
    const mine = net[me] || 0;
    const owes = mine < 0 ? -mine : 0;
    const groupPending = Object.values(net)
      .filter((v) => v < 0)
      .reduce((a, v) => a - v, 0);
    const open = settlements.filter(
      (s) => s.status === "pending" && s.from === me,
    );
    const day = new Date().getDate();
    const pool = day >= 25 ? FIRM : GENTLE;

    let html = "<h3>Reminders</h3>";
    html += `<div class="msg">The flat has ${rupees(groupPending)} pending in total. Everyone is almost there!</div>`;

    if (owes > 0) {
      const t = pool[new Date().getDate() % pool.length].replace(
        "{amt}",
        rupees(owes),
      );
      html += `<div class="msg">${t}</div>`;
      html += `<button id="notifyBtn">Remind me in 10 seconds</button>
               <button class="secondary" id="snoozeBtn">Snooze until tomorrow</button>`;
    } else {
      html +=
        '<p class="muted">You are all settled up. No reminders for you 🎉</p>';
    }
    if (open.length)
      html +=
        '<p class="muted">Open the "Your payments" card above to pay with UPI.</p>';
    box.innerHTML = html;

    const nb = document.getElementById("notifyBtn");
    if (nb)
      nb.onclick = async () => {
        if ("Notification" in window && Notification.permission === "default")
          await Notification.requestPermission();
        nb.textContent = "Reminder set ✓";
        setTimeout(() => {
          const text = pool[0].replace("{amt}", rupees(owes));
          if ("Notification" in window && Notification.permission === "granted")
            new Notification("Equipay", { body: text });
          else alert(text);
        }, 10000);
      };
    const sb = document.getElementById("snoozeBtn");
    if (sb)
      sb.onclick = () => {
        sb.textContent = "Snoozed ✓";
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
  document.addEventListener("change", (e) => {
    if (e.target.id === "safeUser") setTimeout(render, 0);
  });
})();
