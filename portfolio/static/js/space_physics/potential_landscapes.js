import { Solvers } from './solvers.js';
import { CanvasHelpers } from './canvas_helpers.js';

// 1. Configuration & Simulation State
const state = {
    t: 0,
    s: 0,              // Position along track (arc-length)
    v: 0,              // Velocity along track (v_s)
    mass: 1.0,
    energy: 26.0,      // Draggable Total Energy (Joules)
    zeroOffset: 0.0,
    isPaused: true,
    isDraggingEnergy: false,
    isDraggingParticle: false,
    parameters: {
        g: 9.81,
    },
    // Scrollytelling Visibility Flags
    currentStep: 1,
    showEnergyLine: false,
    showAllowedForbidden: false,
    showTurningPoints: false,
    showQuantumPreviewToggle: false,
    enableQuantumPreview: false
};

// Double-Well Potential Curve Definition: y(x) = 0.005x^4 - 0.2x^2 + 0.1x + 3.5
const xMin = -10;
const xMax = 10;
const lutSteps = 1000;
const lut = []; // Look-up table mapping x -> s
let totalS = 0;

function getTrackHeight(x) {
    return 0.005 * Math.pow(x, 4) - 0.2 * Math.pow(x, 2) + 0.1 * x + 3.5;
}

function getTrackSlope(x) {
    return 0.02 * Math.pow(x, 3) - 0.4 * x + 0.1;
}

// 2. Arc-Length Parametrization Mapping
function initTrack() {
    lut.length = 0;
    totalS = 0;
    lut.push({ x: xMin, s: 0 });

    for (let i = 1; i <= lutSteps; i++) {
        const xPrev = xMin + ((i - 1) / lutSteps) * (xMax - xMin);
        const xCurr = xMin + (i / lutSteps) * (xMax - xMin);
        const ds = Math.sqrt(
            Math.pow(xCurr - xPrev, 2) +
            Math.pow(getTrackHeight(xCurr) - getTrackHeight(xPrev), 2)
        );
        totalS += ds;
        lut.push({ x: xCurr, s: totalS });
    }
    // Start particle in the left valley
    state.s = totalS * 0.27;
}

function xFromS(s) {
    if (s <= 0) return xMin;
    if (s >= totalS) return xMax;
    let low = 0, high = lut.length - 1;
    while (low < high - 1) {
        const mid = Math.floor((low + high) / 2);
        if (lut[mid].s < s) low = mid;
        else high = mid;
    }
    const ratio = (s - lut[low].s) / (lut[high].s - lut[low].s);
    return lut[low].x + ratio * (lut[high].x - lut[low].x);
}

function sFromX(x) {
    if (x <= xMin) return 0;
    if (x >= xMax) return totalS;
    let low = 0, high = lut.length - 1;
    while (low < high - 1) {
        const mid = Math.floor((low + high) / 2);
        if (lut[mid].x < x) low = mid;
        else high = mid;
    }
    const ratio = (x - lut[low].x) / (lut[high].x - lut[low].x);
    return lut[low].s + ratio * (lut[high].s - lut[low].s);
}

function getPhysicsAtS(s) {
    const x = xFromS(s);
    const y = getTrackHeight(x);
    const dydx = getTrackSlope(x);
    const len = Math.sqrt(1 + dydx * dydx);
    return {
        x, y,
        slope: dydx / len, // dy/ds
        tangentX: 1 / len,
        tangentY: dydx / len,
        normalX: -dydx / len,
        normalY: 1 / len
    };
}

function getPotentialEnergy(s) {
    const phys = getPhysicsAtS(s);
    return state.mass * state.parameters.g * (phys.y - state.zeroOffset);
}

function computeAcceleration(s, v, t) {
    const phys = getPhysicsAtS(s);
    // Acceleration: F_s / m = -mg * dy/ds / m = -g * dy/ds
    return -state.parameters.g * phys.slope;
}

