import { Solvers } from './solvers.js';
import { CanvasHelpers } from './canvas_helpers.js';

// 1. Simulation State Definition
const state = {
    t: 0,
    s: 0,     // Position along the track (arc-length)
    v: 0,     // Velocity along the track (v_s)
    mass: 1.0,
    potentialId: 'gravity', // 'gravity' | 'spring' | 'free'
    isPaused: true,
    zeroOffset: 0.0, // draggble reference zero offset height
    parameters: {
        g: 9.81,
        k: 0.25,
        damping: 0.0
    },
    // Scrollytelling Visibility Flags
    currentStep: 1,
    showEnergyBars: false,
    showTotalEnergy: false,
    showModifiers: false,
    showPresets: false,
    // Track dragging state
    isDraggingParticle: false,
    isDraggingZeroLine: false
};

// 2. Bezier Curve Definition (Gravity Hill)
const p0 = { x: -10, y: 5 };
const p1 = { x: -3, y: -1 };
const p2 = { x: 3, y: -1 };
const p3 = { x: 10, y: 5 };

const steps = 1000;
const lut = []; // Look-up table mapping u -> s
let totalS = 0;
lut.push({ u: 0, s: 0 });

// Precompute arc-lengths along Bezier curve
for (let i = 1; i <= steps; i++) {
    const uPrev = (i - 1) / steps;
    const uCurr = i / steps;
    const ptPrev = evaluateBezierPoint(uPrev);
    const ptCurr = evaluateBezierPoint(uCurr);
    const ds = Math.sqrt((ptCurr.x - ptPrev.x) ** 2 + (ptCurr.y - ptPrev.y) ** 2);
    totalS += ds;
    lut.push({ u: uCurr, s: totalS });
}

// Set initial position of the particle to the left side
state.s = totalS * 0.15; // Start on the left slope

function evaluateBezierPoint(u) {
    const mt = 1 - u;
    const x = mt*mt*mt*p0.x + 3*mt*mt*u*p1.x + 3*mt*u*u*p2.x + u*u*u*p3.x;
    const y = mt*mt*mt*p0.y + 3*mt*mt*u*p1.y + 3*mt*u*u*p2.y + u*u*u*p3.y;
    return { x, y };
}

function evaluateBezierDerivatives(u) {
    const mt = 1 - u;
    const dx = 3*mt*mt*(p1.x - p0.x) + 6*mt*u*(p2.x - p1.x) + 3*u*u*(p3.x - p2.x);
    const dy = 3*mt*mt*(p1.y - p0.y) + 6*mt*u*(p2.y - p1.y) + 3*u*u*(p3.y - p2.y);
    return { dx, dy };
}

function uFromS(s) {
    if (s <= 0) return 0;
    if (s >= totalS) return 1;
    let low = 0;
    let high = lut.length - 1;
    while (low < high - 1) {
        const mid = Math.floor((low + high) / 2);
        if (lut[mid].s < s) {
            low = mid;
        } else {
            high = mid;
        }
    }
    const s0 = lut[low].s;
    const s1 = lut[high].s;
    const u0 = lut[low].u;
    const u1 = lut[high].u;
    const ratio = (s - s0) / (s1 - s0);
    return u0 + ratio * (u1 - u0);
}

function getBezierPhysics(s) {
    const u = uFromS(s);
    const pos = evaluateBezierPoint(u);
    const derivs = evaluateBezierDerivatives(u);
    const length = Math.sqrt(derivs.dx ** 2 + derivs.dy ** 2);
    const slope = length !== 0 ? (derivs.dy / length) : 0;
    const normalX = -derivs.dy / length;
    const normalY = derivs.dx / length;
    return {
        x: pos.x,
        y: pos.y,
        slope, // dy/ds
        tangentX: derivs.dx / length,
        tangentY: derivs.dy / length,
        normalX,
        normalY
    };
}

function findClosestS(x, y) {
    let bestS = 0;
    let minDist = Infinity;
    for (let i = 0; i <= 200; i++) {
        const sVal = (i / 200) * totalS;
        const u = uFromS(sVal);
        const pt = evaluateBezierPoint(u);
        const d = (pt.x - x) ** 2 + (pt.y - y) ** 2;
        if (d < minDist) {
            minDist = d;
            bestS = sVal;
        }
    }
    return bestS;
}

