// Main app logic — real data via Supabase

let mode = "plate";
let currentVehicles = [];

const searchInput = document.getElementById("searchInput");
const searchHint = document.getElementById("searchHint");
const modePlateBtn = document.getElementById("mode-plate");
const modeVinBtn = document.getElementById("mode-vin");
const emptyNote = document.getElementById("emptyNote");
const screenSearch = document.getElementById("screen-search");
const screenDetail = document.getElementById("screen-detail");

function setMode(m) {
  mode = m;
  modePlateBtn.classList.toggle("active", m === "plate");
  modeVinBtn.classList.toggle("active", m === "vin");
  searchInput.placeholder = m === "plate" ? "e.g. 12345-A-6" : "e.g. VF1LB000123456789";
  searchHint.textContent = "Search within your own vehicles";
}
modePlateBtn.onclick = () => setMode("plate");
modeVinBtn.onclick = () => setMode("vin");

async function renderRecentList() {
  const list = document.getElementById("recentList");
  list.innerHTML = `<div class="hint">Loading your vehicles…</div>`;

  const { data, error } = await sb
    .from("vehicles")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) {
    list.innerHTML = `<div class="hint" style="color:var(--coral);">Could not load vehicles: ${error.message}</div>`;
    return;
  }

  currentVehicles = data || [];

  if (currentVehicles.length === 0) {
    list.innerHTML = `<div class="hint">No vehicles yet — tap "+ Add vehicle" above to register your first one.</div>`;
    return;
  }

  list.innerHTML = currentVehicles.map(v => `
    <div class="rcard" onclick="openVehicle('${v.id}')">
      <div class="plate">${v.plate || "—"}</div>
      <div class="meta"><b>${v.make || "Vehicle"} ${v.model || ""}</b> · ${v.year || ""}</div>
      <div class="badge ${scoreTone(quickScore(v))}">${quickScore(v)}</div>
    </div>
  `).join("");
}

function scoreTone(score) {
  if (score >= 70) return "high";
  if (score >= 45) return "mid";
  return "low";
}

// Simple placeholder score until real history accumulates — based on data completeness
function quickScore(v) {
  let score = 40;
  if (v.vin) score += 10;
  if (v.color) score += 5;
  if (v.rim_size) score += 5;
  if (v.tire_pressure) score += 5;
  if (v.current_mileage) score += 10;
  return Math.min(score, 100);
}

document.getElementById("goBtn").onclick = () => {
  const q = searchInput.value.trim().toLowerCase();
  const v = currentVehicles.find(x =>
    (x.plate || "").toLowerCase().includes(q) || (x.vin || "").toLowerCase().includes(q)
  );
  if (v) {
    emptyNote.style.display = "none";
    openVehicle(v.id);
  } else {
    emptyNote.style.display = "block";
  }
};

async function openVehicle(id) {
  pendingStation = null;
  const v = currentVehicles.find(x => x.id === id) || (await sb.from("vehicles").select("*").eq("id", id).single()).data;
  if (!v) return;

  screenDetail.innerHTML = `<div class="hint" style="padding:30px 20px;">Loading…</div>`;
  screenSearch.classList.remove("active");
  screenDetail.classList.add("active");

  const [papersRes, mileageRes, fuelRes, serviceRes] = await Promise.all([
    sb.from("vehicle_papers").select("*").eq("vehicle_id", id).maybeSingle(),
    sb.from("mileage_entries").select("*").eq("vehicle_id", id).order("entry_date", { ascending: false }),
    sb.from("fuel_entries").select("*").eq("vehicle_id", id).order("entry_date", { ascending: false }),
    sb.from("service_records").select("*").eq("vehicle_id", id).order("entry_date", { ascending: false }),
  ]);

  const papers = papersRes.data;
  const mileageEntries = mileageRes.data || [];
  const fuelEntries = fuelRes.data || [];
  const serviceRecords = serviceRes.data || [];

  screenDetail.innerHTML = renderDetail(v, papers, mileageEntries, fuelEntries, serviceRecords);
  bindDetailEvents(v.id);
}