// 3. Turning Points & Allowed Bounds
function getTurningPoints() {
    const tps = [];
    const limitY = state.energy / (state.mass * state.parameters.g) + state.zeroOffset;
    const scanSteps = 200;

    for (let i = 0; i < scanSteps; i++) {
        const x1 = xMin + (i / scanSteps) * (xMax - xMin);
        const x2 = xMin + ((i + 1) / scanSteps) * (xMax - xMin);
        const y1 = getTrackHeight(x1);
        const y2 = getTrackHeight(x2);

        if ((y1 - limitY) * (y2 - limitY) <= 0) {
            const ratio = (limitY - y1) / (y2 - y1);
            const xRoot = x1 + ratio * (x2 - x1);
            tps.push({ x: xRoot, s: sFromX(xRoot) });
        }
    }
    return tps.sort((a, b) => a.s - b.s);
}

function getParticleAllowedBounds() {
    const tps = getTurningPoints();
    const sTPs = [0, ...tps.map(tp => tp.s), totalS];

    for (let i = 0; i < sTPs.length - 1; i++) {
        const sMid = (sTPs[i] + sTPs[i+1]) / 2;
        if (state.s >= sTPs[i] && state.s <= sTPs[i+1]) {
            const U = getPotentialEnergy(sMid);
            if (U <= state.energy) {
                return { sMin: sTPs[i], sMax: sTPs[i+1] };
            }
        }
    }
    return { sMin: 0, sMax: totalS };
}

// 4. Playback Toolbar Actions
function togglePlayPause() {
    state.isPaused = !state.isPaused;
    const playPauseBtn = document.getElementById('btn-play-pause');
    const stepBtn = document.getElementById('btn-step');

    if (playPauseBtn) {
        playPauseBtn.textContent = state.isPaused ? 'Play' : 'Pause';
        playPauseBtn.className = state.isPaused ? 'lab-btn' : 'lab-btn lab-btn-primary';
    }
    if (stepBtn) {
        stepBtn.disabled = !state.isPaused;
    }
}

function resetSimulation() {
    state.t = 0;
    state.v = 0;
    state.s = totalS * 0.27; // Start in deep left valley
    draw();
}

function stepSimulationFrame() {
    if (state.isPaused) {
        const bounds = getParticleAllowedBounds();
        const dummyState = { x: state.s, v: state.v, t: state.t };
        Solvers.velocityVerlet(dummyState, computeAcceleration, 0.016);

        // Bounce condition
        if (dummyState.x < bounds.sMin) {
            dummyState.x = bounds.sMin + 1e-4;
            const phys = getPhysicsAtS(bounds.sMin);
            dummyState.v = Math.abs(dummyState.v) * Math.sign(-phys.slope);
        } else if (dummyState.x > bounds.sMax) {
            dummyState.x = bounds.sMax - 1e-4;
            const phys = getPhysicsAtS(bounds.sMax);
            dummyState.v = -Math.abs(dummyState.v) * Math.sign(-phys.slope);
        }

        state.s = dummyState.x;
        state.v = dummyState.v;
        state.t = dummyState.t;
        draw();
    }
}

// 5. Decoupled Physics Loop
let lastTime = 0;
let accumulator = 0;
const simTimeStep = 0.001;

function animationLoop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    let frameTime = (timestamp - lastTime) / 1000.0;
    lastTime = timestamp;

    if (frameTime > 0.15) {
        frameTime = 0.15;
    }

    if (!state.isPaused && !state.isDraggingParticle && !state.isDraggingEnergy) {
        accumulator += frameTime;
        const bounds = getParticleAllowedBounds();

        while (accumulator >= simTimeStep) {
            const dummyState = { x: state.s, v: state.v, t: state.t };
            Solvers.velocityVerlet(dummyState, computeAcceleration, simTimeStep);

            // Natural turnaround with Verlet and clamping safeguards
            if (dummyState.x < bounds.sMin) {
                dummyState.x = bounds.sMin + 1e-4;
                const phys = getPhysicsAtS(bounds.sMin);
                dummyState.v = Math.abs(dummyState.v) * Math.sign(-phys.slope);
            } else if (dummyState.x > bounds.sMax) {
                dummyState.x = bounds.sMax - 1e-4;
                const phys = getPhysicsAtS(bounds.sMax);
                dummyState.v = -Math.abs(dummyState.v) * Math.sign(-phys.slope);
            }

            state.s = dummyState.x;
            state.v = dummyState.v;
            state.t = dummyState.t;
            accumulator -= simTimeStep;
        }
    }

    draw();
    throttleUpdateAccessibleTable(timestamp);

    requestAnimationFrame(animationLoop);
}

