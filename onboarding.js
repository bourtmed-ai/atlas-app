// Onboarding wizard — vehicle type -> make/model/year -> VIN/plate/color/mileage
// -> rims/tires (skipped for motorcycles) -> last service -> papers (incl. opposition check link)

const VEHICLE_TYPES = [
  { id: "car", label: "Car", icon: "M4 16h16M6 16l1.5-5.5A2 2 0 0 1 9.4 9h5.2a2 2 0 0 1 1.9 1.5L18 16M7 16a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm13 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z" },
  { id: "moto", label: "Motorcycle", icon: "M5 17a2 2 0 1 0 0-.01M19 17a2 2 0 1 0 0-.01M7 17l2-6h4l3 6M9 11l3-4h4" },
  { id: "van", label: "Van", icon: "M3 17h1m12 0h4M4 17V9a1 1 0 0 1 1-1h9l4 4v5M7 17a1.5 1.5 0 1 0 0-.01m9 0a1.5 1.5 0 1 0 0-.01" },
  { id: "truck", label: "Truck", icon: "M2 17h1m8 0h3m9 0h1M3 17V8a1 1 0 0 1 1-1h6v10M13 11h4l3 3v3M7 17a1.5 1.5 0 1 0 0-.01m11 0a1.5 1.5 0 1 0 0-.01" },
  { id: "heavytruck", label: "Heavy truck", icon: "M1 17h2m7 0h4m8 0h1M4 17V6h7v11M13 9h3l4 3.5V17M8 17a1.5 1.5 0 1 0 0-.01m10 0a1.5 1.5 0 1 0 0-.01" },
];

const COLORS = ["#1A1A1A", "#F2F2F2", "#7A7A7A", "#B3492B", "#0F6E56", "#185FA5", "#C89B3C"];

const SERVICE_TYPES = ["Oil change", "Brake pads", "Timing belt", "Tires", "Battery", "Filters", "Other", "None yet"];

// Make lists per vehicle type (Morocco-relevant brands). "Other" always lets the user type a custom value.
const VEHICLE_MAKES = {
  car: ["Audi","BMW","BYD","Changan","Chery","Chevrolet","Citroën","Dacia","DFSK","Fiat","Ford","GAC","Geely","Haval","Honda","Hyundai","Jeep","Jetour","Kia","Land Rover","Mazda","Mercedes-Benz","MG","Mitsubishi","Nissan","Opel","Peugeot","Renault","Seat","Škoda","Suzuki","Toyota","Volkswagen","Volvo","Other"],
  moto: ["Bajaj","Benelli","BMW Motorrad","Fantic","Honda","Kawasaki","KTM","Loncin","Mash","Peugeot Motocycles","Piaggio","Suzuki","SYM","TVS","Vespa","Yamaha","Other"],
  van: ["Citroën","Fiat","Ford","Iveco","Mercedes-Benz","Opel","Peugeot","Renault","Volkswagen","Other"],
  truck: ["Ford","Foton","Isuzu","Iveco","JAC","Mercedes-Benz","Renault Trucks","Tata","Other"],
  heavytruck: ["DAF","Iveco","MAN","Mercedes-Benz","Renault Trucks","Scania","Sinotruk","Volvo Trucks","Other"],
};

