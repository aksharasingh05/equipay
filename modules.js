// modules.js
(function () {
  "use strict";

  let users = [];
  let lastMsg = "";

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
  const labelOf = (m) => (PERSONAS[m] && PERSONAS[m].label) || m;
  const catsFor = (m) =>
    (window.personaSettings &&
      window.personaSettings[m] &&
      window.personaSettings[m].categories) ||
    (PERSONAS[m] && PERSONAS[m].categories) ||
    [];
  const scopeOf = (m) =>
    (window.personaSettings &&
      window.personaSettings[m] &&
      window.personaSettings[m].scope) ||
    (PERSONAS[m] && PERSONAS[m].scope) ||
    "personal";

  function render() {
    const box = document.getElementById("modulesCard");
    if (!box) return;

    const u = users.find((x) => x.id === getMe());
    if (!u) {
      box.innerHTML = '<p class="muted">Select a profile first.</p>';
      return;
    }

    // Keep what the person was typing across live updates
    const prevAmt = (document.getElementById("amtIn") || {}).value || "";
    const prevCat = (document.getElementById("catSel") || {}).value || "";

    const primary = PERSONAS[u.primary] ? u.primary : "student";
    const mods = Array.from(new Set([...(u.modules || []), primary])).filter(
      (m) => PERSONAS[m],
    );

    const usecase = Object.keys(PERSONAS)
      .map(
        (k) =>
          `<label><input type="radio" name="primary" value="${k}" ${k === primary ? "checked" : ""}> ${esc(labelOf(k))}</label>`,
      )
      .join("<br>");

    const extras = Object.keys(PERSONAS)
      .map(
        (k) =>
          `<label><input type="checkbox" data-mod="${k}" ${mods.includes(k) ? "checked" : ""} ${k === primary ? "disabled" : ""}> ${esc(labelOf(k))}</label>`,
      )
      .join("");

    const options = mods
      .map(
        (m) =>
          `<optgroup label="${esc(labelOf(m))}">` +
          catsFor(m)
            .map((c) => `<option value="${m}|${esc(c)}">${esc(c)}</option>`)
            .join("") +
          `</optgroup>`,
      )
      .join("");

    box.innerHTML = `
      <h3>Your use case</h3>
      <p class="muted">What best describes how you'll use Equipay?</p>
      ${usecase}
      <p class="muted" style="margin-bottom:0">Also use it for:</p>
      <div class="chips">${extras}</div>

      <h3>Log spending</h3>
      <select id="catSel">${options}</select>
      <input id="amtIn" type="number" min="1" placeholder="Amount ₹">
      <button id="logBtn" type="button">Add</button>
      <p id="logMsg" class="muted">${esc(lastMsg)}</p>
      ${
        mods.includes("business")
          ? `<div class="row"><span>Business spend this month</span><b>${rupees(u.businessSpentPaise || 0)}</b></div>
             <p class="muted">Business spending is kept separate and doesn't reduce your personal Safe-to-spend.</p>`
          : ""
      }`;

    const amt = document.getElementById("amtIn");
    const cat = document.getElementById("catSel");
    if (amt) amt.value = prevAmt;
    if (cat && prevCat) cat.value = prevCat;

    const ref = db.collection("users").doc(u.id);
    const fail = (e) => {
      console.error(e);
      lastMsg = "Could not save. Check your connection.";
      render();
    };

    box.querySelectorAll("input[name=primary]").forEach(
      (r) =>
        (r.onchange = () =>
          ref
            .update({
              primary: r.value,
              modules: Array.from(new Set([...mods, r.value])),
              scope: scopeOf(r.value),
              categories: catsFor(r.value),
            })
            .catch(fail)),
    );

    box.querySelectorAll("[data-mod]").forEach(
      (c) =>
        (c.onchange = () => {
          const m = c.dataset.mod;
          const next = c.checked
            ? Array.from(new Set([...mods, m]))
            : mods.filter((x) => x !== m);
          ref.update({ modules: next }).catch(fail);
        }),
    );

    document.getElementById("logBtn").onclick = async () => {
      const value = document.getElementById("catSel").value;
      if (!value) {
        lastMsg = "Pick a category.";
        render();
        return;
      }
      const m = value.split("|")[0];
      const paise = Math.round(
        parseFloat(document.getElementById("amtIn").value) * 100,
      );
      if (!paise || paise <= 0) {
        lastMsg = "Enter an amount.";
        render();
        return;
      }
      const field =
        scopeOf(m) === "business" ? "businessSpentPaise" : "spentPaise";
      try {
        await ref.update({
          [field]: firebase.firestore.FieldValue.increment(paise),
        });
        lastMsg = `Added ${rupees(paise)} to ${labelOf(m)}.`;
        document.getElementById("amtIn").value = "";
      } catch (e) {
        fail(e);
      }
    };
  }

  window.addEventListener("equipay:user-changed", () => {
    lastMsg = "";
    render();
  });
  listen("users", (d) => {
    users = d;
    render();
  });
})();
