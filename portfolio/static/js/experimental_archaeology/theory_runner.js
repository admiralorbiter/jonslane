/**
 * Main coordinator script for Experimental Archaeology Case Study 1.
 * Manages playback, loads Mars dataset, drives Orrery Canvas, Sky Strip Canvas,
 * Chart.js Residuals, and dynamic controls matching active theory/mode.
 */

// Global State
let dataset = [];
let filteredDataset = [];
let currentIndex = 0;
let isPlaying = false;
let currentFrame = "helio"; // "helio" or "geo"
let activeModelName = "ptolemy"; // "ptolemy", "copernicus", "kepler"
let reconstructionMode = "faithful"; // "faithful" or "bestfit"
let knowledgeDate = 1600;
let playbackSpeed = 10; // Days step per animation frame

// Overlay visibilities
const overlays = {
  orbits: true,
  epicycles: true,
  equants: true
};

// Parameter sets for models
const activeParams = {
  ptolemy: { ...PtolemyModel.defaultParams },
  copernicus: { ...CopernicusModel.defaultParams },
  kepler: { ...KeplerModel.defaultParams }
};

// Cached optimized params so we don't refit on every frame
const bestFitParams = {
  ptolemy: null,
  copernicus: null,
  kepler: null
};

// Chart.js object
let residualsChart = null;

// Context logs for Mars orbit timeline
const HISTORICAL_EXCERPTS = [
  { year: 1580, text: "Tycho Brahe begins intensive observational campaign of Mars at Uraniborg. He notices eccentricity and errors in traditional Prutenic tables." },
  { year: 1582, text: "Tycho observes Mars in opposition. The planet appears brighter than usual, suggesting its distance varies significantly from Earth." },
  { year: 1587, text: "Tycho compiles the most detailed catalog of Mars positions. His observational precision reaches ±1-2 arcminutes." },
  { year: 1590, text: "Kepler graduates from Tübingen. He studies Michael Maestlin's Copernican lessons but notes that heliocentrism still uses small epicycles." },
  { year: 1595, text: "Tycho Brahe's observations demonstrate Mars retrogrades differ in size and duration, posing a major challenge to basic circular theories." },
  { year: 1600, text: "Kepler joins Tycho Brahe in Prague. Tycho tasks Kepler with resolving the orbit of Mars, which Kepler later calls the 'war on Mars'." }
];

// ── Lifecycle entry point ──────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  loadDataset();
});

async function loadDataset() {
  try {
    const response = await fetch("/static/data/experimental_archaeology/mars_1580_1600.json");
    dataset = await response.json();
    
    // Default filter
    updateKnowledgeDate(1600);
    
    // Initialize UI
    initChart();
    buildParameterSliders();
    updateStatsDisplay();
    
    // Render first frame
    requestAnimationFrame(renderLoop);
  } catch (error) {
    console.error("Failed to load Mars historical observations:", error);
  }
}

// Filter dataset up to current knowledge cutoff year
function updateKnowledgeDate(year) {
  knowledgeDate = parseInt(year);
  document.getElementById("year-badge").innerText = `${knowledgeDate} CE`;
  
  filteredDataset = dataset.filter(d => d.year <= knowledgeDate);
  
  // Force refit of best-fit parameters since data window changed
  bestFitParams.ptolemy = null;
  bestFitParams.copernicus = null;
  bestFitParams.kepler = null;
  
  updateChartData();
  updateHistoricalLog();
  updateStatsDisplay();
}

function getActiveParams() {
  if (reconstructionMode === "faithful") {
    // Return standard model defaults
    const model = getModelObject(activeModelName);
    return model.defaultParams;
  } else {
    // Return optimized parameters (or fit them if cached is null)
    if (!bestFitParams[activeModelName]) {
      fitParameters(false); // Silent fit
    }
    return bestFitParams[activeModelName] || activeParams[activeModelName];
  }
}

function getModelObject(name) {
  if (name === "ptolemy") return PtolemyModel;
  if (name === "copernicus") return CopernicusModel;
  return KeplerModel;
}

