/**
 * Copernican heliocentric model solver for Mars.
 * Eliminates the Equant by using an eccentric heliocentric circular deferent
 * coupled with a small secondary epicyclet (bisected eccentricity).
 */

window.CopernicusModel = {
  name: "Copernican Model",
  // Default parameters
  defaultParams: {
    R: 1.5237,          // Mean radius of Mars orbit (AU)
    e: 0.1424,          // Eccentricity (Mars)
    omega_m: 0.524,     // Mars orbital speed (rad/year)
    lambda_m0: 5.89,    // Mars mean longitude phase offset (radians)
    longApsides: 5.86,  // Longitude of Mars apsides (radians)
    
    // Earth parameters (heliocentric eccentric circle)
    R_e: 1.0000,
    e_e: 0.0167,
    omega_e: 6.283,     // Earth orbital speed (rad/year)
    lambda_e0: 1.72,    // Earth mean longitude phase offset (radians)
    longApsides_e: 1.79 // Earth apsides longitude (radians)
  },

  paramBounds: {
    R: [1.2, 1.8],
    e: [0.0, 0.3],
    omega_m: [0.45, 0.6],
    lambda_m0: [0.0, 6.28318],
    longApsides: [0.0, 6.28318],
    
    R_e: [0.9, 1.1],
    e_e: [0.0, 0.05],
    omega_e: [6.2, 6.3],
    lambda_e0: [0.0, 6.28318],
    longApsides_e: [0.0, 6.28318]
  },

  /**
   * Predict Mars position relative to Earth at a given time (in years).
   */
  predict: function(t, params) {
    const p = params || this.defaultParams;
    
    // 1. Earth Position (Heliocentric, eccentric circle centered at D_e)
    const lambda_e = (p.omega_e * t + p.lambda_e0) % (2.0 * Math.PI);
    const cos_aps_e = Math.cos(p.longApsides_e);
    const sin_aps_e = Math.sin(p.longApsides_e);
    
    // Center of Earth's deferent is offset from Sun (origin) by eccentricity e_e
    const xD_e = p.e_e * cos_aps_e;
    const yD_e = p.e_e * sin_aps_e;
    
    const xE = xD_e + p.R_e * Math.cos(lambda_e);
    const yE = yD_e + p.R_e * Math.sin(lambda_e);
    const zE = 0.0;
    
    // 2. Mars Position (Heliocentric, Copernican deferent + small epicyclet)
    const lambda_m = (p.omega_m * t + p.lambda_m0) % (2.0 * Math.PI);
    const cos_aps_m = Math.cos(p.longApsides);
    const sin_aps_m = Math.sin(p.longApsides);
    
    // Center of Mars's deferent is offset from Sun by 3/4 of the eccentricity
    const xD_m = 0.75 * p.e * cos_aps_m;
    const yD_m = 0.75 * p.e * sin_aps_m;
    
    // Epicyclet center moves uniformly on deferent of radius R
    const xC = xD_m + p.R * Math.cos(lambda_m);
    const yC = yD_m + p.R * Math.sin(lambda_m);
    
    // Planet rotates on epicyclet of radius e/4 in the opposite direction at twice the speed
    // This replicates the Ptolemaic equant effect without violating uniform circular motion
    const epicyclet_angle = 2.0 * lambda_m - p.longApsides;
    const xM = xC + 0.25 * p.e * Math.cos(epicyclet_angle);
    const yM = yC - 0.25 * p.e * Math.sin(epicyclet_angle);
    const zM = 1.85 * Math.sin(lambda_m - p.longApsides); // Copernican latitude representation
    
    // 3. Geocentric relative vector
    const xG = xM - xE;
    const yG = yM - yE;
    const zG = zM - zE;
    
    let lon = Math.atan2(yG, xG);
    if (lon < 0) lon += 2.0 * Math.PI;
    
    const dist_2d = Math.sqrt(xG*xG + yG*yG);
    const lat = Math.atan2(zG, dist_2d) * 180.0 / Math.PI;
    
    return {
      x: xG,
      y: yG,
      z: zG,
      lon: lon * 180.0 / Math.PI,
      lat: lat,
      x_e: xE, // Helio Earth coordinates (for orrery)
      y_e: yE,
      x_c: xM, // Helio Mars coordinates (for orrery)
      y_c: yM
    };
  }
};
