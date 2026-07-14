import { CanvasHelpers } from './canvas_helpers.js';
import { Solvers } from './solvers.js';

// 1. Simulation State Definition
const state = {
    t: 0,
    x: 3.5,            // Position of mass (equilibrium at x = 0)
    v: 0.0,            // Velocity of mass
    mass: 1.0,
    k: 1.0,            // Spring stiffness
    isPaused: true,
    selectedSolver: 'forwardEuler',
    dt: 0.1,           // Step size \Delta t
    currentStep: 1,
    chartMode: 'timeSeries' // 'timeSeries' or 'phaseSpace'
};

const solverFuncs = {
    forwardEuler: Solvers.forwardEuler,
    eulerCromer: Solvers.eulerCromer,
    velocityVerlet: Solvers.velocityVerlet,
    rk4: Solvers.rk4
};

// Acceleration calculation: a = -k/m * x
function forceFunc(x, v, t) {
    return - (state.k / state.mass) * x;
}

// 2. Scrolling chart histories
const maxHistoryPoints = 500;
let energyHistory = [];
let phaseHistory = [];
let initialEnergy = null;

function resetHistory() {
    energyHistory = [];
    phaseHistory = [];
    initialEnergy = null;
}

function recordHistory() {
    const K = 0.5 * state.mass * state.v * state.v;
    const U = 0.5 * state.k * state.x * state.x;
    const E = K + U;
    if (initialEnergy === null) {
        initialEnergy = E;
    }

    energyHistory.push({ t: state.t, E: E });
    if (energyHistory.length > maxHistoryPoints) {
        energyHistory.shift();
    }

    phaseHistory.push({ x: state.x, v: state.v });
    if (phaseHistory.length > maxHistoryPoints) {
        phaseHistory.shift();
    }
}

// 3. Instability Guardrail check
function checkSimulationInstability() {
    const limitExceeded = Math.abs(state.x) > 35.0 || Math.abs(state.v) > 70.0;
    const hasNaN = isNaN(state.x) || isNaN(state.v);

    if (limitExceeded || hasNaN) {
        state.isPaused = true;
        const playPauseBtn = document.getElementById('btn-play-pause');
        if (playPauseBtn) playPauseBtn.textContent = 'Play';

        const alertBanner = document.getElementById('instability-alert');
        if (alertBanner) {
            alertBanner.style.display = 'block';
            alertBanner.textContent = "Simulation halted: Numerical instability detected. Try reducing step size (Δt) or resetting.";
        }

        // Clamp to center to avoid rendering blowout
        state.x = 0;
        state.v = 0;

        announceScreenReader("Simulation paused automatically: Numerical instability detected.");
    }
}

// 4. Integration Tick (Decoupled Loop)
let lastTime = 0;
let accumulator = 0;

function animationLoop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    let frameTime = (timestamp - lastTime) / 1000.0;
    lastTime = timestamp;

    if (frameTime > 0.15) frameTime = 0.15;

    if (!state.isPaused) {
        // Run solver step based on dt. We run at dt intervals using accumulator
        accumulator += frameTime;

        // Dynamic cap to prevent infinite loop if dt is tiny
        const maxStepsPerFrame = Math.max(1, Math.min(50, Math.ceil(0.15 / state.dt)));
        let stepsTaken = 0;

        while (accumulator >= state.dt && stepsTaken < maxStepsPerFrame) {
            const solver = solverFuncs[state.selectedSolver];
            if (solver) {
                solver(state, forceFunc, state.dt);
            }
            recordHistory();
            checkSimulationInstability();
            accumulator -= state.dt;
            stepsTaken++;
        }
    }

    draw();
    throttleUpdateAccessibleTable(timestamp);
    requestAnimationFrame(animationLoop);
}

// 5. Playback Actions
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
    state.x = 3.5;
    state.v = 0.0;
    resetHistory();
    recordHistory();
    const alertBanner = document.getElementById('instability-alert');
    if (alertBanner) {
        alertBanner.style.display = 'none';
    }
    draw();
}

function stepSimulationFrame() {
    if (state.isPaused) {
        const solver = solverFuncs[state.selectedSolver];
        if (solver) {
            solver(state, forceFunc, state.dt);
        }
        recordHistory();
        checkSimulationInstability();
        draw();
    }
}

