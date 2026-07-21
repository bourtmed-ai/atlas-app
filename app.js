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

  const countEl = document.getElementById("vehicleCount");
  if (countEl) countEl.textContent = `· ${currentVehicles.length} vehicle${currentVehicles.length === 1 ? "" : "s"}`;

  if (currentVehicles.length === 0) {
    list.innerHTML = `<div class="hint">No vehicles yet — tap "+" above to register your first one.</div>`;
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
  showScreen("screen-detail");

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

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(el => el.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

function backToSearch() {
  showScreen("screen-search");
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

function warnBadge(dateStr) {
  const days = daysUntil(dateStr);
  if (!dateStr || days === null) return "";
  if (days < 0) return ` <span style="color:var(--coral); font-weight:600;">&#9888; overdue</span>`;
  if (days <= 7) return ` <span style="color:var(--amber); font-weight:600;">&#9888; due soon</span>`;
  return "";
}

// Papers-at-a-glance pill: Valid / Due soon / Expired / Not set — matches the Atlas mock
function paperPill(dateStr) {
  if (!dateStr) return `<span class="ppill notset">Not set</span>`;
  const days = daysUntil(dateStr);
  if (days < 0) return `<span class="ppill expired">Expired</span>`;
  if (days <= 30) return `<span class="ppill duesoon">Due soon</span>`;
  return `<span class="ppill valid">Valid</span>`;
}

function fmtDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
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
  const lastService = serviceRecords[0];

  return `
    <div class="detail-top">
      <div class="back-row" style="display:flex; justify-content:space-between; align-items:center;">
        <button class="back-btn" onclick="backToSearch()">&#8592;</button>
        ${v.status === "sold" ? `<div class="vtag" style="background:rgba(200,155,60,0.2);">Sold</div>` : ""}
      </div>
      <div class="veh-title">${v.make || "Vehicle"} ${v.model || ""}</div>
      <div class="veh-sub">${v.year || ""} · ${v.plate || "—"} · <span class="num">${v.vin || "no VIN"}</span></div>
      <div class="veh-tags">
        <div class="vtag">${v.current_mileage || 0} km</div>
        <div class="vtag">${serviceRecords.length} service record${serviceRecords.length === 1 ? "" : "s"}</div>
        ${consumption ? `<div class="vtag">${consumption} L/100km</div>` : ""}
      </div>
      <div class="veh-actions">
        <button class="action-btn" onclick="openEditVehicle('${v.id}')">Edit details</button>
        ${v.status === "sold"
          ? `<button class="action-btn" onclick="restoreVehicle('${v.id}')">Restore to active</button>
             <button class="action-btn danger" onclick="deleteVehicleForever('${v.id}')">Delete permanently</button>`
          : `<button class="action-btn" onclick="promptMarkSold('${v.id}')">Mark as sold</button>`
        }
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
      <button class="tab active" data-tab="overview">Overview</button>
      <button class="tab" data-tab="fuel">Fuel</button>
      <button class="tab" data-tab="service">Service</button>
      <button class="tab" data-tab="papers">Papers</button>
    </div>

    <div class="tab-panel active" data-panel="overview">
      <div class="ov-hero">
        <div>
          <div class="plate-chip"><span class="dot"></span>${v.plate || "—"}</div>
          <div class="hint" style="margin-top:8px;">${(v.type || "vehicle").toUpperCase()} · ${(v.fuel_type || "—").toUpperCase()}</div>
        </div>
        <div>
          <div class="ov-mileage-num">${(v.current_mileage || 0).toLocaleString()}</div>
          <div class="ov-mileage-lbl">km</div>
        </div>
      </div>

      <div class="section-label" style="margin-top:0;">Specifications</div>
      <div class="spec-card">
        <div class="spec-row"><span class="sk">Type</span><span class="sv">${v.type || "—"}</span></div>
        <div class="spec-row"><span class="sk">Fuel</span><span class="sv">${v.fuel_type || "—"}</span></div>
        <div class="spec-row"><span class="sk">Year</span><span class="sv">${v.year || "—"}</span></div>
        <div class="spec-row"><span class="sk">VIN</span><span class="sv num">${v.vin || "—"}</span></div>
        <div class="spec-row"><span class="sk">Color</span><span class="sv">${v.color ? `<span style="display:inline-block;width:11px;height:11px;border-radius:6px;background:${v.color};margin-right:6px;vertical-align:middle;"></span>${v.color}` : "—"}</span></div>
        <div class="spec-row"><span class="sk">Rim size</span><span class="sv">${v.rim_size || "—"}</span></div>
        <div class="spec-row"><span class="sk">Tyre pressure</span><span class="sv">${v.tire_pressure || "—"}</span></div>
      </div>

      <div class="section-label">Papers at a glance</div>
      <div class="glance-card">
        <div class="paper-glance-row"><div><div>Registration card</div><div class="hint" style="margin:2px 0 0;">${fmtDate(papers && papers.registration_date)}</div></div>${paperPill(papers && papers.registration_date)}</div>
        ${v.type !== "moto" ? `<div class="paper-glance-row"><div><div>Visite technique</div><div class="hint" style="margin:2px 0 0;">${fmtDate(papers && papers.visite_due)}</div></div>${paperPill(papers && papers.visite_due)}</div>` : ""}
        ${v.type !== "moto" ? `<div class="paper-glance-row"><div><div>Vignette</div><div class="hint" style="margin:2px 0 0;">${fmtDate(papers && papers.vignette_due)}</div></div>${paperPill(papers && papers.vignette_due)}</div>` : ""}
        <div class="paper-glance-row"><div><div>Insurance</div><div class="hint" style="margin:2px 0 0;">${fmtDate(papers && papers.insurance_end_date)}</div></div>${paperPill(papers && papers.insurance_end_date)}</div>
      </div>

      ${lastService ? `
      <div class="section-label">Last service</div>
      <div class="rec">
        <div class="rec-title">${lastService.service_type || "Service"}</div>
        <div class="rec-date">${fmtDate(lastService.entry_date)}${lastService.odometer ? " · " + lastService.odometer + " km" : ""}</div>
      </div>` : ""}

      <div class="section-label">Update odometer</div>
      <div class="field-row">
        <div class="field"><label>Date</label><input type="date" id="ml-date"></div>
        <div class="field"><label>Odometer (km)</label><input type="number" id="ml-odo" placeholder="e.g. 85200"></div>
      </div>
      <button class="wiz-next" style="width:100%;" onclick="addMileage('${v.id}')">Log mileage</button>
    </div>

    <div class="tab-panel" data-panel="fuel">
      <div class="section-label" style="margin-top:0;">Fuel report</div>
      ${fuelReportHtml(fuelEntries)}

      <div class="section-label">Add fill-up</div>
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

      <div class="section-label">Fill-up log</div>
      ${fuelEntries.length === 0 ? `<div class="hint">No fill-ups yet.</div>` : ""}
      ${fuelEntries.map(f => `
        <div class="rec"><div class="rec-head"><div class="rec-title">${f.liters} L${f.price_paid ? " · " + f.price_paid + " MAD" : ""}</div><div class="vstatus ${f.full_tank ? "verified" : "self"}">${f.full_tank ? "Full" : "Partial"}</div></div><div class="rec-date">${f.entry_date}</div><div class="rec-meta">${f.odometer} km${f.gas_station_name ? " · " + f.gas_station_name : ""}</div></div>
      `).join("")}
    </div>

    <div class="tab-panel" data-panel="service">
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

      <div class="section-label">Service history</div>
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
      <div class="section-label" style="margin-top:0;">Edit dates</div>
      <div class="field">
        <label>Registration card — validity end date ${warnBadge(papers && papers.registration_date)}</label>
        <input type="date" id="pp-reg" value="${(papers && papers.registration_date) || ""}">
      </div>
      ${v.type !== "moto" ? `
      <div class="field">
        <label>Visite technique due ${warnBadge(papers && papers.visite_due)}</label>
        <input type="date" id="pp-visite" value="${(papers && papers.visite_due) || ""}">
      </div>` : ""}
      ${v.type !== "moto" ? `
      <div class="field">
        <label>Vignette due (annual, January) ${warnBadge(papers && papers.vignette_due)}</label>
        <input type="date" id="pp-vignette" value="${(papers && papers.vignette_due) || ""}">
      </div>` : ""}
      <div class="field-row">
        <div class="field"><label>Insurance start</label><input type="date" id="pp-ins-start" value="${(papers && papers.insurance_start_date) || ""}"></div>
        <div class="field"><label>Insurance end ${warnBadge(papers && papers.insurance_end_date)}</label><input type="date" id="pp-ins-end" value="${(papers && papers.insurance_end_date) || ""}"></div>
      </div>
      <button class="wiz-next" style="width:100%;" onclick="savePapers('${v.id}')">Save changes</button>

      <a class="opp-link" style="margin-top:16px;" href="http://www.assiaqacard.ma/opppub/" target="_blank" rel="noopener">
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
  // Fill-ups also move the odometer forward, matching the Atlas mock's mileage-from-fill-up behavior
  await sb.from("vehicles").update({ current_mileage: odometer }).eq("id", vehicleId);
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
  if (!confirm("Mark this vehicle as sold? It will move to your archive, and its history stays saved.")) return;
  const { error } = await sb.from("vehicles").update({ status: "sold" }).eq("id", vehicleId);
  if (error) { alert(error.message); return; }
  backToSearch();
}

async function savePapers(vehicleId) {
  const registration_date = document.getElementById("pp-reg").value || null;
  const visiteEl = document.getElementById("pp-visite");
  const vignetteEl = document.getElementById("pp-vignette");
  const visite_due = visiteEl ? visiteEl.value || null : null;
  const vignette_due = vignetteEl ? vignetteEl.value || null : null;
  const insurance_start_date = document.getElementById("pp-ins-start").value || null;
  const insurance_end_date = document.getElementById("pp-ins-end").value || null;

  const { error } = await sb.from("vehicle_papers").upsert({
    vehicle_id: vehicleId,
    registration_date, visite_due, vignette_due, insurance_start_date, insurance_end_date,
  }, { onConflict: "vehicle_id" });

  if (error) { alert(error.message); return; }
  openVehicle(vehicleId);
}

let editState = null;

async function openEditVehicle(vehicleId) {
  const v = currentVehicles.find(x => x.id === vehicleId) || (await sb.from("vehicles").select("*").eq("id", vehicleId).single()).data;
  if (!v) return;
  editState = { id: v.id, type: v.type, make: v.make || "", model: v.model || "", year: v.year || "", fuelType: v.fuel_type || "essence",
    vin: v.vin || "", plate: v.plate || "", color: v.color || null, mileage: v.current_mileage || "",
    rimSize: v.rim_size || "", tirePressure: v.tire_pressure || "" };
  document.getElementById("editModal").classList.add("show");
  renderEditForm();
}

function closeEditModal() {
  document.getElementById("editModal").classList.remove("show");
  editState = null;
}

function renderEditForm() {
  const s = editState;
  const makes = getMakesForType(s.type);
  const models = s.make && s.make !== "Other" ? getModelsForMake(s.make) : [];
  const modelIsText = !s.make || s.make === "Other" || models.length === 0;
  document.getElementById("editModalBody").innerHTML = `
    <div class="field"><label>Vehicle type</label>
      <select id="ed-type" onchange="editTypeChange(this.value)">
        ${VEHICLE_TYPES.map(t => `<option value="${t.id}" ${s.type === t.id ? "selected" : ""}>${t.label}</option>`).join("")}
      </select>
    </div>
    <div class="field"><label>Make</label>
      <select id="ed-make" onchange="editMakeChange(this.value)">
        <option value="">Select make…</option>
        ${makes.map(m => `<option value="${m}" ${s.make === m ? "selected" : ""}>${m}</option>`).join("")}
      </select>
    </div>
    <div class="field"><label>Model</label>
      ${modelIsText
        ? `<input type="text" id="ed-model" value="${s.model === "Other" ? "" : s.model}">`
        : `<select id="ed-model">
             <option value="">Select model…</option>
             ${models.map(md => `<option value="${md}" ${s.model === md ? "selected" : ""}>${md}</option>`).join("")}
             <option value="Other" ${s.model === "Other" ? "selected" : ""}>Other</option>
           </select>`
      }
    </div>
    <div class="field-row">
      <div class="field"><label>Year</label><input type="number" id="ed-year" value="${s.year}"></div>
      <div class="field"><label>Fuel type</label>
        <select id="ed-fuel">
          <option value="essence" ${s.fuelType === "essence" ? "selected" : ""}>Essence</option>
          <option value="diesel" ${s.fuelType === "diesel" ? "selected" : ""}>Diesel</option>
          <option value="hybrid" ${s.fuelType === "hybrid" ? "selected" : ""}>Hybrid</option>
          <option value="electric" ${s.fuelType === "electric" ? "selected" : ""}>Electric</option>
        </select>
      </div>
    </div>
    <div class="field"><label>VIN / chassis number</label><input type="text" id="ed-vin" value="${s.vin}"></div>
    <div class="field"><label>License plate</label><input type="text" id="ed-plate" value="${s.plate}"></div>
    <div class="field"><label>Color</label>
      <div class="color-grid">
        ${COLORS.map(c => `<div class="swatch ${s.color === c ? "sel" : ""}" style="background:${c}" onclick="editSelectColor('${c}')"></div>`).join("")}
      </div>
    </div>
    <div class="field"><label>Current mileage (km)</label><input type="number" id="ed-mileage" value="${s.mileage}"></div>
    <div class="field-row">
      <div class="field"><label>Rim size</label><input type="text" id="ed-rim" value="${s.rimSize}"></div>
      <div class="field"><label>Tire pressure (PSI)</label><input type="number" id="ed-pressure" value="${s.tirePressure}"></div>
    </div>
  `;
}

function editTypeChange(value) {
  saveEditFormToState();
  editState.type = value;
  editState.make = ""; editState.model = "";
  renderEditForm();
}
function editMakeChange(value) {
  saveEditFormToState();
  editState.make = value;
  editState.model = "";
  renderEditForm();
}
function editSelectColor(c) {
  editState.color = c;
  renderEditForm();
}

function saveEditFormToState() {
  const s = editState;
  const yearEl = document.getElementById("ed-year");
  const fuelEl = document.getElementById("ed-fuel");
  const vinEl = document.getElementById("ed-vin");
  const plateEl = document.getElementById("ed-plate");
  const mileageEl = document.getElementById("ed-mileage");
  const rimEl = document.getElementById("ed-rim");
  const pressureEl = document.getElementById("ed-pressure");
  if (yearEl) s.year = yearEl.value;
  if (fuelEl) s.fuelType = fuelEl.value;
  if (vinEl) s.vin = vinEl.value;
  if (plateEl) s.plate = plateEl.value;
  if (mileageEl) s.mileage = mileageEl.value;
  if (rimEl) s.rimSize = rimEl.value;
  if (pressureEl) s.tirePressure = pressureEl.value;
}

async function saveEditVehicle() {
  saveEditFormToState();
  const s = editState;
  const modelEl = document.getElementById("ed-model");
  if (modelEl) s.model = modelEl.value;

  const { error } = await sb.from("vehicles").update({
    type: s.type, make: s.make || null, model: s.model || null, year: Number(s.year) || null,
    fuel_type: s.fuelType || null, vin: s.vin || null, plate: s.plate || null, color: s.color || null,
    current_mileage: Number(s.mileage) || 0, rim_size: s.rimSize || null, tire_pressure: Number(s.tirePressure) || null,
  }).eq("id", s.id);

  if (error) { alert(error.message); return; }
  const vehicleId = s.id;
  closeEditModal();
  await renderRecentList();
  openVehicle(vehicleId);
}

async function restoreVehicle(vehicleId) {
  const { error } = await sb.from("vehicles").update({ status: "active" }).eq("id", vehicleId);
  if (error) { alert(error.message); return; }
  await renderRecentList();
  openVehicle(vehicleId);
}

async function deleteVehicleForever(vehicleId) {
  if (!confirm("Delete this vehicle and all its history permanently? This can't be undone.")) return;
  const { error } = await sb.from("vehicles").delete().eq("id", vehicleId);
  if (error) { alert(error.message); return; }
  backToSearch();
  renderMyVehiclesScreen();
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

async function renderMyVehiclesScreen() {
  showScreen("screen-myvehicles");
  const el = document.getElementById("screen-myvehicles");
  el.innerHTML = `
    <header class="top">
      <div class="seal"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 12l5 5L20 6" stroke="#141F38" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
      <div><div class="word">My vehicles</div><div class="tag">Active and archived (sold)</div></div>
    </header>
    <div class="body-pad"><div class="hint">Loading…</div></div>
  `;

  const { data, error } = await sb.from("vehicles").select("*").order("created_at", { ascending: false });
  if (error) {
    el.querySelector(".body-pad").innerHTML = `<div class="hint" style="color:var(--coral);">Could not load vehicles: ${error.message}</div>`;
    return;
  }
  const active = (data || []).filter(v => v.status === "active");
  const sold = (data || []).filter(v => v.status === "sold");

  function card(v, muted) {
    return `
      <div class="rcard" style="${muted ? "opacity:0.6;" : ""}" onclick="openVehicle('${v.id}')">
        <div class="plate">${v.plate || "—"}</div>
        <div class="meta"><b>${v.make || "Vehicle"} ${v.model || ""}</b> · ${v.year || ""}</div>
        <div class="badge ${scoreTone(quickScore(v))}">${quickScore(v)}</div>
      </div>
    `;
  }

  el.querySelector(".body-pad").innerHTML = `
    <div class="section-label" style="margin-top:0;">Active (${active.length}/${MAX_FREE_VEHICLES} free)</div>
    ${active.length === 0 ? `<div class="hint">No active vehicles.</div>` : active.map(v => card(v, false)).join("")}
    <div class="section-label">Archived — sold (${sold.length})</div>
    ${sold.length === 0 ? `<div class="hint">Vehicles you mark as sold will appear here.</div>` : sold.map(v => card(v, true)).join("")}
  `;
}

// bottom tab bar
document.querySelectorAll(".tabbar-btn").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll(".tabbar-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    if (btn.dataset.nav === "search") {
      showScreen("screen-search");
      renderRecentList();
    } else if (btn.dataset.nav === "vehicles") {
      renderMyVehiclesScreen();
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