// ── Playback Logic ─────────────────────────────────────────
let lastFrameTime = 0;
function renderLoop(timestamp) {
  if (isPlaying) {
    const elapsed = timestamp - lastFrameTime;
    if (elapsed > 40) { // Max ~25fps to keep calculations smooth
      currentIndex = (currentIndex + 1) % dataset.length;
      document.getElementById("knowledge-date-slider").value = Math.floor(dataset[currentIndex].year);
      updateKnowledgeDate(Math.floor(dataset[currentIndex].year));
      lastFrameTime = timestamp;
    }
  }
  
  drawOrrery();
  drawSkyStrip();
  updateChartIndicator();
  
  requestAnimationFrame(renderLoop);
}

function togglePlayback() {
  isPlaying = !isPlaying;
  document.getElementById("btn-play").innerText = isPlaying ? "Pause Simulation" : "Play Simulation";
}

function stepSimulation() {
  currentIndex = (currentIndex + 1) % dataset.length;
  updateKnowledgeDate(Math.floor(dataset[currentIndex].year));
}

function resetSimulation() {
  isPlaying = false;
  document.getElementById("btn-play").innerText = "Play Simulation";
  currentIndex = 0;
  updateKnowledgeDate(1600);
}

function setSpeed(val) {
  playbackSpeed = parseInt(val);
}

// ── Visibility & Config Switches ───────────────────────────
function setReferenceFrame(frame) {
  currentFrame = frame;
  document.getElementById("btn-frame-helio").classList.toggle("active", frame === "helio");
  document.getElementById("btn-frame-geo").classList.toggle("active", frame === "geo");
}

function toggleOverlay(overlay) {
  overlays[overlay] = document.getElementById(`toggle-${overlay}`).checked;
}

function setActiveModel(model) {
  activeModelName = model;
  document.getElementById("btn-model-ptolemy").classList.toggle("active", model === "ptolemy");
  document.getElementById("btn-model-copernicus").classList.toggle("active", model === "copernicus");
  document.getElementById("btn-model-kepler").classList.toggle("active", model === "kepler");
  
  buildParameterSliders();
  updateStatsDisplay();
  updateChartData();
}

function setReconstructionMode(mode) {
  reconstructionMode = mode;
  document.getElementById("btn-mode-faithful").classList.toggle("active", mode === "faithful");
  document.getElementById("btn-mode-bestfit").classList.toggle("active", mode === "bestfit");
  
  buildParameterSliders();
  updateStatsDisplay();
  updateChartData();
}

// ── Slider Generation & Parameter Tuning ───────────────────
function buildParameterSliders() {
  const container = document.getElementById("sliders-container");
  container.innerHTML = "";
  
  const model = getModelObject(activeModelName);
  const params = getActiveParams();
  
  // Disable manual tuning sliders in optimized mode (to prevent user override of fit)
  const disabledAttr = reconstructionMode === "bestfit" ? "disabled" : "";
  if (reconstructionMode === "bestfit") {
    container.innerHTML = `<p style="font-family: var(--font-serif); font-size: 0.72rem; color: var(--ink-fade); font-style: italic; margin-bottom: var(--space-md);">Manual tuning disabled. Parameter values are calculated by the Nelder-Mead optimizer below.</p>`;
  }

  Object.keys(model.defaultParams).forEach(name => {
    // We only show parameters relevant to Mars (Earth parameters are kept internal for neat UI)
    if (name.endsWith("_e") || name === "R_e" || name === "e_e") return;
    
    const bounds = model.paramBounds[name] || [0.0, 2.0];
    const val = params[name];
    
    // Formatting helper
    let step = 0.001;
    if (name === "R") step = 0.01;
    
    const sliderHTML = `
      <div class="arch-slider-row">
        <span class="arch-slider-name">${name}</span>
        <input type="range" class="arch-slider-input" min="${bounds[0]}" max="${bounds[1]}" step="${step}" value="${val}" ${disabledAttr} oninput="tuneParameter('${name}', this.value)">
        <span class="arch-slider-val" id="val-${name}">${val.toFixed(3)}</span>
      </div>
    `;
    container.insertAdjacentHTML("beforeend", sliderHTML);
  });
}