// 6. Canvas Rendering Engine
let physicsCanvas, physicsCtx;
let chartsCanvas, chartsCtx;
let viewportMapper;

function draw() {
    if (!physicsCanvas || !physicsCtx || !chartsCanvas || !chartsCtx) return;

    const width = physicsCanvas.getBoundingClientRect().width;
    const height = physicsCanvas.getBoundingClientRect().height;

    // Clear Canvas
    physicsCtx.clearRect(0, 0, width, height);

    // Setup viewport mapper (mass oscillating between -10 and 10)
    viewportMapper = CanvasHelpers.getViewportMapper(width, height, -12, 12, -4, 4);

    // A. Draw soft blue background grid
    physicsCtx.strokeStyle = 'rgba(99, 102, 241, 0.04)';
    physicsCtx.lineWidth = 1;
    for (let x = -12; x <= 12; x += 2) {
        const p1 = viewportMapper.toPixels(x, -4);
        const p2 = viewportMapper.toPixels(x, 4);
        physicsCtx.beginPath();
        physicsCtx.moveTo(p1.px, p1.py);
        physicsCtx.lineTo(p2.px, p2.py);
        physicsCtx.stroke();
    }

    // B. Draw Equilibrium center dashed line (x = 0)
    const pCenterTop = viewportMapper.toPixels(0, 3.5);
    const pCenterBottom = viewportMapper.toPixels(0, -3.5);
    physicsCtx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    physicsCtx.lineWidth = 1;
    physicsCtx.setLineDash([4, 4]);
    physicsCtx.beginPath();
    physicsCtx.moveTo(pCenterTop.px, pCenterTop.py);
    physicsCtx.lineTo(pCenterBottom.px, pCenterBottom.py);
    physicsCtx.stroke();
    physicsCtx.setLineDash([]);

    // Draw equilibrium label
    physicsCtx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    physicsCtx.font = '8px monospace';
    physicsCtx.textAlign = 'center';
    physicsCtx.fillText("EQUILIBRIUM (X=0)", pCenterTop.px, pCenterTop.py - 5);

    // C. Draw Left Wall Anchor (-10m)
    const pWallTop = viewportMapper.toPixels(-10, 2);
    const pWallBottom = viewportMapper.toPixels(-10, -2);
    physicsCtx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    physicsCtx.lineWidth = 4;
    physicsCtx.beginPath();
    physicsCtx.moveTo(pWallTop.px, pWallTop.py);
    physicsCtx.lineTo(pWallBottom.px, pWallBottom.py);
    physicsCtx.stroke();

    // D. Draw Spring Coil
    const pAnchor = viewportMapper.toPixels(-10, 0);
    const pMass = viewportMapper.toPixels(state.x, 0);
    draw1DSpringCoil(physicsCtx, pAnchor.px, pMass.px, pAnchor.py);

    // E. Draw Vectors
    drawVectors();

    // F. Draw Particle/Mass
    physicsCtx.fillStyle = '#00f2fe';
    physicsCtx.shadowBlur = 10;
    physicsCtx.shadowColor = 'rgba(0, 242, 254, 0.4)';
    physicsCtx.beginPath();
    physicsCtx.arc(pMass.px, pMass.py, 12, 0, 2 * Math.PI);
    physicsCtx.fill();
    physicsCtx.shadowBlur = 0;
    physicsCtx.strokeStyle = '#ffffff';
    physicsCtx.lineWidth = 2;
    physicsCtx.stroke();

    // Draw scrolling chart (bottom canvas)
    drawBottomCharts();
}

function draw1DSpringCoil(ctx, startX, endX, y, coils = 18, coilWidth = 16) {
    const dx = endX - startX;
    if (dx <= 10) return;

    ctx.strokeStyle = 'rgba(156, 163, 175, 0.55)'; // Silver-gray spring
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(startX, y);

    const leadIn = dx * 0.08;
    const coilLength = dx * 0.84;
    const leadOut = dx * 0.08;

    ctx.lineTo(startX + leadIn, y);

    for (let i = 0; i < coils; i++) {
        const ratio = (i + 0.5) / coils;
        const cx = startX + leadIn + coilLength * ratio;
        const cy = y + (i % 2 === 0 ? -coilWidth : coilWidth) / 2;
        ctx.lineTo(cx, cy);
    }

    ctx.lineTo(startX + leadIn + coilLength, y);
    ctx.lineTo(endX, y);
    ctx.stroke();
}

