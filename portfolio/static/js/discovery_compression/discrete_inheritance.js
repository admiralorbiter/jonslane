/**
 * Discovery Compression: Study 1 — Discrete Inheritance JS Engine.
 * Manages Greenhouse slot garden, Bud Emasculation mini-game, Plinko physics drop,
 * clay vs paper tally sheet styling, and the Hindsight Cheat Detector.
 */

// Global state configuration
const CAPABILITIES = {
  0: { // 500 BCE
    label: "500 BCE",
    maxCapacity: 120,
    errorRate: 0.15,
    mediaName: "Clay Tablet (500 BCE)",
    mediaClass: "clay",
    tools: "Bronze surgery needles",
    forcepsName: "Bronze Needles",
    tallyNames: { yellow: "leios (smooth)", green: "ritys (wrinkled)", blend: "mikto (mixed)" }
  },
  1: { // 300 BCE
    label: "300 BCE",
    maxCapacity: 400,
    errorRate: 0.10,
    mediaName: "Papyrus Roll (300 BCE)",
    mediaClass: "papyrus",
    tools: "Fine iron forceps",
    forcepsName: "Iron Forceps",
    tallyNames: { yellow: "xantho (yellow)", green: "chloron (green)", blend: "meso (mid)" }
  },
  2: { // 1866 CE
    label: "1866 CE",
    maxCapacity: 1000,
    errorRate: 0.005,
    mediaName: "Paper Notebook (1866 CE)",
    mediaClass: "paper",
    tools: "Precision steel tweezers",
    forcepsName: "Steel Tweezers",
    tallyNames: { yellow: "Y (Yellow)", green: "y (Green)", blend: "Yy (Intermediate)" }
  }
};

const state = {
  eraIndex: 0,
  activeTheory: "particulate", // "particulate" or "blending"
  purified: false,
  gardenSlots: Array(10).fill(null), // slot content: { genotype: "AA"|"Aa"|"aa", phenotype: "yellow"|"green"|"blend" }
  selectedSlots: [], // indices of selected slots for crossing
  emasculationError: 0.15,
  emasculatingAnthers: [], // active anthers for mini-game
  emasculationSuccess: false,
  lastHarvestedSeeds: [], // harvested seed trait values
  tally: { yellow: 0, green: 0, blend: 0 },
  violations: [],
  crossCount: 0
};

// Plinko configuration
let plinkoCanvas = null;
let plinkoCtx = null;
let plinkoAnimationId = null;
let plinkoBalls = [];
let plinkoPegs = [];
let plinkoBins = [];

// ── Lifecycle entry point ──────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  initUI();
  initPlinko();
  updateEra(0);
});

function initUI() {
  // Sliders & selects
  const yearSlider = document.getElementById("year-slider");
  yearSlider.addEventListener("input", (e) => {
    updateEra(parseInt(e.target.value));
  });

  // Action buttons
  document.getElementById("btn-purify").addEventListener("click", runPurification);
  document.getElementById("btn-cross").addEventListener("click", startCrossing);
  document.getElementById("btn-self").addEventListener("click", runSelfPollination);
  document.getElementById("btn-harvest").addEventListener("click", runHarvest);
  document.getElementById("btn-clear").addEventListener("click", clearGarden);

  document.getElementById("btn-cancel-emasculation").addEventListener("click", abortCrossing);

  // Theory toggle buttons
  const btnParticulate = document.getElementById("btn-theory-particulate");
  const btnBlending = document.getElementById("btn-theory-blending");

  btnParticulate.addEventListener("click", () => {
    state.activeTheory = "particulate";
    btnParticulate.classList.add("active");
    btnBlending.classList.remove("active");
    triggerViolation("Altered underlying physical laws mid-experiment.");
    resetPlinkoBins();
  });

  btnBlending.addEventListener("click", () => {
    state.activeTheory = "blending";
    btnBlending.classList.add("active");
    btnParticulate.classList.remove("active");
    triggerViolation("Selected Blending inheritance. Intermediates will appear.");
    resetPlinkoBins();
  });

  // Render garden slots
  renderGarden();
}

