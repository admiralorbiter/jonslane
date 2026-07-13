/**
 * Telemetry HUD and DOM Layer Module for 'I Need to Get Out of This Place'
 * Handles updates to vehicle readouts, mission checklists, and transmission overlays.
 */

const OrbitHUD = (function () {
    // Warning
    warningBannerEl = document.getElementById("warning-banner");
    let periapsisEl, apoapsisEl;
    let navballCanvas, navballCtx;
    let orbitBadgePe, orbitBadgeAp;

    function init() {
        parentEl = document.getElementById("hud-val-parent");
        altEl = document.getElementById("hud-val-altitude");
        velEl = document.getElementById("hud-val-velocity");
        fpaEl = document.getElementById("hud-val-fpa");
        eccEl = document.getElementById("hud-val-eccentricity");
        perEl = document.getElementById("hud-val-period");
        periapsisEl = document.getElementById("hud-val-periapsis");
        apoapsisEl = document.getElementById("hud-val-apoapsis");
        fuelReadoutEl = document.getElementById("fuel-readout");
        fuelFillEl = document.getElementById("fuel-bar-fill");
        briefingEl = document.getElementById("quest-briefing-box");
        stageProgressEl = document.getElementById("stage-indicator");

        // Transmission elements
        transmissionPanel = document.getElementById("transmission-panel");
        transmissionText = document.getElementById("transmission-text");
        transmissionAvatar = document.getElementById("transmission-avatar");

        // Node panels
        nodePanel = document.getElementById("maneuver-popup");
        nodePositionEl = document.getElementById("node-val-position");
        nodeDvEl = document.getElementById("node-val-dv");
        btnNodeExecute = document.getElementById("btn-node-execute");
        btnNodeDelete = document.getElementById("btn-node-delete");

        // Warning
        warningBannerEl = document.getElementById("warning-banner");

        // Navball & badges
        navballCanvas = document.getElementById("navball-canvas");
        if (navballCanvas) {
            navballCtx = navballCanvas.getContext("2d");
        }
        orbitBadgePe = document.getElementById("orbit-badge-pe");
        orbitBadgeAp = document.getElementById("orbit-badge-ap");
    }

    /**
     * Updates continuous status readouts.
     */
    function updateTelemetry(shipState, planetStates) {
        if (!altEl) return;

        const parent = PhysicsSolver.BODIES[shipState.parentKey];
        const rMag = Math.sqrt(shipState.pos.x*shipState.pos.x + shipState.pos.y*shipState.pos.y + shipState.pos.z*shipState.pos.z);
        const altKM = (rMag - parent.radius) / 1000;
        const speed = Math.sqrt(shipState.vel.x*shipState.vel.x + shipState.vel.y*shipState.vel.y + shipState.vel.z*shipState.vel.z) / 1000;
        
        const elements = PhysicsSolver.getOrbitalElements(shipState.pos, shipState.vel, shipState.parentKey);
        const fpa = PhysicsSolver.computeFlightPathAngle(shipState.pos, shipState.vel);

        // Update telemetry slots
        parentEl.textContent = parent.name.toUpperCase();
        altEl.textContent = altKM < 1000 ? altKM.toFixed(1) + " km" : (altKM/1000).toFixed(2) + "k km";
        velEl.textContent = speed.toFixed(3) + " km/s";
        fpaEl.textContent = fpa.toFixed(1) + "°";
        eccEl.textContent = elements.eccentricity.toFixed(4);
        perEl.textContent = elements.period === Infinity ? "ESCAPE" : (elements.period / 3600).toFixed(2) + " hr";

        // Update periapsis & apoapsis
        if (periapsisEl) {
            const peKM = elements.periapsisAltitude / 1000;
            periapsisEl.textContent = peKM < 1000 ? peKM.toFixed(1) + " km" : (peKM/1000).toFixed(0) + "k km";
        }
        if (apoapsisEl) {
            const apKM = elements.apoapsisAltitude / 1000;
            if (apKM === Infinity || elements.apoapsisAltitude === Infinity) {
                apoapsisEl.textContent = "ESCAPE";
            } else {
                apoapsisEl.textContent = apKM < 1000 ? apKM.toFixed(1) + " km" : (apKM/1000).toFixed(0) + "k km";
            }
        }

        // Update atmospheric warnings
        if (warningBannerEl) {
            if (parent.atmosphereLimit && altKM * 1000 < parent.atmosphereLimit) {
                warningBannerEl.style.display = "block";
                warningBannerEl.textContent = `⚠️ WARNING: ALTITUDE ${altKM.toFixed(1)}km BELOW ATMOSPHERE LIMIT (${(parent.atmosphereLimit/1000).toFixed(0)}km)`;
            } else {
                warningBannerEl.style.display = "none";
            }
        }

        // Dynamic CSS states
        document.body.classList.toggle("state-thrusting", !!shipState.isThrusting);
        const isDanger = parent.atmosphereLimit && (altKM * 1000 < parent.atmosphereLimit);
        document.body.classList.toggle("state-danger", !!isDanger);

        // Draw 2D Navball
        drawNavball(shipState, elements);

        // Update Apoapsis/Periapsis markers in screen space
        updateOrbitLabels(shipState, elements, planetStates);
    }

    /**
     * Renders a 2D attitude instrument (compass) inside the bottom-left canvas.
     */
    function drawNavball(shipState, elements) {
        if (!navballCtx || !navballCanvas) return;

        const ctx = navballCtx;
        const w = navballCanvas.width;
        const h = navballCanvas.height;
        const cx = w / 2;
        const cy = h / 2;
        const r = 45; // compass radius

        // Clear canvas
        ctx.clearRect(0, 0, w, h);

        // Draw background sphere circle
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(10, 11, 22, 0.85)";
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
        ctx.stroke();

        // Draw simple crosshair axes
        ctx.beginPath();
        ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy);
        ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Calculate Prograde direction vector relative to ship heading direction
        const velAngle = Math.atan2(shipState.vel.y, shipState.vel.x);
        const shipHeading = shipState.heading || 0;

        // Angle difference relative to ship pointing angle (top of compass)
        const relProgAngle = velAngle - shipHeading;

        // Draw Prograde vector marker
        drawMarker(ctx, cx, cy, r - 10, relProgAngle, "#00f2fe", "PRO");

        // Draw Retrograde vector marker (opposite side)
        const relRetroAngle = relProgAngle + Math.PI;
        drawMarker(ctx, cx, cy, r - 10, relRetroAngle, "#f59e0b", "RET");

        // Draw static ship reference pointer at top center (pointing up)
        ctx.save();
        ctx.translate(cx, cy - r + 3);
        ctx.beginPath();
        ctx.moveTo(0, -6);
        ctx.lineTo(-5, 4);
        ctx.lineTo(5, 4);
        ctx.closePath();
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.restore();
    }

    function drawMarker(ctx, cx, cy, r, relAngle, color, label) {
        // Align marker relative coordinates (0 angle points UP, so subtract PI/2)
        const mx = cx + Math.cos(relAngle - Math.PI / 2) * r;
        const my = cy + Math.sin(relAngle - Math.PI / 2) * r;

        ctx.beginPath();
        ctx.arc(mx, my, 8, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.font = "bold 7px 'Share Tech Mono', monospace";
        ctx.fillStyle = color;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, mx, my);
    }

    /**
     * Positions Apoapsis & Periapsis labels in screen coordinates.
     */
    function updateOrbitLabels(shipState, elements, planetStates) {
        if (!orbitBadgePe || !orbitBadgeAp) return;
        if (!window.OrbitRenderer || !window.OrbitRenderer.projectCoordinates) return;

        const parent = PhysicsSolver.BODIES[shipState.parentKey];

        // 1. Periapsis
        if (elements.periapsisAltitude !== undefined) {
            const ecc = elements.eccentricity;
            let dirX = 1, dirY = 0;
            if (ecc > 1e-6) {
                dirX = elements.ex / ecc;
                dirY = elements.ey / ecc;
            }
            const rPe = parent.radius + elements.periapsisAltitude;
            const posLocalPe = { x: dirX * rPe, y: dirY * rPe, z: 0 };

            const screenPos = window.OrbitRenderer.projectCoordinates(posLocalPe, shipState.parentKey, planetStates);
            if (screenPos) {
                orbitBadgePe.style.display = "block";
                orbitBadgePe.style.left = `${screenPos.x}px`;
                orbitBadgePe.style.top = `${screenPos.y}px`;
                const peKM = elements.periapsisAltitude / 1000;
                orbitBadgePe.textContent = `Pe: ${peKM.toFixed(0)} km`;
            } else {
                orbitBadgePe.style.display = "none";
            }
        } else {
            orbitBadgePe.style.display = "none";
        }

        // 2. Apoapsis
        if (elements.eccentricity < 1.0 && elements.apoapsisAltitude !== undefined && elements.apoapsisAltitude !== Infinity) {
            const ecc = elements.eccentricity;
            let dirX = 1, dirY = 0;
            if (ecc > 1e-6) {
                dirX = -elements.ex / ecc;
                dirY = -elements.ey / ecc;
            }
            const rAp = parent.radius + elements.apoapsisAltitude;
            const posLocalAp = { x: dirX * rAp, y: dirY * rAp, z: 0 };

            const screenPos = window.OrbitRenderer.projectCoordinates(posLocalAp, shipState.parentKey, planetStates);
            if (screenPos) {
                orbitBadgeAp.style.display = "block";
                orbitBadgeAp.style.left = `${screenPos.x}px`;
                orbitBadgeAp.style.top = `${screenPos.y}px`;
                const apKM = elements.apoapsisAltitude / 1000;
                orbitBadgeAp.textContent = `Ap: ${apKM.toFixed(0)} km`;
            } else {
                orbitBadgeAp.style.display = "none";
            }
        } else {
            orbitBadgeAp.style.display = "none";
        }
    }

    /**
     * Updates dynamic fuel bar graphics.
     */
    function updateFuel(budget, used) {
        if (!fuelReadoutEl) return;
        const total = budget + used;
        const pct = total > 0 ? (budget / total) * 100 : 0;

        fuelReadoutEl.textContent = budget.toFixed(2) + " km/s";
        fuelFillEl.style.width = pct + "%";

        if (pct < 20) {
            fuelFillEl.className = "fuel-fill low";
        } else {
            fuelFillEl.className = "fuel-fill";
        }
    }

    /**
     * Renders mission log cards and checklists.
     */
    function updateMissionLog(title, desc, objectives, fuelUsed, fuelBudget) {
        if (!briefingEl) return;

        let listHTML = "";
        objectives.forEach(obj => {
            const statusIcon = obj.done ? "🟢" : "⚪";
            listHTML += `<li>${statusIcon} ${obj.label}</li>`;
        });

        briefingEl.innerHTML = `
            <h3>STAGE DATA: ${title.toUpperCase()}</h3>
            <p>${desc}</p>
            <div class="quest-objective-box" style="margin-top: 1rem;">
                <div class="quest-objective-title">🎯 Mission Objectives:</div>
                <ul class="quest-checklist" style="list-style: none; padding-left: 0; margin-top: 0.5rem;">
                    ${listHTML}
                </ul>
            </div>
            <div style="margin-top: 0.75rem; font-size: 0.7rem; color: var(--text-muted); font-family: var(--hud-font);">
                STAGE FUEL SPENT: ${fuelUsed.toFixed(3)} km/s (Optimal target: ${fuelBudget.toFixed(2)} km/s)
            </div>
        `;
    }

    /**
     * Displays story transmissions as radio interruptions.
     */
    function showTransmission(avatar, message, onCompleteCallback) {
        if (!transmissionPanel) return;

        transmissionAvatar.textContent = avatar.toUpperCase();
        transmissionText.textContent = "";
        transmissionPanel.style.display = "flex";

        let charIdx = 0;
        
        // Procedural typewriter effect
        const timer = setInterval(() => {
            if (charIdx < message.length) {
                transmissionText.textContent += message[charIdx];
                charIdx++;
                if (charIdx % 3 === 0 && window.OrbitAudio) {
                    OrbitAudio.playWarningClick(); // soft radio static click
                }
            } else {
                clearInterval(timer);
                
                // Allow skipping or closing after typing finishes
                const dismissBtn = document.createElement("button");
                dismissBtn.className = "btn-maneuver-action";
                dismissBtn.textContent = "DISMISS LOG LINK";
                dismissBtn.style.marginTop = "0.75rem";
                dismissBtn.style.width = "auto";
                dismissBtn.style.padding = "0.4rem 1.2rem";
                dismissBtn.onclick = () => {
                    transmissionPanel.style.display = "none";
                    dismissBtn.remove();
                    if (onCompleteCallback) onCompleteCallback();
                };
                transmissionPanel.querySelector(".transmission-box").appendChild(dismissBtn);
            }
        }, 30);
    }

    /**
     * Renders or hides node planner popup.
     */
    function updateNodeEditor(activeNode) {
        if (!nodePanel) return;

        if (activeNode) {
            nodePanel.style.display = "block";
            nodePositionEl.textContent = activeNode.direction === "pro" ? "Prograde Burn" : "Retrograde Burn";
            nodeDvEl.textContent = activeNode.dv.toFixed(2) + " km/s";
        } else {
            nodePanel.style.display = "none";
        }
    }

    /**
     * Renders top stage progression indicators.
     */
    function updateStageProgress(currentIdx, totalStages, stageCompletion) {
        if (!stageProgressEl) return;

        let stepsHTML = "";
        for (let i = 1; i <= totalStages; i++) {
            let cls = "stage-step";
            if (i === currentIdx) cls += " active";
            else if (stageCompletion[i]) cls += " completed";
            stepsHTML += `<div class="${cls}" data-stage="${i}">STAGE ${i}</div>`;
        }
        stageProgressEl.innerHTML = stepsHTML;

        // Bind clicks to stage indicators for navigation of unlocked levels
        document.querySelectorAll(".stage-step").forEach(step => {
            step.onclick = () => {
                const stageNum = parseInt(step.getAttribute("data-stage"));
                OrbitCampaign.loadStage(stageNum);
            };
        });
    }

    return {
        init,
        updateTelemetry,
        updateFuel,
        updateMissionLog,
        showTransmission,
        updateNodeEditor,
        updateStageProgress
    };
})();
