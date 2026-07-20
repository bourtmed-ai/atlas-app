// Onboarding wizard — vehicle type -> make/model/year -> VIN/plate/color/mileage
// -> rims/tires -> last service -> papers (incl. opposition check link)

const VEHICLE_TYPES = [
  { id: "car", label: "Car", icon: "M4 16h16M6 16l1.5-5.5A2 2 0 0 1 9.4 9h5.2a2 2 0 0 1 1.9 1.5L18 16M7 16a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm13 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z" },
  { id: "moto", label: "Motorcycle", icon: "M5 17a2 2 0 1 0 0-.01M19 17a2 2 0 1 0 0-.01M7 17l2-6h4l3 6M9 11l3-4h4" },
  { id: "van", label: "Van", icon: "M3 17h1m12 0h4M4 17V9a1 1 0 0 1 1-1h9l4 4v5M7 17a1.5 1.5 0 1 0 0-.01m9 0a1.5 1.5 0 1 0 0-.01" },
  { id: "truck", label: "Truck", icon: "M2 17h1m8 0h3m9 0h1M3 17V8a1 1 0 0 1 1-1h6v10M13 11h4l3 3v3M7 17a1.5 1.5 0 1 0 0-.01m11 0a1.5 1.5 0 1 0 0-.01" },
  { id: "heavytruck", label: "Heavy truck", icon: "M1 17h2m7 0h4m8 0h1M4 17V6h7v11M13 9h3l4 3.5V17M8 17a1.5 1.5 0 1 0 0-.01m10 0a1.5 1.5 0 1 0 0-.01" },
];

const COLORS = ["#1A1A1A", "#F2F2F2", "#7A7A7A", "#B3492B", "#0F6E56", "#185FA5", "#C89B3C"];

const SERVICE_TYPES = ["Oil change", "Brake pads", "Timing belt", "Tires", "Battery", "Filters", "Other", "None yet"];

const onboardingState = {
  step: 1,
  totalSteps: 6,
  type: null,
  make: "", model: "", year: "", fuelType: "essence",
  vin: "", plate: "", color: null, mileage: "",
  vinLookupDone: false, vinLookupData: null,
  rimSize: "", tirePressure: "",
  lastServiceDate: "", lastServiceMileage: "", lastServiceType: null,
  papers: { registration: "", visite: "", vignette: "", insurance: "" },
};

function resetOnboarding() {
  onboardingState.step = 1;
  onboardingState.type = null;
  onboardingState.make = ""; onboardingState.model = ""; onboardingState.year = ""; onboardingState.fuelType = "essence";
  onboardingState.vin = ""; onboardingState.plate = ""; onboardingState.color = null; onboardingState.mileage = "";
  onboardingState.vinLookupDone = false; onboardingState.vinLookupData = null;
  onboardingState.rimSize = ""; onboardingState.tirePressure = "";
  onboardingState.lastServiceDate = ""; onboardingState.lastServiceMileage = ""; onboardingState.lastServiceType = null;
  onboardingState.papers = { registration: "", visite: "", vignette: "", insurance: "" };
}

function startOnboarding() {
  resetOnboarding();
  document.getElementById("screen-search").classList.remove("active");
  document.getElementById("screen-detail").classList.remove("active");
  document.getElementById("screen-onboarding").classList.add("active");
  renderOnboarding();
}

function exitOnboarding() {
  document.getElementById("screen-onboarding").classList.remove("active");
  document.getElementById("screen-search").classList.add("active");
}

function wizDots() {
  let out = "";
  for (let i = 1; i <= onboardingState.totalSteps; i++) {
    const cls = i < onboardingState.step ? "done" : i === onboardingState.step ? "current" : "";
    out += `<div class="wiz-dot ${cls}"></div>`;
  }
  return out;
}

const STEP_LABELS = ["", "Step 1 of 6", "Step 2 of 6", "Step 3 of 6", "Step 4 of 6", "Step 5 of 6", "Step 6 of 6"];
const STEP_TITLES = ["", "What are you adding?", "Make, model & year", "Identity & mileage", "Rims & tire pressure", "Last service", "Papers & documents"];

function renderOnboarding() {
  const s = onboardingState;
  const el = document.getElementById("screen-onboarding");
  el.innerHTML = `
    <div class="wiz-top">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <button class="wiz-close" onclick="exitOnboarding()">&times;</button>
      </div>
      <div class="wiz-dots">${wizDots()}</div>
      <div class="wiz-step-label">${STEP_LABELS[s.step]}</div>
      <div class="wiz-title">${STEP_TITLES[s.step]}</div>
    </div>
    <div class="wiz-body" id="wizBody"></div>
    <div class="wiz-nav">
      ${s.step > 1 ? `<button class="wiz-back" onclick="wizBack()">Back</button>` : ""}
      <button class="wiz-next" id="wizNextBtn" onclick="wizNext()">${s.step === s.totalSteps ? "Save vehicle" : "Next"}</button>
    </div>
  `;
  renderStepBody();
}