// 3. Force and Energy Computations
function computeAcceleration(s, v, t) {
    if (state.potentialId === 'gravity') {
        const physics = getBezierPhysics(s);
        // Force along track: F_s = -mg * dy/ds
        return -state.parameters.g * physics.slope - (state.parameters.damping / state.mass) * v;
    } else if (state.potentialId === 'spring') {
        const centerS = totalS / 2;
        const displacement = s - centerS;
        // Force: F = -k * x
        return -(state.parameters.k / state.mass) * displacement - (state.parameters.damping / state.mass) * v;
    } else {
        // Free space
        return -(state.parameters.damping / state.mass) * v;
    }
}

function getEnergy() {
    let U = 0;
    let K = 0.5 * state.mass * state.v * state.v;

    if (state.potentialId === 'gravity') {
        const physics = getBezierPhysics(state.s);
        U = state.mass * state.parameters.g * (physics.y - state.zeroOffset);
    } else if (state.potentialId === 'spring') {
        const centerS = totalS / 2;
        const displacement = state.s - centerS;
        U = 0.5 * state.parameters.k * displacement * displacement - state.mass * state.parameters.g * state.zeroOffset;
    } else {
        U = -state.mass * state.parameters.g * state.zeroOffset;
    }

    return { K, U, total: K + U };
}

// 4. Playback Logic
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
    if (state.potentialId === 'spring') {
        state.s = totalS * 0.35; // Offset from center
    } else {
        state.s = totalS * 0.15; // Left slope of gravity hill
    }
    drawSimulationFrame();
}

function stepSimulationFrame() {
    if (state.isPaused) {
        // Integrate a single small step (e.g. dt = 0.016s)
        const dummyState = { x: state.s, v: state.v, t: state.t };
        Solvers.velocityVerlet(dummyState, computeAcceleration, 0.016);

        // Enforce track boundaries
        if (dummyState.x < 0) {
            dummyState.x = 0;
            dummyState.v = -dummyState.v; // Elastic bounce
        }
        if (dummyState.x > totalS) {
            dummyState.x = totalS;
            dummyState.v = -dummyState.v;
        }

        state.s = dummyState.x;
        state.v = dummyState.v;
        state.t = dummyState.t;
        drawSimulationFrame();
    }
}

// 5. Decoupled Physics Loop
let lastTime = 0;
let accumulator = 0;
const simTimeStep = 0.001; // Fixed 1ms physics step
const maxFrameTime = 0.15;  // 150ms cap

function animationLoop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    let frameTime = (timestamp - lastTime) / 1000.0;
    lastTime = timestamp;

    if (frameTime > maxFrameTime) {
        frameTime = maxFrameTime;
    }

    if (!state.isPaused && !state.isDraggingParticle) {
        accumulator += frameTime;
        while (accumulator >= simTimeStep) {
            const dummyState = { x: state.s, v: state.v, t: state.t };
            Solvers.velocityVerlet(dummyState, computeAcceleration, simTimeStep);

            // Check boundary collisions
            if (dummyState.x < 0) {
                dummyState.x = 0;
                dummyState.v = -dummyState.v;
            }
            if (dummyState.x > totalS) {
                dummyState.x = totalS;
                dummyState.v = -dummyState.v;
            }

            state.s = dummyState.x;
            state.v = dummyState.v;
            state.t = dummyState.t;

            accumulator -= simTimeStep;
        }
    }

    drawSimulationFrame();
    throttleUpdateAccessibleTable(timestamp);

    requestAnimationFrame(animationLoop);
}

// 6. Canvas Rendering Logic
let physicsCanvas, physicsCtx;
let chartsCanvas, chartsCtx;
let viewportMapper;

