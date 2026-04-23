// Pricing Calculator — mock interactivity.
// Backend (Google Sheet post, quote PDF, mailto) not wired yet.

const RATES = {
  apac: { "non-exclusive": 4.80, exclusive: 7.96 },
  latam: { "non-exclusive": 8.50, exclusive: 14.11 },
};

const state = {
  apac: { hours: 70000, licence: "non-exclusive" },
  latam: { hours: 30000, licence: "non-exclusive" },
};

const GATE_DESTINATIONS = {
  spec: {
    eyebrow: "Spec sheet",
    title: "Access the dataset spec sheet.",
    intro: "Enter your details and we'll open the PDF in a new tab.",
    submit: "Open spec sheet",
    url: "https://drive.google.com/file/d/1EJNm6yoKtTl9EadykMnODoOg7zwOEeT0/view?usp=sharing",
  },
  samples: {
    eyebrow: "Samples",
    title: "Browse representative sample clips.",
    intro: "Enter your details and we'll open the sample index in a new tab.",
    submit: "Open samples",
    url: "https://docs.google.com/spreadsheets/d/1j9zLG9V6roA0YyZ0iXxCV0_eADoGG-qLVk3dwKG4oC8/edit?usp=sharing",
  },
  talk: {
    eyebrow: "Talk to the team",
    title: "We'll follow up within one business day.",
    intro: "Share a few details and a member of the team will reach out.",
    submit: "Submit",
    url: null,
  },
};

// Google Apps Script web-app endpoint that appends form submissions to the
// lead-capture sheet (1kAd0Ppy...qtxmo). Paste the "Web app URL" you get
// after deploying the Apps Script (see README / setup instructions).
const SHEET_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbw4LlyjEUKyU3qodgKatzx0a8Z-wlV5tu0umvFroD0IV_WL_gWc3ZxvClzsxPBn31tOgg/exec";

async function submitToSheet(payload) {
  if (!SHEET_WEBAPP_URL || SHEET_WEBAPP_URL.startsWith("PASTE_")) return;
  const form = new FormData();
  Object.entries(payload).forEach(([k, v]) => form.append(k, String(v ?? "")));
  try {
    await fetch(SHEET_WEBAPP_URL, {
      method: "POST",
      mode: "no-cors",
      body: form,
    });
  } catch (err) {
    console.warn("Sheet submission failed:", err);
  }
}

const fmt = new Intl.NumberFormat("en-US");
const fmt2 = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const licenceLabel = (v) => (v === "exclusive" ? "Exclusive" : "Non-exclusive");

function render() {
  const apacSub = state.apac.hours * RATES.apac[state.apac.licence];
  const latamSub = state.latam.hours * RATES.latam[state.latam.licence];
  const total = apacSub + latamSub;
  const totalHours = state.apac.hours + state.latam.hours;
  const effective = totalHours > 0 ? total / totalHours : 0;

  document.getElementById("apac-hours-out").textContent = fmt.format(state.apac.hours);
  document.getElementById("apac-rate").textContent = fmt2.format(RATES.apac[state.apac.licence]);
  document.getElementById("apac-licence-label").textContent = licenceLabel(state.apac.licence);
  document.getElementById("apac-subtotal").textContent = fmt2.format(apacSub);

  document.getElementById("latam-hours-out").textContent = fmt.format(state.latam.hours);
  document.getElementById("latam-rate").textContent = fmt2.format(RATES.latam[state.latam.licence]);
  document.getElementById("latam-licence-label").textContent = licenceLabel(state.latam.licence);
  document.getElementById("latam-subtotal").textContent = fmt2.format(latamSub);

  document.getElementById("total-hours").textContent = fmt.format(totalHours);
  document.getElementById("effective-rate").textContent =
    totalHours > 0 ? fmt2.format(effective) : "0.00";
  document.getElementById("grand-total").textContent = fmt2.format(total);
}

function syncInputsFromState() {
  document.getElementById("apac-hours").value = state.apac.hours;
  document.getElementById("latam-hours").value = state.latam.hours;
  ["apac", "latam"].forEach((region) => {
    document
      .querySelectorAll(`input[name="${region}-licence"]`)
      .forEach((r) => (r.checked = r.value === state[region].licence));
  });
}

const parseHours = (raw) => {
  const n = parseInt(raw, 10);
  return isNaN(n) || n < 0 ? 0 : n;
};