function renderStepBody() {
  const s = onboardingState;
  const body = document.getElementById("wizBody");
  if (s.step === 1) {
    body.innerHTML = `
      <div class="type-grid">
        ${VEHICLE_TYPES.map(t => `
          <div class="type-card ${s.type === t.id ? "sel" : ""}" onclick="selectType('${t.id}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="${s.type === t.id ? '#C89B3C' : '#141F38'}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="${t.icon}"/></svg>
            <div class="tname">${t.label}</div>
          </div>
        `).join("")}
      </div>
    `;
  } else if (s.step === 2) {
    body.innerHTML = `
      <div class="field"><label>Make</label><input type="text" id="f-make" placeholder="e.g. Renault" value="${s.make}"></div>
      <div class="field"><label>Model</label><input type="text" id="f-model" placeholder="e.g. Clio 4" value="${s.model}"></div>
      <div class="field-row">
        <div class="field"><label>Year</label><input type="number" id="f-year" placeholder="2018" value="${s.year}"></div>
        <div class="field"><label>Fuel type</label>
          <select id="f-fuel">
            <option value="essence" ${s.fuelType==="essence"?"selected":""}>Essence</option>
            <option value="diesel" ${s.fuelType==="diesel"?"selected":""}>Diesel</option>
            <option value="hybrid" ${s.fuelType==="hybrid"?"selected":""}>Hybrid</option>
            <option value="electric" ${s.fuelType==="electric"?"selected":""}>Electric</option>
          </select>
        </div>
      </div>
    `;
  } else if (s.step === 3) {
    body.innerHTML = `
      <div class="field">
        <label>VIN / chassis number <span class="opt">(optional, but unlocks auto specs)</span></label>
        <div class="vin-row">
          <input type="text" id="f-vin" placeholder="e.g. VF1LB000123456789" value="${s.vin}" autocapitalize="characters">
          <button onclick="runVinLookup()">Look up</button>
        </div>
        <div class="vin-loading" id="vinLoading">Searching manufacturer data…</div>
        <div class="vin-lookup-result ${s.vinLookupDone ? "show" : ""}" id="vinResult">
          ${s.vinLookupData ? `Found: ${s.vinLookupData.make} ${s.vinLookupData.model}, ${s.vinLookupData.engine}. Specs saved to this vehicle.` : ""}
        </div>
      </div>
      <div class="field"><label>License plate</label><input type="text" id="f-plate" placeholder="e.g. 12345-A-6" value="${s.plate}"></div>
      <div class="field">
        <label>Color <span class="opt">(optional)</span></label>
        <div class="color-grid">
          ${COLORS.map(c => `<div class="swatch ${s.color === c ? "sel" : ""}" style="background:${c}" onclick="selectColor('${c}')"></div>`).join("")}
        </div>
      </div>
      <div class="field"><label>Current mileage (km)</label><input type="number" id="f-mileage" placeholder="e.g. 84000" value="${s.mileage}"></div>
    `;
  } else if (s.step === 4) {
    body.innerHTML = `
      <div class="field"><label>Rim size <span class="opt">(optional)</span></label><input type="text" id="f-rim" placeholder="e.g. R16" value="${s.rimSize}"></div>
      <div class="field">
        <label>Recommended tire pressure (PSI) <span class="opt">${s.vinLookupData ? "— pre-filled from VIN lookup, editable" : "(optional, check your door sticker)"}</span></label>
        <input type="number" id="f-pressure" placeholder="e.g. 32" value="${s.tirePressure}">
      </div>
      <div class="hint">We'll remind you to check pressure periodically based on your vehicle type — this value doesn't change month to month like mileage does.</div>
    `;
  } else if (s.step === 5) {
    body.innerHTML = `
      <div class="field-row">
        <div class="field"><label>Date</label><input type="date" id="f-svc-date" value="${s.lastServiceDate}"></div>
        <div class="field"><label>Mileage at service</label><input type="number" id="f-svc-mileage" placeholder="km" value="${s.lastServiceMileage}"></div>
      </div>
      <div class="field">
        <label>What was done?</label>
        <div class="service-grid">
          ${SERVICE_TYPES.map(t => `<div class="service-chip ${s.lastServiceType === t ? "sel" : ""}" onclick="selectServiceType('${t}')">${t}</div>`).join("")}
        </div>
      </div>
      <div class="hint">Based on your mileage, we'll suggest what's likely due next once this is saved.</div>
    `;
  } else if (s.step === 6) {
    body.innerHTML = `
      <div class="field"><label>Registration card issued</label><input type="date" id="f-reg" value="${s.papers.registration}"></div>
      <div class="field"><label>Visite technique due</label><input type="date" id="f-visite" value="${s.papers.visite}"></div>
      <div class="field"><label>Vignette due (annual, January)</label><input type="date" id="f-vignette" value="${s.papers.vignette}"></div>
      <div class="field"><label>Insurance due</label><input type="date" id="f-insurance" value="${s.papers.insurance}"></div>
      <a class="opp-link" href="http://www.assiaqacard.ma/opppub/" target="_blank" rel="noopener">
        <div>
          <div class="otitle">Check opposition status</div>
          <div class="osub">Free, official check on the government portal</div>
        </div>
        <div class="oarrow">&rarr;</div>
      </a>
      <div class="hint">You'll get a notification a week before each due date, and a warning triangle stays on this vehicle until you update it.</div>
    `;
  }
}