function drawSimulationFrame() {
    if (!physicsCanvas || !physicsCtx || !chartsCanvas || !chartsCtx) return;

    const width = physicsCanvas.getBoundingClientRect().width;
    const height = physicsCanvas.getBoundingClientRect().height;

    // Clear canvas
    physicsCtx.clearRect(0, 0, width, height);

    // Setup viewport coordinate mapping
    viewportMapper = CanvasHelpers.getViewportMapper(width, height, -12, 12, -2, 7);

    // A. Draw coordinate grid lines (soft blue background grid)
    physicsCtx.strokeStyle = 'rgba(99, 102, 241, 0.05)';
    physicsCtx.lineWidth = 1;
    for (let x = -12; x <= 12; x += 2) {
        const p1 = viewportMapper.toPixels(x, -2);
        const p2 = viewportMapper.toPixels(x, 7);
        physicsCtx.beginPath();
        physicsCtx.moveTo(p1.px, p1.py);
        physicsCtx.lineTo(p2.px, p2.py);
        physicsCtx.stroke();
    }
    for (let y = -2; y <= 7; y += 1) {
        const p1 = viewportMapper.toPixels(-12, y);
        const p2 = viewportMapper.toPixels(12, y);
        physicsCtx.beginPath();
        physicsCtx.moveTo(p1.px, p1.py);
        physicsCtx.lineTo(p2.px, p2.py);
        physicsCtx.stroke();
    }

    // B. Draw Draggable Potential Reference Line (if modifiers are unlocked)
    if (state.showModifiers) {
        const zeroY = viewportMapper.toPixels(-12, state.zeroOffset);
        const zeroYEnd = viewportMapper.toPixels(12, state.zeroOffset);

        physicsCtx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
        physicsCtx.lineWidth = 1.5;
        physicsCtx.setLineDash([6, 4]);
        physicsCtx.beginPath();
        physicsCtx.moveTo(zeroY.px, zeroY.py);
        physicsCtx.lineTo(zeroYEnd.px, zeroYEnd.py);
        physicsCtx.stroke();
        physicsCtx.setLineDash([]);

        // Label
        physicsCtx.fillStyle = 'rgba(245, 158, 11, 0.8)';
        physicsCtx.font = '9px monospace';
        physicsCtx.fillText(`U = 0 reference`, zeroY.px + 10, zeroY.py - 6);
    }

    // C. Draw Potential Energy Landscape Curve
    physicsCtx.beginPath();
    physicsCtx.lineWidth = 3;
    physicsCtx.strokeStyle = '#4f46e5'; // Indigo track

    if (state.potentialId === 'gravity') {
        for (let i = 0; i <= 200; i++) {
            const uVal = i / 200;
            const pt = evaluateBezierPoint(uVal);
            const p = viewportMapper.toPixels(pt.x, pt.y);
            if (i === 0) physicsCtx.moveTo(p.px, p.py);
            else physicsCtx.lineTo(p.px, p.py);
        }
    } else if (state.potentialId === 'spring') {
        const centerS = totalS / 2;
        for (let i = 0; i <= 200; i++) {
            const sVal = (i / 200) * totalS;
            const uVal = uFromS(sVal);
            const pt = evaluateBezierPoint(uVal); // For spring, keep layout on hill shape but model spring physics
            const p = viewportMapper.toPixels(pt.x, pt.y);
            if (i === 0) physicsCtx.moveTo(p.px, p.py);
            else physicsCtx.lineTo(p.px, p.py);
        }

        // Draw the anchor spring coil
        const anchorP = getBezierPhysics(centerS);
        const particleP = getBezierPhysics(state.s);
        drawSpringCoil(physicsCtx, anchorP, particleP);
    } else {
        // Free space: flat line along y = 0
        const p1 = viewportMapper.toPixels(-10, 0);
        const p2 = viewportMapper.toPixels(10, 0);
        physicsCtx.moveTo(p1.px, p1.py);
        physicsCtx.lineTo(p2.px, p2.py);
    }
    physicsCtx.stroke();

    // D. Evaluate Particle position and vectors
    let px, py, tangentX, tangentY, normalX, normalY;
    if (state.potentialId === 'free') {
        // Translate s directly to flat coordinate x
        const fraction = state.s / totalS;
        const rx = -10 + fraction * 20;
        const p = viewportMapper.toPixels(rx, 0);
        px = p.px;
        py = p.py;
        tangentX = 1;
        tangentY = 0;
        normalX = 0;
        normalY = 1;
    } else {
        const physics = getBezierPhysics(state.s);
        const p = viewportMapper.toPixels(physics.x, physics.y);
        px = p.px;
        py = p.py;
        tangentX = physics.tangentX;
        tangentY = physics.tangentY;
        normalX = physics.normalX;
        normalY = physics.normalY;
    }

    // E. Draw turning point limits (dashed brackets)
    if (state.showEnergyBars) {
        const energy = getEnergy();
        drawTurningPointMarkers(physicsCtx, energy.total);
    }

    // F. Draw vectors
    // 1. Velocity vector (Cyan)
    if (Math.abs(state.v) > 0.05) {
        const vScale = 0.4;
        const vEndX = px + (state.v * tangentX) * vScale * 25;
        const vEndY = py - (state.v * tangentY) * vScale * 25;
        CanvasHelpers.drawArrow(physicsCtx, px, py, vEndX, vEndY, '#00f2fe', 3);
    }

    // 2. Force vector (Amber)
    const acc = computeAcceleration(state.s, state.v, state.t);
    if (Math.abs(acc) > 0.05) {
        const fScale = 0.3;
        const fEndX = px + (acc * tangentX) * fScale * 25;
        const fEndY = py - (acc * tangentY) * fScale * 25;
        CanvasHelpers.drawArrow(physicsCtx, px, py, fEndX, fEndY, '#f59e0b', 3);
    }

    // G. Draw physical particle sphere (Neon Cyan)
    physicsCtx.fillStyle = '#00f2fe';
    physicsCtx.shadowColor = 'rgba(0, 242, 254, 0.4)';
    physicsCtx.shadowBlur = 10;
    physicsCtx.beginPath();
    physicsCtx.arc(px, py, 9, 0, 2 * Math.PI);
    physicsCtx.fill();
    physicsCtx.shadowBlur = 0; // Reset shadow

    physicsCtx.strokeStyle = '#ffffff';
    physicsCtx.lineWidth = 1.5;
    physicsCtx.stroke();

    // H. Render Energy Bars Canvas
    drawEnergyBarsChart();
}

