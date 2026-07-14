import { CanvasHelpers } from './canvas_helpers.js';

// 1. Simulation State Definition
const state = {
    t: 0,
    s: 0,              // Position along track (arc-length)
    v: 0,              // Velocity along track (v_s)
    mass: 1.0,
    thermalEnergy: 0.0,
    isPaused: true,
    isDraggingParticle: false,
    zeroOffset: 0.0,
    parameters: {
        g: 9.81,
        friction: 0.15, // Coefficient of sliding friction \mu
        damping: 0.0
    },
    // Scrollytelling Visibility Flags
    currentStep: 1,
    showThermalBar: false,
    showBoundaries: false,
    showZoneShrinkage: false
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

// Initial position
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
    return {
        x: pos.x,
        y: pos.y,
        slope, // dy/ds
        tangentX: derivs.dx / length,
        tangentY: derivs.dy / length,
        normalX: -derivs.dy / length,
        normalY: derivs.dx / length
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

// 3. Mathematical Potential and Conservative Accelerations
function getPotentialEnergy(s) {
    const phys = getBezierPhysics(s);
    return state.mass * state.parameters.g * (phys.y - state.zeroOffset);
}

function computeConsAcceleration(s) {
    const phys = getBezierPhysics(s);
    return -state.parameters.g * phys.slope;
}

// 4. Unified Verlet Integrator with Coulomb Projection & Damping
function integrateFrictionalStep(dt) {
    const mass = state.mass;
    const mu = state.parameters.friction;
    const g = state.parameters.g;
    const damping = state.parameters.damping;
    const gamma = damping / mass;

    // A. Current state variables
    const s_n = state.s;
    const v_n = state.v;
    const geom_n = getBezierPhysics(s_n);
    const aCons_n = computeConsAcceleration(s_n);

    // Friction normal component: F_normal = m * g * cos(theta) = m * g * tangentX
    const fNormal_n = mu * g * Math.abs(geom_n.tangentX);

    // Friction force evaluation at step n (static vs kinetic breakaway)
    let aFric_n = 0;
    if (v_n !== 0) {
        aFric_n = -fNormal_n * Math.sign(v_n);
    } else {
        if (Math.abs(aCons_n) <= fNormal_n) {
            aFric_n = -aCons_n; // Static friction holds particle at rest
        } else {
            aFric_n = -fNormal_n * Math.sign(aCons_n); // Breakaway sliding
        }
    }
    const a_n = aCons_n - gamma * v_n + aFric_n;

    // B. Position Verlet Step
    let s_next = s_n + v_n * dt + 0.5 * a_n * dt * dt;

    // Bound checks
    let bounced = false;
    if (s_next < 0) {
        s_next = 0;
        bounced = true;
    } else if (s_next > totalS) {
        s_next = totalS;
        bounced = true;
    }

    // C. Evaluate forces at next position
    const geom_next = getBezierPhysics(s_next);
    const aCons_next = computeConsAcceleration(s_next);
    const fNormal_next = mu * g * Math.abs(geom_next.tangentX);

    // D. Trial velocity v* (ignoring step n+1 friction)
    const vStar = (v_n + 0.5 * dt * (a_n + aCons_next)) / (1 + 0.5 * gamma * dt);
    const deltaVFric = (0.5 * dt * fNormal_next) / (1 + 0.5 * gamma * dt);

    let v_next = 0;
    let aFric_next = 0;
    let stoppingStep = false;

    if (bounced) {
        // Simple bounce
        v_next = -vStar;
    } else if (Math.abs(vStar) > deltaVFric) {
        // Active sliding
        v_next = vStar - deltaVFric * Math.sign(vStar);
        aFric_next = -fNormal_next * Math.sign(v_next);
    } else {
        // Coulomb projection locks velocity to exactly zero
        v_next = 0;
        aFric_next = -aCons_next - (2 * v_n) / dt - a_n;
        stoppingStep = (v_n !== 0); // Particle stops this step
    }

    // E. Thermal Energy accumulation (trapezoidal rule or work-energy fallback)
    const K_n = 0.5 * mass * v_n * v_n;
    const K_next = 0.5 * mass * v_next * v_next;
    const U_n = getPotentialEnergy(s_n);
    const U_next = getPotentialEnergy(s_next);

    let deltaEth = 0;
    if (stoppingStep) {
        // Work-energy theorem for stopping step ensures zero conservation drift
        deltaEth = (K_n + U_n) - (K_next + U_next);
    } else {
        // Trapezoidal integration for standard steps
        const power_n = (gamma * mass * v_n * v_n) + (fNormal_n * mass * Math.abs(v_n));
        const power_next = (gamma * mass * v_next * v_next) + (fNormal_next * mass * Math.abs(v_next));
        deltaEth = 0.5 * dt * (power_n + power_next);
    }

    state.s = s_next;
    state.v = v_next;
    state.t += dt;
    state.thermalEnergy += Math.max(0, deltaEth);
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
    state.v = 0;
    state.s = totalS * 0.15; // Reset to left slope
    state.thermalEnergy = 0.0;
    sparks.length = 0;
    draw();
}

function stepSimulationFrame() {
    if (state.isPaused) {
        integrateFrictionalStep(0.016);
        draw();
    }
}

// 6. Heat Spark Particle System
class Spark {
    constructor(x, y, vx, vy) {
        this.x = x;
        this.y = y;
        this.vx = vx + (Math.random() - 0.5) * 2.0;
        this.vy = vy + Math.random() * 3.0; // Biased upwards
        this.life = 1.0;
        this.decay = 1.5 + Math.random() * 1.5;
    }

    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= this.decay * dt;
    }

    draw(ctx, mapper) {
        const p = mapper.toPixels(this.x, this.y);
        // If sparks cross the physical boundary box (y > 4.5), fade them out faster
        const opacity = this.y > 4.5 ? this.life * 0.3 : this.life;
        ctx.fillStyle = `rgba(249, 115, 22, ${opacity})`;
        ctx.beginPath();
        ctx.arc(p.px, p.py, 2.5, 0, 2 * Math.PI);
        ctx.fill();
    }
}

const sparks = [];

function emitSparks(dt) {
    if (state.isPaused || state.parameters.friction === 0 || Math.abs(state.v) < 0.05) return;

    const phys = getBezierPhysics(state.s);
    // Emission rate proportional to friction power dissipation
    const normalForce = state.mass * state.parameters.g * Math.abs(phys.tangentX);
    const power = normalForce * state.parameters.friction * Math.abs(state.v);

    const sparkCount = Math.min(5, Math.ceil(power * 0.6));
    for (let i = 0; i < sparkCount; i++) {
        sparks.push(new Spark(phys.x, phys.y, state.v * phys.tangentX * 0.3, state.v * phys.tangentY * 0.3));
    }
}

// 7. Decoupled Frame loop
let lastTime = 0;
let accumulator = 0;
const simTimeStep = 0.001;

function animationLoop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    let frameTime = (timestamp - lastTime) / 1000.0;
    lastTime = timestamp;

    if (frameTime > 0.15) frameTime = 0.15;

    if (!state.isPaused && !state.isDraggingParticle) {
        // Emit sparks proportional to power
        emitSparks(frameTime);

        // Update physics in fixed steps
        accumulator += frameTime;
        while (accumulator >= simTimeStep) {
            integrateFrictionalStep(simTimeStep);
            accumulator -= simTimeStep;
        }
    }

    // Update sparks positions
    for (let i = sparks.length - 1; i >= 0; i--) {
        sparks[i].update(frameTime);
        if (sparks[i].life <= 0) {
            sparks.splice(i, 1);
        }
    }

    draw();
    throttleUpdateAccessibleTable(timestamp);
    requestAnimationFrame(animationLoop);
}