function backToSearch() {
  screenDetail.classList.remove("active");
  screenSearch.classList.add("active");
  renderRecentList();
}

function toneColor(tone) {
  return tone === "green" ? "#3B6D11" : tone === "amber" ? "#C48F2B" : "#B4402F";
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = (new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24);
  return Math.ceil(diff);
}

function plainPaperRow(label, dateStr) {
  return `
    <div class="owner-row">
      <div><div>${label}</div><div class="oname">${dateStr || "Not set"}</div></div>
    </div>
  `;
}

function paperRow(label, dateStr) {
  const days = daysUntil(dateStr);
  let warn = "";
  if (dateStr && days !== null && days < 0) warn = ` <span style="color:var(--coral);">&#9888; overdue</span>`;
  else if (dateStr && days !== null && days <= 7) warn = ` <span style="color:var(--amber);">&#9888; due soon</span>`;
  return `
    <div class="owner-row">
      <div><div>${label}</div><div class="oname">${dateStr || "Not set"}${warn}</div></div>
    </div>
  `;
}

function avgConsumption(fuelEntries) {
  const full = fuelEntries.filter(f => f.full_tank).sort((a, b) => a.odometer - b.odometer);
  if (full.length < 2) return null;
  let totalLiters = 0, totalKm = 0;
  for (let i = 1; i < full.length; i++) {
    totalKm += full[i].odometer - full[i - 1].odometer;
    totalLiters += full[i].liters;
  }
  if (totalKm <= 0) return null;
  return ((totalLiters / totalKm) * 100).toFixed(1);
}

function fuelSegments(fuelEntries) {
  const full = fuelEntries.filter(f => f.full_tank && f.odometer).slice().sort((a, b) => a.odometer - b.odometer);
  const segs = [];
  for (let i = 1; i < full.length; i++) {
    const km = full[i].odometer - full[i - 1].odometer;
    if (km > 0) segs.push({ km, liters: full[i].liters, date: full[i].entry_date, l100: (full[i].liters / km) * 100 });
  }
  return segs;
}

function fuelReportHtml(fuelEntries) {
  if (fuelEntries.length === 0) {
    return `<div class="hint" style="margin-top:0;">No fuel entries yet — log a few fill-ups to see your report here.</div>`;
  }
  const sorted = fuelEntries.slice().sort((a, b) => new Date(a.entry_date) - new Date(b.entry_date));
  const first = sorted[0], last = sorted[sorted.length - 1];
  const totalCost = fuelEntries.reduce((s, f) => s + (Number(f.price_paid) || 0), 0);
  const totalVolume = fuelEntries.reduce((s, f) => s + (Number(f.liters) || 0), 0);
  const segs = fuelSegments(fuelEntries);
  const totalKmTracked = segs.reduce((s, x) => s + x.km, 0);
  const days = Math.max(1, Math.round((new Date(last.entry_date) - new Date(first.entry_date)) / 86400000));
  const costPerDay = totalCost / days;
  const costPerKm = totalKmTracked > 0 ? totalCost / totalKmTracked : null;
  const general = segs.length > 0 ? (segs.reduce((s, x) => s + x.liters, 0) / segs.reduce((s, x) => s + x.km, 0)) * 100 : null;
  const lastSeg = segs[segs.length - 1];
  const best = segs.length ? segs.reduce((a, b) => (a.l100 < b.l100 ? a : b)) : null;
  const worst = segs.length ? segs.reduce((a, b) => (a.l100 > b.l100 ? a : b)) : null;

  return `
    <div class="hint" style="margin-top:0;">${fuelEntries.length} entries (${first.entry_date} — ${last.entry_date})</div>
    <div class="report-grid">
      <div class="rstat"><div class="rlabel">Total cost</div><div class="rval">${totalCost.toFixed(0)} MAD</div></div>
      <div class="rstat"><div class="rlabel">Cost / day</div><div class="rval">${costPerDay.toFixed(1)} MAD</div></div>
      <div class="rstat"><div class="rlabel">Cost / km</div><div class="rval">${costPerKm !== null ? costPerKm.toFixed(2) + " MAD" : "—"}</div></div>
      <div class="rstat"><div class="rlabel">Total volume</div><div class="rval">${totalVolume.toFixed(1)} L</div></div>
      <div class="rstat"><div class="rlabel">General average</div><div class="rval">${general !== null ? general.toFixed(1) + " L/100km" : "—"}</div></div>
      <div class="rstat"><div class="rlabel">Last fill-up</div><div class="rval">${lastSeg ? lastSeg.l100.toFixed(1) + " L/100km" : "—"}</div></div>
      <div class="rstat good"><div class="rlabel">Best</div><div class="rval">${best ? best.l100.toFixed(1) + " L/100km" : "—"}</div></div>
      <div class="rstat bad"><div class="rlabel">Worst</div><div class="rval">${worst ? worst.l100.toFixed(1) + " L/100km" : "—"}</div></div>
    </div>
  `;
}