// 6. Canvas Rendering Engine
let canvas, ctx;
let viewportMapper;
let hatchPattern;

function initHatchPattern() {
    const pCanvas = document.createElement('canvas');
    pCanvas.width = 12;
    pCanvas.height = 12;
    const pCtx = pCanvas.getContext('2d');
    pCtx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    pCtx.lineWidth = 1.5;
    pCtx.beginPath();
    pCtx.moveTo(0, 12);
    pCtx.lineTo(12, 0);
    pCtx.stroke();
    hatchPattern = ctx.createPattern(pCanvas, 'repeat');
}

function draw() {
    if (!canvas || !ctx) return;
    const w = canvas.getBoundingClientRect().width;
    const h = canvas.getBoundingClientRect().height;
    ctx.clearRect(0, 0, w, h);

    // Map y coordinates from -1 to 36 to fit the full height of double-well curves
    viewportMapper = CanvasHelpers.getViewportMapper(w, h, -11, 11, -1, 36);

    const limitY = state.energy / (state.mass * state.parameters.g) + state.zeroOffset;
    const tps = getTurningPoints();

    // A. Fill energy regions (translucent kinetic and hatch pattern barrier)
    if (state.showAllowedForbidden) {
        drawEnergyShading(limitY);
    }

    // B. Draw Coordinate grid
    drawGrid();

    // C. Draw Potential reference line U = 0
    if (state.showEnergyLine) {
        const zeroY = viewportMapper.toPixels(-11, state.zeroOffset);
        const zeroYEnd = viewportMapper.toPixels(11, state.zeroOffset);
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.2)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(zeroY.px, zeroY.py);
        ctx.lineTo(zeroYEnd.px, zeroYEnd.py);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // D. Draw Draggable Total Energy Line (Amber)
    if (state.showEnergyLine) {
        const pEnergy = viewportMapper.toPixels(-11, limitY);
        const pEnergyEnd = viewportMapper.toPixels(11, limitY);
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = state.isDraggingEnergy ? 3.5 : 2.5;
        ctx.beginPath();
        ctx.moveTo(pEnergy.px, pEnergy.py);
        ctx.lineTo(pEnergyEnd.px, pEnergyEnd.py);
        ctx.stroke();

        ctx.fillStyle = '#f59e0b';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`E = ${state.energy.toFixed(1)}J`, pEnergy.px + 10, pEnergy.py - 6);
    }

    // E. Draw Track (Two-Pass allowed/forbidden highlights)
    drawTrack(limitY);

    // F. Draw Wavefunction Envelope (Quantum tunneling precursor)
    if (state.enableQuantumPreview && state.showQuantumPreviewToggle) {
        drawQuantumTunnelingWave(limitY);
    }

    // G. Draw Geometric Turning Point Brackets
    if (state.showTurningPoints) {
        tps.forEach(tp => {
            const p = viewportMapper.toPixels(tp.x, limitY);
            // Determine bracket direction (left [ vs right ])
            const nextX = tp.x + 0.1;
            const isAllowedRight = getTrackHeight(nextX) <= limitY;
            drawBracket(p.px, p.py, isAllowedRight);
        });
    }

    // H. Draw Vectors
    drawVectors();

    // I. Draw Particle (Neon Cyan)
    const phys = getPhysicsAtS(state.s);
    const pParticle = viewportMapper.toPixels(phys.x, phys.y);
    ctx.fillStyle = '#00f2fe';
    ctx.shadowBlur = 12;
    ctx.shadowColor = 'rgba(0, 242, 254, 0.5)';
    ctx.beginPath();
    ctx.arc(pParticle.px, pParticle.py, 10, 0, 2 * Math.PI);
    ctx.fill();
    ctx.shadowBlur = 0; // Reset glow
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
}

