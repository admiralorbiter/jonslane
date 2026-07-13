/**
 * Orbital Mechanics Sandbox Game & Mission Manager
 * Handles:
 *  1. State Variables (Spacecraft position/velocity, active parent, synodic phase)
 *  2. Analytical Planet positions over time (t)
 *  3. Animation loop & Time warp execution
 *  4. KSP-style Maneuver Planning Node mechanics
 *  5. 6 Campaign Quests briefs & validators
 *  6. Attempt-gated productive failure hint loops
 *  7. LocalStorage score persistence
 */

const OrbitCampaign = (function () {
    // Current Active Quest
    let currentChapter = 1;
    let isRunning = false;
    let simTime = 0; // seconds
    let currentWarp = 1;
    let stepsPerFrame = 1;

    // Physics state
    let shipState = {
        pos: { x: 0, y: 0, z: 0 },      // relative to parent
        vel: { x: 0, y: 0, z: 0 },      // relative to parent
        posWorld: { x: 0, y: 0, z: 0 }, // relative to Sun
        velWorld: { x: 0, y: 0, z: 0 }, // relative to Sun
        parentKey: "earth",
        fuelBudget: 1000.0,
        fuelOptimal: 80.0,
        fuelUsed: 0.0
    };

    let planetStates = {}; // Live position/velocity of all celestial bodies

    // Maneuver Node planning state
    let activeNode = null; // { timeOffset, dv, direction, markerMesh }

    // Quest Tracking States
    const questCompletion = { 1: false, 2: false, 3: false, 4: false, 5: false, 6: false };
    let questStates = { leftAbsorbedNorm: 0.0 };
    let attemptCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    let activeFailureTriggered = false;

    // DOM bindings
    const btnPlayPause = document.getElementById("btn-play-pause");
    const btnResetSim = document.getElementById("btn-reset-sim");
    const btnAudioToggle = document.getElementById("btn-audio-toggle");
    const questBriefingBox = document.getElementById("quest-briefing-box");
    const fuelBarFill = document.getElementById("fuel-bar-fill");
    const fuelReadout = document.getElementById("fuel-readout");
    const fuelOptimalMarker = document.getElementById("fuel-optimal-marker");

    // HUD bindings
    const hudParent = document.getElementById("hud-val-parent");
    const hudAltitude = document.getElementById("hud-val-altitude");
    const hudVelocity = document.getElementById("hud-val-velocity");
    const hudEnergy = document.getElementById("hud-val-energy");
    const hudEccentricity = document.getElementById("hud-val-eccentricity");
    const hudPeriod = document.getElementById("hud-val-period");

    // Modal bindings
    const resultOverlay = document.getElementById("result-overlay");
    const resultTitle = document.getElementById("result-overlay-title");
    const resultDesc = document.getElementById("result-overlay-desc");
    const resultDiagnostics = document.getElementById("result-overlay-diagnostics");
    const btnResultPrimary = document.getElementById("btn-result-action-primary");
    const btnResultRetry = document.getElementById("btn-result-action-retry");

    // Maneuver popup DOM elements
    const maneuverPopup = document.getElementById("maneuver-popup");
    const nodeValPosition = document.getElementById("node-val-position");
    const nodeValDv = document.getElementById("node-val-dv");
    const btnNodeDvMinus = document.getElementById("btn-node-dv-minus");
    const btnNodeDvPlus = document.getElementById("btn-node-dv-plus");
    const btnNodeExecute = document.getElementById("btn-node-execute");
    const btnNodeDelete = document.getElementById("btn-node-delete");
    const btnCloseManeuver = document.getElementById("btn-close-maneuver");

    // Manual thruster control bindings
    let activeManualDir = "pro";
    const setBurnSize = document.getElementById("set-burn-size");
    const burnSizeReadout = document.getElementById("burn-size-readout");
    const btnExecuteManualBurn = document.getElementById("btn-execute-manual-burn");

    // Synodic window helper (for Mars Opposition)
    let marsLaunchSlider = null;

    /**
     * Initializes the campaign on DOM load.
     */
    function init() {
        // Initialize Three.js
        OrbitRenderer.init("orbit-canvas");

        // Load completion from localStorage if exists
        loadGameProgress();

        // Load first chapter
        loadChapter(1);

        // Bind playback control events
        btnPlayPause.addEventListener("click", () => {
            isRunning = !isRunning;
            btnPlayPause.textContent = isRunning ? "⏸ Pause" : "▶ Play";
            if (isRunning) {
                OrbitAudio.init();
            }
        });

        btnResetSim.addEventListener("click", () => {
            resetChapter();
        });

        btnAudioToggle.addEventListener("click", () => {
            const isMuted = OrbitAudio.toggleMute();
            btnAudioToggle.textContent = isMuted ? "🔇 Sound: Off" : "🔊 Sound: On";
        });

        // Bind warp buttons
        document.querySelectorAll("[id^='btn-warp-']").forEach(btn => {
            btn.addEventListener("click", (e) => {
                document.querySelectorAll("[id^='btn-warp-']").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                currentWarp = parseInt(btn.getAttribute("data-warp"));
                
                // Scale steps per frame to handle simulation speeds safely
                if (currentWarp === 1) stepsPerFrame = 1;
                else if (currentWarp === 10) stepsPerFrame = 10;
                else if (currentWarp === 100) stepsPerFrame = 60;
                else if (currentWarp === 1000) stepsPerFrame = 300;
            });
        });

        // Bind Tab selection buttons
        document.querySelectorAll(".quest-tab-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const ch = parseInt(btn.getAttribute("data-chapter"));
                loadChapter(ch);
            });
        });

        // Bind result card actions
        btnResultPrimary.addEventListener("click", () => {
            resultOverlay.classList.remove("active");
            if (btnResultPrimary.textContent.includes("Next")) {
                loadChapter(currentChapter + 1);
            } else {
                resetChapter();
            }
        });

        btnResultRetry.addEventListener("click", () => {
            resultOverlay.classList.remove("active");
            resetChapter();
        });

        // Bind manual thruster controls
        document.querySelectorAll(".btn-burn-dir").forEach(btn => {
            btn.addEventListener("click", () => {
                document.querySelectorAll(".btn-burn-dir").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                activeManualDir = btn.getAttribute("data-dir");
            });
        });

        setBurnSize.addEventListener("input", (e) => {
            burnSizeReadout.textContent = parseFloat(e.target.value).toFixed(2) + " km/s";
        });

        btnExecuteManualBurn.addEventListener("click", () => {
            const dv = parseFloat(setBurnSize.value);
            executeManualBurn(dv);
        });

        // Bind maneuver node events
        btnNodeDvMinus.addEventListener("click", () => adjustManeuverDv(-0.1));
        btnNodeDvPlus.addEventListener("click", () => adjustManeuverDv(0.1));
        btnNodeExecute.addEventListener("click", () => executePlannedBurn());
        btnNodeDelete.addEventListener("click", () => deletePlannedNode());
        btnCloseManeuver.addEventListener("click", () => {
            maneuverPopup.style.display = "none";
        });

        // Bind click-to-plan mode toggles
        document.getElementById("btn-mode-navigate").addEventListener("click", (e) => {
            document.getElementById("btn-mode-navigate").classList.add("active");
            document.getElementById("btn-mode-node").classList.remove("active");
        });
        document.getElementById("btn-mode-node").addEventListener("click", (e) => {
            document.getElementById("btn-mode-navigate").classList.remove("active");
            document.getElementById("btn-mode-node").classList.add("active");
            OrbitAudio.playWarningClick();
        });

        // Global hotkeys mapping
        window.addEventListener("keydown", (e) => {
            if (e.key === "w" || e.key === "W") selectManualDirection("pro");
            if (e.key === "s" || e.key === "S") selectManualDirection("ret");
            if (e.key === "a" || e.key === "A") selectManualDirection("rad_plus");
            if (e.key === "d" || e.key === "D") selectManualDirection("rad_minus");
            if (e.key === " ") {
                e.preventDefault();
                if (activeNode) executePlannedBurn();
                else btnExecuteManualBurn.click();
            }
        });

        // Start animation loop
        tick();
    }

    function selectManualDirection(dir) {
        document.querySelectorAll(".btn-burn-dir").forEach(b => b.classList.remove("active"));
        const btnId = {
            "pro": "btn-burn-pro",
            "ret": "btn-burn-ret",
            "rad_plus": "btn-burn-rad-plus",
            "rad_minus": "btn-burn-rad-minus"
        }[dir];
        document.getElementById(btnId).classList.add("active");
        activeManualDir = dir;
    }

    // === 2. ANALYTICAL PLANETARY SYSTEM CODES ===

    /**
     * Solves positions and velocities of all bodies analytically for time t.
     */
    function updatePlanetarySystem(t) {
        planetStates = {
            sun: { pos: { x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 } }
        };

        const keys = Object.keys(PhysicsSolver.BODIES);
        keys.forEach(key => {
            if (key === "sun") return;
            const body = PhysicsSolver.BODIES[key];

            if (body.parent === "sun") {
                const r = body.orbitalRadius;
                const omega = 2 * Math.PI / body.period;
                const angle = omega * t;

                planetStates[key] = {
                    pos: { x: r * Math.cos(angle), y: r * Math.sin(angle), z: 0 },
                    vel: { x: -r * omega * Math.sin(angle), y: r * omega * Math.cos(angle), z: 0 }
                };
            }
        });

        // Moon orbits Earth
        if (planetStates.earth) {
            const moonSpec = PhysicsSolver.BODIES.moon;
            const r = moonSpec.orbitalRadius;
            const omega = 2 * Math.PI / moonSpec.period;
            const angle = omega * t;

            const earthPos = planetStates.earth.pos;
            const earthVel = planetStates.earth.vel;

            planetStates.moon = {
                pos: {
                    x: earthPos.x + r * Math.cos(angle),
                    y: earthPos.y + r * Math.sin(angle),
                    z: 0
                },
                vel: {
                    x: earthVel.x - r * omega * Math.sin(angle),
                    y: earthVel.y + r * omega * Math.cos(angle),
                    z: 0
                }
            };
        }
    }

    /**
     * Translates local spacecraft position & velocity to absolute World Sun frame coordinates.
     */
    function syncSpacecraftWorld(shipLocalPos, shipLocalVel, parentKey) {
        const parentPos = planetStates[parentKey].pos;
        const parentVel = planetStates[parentKey].vel;

        shipState.posWorld = {
            x: shipLocalPos.x + parentPos.x,
            y: shipLocalPos.y + parentPos.y,
            z: shipLocalPos.z + parentPos.z
        };
        shipState.velWorld = {
            x: shipLocalVel.x + parentVel.x,
            y: shipLocalVel.y + parentVel.y,
            z: shipLocalVel.z + parentVel.z
        };
    }

    // === 3. MANEUVER PLANNING GIZMO MECHANICS ===

    /**
     * Handles visual node placement when clicking on/near the predicted orbit line.
     * Searches predicted coordinates to snap target position.
     */
    function handleCanvasNodePlacement(clickedLocalPos) {
        deletePlannedNode();

        // 1. Get predicted points of the current trajectory
        const predPoints = PhysicsSolver.getPredictedTrajectory(shipState.pos, shipState.vel, shipState.parentKey);
        if (predPoints.length === 0) return;

        // 2. Find the closest point in the predicted arc
        let minDistance = Infinity;
        let snappedPos = predPoints[0];

        predPoints.forEach(pt => {
            const dist = Math.sqrt(
                Math.pow(pt.x - clickedLocalPos.x, 2) +
                Math.pow(pt.y - clickedLocalPos.y, 2)
            );
            if (dist < minDistance) {
                minDistance = dist;
                snappedPos = pt;
            }
        });

        // 3. Spawn the planned node
        activeNode = {
            pos: snappedPos,
            dv: 0.20, // default planned delta-v
            direction: "pro"
        };

        shipState.activeNodePos = snappedPos;

        // Display popup
        maneuverPopup.style.display = "block";
        maneuverPopup.style.left = "40px";
        maneuverPopup.style.bottom = "120px";
        updateManeuverPopupReadout();
        updateVisuals();
    }

    function placePlannedNode(timeOffset) {
        // Fallback: place node at apogee/apoapsis
        const elements = PhysicsSolver.getOrbitalElements(shipState.pos, shipState.vel, shipState.parentKey);
        
        // Find a point 180 degrees from true anomaly
        const targetNu = (elements.nu + Math.PI) % (2 * Math.PI);
        const a = elements.a;
        const e = elements.eccentricity;
        const omega = elements.omega;
        const p = a * (1 - e*e);
        const r = p / (1 + e * Math.cos(targetNu));

        const dirX = Math.cos(omega);
        const dirY = Math.sin(omega);
        const perpX = -dirY;
        const perpY = dirX;

        const xLocal = r * Math.cos(targetNu);
        const yLocal = r * Math.sin(targetNu);

        const posLocal = {
            x: xLocal * dirX + yLocal * perpX,
            y: xLocal * dirY + yLocal * perpY,
            z: 0
        };

        handleCanvasNodePlacement(posLocal);
    }

    function adjustManeuverDv(val) {
        if (!activeNode) return;
        activeNode.dv = Math.max(0.01, activeNode.dv + val);
        updateManeuverPopupReadout();
        updateVisuals();
    }

    function updateManeuverPopupReadout() {
        if (!activeNode) return;
        nodeValPosition = document.getElementById("node-val-position");
        nodeValDv = document.getElementById("node-val-dv");
        
        nodeValPosition.textContent = "Apogee (planned)";
        nodeValDv.textContent = activeNode.dv.toFixed(2) + " km/s";
    }

    function deletePlannedNode() {
        activeNode = null;
        maneuverPopup.style.display = "none";
        updateVisuals();
    }

    function executePlannedBurn() {
        if (!activeNode) return;
        const burnSize = activeNode.dv * 1000; // convert to m/s
        if (shipState.fuelBudget < activeNode.dv) {
            OrbitAudio.playFailureBuzz();
            alert("Thrusters click empty — Insufficient Delta-V Fuel!");
            return;
        }

        // Apply burn prograde/retrograde instantly
        const vMag = Math.sqrt(shipState.vel.x*shipState.vel.x + shipState.vel.y*shipState.vel.y + shipState.vel.z*shipState.vel.z);
        const dir = { x: shipState.vel.x / vMag, y: shipState.vel.y / vMag, z: shipState.vel.z / vMag };

        shipState.vel.x += dir.x * burnSize;
        shipState.vel.y += dir.y * burnSize;
        shipState.vel.z += dir.z * burnSize;

        shipState.fuelUsed += activeNode.dv;
        shipState.fuelBudget -= activeNode.dv;

        OrbitAudio.startThruster();
        setTimeout(() => OrbitAudio.stopThruster(), 400);
        OrbitRenderer.triggerCameraShake(0.3);

        deletePlannedNode();
    }

    function executeManualBurn(dv) {
        if (shipState.fuelBudget < dv) {
            OrbitAudio.playFailureBuzz();
            alert("Thrusters click empty — Insufficient Delta-V Fuel!");
            return;
        }

        // Calculate direction vector relative to active frame
        const pos = shipState.pos;
        const vel = shipState.vel;
        const vMag = Math.sqrt(vel.x*vel.x + vel.y*vel.y + vel.z*vel.z);
        const rMag = Math.sqrt(pos.x*pos.x + pos.y*pos.y + pos.z*pos.z);

        let dir = { x: 0, y: 0, z: 0 };
        if (activeManualDir === "pro") {
            dir = { x: vel.x / vMag, y: vel.y / vMag, z: vel.z / vMag };
        } else if (activeManualDir === "ret") {
            dir = { x: -vel.x / vMag, y: -vel.y / vMag, z: -vel.z / vMag };
        } else if (activeManualDir === "rad_plus") {
            dir = { x: pos.x / rMag, y: pos.y / rMag, z: pos.z / rMag };
        } else if (activeManualDir === "rad_minus") {
            dir = { x: -pos.x / rMag, y: -pos.y / rMag, z: -pos.z / rMag };
        }

        const burnValSI = dv * 1000;
        shipState.vel.x += dir.x * burnValSI;
        shipState.vel.y += dir.y * burnValSI;
        shipState.vel.z += dir.z * burnValSI;

        shipState.fuelUsed += dv;
        shipState.fuelBudget -= dv;

        OrbitAudio.startThruster();
        setTimeout(() => OrbitAudio.stopThruster(), 400);
        OrbitRenderer.triggerCameraShake(0.25);
        updateVisuals();
    }

    // === 4. PROGRESSIVE CAMPAIGN QUESTS ===

    function loadChapter(ch) {
        currentChapter = ch;
        isRunning = false;
        simTime = 0;
        activeFailureTriggered = false;
        questStates.leftAbsorbedNorm = 0.0;
        
        btnPlayPause.textContent = "▶ Play";
        btnPlayPause.classList.remove("running");
        
        // 1. Initialize planets first to resolve references in renderer
        updatePlanetarySystem(0);

        // 2. Clear visual trails
        OrbitRenderer.clearTrail();
        deletePlannedNode();

        // Highlight active navigation tab
        document.querySelectorAll(".quest-tab-btn").forEach(btn => {
            btn.classList.remove("active");
            const btnCh = parseInt(btn.getAttribute("data-chapter"));
            if (questCompletion[btnCh]) {
                btn.classList.add("completed");
            }
        });
        document.getElementById(`tab-ch-${ch}`).classList.add("active");

        // Initialize unique planet layout & ship parameters
        const state = shipState;

        // Hide synodic launch slider if active on previous screen
        const sliderContainer = document.getElementById("canvas-toolbar");
        const existingLaunchGroup = document.getElementById("launch-window-group");
        if (existingLaunchGroup) existingLaunchGroup.remove();

        switch (ch) {
            case 1: // Orbit Injection
                state.parentKey = "earth";
                // Decaying altitude, speed slightly below orbital speed
                state.pos = { x: PhysicsSolver.BODIES.earth.radius + 200000, y: 0, z: 0 };
                state.vel = { x: 0, y: 7610, z: 0 };
                state.fuelBudget = 0.50; // tight budget
                state.fuelOptimal = 0.08;
                state.fuelUsed = 0.0;
                break;

            case 2: // Hohmann Transfer
                state.parentKey = "earth";
                state.pos = { x: PhysicsSolver.BODIES.earth.radius + 400000, y: 0, z: 0 };
                state.vel = { x: 0, y: 7669, z: 0 };
                state.fuelBudget = 6.00;
                state.fuelOptimal = 3.92;
                state.fuelUsed = 0.0;
                break;

            case 3: // Lunar Flyby (Mission 2.5)
                state.parentKey = "earth";
                state.pos = { x: PhysicsSolver.BODIES.earth.radius + 300000, y: 0, z: 0 };
                state.vel = { x: 0, y: 7720, z: 0 };
                state.fuelBudget = 4.50;
                state.fuelOptimal = 3.12;
                state.fuelUsed = 0.0;
                break;

            case 4: // Apollo Return
                state.parentKey = "earth";
                state.pos = { x: PhysicsSolver.BODIES.earth.radius + 300000, y: 0, z: 0 };
                state.vel = { x: 0, y: 7720, z: 0 };
                state.fuelBudget = 5.20;
                state.fuelOptimal = 4.90;
                state.fuelUsed = 0.0;
                break;

            case 5: // Mars opposition (synodic window slider)
                state.parentKey = "sun";
                // Add launch window delay slider dynamically to the toolbar
                const launchDiv = document.createElement("div");
                launchDiv.id = "launch-window-group";
                launchDiv.className = "tool-group";
                launchDiv.innerHTML = `
                    <span style="font-size: 0.75rem; color: var(--text-muted); font-family: monospace;">Launch Delay:</span>
                    <input type="range" id="launch-slider" min="0" max="780" step="5" value="0" style="width: 100px;">
                    <span id="launch-readout" style="font-size: 0.75rem; font-family: monospace; color:#fff;">0 days</span>
                `;
                sliderContainer.appendChild(launchDiv);

                marsLaunchSlider = document.getElementById("launch-slider");
                const readout = document.getElementById("launch-readout");
                
                marsLaunchSlider.addEventListener("input", (e) => {
                    const days = parseInt(e.target.value);
                    readout.textContent = days + " days";
                    
                    // Reset time offset and update planet coordinates dynamically
                    simTime = days * 86400; 
                    updatePlanetarySystem(simTime);
                    
                    // Place ship relative to newly calculated Earth coordinates
                    const earthPos = planetStates.earth.pos;
                    const earthVel = planetStates.earth.vel;
                    
                    // Start in LEO around Earth
                    const leor = PhysicsSolver.BODIES.earth.radius + 500000;
                    const leov = 7600;
                    state.pos = { x: earthPos.x + leor, y: earthPos.y, z: 0 };
                    state.vel = { x: earthVel.x, y: earthVel.y + leov, z: 0 };
                    
                    syncSpacecraftWorld(state.pos, state.vel, "sun");
                    OrbitRenderer.clearTrail();
                    updateVisuals();
                });

                // Set initial LEO state
                const earthPos = planetStates.earth.pos;
                const earthVel = planetStates.earth.vel;
                const leor = PhysicsSolver.BODIES.earth.radius + 500000;
                state.pos = { x: earthPos.x + leor, y: earthPos.y, z: 0 };
                state.vel = { x: earthVel.x, y: earthVel.y + 7600, z: 0 };
                state.fuelBudget = 8.00;
                state.fuelOptimal = 5.60;
                state.fuelUsed = 0.0;
                break;

            case 6: // Jupiter Slingshot
                state.parentKey = "sun";
                // Position Earth & Jupiter phased optimally
                simTime = 120 * 86400; // pre-phase
                updatePlanetarySystem(simTime);

                const jEarthPos = planetStates.earth.pos;
                const jEarthVel = planetStates.earth.vel;

                // Fire TLI equivalent to escape Earth SOI directly
                const escapev = 11200; 
                state.pos = { x: jEarthPos.x + PhysicsSolver.BODIES.earth.radius + 300000, y: jEarthPos.y, z: 0 };
                state.vel = { x: jEarthVel.x, y: jEarthVel.y + escapev, z: 0 };
                state.fuelBudget = 3.00;
                state.fuelOptimal = 1.50;
                state.fuelUsed = 0.0;
                break;
        }

        syncSpacecraftWorld(state.pos, state.vel, state.parentKey);
        updateBriefingBox(ch);
        updateVisuals();
    }

    function resetChapter() {
        loadChapter(currentChapter);
    }

    /**
     * Performs gameplay metrics checks per physics frame.
     */
    function validateObjectives(state) {
        if (questCompletion[currentChapter]) return;
        if (activeFailureTriggered) return;

        const currentParent = PhysicsSolver.BODIES[state.parentKey];
        const rMag = Math.sqrt(state.pos.x*state.pos.x + state.pos.y*state.pos.y + state.pos.z*state.pos.z);
        const altitude = rMag - currentParent.radius;

        // --- 1. CRITICAL FAILURE CRITERIA ---
        if (altitude < 0) {
            triggerFailure("Planetary Collision", `Spacecraft crashed into the surface of ${currentParent.name}. Make sure to perform burns at periapsis to keep your trajectory altitude above the planet's radius.`);
            return;
        }

        // Atmosphere reentry warning
        if (state.parentKey === "earth" && altitude < 80000) {
            if (currentChapter !== 4) { // Reentry is only allowed in Mission 3 (Apollo Return)
                triggerFailure("Atmospheric Disintegration", `The spacecraft entered Earth's thick atmospheric drag layers (below 80 km) at extreme speed and burned up. Make sure your periapsis stays clear of the atmosphere.`);
                return;
            }
        }

        if (state.fuelBudget <= 0.0 && !isRunning) {
            triggerFailure("Propellant Depletion", "The thruster fuel budget has hit zero while you are still stranded. Retry the mission and use maneuver planning nodes to calculate optimal burns.");
            return;
        }

        // --- 2. QUEST SUCCESS VALIDATIONS ---
        const elements = PhysicsSolver.getOrbitalElements(state.pos, state.vel, state.parentKey);

        switch (currentChapter) {
            case 1: // Orbit Injection
                if (elements.eccentricity < 0.01 && elements.periapsisAltitude > 100000 && isRunning) {
                    triggerSuccess("Circularized!", `Initial Eccentricity: 0.02<br>Final Eccentricity: ${elements.eccentricity.toFixed(4)} (Stable)<br>Delta-V Fuel Used: ${state.fuelUsed.toFixed(3)} km/s`);
                }
                break;

            case 2: // Hohmann Transfer LEO to GEO
                // GEO radius is 42,164,000 meters
                const targetGeoRadius = 42164000;
                const rDiff = Math.abs(rMag - targetGeoRadius);
                if (rDiff < 500000 && elements.eccentricity < 0.002 && isRunning) {
                    triggerSuccess("Geosynchronous Insertion!", `Target Alt: 35,786 km<br>Final Eccentricity: ${elements.eccentricity.toFixed(5)}<br>Fuel Used: ${state.fuelUsed.toFixed(3)} km/s (Optimal: 3.92 km/s)`);
                }
                break;

            case 3: // Lunar Flyby (Mission 2.5)
                // Enter Moon SOI and exit back to Earth
                if (state.parentKey === "moon") {
                    questStates.leftAbsorbedNorm = 1.0; // flag entered Moon SOI
                }
                if (questStates.leftAbsorbedNorm === 1.0 && state.parentKey === "earth" && isRunning) {
                    // Back in Earth SOI safely
                    triggerSuccess("Flyby Success!", `Entered Lunar SOI successfully, gathered gravitational slingshot readings, and returned back to Earth. fuel used: ${state.fuelUsed.toFixed(3)} km/s`);
                }
                break;

            case 4: // Apollo Return
                if (state.parentKey === "earth" && altitude < 120000 && altitude > 80000) {
                    const gamma = PhysicsSolver.computeFlightPathAngle(state.pos, state.vel);
                    if (gamma >= -12.0 && gamma <= -4.0) {
                        triggerSuccess("Reentry Corridor Intercepted!", `Reentry Corridor: -4° to -12°<br>Your Angle: ${gamma.toFixed(2)}° (Nominal)<br>Telemetry Status: Safe Splashdown.`);
                    } else if (gamma < -12.0) {
                        triggerFailure("Corridor Failure: Too Steep", `The reentry angle was too steep (${gamma.toFixed(2)}°). The spacecraft decelerated too violently and disintegrated under structural g-forces. Keep reentry angle above -12°.`);
                    } else if (gamma > -4.0) {
                        triggerFailure("Corridor Failure: Skip-Off", `The reentry angle was too shallow (${gamma.toFixed(2)}°). The spacecraft skipped off Earth's atmosphere back into deep space. Keep reentry angle below -4°.`);
                    }
                }
                break;

            case 5: // Mars opposition
                if (state.parentKey === "mars" && elements.eccentricity < 1.0) {
                    triggerSuccess("Mars Orbit Insertion!", `Captured in Martian gravitational well. Alt: ${altitude.toFixed(0)} meters.<br>Fuel Used: ${state.fuelUsed.toFixed(3)} km/s`);
                }
                break;

            case 6: // Jupiter Slingshot
                if (state.parentKey === "saturn") {
                    triggerSuccess("Saturn Arrival!", `Jupiter slingshot successfully boosted specific orbital energy to reach Saturn. Fuel Used: ${state.fuelUsed.toFixed(3)} km/s`);
                }
                break;
        }
    }

    function triggerSuccess(title, diagnostics) {
        isRunning = false;
        btnPlayPause.textContent = "▶ Play";
        
        // Save records to LocalStorage
        questCompletion[currentChapter] = true;
        saveGameProgress();

        // Play arpeggio
        OrbitAudio.playSuccessFanfare();

        // Render modal
        resultOverlay.classList.add("active");
        resultTitle.textContent = "Mission Accomplished!";
        resultTitle.className = "result-title success";
        resultDesc.textContent = "Telemetry checks confirm mission criteria successfully satisfied.";
        resultDiagnostics.innerHTML = diagnostics;

        btnResultPrimary.textContent = "Next Mission →";
        btnResultRetry.textContent = "Replay";

        // Highlight tab
        document.getElementById(`tab-ch-${currentChapter}`).classList.add("completed");
    }

    function triggerFailure(title, reason) {
        isRunning = false;
        activeFailureTriggered = true;
        btnPlayPause.textContent = "▶ Play";

        // Increment attempt counts
        attemptCounts[currentChapter]++;

        // Play dissonant slide
        OrbitAudio.playFailureBuzz();

        // Render modal
        resultOverlay.classList.add("active");
        resultTitle.textContent = title;
        resultTitle.className = "result-title failure";
        resultDesc.textContent = reason;

        // Provide physics-rich explanation
        let diagnosticText = `Attempt #${attemptCounts[currentChapter]} failure registered.<br>`;
        if (attemptCounts[currentChapter] >= 3) {
            diagnosticText += `<strong>Guidance Advisor Hint:</strong> Switch to the expert HUD panels, plan your nodes ahead of periapsis, and toggle between frames during flybys.`;
        } else {
            diagnosticText += `Use the ghost trails from this attempt to analyze orbit changes.`;
        }
        resultDiagnostics.innerHTML = diagnosticText;

        btnResultPrimary.textContent = "↺ Retry Mission";
        btnResultRetry.textContent = "Cancel";

        // Save snapshot trail as ghost orbit
        OrbitRenderer.saveGhostTrail();
    }

    // === 5. GAME ENGINE LOOP COORDINATION ===

    function tick() {
        if (isRunning) {
            // Apply physics steps according to active time warp multiplier
            for (let i = 0; i < stepsPerFrame; i++) {
                // 1. Solve planetary position for time t
                simTime += 10; // dt = 10s per step
                updatePlanetarySystem(simTime);

                // 2. Perform RK4 integration step for spacecraft
                const parentKey = shipState.parentKey;
                const parentBody = PhysicsSolver.BODIES[parentKey];
                
                const stepResult = PhysicsSolver.rk4Step(shipState.pos, shipState.vel, parentBody, 10, shipState);
                shipState.pos = stepResult.pos;
                shipState.vel = stepResult.vel;

                // 3. Sync absolute coordinates
                syncSpacecraftWorld(shipState.pos, shipState.vel, parentKey);

                // 4. Check patched conics SOI crossings
                const soiCheck = PhysicsSolver.updateSOI(shipState.posWorld, shipState.velWorld, parentKey, planetStates);
                if (soiCheck) {
                    shipState.pos = soiCheck.pos;
                    shipState.vel = soiCheck.vel;
                    shipState.parentKey = soiCheck.parentKey;
                    
                    OrbitAudio.playSOICrossing();
                    OrbitRenderer.triggerCameraShake(0.4);
                }

                // 5. Evaluate quest rules
                validateObjectives(shipState);
            }
        }

        // Render Frame
        updateVisuals();

        requestAnimationFrame(tick);
    }

    function updateVisuals() {
        // Sync celestial positions to renderer
        const showSOI = document.getElementById("chk-show-soi").checked;
        
        // Frame lock check (world vs locked on parent planet)
        const frameToggleVal = "world"; // default heliocentric
        
        // Sync active maneuver node position to shipState so renderer can position it
        shipState.activeNodePos = activeNode ? activeNode.pos : null;

        OrbitRenderer.update(planetStates, shipState, showSOI, frameToggleVal);

        // Update Keplerian prediction arc
        if (document.getElementById("chk-show-predicted").checked) {
            const predPoints = PhysicsSolver.getPredictedTrajectory(shipState.pos, shipState.vel, shipState.parentKey);
            OrbitRenderer.drawPrediction(predPoints, shipState.parentKey, planetStates);
            
            // Draw planned post-burn orbit if a maneuver node is active
            if (activeNode) {
                const vNode = PhysicsSolver.getVelocityAtOrbitPosition(activeNode.pos, shipState.parentKey, shipState.pos, shipState.vel);
                const vMag = Math.sqrt(vNode.x*vNode.x + vNode.y*vNode.y + vNode.z*vNode.z);
                const dir = { x: vNode.x / vMag, y: vNode.y / vMag, z: vNode.z / vMag };
                
                const plannedVel = {
                    x: vNode.x + dir.x * activeNode.dv * 1000,
                    y: vNode.y + dir.y * activeNode.dv * 1000,
                    z: 0
                };
                
                const plannedPoints = PhysicsSolver.getPredictedTrajectory(activeNode.pos, plannedVel, shipState.parentKey);
                OrbitRenderer.drawPlannedPrediction(plannedPoints, shipState.parentKey, planetStates);
            } else {
                OrbitRenderer.hidePlannedPrediction();
            }
        } else {
            OrbitRenderer.hidePlannedPrediction();
        }

        // Toggle ghost trails visibility
        const showGhost = document.getElementById("chk-show-ghost").checked;
        if (!showGhost) {
            OrbitRenderer.clearGhostTrail();
        }

        // Update HUD text readouts
        const parent = PhysicsSolver.BODIES[shipState.parentKey];
        const rMag = Math.sqrt(shipState.pos.x*shipState.pos.x + shipState.pos.y*shipState.pos.y + shipState.pos.z*shipState.pos.z);
        const altitudeKM = (rMag - parent.radius) / 1000;
        const speed = Math.sqrt(shipState.vel.x*shipState.vel.x + shipState.vel.y*shipState.vel.y + shipState.vel.z*shipState.vel.z) / 1000;
        
        const elements = PhysicsSolver.getOrbitalElements(shipState.pos, shipState.vel, shipState.parentKey);

        hudParent.textContent = parent.name;
        hudAltitude.textContent = altitudeKM.toFixed(1) + " km";
        hudVelocity.textContent = speed.toFixed(3) + " km/s";
        hudEnergy.textContent = (elements.energy / 1e6).toFixed(2) + " MJ/kg";
        hudEccentricity.textContent = elements.eccentricity.toFixed(4);
        hudPeriod.textContent = elements.period === Infinity ? "Infinity" : (elements.period / 3600).toFixed(2) + " hr";

        // Update fuel HUD
        fuelReadout.textContent = shipState.fuelBudget.toFixed(2) + " km/s";
        const budgetPercent = (shipState.fuelBudget / (shipState.fuelBudget + shipState.fuelUsed)) * 100;
        fuelBarFill.style.width = budgetPercent + "%";
        if (budgetPercent < 20) {
            fuelBarFill.className = "fuel-fill low";
        } else {
            fuelBarFill.className = "fuel-fill";
        }

        // Blinking Danger warning when inside Earth atmosphere warning limit (below 120km)
        const warningBanner = document.getElementById("warning-banner");
        if (warningBanner) {
            if (shipState.parentKey === "earth" && altitudeKM < 120 && currentChapter !== 4) {
                warningBanner.style.display = "block";
                if (isRunning && Math.random() < 0.02) {
                    OrbitAudio.playWarningClick();
                }
            } else {
                warningBanner.style.display = "none";
            }
        }
    }

    // === 6. LOCAL STORAGE PROGRESS PERSISTENCE ===

    function saveGameProgress() {
        try {
            localStorage.setItem("jonslane_orbital_progress", JSON.stringify(questCompletion));
            updateRecordsScoreboard();
        } catch (e) {
            console.error("Failed to write to localStorage:", e);
        }
    }

    function loadGameProgress() {
        try {
            const data = localStorage.getItem("jonslane_orbital_progress");
            if (data) {
                const parsed = JSON.parse(data);
                for (let k in parsed) {
                    questCompletion[k] = parsed[k];
                }
                updateRecordsScoreboard();
            }
        } catch (e) {
            console.error("Failed to load from localStorage:", e);
        }
    }

    function updateRecordsScoreboard() {
        for (let i = 1; i <= 6; i++) {
            const cell = document.getElementById(`score-m${i}`);
            if (cell) {
                cell.textContent = questCompletion[i] ? "🏅 Completed" : "—";
                cell.style.color = questCompletion[i] ? "var(--neon-emerald)" : "var(--text-muted)";
            }
        }
    }

    // --- DYNAMIC BRIEFINGS ACCORDIONS ---
    function updateBriefingBox(ch) {
        let content = "";
        switch (ch) {
            case 1:
                content = `
                    <h3 class="quest-title">1. Orbit Injection</h3>
                    <p>Your spacecraft is currently falling toward Earth's dense atmosphere (low altitude, $e = 0.02$). If you do not burn immediately, you will crash.</p>
                    <p>To circularize the orbit, you must raise the lowest point (periapsis). Burns at one side of an orbit raise the height of the opposite side.</p>
                    <div class="quest-objective-box">
                        <div class="quest-objective-title">🎯 Quest Objective</div>
                        <ul class="quest-checklist">
                            <li>Circularize the orbit (Eccentricity \(e < 0.01\)) with periapsis height strictly above \(100\text{ km}\).</li>
                        </ul>
                    </div>
                `;
                break;
            case 2:
                content = `
                    <h3 class="quest-title">2. LEO to GEO Transfer</h3>
                    <p>A communications satellite needs to reach Geosynchronous Orbit (GEO) at an altitude of 35,786 km. Direct path transfers consume massive fuel. Instead, execute a **Hohmann Transfer**.</p>
                    <p>A Hohmann transfer is a two-burn path: first, burn prograde to raise apoapsis. Second, wait half an orbit, then burn prograde again at apogee to circularize.</p>
                    <div class="quest-objective-box">
                        <div class="quest-objective-title">🎯 Quest Objective</div>
                        <ul class="quest-checklist">
                            <li>Raise your orbit and circularize at GEO altitude (radius \(42,164\text{ km}\)) with eccentricity \(e < 0.002\).</li>
                        </ul>
                    </div>
                `;
                break;
            case 3:
                content = `
                    <h3 class="quest-title">3. Lunar Flyby</h3>
                    <p>Interstellar navigation uses gravitational Spheres of Influence (SOI) to navigate. We will burn to exit Earth's gravity, enter the Moon's SOI, fly behind it, and return safely.</p>
                    <p>Flying past the Moon allows us to test patched conics transitions in real time.</p>
                    <div class="quest-objective-box">
                        <div class="quest-objective-title">🎯 Quest Objective</div>
                        <ul class="quest-checklist">
                            <li>Burn to exit LEO, enter the Moon's Sphere of Influence (SOI), and return to Earth's SOI safely.</li>
                        </ul>
                    </div>
                `;
                break;
            case 4:
                content = `
                    <h3 class="quest-title">4. Apollo Return</h3>
                    <p>Returning astronauts from the Moon requires hitting a narrow atmospheric entry corridor. Too steep, and the capsule breaks up under g-forces. Too shallow, and it skips off the atmosphere into space.</p>
                    <p>Align your planned burns to hit the reentry corridor perfectly.</p>
                    <div class="quest-objective-box">
                        <div class="quest-objective-title">🎯 Quest Objective</div>
                        <ul class="quest-checklist">
                            <li>Return to Earth and hit the reentry corridor between \(80\text{ km}\) and \(130\text{ km}\) with angle \(-12^\circ < \gamma < -4^\circ\).</li>
                        </ul>
                    </div>
                `;
                break;
            case 5:
                content = `
                    <h3 class="quest-title">5. Mars Opposition</h3>
                    <p>Mars orbits further from the Sun. Launching to Mars is only efficient during specific launch windows (when Mars is slightly ahead of Earth). Synodic alignments cycle once every 780 days.</p>
                    <p>Adjust the Launch delay slider to align the window before burning.</p>
                    <div class="quest-objective-box">
                        <div class="quest-objective-title">🎯 Quest Objective</div>
                        <ul class="quest-checklist">
                            <li>Align the launch window, execute transfer, and achieve orbit around Mars (\(e < 1.0\)).</li>
                        </ul>
                    </div>
                `;
                break;
            case 6:
                content = `
                    <h3 class="quest-title">6. Jupiter Slingshot</h3>
                    <p>Saturn is too far to reach directly with our spacecraft's limited fuel. We will execute a **Gravitational Assist** by flying close behind Jupiter, stealing a tiny fraction of its orbital velocity to slingshot to Saturn.</p>
                    <div class="quest-objective-box">
                        <div class="quest-objective-title">🎯 Quest Objective</div>
                        <ul class="quest-checklist">
                            <li>Navigate past Jupiter to gain speed, and enter Saturn's Sphere of Influence.</li>
                        </ul>
                    </div>
                `;
                break;
        }

        questBriefingBox.innerHTML = content;
        if (window.MathJax) {
            MathJax.typesetPromise();
        }
    }

    // Export to window scope for html button bindings
    return {
        init,
        loadChapter,
        placePlannedNode,
        handleCanvasNodePlacement,
        getShipState: () => shipState
    };
})();

// DOM startup trigger
document.addEventListener("DOMContentLoaded", () => {
    OrbitCampaign.init();
});