function tuneParameter(name, val) {
  const numVal = parseFloat(val);
  activeParams[activeModelName][name] = numVal;
  document.getElementById(`val-${name}`).innerText = numVal.toFixed(3);
  updateStatsDisplay();
}

function resetParameters() {
  const model = getModelObject(activeModelName);
  activeParams[activeModelName] = { ...model.defaultParams };
  bestFitParams[activeModelName] = null;
  buildParameterSliders();
  updateStatsDisplay();
}

// ── Nelder-Mead Fitting trigger ─────────────────────────────
function runParameterFit() {
  document.getElementById("fit-status").innerText = "Optimizing Simplex...";
  document.getElementById("fit-status").style.color = "var(--brass-bright)";
  
  // Run on setTimeout to allow UI thread to paint status change
  setTimeout(() => {
    fitParameters(true);
  }, 50);
}

function fitParameters(verbose = true) {
  const model = getModelObject(activeModelName);
  const initial = activeParams[activeModelName];
  
  // Select which parameters to tune
  const paramsToFit = Object.keys(model.defaultParams).filter(name => {
    // Keep earth/sun locked, fit Mars geometry parameters
    return !name.endsWith("_e") && name !== "R_e" && name !== "e_e";
  });
  
  const result = NelderMead.optimize(model, initial, paramsToFit, filteredDataset, 200);
  bestFitParams[activeModelName] = result.params;
  
  if (verbose) {
    document.getElementById("fit-status").innerText = "Converged!";
    document.getElementById("fit-status").style.color = "var(--verdigris-bright)";
    buildParameterSliders();
    updateStatsDisplay();
    updateChartData();
  }
}

function updateStatsDisplay() {
  const model = getModelObject(activeModelName);
  const params = getActiveParams();
  
  // Calculate current RMS
  let sumSqErr = 0;
  filteredDataset.forEach(d => {
    const pred = model.predict(d.year, params);
    let diff = (pred.lon - d.lon) % 360.0;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    sumSqErr += diff * diff;
  });
  
  const rms = Math.sqrt(sumSqErr / filteredDataset.length);
  document.getElementById("fit-rms-val").innerText = `${rms.toFixed(2)} arcmin`;
  
  // Count active parameters
  const paramsCount = Object.keys(model.defaultParams).filter(name => !name.endsWith("_e") && name !== "R_e" && name !== "e_e").length;
  document.getElementById("fit-params-count").innerText = paramsCount;
}