function drawTrack(limitY) {
    const drawSteps = 500;

    // Pass 1: Full track (Dashed Faded Grey)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 4;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    for (let i = 0; i <= drawSteps; i++) {
        const x = xMin + (i / drawSteps) * (xMax - xMin);
        const p = viewportMapper.toPixels(x, getTrackHeight(x));
        if (i === 0) ctx.moveTo(p.px, p.py);
        else ctx.lineTo(p.px, p.py);
    }
    ctx.stroke();
    ctx.setLineDash([]); // Reset dash

    // Pass 2: Allowed Segments overlay (Solid Neon Cyan, if step is unlocked)
    if (state.showAllowedForbidden) {
        ctx.strokeStyle = '#00f2fe';
        ctx.lineWidth = 4;
        ctx.shadowColor = 'rgba(0, 242, 254, 0.4)';
        ctx.shadowBlur = 6;

        let inAllowed = false;
        ctx.beginPath();

        for (let i = 0; i <= drawSteps; i++) {
            const x = xMin + (i / drawSteps) * (xMax - xMin);
            const y = getTrackHeight(x);
            const allowed = y <= limitY;
            const p = viewportMapper.toPixels(x, y);

            if (allowed) {
                if (!inAllowed) {
                    ctx.moveTo(p.px, p.py);
                    inAllowed = true;
                } else {
                    ctx.lineTo(p.px, p.py);
                }
            } else {
                if (inAllowed) {
                    inAllowed = false;
                }
            }
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
    } else {
        // Draw track as active U-shaped solid line initially
        ctx.strokeStyle = '#4f46e5';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        for (let i = 0; i <= drawSteps; i++) {
            const x = xMin + (i / drawSteps) * (xMax - xMin);
            const p = viewportMapper.toPixels(x, getTrackHeight(x));
            if (i === 0) ctx.moveTo(p.px, p.py);
            else ctx.lineTo(p.px, p.py);
        }
        ctx.stroke();
    }
}

function drawEnergyShading(limitY) {
    const steps = 300;
    ctx.save();

    // 1. Allowed Kinetic Shading (Neon Cyan Tint)
    ctx.fillStyle = 'rgba(0, 242, 254, 0.05)';
    let inAllowed = false;
    let allowedPoints = [];

    for (let i = 0; i <= steps; i++) {
        const x = xMin + (i / steps) * (xMax - xMin);
        const y = getTrackHeight(x);
        const allowed = y <= limitY;

        if (allowed) {
            if (!inAllowed) {
                inAllowed = true;
                allowedPoints = [];
            }
            allowedPoints.push(viewportMapper.toPixels(x, y));
        } else {
            if (inAllowed) {
                inAllowed = false;
                fillAllowedShape(allowedPoints, limitY);
            }
        }
    }
    if (inAllowed) fillAllowedShape(allowedPoints, limitY);

    // 2. Forbidden Barrier Shading (Diagonal Hatch Pattern)
    ctx.fillStyle = hatchPattern;
    let inForbidden = false;
    let forbiddenPoints = [];

    for (let i = 0; i <= steps; i++) {
        const x = xMin + (i / steps) * (xMax - xMin);
        const y = getTrackHeight(x);
        const forbidden = y > limitY;

        if (forbidden) {
            if (!inForbidden) {
                inForbidden = true;
                forbiddenPoints = [];
            }
            forbiddenPoints.push(viewportMapper.toPixels(x, y));
        } else {
            if (inForbidden) {
                inForbidden = false;
                fillForbiddenShape(forbiddenPoints, limitY);
            }
        }
    }
    if (inForbidden) fillForbiddenShape(forbiddenPoints, limitY);

    ctx.restore();
}