// 8. Canvas Rendering Engine
let physicsCanvas, physicsCtx;
let chartsCanvas, chartsCtx;
let viewportMapper;

function draw() {
    if (!physicsCanvas || !physicsCtx || !chartsCanvas || !chartsCtx) return;

    const width = physicsCanvas.getBoundingClientRect().width;
    const height = physicsCanvas.getBoundingClientRect().height;

    // Clear Canvas
    physicsCtx.clearRect(0, 0, width, height);

    // Setup viewport mapper (same U-shaped limits as Page 1)
    viewportMapper = CanvasHelpers.getViewportMapper(width, height, -12, 12, -2, 7);

    // A. Draw soft blue background grid
    physicsCtx.strokeStyle = 'rgba(99, 102, 241, 0.04)';
    physicsCtx.lineWidth = 1;
    for (let x = -12; x <= 12; x += 2) {
        const p1 = viewportMapper.toPixels(x, -2);
        const p2 = viewportMapper.toPixels(x, 7);
        physicsCtx.beginPath();
        physicsCtx.moveTo(p1.px, p1.py);
        physicsCtx.lineTo(p2.px, p2.py);
        physicsCtx.stroke();
    }

    // B. Draw Physical Boundary Box (if scrollytelling step >= 4)
    if (state.currentStep >= 4) {
        const borderLeft = viewportMapper.toPixels(-10.5, -1.2);
        const borderRight = viewportMapper.toPixels(10.5, 4.5);
        physicsCtx.strokeStyle = 'rgba(99, 102, 241, 0.35)';
        physicsCtx.lineWidth = 1.5;
        physicsCtx.setLineDash([6, 6]);
        physicsCtx.strokeRect(borderLeft.px, borderRight.py, borderRight.px - borderLeft.px, borderLeft.py - borderRight.py);
        physicsCtx.setLineDash([]);

        // Label
        physicsCtx.fillStyle = 'rgba(99, 102, 241, 0.7)';
        physicsCtx.font = 'bold 9px monospace';
        physicsCtx.fillText("MECHANICAL SYSTEM BOUNDARY", borderLeft.px + 10, borderRight.py + 15);
    }

    // C. Draw Landscape Curve
    // If Chapter 5 is active, draw track as Allowed (Cyan) vs Forbidden (Grey) based on E_mech
    const physP = getBezierPhysics(state.s);
    const mechE = 0.5 * state.mass * state.v * state.v + getPotentialEnergy(state.s);
    const limitY = mechE / (state.mass * state.parameters.g) + state.zeroOffset;

    if (state.showZoneShrinkage) {
        const drawSteps = 300;

        // Pass 1: Full track (Dashed Grey)
        physicsCtx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
        physicsCtx.lineWidth = 4;
        physicsCtx.setLineDash([5, 5]);
        physicsCtx.beginPath();
        for (let i = 0; i <= drawSteps; i++) {
            const uVal = i / drawSteps;
            const pt = evaluateBezierPoint(uVal);
            const p = viewportMapper.toPixels(pt.x, pt.y);
            if (i === 0) physicsCtx.moveTo(p.px, p.py);
            else physicsCtx.lineTo(p.px, p.py);
        }
        physicsCtx.stroke();
        physicsCtx.setLineDash([]);

        // Pass 2: Allowed track (glowing Neon Cyan)
        physicsCtx.strokeStyle = '#00f2fe';
        physicsCtx.lineWidth = 4;
        physicsCtx.shadowColor = 'rgba(0, 242, 254, 0.4)';
        physicsCtx.shadowBlur = 6;
        let inAllowed = false;
        physicsCtx.beginPath();
        for (let i = 0; i <= drawSteps; i++) {
            const uVal = i / drawSteps;
            const pt = evaluateBezierPoint(uVal);
            const allowed = pt.y <= limitY;
            const p = viewportMapper.toPixels(pt.x, pt.y);

            if (allowed) {
                if (!inAllowed) {
                    physicsCtx.moveTo(p.px, p.py);
                    inAllowed = true;
                } else {
                    physicsCtx.lineTo(p.px, p.py);
                }
            } else {
                inAllowed = false;
            }
        }
        physicsCtx.stroke();
        physicsCtx.shadowBlur = 0;

        // Draw turning point brackets
        drawFrictionalBrackets(limitY);
    } else {
        // Standard track (Solid Indigo)
        physicsCtx.strokeStyle = '#4f46e5';
        physicsCtx.lineWidth = 3;
        physicsCtx.beginPath();
        for (let i = 0; i <= 200; i++) {
            const uVal = i / 200;
            const pt = evaluateBezierPoint(uVal);
            const p = viewportMapper.toPixels(pt.x, pt.y);
            if (i === 0) physicsCtx.moveTo(p.px, p.py);
            else physicsCtx.lineTo(p.px, p.py);
        }
        physicsCtx.stroke();
    }

    // D. Draw Heat Sparks
    sparks.forEach(spark => spark.draw(physicsCtx, viewportMapper));

    // E. Draw Vectors
    drawVectors(physP);

    // F. Draw Particle
    const pParticle = viewportMapper.toPixels(physP.x, physP.y);
    physicsCtx.fillStyle = '#00f2fe';
    physicsCtx.shadowBlur = 10;
    physicsCtx.shadowColor = 'rgba(0, 242, 254, 0.4)';
    physicsCtx.beginPath();
    physicsCtx.arc(pParticle.px, pParticle.py, 9, 0, 2 * Math.PI);
    physicsCtx.fill();
    physicsCtx.shadowBlur = 0;
    physicsCtx.strokeStyle = '#ffffff';
    physicsCtx.lineWidth = 1.5;
    physicsCtx.stroke();

    // H. Render Energy Bars
    drawEnergyBarsChart();
}