// ── Render Orrery Canvas ───────────────────────────────────
function drawOrrery() {
  const canvas = document.getElementById("orrery-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Centering & Scale (150 pixels per AU)
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const scale = 140; 
  
  // Get current record
  if (dataset.length === 0) return;
  const record = dataset[currentIndex];
  const t = record.year;
  
  const params = getActiveParams();
  const model = getModelObject(activeModelName);
  const pred = model.predict(t, params);
  
  // Draw parchment grid lines (astronomical coordinate axes)
  ctx.strokeStyle = "rgba(196, 169, 125, 0.06)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, cy); ctx.lineTo(canvas.width, cy);
  ctx.moveTo(cx, 0); ctx.lineTo(cx, canvas.height);
  ctx.stroke();
  
  // Background circle reference
  ctx.beginPath();
  ctx.arc(cx, cy, scale, 0, 2*Math.PI);
  ctx.stroke();
  
  if (currentFrame === "helio") {
    // ── HELIOCENTRIC REFERENCE FRAME ──
    // Origin is the Sun
    const sunX = cx;
    const sunY = cy;
    
    // Draw Sun
    ctx.fillStyle = "#d4a853";
    ctx.beginPath();
    ctx.arc(sunX, sunY, 8, 0, 2*Math.PI);
    ctx.fill();
    
    // Apparent Earth
    const ex = sunX + pred.x_e * scale;
    const ey = sunY - pred.y_e * scale; // invert Y coordinate for screen coords
    
    ctx.fillStyle = "#6bbba0";
    ctx.beginPath();
    ctx.arc(ex, ey, 5, 0, 2*Math.PI);
    ctx.fill();
    ctx.fillStyle = "rgba(107, 187, 160, 0.2)";
    ctx.beginPath();
    ctx.arc(ex, ey, 10, 0, 2*Math.PI);
    ctx.fill();
    
    // Draw Earth Orbit Path
    if (overlays.orbits) {
      ctx.strokeStyle = "rgba(107, 187, 160, 0.12)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(sunX, sunY, params.R_e * scale || scale, 0, 2*Math.PI);
      ctx.stroke();
    }
    
    // Mars (Physical Position)
    const mx = sunX + pred.x_c * scale;
    const my = sunY - pred.y_c * scale;
    
    ctx.fillStyle = "#c88080";
    ctx.beginPath();
    ctx.arc(mx, my, 6, 0, 2*Math.PI);
    ctx.fill();
    
    // Draw Mars Orbit Path
    if (overlays.orbits) {
      ctx.strokeStyle = "rgba(200, 128, 128, 0.15)";
      ctx.beginPath();
      if (activeModelName === "kepler") {
        // Draw ellipse
        ctx.ellipse(
          sunX - params.e * Math.cos(params.long_peri) * scale,
          sunY + params.e * Math.sin(params.long_peri) * scale,
          params.a * scale,
          params.a * Math.sqrt(1 - params.e * params.e) * scale,
          -params.long_peri,
          0, 2*Math.PI
        );
      } else {
        // Circular orbit
        ctx.arc(sunX + 0.75 * params.e * Math.cos(params.longApsides) * scale,
                sunY - 0.75 * params.e * Math.sin(params.longApsides) * scale,
                params.R * scale, 0, 2*Math.PI);
      }
      ctx.stroke();
    }
    
    // Vector Earth -> Mars (Sightline)
    ctx.strokeStyle = "rgba(212, 168, 83, 0.25)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(mx, my);
    ctx.stroke();
    ctx.setLineDash([]);
    
  } else {
    // ── GEOCENTRIC REFERENCE FRAME ──
    // Origin is the Earth
    const earthX = cx;
    const earthY = cy;
    
    // Draw Earth
    ctx.fillStyle = "#6bbba0";
    ctx.beginPath();
    ctx.arc(earthX, earthY, 6, 0, 2*Math.PI);
    ctx.fill();
    
    // If Ptolemaic: draw deferent & epicycles
    if (activeModelName === "ptolemy") {
      const cos_aps = Math.cos(params.longApsides);
      const sin_aps = Math.sin(params.longApsides);
      
      const xD = earthX + params.e * cos_aps * scale;
      const yD = earthY - params.e * sin_aps * scale;
      
      const xQ = earthX + 2.0 * params.e * cos_aps * scale;
      const yQ = earthY - 2.0 * params.e * sin_aps * scale;
      
      // Draw Deferent Center (D) & Equant Point (Q)
      if (overlays.equants) {
        ctx.fillStyle = "rgba(212, 168, 83, 0.4)";
        ctx.beginPath();
        ctx.arc(xD, yD, 2.5, 0, 2*Math.PI); // Deferent Center
        ctx.arc(xQ, yQ, 2.5, 0, 2*Math.PI); // Equant
        ctx.fill();
        
        ctx.fillStyle = "var(--parchment-light)";
        ctx.font = "8px sans-serif";
        ctx.fillText("D", xD + 4, yD + 2);
        ctx.fillText("Q", xQ + 4, yQ + 2);
      }
      
      // Deferent Circle
      if (overlays.orbits) {
        ctx.strokeStyle = "rgba(196, 169, 125, 0.12)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(xD, yD, params.R * scale, 0, 2*Math.PI);
        ctx.stroke();
      }
      
      // Epicycle center (C)
      const xC = earthX + pred.x_c * scale;
      const yC = earthY - pred.y_c * scale;
      
      // Draw Epicycle Deferent connection line
      if (overlays.epicycles) {
        ctx.strokeStyle = "rgba(196, 169, 125, 0.08)";
        ctx.beginPath();
        ctx.moveTo(xD, yD);
        ctx.lineTo(xC, yC);
        ctx.stroke();
      }
      
      // Draw Epicycle Circle centered at C
      if (overlays.epicycles) {
        ctx.strokeStyle = "rgba(212, 168, 83, 0.16)";
        ctx.beginPath();
        ctx.arc(xC, yC, params.r * scale, 0, 2*Math.PI);
        ctx.stroke();
      }
      
      // Mars on epicycle
      const mx = earthX + pred.x * scale;
      const my = earthY - pred.y * scale;
      
      ctx.fillStyle = "#c88080";
      ctx.beginPath();
      ctx.arc(mx, my, 5, 0, 2*Math.PI);
      ctx.fill();
      
      // Sightline Earth -> Mars
      ctx.strokeStyle = "rgba(212, 168, 83, 0.25)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(earthX, earthY);
      ctx.lineTo(mx, my);
      ctx.stroke();
    } else {
      // Fallback for Copernican/Keplerian geocentric view
      const ex = earthX - pred.x_e * scale;
      const ey = earthY + pred.y_e * scale;
      
      // Sun orbits Earth geocentrically
      ctx.fillStyle = "#d4a853";
      ctx.beginPath();
      ctx.arc(ex, ey, 8, 0, 2*Math.PI);
      ctx.fill();
      
      // Mars geocentric coordinates
      const mx = earthX + pred.x * scale;
      const my = earthY - pred.y * scale;
      
      ctx.fillStyle = "#c88080";
      ctx.beginPath();
      ctx.arc(mx, my, 5, 0, 2*Math.PI);
      ctx.fill();
      
      ctx.strokeStyle = "rgba(212, 168, 83, 0.25)";
      ctx.beginPath();
      ctx.moveTo(earthX, earthY);
      ctx.lineTo(mx, my);
      ctx.stroke();
    }
  }
}

// ── Render Sky Strip ───────────────────────────────────────
const CONSTELLATIONS = [
  { name: "Aries", angle: 0 },
  { name: "Taurus", angle: 30 },
  { name: "Gemini", angle: 60 },
  { name: "Cancer", angle: 90 },
  { name: "Leo", angle: 120 },
  { name: "Virgo", angle: 150 },
  { name: "Libra", angle: 180 },
  { name: "Scorpio", angle: 210 },
  { name: "Sagittarius", angle: 240 },
  { name: "Capricorn", angle: 270 },
  { name: "Aquarius", angle: 300 },
  { name: "Pisces", angle: 330 }
];

function drawSkyStrip() {
  const canvas = document.getElementById("sky-strip-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  if (dataset.length === 0) return;
  const record = dataset[currentIndex];
  
  // Active prediction
  const params = getActiveParams();
  const model = getModelObject(activeModelName);
  const pred = model.predict(record.year, params);
  
  // Center longitude in the viewport around the observed longitude
  const centerLon = record.lon;
  
  // Scale factor: 4 pixels per degree
  const scale = 4.5;
  const cx = canvas.width / 2;
  
  // Draw constellation zones
  ctx.font = "italic 9px serif";
  ctx.fillStyle = "rgba(196, 169, 125, 0.3)";
  ctx.textAlign = "center";
  
  CONSTELLATIONS.forEach(c => {
    let diff = (c.angle - centerLon) % 360;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    
    const x = cx + diff * scale;
    
    // Draw boundary ticks
    ctx.strokeStyle = "rgba(196, 169, 125, 0.08)";
    ctx.beginPath();
    ctx.moveTo(x - 15 * scale, 0);
    ctx.lineTo(x - 15 * scale, canvas.height);
    ctx.stroke();
    
    // Label
    if (x > 0 && x < canvas.width) {
      ctx.fillText(c.name, x, 30);
      ctx.fillText(`${c.angle}°`, x, 45);
    }
  });
  
  // Draw observed Mars position (Naked-eye cross)
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - 6, canvas.height/2);
  ctx.lineTo(cx + 6, canvas.height/2);
  ctx.moveTo(cx, canvas.height/2 - 6);
  ctx.lineTo(cx, canvas.height/2 + 6);
  ctx.stroke();
  
  ctx.fillStyle = "#ffffff";
  ctx.font = "8px monospace";
  ctx.textAlign = "left";
  ctx.fillText(`Tycho Observed: ${record.lon.toFixed(1)}°`, cx + 8, canvas.height/2 + 3);
  
  // Draw predicted Mars position
  let predDiff = (pred.lon - centerLon) % 360;
  if (predDiff > 180) predDiff -= 360;
  if (predDiff < -180) predDiff += 360;
  const px = cx + predDiff * scale;
  
  ctx.fillStyle = "#c88080";
  ctx.beginPath();
  ctx.arc(px, canvas.height/2, 4.5, 0, 2*Math.PI);
  ctx.fill();
  
  ctx.font = "8px monospace";
  ctx.fillText(`${model.name}: ${pred.lon.toFixed(1)}°`, px + 8, canvas.height/2 + 13);
}

// ── Chart.js Residuals Chart ───────────────────────────────
function initChart() {
  const ctx = document.getElementById("residuals-chart").getContext("2d");
  
  residualsChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "Ptolemaic Residual",
          borderColor: "#d4a853",
          borderWidth: 1.5,
          pointRadius: 0,
          data: []
        },
        {
          label: "Copernican Residual",
          borderColor: "#c4a97d",
          borderWidth: 1.5,
          pointRadius: 0,
          data: []
        },
        {
          label: "Keplerian Residual",
          borderColor: "#6bbba0",
          borderWidth: 2,
          pointRadius: 0,
          data: []
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: { color: "rgba(196, 169, 125, 0.05)" },
          ticks: { color: "#a08060", font: { family: "JetBrains Mono", size: 8 } }
        },
        y: {
          min: -40,
          max: 40,
          grid: { color: "rgba(196, 169, 125, 0.05)" },
          ticks: { color: "#a08060", font: { family: "JetBrains Mono", size: 8 } },
          title: { display: true, text: "Error (arcminutes)", color: "#a08060" }
        }
      },
      plugins: {
        legend: { display: false } // Custom legend is in HTML
      }
    }
  });
}