function drawSpringCoil(ctx, anchor, particle) {
    const ap = viewportMapper.toPixels(anchor.x, anchor.y);
    const pp = viewportMapper.toPixels(particle.x, particle.y);

    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(ap.px, ap.py);

    const coils = 12;
    const dx = pp.px - ap.px;
    const dy = pp.py - ap.py;
    const len = Math.sqrt(dx*dx + dy*dy);

    const normalX = -dy / len;
    const normalY = dx / len;

    for (let i = 1; i < coils; i++) {
        const ratio = i / coils;
        const x = ap.px + dx * ratio;
        const y = ap.py + dy * ratio;
        const offsetMag = (i % 2 === 0 ? 8 : -8);
        ctx.lineTo(x + normalX * offsetMag, y + normalY * offsetMag);
    }
    ctx.lineTo(pp.px, pp.py);
    ctx.stroke();
}

function drawTurningPointMarkers(ctx, totalEnergy) {
    // Find turning point locations where U(s) = E
    if (state.potentialId !== 'gravity') return;

    ctx.strokeStyle = 'rgba(255, 0, 221, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);

    for (let i = 0; i <= 100; i++) {
        const sVal = (i / 100) * totalS;
        const physics = getBezierPhysics(sVal);
        const U = state.mass * state.parameters.g * (physics.y - state.zeroOffset);

        // Find crossing point
        if (Math.abs(U - totalEnergy) < 0.1) {
            const p = viewportMapper.toPixels(physics.x, physics.y);
            ctx.beginPath();
            ctx.moveTo(p.px, p.py - 15);
            ctx.lineTo(p.px, p.py + 15);
            ctx.stroke();
        }
    }
    ctx.setLineDash([]);
}