function drawFrictionalBrackets(limitY) {
    const tps = [];
    const scanSteps = 150;
    for (let i = 0; i < scanSteps; i++) {
        const u1 = i / scanSteps;
        const u2 = (i + 1) / scanSteps;
        const pt1 = evaluateBezierPoint(u1);
        const pt2 = evaluateBezierPoint(u2);

        if ((pt1.y - limitY) * (pt2.y - limitY) <= 0) {
            const ratio = (limitY - pt1.y) / (pt2.y - pt1.y);
            const xRoot = pt1.x + ratio * (pt2.x - pt1.x);
            tps.push({ x: xRoot });
        }
    }

    tps.forEach(tp => {
        const p = viewportMapper.toPixels(tp.x, limitY);
        const nextX = tp.x + 0.1;
        const u = uFromS(findClosestS(nextX, limitY));
        const isAllowedRight = evaluateBezierPoint(u).y <= limitY;

        const size = 12;
        const tick = 5;
        physicsCtx.strokeStyle = '#f59e0b';
        physicsCtx.lineWidth = 2;
        physicsCtx.beginPath();
        if (isAllowedRight) {
            physicsCtx.moveTo(p.px + tick, p.py - size);
            physicsCtx.lineTo(p.px, p.py - size);
            physicsCtx.lineTo(p.px, p.py + size);
            physicsCtx.lineTo(p.px + tick, p.py + size);
        } else {
            physicsCtx.moveTo(p.px - tick, p.py - size);
            physicsCtx.lineTo(p.px, p.py - size);
            physicsCtx.lineTo(p.px, p.py + size);
            physicsCtx.lineTo(p.px - tick, p.py + size);
        }
        physicsCtx.stroke();
    });
}