function updateEra(index) {
  state.eraIndex = index;
  const cap = CAPABILITIES[index];

  document.getElementById("year-badge").innerText = cap.label;
  document.getElementById("cap-tools").innerText = cap.tools;
  document.getElementById("cap-error").innerText = `${(cap.errorRate * 100).toFixed(1)}% error`;
  document.getElementById("cap-capacity").innerText = `${cap.maxCapacity} plants`;
  document.getElementById("cap-medium").innerText = cap.mediaName;

  // Era description text
  const eraDesc = document.getElementById("era-desc");
  if (index === 0) {
    eraDesc.innerText = "Classical Greek estate. Recording on wax/clay tablets using tallies. Tools are crude bronze needles, producing high failure rates during cross breeding.";
  } else if (index === 1) {
    eraDesc.innerText = "Hellenistic library era. Recording on papyrus scrolls. Fine iron forceps allow better manipulation of buds, reducing crossing failures.";
  } else {
    eraDesc.innerText = "Nineteenth-century scientific garden. Precision steel tweezers, paper worksheets, and combinatorial arithmetic. Emasculation errors are nearly non-existent.";
  }

  // Tally Tablet styling
  const tablet = document.getElementById("tally-tablet");
  const tabletTitle = document.getElementById("tally-medium-name");
  tablet.className = `tally-tablet ${cap.mediaClass}`;
  tabletTitle.innerText = cap.mediaName;

  // Emasculation failure rate update
  state.emasculationError = cap.errorRate;

  // Trigger violation checks
  if (index < 2) {
    triggerViolation(`Using modern algebraic variables Y/y on ${cap.mediaName} is forbidden.`);
  }

  renderTally();
  clearGarden();
}

function renderGarden() {
  const container = document.getElementById("garden-grid");
  container.innerHTML = "";

  for (let i = 0; i < 10; i++) {
    const slotData = state.gardenSlots[i];
    const slot = document.createElement("div");
    slot.className = "garden-slot";
    if (slotData) {
      slot.classList.add("active");
      
      const icon = document.createElement("span");
      icon.className = "plant-icon";
      // Render color shade or pea emoji
      if (slotData.phenotype === "yellow") {
        icon.innerText = "🫘";
        icon.style.filter = "drop-shadow(0 0 5px #f5c842)";
        icon.style.color = "#f5c842";
      } else if (slotData.phenotype === "green") {
        icon.innerText = "🫘";
        icon.style.filter = "drop-shadow(0 0 5px #4a9980)";
        icon.style.color = "#4a9980";
      } else {
        // Blended shade (intermediate pale green-yellow)
        icon.innerText = "🫘";
        icon.style.filter = "drop-shadow(0 0 5px #a8b060)";
        icon.style.color = "#a8b060";
      }
      slot.appendChild(icon);

      const label = document.createElement("span");
      label.className = "plant-label";
      
      // Anachronistic notation flag
      if (state.eraIndex < 2) {
        label.innerText = slotData.phenotype === "yellow" ? "leios" : (slotData.phenotype === "green" ? "ritys" : "mikto");
      } else {
        label.innerText = slotData.genotype;
      }
      slot.appendChild(label);

      // Selection logic for crossing
      if (state.selectedSlots.includes(i)) {
        slot.classList.add("selected");
      }

      slot.addEventListener("click", () => selectSlot(i));
    } else {
      // Empty slot
      slot.innerHTML = "<span style='font-size:1.5rem; opacity:0.15;'>+</span><span class='plant-label'>empty</span>";
      slot.addEventListener("click", () => plantSeed(i));
    }
    container.appendChild(slot);
  }

  // Update button states
  const selectedCount = state.selectedSlots.length;
  document.getElementById("btn-cross").disabled = (selectedCount !== 2);
  document.getElementById("btn-self").disabled = (selectedCount !== 1);
}

function plantSeed(index) {
  // Plant initial homozygous seeds based on simple selection
  // Fills slot with basic parents
  const isYellow = index % 2 === 0;
  state.gardenSlots[index] = {
    genotype: isYellow ? "AA" : "aa",
    phenotype: isYellow ? "yellow" : "green"
  };
  renderGarden();
  document.getElementById("garden-instructions").innerText = `Planted Parent ${isYellow ? "Yellow" : "Green"} in slot ${index + 1}.`;
}

function selectSlot(index) {
  const selIndex = state.selectedSlots.indexOf(index);
  if (selIndex > -1) {
    state.selectedSlots.splice(selIndex, 1);
  } else {
    if (state.selectedSlots.length >= 2) {
      state.selectedSlots.shift(); // keep max 2 selected
    }
    state.selectedSlots.push(index);
  }
  renderGarden();
}

