/**
 * Quantum Mechanics Wavefunction Sandbox Experiments Module
 * Handles Chapter quests, objective validators, interactive toolbar sliders,
 * mouse-drawing events, and the main animation loop.
 */

document.addEventListener("DOMContentLoaded", () => {
    // 1. Core visual elements
    const mainCanvas = document.getElementById("main-canvas");
    const momentumCanvas = document.getElementById("momentum-canvas");
    const uncertaintyCanvas = document.getElementById("uncertainty-canvas");

    if (!mainCanvas || !momentumCanvas || !uncertaintyCanvas) return;

    // 2. Global simulation states
    let isRunning = false;
    let currentChapter = 1;
    let stepsPerFrame = 10;
    let autoSmooth = true;
    
    // Draw tool state
    let activeTool = "draw"; // "draw" or "erase"
    let isDrawing = false;
    let lastDrawGridIdx = null;
    let lastDrawVal = null;

    // Simulation configuration variables
    let config = {
        N: 512,
        xMin: -50,
        xMax: 50,
        dt: 0.005,
        etaMax: 0.08
    };

    // UI elements references
    const btnPlayPause = document.getElementById("btn-play-pause");
    const btnStepFrame = document.getElementById("btn-step-frame");
    const btnResetSim = document.getElementById("btn-reset-sim");
    
    const chkShowReal = document.getElementById("chk-show-real");
    const chkShowImag = document.getElementById("chk-show-imag");
    const chkShowProb = document.getElementById("chk-show-prob");
    const chkShowPhase = document.getElementById("chk-show-phase");
    const chkAutoSmooth = document.getElementById("chk-auto-smooth");

    const btnDrawBarrier = document.getElementById("tool-draw-barrier");
    const btnEraseBarrier = document.getElementById("tool-erase-barrier");
    const btnClearPot = document.getElementById("btn-clear-pot");

    const tabsNav = document.querySelector(".quest-tabs-nav");
    const questBriefingBox = document.getElementById("quest-briefing-box");
    const slidersContainer = document.getElementById("chapter-sliders-container");

    const phaseWheelNeedle = document.getElementById("phase-wheel-needle");

    // Quest Tracking States
    const questCompletion = {
        1: false,
        2: false,
        3: false,
        4: false,
        5: false,
        6: false,
        7: false,
        8: false
    };

    // Quest-specific physics memory
    let questStates = {
        // Tomography counts
        tomographyMeasurements: [],
        tomographyCount: 0,
        // Bouncing state trackers
        stationaryStableFrames: 0,
        lastProbProfile: null,
        // Tunneling transmitted norm tracker
        initialNorm: 1.0,
        leftAbsorbedNorm: 0.0
    };

    // Active eigenstates for drawing energy levels
    let computedEigenstates = [];

    // --- INITIALIZATION ---
    QuantumSolver.init(config);
    QuantumRenderer.init(mainCanvas, momentumCanvas, uncertaintyCanvas);

    // Benchmarking to balance resolution & speed
    autoBenchmark();

    // Start simulation loop
    loadChapter(1);
    requestAnimationFrame(tick);

    // --- SETUP AUTO-BENCHMARK ---
    function autoBenchmark() {
        const t0 = performance.now();
        // Run 100 test steps
        for (let s = 0; s < 100; s++) {
            QuantumSolver.step(1);
        }
        const elapsed = performance.now() - t0;
        const msPerStep = elapsed / 100;

        if (msPerStep > 1.2) {
            // Slow device (e.g. mobile): drop N to 256, steps per frame to 5
            config.N = 256;
            config.dt = 0.008;
            stepsPerFrame = 5;
            QuantumSolver.init(config);
            document.getElementById("set-grid-n").value = "256";
            console.log(`Performance Mode: Downscaling solver to N=256 (step cost: ${msPerStep.toFixed(2)}ms)`);
        } else {
            console.log(`High Performance: running solver at default N=512 (step cost: ${msPerStep.toFixed(2)}ms)`);
        }
    }

    // --- GLOBAL CONTROLS LISTENERS ---
    btnPlayPause.addEventListener("click", () => {
        isRunning = !isRunning;
        btnPlayPause.textContent = isRunning ? "⏸ Pause" : "▶ Play";
        if (isRunning) {
            btnPlayPause.classList.add("running");
        } else {
            btnPlayPause.classList.remove("running");
        }
    });

    btnStepFrame.addEventListener("click", () => {
        isRunning = false;
        btnPlayPause.textContent = "▶ Play";
        btnPlayPause.classList.remove("running");
        QuantumSolver.step(1);
        updateVisuals();
    });

    btnResetSim.addEventListener("click", () => {
        loadChapter(currentChapter);
    });

    chkAutoSmooth.addEventListener("change", (e) => {
        autoSmooth = e.target.checked;
    });

    // Tool toggle drawing
    btnDrawBarrier.addEventListener("click", () => {
        activeTool = "draw";
        btnDrawBarrier.classList.add("active");
        btnEraseBarrier.classList.remove("active");
    });

    btnEraseBarrier.addEventListener("click", () => {
        activeTool = "erase";
        btnEraseBarrier.classList.add("active");
        btnDrawBarrier.classList.remove("active");
    });

    btnClearPot.addEventListener("click", () => {
        const state = QuantumSolver.getState();
        const V = new Float64Array(state.N);
        QuantumSolver.setV(V);
        updateVisuals();
    });

    // Chapter nav button clicks
    tabsNav.addEventListener("click", (e) => {
        const targetBtn = e.target.closest(".quest-tab-btn");
        if (!targetBtn) return;
        const ch = parseInt(targetBtn.getAttribute("data-chapter"));
        loadChapter(ch);
    });

    // Configuration Setup listener dropdowns
    document.getElementById("set-grid-n").addEventListener("change", (e) => {
        config.N = parseInt(e.target.value);
        QuantumSolver.init(config);
        loadChapter(currentChapter);
    });

    document.getElementById("set-dt").addEventListener("change", (e) => {
        const val = parseFloat(e.target.value);
        config.dt = val;
        document.getElementById("dt-readout").textContent = val.toFixed(3);
        QuantumSolver.init(config);
        loadChapter(currentChapter);
    });

    document.getElementById("set-cap-strength").addEventListener("change", (e) => {
        const val = parseFloat(e.target.value);
        config.etaMax = val;
        document.getElementById("cap-readout").textContent = val.toFixed(2);
        QuantumSolver.init(config);
        loadChapter(currentChapter);
    });

    // --- MOUSE DRAWING SYSTEM ---
    mainCanvas.addEventListener("mousedown", (e) => {
        isDrawing = true;
        handleDrawEvent(e);
    });

    window.addEventListener("mouseup", () => {
        if (isDrawing) {
            isDrawing = false;
            lastDrawGridIdx = null;
            lastDrawVal = null;
            if (autoSmooth) {
                applyGaussianSmoothing();
            }
        }
    });

    mainCanvas.addEventListener("mousemove", (e) => {
        if (isDrawing) {
            handleDrawEvent(e);
        }
    });

    function handleDrawEvent(e) {
        const rect = mainCanvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const state = QuantumSolver.getState();
        const N = state.N;
        const maxV = 22.0;

        // Map mouse position to grid index and potential value
        const j = Math.max(0, Math.min(N - 1, Math.floor((mouseX / rect.width) * N)));
        let val = 0.0;
        if (activeTool === "draw") {
            const ratio = 1.0 - (mouseY / rect.height);
            val = Math.max(0, ratio * maxV);
        }

        const V_user = new Float64Array(state.V);

        if (lastDrawGridIdx === null) {
            V_user[j] = val;
        } else {
            // Linear interpolation to prevent mouse skip gaps
            const steps = Math.abs(j - lastDrawGridIdx);
            const startIdx = Math.min(j, lastDrawGridIdx);
            const endIdx = Math.max(j, lastDrawGridIdx);
            const startVal = j < lastDrawGridIdx ? val : lastDrawVal;
            const endVal = j < lastDrawGridIdx ? lastDrawVal : val;

            for (let i = startIdx; i <= endIdx; i++) {
                const t = steps > 0 ? (i - startIdx) / steps : 0;
                V_user[i] = startVal + t * (endVal - startVal);
            }
        }

        lastDrawGridIdx = j;
        lastDrawVal = val;

        QuantumSolver.setV(V_user);
        updateVisuals();
    }

    /**
     * Apply Gaussian Smoothing to user barrier to avoid numerical step ringing
     */
    function applyGaussianSmoothing() {
        // Skip smoothing for Infinite well or delta function presets (Chapter 2, 7)
        if (currentChapter === 2 || currentChapter === 7) return;

        const state = QuantumSolver.getState();
        const N = state.N;
        const V_user = new Float64Array(state.V);
        const V_smooth = new Float64Array(N);

        const sigmaS = 1.6; // Gaussian smoothing kernel sigma (indices)
        const K = Math.ceil(3 * sigmaS);

        for (let j = 0; j < N; j++) {
            let weightSum = 0;
            let valSum = 0;
            for (let k = -K; k <= K; k++) {
                const idx = j + k;
                if (idx >= 0 && idx < N) {
                    const weight = Math.exp(-(k * k) / (2 * sigmaS * sigmaS));
                    valSum += V_user[idx] * weight;
                    weightSum += weight;
                }
            }
            V_smooth[j] = valSum / weightSum;
        }

        QuantumSolver.setV(V_smooth);
        updateVisuals();
    }

    // --- CHAPTERS / QUEST LOADING ENGINE ---
    function loadChapter(ch) {
        currentChapter = ch;
        isRunning = false;
        btnPlayPause.textContent = "▶ Play";
        btnPlayPause.classList.remove("running");
        computedEigenstates = [];

        // Clear active stats
        questStates.tomographyMeasurements = [];
        questStates.tomographyCount = 0;
        questStates.stationaryStableFrames = 0;
        questStates.lastProbProfile = null;
        questStates.leftAbsorbedNorm = 0.0;

        // Visual highlights of active quest buttons
        document.querySelectorAll(".quest-tab-btn").forEach((btn) => {
            btn.classList.remove("active");
            const btnCh = parseInt(btn.getAttribute("data-chapter"));
            if (questCompletion[btnCh]) {
                btn.classList.add("completed");
            } else {
                btn.classList.remove("completed");
            }
        });
        document.getElementById(`tab-ch-${ch}`).classList.add("active");

        // Clear toolbar sliders
        slidersContainer.innerHTML = "";

        const state = QuantumSolver.getState();
        const N = state.N;
        const xArr = state.x;
        const V_new = new Float64Array(N);
        let newRe = new Float64Array(N);
        let newIm = new Float64Array(N);

        // Render toolbar drawing active/inactive states
        chkAutoSmooth.disabled = (ch === 2 || ch === 7);

        // Load Quest setups
        switch (ch) {
            case 1: // Dispersion Quest
                initGaussianWavepacket(xArr, -25, 2.5, 2.0, newRe, newIm);
                QuantumSolver.setPsi(newRe, newIm);
                QuantumSolver.setV(V_new);
                setupChapter1Controls();
                break;

            case 2: // Quantization Infinite Box
                // Tall walls at x = -15 and x = +15 (Infinite well)
                for (let j = 0; j < N; j++) {
                    if (xArr[j] < -15 || xArr[j] > 15) {
                        V_new[j] = 80.0; // Infinite wall approximation
                    }
                }
                initGaussianWavepacket(xArr, -8, 2.0, 1.8, newRe, newIm);
                QuantumSolver.setPsi(newRe, newIm);
                QuantumSolver.setV(V_new);
                setupChapter2Controls();
                break;

            case 3: // Tunneling
                // Rectangular barrier in middle
                const bHeight = 16.0;
                const bWidth = 2.5; // x from -1.25 to 1.25
                for (let j = 0; j < N; j++) {
                    if (Math.abs(xArr[j]) < bWidth / 2) {
                        V_new[j] = bHeight;
                    }
                }
                // Prepare incident wavepacket at E = 12.0
                // energy E = k0^2/2 -> k0 = Math.sqrt(2 * E) = Math.sqrt(24) = 4.90
                initGaussianWavepacket(xArr, -22, 4.90, 2.5, newRe, newIm);
                QuantumSolver.setPsi(newRe, newIm);
                QuantumSolver.setV(V_new);
                
                // Track initial norm for exact T calculation
                questStates.initialNorm = QuantumSolver.getNorm();
                setupChapter3Controls();
                break;

            case 4: // Custom Sculptor
                initGaussianWavepacket(xArr, -15, 1.8, 2.0, newRe, newIm);
                QuantumSolver.setPsi(newRe, newIm);
                QuantumSolver.setV(V_new);
                setupChapter4Controls();
                break;

            case 5: // Superposition & Beats
                // Load Infinite Box setup and compute eigenstates
                for (let j = 0; j < N; j++) {
                    if (xArr[j] < -15 || xArr[j] > 15) {
                        V_new[j] = 80.0;
                    }
                }
                QuantumSolver.setV(V_new);
                
                // Instantly precompute first three states
                computeInfiniteWellEigenstates();
                
                // Load superposition mix
                mixEigenstates(0, 1, 0.5); // Equal mix (angle = 45 degrees)
                setupChapter5Controls();
                break;

            case 6: // Harmonic Oscillator Coherent
                // V = 0.5 * k * x^2, omega = 0.4
                // V = 0.5 * (omega^2) * x^2 = 0.5 * 0.16 * x^2 = 0.08 * x^2
                for (let j = 0; j < N; j++) {
                    V_new[j] = 0.08 * xArr[j] * xArr[j];
                }
                QuantumSolver.setV(V_new);
                // Load coherent state (shifted Gaussian)
                initGaussianWavepacket(xArr, -10, 0.0, 1.58, newRe, newIm); // HO ground state width sigma = 1/sqrt(omega) = 1.58
                QuantumSolver.setPsi(newRe, newIm);
                setupChapter6Controls();
                break;

            case 7: // Born Rule Measurement
                // Superposition of HO ground + 2nd excited state
                for (let j = 0; j < N; j++) {
                    V_new[j] = 0.08 * xArr[j] * xArr[j];
                }
                QuantumSolver.setV(V_new);
                computeInfiniteWellEigenstates(); // reuse solver to find HO states
                mixEigenstates(0, 2, 0.6); // mix HO E0 and E2
                setupChapter7Controls();
                break;

            case 8: // Double Well
                // Double well V = a * (x^2 - b^2)^2
                // Symmetric double well wells at x = -6 and x = +6
                const sepB = 6.0;
                const barrierA = 0.007; // Barrier height ~ a * b^4 = 0.007 * 1296 = 9.0
                for (let j = 0; j < N; j++) {
                    V_new[j] = barrierA * Math.pow(xArr[j] * xArr[j] - sepB * sepB, 2);
                }
                QuantumSolver.setV(V_new);
                computeDoubleWellEigenstates();
                // Load wavepacket localized inside the left well (mix of symmetric and antisymmetric states)
                mixEigenstates(0, 1, 0.5); // Equal mix creates packet localized in left well
                setupChapter8Controls();
                break;
        }

        updateBriefingBox(ch);
        updateVisuals();
    }

    /**
     * Compute minimum-uncertainty Gaussian wavepacket
     */
    function initGaussianWavepacket(xGrid, x0, k0, sigma, re, im) {
        const norm = Math.pow(1.0 / (2 * Math.PI * sigma * sigma), 0.25);
        for (let j = 0; j < xGrid.length; j++) {
            const dxVal = xGrid[j] - x0;
            const gauss = norm * Math.exp(-dxVal * dxVal / (4 * sigma * sigma));
            re[j] = gauss * Math.cos(k0 * dxVal);
            im[j] = gauss * Math.sin(k0 * dxVal);
        }
    }

    // --- RENDER CONTROLS HELPERS ---
    function setupChapter1Controls() {
        createSlider("sigma", "Wave Width (σ)", 0.8, 4.5, 0.1, 2.0, (val) => {
            const state = QuantumSolver.getState();
            const re = new Float64Array(state.N);
            const im = new Float64Array(state.N);
            const currentK = parseFloat(document.getElementById("slider-k0").value);
            initGaussianWavepacket(state.x, -25, currentK, val, re, im);
            QuantumSolver.setPsi(re, im);
            updateVisuals();
        });

        createSlider("k0", "Momentum (k₀)", 0.5, 4.0, 0.1, 2.5, (val) => {
            const state = QuantumSolver.getState();
            const re = new Float64Array(state.N);
            const im = new Float64Array(state.N);
            const currentSigma = parseFloat(document.getElementById("slider-sigma").value);
            initGaussianWavepacket(state.x, -25, val, currentSigma, re, im);
            QuantumSolver.setPsi(re, im);
            updateVisuals();
        });
    }

    function setupChapter2Controls() {
        createButton("btn-solve-ite", "⚡ Solve Bound States", () => {
            runITESolver(3); // find 3 states
        });
    }

    function setupChapter3Controls() {
        createSlider("b-width", "Barrier Width", 1.0, 5.0, 0.2, 2.4, (val) => {
            rebuildTunnelingBarrier(val, parseFloat(document.getElementById("slider-b-height").value));
        });
        createSlider("b-height", "Barrier Height", 8.0, 24.0, 0.5, 16.0, (val) => {
            rebuildTunnelingBarrier(parseFloat(document.getElementById("slider-b-width").value), val);
        });
    }

    function rebuildTunnelingBarrier(w, h) {
        const state = QuantumSolver.getState();
        const V = new Float64Array(state.N);
        for (let j = 0; j < state.N; j++) {
            if (Math.abs(state.x[j]) < w / 2) {
                V[j] = h;
            }
        }
        QuantumSolver.setV(V);
        
        // Reset wavepacket position
        const re = new Float64Array(state.N);
        const im = new Float64Array(state.N);
        initGaussianWavepacket(state.x, -22, 4.90, 2.5, re, im);
        QuantumSolver.setPsi(re, im);
        
        questStates.initialNorm = QuantumSolver.getNorm();
        questStates.leftAbsorbedNorm = 0.0;
        updateVisuals();
    }

    function setupChapter4Controls() {
        createButton("btn-solve-ite-custom", "⚡ Solve Energy Levels", () => {
            runITESolver(4);
        });
    }

    function setupChapter5Controls() {
        createSlider("mix", "E₁ / E₂ Mix ratio", 0.0, 1.0, 0.05, 0.5, (val) => {
            mixEigenstates(0, 1, val);
            updateVisuals();
        });
    }

    function setupChapter6Controls() {
        createSlider("h-offset", "Displacement Offset", 0.0, 12.0, 0.2, 10.0, (val) => {
            const state = QuantumSolver.getState();
            const re = new Float64Array(state.N);
            const im = new Float64Array(state.N);
            initGaussianWavepacket(state.x, -val, 0.0, 1.58, re, im);
            QuantumSolver.setPsi(re, im);
            updateVisuals();
        });
    }

    function setupChapter7Controls() {
        createButton("btn-measure", "🎯 Measure Position", () => {
            isRunning = false;
            btnPlayPause.textContent = "▶ Play";
            btnPlayPause.classList.remove("running");
            
            const collapseResult = QuantumSolver.measure();
            QuantumRenderer.triggerCollapseFX();
            
            questStates.tomographyMeasurements.push(collapseResult.xMeas);
            questStates.tomographyCount++;
            
            updateVisuals();
        });

        createButton("btn-tomography", "📊 Tomography Scanner (100x)", async () => {
            isRunning = false;
            btnPlayPause.textContent = "▶ Play";
            btnPlayPause.classList.remove("running");

            // Preparations
            const state = QuantumSolver.getState();
            const origRe = new Float64Array(state.psi_re);
            const origIm = new Float64Array(state.psi_im);

            // Execute 100 random collapses of prepared state
            for (let i = 0; i < 100; i++) {
                QuantumSolver.setPsi(origRe, origIm);
                const result = QuantumSolver.measure();
                questStates.tomographyMeasurements.push(result.xMeas);
                questStates.tomographyCount++;
            }

            // Restore starting state
            QuantumSolver.setPsi(origRe, origIm);
            QuantumRenderer.triggerCollapseFX();
            updateVisuals();
        });
    }

    function setupChapter8Controls() {
        createSlider("dw-width", "Well Separation", 4.0, 8.0, 0.2, 6.0, (val) => {
            rebuildDoubleWell(val, parseFloat(document.getElementById("slider-dw-height").value));
        });
        createSlider("dw-height", "Barrier Height", 6.0, 15.0, 0.5, 9.0, (val) => {
            rebuildDoubleWell(parseFloat(document.getElementById("slider-dw-width").value), val);
        });
    }

    function rebuildDoubleWell(b, V0) {
        const state = QuantumSolver.getState();
        const V = new Float64Array(state.N);
        const a = V0 / Math.pow(b, 4); // a * b^4 = V0
        for (let j = 0; j < state.N; j++) {
            V[j] = a * Math.pow(state.x[j] * state.x[j] - b * b, 2);
        }
        QuantumSolver.setV(V);
        computeDoubleWellEigenstates();
        mixEigenstates(0, 1, 0.5);
        updateVisuals();
    }

    // --- CORE EIGENSTATE SOLVERS ---
    function runITESolver(numStates = 3) {
        const state = QuantumSolver.getState();
        const N = state.N;

        computedEigenstates = [];

        // Temporary array for initial trial wavefunctions
        const trialRe = new Float64Array(N);

        for (let n = 0; n < numStates; n++) {
            // Initialize trial wavefunction with nodes
            const freq = (n + 1) * Math.PI / 30;
            for (let j = 0; j < N; j++) {
                if (state.x[j] > -15 && state.x[j] < 15) {
                    trialRe[j] = Math.sin(freq * (state.x[j] + 15));
                } else {
                    trialRe[j] = 0;
                }
            }

            // Load trial state
            QuantumSolver.setPsi(trialRe, new Float64Array(N));

            // Run ITE iterations
            const steps = 180;
            const dtau = 0.05;
            for (let stepIdx = 0; stepIdx < steps; stepIdx++) {
                QuantumSolver.stepITE(1, dtau, computedEigenstates);
            }

            // Save converged state
            const stateResult = QuantumSolver.getState();
            const copyRe = new Float64Array(stateResult.psi_re);
            const energy = QuantumSolver.computeEnergy();

            computedEigenstates.push({
                energy: energy,
                psi_re: copyRe
            });
        }

        // Restore active state to ground state
        QuantumSolver.setPsi(computedEigenstates[0].psi_re, new Float64Array(N));
        updateVisuals();
    }

    function computeInfiniteWellEigenstates() {
        // Pre-solve for Chapter 5/7 quickly
        const state = QuantumSolver.getState();
        const N = state.N;
        computedEigenstates = [];

        for (let n = 0; n < 3; n++) {
            const trialRe = new Float64Array(N);
            const freq = (n + 1) * Math.PI / 30;
            for (let j = 0; j < N; j++) {
                if (state.x[j] > -15 && state.x[j] < 15) {
                    trialRe[j] = Math.sin(freq * (state.x[j] + 15));
                } else {
                    trialRe[j] = 0;
                }
            }
            QuantumSolver.setPsi(trialRe, new Float64Array(N));
            for (let i = 0; i < 200; i++) {
                QuantumSolver.stepITE(1, 0.05, computedEigenstates);
            }
            const stateResult = QuantumSolver.getState();
            computedEigenstates.push({
                energy: QuantumSolver.computeEnergy(),
                psi_re: new Float64Array(stateResult.psi_re)
            });
        }
    }

    function computeDoubleWellEigenstates() {
        const state = QuantumSolver.getState();
        const N = state.N;
        computedEigenstates = [];

        // 1. Ground state E0 (symmetric)
        const trialE0 = new Float64Array(N);
        for (let j = 0; j < N; j++) {
            trialE0[j] = Math.exp(-Math.pow(state.x[j] - 6, 2) / 8) + Math.exp(-Math.pow(state.x[j] + 6, 2) / 8);
        }
        QuantumSolver.setPsi(trialE0, new Float64Array(N));
        for (let i = 0; i < 240; i++) {
            QuantumSolver.stepITE(1, 0.05, computedEigenstates);
        }
        const stateR0 = QuantumSolver.getState();
        computedEigenstates.push({
            energy: QuantumSolver.computeEnergy(),
            psi_re: new Float64Array(stateR0.psi_re)
        });

        // 2. First excited state E1 (antisymmetric)
        const trialE1 = new Float64Array(N);
        for (let j = 0; j < N; j++) {
            trialE1[j] = Math.exp(-Math.pow(state.x[j] - 6, 2) / 8) - Math.exp(-Math.pow(state.x[j] + 6, 2) / 8);
        }
        QuantumSolver.setPsi(trialE1, new Float64Array(N));
        for (let i = 0; i < 240; i++) {
            QuantumSolver.stepITE(1, 0.05, computedEigenstates);
        }
        const stateR1 = QuantumSolver.getState();
        computedEigenstates.push({
            energy: QuantumSolver.computeEnergy(),
            psi_re: new Float64Array(stateR1.psi_re)
        });
    }

    /**
     * Mix two energy eigenstates with amplitude ratio (mixing slider value)
     */
    function mixEigenstates(idxA, idxB, sliderRatio) {
        if (computedEigenstates.length <= Math.max(idxA, idxB)) return;

        const state = QuantumSolver.getState();
        const N = state.N;

        const theta = sliderRatio * Math.PI / 2; // 0 to 90 degrees
        const cA = Math.cos(theta);
        const cB = Math.sin(theta);

        const newRe = new Float64Array(N);
        const newIm = new Float64Array(N);

        const psiA = computedEigenstates[idxA].psi_re;
        const psiB = computedEigenstates[idxB].psi_re;

        for (let j = 0; j < N; j++) {
            newRe[j] = cA * psiA[j] + cB * psiB[j];
            newIm[j] = 0; // Starts real
        }

        QuantumSolver.setPsi(newRe, newIm);
    }

    // --- TOOLBAR HTML GENERATORS ---
    function createSlider(id, label, min, max, step, val, callback) {
        const wrapper = document.createElement("div");
        wrapper.className = "tool-group";
        wrapper.style.gap = "0.35rem";
        wrapper.style.fontSize = "0.75rem";
        wrapper.style.color = "#FFFFFF";

        const lbl = document.createElement("label");
        lbl.setAttribute("for", `slider-${id}`);
        lbl.textContent = label + ":";

        const slider = document.createElement("input");
        slider.type = "range";
        slider.id = `slider-${id}`;
        slider.min = min;
        slider.max = max;
        slider.step = step;
        slider.value = val;

        const readout = document.createElement("span");
        readout.style.fontFamily = "monospace";
        readout.style.fontSize = "0.75rem";
        readout.textContent = parseFloat(val).toFixed(2);

        slider.addEventListener("input", (e) => {
            const v = parseFloat(e.target.value);
            readout.textContent = v.toFixed(2);
            callback(v);
        });

        wrapper.appendChild(lbl);
        wrapper.appendChild(slider);
        wrapper.appendChild(readout);
        slidersContainer.appendChild(wrapper);
    }

    function createButton(id, text, callback) {
        const btn = document.createElement("button");
        btn.className = "tool-btn";
        btn.id = id;
        btn.textContent = text;
        btn.style.marginLeft = "0.5rem";
        slidersContainer.appendChild(btn);
    }

    // --- DYNAMIC BRIEFINGS & ACCORDIONS ---
    function updateBriefingBox(ch) {
        let content = "";
        
        switch (ch) {
            case 1:
                content = `
                    <h3 class="quest-title">1. The Spreading Wave</h3>
                    <p>Unlike classical billiard balls, a localized quantum particle is represented by a wavepacket. Over time, this wavepacket naturally disperses in empty space.</p>
                    <p>A narrow wavepacket starts with high position precision, but the uncertainty principle dictates it must possess a wide spread of momentum velocities, causing it to disperse rapidly.</p>
                    <div class="quest-objective-box">
                        <div class="quest-objective-title">🎯 Quest Objective</div>
                        <ul class="quest-checklist">
                            <li>
                                <span class="quest-check pending" id="chk-q1-cross">⬡</span>
                                Coordinate the momentum \(k_0\) and width \(\sigma\) to reach the detector post at \(x = 30\) with peak probability \(|\psi|^2 \ge 0.2\).
                            </li>
                        </ul>
                    </div>
                    <div class="math-disclosure">
                        <button class="math-disclosure-btn" onclick="toggleMathAccordion(this)">▶ Show the equations</button>
                        <div class="math-disclosure-content">
                            <p>Free space dispersion of Gaussian wavepacket width over time:</p>
                            <p>\[\sigma(t) = \sigma(0) \sqrt{ 1 + \left( \frac{\hbar t}{2 m \sigma(0)^2} \right)^2 }\]</p>
                        </div>
                    </div>
                `;
                break;

            case 2:
                content = `
                    <h3 class="quest-title">2. Standing Wave Capture</h3>
                    <p>When confined between boundary walls, waves reflect and interfere. Only specific wavelengths can constructively persist without canceling themselves out.</p>
                    <p>These persistent waves are bound energy eigenstates. While their phase oscillates, their probability density \(|\psi(x)|^2\) remains completely stationary in space.</p>
                    <div class="quest-objective-box">
                        <div class="quest-objective-title">🎯 Quest Objective</div>
                        <ul class="quest-checklist">
                            <li>
                                <span class="quest-check pending" id="chk-q2-solve">⬡</span>
                                Run the Eigenstate solver, select and load one of the energy levels, and verify that its spatial shape stays stationary when Play is running.
                            </li>
                        </ul>
                    </div>
                    <div class="math-disclosure">
                        <button class="math-disclosure-btn" onclick="toggleMathAccordion(this)">▶ Show the equations</button>
                        <div class="math-disclosure-content">
                            <p>Quantized energy levels of an infinite square well of width \(L\):</p>
                            <p>\[E_n = \frac{n^2 \pi^2 \hbar^2}{2 m L^2}\]</p>
                            <p>Eigenstate time evolution is a pure phase shift: \(\psi_n(x,t) = \phi_n(x) e^{-i E_n t/\hbar}\), leaving \(|\psi_n|^2 = |\phi_n|^2\) static.</p>
                        </div>
                    </div>
                `;
                break;

            case 3:
                content = `
                    <h3 class="quest-title">3. The Ghost in the Wall</h3>
                    <p>In classical physics, a ball cannot pass through a wall taller than its kinetic energy. In quantum mechanics, the wavefunction decays exponentially inside a barrier but can leak through on the other side.</p>
                    <p>This is **Quantum Tunneling**. The probability of escape decreases exponentially with barrier width.</p>
                    <div class="quest-objective-box">
                        <div class="quest-objective-title">🎯 Quest Objective</div>
                        <ul class="quest-checklist">
                            <li>
                                <span class="quest-check pending" id="chk-q3-target">⬡</span>
                                Adjust the barrier width and height until the transmission coefficient \(T\) is exactly \(20\%\) (±0.5%) for a packet of incident energy \(E = 12.0\).
                            </li>
                        </ul>
                    </div>
                    <div class="math-disclosure">
                        <button class="math-disclosure-btn" onclick="toggleMathAccordion(this)">▶ Show the equations</button>
                        <div class="math-disclosure-content">
                            <p>Evanescent decay wavenumber inside a barrier \[V_0 > E\]:</p>
                            <p>\[\kappa = \frac{\sqrt{2m(V_0 - E)}}{\hbar}\]</p>
                            <p>Transmission scales exponentially as \(T \propto e^{-2\kappa d}\) where \(d\) is barrier thickness.</p>
                        </div>
                    </div>
                `;
                break;

            case 4:
                content = `
                    <h3 class="quest-title">4. The Potential Sculptor</h3>
                    <p>Quantum systems are customized by designing potentials. By dragging your mouse across the canvas, you can sketch arbitrary potential shapes.</p>
                    <p>A deeper and wider well supports more bound states, while squeezing the boundaries pushes the states upwards and out of the well.</p>
                    <div class="quest-objective-box">
                        <div class="quest-objective-title">🎯 Quest Objective</div>
                        <ul class="quest-checklist">
                            <li>
                                <span class="quest-check pending" id="chk-q4-sculpt">⬡</span>
                                Draw a custom potential well (use Erase/Clear as needed) that holds **exactly three** bound energy levels below \(E = 10.0\).
                            </li>
                        </ul>
                    </div>
                    <div class="math-disclosure">
                        <button class="math-disclosure-btn" onclick="toggleMathAccordion(this)">▶ Show the equations</button>
                        <div class="math-disclosure-content">
                            <p>Energy eigenvalues \(E_n\) are solutions to the time-independent Schrödinger Equation boundary value problem:</p>
                            <p>\[\hat{H} \phi_n(x) = E_n \phi_n(x)\]</p>
                        </div>
                    </div>
                `;
                break;

            case 5:
                content = `
                    <h3 class="quest-title">5. The Bohr Beat</h3>
                    <p>A quantum state is not limited to a single energy level. It can exist in a superposition of multiple eigenstates simultaneously.</p>
                    <p>When states with different energies interfere, the probability density oscillates back and forth at the Bohr frequency.</p>
                    <div class="quest-objective-box">
                        <div class="quest-objective-title">🎯 Quest Objective</div>
                        <ul class="quest-checklist">
                            <li>
                                <span class="quest-check pending" id="chk-q5-mix">⬡</span>
                                Mix the states \(E_1\) and \(E_2\) in the slider (between \(30\%\) and \(70\%\)) and press Play to witness the wavefunction beating.
                            </li>
                        </ul>
                    </div>
                    <div class="math-disclosure">
                        <button class="math-disclosure-btn" onclick="toggleMathAccordion(this)">▶ Show the equations</button>
                        <div class="math-disclosure-content">
                            <p>Probability density of mixed states \(\psi_1\) and \(\psi_2\):</p>
                            <p>\[|\psi|^2 = |c_1|^2|\phi_1|^2 + |c_2|^2|\phi_2|^2 + 2 c_1 c_2 \phi_1 \phi_2 \cos(\omega_{12} t)\]</p>
                            <p>The beat frequency is the Bohr frequency: \(\omega_{12} = (E_2 - E_1)/\hbar\).</p>
                        </div>
                    </div>
                `;
                break;

            case 6:
                content = `
                    <h3 class="quest-title">6. Spring Mimicry</h3>
                    <p>For most potential wells, a wavepacket disperses rapidly. The Harmonic Oscillator (\(V = \frac{1}{2} k x^2\)) is a beautiful exception.</p>
                    <p>A displaced Gaussian packet of specific width behaves as a **Coherent State**. It oscillates back and forth without any spreading, mirroring classical physics.</p>
                    <div class="quest-objective-box">
                        <div class="quest-objective-title">🎯 Quest Objective</div>
                        <ul class="quest-checklist">
                            <li>
                                <span class="quest-check pending" id="chk-q6-spring">⬡</span>
                                Displace the coherent packet, press Play, and observe it bounce. Verify that the packet width does not spread over time.
                            </li>
                        </ul>
                    </div>
                    <div class="math-disclosure">
                        <button class="math-disclosure-btn" onclick="toggleMathAccordion(this)">▶ Show the equations</button>
                        <div class="math-disclosure-content">
                            <p>Coherent state displacement and classical trajectory center:</p>
                            <p>\[\langle x(t) \rangle = A \cos(\omega t)\]</p>
                            <p>\[\Delta x(t) = \sqrt{\frac{\hbar}{2m\omega}} = \text{Constant}\]</p>
                        </div>
                    </div>
                `;
                break;

            case 7:
                content = `
                    <h3 class="quest-title">7. The Born Rule</h3>
                    <p>According to quantum mechanics, measuring a particle's position forces the wave to instantly collapse to a localized point.</p>
                    <p>Individual measurements are random. However, repeating measurements preparatorily compiles a histogram that matches the \(|\psi|^2\) probability curve.</p>
                    <div class="quest-objective-box">
                        <div class="quest-objective-title">🎯 Quest Objective</div>
                        <ul class="quest-checklist">
                            <li>
                                <span class="quest-check pending" id="chk-q7-tomo">⬡</span>
                                Measure the wave or trigger the Tomography Scanner to compile **100 measurements** and reconstruct the wave profile.
                            </li>
                        </ul>
                    </div>
                    <div class="math-disclosure">
                        <button class="math-disclosure-btn" onclick="toggleMathAccordion(this)">▶ Show the equations</button>
                        <div class="math-disclosure-content">
                            <p>Born's Rule for discrete grids:</p>
                            <p>\[P(x_j) = |\psi(x_j)|^2 \Delta x\]</p>
                            <p>Post-measurement collapse to position eigenstate: \(\psi(x) \to \delta(x - x_\text{meas})\).</p>
                        </div>
                    </div>
                `;
                break;

            case 8:
                content = `
                    <h3 class="quest-title">8. Covalent Locking</h3>
                    <p>In a symmetric double well, the ground state divides into a symmetric (bonding) and antisymmetric (antibonding) state.</p>
                    <p>A particle initialized in the left well will slowly tunnel through the barrier to the right well, oscillating back and forth at the tunneling splitting frequency.</p>
                    <div class="quest-objective-box">
                        <div class="quest-objective-title">🎯 Quest Objective</div>
                        <ul class="quest-checklist">
                            <li>
                                <span class="quest-check pending" id="chk-q8-dw">⬡</span>
                                Observe the particle tunnel completely from the left well into the right well. Record the oscillation period.
                            </li>
                        </ul>
                    </div>
                    <div class="math-disclosure">
                        <button class="math-disclosure-btn" onclick="toggleMathAccordion(this)">▶ Show the equations</button>
                        <div class="math-disclosure-content">
                            <p>Energy splitting between symmetric (\(E_1\)) and antisymmetric (\(E_2\)) states:</p>
                            <p>\[\Delta E = E_2 - E_1\]</p>
                            <p>Tunneling oscillation period: \(T_\text{tunnel} = 2\pi / \Delta E\).</p>
                        </div>
                    </div>
                `;
                break;
        }

        questBriefingBox.innerHTML = content;
        
        // Re-inject KaTeX math formatting if available
        if (window.MathJax) {
            MathJax.typesetPromise();
        }
    }

    // Export toggle helper to window scope for inline HTML callbacks
    window.toggleMathAccordion = (btn) => {
        const content = btn.nextElementSibling;
        if (content.style.display === "block") {
            content.style.display = "none";
            btn.textContent = "▶ Show the equations";
        } else {
            content.style.display = "block";
            btn.textContent = "▼ Hide the equations";
            if (window.MathJax) {
                MathJax.typesetPromise();
            }
        }
    };

    function getCheckIdForChapter(ch) {
        const ids = {
            1: "chk-q1-cross",
            2: "chk-q2-solve",
            3: "chk-q3-target",
            4: "chk-q4-sculpt",
            5: "chk-q5-mix",
            6: "chk-q6-spring",
            7: "chk-q7-tomo",
            8: "chk-q8-dw"
        };
        return ids[ch];
    }

    // --- GAMEPLAY VALIDATION LOGIC ---
    function validateObjectives(state) {
        const checkId = getCheckIdForChapter(currentChapter);
        const check = document.getElementById(checkId);
        
        if (questCompletion[currentChapter]) {
            if (check) {
                check.textContent = "⬢";
                check.className = "quest-check success";
            }
            return;
        }

        const check1 = document.getElementById("chk-q1-cross");
        const check2 = document.getElementById("chk-q2-solve");
        const check3 = document.getElementById("chk-q3-target");
        const check4 = document.getElementById("chk-q4-sculpt");
        const check5 = document.getElementById("chk-q5-mix");
        const check6 = document.getElementById("chk-q6-spring");
        const check7 = document.getElementById("chk-q7-tomo");
        const check8 = document.getElementById("chk-q8-dw");

        switch (currentChapter) {
            case 1:
                if (!check1) return;
                // Find wave peak
                let maxProb = 0;
                let maxIdx = 0;
                for (let j = 0; j < state.N; j++) {
                    const p = state.psi_re[j] * state.psi_re[j] + state.psi_im[j] * state.psi_im[j];
                    if (p > maxProb) {
                        maxProb = p;
                        maxIdx = j;
                    }
                }
                const peakX = state.x[maxIdx];
                if (peakX >= 30 && maxProb >= 0.2) {
                    check1.textContent = "⬢";
                    check1.className = "quest-check success";
                    questCompletion[1] = true;
                    document.getElementById("tab-ch-1").classList.add("completed");
                }
                break;

            case 2:
                if (!check2) return;
                // Verify loaded state stays stationary
                if (computedEigenstates.length > 0) {
                    const prob = new Float64Array(state.N);
                    let diff = 0;
                    for (let j = 0; j < state.N; j++) {
                        prob[j] = state.psi_re[j] * state.psi_re[j] + state.psi_im[j] * state.psi_im[j];
                    }
                    if (questStates.lastProbProfile !== null) {
                        for (let j = 0; j < state.N; j++) {
                            diff += Math.abs(prob[j] - questStates.lastProbProfile[j]);
                        }
                        if (diff < 1e-4 && isRunning) {
                            questStates.stationaryStableFrames++;
                        } else {
                            questStates.stationaryStableFrames = 0;
                        }
                    }
                    questStates.lastProbProfile = prob;

                    if (questStates.stationaryStableFrames > 90) { // held still for 90 frames
                        check2.textContent = "⬢";
                        check2.className = "quest-check success";
                        questCompletion[2] = true;
                        document.getElementById("tab-ch-2").classList.add("completed");
                    }
                }
                break;

            case 3:
                if (!check3) return;
                // Tunneling Transmission Coefficient T calculation
                // Integrate right physical region (x > 5)
                let rightNorm = 0;
                for (let j = 0; j < state.N; j++) {
                    if (state.x[j] > 2.5) { // right side of barrier
                        rightNorm += (state.psi_re[j] * state.psi_re[j] + state.psi_im[j] * state.psi_im[j]);
                    }
                }
                rightNorm *= state.dx;

                // T = norm_on_right / initial_norm
                const T = rightNorm / questStates.initialNorm;

                // Quest objective: T is exactly 20% (±0.8%)
                if (T >= 0.192 && T <= 0.208) {
                    check3.textContent = "⬢";
                    check3.className = "quest-check success";
                    questCompletion[3] = true;
                    document.getElementById("tab-ch-3").classList.add("completed");
                }
                break;

            case 4:
                if (!check4) return;
                // User drawn potential with exactly 3 bound states
                if (computedEigenstates.length === 3) {
                    let allBelowTen = true;
                    computedEigenstates.forEach((eig) => {
                        if (eig.energy >= 10.0) allBelowTen = false;
                    });
                    if (allBelowTen) {
                        check4.textContent = "⬢";
                        check4.className = "quest-check success";
                        questCompletion[4] = true;
                        document.getElementById("tab-ch-4").classList.add("completed");
                    }
                }
                break;

            case 5:
                if (!check5) return;
                const mixSliderVal = parseFloat(document.getElementById("slider-mix").value);
                if (mixSliderVal >= 0.28 && mixSliderVal <= 0.72 && isRunning) {
                    check5.textContent = "⬢";
                    check5.className = "quest-check success";
                    questCompletion[5] = true;
                    document.getElementById("tab-ch-5").classList.add("completed");
                }
                break;

            case 6:
                if (!check6) return;
                const displacementVal = parseFloat(document.getElementById("slider-h-offset").value);
                if (displacementVal >= 5.0 && isRunning) {
                    check6.textContent = "⬢";
                    check6.className = "quest-check success";
                    questCompletion[6] = true;
                    document.getElementById("tab-ch-6").classList.add("completed");
                }
                break;

            case 7:
                if (!check7) return;
                if (questStates.tomographyCount >= 100) {
                    check7.textContent = "⬢";
                    check7.className = "quest-check success";
                    questCompletion[7] = true;
                    document.getElementById("tab-ch-7").classList.add("completed");
                }
                break;

            case 8:
                if (!check8) return;
                // Tunneling from left to right double well
                let leftWellNorm = 0;
                for (let j = 0; j < state.N; j++) {
                    if (state.x[j] < 0) {
                        leftWellNorm += (state.psi_re[j] * state.psi_re[j] + state.psi_im[j] * state.psi_im[j]);
                    }
                }
                leftWellNorm *= state.dx;

                // If wave shifted from left to right (norm in left well drops below 0.15)
                if (leftWellNorm < 0.15 && isRunning) {
                    check8.textContent = "⬢";
                    check8.className = "quest-check success";
                    questCompletion[8] = true;
                    document.getElementById("tab-ch-8").classList.add("completed");
                }
                break;
        }
    }

    // --- ANIMATION GAME LOOP ---
    function tick() {
        if (isRunning) {
            // Real-Time Evolution split-operator steps
            QuantumSolver.step(stepsPerFrame);
        }

        updateVisuals();

        // Run validation checks
        const state = QuantumSolver.getState();
        validateObjectives(state);

        requestAnimationFrame(tick);
    }

    function updateVisuals() {
        const state = QuantumSolver.getState();
        const probK = QuantumSolver.getMomentum();
        const uncertainty = QuantumSolver.computeUncertainty();

        // Wave scale configurations per Chapter
        let probScale = 220;
        let waveScale = 120;
        if (currentChapter === 7) {
            probScale = 150;
            waveScale = 90;
        }

        // Render Canvases
        QuantumRenderer.render(state, {
            showReal: chkShowReal.checked,
            showImag: chkShowImag.checked,
            showProb: chkShowProb.checked,
            showPhase: chkShowPhase.checked,
            probScale: probScale,
            waveScale: waveScale,
            activeChapter: currentChapter,
            eigenstates: computedEigenstates,
            maxDisplayV: 22.0
        });

        QuantumRenderer.renderMomentum(probK, state);
        QuantumRenderer.renderUncertainty(uncertainty.dx, uncertainty.dp);
        QuantumRenderer.updateHUD(uncertainty);

        // --- BORN TOMOGRAPHY OVERLAY ---
        if (currentChapter === 7 && questStates.tomographyMeasurements.length > 0) {
            drawTomographyHistogram(state);
        }

        // --- ROTATING BOHR PHASE NEEDLE ---
        rotatePhaseNeedle(state);
    }

    /**
     * Reconstruct and draw the collapse measurements histogram
     */
    function drawTomographyHistogram(state) {
        const ctx = mainCanvas.getContext("2d");
        const w = mainCanvas.width;
        const h = mainCanvas.height;

        const xMin = state.x[0];
        const xMax = state.x[state.N - 1];

        // Grid coordinates X
        function getX(valX) {
            return ((valX - xMin) / (xMax - xMin)) * w;
        }

        // Bucket sizes
        const binCount = 36;
        const bins = new Array(binCount).fill(0);
        const binW = (xMax - xMin) / binCount;

        questStates.tomographyMeasurements.forEach((valX) => {
            const binIdx = Math.max(0, Math.min(binCount - 1, Math.floor((valX - xMin) / binW)));
            bins[binIdx]++;
        });

        // Draw histogram bars
        ctx.fillStyle = "rgba(0, 255, 213, 0.15)";
        ctx.strokeStyle = "rgba(0, 255, 213, 0.5)";
        ctx.lineWidth = 1.0;

        const maxBinHeight = Math.max(...bins);
        const yBaseline = h * 0.72;

        for (let b = 0; b < binCount; b++) {
            if (bins[b] === 0) continue;
            const bx = getX(xMin + b * binW);
            const bw = getX(xMin + (b + 1) * binW) - bx;
            // Scale bar height relative to max density
            const bh = (bins[b] / maxBinHeight) * 90;

            ctx.fillRect(bx, yBaseline - bh, bw - 1, bh);
            ctx.strokeRect(bx, yBaseline - bh, bw - 1, bh);
        }

        // HUD overlay showing scanner counts
        ctx.fillStyle = "rgba(0, 255, 213, 0.85)";
        ctx.font = "11px monospace";
        ctx.fillText(`Tomography Scanner Count: ${questStates.tomographyCount} measurements`, 25, 35);
    }

    /**
     * Rotates the Bohr Phase needle based on the wave's peak phase angle
     */
    function rotatePhaseNeedle(state) {
        const N = state.N;
        const re = state.psi_re;
        const im = state.psi_im;

        // Find index where probability is maximum
        let maxProb = 0;
        let maxJ = 0;
        for (let j = 0; j < N; j++) {
            const p = re[j] * re[j] + im[j] * im[j];
            if (p > maxProb) {
                maxProb = p;
                maxJ = j;
            }
        }

        // Read phase angle at peak
        const theta = Math.atan2(im[maxJ], re[maxJ]);
        const deg = theta * 180 / Math.PI;

        phaseWheelNeedle.style.transform = `rotate(${deg.toFixed(1)}deg)`;
    }
});
