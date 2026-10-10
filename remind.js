// remind.js (gentle, group-level reminders; no one is named or shamed)
(function () {
  "use strict";

  let users = [],
    expenses = [],
    settlements = [];
  let armed = false; // survives re-renders, so the button state stays correct

  const GENTLE = [
    "Hey! A small settle-up of {amt} is waiting. Whenever you get a minute 🙂",
    "No rush: {amt} is pending for the flat. One tap and it is done.",
    "Quick nudge from Equipay: clearing {amt} keeps everyone's budget accurate.",
  ];
  const FIRM = [
    "Month-end is near. Settling {amt} now keeps your Safe-to-spend honest.",
    "Gentle reminder: {amt} is still pending. A quick UPI payment will clear it.",
  ];

  const getMe = () => sessionStorage.getItem("equipayUserId") || "";

  function owesNow(me) {
    const net = computeNet(expenses, settlements);
    const mine = net[me] || 0;
    return mine < 0 ? -mine : 0;
  }

  function messageFor(owes) {
    const day = new Date().getDate();
    const pool = day >= 25 ? FIRM : GENTLE;
    return pool[day % pool.length].replace("{amt}", rupees(owes));
  }

  const snoozeKey = (me) => "equipay_snooze_" + me;
  function isSnoozed(me) {
    try {
      return Number(localStorage.getItem(snoozeKey(me)) || 0) > Date.now();
    } catch (e) {
      return false;
    }
  }
  function snooze(me) {
    const d = new Date();
    d.setHours(24, 0, 0, 0);
    try {
      localStorage.setItem(snoozeKey(me), String(d.getTime()));
    } catch (e) {}
  }

  function toast(text) {
    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = "🔔 " + text;
    t.style.cssText =
      "position:fixed;top:16px;left:50%;transform:translateX(-50%);" +
      "max-width:440px;width:calc(100% - 32px);background:#1b1f3b;color:#fff;" +
      "padding:14px 16px;border-radius:12px;z-index:9999;font-size:15px;" +
      "box-shadow:0 6px 20px rgba(0,0,0,.25)";
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 8000);
  }

  function render() {
    const box = document.getElementById("remindCard");
    if (!box) return;

    const me = getMe();
    if (!users.some((u) => u.id === me)) {
      box.innerHTML =
        '<h3>Reminders</h3><p class="muted">Select a profile first.</p>';
      return;
    }

    const net = computeNet(expenses, settlements);
    const owes = owesNow(me);
    const groupPending = Object.values(net)
      .filter((v) => v < 0)
      .reduce((t, v) => t - v, 0);
    const open = settlements.filter(
      (s) => s.status === "pending" && s.from === me,
    );

    let html = "<h3>Reminders</h3>";
    html += `<div class="msg">The group has ${rupees(groupPending)} pending in total. Everyone is almost there!</div>`;

    if (owes > 0 && isSnoozed(me)) {
      html += '<p class="muted">Your reminder is snoozed until tomorrow 😴</p>';
    } else if (owes > 0) {
      html += `<div class="msg">${messageFor(owes)}</div>`;
      html += `
        <button id="notifyBtn" type="button" ${armed ? "disabled" : ""}>${armed ? "Reminder set ✓" : "Remind me in 10 seconds"}</button>
        <button class="secondary" id="snoozeBtn" type="button">Snooze until tomorrow</button>`;
    } else {
      html +=
        '<p class="muted">You are all settled up. No reminders for you 🎉</p>';
    }

    if (open.length)
      html += '<p class="muted">Open "Settle up" to pay with UPI.</p>';
    box.innerHTML = html;

    const nb = document.getElementById("notifyBtn");
    if (nb) {
      nb.onclick = () => {
        armed = true;
        render();
        toast("Reminder set. It will appear in 10 seconds.");

        try {
          if ("Notification" in window && Notification.permission === "default")
            Notification.requestPermission();
        } catch (e) {}

        // Uses live data when it fires, not stale values from the click
        setTimeout(() => {
          armed = false;
          const nowOwes = owesNow(me);
          if (nowOwes > 0) {
            const text = messageFor(nowOwes);
            toast(text);
            try {
              if (
                "Notification" in window &&
                Notification.permission === "granted"
              )
                new Notification("Equipay", { body: text });
            } catch (e) {}
          } else {
            toast("You're all settled up. No reminder needed 🎉");
          }
          render();
        }, 10000);
      };
    }

    const sb = document.getElementById("snoozeBtn");
    if (sb) {
      sb.onclick = () => {
        snooze(me);
        toast("Snoozed until tomorrow.");
        render();
      };
    }
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