function clearGarden() {
  state.gardenSlots.fill(null);
  state.selectedSlots = [];
  state.lastHarvestedSeeds = [];
  state.purified = false;
  renderGarden();
  document.getElementById("btn-harvest").disabled = true;
  document.getElementById("garden-instructions").innerText = "Garden cleared. Click slots to plant parent seeds.";
}

// ── Purification Phase ──────────────────────────────────────
function runPurification() {
  // Simulates 2 generations of selfing parents to yield homozygous lines
  state.purified = true;
  state.gardenSlots[0] = { genotype: "AA", phenotype: "yellow" };
  state.gardenSlots[1] = { genotype: "AA", phenotype: "yellow" };
  state.gardenSlots[2] = { genotype: "aa", phenotype: "green" };
  state.gardenSlots[3] = { genotype: "aa", phenotype: "green" };
  for (let i = 4; i < 10; i++) state.gardenSlots[i] = null;
  state.selectedSlots = [];

  renderGarden();
  document.getElementById("garden-instructions").innerText = "Purification complete. Standard true-breeding strains established in slots 1-4.";
  triggerViolation("Used retrospective purification shortcut instead of selecting manually over generations.");
}

// ── Interactive Emasculation Bud Close-up mini-game ────────
function startCrossing() {
  if (state.selectedSlots.length !== 2) return;

  const crossingBox = document.getElementById("emasculation-box");
  crossingBox.style.display = "block";

  // Position 5 anthers dynamically inside the circle
  const arena = document.getElementById("emasculation-arena");
  // Clear any old nodes
  const oldAnthers = arena.querySelectorAll(".anther-node");
  oldAnthers.forEach(a => a.remove());

  state.emasculatingAnthers = [];
  state.emasculationSuccess = false;

  for (let i = 0; i < 5; i++) {
    const node = document.createElement("div");
    node.className = "anther-node";
    
    // Position radially
    const angle = (i * 2 * Math.PI) / 5;
    const radius = 65; // px from center
    const x = 110 + radius * Math.cos(angle) - 8; // center is 110,110
    const y = 110 + radius * Math.sin(angle) - 12;

    node.style.left = `${x}px`;
    node.style.top = `${y}px`;

    // Apply era-specific instability / wobble
    if (state.eraIndex === 0) {
      // 500 BCE Bronze needle wobble
      node.style.animation = `dc-pulse ${1.5 + Math.random()}s infinite alternate`;
      // Wobble position slightly
      node.style.transform = `rotate(${Math.random() * 20 - 10}deg)`;
    } else if (state.eraIndex === 1) {
      node.style.animation = `dc-pulse ${2.5 + Math.random()}s infinite alternate`;
    }

    const antherState = { id: i, plucked: false, element: node };
    state.emasculatingAnthers.push(antherState);

    node.addEventListener("click", () => pluckAnther(antherState));
    arena.appendChild(node);
  }

  document.getElementById("garden-instructions").innerText = "Emasculation Bud active. Pluck all 5 anthers.";
}

function pluckAnther(anther) {
  anther.plucked = true;
  anther.element.classList.add("plucked");
  anther.element.style.opacity = "0.15";

  // Check if all are plucked
  const allPlucked = state.emasculatingAnthers.every(a => a.plucked);
  if (allPlucked) {
    setTimeout(completeCrossing, 400);
  }
}

function abortCrossing() {
  document.getElementById("emasculation-box").style.display = "none";
  document.getElementById("garden-instructions").innerText = "Crossing aborted.";
}

