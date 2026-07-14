/**
 * Keplerian elliptical model solver for Mars.
 * Implements Kepler's first two laws (elliptical orbits, equal areas)
 * and precise coordinate rotations in 3D space.
 */

window.KeplerModel = {
  name: "Keplerian Model",
  // Default parameters (J2000 approximate elements back-projected)
  defaultParams: {
    // Mars orbital elements
    a: 1.5237,          // Semi-major axis (AU)
    e: 0.0934,          // Eccentricity
    omega_m: 0.524,     // Mean motion (rad/year)
    M0_m: 5.89,         // Mean anomaly phase at epoch (radians)
    long_peri: 5.86,    // Longitude of perihelion (radians)
    long_node: 0.86,    // Longitude of ascending node (radians)
    i: 0.0323,          // Inclination (radians, approx 1.85 degrees)
    
    // Earth orbital elements (used to compute relative geocentric view)
    a_e: 1.0000,
    e_e: 0.0167,
    omega_e: 6.283,
    M0_e: 1.72,
    long_peri_e: 1.79
  },

  paramBounds: {
    a: [1.2, 1.8],
    e: [0.0, 0.25],
    omega_m: [0.45, 0.6],
    M0_m: [0.0, 6.28318],
    long_peri: [0.0, 6.28318],
    long_node: [0.0, 6.28318],
    i: [0.0, 0.1],
    
    a_e: [0.9, 1.1],
    e_e: [0.0, 0.05],
    omega_e: [6.2, 6.3],
    M0_e: [0.0, 6.28318],
    long_peri_e: [0.0, 6.28318]
  },

  /**
   * Solve Kepler's equation M = E - e sin E using Newton-Raphson.
   */
  solveKepler: function(M, e) {
    let E = M;
    for (let j = 0; j < 15; j++) {
      let delta = E - e * Math.sin(E) - M;
      E -= delta / (1.0 - e * Math.cos(E));
    }
    return E;
  },

  /**
   * Helper to get 3D heliocentric position of a body.
   */
  getHeliocentricPosition: function(t, a, e, omega, M0, long_peri, long_node, i) {
    // Mean anomaly
    const M = (omega * t + M0) % (2.0 * Math.PI);
    
    // Solve Kepler's equation for Eccentric Anomaly
    const E = this.solveKepler(M, e);
    
    // Orbital plane coordinates
    const x_orb = a * (Math.cos(E) - e);
    const y_orb = a * Math.sqrt(1.0 - e * e) * Math.sin(E);
    
    // Arguments for 3D rotation
    // Argument of perihelion (w) = longitude of perihelion - longitude of node
    const w = long_peri - long_node;
    const O = long_node;
    
    const cos_w = Math.cos(w);
    const sin_w = Math.sin(w);
    const cos_o = Math.cos(O);
    const sin_o = Math.sin(O);
    const cos_i = Math.cos(i);
    const sin_i = Math.sin(i);
    
    // Euler angles rotation matrix elements
    const r11 = cos_o * cos_w - sin_o * sin_w * cos_i;
    const r12 = -cos_o * sin_w - sin_o * cos_w * cos_i;
    const r21 = sin_o * cos_w + cos_o * sin_w * cos_i;
    const r22 = -sin_o * sin_w + cos_o * cos_w * cos_i;
    const r31 = sin_w * sin_i;
    const r32 = cos_w * sin_i;
    
    const x = r11 * x_orb + r12 * y_orb;
    const y = r21 * x_orb + r22 * y_orb;
    const z = r31 * x_orb + r32 * y_orb;
    
    return { x, y, z };
  },

  /**
   * Predict Mars position relative to Earth at a given time (in years).
   */
  predict: function(t, params) {
    const p = params || this.defaultParams;
    
    // 1. Calculate Earth Helio position (Earth inclination is 0 by definition)
    const earth = this.getHeliocentricPosition(
      t,
      p.a_e,
      p.e_e,
      p.omega_e,
      p.M0_e,
      p.long_peri_e,
      0.0, // Earth ascending node = 0
      0.0  // Earth inclination = 0
    );
    
    // 2. Calculate Mars Helio position
    const mars = this.getHeliocentricPosition(
      t,
      p.a,
      p.e,
      p.omega_m,
      p.M0_m,
      p.long_peri,
      p.long_node,
      p.i
    );
    
    // 3. Geocentric relative vector
    const xG = mars.x - earth.x;
    const yG = mars.y - earth.y;
    const zG = mars.z - earth.z;
    
    let lon = Math.atan2(yG, xG);
    if (lon < 0) lon += 2.0 * Math.PI;
    
    const dist_2d = Math.sqrt(xG * xG + yG * yG);
    const lat = Math.atan2(zG, dist_2d) * 180.0 / Math.PI;
    
    return {
      x: xG,
      y: yG,
      z: zG,
      lon: lon * 180.0 / Math.PI,
      lat: lat,
      x_e: earth.x,
      y_e: earth.y,
      x_c: mars.x,
      y_c: mars.y
    };
  }
};