function fillAllowedShape(points, limitY) {
    if (points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(points[0].px, points[0].py);
    points.forEach(p => ctx.lineTo(p.px, p.py));

    const rightP = viewportMapper.toPhysics(points[points.length - 1].px, points[points.length - 1].py);
    const leftP = viewportMapper.toPhysics(points[0].px, points[0].py);
    const p1 = viewportMapper.toPixels(rightP.x, limitY);
    const p2 = viewportMapper.toPixels(leftP.x, limitY);

    ctx.lineTo(p1.px, p1.py);
    ctx.lineTo(p2.px, p2.py);
    ctx.closePath();
    ctx.fill();
}

function fillForbiddenShape(points, limitY) {
    if (points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(points[0].px, points[0].py);
    points.forEach(p => ctx.lineTo(p.px, p.py));

    const rightP = viewportMapper.toPhysics(points[points.length - 1].px, points[points.length - 1].py);
    const leftP = viewportMapper.toPhysics(points[0].px, points[0].py);
    const p1 = viewportMapper.toPixels(rightP.x, limitY);
    const p2 = viewportMapper.toPixels(leftP.x, limitY);

    ctx.lineTo(p1.px, p1.py);
    ctx.lineTo(p2.px, p2.py);
    ctx.closePath();
    ctx.fill();
}

function drawBracket(px, py, isLeft) {
    const size = 15;
    const tick = 6;
    ctx.strokeStyle = '#f59e0b'; // Amber boundary line
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    if (isLeft) {
        ctx.moveTo(px + tick, py - size);
        ctx.lineTo(px, py - size);
        ctx.lineTo(px, py + size);
        ctx.lineTo(px + tick, py + size);
    } else {
        ctx.moveTo(px - tick, py - size);
        ctx.lineTo(px, py - size);
        ctx.lineTo(px, py + size);
        ctx.lineTo(px - tick, py + size);
    }
    ctx.stroke();
}

function drawVectors() {
    const phys = getPhysicsAtS(state.s);
    const p = viewportMapper.toPixels(phys.x, phys.y);

    // 1. Velocity vector (Cyan) - disappears at turning point (v_s = 0)
    if (Math.abs(state.v) > 0.05) {
        const vScale = 0.5;
        const endX = p.px + (state.v * phys.tangentX) * vScale * 20;
        const endY = p.py - (state.v * phys.tangentY) * vScale * 20;
        CanvasHelpers.drawArrow(ctx, p.px, p.py, endX, endY, '#00f2fe', 3.5);
    }

    // 2. Force vector (Amber) - maximum length at turning point
    const acc = computeAcceleration(state.s, state.v, state.t);
    if (Math.abs(acc) > 0.05) {
        const fScale = 0.4;
        const endX = p.px + (acc * phys.tangentX) * fScale * 20;
        const endY = p.py - (acc * phys.tangentY) * fScale * 20;
        CanvasHelpers.drawArrow(ctx, p.px, p.py, endX, endY, '#f59e0b', 3.5);
    }
}

function drawGrid() {
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.04)';
    ctx.lineWidth = 1;
    for (let x = -10; x <= 10; x += 2) {
        const p1 = viewportMapper.toPixels(x, -1);
        const p2 = viewportMapper.toPixels(x, 35);
        ctx.beginPath();
        ctx.moveTo(p1.px, p1.py);
        ctx.lineTo(p2.px, p2.py);
        ctx.stroke();
    }
}

function drawQuantumTunnelingWave(limitY) {
    const steps = 400;
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.7)'; // Neon Purple wavefunction
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    let started = false;

    // Draw wavefunction decaying inside classical barriers (quantum leaking)
    for (let i = 0; i <= steps; i++) {
        const x = xMin + (i / steps) * (xMax - xMin);
        const y = getTrackHeight(x);
        const inBarrier = y > limitY;

        if (inBarrier) {
            // Find closest turning point distance
            const tps = getTurningPoints();
            let minDist = Infinity;
            tps.forEach(tp => {
                const dist = Math.abs(x - tp.x);
                if (dist < minDist) minDist = dist;
            });

            // Exponential decay wave: psi = A * exp(-kappa * d) * sin(frequency * d + phase)
            const kappa = 0.8;
            const amp = 4.0 * Math.exp(-kappa * minDist);
            const waveY = limitY + amp * Math.sin(3.0 * x - state.t * 8.0);
            const p = viewportMapper.toPixels(x, waveY);

            if (!started) {
                ctx.moveTo(p.px, p.py);
                started = true;
            } else {
                ctx.lineTo(p.px, p.py);
            }
        } else {
            started = false;
        }
    }
    ctx.stroke();
}