function drawVectors(phys) {
    const p = viewportMapper.toPixels(phys.x, phys.y);

    if (Math.abs(state.v) > 0.05) {
        const vScale = 0.4;
        const endX = p.px + (state.v * phys.tangentX) * vScale * 25;
        const endY = p.py - (state.v * phys.tangentY) * vScale * 25;
        CanvasHelpers.drawArrow(physicsCtx, p.px, p.py, endX, endY, '#00f2fe', 3);
    }

    const acc = computeConsAcceleration(state.s);
    if (Math.abs(acc) > 0.05) {
        const fScale = 0.3;
        const endX = p.px + (acc * phys.tangentX) * fScale * 25;
        const endY = p.py - (acc * phys.tangentY) * fScale * 25;
        CanvasHelpers.drawArrow(physicsCtx, p.px, p.py, endX, endY, '#f59e0b', 3);
    }
}

// 9. Three-Bar Energy Chart and Double-Nested Borders
const flowParticles = []; // Floating energy packets

function drawEnergyBarsChart() {
    const width = chartsCanvas.getBoundingClientRect().width;
    const height = chartsCanvas.getBoundingClientRect().height;
    chartsCtx.clearRect(0, 0, width, height);

    const energy = {
        K: 0.5 * state.mass * state.v * state.v,
        U: getPotentialEnergy(state.s)
    };
    const mechE = energy.K + energy.U;
    const totalE = mechE + state.thermalEnergy;

    const maxE = 60.0;
    const scale = (height * 0.45) / maxE;
    const centerY = height / 2;

    // Draw baseline axis
    chartsCtx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    chartsCtx.lineWidth = 1;
    chartsCtx.beginPath();
    chartsCtx.moveTo(20, centerY);
    chartsCtx.lineTo(width - 20, centerY);
    chartsCtx.stroke();

    // Bar positions
    const barWidth = 25;
    const gap = 35;
    const totalBars = state.showThermalBar ? 3 : 2;
    const startX = (width - (barWidth * totalBars + gap * (totalBars - 1))) / 2;

    const kHeight = energy.K * scale;
    const uHeight = energy.U * scale;

    // 1. Kinetic energy (Cyan)
    chartsCtx.fillStyle = '#00f2fe';
    chartsCtx.fillRect(startX, centerY - kHeight, barWidth, kHeight);
    chartsCtx.fillStyle = '#ffffff';
    chartsCtx.font = '9px monospace';
    chartsCtx.textAlign = 'center';
    chartsCtx.fillText('K', startX + barWidth / 2, centerY + 12);
    chartsCtx.fillText(energy.K.toFixed(1) + 'J', startX + barWidth / 2, centerY - kHeight - 5);

    // 2. Potential energy (Magenta)
    const uStartX = startX + barWidth + gap;
    chartsCtx.fillStyle = '#ff00dd';
    chartsCtx.fillRect(uStartX, centerY - uHeight, barWidth, uHeight);
    chartsCtx.fillStyle = '#ffffff';
    chartsCtx.fillText('U', uStartX + barWidth / 2, centerY + 12);
    chartsCtx.fillText(energy.U.toFixed(1) + 'J', uStartX + barWidth / 2, centerY - uHeight - 5);

    // 3. Thermal energy (Orange, if unlocked)
    let thStartX = 0;
    if (state.showThermalBar) {
        thStartX = uStartX + barWidth + gap;
        const thHeight = state.thermalEnergy * scale;
        chartsCtx.fillStyle = '#f97316';
        chartsCtx.fillRect(thStartX, centerY - thHeight, barWidth, thHeight);

        chartsCtx.fillStyle = '#ffffff';
        chartsCtx.fillText('Eth', thStartX + barWidth / 2, centerY + 12);
        chartsCtx.fillText(state.thermalEnergy.toFixed(1) + 'J', thStartX + barWidth / 2, centerY - thHeight - 5);
    }

    // 4. Draw Energy Lines
    // Mechanical energy line (dashed Cyan/Magenta, decays)
    const mechY = centerY - mechE * scale;
    chartsCtx.strokeStyle = 'rgba(255, 0, 221, 0.6)';
    chartsCtx.lineWidth = 1.5;
    chartsCtx.setLineDash([4, 4]);
    chartsCtx.beginPath();
    chartsCtx.moveTo(startX - 10, mechY);
    chartsCtx.lineTo(uStartX + barWidth + 10, mechY);
    chartsCtx.stroke();
    chartsCtx.setLineDash([]);

    // Total Energy Line (solid Amber, flat)
    const totalY = centerY - totalE * scale;
    chartsCtx.strokeStyle = '#f59e0b';
    chartsCtx.lineWidth = 2.5;
    chartsCtx.beginPath();
    chartsCtx.moveTo(startX - 15, totalY);
    chartsCtx.lineTo(startX + barWidth * totalBars + gap * (totalBars - 1) + 15, totalY);
    chartsCtx.stroke();

    chartsCtx.fillStyle = '#f59e0b';
    chartsCtx.font = 'bold 9px monospace';
    chartsCtx.textAlign = 'left';
    chartsCtx.fillText(`E_tot = ${totalE.toFixed(1)}J`, startX + barWidth * totalBars + gap * (totalBars - 1) + 20, totalY + 3);

    // 5. Draw Nested Boundary Boxes (if scrollytelling step >= 4)
    if (state.showBoundaries) {
        drawBoundaryBoxes(startX, barWidth, gap, centerY, scale, maxE);
        updateAndDrawFlowParticles(startX, uStartX, thStartX, centerY, kHeight, uHeight, scale);
    }
}