function drawEnergyBarsChart() {
    const width = chartsCanvas.getBoundingClientRect().width;
    const height = chartsCanvas.getBoundingClientRect().height;
    chartsCtx.clearRect(0, 0, width, height);

    if (!state.showEnergyBars) return;

    const energy = getEnergy();

    // Scale mapping for energy bars: let max energy (e.g. 50J) fit in height
    const maxE = 60.0;
    const scale = (height * 0.45) / maxE; // Keep centered with padding
    const centerY = height / 2;

    // Draw baseline axis
    chartsCtx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    chartsCtx.lineWidth = 1;
    chartsCtx.beginPath();
    chartsCtx.moveTo(20, centerY);
    chartsCtx.lineTo(width - 20, centerY);
    chartsCtx.stroke();

    const barWidth = 35;
    const gap = 45;
    const startX = (width - (barWidth * 2 + gap)) / 2;

    // 1. Kinetic energy bar (Cyan, positive only)
    const kHeight = energy.K * scale;
    chartsCtx.fillStyle = '#00f2fe';
    chartsCtx.shadowColor = 'rgba(0, 242, 254, 0.2)';
    chartsCtx.shadowBlur = 8;
    chartsCtx.fillRect(startX, centerY - kHeight, barWidth, kHeight);
    chartsCtx.shadowBlur = 0;

    // Labels
    chartsCtx.fillStyle = '#ffffff';
    chartsCtx.font = '10px monospace';
    chartsCtx.textAlign = 'center';
    chartsCtx.fillText('K', startX + barWidth / 2, centerY + (energy.K >= 0 ? 15 : -10));
    chartsCtx.fillText(energy.K.toFixed(1) + 'J', startX + barWidth / 2, centerY - kHeight - 6);

    // 2. Potential energy bar (Magenta, handles negative values)
    const uStartX = startX + barWidth + gap;
    const uHeight = energy.U * scale;

    if (energy.U >= 0) {
        chartsCtx.fillStyle = '#ff00dd'; // Positive Magenta
        chartsCtx.fillRect(uStartX, centerY - uHeight, barWidth, uHeight);
    } else {
        // Draw negative potentials extending downward
        chartsCtx.fillStyle = 'rgba(255, 0, 221, 0.2)'; // Faded magenta
        chartsCtx.fillRect(uStartX, centerY, barWidth, -uHeight);

        // Add diagonal hatch styling to emphasize negative state bound
        chartsCtx.strokeStyle = '#ff00dd';
        chartsCtx.lineWidth = 1;
        chartsCtx.strokeRect(uStartX, centerY, barWidth, -uHeight);
    }

    chartsCtx.fillStyle = '#ffffff';
    chartsCtx.fillText('U', uStartX + barWidth / 2, centerY + (energy.U >= 0 ? 15 : -10));
    chartsCtx.fillText(energy.U.toFixed(1) + 'J', uStartX + barWidth / 2, centerY - uHeight - 6);

    // 3. Draw horizontal Total Energy Line E (if unlocked)
    if (state.showTotalEnergy) {
        const totalY = centerY - energy.total * scale;

        chartsCtx.strokeStyle = '#f59e0b'; // Amber total line
        chartsCtx.lineWidth = 2;
        chartsCtx.beginPath();
        chartsCtx.moveTo(startX - 20, totalY);
        chartsCtx.lineTo(uStartX + barWidth + 20, totalY);
        chartsCtx.stroke();

        chartsCtx.fillStyle = '#f59e0b';
        chartsCtx.font = 'bold 9px monospace';
        chartsCtx.textAlign = 'left';
        chartsCtx.fillText(`E = ${energy.total.toFixed(1)}J`, uStartX + barWidth + 26, totalY + 3);
    }
}

// 7. Mouse & Drag Interaction Handlers
let isMouseInside = false;

function setupMouseEvents() {
    physicsCanvas.addEventListener('mousedown', (e) => {
        const rect = physicsCanvas.getBoundingClientRect();
        const mousePx = e.clientX - rect.left;
        const mousePy = e.clientY - rect.top;

        if (!viewportMapper) return;
        const physicsCoords = viewportMapper.toPhysics(mousePx, mousePy);

        // Check if user clicked close to the particle to drag it
        let px, py;
        if (state.potentialId === 'free') {
            const fraction = state.s / totalS;
            const rx = -10 + fraction * 20;
            const p = viewportMapper.toPixels(rx, 0);
            px = p.px;
            py = p.py;
        } else {
            const physics = getBezierPhysics(state.s);
            const p = viewportMapper.toPixels(physics.x, physics.y);
            px = p.px;
            py = p.py;
        }

        const distToParticle = Math.sqrt((mousePx - px) ** 2 + (mousePy - py) ** 2);
        if (distToParticle < 25) {
            state.isDraggingParticle = true;
            state.v = 0; // stop motion when dragging
            announceScreenReader("Particle grabbed");
            return;
        }

        // Check if user clicked close to the reference line to drag it
        if (state.showModifiers) {
            const zeroY = viewportMapper.toPixels(0, state.zeroOffset).py;
            if (Math.abs(mousePy - zeroY) < 10) {
                state.isDraggingZeroLine = true;
                announceScreenReader("Zero reference line grabbed");
            }
        }
    });

    physicsCanvas.addEventListener('mousemove', (e) => {
        if (!viewportMapper) return;
        const rect = physicsCanvas.getBoundingClientRect();
        const mousePx = e.clientX - rect.left;
        const mousePy = e.clientY - rect.top;
        const physicsCoords = viewportMapper.toPhysics(mousePx, mousePy);

        if (state.isDraggingParticle) {
            // Find closest s along the potential curve
            if (state.potentialId === 'free') {
                const rx = Math.max(-10, Math.min(10, physicsCoords.x));
                const fraction = (rx + 10) / 20;
                state.s = fraction * totalS;
            } else {
                state.s = findClosestS(physicsCoords.x, physicsCoords.y);
            }
            state.v = 0;
            drawSimulationFrame();
        } else if (state.isDraggingZeroLine) {
            state.zeroOffset = Math.max(-2, Math.min(6, physicsCoords.y));
            // Update zero input slider in DOM if present
            const zeroSlider = document.getElementById('slider-zero');
            if (zeroSlider) {
                zeroSlider.value = state.zeroOffset;
            }
            drawSimulationFrame();
        }
    });

    window.addEventListener('mouseup', () => {
        if (state.isDraggingParticle) {
            state.isDraggingParticle = false;
            announceScreenReader("Particle released at position " + state.s.toFixed(2) + "m");
        }
        if (state.isDraggingZeroLine) {
            state.isDraggingZeroLine = false;
            announceScreenReader("Zero reference line set to " + state.zeroOffset.toFixed(2) + "m");
        }
    });
}

