/**
 * Quantum Mechanics Wavefunction Sandbox Solver Module
 * Exposes window.QuantumSolver for real-time wavepacket propagation (TDSE)
 * and bound-state search using Imaginary-Time Evolution (ITE).
 */

window.QuantumSolver = (() => {
    // Grid parameters
    let N = 512;
    let xMin = -50;
    let xMax = 50;
    let dx = 100 / 512;
    let dt = 0.005;

    // Grid coordinates and physical states
    let x = new Float64Array(N);
    let V = new Float64Array(N); // User potential
    let eta = new Float64Array(N); // Complex Absorbing Potential (CAP)
    let psi_re = new Float64Array(N);
    let psi_im = new Float64Array(N);

    // Solver-specific cache
    let fftInstance = null;
    let complexPsi = null;
    let complexOut = null;

    // Propagator phase coefficients (Real/Imaginary parts)
    let potPhaseHalfCos = new Float64Array(N);
    let potPhaseHalfSin = new Float64Array(N);
    let kinCos = new Float64Array(N);
    let kinSin = new Float64Array(N);
    let kGrid = new Float64Array(N);

    // ITE Cache for precomputed states
    let eigenstates = []; // Array of { energy, psi_re }

    // CAP Configuration
    let etaMax = 0.08;
    let nAbs = Math.round(0.12 * N); // 12% of grid on each side for absorption

    // Initialization flag
    let isInitialized = false;

    /**
     * Set up the grid and FFT instances.
     */
    function init(config = {}) {
        if (config.N !== undefined) N = config.N;
        if (config.xMin !== undefined) xMin = config.xMin;
        if (config.xMax !== undefined) xMax = config.xMax;
        if (config.dt !== undefined) dt = config.dt;

        dx = (xMax - xMin) / N;
        nAbs = Math.round(0.12 * N);

        // Allocate grids
        x = new Float64Array(N);
        V = new Float64Array(N);
        eta = new Float64Array(N);
        psi_re = new Float64Array(N);
        psi_im = new Float64Array(N);

        for (let j = 0; j < N; j++) {
            x[j] = xMin + j * dx;
        }

        // Initialize CAP profile (quadratic absorption increasing to boundary)
        for (let j = 0; j < N; j++) {
            if (j < nAbs) {
                eta[j] = etaMax * Math.pow((nAbs - j) / nAbs, 2);
            } else if (j > N - 1 - nAbs) {
                eta[j] = etaMax * Math.pow((j - (N - 1 - nAbs)) / nAbs, 2);
            } else {
                eta[j] = 0;
            }
        }

        // Wavenumber grid construction (with signed frequencies)
        kGrid = new Float64Array(N);
        for (let m = 0; m < N; m++) {
            kGrid[m] = (m < N / 2)
                ? (2 * Math.PI * m) / (N * dx)
                : (2 * Math.PI * (m - N)) / (N * dx);
        }

        // FFT Instantiation (Check for CDN library, fallback to local Radix-2)
        const FFTClass = window.FFT || window.LocalFFT;
        if (!FFTClass) {
            console.error("FFT library could not be loaded!");
        }
        fftInstance = new FFTClass(N);
        complexPsi = fftInstance.createComplexArray();
        complexOut = fftInstance.createComplexArray();

        precomputeKineticPhase();
        precomputePotentialPhase();

        eigenstates = [];
        isInitialized = true;
    }

    /**
     * Precompute exp(-i * k^2 * dt / 2) propagator.
     */
    function precomputeKineticPhase() {
        kinCos = new Float64Array(N);
        kinSin = new Float64Array(N);
        for (let m = 0; m < N; m++) {
            const phi = -0.5 * kGrid[m] * kGrid[m] * dt;
            kinCos[m] = Math.cos(phi);
            kinSin[m] = Math.sin(phi);
        }
    }

    /**
     * Precompute exp(-i * (V - i*eta) * dt / 2) potential + CAP absorption propagator.
     */
    function precomputePotentialPhase() {
        potPhaseHalfCos = new Float64Array(N);
        potPhaseHalfSin = new Float64Array(N);
        for (let j = 0; j < N; j++) {
            const phi = -V[j] * dt / 2;
            const damp = Math.exp(-eta[j] * dt / 2);
            potPhaseHalfCos[j] = Math.cos(phi) * damp;
            potPhaseHalfSin[j] = Math.sin(phi) * damp;
        }
    }

    /**
     * Run nSteps split-operator time steps (Real Time Evolution).
     */
    function step(nSteps = 1) {
        if (!isInitialized) return;

        for (let s = 0; s < nSteps; s++) {
            // Step A: Half-step potential kick & pack complex array
            for (let j = 0; j < N; j++) {
                const re = psi_re[j];
                const im = psi_im[j];
                const cr = potPhaseHalfCos[j];
                const ci = potPhaseHalfSin[j];
                complexPsi[2 * j] = re * cr - im * ci;
                complexPsi[2 * j + 1] = re * ci + im * cr;
            }

            // Step B: FFT to momentum space
            fftInstance.transform(complexOut, complexPsi);

            // Step C: Full-step kinetic kick in momentum space
            for (let m = 0; m < N; m++) {
                const re = complexOut[2 * m];
                const im = complexOut[2 * m + 1];
                const cr = kinCos[m];
                const ci = kinSin[m];
                complexOut[2 * m] = re * cr - im * ci;
                complexOut[2 * m + 1] = re * ci + im * cr;
            }

            // Step D: IFFT back to position space
            fftInstance.inverseTransform(complexPsi, complexOut);

            // Step E: Second half-step potential kick & unpack complex array
            for (let j = 0; j < N; j++) {
                const re = complexPsi[2 * j];
                const im = complexPsi[2 * j + 1];
                const cr = potPhaseHalfCos[j];
                const ci = potPhaseHalfSin[j];
                psi_re[j] = re * cr - im * ci;
                psi_im[j] = re * ci + im * cr;
            }
        }
    }

    /**
     * Run nSteps imaginary-time evolution steps for finding eigenstates.
     * CAP is disabled during ITE; wavefunction is locked to purely real values.
     */
    function stepITE(nSteps = 1, dtau = 0.05, activeEigenstates = []) {
        if (!isInitialized) return;

        // Precompute ITE potential damping factor (dtau/2 potential kick, eta=0)
        const itePotHalf = new Float64Array(N);
        for (let j = 0; j < N; j++) {
            itePotHalf[j] = Math.exp(-V[j] * dtau / 2);
        }

        // Precompute ITE kinetic damping factor (dtau kinetic step)
        const iteKin = new Float64Array(N);
        for (let m = 0; m < N; m++) {
            iteKin[m] = Math.exp(-0.5 * kGrid[m] * kGrid[m] * dtau);
        }

        const iteComplexPsi = fftInstance.createComplexArray();
        const iteComplexOut = fftInstance.createComplexArray();

        for (let s = 0; s < nSteps; s++) {
            // 1. Half-step potential damping & pack (purely real)
            for (let j = 0; j < N; j++) {
                iteComplexPsi[2 * j] = psi_re[j] * itePotHalf[j];
                iteComplexPsi[2 * j + 1] = 0;
            }

            // 2. FFT to momentum space
            fftInstance.transform(iteComplexOut, iteComplexPsi);

            // 3. Kinetic damping in momentum space (locking imaginary part to zero)
            for (let m = 0; m < N; m++) {
                iteComplexOut[2 * m] = iteComplexOut[2 * m] * iteKin[m];
                iteComplexOut[2 * m + 1] = 0;
            }

            // 4. IFFT back to position space
            fftInstance.inverseTransform(iteComplexPsi, iteComplexOut);

            // 5. Unpack and second half-step potential damping
            for (let j = 0; j < N; j++) {
                psi_re[j] = iteComplexPsi[2 * j] * itePotHalf[j];
                psi_im[j] = 0; // Strictly zero out phase drift
            }

            // 6. Gram-Schmidt Orthogonalization against lower found states
            for (let k = 0; k < activeEigenstates.length; k++) {
                const targetState = activeEigenstates[k].psi_re;
                let overlap = 0;
                for (let j = 0; j < N; j++) {
                    overlap += targetState[j] * psi_re[j];
                }
                overlap *= dx;
                for (let j = 0; j < N; j++) {
                    psi_re[j] -= overlap * targetState[j];
                }
            }

            // 7. Renormalize the state
            renormalize();
        }
    }

    /**
     * Compute and normalize the current active state's norm.
     */
    function renormalize() {
        let normSq = 0;
        for (let j = 0; j < N; j++) {
            normSq += psi_re[j] * psi_re[j] + psi_im[j] * psi_im[j];
        }
        normSq *= dx;
        if (normSq < 1e-14) return;

        const invNorm = 1.0 / Math.sqrt(normSq);
        for (let j = 0; j < N; j++) {
            psi_re[j] *= invNorm;
            psi_im[j] *= invNorm;
        }
    }

    /**
     * Calculate position and momentum uncertainty standard deviations.
     */
    function computeUncertainty() {
        if (!isInitialized) return { dx: 0, dp: 0, product: 0 };

        // Position expectation values
        let expX = 0;
        let expXSq = 0;
        for (let j = 0; j < N; j++) {
            const prob = psi_re[j] * psi_re[j] + psi_im[j] * psi_im[j];
            expX += x[j] * prob;
            expXSq += x[j] * x[j] * prob;
        }
        expX *= dx;
        expXSq *= dx;

        const varX = Math.max(0, expXSq - expX * expX);
        const deltaX = Math.sqrt(varX);

        // Perform forward FFT to get momentum representation
        for (let j = 0; j < N; j++) {
            complexPsi[2 * j] = psi_re[j];
            complexPsi[2 * j + 1] = psi_im[j];
        }
        fftInstance.transform(complexOut, complexPsi);

        // Momentum expectation values (Parseval normalization: divide probability by N)
        let expP = 0;
        let expPSq = 0;
        for (let m = 0; m < N; m++) {
            const probK = (complexOut[2 * m] * complexOut[2 * m] + complexOut[2 * m + 1] * complexOut[2 * m + 1]) / N;
            
            // Suppress the Nyquist frequency mode contribution to avoid negative bias asymmetry
            const k = (m === N / 2) ? 0 : kGrid[m];
            
            expP += k * probK;
            expPSq += k * k * probK;
        }
        expP *= dx;
        expPSq *= dx;

        const varP = Math.max(0, expPSq - expP * expP);
        const deltaP = Math.sqrt(varP);

        return {
            dx: deltaX,
            dp: deltaP,
            product: deltaX * deltaP
        };
    }

    /**
     * Compute the energy expectation value (Hamiltonian operator expectation).
     */
    function computeEnergy() {
        // Position potential contribution
        let expV = 0;
        for (let j = 0; j < N; j++) {
            const prob = psi_re[j] * psi_re[j] + psi_im[j] * psi_im[j];
            expV += V[j] * prob;
        }
        expV *= dx;

        // Kinetic contribution in momentum space
        for (let j = 0; j < N; j++) {
            complexPsi[2 * j] = psi_re[j];
            complexPsi[2 * j + 1] = psi_im[j];
        }
        fftInstance.transform(complexOut, complexPsi);

        let expT = 0;
        for (let m = 0; m < N; m++) {
            const probK = (complexOut[2 * m] * complexOut[2 * m] + complexOut[2 * m + 1] * complexOut[2 * m + 1]) / N;
            const k = kGrid[m];
            expT += 0.5 * k * k * probK;
        }
        expT *= dx;

        return expT + expV;
    }

    /**
     * Perform random measurement collapse using inverse CDF sampling.
     * Resets the wavefunction to a narrow localized Gaussian.
     */
    function measure() {
        if (!isInitialized) return { xMeas: 0, index: 0 };

        // 1. Build cumulative probability distribution (CDF)
        const cdf = new Float64Array(N);
        let accumulated = 0;
        for (let j = 0; j < N; j++) {
            const prob = (psi_re[j] * psi_re[j] + psi_im[j] * psi_im[j]) * dx;
            accumulated += prob;
            cdf[j] = accumulated;
        }

        // Draw uniform random value [0, 1]
        const u = Math.random();
        
        // Find index corresponding to the random threshold
        let idx = 0;
        while (idx < N - 1 && cdf[idx] < u) {
            idx++;
        }
        const xMeas = x[idx];

        // 2. Collapse wavefunction to a narrow Gaussian centered at xMeas
        const sigmaMeas = Math.max(1.8 * dx, 0.4); // width ~2 grid spacings
        const coef = Math.pow(1.0 / (2 * Math.PI * sigmaMeas * sigmaMeas), 0.25);

        for (let j = 0; j < N; j++) {
            const diff = x[j] - xMeas;
            psi_re[j] = coef * Math.exp(-diff * diff / (4 * sigmaMeas * sigmaMeas));
            psi_im[j] = 0; // Position collapse resets phase to real state
        }

        renormalize();

        return {
            xMeas: xMeas,
            index: idx
        };
    }

    /**
     * Inject a momentum boost u (Galilean transform gauge phase shift)
     */
    function applyMomentumBoost(u) {
        for (let j = 0; j < N; j++) {
            const phase = u * x[j];
            const re = psi_re[j];
            const im = psi_im[j];
            const cosPhase = Math.cos(phase);
            const sinPhase = Math.sin(phase);
            psi_re[j] = re * cosPhase - im * sinPhase;
            psi_im[j] = re * sinPhase + im * cosPhase;
        }
        renormalize();
    }

    /**
     * Set the physical potential grid array and rebuild exponents.
     */
    function setV(newV) {
        for (let j = 0; j < N; j++) {
            V[j] = newV[j];
        }
        precomputePotentialPhase();
    }

    /**
     * Set the active wavefunction.
     */
    function setPsi(newRe, newIm) {
        for (let j = 0; j < N; j++) {
            psi_re[j] = newRe[j];
            psi_im[j] = newIm[j];
        }
        renormalize();
    }

    /**
     * Calculate and return total norm (integration of |psi|^2).
     */
    function getNorm() {
        let norm = 0;
        for (let j = 0; j < N; j++) {
            norm += psi_re[j] * psi_re[j] + psi_im[j] * psi_im[j];
        }
        return norm * dx;
    }

    /**
     * Return the shifted momentum probability distribution (fftshift)
     */
    function getMomentum() {
        if (!isInitialized) return new Float64Array(N);
        for (let j = 0; j < N; j++) {
            complexPsi[2 * j] = psi_re[j];
            complexPsi[2 * j + 1] = psi_im[j];
        }
        fftInstance.transform(complexOut, complexPsi);
        const prob = new Float64Array(N);
        for (let m = 0; m < N; m++) {
            const shiftIdx = (m + N / 2) % N;
            prob[m] = (complexOut[2 * shiftIdx] * complexOut[2 * shiftIdx] + complexOut[2 * shiftIdx + 1] * complexOut[2 * shiftIdx + 1]) / N;
        }
        return prob;
    }

    /**
     * Expose state representation
     */
    function getState() {
        return {
            N,
            dx,
            dt,
            x,
            V,
            eta,
            psi_re,
            psi_im,
            kGrid
        };
    }

    return {
        init,
        step,
        stepITE,
        renormalize,
        computeUncertainty,
        computeEnergy,
        measure,
        applyMomentumBoost,
        setV,
        setPsi,
        getNorm,
        getMomentum,
        getState
    };
})();