function drawBoundaryBoxes(startX, barWidth, gap, centerY, scale, maxE) {
    const boxHeight = maxE * scale + 24;
    const boxY = centerY - maxE * scale - 12;

    // A. Inner dashed Mechanical System box
    chartsCtx.strokeStyle = 'rgba(0, 242, 254, 0.35)';
    chartsCtx.lineWidth = 1.5;
    chartsCtx.setLineDash([4, 4]);
    const mechWidth = barWidth * 2 + gap + 16;
    chartsCtx.strokeRect(startX - 8, boxY, mechWidth, boxHeight);
    chartsCtx.setLineDash([]);

    // Label
    chartsCtx.fillStyle = 'rgba(0, 242, 254, 0.8)';
    chartsCtx.font = '7px monospace';
    chartsCtx.textAlign = 'left';
    chartsCtx.fillText("SYSTEM (MECHANICAL)", startX - 4, boxY + 10);

    // B. Surroundings box (around Eth)
    chartsCtx.strokeStyle = 'rgba(249, 115, 22, 0.35)';
    chartsCtx.lineWidth = 1.5;
    chartsCtx.setLineDash([4, 4]);
    const surroundingsStartX = startX + (barWidth + gap) * 2 - 8;
    chartsCtx.strokeRect(surroundingsStartX, boxY, barWidth + 16, boxHeight);
    chartsCtx.setLineDash([]);

    // Label
    chartsCtx.fillStyle = 'rgba(249, 115, 22, 0.8)';
    chartsCtx.fillText("SURROUNDINGS", surroundingsStartX + 4, boxY + 10);

    // C. Outer Solid Conserved Closed boundary box
    chartsCtx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
    chartsCtx.lineWidth = 1.5;
    const outerWidth = barWidth * 3 + gap * 2 + 32;
    chartsCtx.strokeRect(startX - 16, boxY - 14, outerWidth, boxHeight + 28);

    // Label
    chartsCtx.fillStyle = 'rgba(245, 158, 11, 0.8)';
    chartsCtx.font = 'bold 7px monospace';
    chartsCtx.fillText("TOTAL CLOSED SYSTEM BOUNDARY (CONSERVED)", startX - 12, boxY - 6);
}