// 8. HTML Form Control Event Listeners
function setupInterfaceEvents() {
    const playPauseBtn = document.getElementById('btn-play-pause');
    const stepBtn = document.getElementById('btn-step');
    const resetBtn = document.getElementById('btn-reset');

    if (playPauseBtn) playPauseBtn.addEventListener('click', togglePlayPause);
    if (stepBtn) stepBtn.addEventListener('click', stepSimulationFrame);
    if (resetBtn) resetBtn.addEventListener('click', resetSimulation);

    // Modifiers/Sliders
    const massSlider = document.getElementById('slider-mass');
    const zeroSlider = document.getElementById('slider-zero');
    const kSlider = document.getElementById('slider-k');

    if (massSlider) {
        massSlider.addEventListener('input', (e) => {
            state.mass = parseFloat(e.target.value);
            drawSimulationFrame();
        });
    }

    if (zeroSlider) {
        zeroSlider.addEventListener('input', (e) => {
            state.zeroOffset = parseFloat(e.target.value);
            drawSimulationFrame();
        });
    }

    if (kSlider) {
        kSlider.addEventListener('input', (e) => {
            state.parameters.k = parseFloat(e.target.value);
            drawSimulationFrame();
        });
    }

    // Presets
    const presetGravity = document.getElementById('preset-gravity');
    const presetSpring = document.getElementById('preset-spring');
    const presetFree = document.getElementById('preset-free');

    const updateActivePresetBtn = (activeBtn) => {
        [presetGravity, presetSpring, presetFree].forEach(btn => {
            if (btn) btn.classList.remove('active');
        });
        if (activeBtn) activeBtn.classList.add('active');
    };

    if (presetGravity) {
        presetGravity.addEventListener('click', () => {
            state.potentialId = 'gravity';
            updateActivePresetBtn(presetGravity);
            toggleSpringSliderVisibility(false);
            updateSystemBoundaryCard('gravity');
            resetSimulation();
        });
    }

    if (presetSpring) {
        presetSpring.addEventListener('click', () => {
            state.potentialId = 'spring';
            updateActivePresetBtn(presetSpring);
            toggleSpringSliderVisibility(true);
            updateSystemBoundaryCard('spring');
            resetSimulation();
        });
    }

    if (presetFree) {
        presetFree.addEventListener('click', () => {
            state.potentialId = 'free';
            updateActivePresetBtn(presetFree);
            toggleSpringSliderVisibility(false);
            updateSystemBoundaryCard('free');
            resetSimulation();
        });
    }

    // Keyboard navigation
    setupKeyboardListeners();
}

function toggleSpringSliderVisibility(show) {
    const kContainer = document.getElementById('control-k-container');
    if (kContainer) {
        kContainer.style.display = show ? 'grid' : 'none';
    }
}

