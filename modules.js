// modules.js  (uses the same "viewing as" user as the other cards)
(function () {
  let users = [];
  const box = document.getElementById("modulesCard");
  const getMe = () =>
    localStorage.getItem("equipay_safe_user") || (users[0] && users[0].id);

  function render() {
    const u = users.find((x) => x.id === getMe());
    if (!u) {
      box.innerHTML = '<p class="muted">No user selected.</p>';
      return;
    }
    const primary = u.primary || "student";
    const mods = Array.from(new Set([...(u.modules || []), primary]));

    const usecase = Object.entries(PERSONAS)
      .map(
        ([k, p]) =>
          `<label><input type="radio" name="primary" value="${k}" ${k === primary ? "checked" : ""}> ${p.label}</label>`,
      )
      .join("<br>");

    const extras = Object.entries(PERSONAS)
      .map(
        ([k, p]) =>
          `<label><input type="checkbox" data-mod="${k}" ${mods.includes(k) ? "checked" : ""} ${k === primary ? "disabled" : ""}> ${p.label}</label>`,
      )
      .join("");

    const options = mods
      .map(
        (m) =>
          `<optgroup label="${PERSONAS[m].label}">` +
          PERSONAS[m].categories
            .map((c) => `<option value="${m}|${c}">${c}</option>`)
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
      <button id="logBtn">Add</button>
      <p id="logMsg" class="muted"></p>
      ${
        mods.includes("business")
          ? `<div class="row"><span>Business spend this month</span><b>${rupees(u.businessSpentPaise || 0)}</b></div>
           <p class="muted">Business spending is kept separate and doesn't reduce your personal Safe-to-spend.</p>`
          : ""
      }`;

    const ref = db.collection("users").doc(u.id);

    box
      .querySelectorAll("input[name=primary]")
      .forEach(
        (r) =>
          (r.onchange = () =>
            ref.update({
              primary: r.value,
              modules: Array.from(new Set([...mods, r.value])),
            })),
      );

    box.querySelectorAll("[data-mod]").forEach(
      (c) =>
        (c.onchange = () => {
          const m = c.dataset.mod;
          const next = c.checked
            ? Array.from(new Set([...mods, m]))
            : mods.filter((x) => x !== m);
          ref.update({ modules: next });
        }),
    );

    document.getElementById("logBtn").onclick = async () => {
      const [m] = document.getElementById("catSel").value.split("|");
      const paise = Math.round(
        parseFloat(document.getElementById("amtIn").value) * 100,
      );
      if (!paise || paise <= 0) {
        document.getElementById("logMsg").textContent = "Enter an amount.";
        return;
      }
      const field =
        PERSONAS[m].scope === "business" ? "businessSpentPaise" : "spentPaise";
      await ref.update({
        [field]: firebase.firestore.FieldValue.increment(paise),
      });
    };
  }

  listen("users", (d) => {
    users = d;
    render();
  });
  document.addEventListener("change", (e) => {
    if (e.target.id === "safeUser") setTimeout(render, 0);
  });
})();