function updateAndDrawFlowParticles(startX, uStartX, thStartX, centerY, kHeight, uHeight, scale) {
    // Generate flow particles when active sliding friction is releasing energy
    if (!state.isPaused && state.parameters.friction > 0 && Math.abs(state.v) > 0.05) {
        // Emit from K or U depending on which is active
        const sourceX = Math.random() > 0.5 ? startX + 12 : uStartX + 12;
        const sourceY = sourceX === startX + 12 ? centerY - kHeight : centerY - uHeight;

        if (Math.random() < 0.1) {
            flowParticles.push({
                x: sourceX,
                y: sourceY,
                targetX: thStartX + 12,
                targetY: centerY - state.thermalEnergy * scale,
                progress: 0
            });
        }
    }

    // Update and draw
    for (let i = flowParticles.length - 1; i >= 0; i--) {
        const p = flowParticles[i];
        p.progress += 0.02; // Update animation progress

        if (p.progress >= 1.0) {
            flowParticles.splice(i, 1);
            continue;
        }

        // Quadratic Bezier path curve floating upwards and across
        const t = p.progress;
        const mt = 1 - t;

        // Control point in middle-top
        const cpX = (p.x + p.targetX) / 2;
        const cpY = Math.min(p.y, p.targetY) - 25;

        const x = mt * mt * p.x + 2 * mt * t * cpX + t * t * p.targetX;
        const y = mt * mt * p.y + 2 * mt * t * cpY + t * t * p.targetY;

        chartsCtx.fillStyle = '#f97316';
        chartsCtx.beginPath();
        chartsCtx.arc(x, y, 2, 0, 2 * Math.PI);
        chartsCtx.fill();
    }
}