function recalcLiters() {
  const priceEl = document.getElementById("fl-priceperl");
  const totalEl = document.getElementById("fl-total");
  const litersEl = document.getElementById("fl-liters");
  const price = parseFloat(priceEl.value);
  const total = parseFloat(totalEl.value);
  if (price > 0 && total > 0) litersEl.value = (total / price).toFixed(2);
}

function renderDetail(v, papers, mileageEntries, fuelEntries, serviceRecords) {
  const consumption = avgConsumption(fuelEntries);
  const score = quickScore(v);

  return `
    <div class="detail-top">
      <div class="back-row" style="display:flex; justify-content:space-between; align-items:center;">
        <button class="back-btn" onclick="backToSearch()">&#8592;</button>
        <button class="back-btn" style="font-size:12px; opacity:0.8;" onclick="promptMarkSold('${v.id}')">Mark as sold</button>
      </div>
      <div class="veh-title">${v.make || "Vehicle"} ${v.model || ""}</div>
      <div class="veh-sub">${v.year || ""} · ${v.plate || "—"} · <span class="num">${v.vin || "no VIN"}</span></div>
      <div class="veh-tags">
        <div class="vtag">${v.current_mileage || 0} km</div>
        <div class="vtag">${serviceRecords.length} service record${serviceRecords.length === 1 ? "" : "s"}</div>
        ${consumption ? `<div class="vtag">${consumption} L/100km</div>` : ""}
      </div>
    </div>

    <div class="gauge-wrap">
      <div>
        <div class="gauge-num" style="color:${toneColor(score >= 70 ? "green" : score >= 45 ? "amber" : "red")}">${score}</div>
        <div class="gauge-lbl">Trust score</div>
      </div>
      <div class="gauge-factors">
        <div class="hint" style="margin:0;">Based on data completeness so far — this gets more meaningful as you log mileage, fuel, and service history.</div>
      </div>
    </div>

    <div class="tabs">
      <button class="tab active" data-tab="mileage">Mileage &amp; Fuel</button>
      <button class="tab" data-tab="maintenance">Maintenance</button>
      <button class="tab" data-tab="papers">Papers</button>
    </div>

    <div class="tab-panel active" data-panel="mileage">
      <div class="section-label" style="margin-top:0;">Fuel report</div>
      ${fuelReportHtml(fuelEntries)}

      <div class="section-label">Add entry</div>
      <div class="field-row">
        <div class="field"><label>Date</label><input type="date" id="ml-date"></div>
        <div class="field"><label>Odometer (km)</label><input type="number" id="ml-odo" placeholder="e.g. 85200"></div>
      </div>
      <button class="wiz-next" style="width:100%; margin-bottom:8px;" onclick="addMileage('${v.id}')">Log mileage</button>

      <div class="field-row">
        <div class="field"><label>Fuel date</label><input type="date" id="fl-date"></div>
        <div class="field"><label>Odometer <span class="opt">${v.current_mileage ? "last: " + v.current_mileage + " km" : ""}</span></label><input type="number" id="fl-odo"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Price / liter (MAD)</label><input type="number" step="0.01" id="fl-priceperl" oninput="recalcLiters()"></div>
        <div class="field"><label>Total cost (MAD)</label><input type="number" step="0.1" id="fl-total" oninput="recalcLiters()"></div>
      </div>
      <div class="field"><label>Liters <span class="opt">(calculated automatically)</span></label><input type="number" step="0.01" id="fl-liters" readonly style="background:var(--paper2);"></div>
      <label style="display:flex; align-items:center; gap:6px; font-size:13px; color:var(--muted); margin-bottom:10px;">
        <input type="checkbox" id="fl-full" checked style="width:auto;"> Full tank
      </label>
      <div class="field">
        <label>Gas station <span class="opt">(optional)</span></label>
        <button type="button" class="station-picker-btn" onclick="openStationPicker()">
          <span id="fl-station-display">Tap to set on map</span>
          <span class="oarrow">&rarr;</span>
        </button>
      </div>
      <button class="wiz-next" style="width:100%;" onclick="addFuel('${v.id}')">Log fuel</button>

      <div class="section-label">History</div>
      ${mileageEntries.length === 0 && fuelEntries.length === 0 ? `<div class="hint">No entries yet.</div>` : ""}
      ${mileageEntries.map(m => `
        <div class="rec"><div class="rec-head"><div class="rec-title">Mileage: ${m.odometer} km</div></div><div class="rec-date">${m.entry_date}</div></div>
      `).join("")}
      ${fuelEntries.map(f => `
        <div class="rec"><div class="rec-head"><div class="rec-title">${f.liters} L${f.price_paid ? " · " + f.price_paid + " MAD" : ""}</div><div class="vstatus ${f.full_tank ? "verified" : "self"}">${f.full_tank ? "Full" : "Partial"}</div></div><div class="rec-date">${f.entry_date}</div><div class="rec-meta">${f.odometer} km${f.gas_station_name ? " · " + f.gas_station_name : ""}</div></div>
      `).join("")}
    </div>

    <div class="tab-panel" data-panel="maintenance">
      <div class="section-label" style="margin-top:0;">Add service record</div>
      <div class="field-row">
        <div class="field"><label>Date</label><input type="date" id="sv-date"></div>
        <div class="field"><label>Odometer</label><input type="number" id="sv-odo"></div>
      </div>
      <div class="field"><label>What was done?</label>
        <select id="sv-type">
          ${SERVICE_TYPES.filter(t => t !== "None yet").map(t => `<option value="${t}">${t}</option>`).join("")}
        </select>
      </div>
      <div class="field"><label>Garage <span class="opt">(optional)</span></label><input type="text" id="sv-garage" placeholder="e.g. Garage Al Amal"></div>
      <button class="wiz-next" style="width:100%;" onclick="addService('${v.id}')">Log service</button>

      <div class="section-label">History</div>
      ${serviceRecords.length === 0 ? `<div class="hint">No service records yet.</div>` : ""}
      ${serviceRecords.map(m => `
        <div class="rec">
          <div class="rec-head"><div class="rec-title">${m.service_type || "Service"}</div></div>
          <div class="rec-date">${m.entry_date || "—"}</div>
          <div class="rec-meta">${m.odometer ? m.odometer + " km" : ""} ${m.garage_name ? "· " + m.garage_name : ""}</div>
        </div>
      `).join("")}
    </div>

    <div class="tab-panel" data-panel="papers">
      ${paperRow("Registration card — validity end", papers && papers.registration_date)}
      ${v.type !== "moto" ? paperRow("Visite technique", papers && papers.visite_due) : ""}
      ${v.type !== "moto" ? paperRow("Vignette (annual)", papers && papers.vignette_due) : ""}
      ${plainPaperRow("Insurance start", papers && papers.insurance_start_date)}
      ${paperRow("Insurance end", papers && papers.insurance_end_date)}
      <a class="opp-link" href="http://www.assiaqacard.ma/opppub/" target="_blank" rel="noopener">
        <div>
          <div class="otitle">Check opposition status</div>
          <div class="osub">Free, official check on the government portal</div>
        </div>
        <div class="oarrow">&rarr;</div>
      </a>
    </div>
  `;
}

