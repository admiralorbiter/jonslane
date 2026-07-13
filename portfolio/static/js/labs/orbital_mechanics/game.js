/**
 * 'I Need to Get Out of This Place' — Game State and Campaign Manager
 * Coordinates the central loop, stage setups, input ticks, and objective scoring.
 */

const OrbitCampaign = (function () {
    // Current Active Stage
    let currentStageIdx = 1;
    let isRunning = false;
    let simTime = 0; // seconds
    let currentWarp = 1;
    let stepsPerFrame = 1;

    // LocalStorage keys
    const SAVE_KEY = "jonslane_get_out_progress";

    // Spacecraft State
    let shipState = {
        pos: { x: 0, y: 0, z: 0 },
        vel: { x: 0, y: 0, z: 0 },
        posWorld: { x: 0, y: 0, z: 0 },
        velWorld: { x: 0, y: 0, z: 0 },
        heading: 0, // direction in radians
        isThrusting: false,
        parentKey: "earth",
        fuelBudget: 1.0,  // active delta-v capacity (km/s)
        fuelUsed: 0.0,    // spent delta-v (km/s)
        activeNodePos: null
    };

    let planetStates = {};
    let activeNode = null;
    let cameraMode = "follow"; // 'follow' or 'free'
    let questStates = { leftAbsorbedNorm: 0.0 };
    let headingVel = 0.0; // angular velocity for rotation inertia (rad/frame)
    let hasCrashed = false;

    // Stage definition table
    const STAGES = {
        1: {
            title: "Decaying Fast",
            desc: "Your station is decaying rapidly due to atmospheric drag. Rotate using A/D, and HOLD SHIFT to burn your engines prograde to raise your periapsis.",
            optimalFuel: 0.35,
            fuelCap: 0.80,
            setup: function() {
                shipState.parentKey = "earth";
                shipState.pos = { x: PhysicsSolver.BODIES.earth.radius + 150000, y: 0, z: 0 };
                shipState.vel = { x: 0, y: 7850, z: 0 };
                shipState.heading = Math.PI / 2; // prograde pointing
            },
            objectives: [
                { id: "periapsis", label: "Raise periapsis altitude above 200 km", check: (ship, el) => el.periapsis > 200000, done: false },
                { id: "survive", label: "Do not descend below 120 km altitude", check: (ship, el) => el.periapsis > 120000 && (Math.sqrt(ship.pos.x*ship.pos.x + ship.pos.y*ship.pos.y) - PhysicsSolver.BODIES.earth.radius) > 120000, done: true }
            ]
        },
        2: {
            title: "Higher Ground",
            desc: "Establish a higher circular orbit. Click on your predicted trajectory to place a maneuver node at apogee, adjust size, and press Space to execute.",
            optimalFuel: 0.50,
            fuelCap: 1.20,
            setup: function() {
                shipState.parentKey = "earth";
                shipState.pos = { x: PhysicsSolver.BODIES.earth.radius + 220000, y: 0, z: 0 };
                shipState.vel = { x: 0, y: 7780, z: 0 };
                shipState.heading = Math.PI / 2;
            },
            objectives: [
                { id: "apoapsis", label: "Raise apoapsis altitude to 450 km (±10km)", check: (ship, el) => Math.abs(el.apoapsis - 450000) < 15000, done: false },
                { id: "circular", label: "Circularize at 450 km (eccentricity < 0.005)", check: (ship, el) => el.eccentricity < 0.005 && Math.abs(el.periapsis - 450000) < 15000, done: false }
            ]
        },
        3: {
            title: "The Transfer",
            desc: "Perform a Hohmann transfer to Geostationary Orbit (GEO) at 35,786 km altitude. Establish a stable circular orbit.",
            optimalFuel: 3.90,
            fuelCap: 5.50,
            setup: function() {
                shipState.parentKey = "earth";
                shipState.pos = { x: PhysicsSolver.BODIES.earth.radius + 300000, y: 0, z: 0 };
                shipState.vel = { x: 0, y: 7730, z: 0 };
                shipState.heading = Math.PI / 2;
            },
            objectives: [
                { id: "geo_alt", label: "Establish orbit at 35,786 km altitude (±100km)", check: (ship, el) => Math.abs(el.periapsis - 35786000) < 150000 && Math.abs(el.apoapsis - 35786000) < 150000, done: false },
                { id: "geo_circ", label: "Establish circular orbit (eccentricity < 0.005)", check: (ship, el) => el.eccentricity < 0.005, done: false }
            ]
        },
        4: {
            title: "The Moon Calls",
            desc: "Leave Earth. Perform a Trans-Lunar Injection (TLI), enter the Moon's gravitational Sphere of Influence, and circularize.",
            optimalFuel: 3.20,
            fuelCap: 5.00,
            setup: function() {
                shipState.parentKey = "earth";
                shipState.pos = { x: PhysicsSolver.BODIES.earth.radius + 300000, y: 0, z: 0 };
                shipState.vel = { x: 0, y: 7730, z: 0 };
                shipState.heading = Math.PI / 2;
            },
            objectives: [
                { id: "moon_soi", label: "Enter the Moon's Sphere of Influence (SOI)", check: (ship) => ship.parentKey === "moon", done: false },
                { id: "moon_orbit", label: "Circularize around Moon (altitude < 1,000 km)", check: (ship, el) => ship.parentKey === "moon" && el.eccentricity < 0.05 && el.periapsis < 1000000, done: false }
            ]
        },
        5: {
            title: "Escape Velocity",
            desc: "Escape Earth's gravity well. Burn prograde until your trajectory relative to Earth becomes hyperbolic (eccentricity > 1.0) and you enter Heliocentric space.",
            optimalFuel: 3.20,
            fuelCap: 4.50,
            setup: function() {
                shipState.parentKey = "earth";
                shipState.pos = { x: PhysicsSolver.BODIES.earth.radius + 400000, y: 0, z: 0 };
                shipState.vel = { x: 0, y: 7670, z: 0 };
                shipState.heading = Math.PI / 2;
            },
            objectives: [
                { id: "earth_escape", label: "Achieve Earth escape velocity (eccentricity > 1.0)", check: (ship, el) => ship.parentKey === "earth" && el.eccentricity >= 1.0, done: false },
                { id: "sun_orbit", label: "Enter Heliocentric orbit (parent changes to Sun)", check: (ship) => ship.parentKey === "sun", done: false }
            ]
        },
        6: {
            title: "Rendezvous with Mars",
            desc: "Align Earth and Mars using Time Warp, then execute an interplanetary Hohmann transfer burn to enter Mars's SOI.",
            optimalFuel: 3.60,
            fuelCap: 5.50,
            setup: function() {
                shipState.parentKey = "sun";
                // Start Earth phased relative to Mars
                simTime = 120 * 86400; // pre-phased days
                updatePlanetarySystem(simTime);
                const earthPos = planetStates.earth.pos;
                const earthVel = planetStates.earth.vel;
                const leor = PhysicsSolver.BODIES.earth.radius + 500000;
                shipState.pos = { x: earthPos.x + leor, y: earthPos.y, z: 0 };
                shipState.vel = { x: earthVel.x, y: earthVel.y + 7600, z: 0 };
                shipState.heading = Math.PI / 2;
            },
            objectives: [
                { id: "mars_soi", label: "Enter Mars's Sphere of Influence", check: (ship) => ship.parentKey === "mars", done: false }
            ]
        },
        7: {
            title: "The Slingshot",
            desc: "Perform a gravity assist. Navigate close behind Jupiter's moving body to steal its momentum and slingshot yourself out to Saturn.",
            optimalFuel: 2.50,
            fuelCap: 4.50,
            setup: function() {
                shipState.parentKey = "sun";
                simTime = 180 * 86400; 
                updatePlanetarySystem(simTime);
                const earthPos = planetStates.earth.pos;
                const earthVel = planetStates.earth.vel;
                shipState.pos = { x: earthPos.x + PhysicsSolver.BODIES.earth.radius + 400000, y: earthPos.y, z: 0 };
                shipState.vel = { x: earthVel.x, y: earthVel.y + 11500, z: 0 }; // escape burn speed
                shipState.heading = Math.PI / 2;
            },
            objectives: [
                { id: "jupiter_soi", label: "Perform a Jupiter flyby (enter & exit SOI)", check: (ship) => {
                    if (ship.parentKey === "jupiter") {
                        questStates.leftAbsorbedNorm = 1.0; // flag entered Jupiter
                    }
                    return ship.parentKey === "sun" && questStates.leftAbsorbedNorm === 1.0;
                }, done: false },
                { id: "saturn_soi", label: "Enter Saturn's Sphere of Influence", check: (ship) => ship.parentKey === "saturn", done: false }
            ]
        },
        8: {
            title: "I Need to Get Out",
            desc: "Achieve solar escape velocity. Stretch your orbit out of the solar system completely.",
            optimalFuel: 6.00,
            fuelCap: 9.00,
            setup: function() {
                shipState.parentKey = "sun";
                shipState.pos = { x: PhysicsSolver.BODIES.earth.orbitalRadius, y: 0, z: 0 };
                shipState.vel = { x: 0, y: 29780, z: 0 }; // Earth velocity
                shipState.heading = Math.PI / 2;
            },
            objectives: [
                { id: "solar_escape", label: "Achieve Heliocentric escape velocity (eccentricity > 1.0)", check: (ship, el) => ship.parentKey === "sun" && el.eccentricity >= 1.0, done: false }
            ]
        }
    };

    const stageCompletion = { 1: false, 2: false, 3: false, 4: false, 5: false, 6: false, 7: false, 8: false };

    function init() {
        // Initialize modules
        OrbitHUD.init();
        OrbitRenderer.init("orbit-canvas");

        // Load saves
        loadGameProgress();

        // Load current stage
        loadStage(1);

        // Bind core buttons
        document.getElementById("btn-play-pause").addEventListener("click", () => {
            isRunning = !isRunning;
            document.getElementById("btn-play-pause").textContent = isRunning ? "⏸ Pause" : "▶ Play";
            if (isRunning && window.OrbitAudio) {
                OrbitAudio.init();
            }
        });

        document.getElementById("btn-reset-sim").addEventListener("click", () => {
            loadStage(currentStageIdx);
        });

        document.getElementById("btn-warp-down").addEventListener("click", () => {
            changeWarp(-1);
        });

        document.getElementById("btn-warp-up").addEventListener("click", () => {
            changeWarp(1);
        });

        // Start requestAnimationFrame
        tick();
    }

    /**
     * Initializes parameters for the chosen campaign level.
     */
    function loadStage(idx) {
        currentStageIdx = idx;
        isRunning = false;
        simTime = 0;
        document.getElementById("btn-play-pause").textContent = "▶ Play";
        
        activeNode = null;
        questStates.leftAbsorbedNorm = 0.0;
        hasCrashed = false;
        headingVel = 0.0;

        const stage = STAGES[idx];
        shipState.fuelBudget = stage.fuelCap;
        shipState.fuelUsed = 0.0;

        // Run custom position setups
        stage.setup();
        updatePlanetarySystem(0);
        syncSpacecraftWorld(shipState.pos, shipState.vel, shipState.parentKey);

        // Reset objectives done status
        stage.objectives.forEach(obj => obj.done = false);

        // Sync visual overlays & log briefings
        OrbitRenderer.clearTrail();
        OrbitHUD.updateStageProgress(currentStageIdx, 8, stageCompletion);
        OrbitHUD.updateMissionLog(stage.title, stage.desc, stage.objectives, shipState.fuelUsed, stage.optimalFuel);
        OrbitHUD.updateFuel(shipState.fuelBudget, shipState.fuelUsed);
        OrbitHUD.updateNodeEditor(null);

        // Reset frame label text
        const frameText = document.getElementById("frame-text");
        if (frameText) {
            const parent = PhysicsSolver.BODIES[shipState.parentKey];
            frameText.textContent = parent.name === "Sun" ? "Heliocentric Frame" : `${parent.name} Reference Frame`;
        }
        cameraMode = "follow";
        OrbitRenderer.setCameraLockMode(cameraMode);
    }

    /**
     * Physics, keyboard orientation rotation, and check tick loop.
     */
    function tick() {
        if (isRunning) {
            // --- ROTATION (once per frame, inertial feel) ---
            const ROT_ACCEL = 0.003;  // rad/frame² acceleration
            const ROT_DAMP  = 0.75;   // damping factor per frame
            const ROT_MAX   = 0.06;   // max angular speed (rad/frame)

            if (OrbitControlsManager.isHeld("a")) {
                headingVel -= ROT_ACCEL;
            } else if (OrbitControlsManager.isHeld("d")) {
                headingVel += ROT_ACCEL;
            }
            headingVel *= ROT_DAMP;
            headingVel = Math.max(-ROT_MAX, Math.min(ROT_MAX, headingVel));
            shipState.heading += headingVel;

            // --- THRUST (once per frame — clamp so warp doesn't multiply force) ---
            const isThrusting = OrbitControlsManager.isHeld("shift");
            shipState.isThrusting = isThrusting && shipState.fuelBudget > 0;

            if (shipState.isThrusting) {
                const thrustAcc = 20.0; // m/s^2 — halved for better feel
                const thrustDt  = 1.0;  // always 1s pulse per visual frame

                const dvKM = (thrustAcc * thrustDt) / 1000;
                shipState.fuelBudget = Math.max(0, shipState.fuelBudget - dvKM);
                shipState.fuelUsed  += dvKM;

                shipState.vel.x += Math.cos(shipState.heading) * thrustAcc * thrustDt;
                shipState.vel.y += Math.sin(shipState.heading) * thrustAcc * thrustDt;

                if (window.OrbitAudio) OrbitAudio.startThruster();
                OrbitRenderer.triggerCameraShake(0.015);
            } else {
                if (window.OrbitAudio) OrbitAudio.stopThruster();
            }

            // --- PHYSICS INTEGRATION (runs stepsPerFrame times for warp) ---
            for (let s = 0; s < stepsPerFrame; s++) {
                simTime += 10;
                updatePlanetarySystem(simTime);

                const parentKey  = shipState.parentKey;
                const parentBody = PhysicsSolver.BODIES[parentKey];

                // Crash check BEFORE integration (prevents sub-surface ghost)
                if (checkCrashState(parentBody)) break;

                const stepResult = PhysicsSolver.rk4Step(shipState.pos, shipState.vel, parentBody, 10, shipState);
                shipState.pos = stepResult.pos;
                shipState.vel = stepResult.vel;

                syncSpacecraftWorld(shipState.pos, shipState.vel, parentKey);

                const soiCheck = PhysicsSolver.updateSOI(shipState.posWorld, shipState.velWorld, parentKey, planetStates);
                if (soiCheck) {
                    shipState.pos = soiCheck.pos;
                    shipState.vel = soiCheck.vel;
                    shipState.parentKey = soiCheck.parentKey;
                    if (window.OrbitAudio) OrbitAudio.playSOICrossing();
                    OrbitRenderer.triggerCameraShake(0.4);
                }

                validateStageObjectives();
            }
        } else {
            shipState.isThrusting = false;
            if (window.OrbitAudio) OrbitAudio.stopThruster();
        }

        // Render WebGL Viewport
        const elements = PhysicsSolver.getOrbitalElements(shipState.pos, shipState.vel, shipState.parentKey);
        OrbitHUD.updateTelemetry(shipState, planetStates);
        OrbitHUD.updateFuel(shipState.fuelBudget, shipState.fuelUsed);

        OrbitRenderer.update(planetStates, shipState, true, cameraMode === "follow" ? shipState.parentKey : "world");

        // Trajectory prediction drawing
        const predPoints = PhysicsSolver.getPredictedTrajectory(shipState.pos, shipState.vel, shipState.parentKey);
        OrbitRenderer.drawPrediction(predPoints, shipState.parentKey, planetStates, elements);

        // Active node planned post-burn orbit drawing
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

        requestAnimationFrame(tick);
    }

    /**
     * Checks if coordinates satisfy objective checks.
     */
    function validateStageObjectives() {
        const stage = STAGES[currentStageIdx];
        const elements = PhysicsSolver.getOrbitalElements(shipState.pos, shipState.vel, shipState.parentKey);

        let allDone = true;
        stage.objectives.forEach(obj => {
            const isFinished = obj.check(shipState, elements);
            if (isFinished) {
                obj.done = true;
            }
            if (!obj.done) {
                allDone = false;
            }
        });

        // Update checklist display
        OrbitHUD.updateMissionLog(stage.title, stage.desc, stage.objectives, shipState.fuelUsed, stage.optimalFuel);

        // Win verification!
        if (allDone) {
            isRunning = false;
            stageCompletion[currentStageIdx] = true;
            saveGameProgress();

            // Trigger victory particle confetti burst
            if (window.OrbitRenderer && window.OrbitRenderer.triggerVictoryBurst) {
                window.OrbitRenderer.triggerVictoryBurst();
            }

            const efficiency = (shipState.fuelUsed / stage.optimalFuel);
            let scoreGrade = "C";
            if (efficiency <= 1.05) scoreGrade = "S";
            else if (efficiency <= 1.2) scoreGrade = "A";
            else if (efficiency <= 1.5) scoreGrade = "B";

            // Trigger capcom radio static complete dialog
            OrbitHUD.showTransmission("CAPCOM", `Mission completed with Grade ${scoreGrade}! Excellent work pilot, you escaped the environment. Preparing next sequence.`, () => {
                if (currentStageIdx < 8) {
                    loadStage(currentStageIdx + 1);
                } else {
                    alert("INTERSTELLAR ESCAPE VELOCITY ACHIEVED. YOU ESCAPED THIS PLACE FOREVER.");
                }
            });
        }
    }

    /**
     * Maps coordinates to world frame.
     */
    function syncSpacecraftWorld(shipLocalPos, shipLocalVel, parentKey) {
        if (parentKey === "sun") {
            shipState.posWorld = { ...shipLocalPos };
            shipState.velWorld = { ...shipLocalVel };
        } else {
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
    }

    /**
     * Checks if the ship has hit the surface of its parent body.
     * If so, stops the simulation and shows a cinematic crash screen.
     * Returns true if a crash was detected (so the caller can break).
     */
    function checkCrashState(parentBody) {
        if (hasCrashed) return true;

        const dist = Math.sqrt(
            shipState.pos.x * shipState.pos.x +
            shipState.pos.y * shipState.pos.y +
            shipState.pos.z * shipState.pos.z
        );

        if (dist < parentBody.radius) {
            hasCrashed = true;
            isRunning  = false;
            shipState.isThrusting = false;

            if (window.OrbitAudio) {
                OrbitAudio.stopThruster();
                OrbitAudio.playFailureBuzz();
            }
            OrbitRenderer.triggerCameraShake(1.5);

            const bodyName = parentBody.name || "the planet";
            const impactSpeed = Math.sqrt(
                shipState.vel.x * shipState.vel.x +
                shipState.vel.y * shipState.vel.y
            );
            const speedKms = (impactSpeed / 1000).toFixed(1);

            OrbitHUD.showTransmission(
                "CAPCOM ⚠️",
                `SIGNAL LOST. Spacecraft impacted the surface of ${bodyName} at ${speedKms} km/s. Mission abort. Resetting to last checkpoint — press Restart Mission to try again.`,
                () => { /* stays paused, user hits restart */ }
            );

            return true;
        }

        return false;
    }

    /**
     * Resolves click snaps on the canvas using a pre-filtered visual index.
     */
    function handleCanvasSnapClick(index) {
        const predPoints = PhysicsSolver.getPredictedTrajectory(shipState.pos, shipState.vel, shipState.parentKey);
        if (predPoints.length === 0 || index < 0 || index >= predPoints.length) return;

        const snappedPos = predPoints[index];
        deletePlannedNode();

        activeNode = {
            pos: snappedPos,
            dv: 0.20,
            direction: "pro"
        };

        shipState.activeNodePos = snappedPos;
        OrbitHUD.updateNodeEditor(activeNode);
    }

    /**
     * Keydown Space key executes node burn.
     */
    function triggerSpaceAction() {
        if (activeNode) {
            // Execute planned node burn
            const burnSize = activeNode.dv;
            if (shipState.fuelBudget < burnSize) {
                alert("Insufficient fuel!");
                return;
            }

            const vNode = PhysicsSolver.getVelocityAtOrbitPosition(activeNode.pos, shipState.parentKey, shipState.pos, shipState.vel);
            const vMag = Math.sqrt(vNode.x*vNode.x + vNode.y*vNode.y + vNode.z*vNode.z);
            const dir = { x: vNode.x / vMag, y: vNode.y / vMag, z: vNode.z / vMag };

            // Instantly transition spacecraft to node coordinates and add delta-v
            shipState.pos = activeNode.pos;
            shipState.vel = {
                x: vNode.x + dir.x * burnSize * 1000,
                y: vNode.y + dir.y * burnSize * 1000,
                z: 0
            };

            shipState.fuelBudget -= burnSize;
            shipState.fuelUsed += burnSize;

            deletePlannedNode();
            
            if (window.OrbitAudio) {
                OrbitAudio.startThruster();
                setTimeout(() => OrbitAudio.stopThruster(), 400);
            }
            OrbitRenderer.triggerCameraShake(0.35);
        }
    }

    function placeNodeAtApogee() {
        const elements = PhysicsSolver.getOrbitalElements(shipState.pos, shipState.vel, shipState.parentKey);
        const targetNu = Math.PI; // apogee true anomaly is pi
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

        const predPoints = PhysicsSolver.getPredictedTrajectory(shipState.pos, shipState.vel, shipState.parentKey);
        let minDistance = Infinity;
        let closestIndex = 0;
        for (let i = 0; i < predPoints.length; i++) {
            const pt = predPoints[i];
            const dist = Math.sqrt(Math.pow(pt.x - posLocal.x, 2) + Math.pow(pt.y - posLocal.y, 2));
            if (dist < minDistance) {
                minDistance = dist;
                closestIndex = i;
            }
        }
        handleCanvasSnapClick(closestIndex);
    }

    function deletePlannedNode() {
        activeNode = null;
        shipState.activeNodePos = null;
        OrbitHUD.updateNodeEditor(null);
    }

    function adjustWarp(dir) {
        // Custom warp speeds matching keys [ / ]
        const warps = [1, 10, 100, 1000];
        let idx = warps.indexOf(currentWarp);
        idx = Math.max(0, Math.min(warps.length - 1, idx + dir));
        currentWarp = warps[idx];

        if (currentWarp === 1) stepsPerFrame = 1;
        else if (currentWarp === 10) stepsPerFrame = 10;
        else if (currentWarp === 100) stepsPerFrame = 60;
        else if (currentWarp === 1000) stepsPerFrame = 300;
        
        // Show warp selection in DOM if available
        const statusText = `WARP: ${currentWarp}x`;
        const speedIndicator = document.getElementById("warp-indicator");
        if (speedIndicator) speedIndicator.textContent = statusText;
    }

    function changeWarp(dir) {
        adjustWarp(dir);
    }

    function cutThrust() {
        shipState.isThrusting = false;
    }

    function toggleMapMode() {
        cameraMode = cameraMode === "follow" ? "free" : "follow";
        OrbitRenderer.setCameraLockMode(cameraMode);
        
        const frameText = document.getElementById("frame-text");
        if (frameText) {
            if (cameraMode === "follow") {
                const parent = PhysicsSolver.BODIES[shipState.parentKey];
                frameText.textContent = parent.name === "Sun" ? "Heliocentric Frame" : `${parent.name} Reference Frame`;
            } else {
                frameText.textContent = "Free Map Frame (Heliocentric)";
            }
        }
    }

    /**
     * Analytical celestial coordinates solver over time t.
     */
    function updatePlanetarySystem(t) {
        planetStates = {
            sun: { pos: { x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 } }
        };

        const keys = ["earth", "mars", "jupiter", "saturn"];
        keys.forEach(key => {
            const body = PhysicsSolver.BODIES[key];
            const omega = (2 * Math.PI) / body.period;
            const r = body.orbitalRadius;
            const angle = omega * t;

            planetStates[key] = {
                pos: { x: r * Math.cos(angle), y: r * Math.sin(angle), z: 0 },
                vel: { x: -r * omega * Math.sin(angle), y: r * omega * Math.cos(angle), z: 0 }
            };
        });

        // Add Moon relative to Earth
        if (planetStates.earth) {
            const earthPos = planetStates.earth.pos;
            const earthVel = planetStates.earth.vel;
            const moonSpec = PhysicsSolver.BODIES.moon;
            const omega = (2 * Math.PI) / moonSpec.period;
            const r = moonSpec.orbitalRadius;
            const angle = omega * t;

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

    function saveGameProgress() {
        try {
            localStorage.setItem(SAVE_KEY, JSON.stringify(stageCompletion));
        } catch (e) {
            console.error("Failed to write to localStorage:", e);
        }
    }

    function loadGameProgress() {
        try {
            const val = localStorage.getItem(SAVE_KEY);
            if (val) {
                const parsed = JSON.parse(val);
                Object.assign(stageCompletion, parsed);
            }
        } catch (e) {
            console.error("Failed to read localStorage:", e);
        }
    }

    // Public API
    return {
        init,
        loadStage,
        tick,
        changeWarp,
        triggerSpaceAction,
        deletePlannedNode,
        placeNodeAtApogee,
        cutThrust,
        toggleMapMode,
        handleCanvasSnapClick,
        getShipState: () => shipState
    };
})();

// DOM startup trigger
document.addEventListener("DOMContentLoaded", () => {
    OrbitCampaign.init();
});