// 7. Drag Interactions & Accessibility Event Sync
function setupEvents() {
    canvas.addEventListener('mousedown', (e) => {
        const rect = canvas.getBoundingClientRect();
        const mousePx = e.clientX - rect.left;
        const mousePy = e.clientY - rect.top;
        if (!viewportMapper) return;
        const phys = viewportMapper.toPhysics(mousePx, mousePy);

        // A. Check energy line click
        if (state.showEnergyLine) {
            const limitY = state.energy / (state.mass * state.parameters.g) + state.zeroOffset;
            const pEnergy = viewportMapper.toPixels(0, limitY);
            if (Math.abs(mousePy - pEnergy.py) < 14) {
                state.isDraggingEnergy = true;
                return;
            }
        }

        // B. Check particle click
        const pState = getPhysicsAtS(state.s);
        const pPixel = viewportMapper.toPixels(pState.x, pState.y);
        const dist = Math.sqrt(Math.pow(mousePx - pPixel.px, 2) + Math.pow(mousePy - pPixel.py, 2));
        if (dist < 22) {
            state.isDraggingParticle = true;
            state.v = 0;
            announceScreenReader("Particle grabbed");
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        if (!viewportMapper) return;
        const rect = canvas.getBoundingClientRect();
        const mousePx = e.clientX - rect.left;
        const mousePy = e.clientY - rect.top;
        const phys = viewportMapper.toPhysics(mousePx, mousePy);

        if (state.isDraggingEnergy) {
            const desiredY = Math.max(1.1, Math.min(35.0, phys.y));
            // Clamp total energy so it never drops below current potential height (prevents negative K)
            const minEnergy = getPotentialEnergy(state.s);
            let targetEnergy = (desiredY - state.zeroOffset) * state.mass * state.parameters.g;
            state.energy = Math.max(minEnergy, targetEnergy);

            // Sync slider in UI
            const energySlider = document.getElementById('acc-energy-slider');
            if (energySlider) {
                energySlider.value = state.energy.toFixed(1);
            }
            updateParticleVelocityForNewEnergy();
            draw();
        } else if (state.isDraggingParticle) {
            const xVal = Math.max(xMin, Math.min(xMax, phys.x));
            state.s = sFromX(xVal);
            state.v = 0;

            // Sync particle slider in UI
            const particleSlider = document.getElementById('acc-particle-slider');
            if (particleSlider) {
                particleSlider.value = Math.round((state.s / totalS) * 100);
            }

            // Safety check: clamp energy if particle is dragged above it
            const U = getPotentialEnergy(state.s);
            if (state.energy < U) {
                state.energy = U;
                const energySlider = document.getElementById('acc-energy-slider');
                if (energySlider) energySlider.value = state.energy.toFixed(1);
            }
            draw();
        }
    });

    window.addEventListener('mouseup', () => {
        if (state.isDraggingEnergy) {
            state.isDraggingEnergy = false;
            announceScreenReader(`Total energy set to ${state.energy.toFixed(1)} Joules.`);
        }
        if (state.isDraggingParticle) {
            state.isDraggingParticle = false;
            announceScreenReader(`Particle placed at position x = ${xFromS(state.s).toFixed(1)}m.`);
        }
    });

    // Mobile touch hooks
    canvas.addEventListener('touchstart', (e) => {
        if (e.touches.length === 0 || !viewportMapper) return;
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        const mousePx = touch.clientX - rect.left;
        const mousePy = touch.clientY - rect.top;
        const phys = viewportMapper.toPhysics(mousePx, mousePy);

        if (state.showEnergyLine) {
            const limitY = state.energy / (state.mass * state.parameters.g) + state.zeroOffset;
            const pEnergy = viewportMapper.toPixels(0, limitY);
            if (Math.abs(mousePy - pEnergy.py) < 22) {
                state.isDraggingEnergy = true;
                e.preventDefault();
                return;
            }
        }

        const pState = getPhysicsAtS(state.s);
        const pPixel = viewportMapper.toPixels(pState.x, pState.y);
        const dist = Math.sqrt(Math.pow(mousePx - pPixel.px, 2) + Math.pow(mousePy - pPixel.py, 2));
        if (dist < 30) {
            state.isDraggingParticle = true;
            state.v = 0;
            e.preventDefault();
        }
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
        if (e.touches.length === 0 || !viewportMapper) return;
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        const mousePx = touch.clientX - rect.left;
        const mousePy = touch.clientY - rect.top;
        const phys = viewportMapper.toPhysics(mousePx, mousePy);

        if (state.isDraggingEnergy || state.isDraggingParticle) {
            e.preventDefault();
        }

        if (state.isDraggingEnergy) {
            const desiredY = Math.max(1.1, Math.min(35.0, phys.y));
            const minEnergy = getPotentialEnergy(state.s);
            let targetEnergy = (desiredY - state.zeroOffset) * state.mass * state.parameters.g;
            state.energy = Math.max(minEnergy, targetEnergy);
            updateParticleVelocityForNewEnergy();
            draw();
        } else if (state.isDraggingParticle) {
            const xVal = Math.max(xMin, Math.min(xMax, phys.x));
            state.s = sFromX(xVal);
            state.v = 0;
            const U = getPotentialEnergy(state.s);
            if (state.energy < U) state.energy = U;
            draw();
        }
    }, { passive: false });

    canvas.addEventListener('touchend', () => {
        state.isDraggingEnergy = false;
        state.isDraggingParticle = false;
    });

    // Hidden Range Sliders Accessibility Hooks
    const accEnergySlider = document.getElementById('acc-energy-slider');
    const accParticleSlider = document.getElementById('acc-particle-slider');

    if (accEnergySlider) {
        accEnergySlider.addEventListener('input', (e) => {
            state.energy = parseFloat(e.target.value);
            const U = getPotentialEnergy(state.s);
            if (state.energy < U) {
                state.energy = U;
                accEnergySlider.value = U.toFixed(1);
            }
            updateParticleVelocityForNewEnergy();
            draw();
        });
    }

    if (accParticleSlider) {
        accParticleSlider.addEventListener('input', (e) => {
            const pct = parseFloat(e.target.value) / 100.0;
            state.s = pct * totalS;
            state.v = 0;

            const U = getPotentialEnergy(state.s);
            if (state.energy < U) {
                state.energy = U;
                if (accEnergySlider) accEnergySlider.value = U.toFixed(1);
            }
            draw();
        });
    }

    setupKeyboardListeners();
}

function updateParticleVelocityForNewEnergy() {
    const U = getPotentialEnergy(state.s);
    const K = Math.max(0, state.energy - U);
    const speed = Math.sqrt((2 * K) / state.mass);
    state.v = speed * Math.sign(state.v || 1.0);
}

function setupKeyboardListeners() {
    window.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' && e.target.type !== 'range') return;
        if (e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;

        switch (e.key) {
            case ' ':
                e.preventDefault();
                togglePlayPause();
                announceScreenReader("Simulation " + (state.isPaused ? "paused" : "resumed"));
                break;
            case 'r':
            case 'R':
                e.preventDefault();
                resetSimulation();
                announceScreenReader("Simulation reset to initial state");
                break;
            case 'ArrowRight':
                if (state.isPaused) {
                    e.preventDefault();
                    stepSimulationFrame();
                    announceScreenReader("Stepped forward. Position: x = " + xFromS(state.s).toFixed(1) + "m");
                }
                break;
        }
    });
}