function drawVectors() {
    const p = viewportMapper.toPixels(state.x, 0);

    // Velocity vector (Cyan)
    if (Math.abs(state.v) > 0.02) {
        const vScale = 0.4;
        const endX = p.px + (state.v) * vScale * 25;
        CanvasHelpers.drawArrow(physicsCtx, p.px, p.py, endX, p.py, '#00f2fe', 3.5);
    }

    // Spring restoration force vector (Amber)
    const acc = forceFunc(state.x, state.v, state.t);
    if (Math.abs(acc) > 0.02) {
        const fScale = 0.4;
        const endX = p.px + (acc) * fScale * 25;
        CanvasHelpers.drawArrow(physicsCtx, p.px, p.py, endX, p.py, '#f59e0b', 3.5);
    }
}

// 7. Bottom Chart Renderer (Time-Series or Phase Space)
function drawBottomCharts() {
    const canvas = chartsCanvas;
    const ctx = chartsCtx;
    const width = canvas.getBoundingClientRect().width;
    const height = canvas.getBoundingClientRect().height;

    ctx.clearRect(0, 0, width, height);

    if (energyHistory.length === 0) return;

    if (state.chartMode === 'timeSeries') {
        drawTimeSeriesChart(width, height);
    } else {
        drawPhaseSpaceChart(width, height);
    }
}