async function addMileage(vehicleId) {
  const entry_date = document.getElementById("ml-date").value;
  const odometer = Number(document.getElementById("ml-odo").value);
  if (!entry_date || !odometer) { alert("Enter a date and odometer reading."); return; }
  const { error } = await sb.from("mileage_entries").insert({ vehicle_id: vehicleId, entry_date, odometer });
  if (error) { alert(error.message); return; }
  await sb.from("vehicles").update({ current_mileage: odometer }).eq("id", vehicleId);
  openVehicle(vehicleId);
}

async function addFuel(vehicleId) {
  const entry_date = document.getElementById("fl-date").value;
  const odometer = Number(document.getElementById("fl-odo").value);
  const liters = Number(document.getElementById("fl-liters").value);
  const total = Number(document.getElementById("fl-total").value) || null;
  const full_tank = document.getElementById("fl-full").checked;
  if (!entry_date || !odometer || !liters) { alert("Enter date, odometer, price/liter, and total cost."); return; }
  const { error } = await sb.from("fuel_entries").insert({
    vehicle_id: vehicleId,
    entry_date,
    odometer,
    liters,
    price_paid: total,
    full_tank,
    gas_station_name: pendingStation ? pendingStation.name : null,
    gas_station_lat: pendingStation ? pendingStation.lat : null,
    gas_station_lng: pendingStation ? pendingStation.lng : null,
  });
  if (error) { alert(error.message); return; }
  pendingStation = null;
  openVehicle(vehicleId);
}