// 8. Accessibility Helpers & Status Table Updates
let lastTableUpdateTime = 0;
function throttleUpdateAccessibleTable(timestamp) {
    if (timestamp - lastTableUpdateTime < 1000 && !state.isPaused) return;
    lastTableUpdateTime = timestamp;

    const phys = getPhysicsAtS(state.s);
    const U = getPotentialEnergy(state.s);
    const K = Math.max(0, state.energy - U);

    const timeVal = document.getElementById('val-time');
    const xVal = document.getElementById('val-x');
    const vVal = document.getElementById('val-v');
    const keVal = document.getElementById('val-ke');
    const peVal = document.getElementById('val-pe');
    const teVal = document.getElementById('val-te');

    if (timeVal) timeVal.textContent = state.t.toFixed(1);
    if (xVal) xVal.textContent = phys.x.toFixed(2);
    if (vVal) vVal.textContent = state.v.toFixed(2);
    if (keVal) keVal.textContent = K.toFixed(1);
    if (peVal) peVal.textContent = U.toFixed(1);
    if (teVal) teVal.textContent = state.energy.toFixed(1);
}

function announceScreenReader(message) {
    const announcer = document.getElementById('sim-live-announcer');
    if (announcer) {
        announcer.textContent = message;
    }
}

// 9. Scrollytelling Transitions Setup
function initScrollytelling() {
    const observerOptions = {
        root: null,
        rootMargin: "-25% 0px -25% 0px", // Trigger step in middle 50%
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const step = parseInt(entry.target.getAttribute('data-step'), 10);
                onChapterChange(step);
            }
        });
    }, observerOptions);

    document.querySelectorAll('.scrolly-chapter').forEach(chapter => {
        observer.observe(chapter);
    });
}