function drawTimeSeriesChart(width, height) {
    const ctx = chartsCtx;

    // Time window setup
    const tMin = energyHistory[0].t;
    const tMax = energyHistory[energyHistory.length - 1].t;
    const dt = tMax - tMin;

    const E0 = initialEnergy || energyHistory[0].E;
    const yMin = 0.0;
    const yMax = E0 * 2.5; // Clamped vertical axis to prevent compression

    function toPixels(t, E) {
        const px = 55 + ((t - tMin) / (dt || 1)) * (width - 75);
        const py = height - 25 - ((E - yMin) / (yMax - yMin)) * (height - 35);
        return { px, py };
    }

    // 1. Draw horizontal reference line for initial energy (E_0)
    const refLineY = toPixels(tMin, E0).py;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(55, refLineY);
    ctx.lineTo(width - 20, refLineY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.font = '9px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('Initial Energy (E0)', 60, refLineY - 4);

    // 2. Draw axes
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(55, 10);
    ctx.lineTo(55, height - 25);
    ctx.lineTo(width - 20, height - 25);
    ctx.stroke();

    // Axis labels
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fillText('Time (s)', width - 60, height - 12);

    ctx.save();
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Total Energy (J)', 0, 0);
    ctx.restore();

    // 3. Draw energy history path
    ctx.beginPath();
    ctx.lineWidth = 2.5;

    // Solver-specific color coding
    if (state.selectedSolver === 'forwardEuler') {
        ctx.strokeStyle = '#ef4444'; // Red (unstable)
        ctx.setLineDash([6, 4]);
    } else if (state.selectedSolver === 'eulerCromer') {
        ctx.strokeStyle = '#3b82f6'; // Blue (symplectic wiggles)
    } else if (state.selectedSolver === 'velocityVerlet') {
        ctx.strokeStyle = '#10b981'; // Green (symplectic high-order)
    } else {
        ctx.strokeStyle = '#a855f7'; // Purple (RK4 decay)
    }

    for (let i = 0; i < energyHistory.length; i++) {
        const pt = toPixels(energyHistory[i].t, energyHistory[i].E);
        const clampedY = Math.max(10, Math.min(height - 25, pt.py));

        if (i === 0) {
            ctx.moveTo(pt.px, clampedY);
        } else {
            ctx.lineTo(pt.px, clampedY);
        }
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Live energy values overlay
    const currentE = energyHistory[energyHistory.length - 1].E;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`E(t) = ${currentE.toFixed(2)} J`, width - 25, 22);
}

function drawPhaseSpaceChart(width, height) {
    const ctx = chartsCtx;

    // Phase space axes centered
    const centerX = width / 2;
    const centerY = height / 2;

    const maxScaleX = 12.0; // position bounds
    const maxScaleV = 12.0; // velocity bounds

    const scaleX = (width * 0.4) / maxScaleX;
    const scaleV = (height * 0.4) / maxScaleV;

    function toPixels(x, v) {
        const px = centerX + x * scaleX;
        const py = centerY - v * scaleV;
        return { px, py };
    }

    // Draw phase axis lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(30, centerY);
    ctx.lineTo(width - 30, centerY);
    ctx.moveTo(centerX, 15);
    ctx.lineTo(centerX, height - 15);
    ctx.stroke();

    // Axis labels
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '8px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('Position x (m)', width - 35, centerY + 12);
    ctx.textAlign = 'left';
    ctx.fillText('Velocity v (m/s)', centerX + 8, 22);

    // Draw phase history path
    ctx.beginPath();
    ctx.lineWidth = 2.0;

    if (state.selectedSolver === 'forwardEuler') {
        ctx.strokeStyle = '#ef4444'; // Red
        ctx.setLineDash([5, 4]);
    } else if (state.selectedSolver === 'eulerCromer') {
        ctx.strokeStyle = '#3b82f6'; // Blue
    } else if (state.selectedSolver === 'velocityVerlet') {
        ctx.strokeStyle = '#10b981'; // Green
    } else {
        ctx.strokeStyle = '#a855f7'; // Purple
    }

    for (let i = 0; i < phaseHistory.length; i++) {
        const pt = toPixels(phaseHistory[i].x, phaseHistory[i].v);
        // Clamp to prevent blowout outside canvas boundary box
        const cx = Math.max(10, Math.min(width - 10, pt.px));
        const cy = Math.max(10, Math.min(height - 10, pt.py));

        if (i === 0) {
            ctx.moveTo(cx, cy);
        } else {
            ctx.lineTo(cx, cy);
        }
    }
    ctx.stroke();
    ctx.setLineDash([]);
}

// 8. Interaction Handlers & Keyboard Sync
function setupSliders() {
    const dtSlider = document.getElementById('slider-dt');
    const accDtSlider = document.getElementById('acc-dt-slider');
    const chartToggle = document.getElementById('btn-chart-toggle');

    if (dtSlider) {
        dtSlider.addEventListener('input', (e) => {
            state.dt = parseFloat(e.target.value);
            document.getElementById('slider-dt-val').textContent = state.dt.toFixed(2);
            if (accDtSlider) accDtSlider.value = state.dt.toFixed(2);
            announceScreenReader(`Step size set to ${state.dt.toFixed(2)} seconds`);
            resetSimulation();
        });
    }

    if (accDtSlider) {
        accDtSlider.addEventListener('input', (e) => {
            state.dt = parseFloat(e.target.value);
            if (dtSlider) dtSlider.value = state.dt.toFixed(2);
            document.getElementById('slider-dt-val').textContent = state.dt.toFixed(2);
            resetSimulation();
        });
    }

    // Chart mode toggle
    if (chartToggle) {
        chartToggle.addEventListener('click', () => {
            state.chartMode = state.chartMode === 'timeSeries' ? 'phaseSpace' : 'timeSeries';
            chartToggle.textContent = state.chartMode === 'timeSeries' ? 'Phase Space' : 'Energy Graph';
            announceScreenReader(`Chart swapped to ${state.chartMode === 'timeSeries' ? 'Time-Series Energy Graph' : 'Phase-Space Plot'}`);
            draw();
        });
    }

    // Solver radios selection
    const radios = document.querySelectorAll('input[name="solver"]');
    radios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            state.selectedSolver = e.target.value;
            announceScreenReader(`Solver swapped to ${state.selectedSolver}`);
            resetSimulation();
        });
    });

    setupKeyboardListeners();
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
                    announceScreenReader("Stepped forward one step");
                }
                break;
        }
    });
}

// 9. Accessibility Helpers & Status Updates
let lastTableUpdateTime = 0;
function throttleUpdateAccessibleTable(timestamp) {
    if (timestamp - lastTableUpdateTime < 1000 && !state.isPaused) return;
    lastTableUpdateTime = timestamp;

    const K = 0.5 * state.mass * state.v * state.v;
    const U = 0.5 * state.k * state.x * state.x;
    const totalE = K + U;

    const elements = {
        'val-time': state.t.toFixed(1),
        'val-x': state.x.toFixed(2),
        'val-v': state.v.toFixed(2),
        'val-ke': K.toFixed(1),
        'val-pe': U.toFixed(1),
        'val-te': totalE.toFixed(1)
    };

    for (const [id, value] of Object.entries(elements)) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }
}