async function addService(vehicleId) {
  const entry_date = document.getElementById("sv-date").value;
  const odometer = Number(document.getElementById("sv-odo").value) || null;
  const service_type = document.getElementById("sv-type").value;
  const garage_name = document.getElementById("sv-garage").value || null;
  const { error } = await sb.from("service_records").insert({ vehicle_id: vehicleId, entry_date: entry_date || null, odometer, service_type, garage_name });
  if (error) { alert(error.message); return; }
  openVehicle(vehicleId);
}

async function promptMarkSold(vehicleId) {
  if (!confirm("Mark this vehicle as sold? It will move out of your active list, and its history stays saved.")) return;
  const { error } = await sb.from("vehicles").update({ status: "sold" }).eq("id", vehicleId);
  if (error) { alert(error.message); return; }
  backToSearch();
}

function bindDetailEvents(vehicleId) {
  const tabs = screenDetail.querySelectorAll(".tab");
  const panels = screenDetail.querySelectorAll(".tab-panel");
  tabs.forEach(tab => {
    tab.onclick = () => {
      tabs.forEach(t => t.classList.remove("active"));
      panels.forEach(p => p.classList.remove("active"));
      tab.classList.add("active");
      screenDetail.querySelector(`[data-panel="${tab.dataset.tab}"]`).classList.add("active");
    };
  });
}

// bottom tab bar
document.querySelectorAll(".tabbar-btn").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll(".tabbar-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    if (btn.dataset.nav === "search") {
      screenDetail.classList.remove("active");
      screenSearch.classList.add("active");
      renderRecentList();
    } else if (btn.dataset.nav === "account") {
      if (confirm("Log out?")) signOut();
    }
  };
});

// Offline indicator
const offlinePill = document.getElementById("offlinePill");
function updateOnlineState() {
  offlinePill.classList.toggle("show", !navigator.onLine);
}
window.addEventListener("online", updateOnlineState);
window.addEventListener("offline", updateOnlineState);
updateOnlineState();

// Register service worker for offline caching
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

// Boot: check session instead of showing search screen immediately
checkSessionAndBoot();