function updateChartData() {
  if (!residualsChart || dataset.length === 0) return;
  
  // Subsample dataset for chart to avoid overload
  const chartSteps = filteredDataset.filter((d, i) => i % 5 === 0);
  const labels = chartSteps.map(d => d.year.toFixed(1));
  
  // Calculate residuals for all three models using active parameters
  const ptolemyRes = chartSteps.map(d => {
    const pred = PtolemyModel.predict(d.year, activeParams.ptolemy);
    let diff = (pred.lon - d.lon) % 360;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    return diff * 60; // convert to arcminutes
  });
  
  const copernicusRes = chartSteps.map(d => {
    const pred = CopernicusModel.predict(d.year, activeParams.copernicus);
    let diff = (pred.lon - d.lon) % 360;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    return diff * 60;
  });
  
  const keplerRes = chartSteps.map(d => {
    const pred = KeplerModel.predict(d.year, activeParams.kepler);
    let diff = (pred.lon - d.lon) % 360;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    return diff * 60;
  });
  
  residualsChart.data.labels = labels;
  residualsChart.data.datasets[0].data = ptolemyRes;
  residualsChart.data.datasets[1].data = copernicusRes;
  residualsChart.data.datasets[2].data = keplerRes;
  residualsChart.update();
}

function updateChartIndicator() {
  // Can draw a vertical indicator line on the chart if needed, 
  // but keeping it simple for performance.
}

// ── Historical logs injection ──────────────────────────────
function updateHistoricalLog() {
  const logContainer = document.getElementById("historical-log");
  if (!logContainer) return;
  
  logContainer.innerHTML = "";
  
  HISTORICAL_EXCERPTS.forEach(item => {
    if (item.year <= knowledgeDate) {
      const entryHTML = `
        <div class="arch-log-entry">
          <div class="arch-log-date">${item.year} CE</div>
          <p>${item.text}</p>
        </div>
      `;
      logContainer.insertAdjacentHTML("beforeend", entryHTML);
    }
  });
  
  // Keep scrolled to bottom
  logContainer.scrollTop = logContainer.scrollHeight;
}