function announceScreenReader(message) {
    const announcer = document.getElementById('sim-live-announcer');
    if (announcer) {
        announcer.textContent = message;
    }
}

// 10. Scrollytelling transitions observer
function initScrollytelling() {
    const observerOptions = {
        root: null,
        rootMargin: "-25% 0px -25% 0px",
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

    // Reset controls visibility
    const solverFieldset = document.getElementById('solver-selectors-fieldset');
    const dtSliderRow = document.getElementById('dt-slider-row');

    // progressive disclosure setup
    if (step === 1) {
        // Locked to Forward Euler, Δt = 0.1
        state.dt = 0.1;
        state.selectedSolver = 'forwardEuler';
        syncSlidersUI(0.1, 'forwardEuler');
        if (solverFieldset) solverFieldset.style.display = 'none';
        if (dtSliderRow) dtSliderRow.style.display = 'none';
    }
    else if (step === 2 || step === 3) {
        // Still Forward Euler, but unlock Δt slider
        state.selectedSolver = 'forwardEuler';
        syncSlidersUI(state.dt, 'forwardEuler');
        if (solverFieldset) solverFieldset.style.display = 'none';
        if (dtSliderRow) dtSliderRow.style.display = 'grid';
    }
    else if (step === 4) {
        // Unlock Forward Euler and Euler-Cromer
        if (solverFieldset) {
            solverFieldset.style.display = 'block';
            toggleRadioOptionAvailability(['forwardEuler', 'eulerCromer'], ['velocityVerlet', 'rk4']);
        }
        if (dtSliderRow) dtSliderRow.style.display = 'grid';
    }
    else if (step >= 5) {
        // Full solvers unlock
        if (solverFieldset) {
            solverFieldset.style.display = 'block';
            toggleRadioOptionAvailability(['forwardEuler', 'eulerCromer', 'velocityVerlet', 'rk4'], []);
        }
        if (dtSliderRow) dtSliderRow.style.display = 'grid';
    }

    resetSimulation();
}

function syncSlidersUI(dt, solver) {
    const slider = document.getElementById('slider-dt');
    if (slider) {
        slider.value = dt;
        document.getElementById('slider-dt-val').textContent = dt.toFixed(2);
    }
    const rEl = document.querySelector(`input[name="solver"][value="${solver}"]`);
    if (rEl) rEl.checked = true;
}

function toggleRadioOptionAvailability(activeSolvers, disabledSolvers) {
    activeSolvers.forEach(solver => {
        const input = document.querySelector(`input[name="solver"][value="${solver}"]`);
        if (input) {
            input.disabled = false;
            input.parentElement.style.opacity = '1';
        }
    });

    disabledSolvers.forEach(solver => {
        const input = document.querySelector(`input[name="solver"][value="${solver}"]`);
        if (input) {
            input.disabled = true;
            input.parentElement.style.opacity = '0.35';
        }
    });
}

// 11. Initialization
document.addEventListener('DOMContentLoaded', () => {
    physicsCanvas = document.getElementById('physics-canvas');
    physicsCtx = physicsCanvas.getContext('2d');
    chartsCanvas = document.getElementById('charts-canvas');
    chartsCtx = chartsCanvas.getContext('2d');

    document.body.classList.add('space-theme-body');

    setupSliders();
    initScrollytelling();
    resetHistory();
    recordHistory();

    const resizeObserver = new ResizeObserver(() => {
        CanvasHelpers.setupHighDPI(physicsCanvas, physicsCtx);
        CanvasHelpers.setupHighDPI(chartsCanvas, chartsCtx);
        draw();
    });
    resizeObserver.observe(physicsCanvas);
    resizeObserver.observe(chartsCanvas);

    // Playback events
    const playPauseBtn = document.getElementById('btn-play-pause');
    const stepBtn = document.getElementById('btn-step');
    const resetBtn = document.getElementById('btn-reset');

    if (playPauseBtn) playPauseBtn.addEventListener('click', togglePlayPause);
    if (stepBtn) stepBtn.addEventListener('click', stepSimulationFrame);
    if (resetBtn) resetBtn.addEventListener('click', resetSimulation);

    requestAnimationFrame(animationLoop);
});