function completeCrossing() {
  document.getElementById("emasculation-box").style.display = "none";

  const p1 = state.gardenSlots[state.selectedSlots[0]];
  const p2 = state.gardenSlots[state.selectedSlots[1]];

  // Generate hybrid F1 seeds
  // Under particulate dominant-recessive crossing:
  // If one parent is homozygous dominant (AA) and one recessive (aa), F1 is Aa (Yellow).
  // Emasculation error can cause accidental selfing: F1 will match maternal parent instead.
  const maternalIsP1 = true; // assume P1 is the maternal plant
  const failure = Math.random() < state.emasculationError;

  let genotype, phenotype;
  if (failure) {
    // Selfing occurred instead of hybrid crossing
    genotype = p1.genotype;
    phenotype = p1.phenotype;
    triggerViolation("Bud damage or anther residue triggered maternal self-pollination.");
  } else {
    // Successful hybrid cross
    if ((p1.genotype === "AA" && p2.genotype === "aa") || (p1.genotype === "aa" && p2.genotype === "AA")) {
      genotype = "Aa";
      phenotype = state.activeTheory === "particulate" ? "yellow" : "blend";
    } else if (p1.genotype === p2.genotype) {
      genotype = p1.genotype;
      phenotype = p1.phenotype;
    } else {
      // Mixed heterozgous crosses
      genotype = "Aa";
      phenotype = state.activeTheory === "particulate" ? "yellow" : "blend";
    }
  }

  // Place F1 seed back into slot 5
  state.gardenSlots[4] = { genotype, phenotype };
  state.selectedSlots = [];
  renderGarden();

  document.getElementById("garden-instructions").innerText = `F1 Seed generated in slot 5. ${failure ? "Warning: Emasculation failure! Selfed." : "Success: Hybrid cross completed."}`;
  
  // Unlock harvest button
  state.lastHarvestedSeeds = [phenotype === "yellow" ? 1.0 : (phenotype === "green" ? 0.0 : 0.5)];
  document.getElementById("btn-harvest").disabled = false;
}

function runSelfPollination() {
  if (state.selectedSlots.length !== 1) return;
  const parent = state.gardenSlots[state.selectedSlots[0]];

  // Self-pollination generates next generation (F2 if starting from Aa)
  const sampleSize = CAPABILITIES[state.eraIndex].maxCapacity;
  const error = state.emasculationError;

  const seeds = [];
  if (state.activeTheory === "particulate") {
    // Mendelian: Aa parent yields 75% Dominant (Yellow), 25% Recessive (Green)
    for (let i = 0; i < sampleSize; i++) {
      if (parent.genotype === "Aa") {
        seeds.push(Math.random() < 0.75 ? 1.0 : 0.0);
      } else {
        seeds.push(parent.phenotype === "yellow" ? 1.0 : 0.0);
      }
    }
  } else {
    // Blending: F2 normal distribution centered around F1 average (0.5)
    for (let i = 0; i < sampleSize; i++) {
      if (parent.genotype === "Aa") {
        const noise = boxMullerTransform() * 0.12;
        const val = Math.max(0.0, Math.min(1.0, 0.5 + noise));
        seeds.push(val);
      } else {
        const target = parent.phenotype === "yellow" ? 1.0 : 0.0;
        seeds.push(target);
      }
    }
  }

  state.lastHarvestedSeeds = seeds;
  state.selectedSlots = [];
  renderGarden();

  document.getElementById("btn-harvest").disabled = false;
  document.getElementById("garden-instructions").innerText = `Self-pollinated F1. Ready to harvest ${sampleSize} seeds.`;
}

function runHarvest() {
  // Drop harvested seeds down the Plinko board
  const seeds = state.lastHarvestedSeeds;
  if (!seeds || seeds.length === 0) return;

  // Reset tally count for this harvest
  state.tally = { yellow: 0, green: 0, blend: 0 };

  // Trigger Plinko drops
  dropPeas(seeds);

  document.getElementById("btn-harvest").disabled = true;
  document.getElementById("garden-instructions").innerText = `Harvested ${seeds.length} seeds. Watch them tumble into phenotype bins!`;
}

// ── Tally and Records ───────────────────────────────────────
function renderTally() {
  const cap = CAPABILITIES[state.eraIndex];
  const box = document.getElementById("tally-counts-box");
  box.innerHTML = "";

  const items = [
    { key: "yellow", name: cap.tallyNames.yellow, count: state.tally.yellow },
    { key: "green", name: cap.tallyNames.green, count: state.tally.green },
    { key: "blend", name: cap.tallyNames.blend, count: state.tally.blend }
  ];

  items.forEach(item => {
    const col = document.createElement("div");
    col.innerHTML = `
      <p class="dc-card-field" style="margin-bottom:5px; color:inherit;">${item.name}</p>
      <p style="font-size:1.8rem; font-weight:bold; margin:0;" class="tally-count-val">${item.count}</p>
    `;
    box.appendChild(col);
  });
}