function updateSystemBoundaryCard(preset) {
    const boundaryText = document.getElementById('system-boundary-text');
    if (!boundaryText) return;

    if (preset === 'gravity') {
        boundaryText.innerHTML = `<strong>System:</strong> Particle + Earth + Track (Closed)<br><strong>Surroundings:</strong> None<br><strong>External Work ($W$):</strong> 0 J`;
    } else if (preset === 'spring') {
        boundaryText.innerHTML = `<strong>System:</strong> Particle + Spring (Closed)<br><strong>Surroundings:</strong> None<br><strong>External Work ($W$):</strong> 0 J`;
    } else {
        boundaryText.innerHTML = `<strong>System:</strong> Particle (Isolated)<br><strong>Surroundings:</strong> None<br><strong>External Work ($W$):</strong> 0 J`;
    }
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
                    announceScreenReader("Stepped forward. Position: " + state.s.toFixed(2) + "m");
                }
                break;
        }
    });
}

// 9. Accessibility Helpers
let lastTableUpdateTime = 0;
function throttleUpdateAccessibleTable(timestamp) {
    if (timestamp - lastTableUpdateTime < 1000 && !state.isPaused) return;
    lastTableUpdateTime = timestamp;

    const energy = getEnergy();
    const timeVal = document.getElementById('val-time');
    const xVal = document.getElementById('val-x');
    const vVal = document.getElementById('val-v');
    const keVal = document.getElementById('val-ke');
    const peVal = document.getElementById('val-pe');
    const teVal = document.getElementById('val-te');

    if (timeVal) timeVal.textContent = state.t.toFixed(1);
    if (xVal) xVal.textContent = state.s.toFixed(2);
    if (vVal) vVal.textContent = state.v.toFixed(2);
    if (keVal) keVal.textContent = energy.K.toFixed(1);
    if (peVal) peVal.textContent = energy.U.toFixed(1);
    if (teVal) teVal.textContent = energy.total.toFixed(1);
}

function announceScreenReader(message) {
    const announcer = document.getElementById('sim-live-announcer');
    if (announcer) {
        announcer.textContent = message;
    }
}

// 10. Scrollytelling Intersection Observer triggers
function initScrollytelling() {
    const observerOptions = {
        root: null,
        rootMargin: "-25% 0px -25% 0px", // Trigger step change in middle 50%
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

    // Reset flags
    state.showEnergyBars = false;
    state.showTotalEnergy = false;
    state.showModifiers = false;
    state.showPresets = false;

    // Apply features according to chapter step
    if (step >= 2) {
        // Prediction step: auto-pause to force answer
        state.isPaused = true;
        const playBtn = document.getElementById('btn-play-pause');
        if (playBtn) playBtn.textContent = 'Play';
    }
    if (step >= 3) {
        state.showEnergyBars = true;
    }
    if (step >= 4) {
        state.showTotalEnergy = true;
    }
    if (step >= 5) {
        state.showModifiers = true;
    }
    if (step >= 6) {
        state.showPresets = true;
    }

    // Sync visual panels
    toggleControlPanelVisibility();
    drawSimulationFrame();
}

function toggleControlPanelVisibility() {
    const modifierGroup = document.getElementById('hud-modifiers-group');
    const presetsGroup = document.getElementById('hud-presets-group');
    const systemCard = document.getElementById('hud-system-card');

    if (modifierGroup) modifierGroup.style.display = state.showModifiers ? 'flex' : 'none';
    if (presetsGroup) presetsGroup.style.display = state.showPresets ? 'flex' : 'none';
    if (systemCard) systemCard.style.display = state.showEnergyBars ? 'block' : 'none';
}

// 11. Initialization
document.addEventListener('DOMContentLoaded', () => {
    physicsCanvas = document.getElementById('physics-canvas');
    physicsCtx = physicsCanvas.getContext('2d');
    chartsCanvas = document.getElementById('charts-canvas');
    chartsCtx = chartsCanvas.getContext('2d');

    // Force space theme body layout
    document.body.classList.add('space-theme-body');

    // Setup Resizing
    const resizeObserver = new ResizeObserver(() => {
        CanvasHelpers.setupHighDPI(physicsCanvas, physicsCtx);
        CanvasHelpers.setupHighDPI(chartsCanvas, chartsCtx);
        drawSimulationFrame();
    });
    resizeObserver.observe(physicsCanvas);
    resizeObserver.observe(chartsCanvas);

    // Setup Interaction & UI
    setupMouseEvents();
    setupInterfaceEvents();
    initScrollytelling();

    // Start simulation loop
    requestAnimationFrame(animationLoop);
});