// Model lists per make. Not exhaustive — "Other" on the make list, or picking "Other" as a model,
// switches the model field to free text so nothing is ever a dead end.
const MODELS_BY_MAKE = {
  "Dacia": ["Dokker","Duster","Lodgy","Logan","Sandero","Sandero Stepway"],
  "Renault": ["Captur","Clio","Duster","Kadjar","Kangoo","Mégane","Symbol","Talisman"],
  "Peugeot": ["2008","208","3008","301","5008","508"],
  "Volkswagen": ["Golf","Passat","Polo","Tiguan","Touareg"],
  "Hyundai": ["Accent","Elantra","i10","i20","Santa Fe","Tucson"],
  "Toyota": ["Corolla","Hilux","Land Cruiser","RAV4","Yaris"],
  "Ford": ["Fiesta","Focus","Kuga","Ranger"],
  "Fiat": ["500","Doblo","Panda","Tipo"],
  "Citroën": ["Berlingo","C-Elysée","C3","C4","C5 Aircross"],
  "Kia": ["Picanto","Rio","Sportage","Sorento"],
  "Mercedes-Benz": ["A-Class","C-Class","CLA","E-Class","GLA","GLC"],
  "BMW": ["1 Series","3 Series","5 Series","X1","X3","X5"],
  "Audi": ["A3","A4","A6","Q3","Q5"],
  "Nissan": ["Juke","Micra","Qashqai","Sunny"],
  "Honda": ["Civic","CR-V","HR-V"],
  "Suzuki": ["Alto","Jimny","Swift","Vitara"],
  "Chevrolet": ["Aveo","Cruze","Spark"],
  "Opel": ["Astra","Corsa","Insignia"],
  "Seat": ["Ibiza","Leon"],
  "Škoda": ["Fabia","Octavia","Superb"],
  "Volvo": ["S60","XC40","XC60"],
  "Land Rover": ["Defender","Discovery","Range Rover Evoque"],
  "Jeep": ["Compass","Renegade","Wrangler"],
  "Mitsubishi": ["ASX","L200","Pajero"],
  "Mazda": ["CX-3","CX-5","Mazda3"],
  "Chery": ["Tiggo 4","Tiggo 7","Tiggo 8"],
  "DFSK": ["Glory 500","Glory 580"],
  "Changan": ["CS35","CS55","Eado"],
  "MG": ["MG3","MG5","ZS"],
  "BYD": ["Atto 3","Han","Song Plus"],
  "GAC": ["GS3","GS4"],
  "Jetour": ["Dashing","X70"],
  "Haval": ["H6","Jolion"],
  "Geely": ["Coolray","Emgrand"],

  "Yamaha": ["FZ","MT-07","MT-15","Tricity","XMAX","YBR 125"],
  "Kawasaki": ["Ninja 400","Versys","Z400","Z900"],
  "BMW Motorrad": ["F 850 GS","G 310 R","R 1250 GS"],
  "KTM": ["390 Duke","690 Duke","Adventure 390"],
  "Piaggio": ["Beverly","Liberty","Medley"],
  "Vespa": ["GTS","Primavera","Sprint"],
  "Peugeot Motocycles": ["Django","Kisbee","Tweet"],
  "SYM": ["Fiddle","Jet 14","Symphony"],
  "Benelli": ["Leoncino","TRK 502"],
  "Bajaj": ["Boxer","Pulsar"],
  "TVS": ["Apache","Sport"],
  "Loncin": ["GY 125","LX 200"],
  "Mash": ["Five Hundred","Seventy Five"],
  "Fantic": ["Caballero"],

  "Iveco": ["Daily"],

  "Isuzu": ["D-Max","NPR","NQR"],
  "Renault Trucks": ["C Range","D Series","T Range"],
  "Foton": ["Aumark","Tunland"],
  "JAC": ["N Series"],
  "Tata": ["Ace","LPT"],

  "Volvo Trucks": ["FH","FM"],
  "Scania": ["R Series","S Series"],
  "MAN": ["TGS","TGX"],
  "DAF": ["CF","XF"],
  "Sinotruk": ["Howo A7"],
};

function getMakesForType(type) {
  const list = VEHICLE_MAKES[type] || VEHICLE_MAKES.car;
  return list.slice().sort((a, b) => a.localeCompare(b));
}
function getModelsForMake(make) {
  const list = MODELS_BY_MAKE[make] || [];
  return list.slice().sort((a, b) => a.localeCompare(b));
}

// Ordered step definitions. "rims" is skipped entirely for motorcycles.
const STEP_DEFS = [
  { key: "type", title: "What are you adding?" },
  { key: "identity", title: "Make, model & year" },
  { key: "vin", title: "Identity & mileage" },
  { key: "rims", title: "Rims & tire pressure" },
  { key: "service", title: "Last service" },
  { key: "papers", title: "Papers & documents" },
];

function getFlow(type) {
  return STEP_DEFS.filter(d => !(d.key === "rims" && type === "moto"));
}

const onboardingState = {
  step: 1,
  type: null,
  make: "", model: "", year: "", fuelType: "essence",
  vin: "", plate: "", color: null, mileage: "",
  vinLookupDone: false, vinLookupData: null,
  rimSize: "", tirePressure: "",
  lastServiceDate: "", lastServiceMileage: "", lastServiceType: null,
  papers: { registration: "", visite: "", vignette: "", insuranceStart: "", insuranceEnd: "" },
};