// ── Hindsight Detector ──────────────────────────────────────
function triggerViolation(text) {
  state.violations.unshift({ date: new Date().toLocaleTimeString(), text });
  const log = document.getElementById("audit-log");
  log.innerHTML = "";

  state.violations.slice(0, 5).forEach(v => {
    const entry = document.createElement("div");
    entry.className = "arch-log-entry";
    entry.innerHTML = `
      <p class="arch-log-date" style="color:var(--hint-5);">${v.date} &mdash; Warning</p>
      <p class="arch-log-quote" style="border-left-color:var(--hint-5); font-family:var(--font-mono); font-size:0.65rem; line-height:1.4;">${v.text}</p>
    `;
    log.appendChild(entry);
  });
}

// ── Plinko Physics Board Animation ──────────────────────────
function initPlinko() {
  plinkoCanvas = document.getElementById("plinko-canvas");
  plinkoCtx = plinkoCanvas.getContext("2d");

  // Handle high-DPI scaling
  const dpr = window.devicePixelRatio || 1;
  const rect = plinkoCanvas.getBoundingClientRect();
  plinkoCanvas.width = rect.width * dpr;
  plinkoCanvas.height = rect.height * dpr;
  plinkoCtx.scale(dpr, dpr);

  // Generate Pegs in a triangle grid layout
  plinkoPegs = [];
  const rows = 6;
  const startY = 50;
  const rowHeight = 25;

  for (let r = 0; r < rows; r++) {
    const cols = r + 3;
    const rowWidth = (cols - 1) * 20;
    const startX = (rect.width - rowWidth) / 2;
    for (let c = 0; c < cols; c++) {
      plinkoPegs.push({
        x: startX + c * 20,
        y: startY + r * rowHeight,
        radius: 2
      });
    }
  }

  resetPlinkoBins();

  // Start loop
  if (plinkoAnimationId) cancelAnimationFrame(plinkoAnimationId);
  plinkoAnimationId = requestAnimationFrame(plinkoLoop);
}

function resetPlinkoBins() {
  const rect = plinkoCanvas.getBoundingClientRect();
  plinkoBins = [];
  
  if (state.activeTheory === "particulate") {
    // Exactly 2 bins: Green (left) and Yellow (right)
    plinkoBins.push({ xStart: 0, xEnd: rect.width / 2, count: 0, color: "#4a9980" });
    plinkoBins.push({ xStart: rect.width / 2, xEnd: rect.width, count: 0, color: "#f5c842" });
  } else {
    // 5 bins showing continuous normal curve
    const binCount = 5;
    const width = rect.width / binCount;
    for (let i = 0; i < binCount; i++) {
      // Color interpolation from green to yellow
      const ratio = i / (binCount - 1);
      const color = `rgb(${Math.floor(74 + (245 - 74) * ratio)}, ${Math.floor(153 + (200 - 153) * ratio)}, ${Math.floor(128 + (66 - 128) * ratio)})`;
      plinkoBins.push({
        xStart: i * width,
        xEnd: (i + 1) * width,
        count: 0,
        color: color
      });
    }
  }
}

function dropPeas(seeds) {
  const rect = plinkoCanvas.getBoundingClientRect();
  
  // Clear existing balls
  plinkoBalls = [];

  // Spawn balls sequentially with a small delay to look satisfying
  const rateLimit = Math.min(seeds.length, 100); // cap drop visual at 100 to avoid performance lag
  const stride = Math.max(1, Math.floor(seeds.length / rateLimit));

  for (let i = 0; i < seeds.length; i += stride) {
    const val = seeds[i];
    
    // Target bin x-coordinate based on seed value
    let targetX;
    if (state.activeTheory === "particulate") {
      // 1.0 (yellow) -> right bin. 0.0 (green) -> left bin.
      targetX = val > 0.5 ? (rect.width * 0.75) : (rect.width * 0.25);
    } else {
      // Continuous blending ratio mapping
      targetX = rect.width * 0.1 + val * (rect.width * 0.8);
    }

    plinkoBalls.push({
      x: rect.width / 2 + (Math.random() * 8 - 4),
      y: 15,
      vx: Math.random() * 2 - 1,
      vy: 1.5,
      targetX: targetX,
      val: val,
      settled: false
    });
  }
}

