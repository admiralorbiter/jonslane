/**
 * Quantum Mechanics Wavefunction Sandbox Renderer Module
 * Exposes window.QuantumRenderer for Canvas 2D visualization of:
 * - Wavefunction curves (real, imaginary, probability)
 * - Phase hue bands
 * - Potential well geometry & bound-state energy lines
 * - Momentum space probability density
 * - Live 2D uncertainty hyperbola grid with active state dot
 */

window.QuantumRenderer = (() => {
    let mainCtx = null;
    let mainCanvas = null;
    let momCtx = null;
    let momCanvas = null;
    let uncCtx = null;
    let uncCanvas = null;

    // Design Tokens & Colors matching the stylesheet
    const colors = {
        bg: "#030308",
        grid: "rgba(99, 102, 241, 0.04)",
        psiRe: "#4A90D9", // Bright blue
        psiIm: "#E04848", // Coral red
        probStroke: "rgba(255, 255, 255, 0.85)",
        probFill: "rgba(255, 255, 255, 0.18)",
        potentialStroke: "#FFAA00", // Amber
        potentialFill: "rgba(255, 170, 0, 0.22)",
        boundaryFill: "rgba(255, 0, 0, 0.08)",
        hudText: "#A0AEC0",
        eigenstates: ['#7EE8A2', '#F6AE2D', '#F26419', '#86BBD8', '#F3C68F', '#9F86C0']
    };

    // Camera shake effect for measurement collapse
    let shakeIntensity = 0;
    let flashIntensity = 0;

    /**
     * Cache the canvas elements and contexts.
     */
    function init(canvasMain, canvasMom, canvasUnc) {
        mainCanvas = canvasMain;
        mainCtx = mainCanvas.getContext("2d");
        
        momCanvas = canvasMom;
        momCtx = momCanvas.getContext("2d");
        
        uncCanvas = canvasUnc;
        uncCtx = uncCanvas.getContext("2d");
    }

    /**
     * Clear and render the main wavefunction canvas.
     */
    function render(state, options = {}) {
        if (!mainCtx) return;

        // Dynamically match internal resolution to display size to prevent stretching/blur
        const rect = mainCanvas.getBoundingClientRect();
        if (mainCanvas.width !== Math.round(rect.width) || mainCanvas.height !== Math.round(rect.height)) {
            mainCanvas.width = Math.round(rect.width);
            mainCanvas.height = Math.round(rect.height);
        }

        const w = mainCanvas.width;
        const h = mainCanvas.height;

        // Apply camera shake translation if active
        mainCtx.save();
        if (shakeIntensity > 0.01) {
            const dx = (Math.random() - 0.5) * shakeIntensity * 12;
            const dy = (Math.random() - 0.5) * shakeIntensity * 12;
            mainCtx.translate(dx, dy);
            shakeIntensity *= 0.90; // Dampen camera shake
        }

        // Clear canvas
        mainCtx.fillStyle = colors.bg;
        mainCtx.fillRect(0, 0, w, h);

        // Draw gridlines
        drawGrid(mainCtx, w, h);

        // Grid parameters from solver state
        const N = state.N;
        const dxVal = state.dx;
        const xArr = state.x;
        const VArr = state.V;
        const etaArr = state.eta;
        const reArr = state.psi_re;
        const imArr = state.psi_im;

        const xMin = xArr[0];
        const xMax = xArr[N - 1];

        // Coordinate transforms: Map index to canvas X
        function getX(j) {
            return ((xArr[j] - xMin) / (xMax - xMin)) * w;
        }

        const yBaseline = h * 0.72; // Baseline for potential and wavefunction amplitude
        const maxDisplayV = options.maxDisplayV || 15.0;
        const probScale = options.probScale || 220; // Amplitude scaling for |psi|^2
        const waveScale = options.waveScale || 120; // Amplitude scaling for Real/Imag curves

        // --- 1. Draw CAP Absorber boundary areas ---
        mainCtx.fillStyle = colors.boundaryFill;
        const leftAbsorberW = getX(Math.round(0.12 * N));
        const rightAbsorberW = w - getX(N - 1 - Math.round(0.12 * N));
        mainCtx.fillRect(0, 0, leftAbsorberW, h);
        mainCtx.fillRect(w - rightAbsorberW, 0, rightAbsorberW, h);

        // --- 2. Draw Potential Barrier V(x) ---
        mainCtx.beginPath();
        mainCtx.moveTo(0, h);
        for (let j = 0; j < N; j++) {
            const yV = h - (VArr[j] / maxDisplayV) * (h * 0.78);
            mainCtx.lineTo(getX(j), yV);
        }
        mainCtx.lineTo(w, h);
        mainCtx.closePath();
        mainCtx.fillStyle = colors.potentialFill;
        mainCtx.fill();
        mainCtx.strokeStyle = colors.potentialStroke;
        mainCtx.lineWidth = 2.0;
        mainCtx.stroke();

        // --- 3. Draw energy eigenvalue dashed lines ---
        if (options.eigenstates && options.eigenstates.length > 0) {
            options.eigenstates.forEach((eig, idx) => {
                const yE = h - (eig.energy / maxDisplayV) * (h * 0.78);
                if (yE > 0 && yE < h) {
                    mainCtx.save();
                    mainCtx.setLineDash([6, 4]);
                    mainCtx.strokeStyle = colors.eigenstates[idx % colors.eigenstates.length];
                    mainCtx.lineWidth = 1.5;
                    mainCtx.beginPath();
                    
                    // Draw line only in classically allowed region (where V < E)
                    let leftAllowedX = 0;
                    let rightAllowedX = w;
                    for (let j = 0; j < N; j++) {
                        if (VArr[j] < eig.energy) {
                            leftAllowedX = getX(j);
                            break;
                        }
                    }
                    for (let j = N - 1; j >= 0; j--) {
                        if (VArr[j] < eig.energy) {
                            rightAllowedX = getX(j);
                            break;
                        }
                    }

                    mainCtx.moveTo(leftAllowedX, yE);
                    mainCtx.lineTo(rightAllowedX, yE);
                    mainCtx.stroke();
                    mainCtx.restore();

                    // Text energy labels
                    mainCtx.fillStyle = colors.eigenstates[idx % colors.eigenstates.length];
                    mainCtx.font = "10px monospace";
                    mainCtx.fillText(`E${idx + 1}=${eig.energy.toFixed(3)} Eh`, rightAllowedX + 6, yE + 3);
                }
            });
        }

        // --- 4. Draw Phase Hue Band ---
        if (options.showPhase) {
            const phaseY = h - 14;
            const stripH = 6;
            for (let j = 0; j < N - 1; j++) {
                const prob = reArr[j] * reArr[j] + imArr[j] * imArr[j];
                // Scale opacity by probability so we don't render phase noise at zero probability nodes
                const alpha = Math.min(1.0, prob * probScale * 2.5);
                const theta = Math.atan2(imArr[j], reArr[j]);
                const hue = ((theta / Math.PI) * 180 + 360) % 360;

                mainCtx.fillStyle = `hsla(${hue.toFixed(1)}, 100%, 55%, ${alpha.toFixed(3)})`;
                mainCtx.fillRect(getX(j), phaseY, getX(j+1) - getX(j) + 0.5, stripH);
            }
        }

        // --- 5. Draw |psi|^2 Probability Density ---
        if (options.showProb) {
            mainCtx.beginPath();
            mainCtx.moveTo(getX(0), yBaseline);
            for (let j = 0; j < N; j++) {
                const prob = reArr[j] * reArr[j] + imArr[j] * imArr[j];
                mainCtx.lineTo(getX(j), yBaseline - prob * probScale);
            }
            mainCtx.lineTo(getX(N - 1), yBaseline);
            mainCtx.closePath();
            mainCtx.fillStyle = colors.probFill;
            mainCtx.fill();
            mainCtx.strokeStyle = colors.probStroke;
            mainCtx.lineWidth = 1.8;
            mainCtx.stroke();
        }

        // --- 6. Draw psi_real & psi_imag curves ---
        if (options.showReal) {
            mainCtx.beginPath();
            for (let j = 0; j < N; j++) {
                const yRe = yBaseline - reArr[j] * waveScale;
                if (j === 0) mainCtx.moveTo(getX(j), yRe);
                else mainCtx.lineTo(getX(j), yRe);
            }
            mainCtx.strokeStyle = colors.psiRe;
            mainCtx.lineWidth = 2.0;
            mainCtx.stroke();
        }

        if (options.showImag) {
            mainCtx.beginPath();
            for (let j = 0; j < N; j++) {
                const yIm = yBaseline - imArr[j] * waveScale;
                if (j === 0) mainCtx.moveTo(getX(j), yIm);
                else mainCtx.lineTo(getX(j), yIm);
            }
            mainCtx.strokeStyle = colors.psiIm;
            mainCtx.lineWidth = 1.5;
            mainCtx.stroke();
        }

        // --- 7. Quest-Specific Target/Detector Overlays ---
        if (options.activeChapter === 1) {
            // Target boundary at x = 30
            const targetJ = Math.round(((30 - xMin) / (xMax - xMin)) * N);
            const targetX = getX(targetJ);
            mainCtx.strokeStyle = "rgba(0, 255, 150, 0.4)";
            mainCtx.setLineDash([4, 4]);
            mainCtx.lineWidth = 2.0;
            mainCtx.beginPath();
            mainCtx.moveTo(targetX, 0);
            mainCtx.lineTo(targetX, h);
            mainCtx.stroke();
            mainCtx.restore();

            mainCtx.fillStyle = "rgba(0, 255, 150, 0.8)";
            mainCtx.font = "11px monospace";
            mainCtx.fillText("Detector Target: x = 30", targetX - 130, 20);
        }

        mainCtx.restore(); // Restore shake transforms

        // Measurement collapse screen flash overlay
        if (flashIntensity > 0.01) {
            mainCtx.fillStyle = `rgba(255, 255, 255, ${flashIntensity.toFixed(2)})`;
            mainCtx.fillRect(0, 0, w, h);
            flashIntensity *= 0.85; // Quick fade
        }
    }

    /**
     * Clear and render the momentum space probability density canvas.
     */
    function renderMomentum(probK, state) {
        if (!momCtx) return;

        // Match display boundaries to prevent blur
        const rect = momCanvas.getBoundingClientRect();
        if (momCanvas.width !== Math.round(rect.width) || momCanvas.height !== Math.round(rect.height)) {
            momCanvas.width = Math.round(rect.width);
            momCanvas.height = Math.round(rect.height);
        }

        const w = momCanvas.width;
        const h = momCanvas.height;

        // Clear canvas
        momCtx.fillStyle = colors.bg;
        momCtx.fillRect(0, 0, w, h);

        // Draw grid
        drawGrid(momCtx, w, h);

        const N = probK.length;

        function getX(m) {
            return (m / (N - 1)) * w;
        }

        const yBaseline = h * 0.82;
        const scaleK = h * 0.95; // scaling factor for momentum amplitude

        // Draw |phi(k)|^2 momentum density shape
        momCtx.beginPath();
        momCtx.moveTo(getX(0), yBaseline);
        for (let m = 0; m < N; m++) {
            momCtx.lineTo(getX(m), yBaseline - probK[m] * scaleK);
        }
        momCtx.lineTo(getX(N - 1), yBaseline);
        momCtx.closePath();
        momCtx.fillStyle = "rgba(255, 255, 255, 0.12)";
        momCtx.fill();
        momCtx.strokeStyle = "#FFFFFF";
        momCtx.lineWidth = 1.5;
        momCtx.stroke();

        // Label axis center (k = 0)
        momCtx.strokeStyle = "rgba(255, 255, 255, 0.15)";
        momCtx.beginPath();
        momCtx.moveTo(w / 2, 0);
        momCtx.lineTo(w / 2, h);
        momCtx.stroke();

        momCtx.fillStyle = colors.hudText;
        momCtx.font = "9px monospace";
        momCtx.fillText("-k_max", 4, yBaseline + 12);
        momCtx.fillText("k = 0", w / 2 - 12, yBaseline + 12);
        momCtx.fillText("+k_max", w - 38, yBaseline + 12);
    }

    /**
     * Render the 2D Uncertainty standard deviation hyperbola chart.
     */
    function renderUncertainty(deltaX, deltaP) {
        if (!uncCtx) return;

        // Match display boundaries to prevent blur
        const rect = uncCanvas.getBoundingClientRect();
        if (uncCanvas.width !== Math.round(rect.width) || uncCanvas.height !== Math.round(rect.height)) {
            uncCanvas.width = Math.round(rect.width);
            uncCanvas.height = Math.round(rect.height);
        }

        const w = uncCanvas.width;
        const h = uncCanvas.height;

        // Clear canvas
        uncCtx.fillStyle = colors.bg;
        uncCtx.fillRect(0, 0, w, h);

        // Axes bounds
        const maxDx = 12.0;
        const maxDp = 2.0;

        function getCanvasX(dxVal) {
            return (dxVal / maxDx) * (w - 20) + 15;
        }
        function getCanvasY(dpVal) {
            return h - 15 - (dpVal / maxDp) * (h - 25);
        }

        // Draw axis lines
        uncCtx.strokeStyle = "rgba(255, 255, 255, 0.18)";
        uncCtx.lineWidth = 1.0;
        uncCtx.beginPath();
        uncCtx.moveTo(15, h - 15);
        uncCtx.lineTo(w - 5, h - 15);
        uncCtx.moveTo(15, h - 15);
        uncCtx.lineTo(15, 5);
        uncCtx.stroke();

        // Draw grid subdivisions
        uncCtx.strokeStyle = "rgba(255, 255, 255, 0.05)";
        uncCtx.beginPath();
        for (let val = 2; val < maxDx; val += 2) {
            const xCoord = getCanvasX(val);
            uncCtx.moveTo(xCoord, h - 15);
            uncCtx.lineTo(xCoord, 5);
        }
        for (let val = 0.5; val < maxDp; val += 0.5) {
            const yCoord = getCanvasY(val);
            uncCtx.moveTo(15, yCoord);
            uncCtx.lineTo(w - 5, yCoord);
        }
        uncCtx.stroke();

        // --- 1. Draw Heisenberg limit hyperbola Dx * Dp = 0.5 ---
        uncCtx.beginPath();
        let first = true;
        for (let valDx = 0.25; valDx <= maxDx; valDx += 0.05) {
            const valDp = 0.5 / valDx;
            if (valDp <= maxDp) {
                const cx = getCanvasX(valDx);
                const cy = getCanvasY(valDp);
                if (first) {
                    uncCtx.moveTo(cx, cy);
                    first = false;
                } else {
                    uncCtx.lineTo(cx, cy);
                }
            }
        }
        uncCtx.strokeStyle = "#E04848"; // Red limit boundary
        uncCtx.lineWidth = 1.8;
        uncCtx.stroke();

        // Shade the mathematically forbidden region under the hyperbola
        uncCtx.beginPath();
        uncCtx.moveTo(15, h - 15);
        for (let valDx = 0.25; valDx <= maxDx; valDx += 0.1) {
            const valDp = 0.5 / valDx;
            if (valDp <= maxDp) {
                uncCtx.lineTo(getCanvasX(valDx), getCanvasY(valDp));
            }
        }
        uncCtx.lineTo(w - 5, h - 15);
        uncCtx.closePath();
        uncCtx.fillStyle = "rgba(224, 72, 72, 0.06)";
        uncCtx.fill();

        // --- 2. Plot the active state coordinate dot ---
        if (deltaX !== undefined && deltaP !== undefined && !isNaN(deltaX) && !isNaN(deltaP)) {
            const dotX = getCanvasX(Math.min(deltaX, maxDx));
            const dotY = getCanvasY(Math.min(deltaP, maxDp));

            // Radial pulse glow
            const pulseRadius = 5 + Math.sin(Date.now() * 0.007) * 2;
            const product = deltaX * deltaP;
            let dotColor = "#7EE8A2"; // green near minimum
            if (product >= 1.0) dotColor = "#E04848"; // red if highly spread
            else if (product >= 0.53) dotColor = "#F6AE2D"; // yellow warning

            uncCtx.fillStyle = dotColor;
            uncCtx.beginPath();
            uncCtx.arc(dotX, dotY, pulseRadius, 0, 2 * Math.PI);
            uncCtx.globalAlpha = 0.25;
            uncCtx.fill();
            uncCtx.globalAlpha = 1.0;

            uncCtx.beginPath();
            uncCtx.arc(dotX, dotY, 4.0, 0, 2 * Math.PI);
            uncCtx.fill();
            uncCtx.strokeStyle = "#FFFFFF";
            uncCtx.lineWidth = 1.0;
            uncCtx.stroke();
        }

        // Labels
        uncCtx.fillStyle = colors.hudText;
        uncCtx.font = "8px monospace";
        uncCtx.fillText("Δx", w - 12, h - 4);
        uncCtx.fillText("Δp", 2, 8);
        uncCtx.fillStyle = "#E04848";
        uncCtx.fillText("Limit: ΔxΔp = 0.5 ℏ", getCanvasX(4.5), getCanvasY(0.5 / 4.5) - 6);
    }

    /**
     * Draw background gridlines on a canvas context.
     */
    function drawGrid(ctx, w, h) {
        ctx.strokeStyle = colors.grid;
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        const step = 25;
        for (let x = 0; x < w; x += step) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
        }
        for (let y = 0; y < h; y += step) {
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
        }
        ctx.stroke();
    }

    /**
     * Trigger visual collapse animations: camera shake & full-screen flash.
     */
    function triggerCollapseFX() {
        shakeIntensity = 1.0;
        flashIntensity = 0.95;
    }

    /**
     * Update uncertainty text readouts in the HTML DOM.
     */
    function updateHUD(unc) {
        const dxEl = document.getElementById("hud-dx");
        const dpEl = document.getElementById("hud-dp");
        const prodEl = document.getElementById("hud-product");

        if (!dxEl || !dpEl || !prodEl) return;

        dxEl.textContent = unc.dx.toFixed(3) + " a₀";
        dpEl.textContent = unc.dp.toFixed(3) + " ℏ/a₀";
        prodEl.textContent = unc.product.toFixed(3) + " ℏ";

        // Remove old classes
        prodEl.className = "hud-value";

        // Color coding HUD relative to Heisenberg limit
        if (unc.product < 0.52) {
            prodEl.classList.add("near-minimum");
        } else if (unc.product < 1.0) {
            prodEl.classList.add("elevated");
        } else {
            prodEl.classList.add("high");
        }
    }

    return {
        init,
        render,
        renderMomentum,
        renderUncertainty,
        triggerCollapseFX,
        updateHUD
    };
})();
