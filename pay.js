// pay.js  (installments: pay in parts, receiver confirms each part, full log)
(function () {
  "use strict";

  let users = [],
    settlements = [];
  let errorMsg = "";
  const drafts = {}; // remembers what is typed in each amount box across live updates

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
  const instOf = (s) => (Array.isArray(s.installments) ? s.installments : []);
  const sum = (list) =>
    list.reduce((t, i) => t + (Number(i.amountPaise) || 0), 0);

  const paidSoFar = (s) =>
    s.status === "confirmed" || s.status === "paid"
      ? Number(s.amountPaise) || 0
      : sum(instOf(s));
  const remainingOf = (s) =>
    Math.max(0, (Number(s.amountPaise) || 0) - paidSoFar(s));

  const fmtDate = (ms) =>
    ms
      ? new Date(ms).toLocaleString("en-IN", {
          day: "numeric",
          month: "short",
          hour: "numeric",
          minute: "2-digit",
        })
      : "";

  const newId = () => Math.random().toString(36).slice(2, 10);

  /* ---------- writes ---------- */

  async function addInstallment(id, paise) {
    try {
      errorMsg = "";
      await db.runTransaction(async (tx) => {
        const ref = db.collection("settlements").doc(id);
        const snap = await tx.get(ref);
        if (!snap.exists) throw new Error("This payment no longer exists.");
        const s = snap.data();
        const list = instOf(s).slice();
        const remaining = remainingOf(s);
        if (!(paise > 0) || paise > remaining) {
          throw new Error(
            "Enter an amount between ₹0.01 and " + rupees(remaining) + ".",
          );
        }
        list.push({
          id: newId(),
          amountPaise: paise,
          status: "paid",
          at: Date.now(),
        });
        tx.update(ref, { installments: list });
      });
      delete drafts[id];
    } catch (e) {
      console.error(e);
      errorMsg = e.message || "Could not save the payment.";
      render();
    }
  }

  async function confirmInstallment(id, instId) {
    try {
      errorMsg = "";
      await db.runTransaction(async (tx) => {
        const ref = db.collection("settlements").doc(id);
        const snap = await tx.get(ref);
        if (!snap.exists) throw new Error("This payment no longer exists.");
        const s = snap.data();
        const list = instOf(s).map((i) =>
          i.id === instId
            ? { ...i, status: "confirmed", confirmedAt: Date.now() }
            : i,
        );
        const confirmedTotal = sum(
          list.filter((i) => i.status === "confirmed"),
        );
        const update = { installments: list };
        if (confirmedTotal >= (Number(s.amountPaise) || 0))
          update.status = "confirmed";
        tx.update(ref, update);
      });
    } catch (e) {
      console.error(e);
      errorMsg = e.message || "Could not confirm.";
      render();
    }
  }

  // Older records that were marked paid as one full payment
  async function confirmLegacy(id) {
    try {
      errorMsg = "";
      await db
        .collection("settlements")
        .doc(id)
        .update({ status: "confirmed" });
    } catch (e) {
      console.error(e);
      errorMsg = "Could not confirm. Check your connection.";
      render();
    }
  }

  /* ---------- helpers ---------- */

  function readPaise(box, id) {
    const el = box.querySelector('[data-amt="' + id + '"]');
    const v = el ? parseFloat(el.value) : NaN;
    return Number.isFinite(v) ? Math.round(v * 100) : 0;
  }

  function historyEntries(me) {
    const out = [];
    settlements
      .filter((s) => s.from === me || s.to === me)
      .forEach((s) => {
        const list = instOf(s);
        if (list.length) {
          list.forEach((i) =>
            out.push({
              from: s.from,
              to: s.to,
              amount: i.amountPaise,
              status: i.status,
              at: i.confirmedAt || i.at || 0,
            }),
          );
        } else if (s.status === "confirmed" || s.status === "paid") {
          out.push({
            from: s.from,
            to: s.to,
            amount: s.amountPaise,
            status: s.status,
            at: 0,
          });
        }
      });
    return out.sort((a, b) => b.at - a.at).slice(0, 15);
  }

  function installmentLog(s) {
    const list = instOf(s);
    if (!list.length) return "";
    return (
      '<div class="inst-log">' +
      list
        .slice()
        .sort((a, b) => (a.at || 0) - (b.at || 0))
        .map(
          (i) =>
            `<div class="inst-row"><span>${rupees(i.amountPaise)} · ${esc(fmtDate(i.at))}</span>` +
            `<span class="tag">${i.status === "confirmed" ? "Confirmed ✓" : "Waiting for confirmation"}</span></div>`,
        )
        .join("") +
      "</div>"
    );
  }

  /* ---------- render ---------- */

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
      const total = Number(s.amountPaise) || 0;
      const paid = paidSoFar(s);
      const remaining = remainingOf(s);
      const pct = total ? Math.min(100, Math.round((paid / total) * 100)) : 0;

      const progress = `
        <div class="inst-progress"><div style="width:${pct}%"></div></div>
        <p class="muted inst-summary">Paid ${rupees(paid)} of ${rupees(total)} · Remaining <b>${rupees(remaining)}</b></p>`;

      let actions;
      if (remaining <= 0) {
        actions = `<span class="tag">Fully paid. Waiting for ${nm(s.to)} to confirm</span>`;
      } else {
        const draft =
          drafts[s.id] !== undefined
            ? drafts[s.id]
            : (remaining / 100).toFixed(2).replace(/\.00$/, "");
        actions = `
          <div class="inst-form">
            <label class="muted" for="amt-${esc(s.id)}">Amount to send now (₹)</label>
            <div class="inst-controls">
              <input id="amt-${esc(s.id)}" type="number" min="0.01" step="0.01" data-amt="${esc(s.id)}" value="${esc(draft)}">
              <button type="button" class="secondary" data-full="${esc(s.id)}">Full ${rupees(remaining)}</button>
            </div>
          </div>
          <div class="inst-actions">
            ${
              upiOk
                ? `<button type="button" data-upi="${esc(s.id)}" data-vpa="${esc(upi)}" data-name="${esc(rcv.name || "")}">Pay via UPI</button>
                   <button type="button" class="secondary" data-copy="${esc(upi)}">Copy UPI ID</button>`
                : `<span class="tag">${nm(s.to)} has no valid UPI ID yet</span>`
            }
            <button type="button" data-inst="${esc(s.id)}">I've paid this amount</button>
          </div>`;
      }

      return `<div class="pay-item">
        <div class="row" style="border:0"><span>Pay <b>${nm(s.to)}</b></span><b>${rupees(total)}</b></div>
        ${progress}
        ${actions}
        ${installmentLog(s)}
      </div>`;
    };

    const rcvRow = (s) => {
      const total = Number(s.amountPaise) || 0;
      const paid = paidSoFar(s);
      const list = instOf(s);
      const pending = list.filter((i) => i.status === "paid");

      let body = "";
      if (s.status === "paid" && !list.length) {
        body = `<button type="button" data-legacy="${esc(s.id)}">Confirm received</button>`;
      } else if (pending.length) {
        body = pending
          .map(
            (i) => `<div class="inst-row">
              <span>${rupees(i.amountPaise)} sent · ${esc(fmtDate(i.at))}</span>
              <button type="button" data-confirm="${esc(s.id)}" data-inst-id="${esc(i.id)}">Confirm received</button>
            </div>`,
          )
          .join("");
      } else if (!list.length) {
        body = '<span class="tag">Not paid yet</span>';
      }

      return `<div class="pay-item">
        <div class="row" style="border:0"><span><b>${nm(s.from)}</b> pays you</span><b>${rupees(total)}</b></div>
        <p class="muted inst-summary">Received so far: ${rupees(sum(list.filter((i) => i.status === "confirmed")))} · Sent, not confirmed: ${rupees(sum(pending))}</p>
        ${body}
        ${installmentLog(s).replace(/<div class="inst-row"><span>[^]*?<\/div>/g, (m) => m)}
      </div>`;
    };

    const history = historyEntries(me);
    const historyHtml = history.length
      ? history
          .map((h) => {
            const dir =
              h.from === me ? `You → ${nm(h.to)}` : `${nm(h.from)} → You`;
            const when = h.at ? esc(fmtDate(h.at)) : "";
            return `<div class="row"><span>${dir}${when ? " · " + when : ""}</span>
              <span><b>${rupees(h.amount)}</b> <span class="tag">${h.status === "confirmed" ? "Confirmed ✓" : "Awaiting confirmation"}</span></span></div>`;
          })
          .join("")
      : '<p class="muted">No payments yet.</p>';

    box.innerHTML = `
      <h3>Your payments</h3>
      <h4>You need to pay</h4>
      ${toPay.length ? toPay.map(payRow).join("") : '<p class="muted">Nothing to pay 🎉</p>'}
      <h4>You will receive</h4>
      ${toReceive.length ? toReceive.map(rcvRow).join("") : '<p class="muted">Nothing incoming</p>'}
      ${errorMsg ? `<p class="muted" style="color:#b94d4d">${esc(errorMsg)}</p>` : ""}
      <h4>Payment history</h4>
      ${historyHtml}`;

    // remember typed amounts
    box.querySelectorAll("[data-amt]").forEach((el) => {
      el.oninput = () => {
        drafts[el.dataset.amt] = el.value;
      };
    });

    box.querySelectorAll("[data-full]").forEach((b) => {
      b.onclick = () => {
        const s = settlements.find((x) => x.id === b.dataset.full);
        if (!s) return;
        const v = (remainingOf(s) / 100).toFixed(2).replace(/\.00$/, "");
        drafts[s.id] = v;
        const el = box.querySelector('[data-amt="' + s.id + '"]');
        if (el) el.value = v;
      };
    });

    box.querySelectorAll("[data-upi]").forEach((b) => {
      b.onclick = () => {
        const paise = readPaise(box, b.dataset.upi);
        const s = settlements.find((x) => x.id === b.dataset.upi);
        if (!s || paise <= 0 || paise > remainingOf(s)) {
          errorMsg =
            "Enter an amount up to " +
            rupees(s ? remainingOf(s) : 0) +
            " first.";
          render();
          return;
        }
        window.location.href = upiLink(
          b.dataset.vpa,
          b.dataset.name,
          paise,
          "Equipay settle up",
        );
      };
    });

    box.querySelectorAll("[data-inst]").forEach((b) => {
      b.onclick = () =>
        addInstallment(b.dataset.inst, readPaise(box, b.dataset.inst));
    });

    box.querySelectorAll("[data-confirm]").forEach((b) => {
      b.onclick = () => confirmInstallment(b.dataset.confirm, b.dataset.instId);
    });

    box.querySelectorAll("[data-legacy]").forEach((b) => {
      b.onclick = () => confirmLegacy(b.dataset.legacy);
    });

    box.querySelectorAll("[data-copy]").forEach((b) => {
      b.onclick = async () => {
        try {
          await navigator.clipboard.writeText(b.dataset.copy);
          b.textContent = "Copied ✓";
        } catch (e) {
          b.textContent = b.dataset.copy;
        }
      };
    });
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