// Hours inputs
["apac", "latam"].forEach((region) => {
  document.getElementById(`${region}-hours`).addEventListener("input", (e) => {
    state[region].hours = parseHours(e.target.value);
    render();
    updateHashDebounced();
  });
});

// Licence radios (segmented control)
["apac", "latam"].forEach((region) => {
  document
    .querySelectorAll(`input[name="${region}-licence"]`)
    .forEach((r) =>
      r.addEventListener("change", (e) => {
        if (!e.target.checked) return;
        state[region].licence = e.target.value;
        render();
        updateHash();
      })
    );
});

// Reset
document.getElementById("reset-btn").addEventListener("click", () => {
  state.apac = { hours: 0, licence: "non-exclusive" };
  state.latam = { hours: 0, licence: "non-exclusive" };
  syncInputsFromState();
  render();
  updateHash();
});

// URL hash persistence (shareable by copying the address bar)
function updateHash() {
  const p = new URLSearchParams();
  p.set("a", state.apac.hours);
  p.set("al", state.apac.licence === "exclusive" ? "e" : "n");
  p.set("l", state.latam.hours);
  p.set("ll", state.latam.licence === "exclusive" ? "e" : "n");
  history.replaceState(null, "", `#${p.toString()}`);
}
let hashTimer = null;
function updateHashDebounced() {
  clearTimeout(hashTimer);
  hashTimer = setTimeout(updateHash, 250);
}
function readHash() {
  if (!location.hash) return;
  const p = new URLSearchParams(location.hash.slice(1));
  if (p.has("a")) state.apac.hours = parseHours(p.get("a"));
  if (p.has("l")) state.latam.hours = parseHours(p.get("l"));
  if (p.get("al") === "e") state.apac.licence = "exclusive";
  if (p.get("ll") === "e") state.latam.licence = "exclusive";
}

// ===== Info-capture gate =====
const modal = document.getElementById("gate-modal");
const gateEyebrow = document.getElementById("gate-eyebrow");
const gateTitle = document.getElementById("gate-title");
const gateIntro = document.getElementById("gate-intro");
const gateSubmit = document.getElementById("gate-submit");
const gateForm = document.getElementById("gate-form");
let activeGate = null;

function openGate(key) {
  const dest = GATE_DESTINATIONS[key];
  if (!dest) return;
  activeGate = key;
  gateEyebrow.textContent = dest.eyebrow;
  gateTitle.textContent = dest.title;
  gateIntro.textContent = dest.intro;
  gateSubmit.firstChild.nodeValue = dest.submit + " ";
  gateForm.reset();
  gateForm.hidden = false;
  modal.hidden = false;
  setTimeout(() => gateForm.querySelector('input[name="name"]').focus(), 40);
}

function closeGate() {
  modal.hidden = true;
  activeGate = null;
}

document.querySelectorAll("[data-gate]").forEach((el) => {
  el.addEventListener("click", (e) => {
    e.preventDefault();
    openGate(el.dataset.gate);
  });
});

document.getElementById("modal-close").addEventListener("click", closeGate);
modal.addEventListener("click", (e) => {
  if (e.target === modal) closeGate();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modal.hidden) closeGate();
});

gateForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!gateForm.checkValidity()) {
    gateForm.reportValidity();
    return;
  }
  const dest = GATE_DESTINATIONS[activeGate];
  const data = new FormData(gateForm);

  const payload = {
    timestamp: new Date().toISOString(),
    gate: activeGate,
    name: data.get("name"),
    email: data.get("email"),
    organization: data.get("organization"),
  };

  // Only attach configurator state when the user explicitly requested a quote.
  // Spec Sheet / Samples users never configured anything — leave those columns blank.
  if (activeGate === "talk") {
    const apacSub = state.apac.hours * RATES.apac[state.apac.licence];
    const latamSub = state.latam.hours * RATES.latam[state.latam.licence];
    Object.assign(payload, {
      apac_hours: state.apac.hours,
      apac_licence: state.apac.licence,
      latam_hours: state.latam.hours,
      latam_licence: state.latam.licence,
      total_usd: apacSub + latamSub,
    });
  }

  submitToSheet(payload);

  if (dest?.url) {
    window.open(dest.url, "_blank", "noopener");
    closeGate();
  } else {
    // Talk-to-team: confirm in place, auto-close.
    gateTitle.textContent = "Thanks — we'll be in touch.";
    gateIntro.textContent = "A member of the team will follow up within one business day.";
    gateForm.hidden = true;
    setTimeout(closeGate, 2200);
  }
});

// Init
readHash();
syncInputsFromState();
render();
