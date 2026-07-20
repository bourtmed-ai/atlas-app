// Gas station picker — GPS position on a map + a reverse-geocoded name suggestion the user can edit.
// Uses Leaflet + OpenStreetMap tiles (no API key needed) and OSM's free Nominatim reverse geocoder.

let pendingStation = null;
let stationMap = null;
let stationMarker = null;

function openStationPicker() {
  document.getElementById("stationModal").classList.add("show");
  document.getElementById("stationHint").textContent = "Getting your location…";
  document.getElementById("stationNameInput").value = "";

  setTimeout(() => {
    if (!navigator.geolocation) {
      document.getElementById("stationHint").textContent = "Location isn't available on this device — you can still type a name manually.";
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        initStationMap(latitude, longitude);
        pendingStation = { name: "", lat: latitude, lng: longitude };
        document.getElementById("stationHint").textContent = "Looking up a nearby name…";
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`);
          const data = await res.json();
          const guess = (data && (data.name || (data.address && (data.address.amenity || data.address.shop || data.address.road)))) || "";
          document.getElementById("stationNameInput").value = guess;
          document.getElementById("stationHint").textContent = guess
            ? "Guessed from your location — edit it if it's wrong."
            : "Couldn't guess a name nearby — type it in.";
        } catch (e) {
          document.getElementById("stationHint").textContent = "Couldn't look up a name automatically — type it in.";
        }
      },
      () => {
        document.getElementById("stationHint").textContent = "Location permission denied — you can still type a station name manually.";
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, 50);
}

function initStationMap(lat, lng) {
  const el = document.getElementById("stationMapEl");
  if (stationMap) { stationMap.remove(); stationMap = null; }
  stationMap = L.map(el).setView([lat, lng], 17);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(stationMap);
  stationMarker = L.marker([lat, lng]).addTo(stationMap);
  setTimeout(() => stationMap.invalidateSize(), 100);
}

function closeStationPicker() {
  document.getElementById("stationModal").classList.remove("show");
}

function confirmStation() {
  const name = document.getElementById("stationNameInput").value.trim();
  if (!pendingStation) pendingStation = {};
  pendingStation.name = name || "Gas station";
  const display = document.getElementById("fl-station-display");
  if (display) display.textContent = pendingStation.name;
  closeStationPicker();
}
