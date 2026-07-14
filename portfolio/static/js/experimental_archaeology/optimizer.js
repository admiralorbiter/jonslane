/**
 * Nelder-Mead Simplex Optimizer in JavaScript.
 * Used for client-side parameter fitting of Ptolemy, Copernicus, and Kepler models.
 */

window.NelderMead = {
  /**
   * Run the parameter optimization.
   * @param {Object} model - The model solver (PtolemyModel, CopernicusModel, KeplerModel)
   * @param {Object} initialParams - Starting parameter values
   * @param {Array} paramsToFit - List of parameter names to optimize
   * @param {Array} dataset - Array of observation records ({ year, lon, lat })
   * @param {number} maxIterations - Limit on simplex steps
   * @returns {Object} Optimized parameter values
   */
  optimize: function(model, initialParams, paramsToFit, dataset, maxIterations = 200) {
    const N = paramsToFit.length;
    if (N === 0) return initialParams;

    // Helper: Compute RMS angular longitude error for a given parameter array
    const costFunction = (vector) => {
      // Build parameters object
      const testParams = { ...initialParams };
      paramsToFit.forEach((name, i) => {
        // Enforce parameter bounds
        const bounds = model.paramBounds[name];
        let val = vector[i];
        if (bounds) {
          val = Math.max(bounds[0], Math.min(bounds[1], val));
        }
        testParams[name] = val;
      });

      let sumSquaredError = 0;
      dataset.forEach(d => {
        const pred = model.predict(d.year, testParams);
        // Shortest distance on a circle (handling 360 deg wrap-around)
        let diff = (pred.lon - d.lon) % 360.0;
        if (diff > 180.0) diff -= 360.0;
        if (diff < -180.0) diff += 360.0;
        
        // We also factor in latitude slightly (Ptolemaic latitude matches poorly, but Kepler/Copernicus fit well)
        let latDiff = pred.lat - d.lat;
        
        sumSquaredError += diff * diff + 0.1 * latDiff * latDiff;
      });

      return Math.sqrt(sumSquaredError / dataset.length);
    };

    // 1. Initialize simplex: N + 1 vertices
    let simplex = [];
    
    // First vertex: starting point
    let v0 = paramsToFit.map(name => initialParams[name]);
    simplex.push({ vector: v0, cost: costFunction(v0) });

    // Other vertices: perturb each parameter by 5%
    for (let i = 0; i < N; i++) {
      let vi = [...v0];
      const name = paramsToFit[i];
      const bounds = model.paramBounds[name];
      
      // Perturb offset
      let step = initialParams[name] !== 0 ? initialParams[name] * 0.05 : 0.05;
      vi[i] += step;
      
      // Clamp to bounds
      if (bounds) {
        vi[i] = Math.max(bounds[0], Math.min(bounds[1], vi[i]));
      }
      
      simplex.push({ vector: vi, cost: costFunction(vi) });
    }

    // Coefficients
    const alpha = 1.0;  // Reflection
    const gamma = 2.0;  // Expansion
    const beta = 0.5;   // Contraction
    const delta = 0.5;  // Shrink

    // 2. Optimization loop
    for (let iter = 0; iter < maxIterations; iter++) {
      // Sort simplex by cost (best to worst)
      simplex.sort((a, b) => a.cost - b.cost);

      const best = simplex[0];
      const worst = simplex[N];
      const secondWorst = simplex[N - 1];

      // Calculate centroid (x_o) of all points except the worst
      let centroid = new Array(N).fill(0);
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          centroid[j] += simplex[i].vector[j];
        }
      }
      centroid = centroid.map(val => val / N);

      // Reflection step
      let reflectedVector = new Array(N);
      for (let j = 0; j < N; j++) {
        reflectedVector[j] = centroid[j] + alpha * (centroid[j] - worst.vector[j]);
      }
      let reflectedCost = costFunction(reflectedVector);

      if (reflectedCost < secondWorst.cost && reflectedCost >= best.cost) {
        simplex[N] = { vector: reflectedVector, cost: reflectedCost };
        continue;
      }

      // Expansion step
      if (reflectedCost < best.cost) {
        let expandedVector = new Array(N);
        for (let j = 0; j < N; j++) {
          expandedVector[j] = centroid[j] + gamma * (reflectedVector[j] - centroid[j]);
        }
        let expandedCost = costFunction(expandedVector);

        if (expandedCost < reflectedCost) {
          simplex[N] = { vector: expandedVector, cost: expandedCost };
        } else {
          simplex[N] = { vector: reflectedVector, cost: reflectedCost };
        }
        continue;
      }

      // Contraction step
      let contractedVector = new Array(N);
      if (reflectedCost < worst.cost) {
        // Outer contraction
        for (let j = 0; j < N; j++) {
          contractedVector[j] = centroid[j] + beta * (reflectedVector[j] - centroid[j]);
        }
      } else {
        // Inner contraction
        for (let j = 0; j < N; j++) {
          contractedVector[j] = centroid[j] - beta * (centroid[j] - worst.vector[j]);
        }
      }
      let contractedCost = costFunction(contractedVector);

      if (contractedCost < Math.min(reflectedCost, worst.cost)) {
        simplex[N] = { vector: contractedVector, cost: contractedCost };
        continue;
      }

      // Shrink step (if contraction fails)
      for (let i = 1; i <= N; i++) {
        let shrunkVector = new Array(N);
        for (let j = 0; j < N; j++) {
          shrunkVector[j] = best.vector[j] + delta * (simplex[i].vector[j] - best.vector[j]);
        }
        simplex[i] = { vector: shrunkVector, cost: costFunction(shrunkVector) };
      }
    }

    // Sort one last time to get the absolute best vertex
    simplex.sort((a, b) => a.cost - b.cost);
    const finalBestVector = simplex[0].vector;

    // Map optimized vector back to parameters object
    const finalParams = { ...initialParams };
    paramsToFit.forEach((name, i) => {
      finalParams[name] = finalBestVector[i];
    });

    return {
      params: finalParams,
      rms: simplex[0].cost
    };
  }
};
