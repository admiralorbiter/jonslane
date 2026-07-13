/**
 * Orbital Mechanics Sandbox Physics Engine (SI units)
 * Handles:
 *  1. Astronomical Constants (Earth, Moon, Mars, Jupiter, Saturn, Sun)
 *  2. Runge-Kutta 4th-Order (RK4) State Integrator
 *  3. Patched Conics Frame Transitions (Sphere of Influence check)
 *  4. Keplerian Orbital Element Extraction
 *  5. Trajectory Prediction (Analytical conic sampling for ellipses and hyperbolas)
 *  6. Atmospheric Reentry Corridor calculations
 */

const PhysicsSolver = (function () {
    // === 1. ASTRONOMICAL CONSTANTS (SI UNITS) ===
    const G = 6.6743e-11;

    // Body specs: mass (kg), radius (m), orbit radius (m) around parent, orbital period (s), color, SOI (m)
    const BODIES = {
        sun: {
            name: "Sun",
            mass: 1.989e30,
            radius: 6.9634e8,
            color: 0xffaa00,
            parent: null
        },
        earth: {
            name: "Earth",
            mass: 5.9722e24,
            radius: 6.371e6,
            color: 0x4facfe,
            parent: "sun",
            orbitalRadius: 1.496e11, // 1 AU
            period: 3.15576e7, // 1 year
            soi: 9.25e8, // km equivalent
            mu: 3.986004e14, // G * mass
            atmosphereLimit: 120000, // 120 km
            scaleHeight: 8500, // meters
            rho0: 1.225 // surface density kg/m^3
        },
        moon: {
            name: "Moon",
            mass: 7.3477e22,
            radius: 1.7371e6,
            color: 0x888888,
            parent: "earth",
            orbitalRadius: 3.844e8, // distance from Earth
            period: 2.3606e6, // 27.3 days
            soi: 6.62e7,
            mu: 4.9048e12
        },
        mars: {
            name: "Mars",
            mass: 6.4171e23,
            radius: 3.3895e6,
            color: 0xe07b39,
            parent: "sun",
            orbitalRadius: 2.2792e11, // 1.52 AU
            period: 5.9355e7, // 1.88 years
            soi: 5.77e8,
            mu: 4.2828e13,
            atmosphereLimit: 50000, // 50 km
            scaleHeight: 11100, // meters
            rho0: 0.020 // surface density kg/m^3
        },
        jupiter: {
            name: "Jupiter",
            mass: 1.8982e27,
            radius: 6.9911e7,
            color: 0xd4a373,
            parent: "sun",
            orbitalRadius: 7.7857e11, // 5.2 AU
            period: 3.7433e8, // 11.86 years
            soi: 4.82e10,
            mu: 1.26686e17
        },
        saturn: {
            name: "Saturn",
            mass: 5.6834e26,
            radius: 5.8232e7,
            color: 0xf4e285,
            parent: "sun",
            orbitalRadius: 1.4335e12, // 9.58 AU
            period: 9.2957e8, // 29.4 years
            soi: 5.48e10,
            mu: 3.7931e16
        }
    };

    // Precompute mu (G*M) for all bodies
    for (let key in BODIES) {
        if (!BODIES[key].mu) {
            BODIES[key].mu = G * BODIES[key].mass;
        }
    }

    // === 2. RK4 INTEGRATOR IMPLEMENTATION ===

    /**
     * Compute derivatives dS/dt = [vx, vy, vz, ax, ay, az] in the active parent's frame.
     * Patched conics: parent gravitational pull + atmospheric drag.
     */
    function getDerivatives(pos, vel, parentBody, state) {
        const mu = parentBody.mu;
        const x = pos.x;
        const y = pos.y;
        const z = pos.z;

        const dist2 = x*x + y*y + z*z;
        const dist = Math.sqrt(dist2);

        // Softening parameter — set to planet-radius scale so sub-surface
        // gravity decays smoothly rather than inverting into a repulsive bounce.
        // Actual collision detection and game-over is handled in game.js.
        const eps = parentBody.radius * 0.5;
        const dist3 = Math.pow(dist2 + eps*eps, 1.5);

        let ax = -mu * x / dist3;
        let ay = -mu * y / dist3;
        let az = -mu * z / dist3;

        // Apply exponential atmospheric drag
        if (parentBody.atmosphereLimit && dist - parentBody.radius < parentBody.atmosphereLimit) {
            const alt = dist - parentBody.radius;
            if (alt > 0) {
                const scaleHeight = parentBody.scaleHeight || 8500;
                const rho0 = parentBody.rho0 || 1.225;
                const rho = rho0 * Math.exp(-alt / scaleHeight);

                const v2 = vel.x*vel.x + vel.y*vel.y + vel.z*vel.z;
                const v = Math.sqrt(v2);

                if (v > 1e-3) {
                    const dragCoeff = 0.00018; // composite Cd * A / m drag factor
                    const adrag = 0.5 * rho * dragCoeff * v;
                    ax -= adrag * vel.x;
                    ay -= adrag * vel.y;
                    az -= adrag * vel.z;
                }
            }
        }

        return {
            dx: vel.x,
            dy: vel.y,
            dz: vel.z,
            dvx: ax,
            dvy: ay,
            dvz: az
        };
    }

    /**
     * Integrates the spacecraft position & velocity by a time step dt using RK4.
     */
    function rk4Step(pos, vel, parentBody, dt, state) {
        // k1
        const k1 = getDerivatives(pos, vel, parentBody, state);

        // k2
        const pos2 = { x: pos.x + 0.5 * dt * k1.dx, y: pos.y + 0.5 * dt * k1.dy, z: pos.z + 0.5 * dt * k1.dz };
        const vel2 = { x: vel.x + 0.5 * dt * k1.dvx, y: vel.y + 0.5 * dt * k1.dvy, z: vel.z + 0.5 * dt * k1.dvz };
        const k2 = getDerivatives(pos2, vel2, parentBody, state);

        // k3
        const pos3 = { x: pos.x + 0.5 * dt * k2.dx, y: pos.y + 0.5 * dt * k2.dy, z: pos.z + 0.5 * dt * k2.dz };
        const vel3 = { x: vel.x + 0.5 * dt * k2.dvx, y: vel.y + 0.5 * dt * k2.dvy, z: vel.z + 0.5 * dt * k2.dvz };
        const k3 = getDerivatives(pos3, vel3, parentBody, state);

        // k4
        const pos4 = { x: pos.x + dt * k3.dx, y: pos.y + dt * k3.dy, z: pos.z + dt * k3.dz };
        const vel4 = { x: vel.x + dt * k3.dvx, y: vel.y + dt * k3.dvy, z: vel.z + dt * k3.dvz };
        const k4 = getDerivatives(pos4, vel4, parentBody, state);

        // Update state
        return {
            pos: {
                x: pos.x + (dt / 6) * (k1.dx + 2 * k2.dx + 2 * k3.dx + k4.dx),
                y: pos.y + (dt / 6) * (k1.dy + 2 * k2.dy + 2 * k3.dy + k4.dy),
                z: pos.z + (dt / 6) * (k1.dz + 2 * k2.dz + 2 * k3.dz + k4.dz)
            },
            vel: {
                x: vel.x + (dt / 6) * (k1.dvx + 2 * k2.dvx + 2 * k3.dvx + k4.dvx),
                y: vel.y + (dt / 6) * (k1.dvy + 2 * k2.dvy + 2 * k3.dvy + k4.dvy),
                z: vel.z + (dt / 6) * (k1.dvz + 2 * k2.dvz + 2 * k3.dvz + k4.dvz)
            }
        };
    }

    // === 3. PATCHED CONICS SOI TRANSITIONS ===

    /**
     * Evaluates spacecraft position relative to planetary SOIs and transitions frames.
     * Returns updated { localPos, localVel, parentKey }
     */
    function updateSOI(posWorld, velWorld, currentParentKey, bodiesWorld) {
        // 1. If parent is Moon (Moon is parented to Earth)
        if (currentParentKey === "moon") {
            const moonPos = bodiesWorld.moon.pos;
            const distToMoon = Math.sqrt(
                Math.pow(posWorld.x - moonPos.x, 2) +
                Math.pow(posWorld.y - moonPos.y, 2) +
                Math.pow(posWorld.z - moonPos.z, 2)
            );
            if (distToMoon > BODIES.moon.soi) {
                // Exit Moon SOI to Earth
                const earthPos = bodiesWorld.earth.pos;
                const earthVel = bodiesWorld.earth.vel;
                return {
                    pos: { x: posWorld.x - earthPos.x, y: posWorld.y - earthPos.y, z: posWorld.z - earthPos.z },
                    vel: { x: velWorld.x - earthVel.x, y: velWorld.y - earthVel.y, z: velWorld.z - earthVel.z },
                    parentKey: "earth"
                };
            }
            return null; // Stay in Moon SOI
        }

        // 2. If parent is Earth, check if we enter Moon SOI or exit Earth SOI
        if (currentParentKey === "earth") {
            const moonPos = bodiesWorld.moon.pos;
            const distToMoon = Math.sqrt(
                Math.pow(posWorld.x - moonPos.x, 2) +
                Math.pow(posWorld.y - moonPos.y, 2) +
                Math.pow(posWorld.z - moonPos.z, 2)
            );
            if (distToMoon < BODIES.moon.soi) {
                // Enter Moon SOI
                return {
                    pos: { x: posWorld.x - moonPos.x, y: posWorld.y - moonPos.y, z: posWorld.z - moonPos.z },
                    vel: { x: velWorld.x - bodiesWorld.moon.vel.x, y: velWorld.y - bodiesWorld.moon.vel.y, z: velWorld.z - bodiesWorld.moon.vel.z },
                    parentKey: "moon"
                };
            }

            // Check if we exit Earth SOI to Sun
            const earthPos = bodiesWorld.earth.pos;
            const distToEarth = Math.sqrt(
                Math.pow(posWorld.x - earthPos.x, 2) +
                Math.pow(posWorld.y - earthPos.y, 2) +
                Math.pow(posWorld.z - earthPos.z, 2)
            );
            if (distToEarth > BODIES.earth.soi) {
                // Exit Earth SOI to Sun (local position relative to Sun is just absolute posWorld)
                return {
                    pos: { x: posWorld.x, y: posWorld.y, z: posWorld.z },
                    vel: { x: velWorld.x, y: velWorld.y, z: velWorld.z },
                    parentKey: "sun"
                };
            }
            return null; // Stay in Earth SOI
        }

        // 3. If parent is Mars, Jupiter, or Saturn, check if we exit planet SOI to Sun
        if (currentParentKey === "mars" || currentParentKey === "jupiter" || currentParentKey === "saturn") {
            const planetPos = bodiesWorld[currentParentKey].pos;
            const distToPlanet = Math.sqrt(
                Math.pow(posWorld.x - planetPos.x, 2) +
                Math.pow(posWorld.y - planetPos.y, 2) +
                Math.pow(posWorld.z - planetPos.z, 2)
            );
            if (distToPlanet > BODIES[currentParentKey].soi) {
                // Exit planet SOI to Sun
                return {
                    pos: { x: posWorld.x, y: posWorld.y, z: posWorld.z },
                    vel: { x: velWorld.x, y: velWorld.y, z: velWorld.z },
                    parentKey: "sun"
                };
            }
            return null;
        }

        // 4. If parent is Sun, check if we enter Earth, Mars, Jupiter, or Saturn SOI
        if (currentParentKey === "sun") {
            for (let key of ["earth", "mars", "jupiter", "saturn"]) {
                const planetPos = bodiesWorld[key].pos;
                const dist = Math.sqrt(
                    Math.pow(posWorld.x - planetPos.x, 2) +
                    Math.pow(posWorld.y - planetPos.y, 2) +
                    Math.pow(posWorld.z - planetPos.z, 2)
                );
                if (dist < BODIES[key].soi) {
                    // Enter Planet SOI
                    return {
                        pos: { x: posWorld.x - planetPos.x, y: posWorld.y - planetPos.y, z: posWorld.z - planetPos.z },
                        vel: { x: velWorld.x - bodiesWorld[key].vel.x, y: velWorld.y - bodiesWorld[key].vel.y, z: velWorld.z - bodiesWorld[key].vel.z },
                        parentKey: key
                    };
                }
            }
        }

        return null; // No transition
    }

    // === 4. ORBITAL ELEMENT EXTRACTOR ===

    /**
     * Extracts classical orbital elements from Cartesian state vector relative to parent body.
     */
    function getOrbitalElements(pos, vel, parentKey) {
        const parent = BODIES[parentKey];
        const mu = parent.mu;

        // Position & velocity magnitudes
        const r = Math.sqrt(pos.x*pos.x + pos.y*pos.y + pos.z*pos.z);
        const v2 = vel.x*vel.x + vel.y*vel.y + vel.z*vel.z;
        const v = Math.sqrt(v2);

        // 1. Specific Orbital Energy (E)
        const energy = v2 / 2 - mu / r;

        // 2. Semi-major axis (a)
        let a = 0;
        if (Math.abs(energy) > 1e-8) {
            a = -mu / (2 * energy);
        } else {
            a = Infinity; // Parabolic
        }

        // 3. Angular Momentum Vector (h = r x v)
        const hx = pos.y * vel.z - pos.z * vel.y;
        const hy = pos.z * vel.x - pos.x * vel.z;
        const hz = pos.x * vel.y - pos.y * vel.x;
        const h = Math.sqrt(hx*hx + hy*hy + hz*hz);

        // 4. Eccentricity Vector (e)
        // e = ((v^2 - mu/r)*r - (r.v)*v) / mu
        const rDotV = pos.x * vel.x + pos.y * vel.y + pos.z * vel.z;
        const ex = ((v2 - mu / r) * pos.x - rDotV * vel.x) / mu;
        const ey = ((v2 - mu / r) * pos.y - rDotV * vel.y) / mu;
        const ez = ((v2 - mu / r) * pos.z - rDotV * vel.z) / mu;
        const eccentricity = Math.sqrt(ex*ex + ey*ey + ez*ez);

        // 5. Inclination
        const inclination = Math.acos(hz / Math.max(h, 1e-12));

        // 6. True Anomaly (nu)
        let nu = 0;
        if (eccentricity > 1e-6) {
            const eVectorDotR = ex * pos.x + ey * pos.y + ez * pos.z;
            const cosNu = eVectorDotR / (eccentricity * r);
            nu = Math.acos(Math.max(-1, Math.min(1, cosNu)));
            if (rDotV < 0) {
                nu = 2 * Math.PI - nu;
            }
        } else {
            // Circular: angle relative to x-axis
            nu = Math.atan2(pos.y, pos.x);
            if (nu < 0) nu += 2 * Math.PI;
        }

        // 7. Periapsis & Apoapsis Altitudes
        let periapsisAltitude = 0;
        let apoapsisAltitude = 0;
        if (eccentricity < 1.0) {
            // Ellipse
            periapsisAltitude = a * (1 - eccentricity) - parent.radius;
            apoapsisAltitude = a * (1 + eccentricity) - parent.radius;
        } else {
            // Hyperbola / Escape
            periapsisAltitude = Math.abs(a) * (eccentricity - 1) - parent.radius;
            apoapsisAltitude = Infinity;
        }

        // 8. Orbital Period (T = 2*pi * sqrt(a^3 / mu))
        let period = 0;
        if (eccentricity < 1.0) {
            period = 2 * Math.PI * Math.sqrt(Math.pow(a, 3) / mu);
        } else {
            period = Infinity;
        }

        // 9. Argument of Periapsis angle (w) relative to x-axis
        const argumentPeriapsis = Math.atan2(ey, ex);

        return {
            a,
            eccentricity,
            inclination,
            nu,
            energy,
            h,
            periapsisAltitude,
            apoapsisAltitude,
            period,
            omega: argumentPeriapsis,
            ex,
            ey,
            ez
        };
    }

    // === 5. ANALYTICAL CONIC PREDICTION GENERATOR ===

    /**
     * Rebuilds orbit trajectory coordinates analytically using Kepler equations.
     * Prevents frame lag by executing only on burn parameter revisions.
     */
    function getPredictedTrajectory(pos, vel, parentKey, pointsCount = 360) {
        const elements = getOrbitalElements(pos, vel, parentKey);
        const parent = BODIES[parentKey];
        const mu = parent.mu;
        const e = elements.eccentricity;
        const a = elements.a;
        const omega = elements.omega;

        const pathPoints = [];

        // Determine periapsis direction vector (focus to periapsis)
        let dirX = 1;
        let dirY = 0;
        if (e > 1e-5) {
            dirX = elements.ex / e;
            dirY = elements.ey / e;
        } else {
            // Circular: default axes
            dirX = Math.cos(omega);
            dirY = Math.sin(omega);
        }

        const perpX = -dirY;
        const perpY = dirX;

        if (e < 1.0) {
            // Ellipse: Sample true anomaly from 0 to 2*pi
            const p = a * (1 - e * e); // Semi-latus rectum
            for (let i = 0; i <= pointsCount; i++) {
                const nu = (i / pointsCount) * 2 * Math.PI;
                const r = p / (1 + e * Math.cos(nu));
                
                // Rotate coordinates relative to periapsis orientation
                const xLocal = r * Math.cos(nu);
                const yLocal = r * Math.sin(nu);

                pathPoints.push({
                    x: xLocal * dirX + yLocal * perpX,
                    y: xLocal * dirY + yLocal * perpY,
                    z: 0
                });
            }
        } else {
            // Hyperbola: Sample true anomaly within asymptotic bounds: |nu| < arccos(-1/e)
            const limitNu = Math.acos(-1.0 / e) - 0.05; // buffer away from asymptotes
            const p = Math.abs(a) * (e * e - 1);
            
            for (let i = 0; i <= pointsCount; i++) {
                const fraction = (i / pointsCount) * 2 - 1.0; // -1 to 1
                const nu = fraction * limitNu;
                const r = p / (1 + e * Math.cos(nu));

                const xLocal = r * Math.cos(nu);
                const yLocal = r * Math.sin(nu);

                // Stop drawing past SOI radius to keep view clean
                if (r > parent.soi) continue;

                pathPoints.push({
                    x: xLocal * dirX + yLocal * perpX,
                    y: xLocal * dirY + yLocal * perpY,
                    z: 0
                });
            }
        }

        return pathPoints;
    }

    /**
     * Solves velocity vector exactly at a given position on the current orbit.
     * Uses: v = (mu/h) * h_hat x (e_vec + r_hat)
     */
    function getVelocityAtOrbitPosition(posLocal, parentKey, liveShipPos, liveShipVel) {
        const parent = BODIES[parentKey];
        const mu = parent.mu;
        const elements = getOrbitalElements(liveShipPos, liveShipVel, parentKey);

        const r = Math.sqrt(posLocal.x * posLocal.x + posLocal.y * posLocal.y);
        const h = elements.h;
        if (h < 1e-5) return { x: 0, y: 0, z: 0 };

        return {
            x: -(mu / h) * (elements.ey + posLocal.y / r),
            y: (mu / h) * (elements.ex + posLocal.x / r),
            z: 0
        };
    }

    // === 6. REENTRY FLIGHT PATH CORRIDOR ===

    /**
     * Computes the flight path angle gamma (angle between velocity vector and local horizontal).
     * gamma is negative when descending.
     */
    function computeFlightPathAngle(pos, vel) {
        const rMag = Math.sqrt(pos.x*pos.x + pos.y*pos.y + pos.z*pos.z);
        const vMag = Math.sqrt(vel.x*vel.x + vel.y*vel.y + vel.z*vel.z);
        if (rMag < 1e-12 || vMag < 1e-12) return 0;

        const rDotV = pos.x * vel.x + pos.y * vel.y + pos.z * vel.z;
        const sinGamma = rDotV / (rMag * vMag);
        
        // Return angle in degrees
        return Math.asin(Math.max(-1.0, Math.min(1.0, sinGamma))) * 180 / Math.PI;
    }

    // Export public methods
    return {
        BODIES,
        rk4Step,
        updateSOI,
        getOrbitalElements,
        getPredictedTrajectory,
        getVelocityAtOrbitPosition,
        computeFlightPathAngle
    };
})();