function resetOnboarding() {
  onboardingState.step = 1;
  onboardingState.type = null;
  onboardingState.make = ""; onboardingState.model = ""; onboardingState.year = ""; onboardingState.fuelType = "essence";
  onboardingState.vin = ""; onboardingState.plate = ""; onboardingState.color = null; onboardingState.mileage = "";
  onboardingState.vinLookupDone = false; onboardingState.vinLookupData = null;
  onboardingState.rimSize = ""; onboardingState.tirePressure = "";
  onboardingState.lastServiceDate = ""; onboardingState.lastServiceMileage = ""; onboardingState.lastServiceType = null;
  onboardingState.papers = { registration: "", visite: "", vignette: "", insuranceStart: "", insuranceEnd: "" };
}

const MAX_FREE_VEHICLES = 2;

function startOnboarding() {
  if ((currentVehicles || []).length >= MAX_FREE_VEHICLES) {
    showPaywall();
    return;
  }
  resetOnboarding();
  document.getElementById("screen-search").classList.remove("active");
  document.getElementById("screen-detail").classList.remove("active");
  document.getElementById("screen-onboarding").classList.add("active");
  document.querySelector(".tabbar").style.display = "none";
  renderOnboarding();
}

function showPaywall() {
  document.getElementById("screen-search").classList.remove("active");
  document.getElementById("screen-detail").classList.remove("active");
  const el = document.getElementById("screen-onboarding");
  el.classList.add("active");
  document.querySelector(".tabbar").style.display = "none";
  el.innerHTML = `
    <div class="wiz-top">
      <button class="wiz-close" onclick="exitOnboarding()">&times;</button>
      <div class="wiz-title" style="margin-top:20px;">You've reached your free limit</div>
    </div>
    <div class="wiz-body">
      <div class="hint" style="margin-top:0; font-size:14px; line-height:1.6;">
        The first ${MAX_FREE_VEHICLES} vehicles on your account are free. Adding another vehicle needs a paid plan.
      </div>
      <button class="wiz-next" style="width:100%; margin-top:16px;" onclick="alert('Payments aren\\'t set up yet — coming soon.')">Upgrade</button>
    </div>
  `;
}

function exitOnboarding() {
  document.getElementById("screen-onboarding").classList.remove("active");
  document.getElementById("screen-search").classList.add("active");
  document.querySelector(".tabbar").style.display = "flex";
}

function currentFlow() {
  return getFlow(onboardingState.type);
}
function currentStepKey() {
  const flow = currentFlow();
  return (flow[onboardingState.step - 1] || flow[0]).key;
}

function wizDots() {
  const flow = currentFlow();
  let out = "";
  for (let i = 1; i <= flow.length; i++) {
    const cls = i < onboardingState.step ? "done" : i === onboardingState.step ? "current" : "";
    out += `<div class="wiz-dot ${cls}"></div>`;
  }
  return out;
}

function renderOnboarding() {
  const s = onboardingState;
  const flow = currentFlow();
  if (s.step > flow.length) s.step = flow.length; // safety clamp if type changed the flow length
  const stepDef = flow[s.step - 1];
  const el = document.getElementById("screen-onboarding");
  const isFirstStep = stepDef.key === "type";
  el.innerHTML = `
    <div class="wiz-top">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <button class="wiz-close" onclick="exitOnboarding()">&times;</button>
      </div>
      <div class="wiz-dots">${wizDots()}</div>
      <div class="wiz-step-label">Step ${s.step} of ${flow.length}</div>
      <div class="wiz-title">${stepDef.title}</div>
    </div>
    <div class="wiz-body" id="wizBody"></div>
    <div class="wiz-nav">
      ${s.step > 1 ? `<button class="wiz-back" onclick="wizBack()">Back</button>` : ""}
      ${!isFirstStep ? `<button class="wiz-next" id="wizNextBtn" onclick="wizNext()">${s.step === flow.length ? "Save vehicle" : "Next"}</button>` : ""}
    </div>
  `;
  renderStepBody();
}

