/**
 * Ptolemy planetary model solver for Mars.
 * Implements deferent circle, eccentric offset, equant point uniform rotation,
 * and epicycle vector locked to the mean Sun's direction.
 */

window.PtolemyModel = {
  name: "Ptolemaic Model",
  // Default parameters (historically matching Ptolemy's Almagest or fit starting points)
  defaultParams: {
    R: 1.5237,          // Deferent radius (Mars-Sun distance equivalent)
    e: 0.1424,          // Eccentricity (distance from Earth to deferent center)
    r: 0.6583,          // Epicycle radius (Earth orbit radius equivalent)
    omega_d: 0.524,     // Deferent angular speed (rad/year, approx 360 / 687 days)
    lambda_m0: 5.89,    // Mars mean longitude phase offset (radians)
    omega_s: 6.283,     // Sun mean angular speed (rad/year, approx 360 / 365.25 days)
    lambda_s0: 1.72,    // Sun phase offset (radians)
    longApsides: 5.86,  // Longitude of apsides (radians, direction of eccentric displacement)
  },
  
  // Bounds for Nelder-Mead fitting
  paramBounds: {
    R: [1.2, 1.8],
    e: [0.0, 0.3],
    r: [0.4, 0.8],
    omega_d: [0.45, 0.6],
    lambda_m0: [0.0, 6.28318],
    omega_s: [6.2, 6.3],
    lambda_s0: [0.0, 6.28318],
    longApsides: [0.0, 6.28318],
  },

  /**
   * Predict Mars position relative to Earth at a given time (in years).
   */
  predict: function(t, params) {
    const p = params || this.defaultParams;
    
    // 1. Calculate Mean Longitude from Equant (constant angular motion)
    const lambda_m = (p.omega_d * t + p.lambda_m0) % (2.0 * Math.PI);
    
    // 2. Position of Deferent Center (D) and Equant (Q)
    const cos_aps = Math.cos(p.longApsides);
    const sin_aps = Math.sin(p.longApsides);
    
    const xD = p.e * cos_aps;
    const yD = p.e * sin_aps;
    
    const xQ = 2.0 * p.e * cos_aps;
    const yQ = 2.0 * p.e * sin_aps;
    
    // 3. Find intersection of Equant ray with Deferent circle
    // Ray: Q + s * (cos(lambda_m), sin(lambda_m))
    // Circle: centered at D with radius R
    // Vector Q - D = (e*cos_aps, e*sin_aps)
    const dx = xQ - xD;
    const dy = yQ - yD;
    
    const cos_m = Math.cos(lambda_m);
    const sin_m = Math.sin(lambda_m);
    
    // Quadratic equation coefficients: s^2 + 2bs + c = 0
    const b = dx * cos_m + dy * sin_m;
    const c = (dx * dx + dy * dy) - p.R * p.R;
    
    const disc = b * b - c;
    if (disc < 0) {
      // Degenerate geometry fallback: return orbit center
      return { x: 0, y: 0, z: 0, lon: 0, lat: 0, x_c: xD, y_c: yD };
    }
    
    // Positive root corresponds to the forward projection of the ray
    const s = -b + Math.sqrt(disc);
    
    // Epicycle Center coordinates (C)
    const xC = xQ + s * cos_m;
    const yC = yQ + s * sin_m;
    
    // 4. Mean Sun Position (determines epicycle orientation for superior planet)
    const lambda_s = (p.omega_s * t + p.lambda_s0) % (2.0 * Math.PI);
    
    // 5. Apparent planet position (P) = C + epicycle vector
    const xP = xC + p.r * Math.cos(lambda_s);
    const yP = yC + p.r * Math.sin(lambda_s);
    const zP = 0.0; // Ptolemy's original model is primarily flat; latitude is modeled as an offset
    
    // Geocentric longitude
    let lon = Math.atan2(yP, xP);
    if (lon < 0) lon += 2.0 * Math.PI;
    
    // Ptolemaic latitude approximation (wobble of deferent plane)
    // We add a simple harmonic latitudinal tilt matching historical models
    const lat = 1.85 * Math.sin(lambda_m - p.longApsides) * (p.R / (p.R + p.r * Math.cos(lambda_s - lambda_m)));
    
    return {
      x: xP,
      y: yP,
      z: zP,
      lon: lon * 180.0 / Math.PI,
      lat: lat,
      x_c: xC,
      y_c: yC,
      x_e: 0.0, // Earth is at origin in geocentric view
      y_e: 0.0
    };
  }
};