function plinkoLoop() {
  const rect = plinkoCanvas.getBoundingClientRect();
  plinkoCtx.clearRect(0, 0, rect.width, rect.height);

  // Draw bins
  plinkoBins.forEach(bin => {
    plinkoCtx.fillStyle = bin.color;
    plinkoCtx.globalAlpha = 0.12;
    plinkoCtx.fillRect(bin.xStart, rect.height - 80, bin.xEnd - bin.xStart, 80);
    
    // Draw bin stack indicator
    plinkoCtx.globalAlpha = 0.6;
    plinkoCtx.fillStyle = bin.color;
    const height = Math.min(bin.count * 1.5, 75); // stack scale
    plinkoCtx.fillRect(bin.xStart + 4, rect.height - height, (bin.xEnd - bin.xStart) - 8, height);

    // Draw borders
    plinkoCtx.strokeStyle = "rgba(74, 140, 204, 0.2)";
    plinkoCtx.beginPath();
    plinkoCtx.moveTo(bin.xStart, rect.height - 80);
    plinkoCtx.lineTo(bin.xStart, rect.height);
    plinkoCtx.stroke();
  });

  // Draw pegs
  plinkoCtx.globalAlpha = 0.5;
  plinkoCtx.fillStyle = "#eeddbb";
  plinkoPegs.forEach(peg => {
    plinkoCtx.beginPath();
    plinkoCtx.arc(peg.x, peg.y, peg.radius, 0, 2 * Math.PI);
    plinkoCtx.fill();
  });

  // Update & Draw balls
  plinkoCtx.globalAlpha = 0.95;
  plinkoBalls.forEach(ball => {
    if (ball.settled) {
      // draw settled ball
      plinkoCtx.fillStyle = getPeaColor(ball.val);
      plinkoCtx.beginPath();
      plinkoCtx.arc(ball.x, ball.y, 3, 0, 2 * Math.PI);
      plinkoCtx.fill();
      return;
    }

    // Gravity step
    ball.vy += 0.08;
    ball.x += ball.vx;
    ball.y += ball.vy;

    // Direct path drift towards target X to ensure they sort into correct bins
    const dx = ball.targetX - ball.x;
    ball.vx += dx * 0.008; // gentle pull

    // Check peg collisions
    plinkoPegs.forEach(peg => {
      const dist = Math.hypot(ball.x - peg.x, ball.y - peg.y);
      if (dist < 5) { // collision overlap
        // bounce vector
        const angle = Math.atan2(ball.y - peg.y, ball.x - peg.x);
        ball.vx = Math.cos(angle) * 1.2;
        ball.vy = Math.sin(angle) * 1.2 + 0.5;
      }
    });

    // Check bottom boundary / settle
    if (ball.y >= rect.height - 10) {
      ball.settled = true;
      ball.y = rect.height - 4 - Math.random() * 4; // settle stack
      
      // Increment bin count
      const matchingBin = plinkoBins.find(b => ball.x >= b.xStart && ball.x <= b.xEnd);
      if (matchingBin) {
        matchingBin.count++;
      }

      // Add to tally score
      if (state.activeTheory === "particulate") {
        if (ball.val > 0.5) state.tally.yellow++;
        else state.tally.green++;
      } else {
        if (ball.val > 0.7) state.tally.yellow++;
        else if (ball.val < 0.3) state.tally.green++;
        else state.tally.blend++;
      }
      renderTally();
    }

    plinkoCtx.fillStyle = getPeaColor(ball.val);
    plinkoCtx.beginPath();
    plinkoCtx.arc(ball.x, ball.y, 4, 0, 2 * Math.PI);
    plinkoCtx.fill();
  });

  plinkoAnimationId = requestAnimationFrame(plinkoLoop);
}

function getPeaColor(val) {
  if (state.activeTheory === "particulate") {
    return val > 0.5 ? "#f5c842" : "#4a9980";
  } else {
    // Interpolate continuous color shade
    const ratio = Math.max(0.0, Math.min(1.0, val));
    return `rgb(${Math.floor(74 + (245 - 74) * ratio)}, ${Math.floor(153 + (200 - 153) * ratio)}, ${Math.floor(128 + (66 - 128) * ratio)})`;
  }
}

function boxMullerTransform() {
  let u = 0, v = 0;
  while(u === 0) u = Math.random();
  while(v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}