// 10. Interaction Handlers & Slider Sync
function setupMouseEvents() {
    physicsCanvas.addEventListener('mousedown', (e) => {
        const rect = physicsCanvas.getBoundingClientRect();
        const mousePx = e.clientX - rect.left;
        const mousePy = e.clientY - rect.top;

        if (!viewportMapper) return;
        const phys = viewportMapper.toPhysics(mousePx, mousePy);

        // Check particle click
        const pState = getBezierPhysics(state.s);
        const pPixel = viewportMapper.toPixels(pState.x, pState.y);
        const dist = Math.sqrt((mousePx - pPixel.px) ** 2 + (mousePy - pPixel.py) ** 2);

        if (dist < 22) {
            state.isDraggingParticle = true;
            state.v = 0;
            announceScreenReader("Particle grabbed");
        }
    });

    physicsCanvas.addEventListener('mousemove', (e) => {
        if (!viewportMapper || !state.isDraggingParticle) return;
        const rect = physicsCanvas.getBoundingClientRect();
        const mousePx = e.clientX - rect.left;
        const mousePy = e.clientY - rect.top;
        const phys = viewportMapper.toPhysics(mousePx, mousePy);

        state.s = findClosestS(phys.x, phys.y);
        state.v = 0;

        // Sync accessibility slider
        const posSlider = document.getElementById('acc-particle-slider');
        if (posSlider) {
            posSlider.value = Math.round((state.s / totalS) * 100);
        }
        draw();
    });

    window.addEventListener('mouseup', () => {
        if (state.isDraggingParticle) {
            state.isDraggingParticle = false;
            announceScreenReader(`Particle placed at position x = ${getBezierPhysics(state.s).x.toFixed(1)}m`);
        }
    });

    // Mobile touch
    physicsCanvas.addEventListener('touchstart', (e) => {
        if (e.touches.length === 0 || !viewportMapper) return;
        const touch = e.touches[0];
        const rect = physicsCanvas.getBoundingClientRect();
        const mousePx = touch.clientX - rect.left;
        const mousePy = touch.clientY - rect.top;

        const pState = getBezierPhysics(state.s);
        const pPixel = viewportMapper.toPixels(pState.x, pState.y);
        const dist = Math.sqrt((mousePx - pPixel.px) ** 2 + (mousePy - pPixel.py) ** 2);

        if (dist < 30) {
            state.isDraggingParticle = true;
            state.v = 0;
            e.preventDefault();
        }
    }, { passive: false });

    physicsCanvas.addEventListener('touchmove', (e) => {
        if (e.touches.length === 0 || !viewportMapper || !state.isDraggingParticle) return;
        const touch = e.touches[0];
        const rect = physicsCanvas.getBoundingClientRect();
        const mousePx = touch.clientX - rect.left;
        const mousePy = touch.clientY - rect.top;
        const phys = viewportMapper.toPhysics(mousePx, mousePy);

        e.preventDefault();
        state.s = findClosestS(phys.x, phys.y);
        state.v = 0;
        draw();
    }, { passive: false });

    physicsCanvas.addEventListener('touchend', () => {
        state.isDraggingParticle = false;
    });

    // Mirror sliders accessibility triggers
    const fSlider = document.getElementById('slider-friction');
    const accFSlider = document.getElementById('acc-friction-slider');
    const accPosSlider = document.getElementById('acc-particle-slider');

    if (fSlider) {
        fSlider.addEventListener('input', (e) => {
            state.parameters.friction = parseFloat(e.target.value);
            document.getElementById('slider-friction-val').textContent = state.parameters.friction.toFixed(2);
            if (accFSlider) accFSlider.value = state.parameters.friction.toFixed(2);
            announceScreenReader(`Friction coefficient set to ${state.parameters.friction.toFixed(2)}`);
            draw();
        });
    }

    if (accFSlider) {
        accFSlider.addEventListener('input', (e) => {
            state.parameters.friction = parseFloat(e.target.value);
            if (fSlider) fSlider.value = state.parameters.friction.toFixed(2);
            document.getElementById('slider-friction-val').textContent = state.parameters.friction.toFixed(2);
            draw();
        });
    }

    if (accPosSlider) {
        accPosSlider.addEventListener('input', (e) => {
            const pct = parseFloat(e.target.value) / 100;
            state.s = pct * totalS;
            state.v = 0;
            draw();
        });
    }

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
                    announceScreenReader("Stepped forward. Position: x = " + getBezierPhysics(state.s).x.toFixed(1) + "m");
                }
                break;
        }
    });
}