function onChapterChange(step) {
    state.currentStep = step;

    // Reset triggers
    state.showEnergyLine = false;
    state.showAllowedForbidden = false;
    state.showTurningPoints = false;
    state.showQuantumPreviewToggle = false;

    if (step >= 2) {
        state.showEnergyLine = true;
    }
    if (step >= 3) {
        state.showAllowedForbidden = true;
    }
    if (step >= 4) {
        state.showTurningPoints = true;
    }
    if (step >= 5) {
        state.showQuantumPreviewToggle = true;
    }

    // Toggle widgets in DOM
    const quantumToggleRow = document.getElementById('hud-quantum-toggle-row');
    if (quantumToggleRow) {
        quantumToggleRow.style.display = state.showQuantumPreviewToggle ? 'flex' : 'none';
    }

    draw();
}

// 10. Initialization
document.addEventListener('DOMContentLoaded', () => {
    canvas = document.getElementById('physics-canvas');
    ctx = canvas.getContext('2d');

    // Force theme
    document.body.classList.add('space-theme-body');

    initTrack();
    initHatchPattern();
    setupEvents();

    const resizeObserver = new ResizeObserver(() => {
        CanvasHelpers.setupHighDPI(canvas, ctx);
        draw();
    });
    resizeObserver.observe(canvas);

    // Quantum toggle logic
    const btnQuantum = document.getElementById('btn-quantum-toggle');
    if (btnQuantum) {
        btnQuantum.addEventListener('click', () => {
            state.enableQuantumPreview = !state.enableQuantumPreview;
            btnQuantum.classList.toggle('active', state.enableQuantumPreview);
            btnQuantum.textContent = state.enableQuantumPreview ? 'Disable Wave' : 'Enable Wave';
            announceScreenReader("Quantum preview wave " + (state.enableQuantumPreview ? "enabled" : "disabled"));
            draw();
        });
    }

    // Standard play controls
    const playPauseBtn = document.getElementById('btn-play-pause');
    const stepBtn = document.getElementById('btn-step');
    const resetBtn = document.getElementById('btn-reset');

    if (playPauseBtn) playPauseBtn.addEventListener('click', togglePlayPause);
    if (stepBtn) stepBtn.addEventListener('click', stepSimulationFrame);
    if (resetBtn) resetBtn.addEventListener('click', resetSimulation);

    initScrollytelling();

    // Start simulation loop
    requestAnimationFrame(animationLoop);
});