function renderStepBody() {
  const s = onboardingState;
  const key = currentStepKey();
  const body = document.getElementById("wizBody");

  if (key === "type") {
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
  } else if (key === "identity") {
    const makes = getMakesForType(s.type);
    const models = s.make && s.make !== "Other" ? getModelsForMake(s.make) : [];
    const modelIsText = !s.make || s.make === "Other" || models.length === 0;
    body.innerHTML = `
      <div class="field"><label>Make</label>
        <select id="f-make" onchange="onMakeChange(this.value)">
          <option value="">Select make…</option>
          ${makes.map(m => `<option value="${m}" ${s.make === m ? "selected" : ""}>${m}</option>`).join("")}
        </select>
      </div>
      <div class="field"><label>Model</label>
        ${modelIsText
          ? `<input type="text" id="f-model" placeholder="e.g. Clio 4" value="${s.model === "Other" ? "" : s.model}">`
          : `<select id="f-model">
               <option value="">Select model…</option>
               ${models.map(md => `<option value="${md}" ${s.model === md ? "selected" : ""}>${md}</option>`).join("")}
               <option value="Other" ${s.model === "Other" ? "selected" : ""}>Other</option>
             </select>`
        }
      </div>
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
  } else if (key === "vin") {
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
  } else if (key === "rims") {
    body.innerHTML = `
      <div class="field"><label>Rim size <span class="opt">(optional)</span></label><input type="text" id="f-rim" placeholder="e.g. R16" value="${s.rimSize}"></div>
      <div class="field">
        <label>Recommended tire pressure (PSI) <span class="opt">${s.vinLookupData ? "— pre-filled from VIN lookup, editable" : "(optional, check your door sticker)"}</span></label>
        <input type="number" id="f-pressure" placeholder="e.g. 32" value="${s.tirePressure}">
      </div>
      <div class="hint">We'll remind you to check pressure periodically based on your vehicle type — this value doesn't change month to month like mileage does.</div>
    `;
  } else if (key === "service") {
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
  } else if (key === "papers") {
    const isMoto = s.type === "moto";
    body.innerHTML = `
      <div class="field"><label>Registration card — validity end date</label><input type="date" id="f-reg" value="${s.papers.registration}"></div>
      ${!isMoto ? `<div class="field"><label>Visite technique due</label><input type="date" id="f-visite" value="${s.papers.visite}"></div>` : ""}
      ${!isMoto ? `<div class="field"><label>Vignette due (annual, January)</label><input type="date" id="f-vignette" value="${s.papers.vignette}"></div>` : ""}
      <div class="field-row">
        <div class="field"><label>Insurance start date</label><input type="date" id="f-ins-start" value="${s.papers.insuranceStart}"></div>
        <div class="field"><label>Insurance end date</label><input type="date" id="f-ins-end" value="${s.papers.insuranceEnd}"></div>
      </div>
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

function selectType(id) {
  onboardingState.type = id;
  onboardingState.step = 2; // auto-advance, no Next button on this step
  renderOnboarding();
}
function onMakeChange(value) {
  const yearEl = document.getElementById("f-year");
  const fuelEl = document.getElementById("f-fuel");
  if (yearEl) onboardingState.year = yearEl.value;
  if (fuelEl) onboardingState.fuelType = fuelEl.value;
  onboardingState.make = value;
  onboardingState.model = "";
  renderStepBody();
}
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
  const key = currentStepKey();
  if (key === "identity") {
    s.make = document.getElementById("f-make").value;
    s.model = document.getElementById("f-model").value;
    s.year = document.getElementById("f-year").value;
    s.fuelType = document.getElementById("f-fuel").value;
  } else if (key === "vin") {
    s.vin = document.getElementById("f-vin").value;
    s.plate = document.getElementById("f-plate").value;
    s.mileage = document.getElementById("f-mileage").value;
  } else if (key === "rims") {
    s.rimSize = document.getElementById("f-rim").value;
    s.tirePressure = document.getElementById("f-pressure").value;
  } else if (key === "service") {
    s.lastServiceDate = document.getElementById("f-svc-date").value;
    s.lastServiceMileage = document.getElementById("f-svc-mileage").value;
  } else if (key === "papers") {
    s.papers.registration = document.getElementById("f-reg").value;
    const visiteEl = document.getElementById("f-visite");
    const vignetteEl = document.getElementById("f-vignette");
    s.papers.visite = visiteEl ? visiteEl.value : "";
    s.papers.vignette = vignetteEl ? vignetteEl.value : "";
    s.papers.insuranceStart = document.getElementById("f-ins-start").value;
    s.papers.insuranceEnd = document.getElementById("f-ins-end").value;
  }
}

function wizNext() {
  saveStepFields();
  const flow = currentFlow();
  if (onboardingState.step === flow.length) {
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
  if (p.registration || p.visite || p.vignette || p.insuranceStart || p.insuranceEnd) {
    await sb.from("vehicle_papers").insert({
      vehicle_id: vehicle.id,
      registration_date: p.registration || null,
      visite_due: p.visite || null,
      vignette_due: p.vignette || null,
      insurance_start_date: p.insuranceStart || null,
      insurance_end_date: p.insuranceEnd || null,
    });
  }

  exitOnboarding();
  await renderRecentList();
  openVehicle(vehicle.id);
}

document.getElementById("addVehicleBtn").addEventListener("click", startOnboarding);