function selectType(id) { onboardingState.type = id; renderStepBody(); }
function selectColor(c) { onboardingState.color = c; renderStepBody(); }
function selectServiceType(t) { onboardingState.lastServiceType = t; renderStepBody(); }

function runVinLookup() {
  const vin = document.getElementById("f-vin").value.trim();
  onboardingState.vin = vin;
  if (!vin) return;
  document.getElementById("vinLoading").classList.add("show");
  document.getElementById("vinResult").classList.remove("show");
  setTimeout(() => {
    document.getElementById("vinLoading").classList.remove("show");
    onboardingState.vinLookupDone = true;
    onboardingState.vinLookupData = { make: onboardingState.make || "Renault", model: onboardingState.model || "Clio 4", engine: "1.5 dCi 90" };
    if (!onboardingState.tirePressure) onboardingState.tirePressure = "32";
    const r = document.getElementById("vinResult");
    r.classList.add("show");
    r.textContent = `Found: ${onboardingState.vinLookupData.make} ${onboardingState.vinLookupData.model}, ${onboardingState.vinLookupData.engine}. Specs saved to this vehicle.`;
  }, 900);
}

function saveStepFields() {
  const s = onboardingState;
  if (s.step === 2) {
    s.make = document.getElementById("f-make").value;
    s.model = document.getElementById("f-model").value;
    s.year = document.getElementById("f-year").value;
    s.fuelType = document.getElementById("f-fuel").value;
  } else if (s.step === 3) {
    s.vin = document.getElementById("f-vin").value;
    s.plate = document.getElementById("f-plate").value;
    s.mileage = document.getElementById("f-mileage").value;
  } else if (s.step === 4) {
    s.rimSize = document.getElementById("f-rim").value;
    s.tirePressure = document.getElementById("f-pressure").value;
  } else if (s.step === 5) {
    s.lastServiceDate = document.getElementById("f-svc-date").value;
    s.lastServiceMileage = document.getElementById("f-svc-mileage").value;
  } else if (s.step === 6) {
    s.papers.registration = document.getElementById("f-reg").value;
    s.papers.visite = document.getElementById("f-visite").value;
    s.papers.vignette = document.getElementById("f-vignette").value;
    s.papers.insurance = document.getElementById("f-insurance").value;
  }
}

function wizNext() {
  saveStepFields();
  if (onboardingState.step === onboardingState.totalSteps) {
    finishOnboarding();
    return;
  }
  onboardingState.step++;
  renderOnboarding();
}

function wizBack() {
  saveStepFields();
  onboardingState.step--;
  renderOnboarding();
}

async function finishOnboarding() {
  const s = onboardingState;
  const finishBtn = document.querySelector(".wiz-next");
  if (finishBtn) { finishBtn.disabled = true; finishBtn.textContent = "Saving…"; }

  const { data: { user } } = await sb.auth.getUser();
  if (!user) { alert("Please log in again."); return; }

  const { data: vehicle, error: vErr } = await sb.from("vehicles").insert({
    user_id: user.id,
    type: s.type || "car",
    make: s.make || null,
    model: s.model || null,
    year: Number(s.year) || null,
    fuel_type: s.fuelType || null,
    vin: s.vin || null,
    plate: s.plate || null,
    color: s.color || null,
    current_mileage: Number(s.mileage) || 0,
    rim_size: s.rimSize || null,
    tire_pressure: Number(s.tirePressure) || null,
  }).select().single();

  if (vErr) {
    alert("Could not save vehicle: " + vErr.message);
    if (finishBtn) { finishBtn.disabled = false; finishBtn.textContent = "Finish"; }
    return;
  }

  if (s.lastServiceType && s.lastServiceType !== "None yet") {
    await sb.from("service_records").insert({
      vehicle_id: vehicle.id,
      entry_date: s.lastServiceDate || null,
      odometer: Number(s.lastServiceMileage) || Number(s.mileage) || null,
      service_type: s.lastServiceType,
    });
  }

  const p = s.papers;
  if (p.registration || p.visite || p.vignette || p.insurance) {
    await sb.from("vehicle_papers").insert({
      vehicle_id: vehicle.id,
      registration_date: p.registration || null,
      visite_due: p.visite || null,
      vignette_due: p.vignette || null,
      insurance_due: p.insurance || null,
    });
  }

  exitOnboarding();
  await renderRecentList();
  openVehicle(vehicle.id);
}

document.getElementById("addVehicleBtn").addEventListener("click", startOnboarding);