// 11. Accessibility Helpers & Status updates
let lastTableUpdateTime = 0;
function throttleUpdateAccessibleTable(timestamp) {
    if (timestamp - lastTableUpdateTime < 1000 && !state.isPaused) return;
    lastTableUpdateTime = timestamp;

    const phys = getBezierPhysics(state.s);
    const K = 0.5 * state.mass * state.v * state.v;
    const U = getPotentialEnergy(state.s);
    const totalE = K + U + state.thermalEnergy;

    const timeVal = document.getElementById('val-time');
    const xVal = document.getElementById('val-x');
    const vVal = document.getElementById('val-v');
    const keVal = document.getElementById('val-ke');
    const peVal = document.getElementById('val-pe');
    const thVal = document.getElementById('val-thermal');
    const teVal = document.getElementById('val-te');

    if (timeVal) timeVal.textContent = state.t.toFixed(1);
    if (xVal) xVal.textContent = phys.x.toFixed(2);
    if (vVal) vVal.textContent = state.v.toFixed(2);
    if (keVal) keVal.textContent = K.toFixed(1);
    if (peVal) peVal.textContent = U.toFixed(1);
    if (thVal) thVal.textContent = state.thermalEnergy.toFixed(1);
    if (teVal) teVal.textContent = totalE.toFixed(1);
}

function announceScreenReader(message) {
    const announcer = document.getElementById('sim-live-announcer');
    if (announcer) {
        announcer.textContent = message;
    }
}

// 12. Scrollytelling transitions observer
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

    // Reset flags
    state.showThermalBar = false;
    state.showBoundaries = false;
    state.showZoneShrinkage = false;

    if (step >= 2) {
        // Pause step for prediction prompt
        state.isPaused = true;
        const playBtn = document.getElementById('btn-play-pause');
        if (playBtn) playBtn.textContent = 'Play';
    }
    if (step >= 3) {
        state.showThermalBar = true;
    }
    if (step >= 4) {
        state.showThermalBar = true;
        state.showBoundaries = true;
    }
    if (step >= 5) {
        state.showThermalBar = true;
        state.showBoundaries = true;
        state.showZoneShrinkage = true;
    }

    draw();
}

// 13. Initialization
document.addEventListener('DOMContentLoaded', () => {
    physicsCanvas = document.getElementById('physics-canvas');
    physicsCtx = physicsCanvas.getContext('2d');
    chartsCanvas = document.getElementById('charts-canvas');
    chartsCtx = chartsCanvas.getContext('2d');

    // Force theme
    document.body.classList.add('space-theme-body');

    setupMouseEvents();
    initScrollytelling();

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

    // Start simulation loop
    requestAnimationFrame(animationLoop);
});
