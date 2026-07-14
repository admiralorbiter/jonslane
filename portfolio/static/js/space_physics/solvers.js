/**
 * Shared Numerical Solvers for Space & Physics Simulations
 */

export const Solvers = {
    /**
     * Forward Euler Integrator (Explicit, Unstable for Oscillators)
     * @param {Object} state - State object with properties { x, v, t }
     * @param {Function} forceFunc - Acceleration function: (x, v, t) => acceleration
     * @param {number} dt - Time step size
     */
    forwardEuler(state, forceFunc, dt) {
        const a = forceFunc(state.x, state.v, state.t);
        state.x += state.v * dt;
        state.v += a * dt;
        state.t += dt;
    },

    /**
     * Euler-Cromer Integrator (Symplectic, Stable for Oscillators)
     * @param {Object} state - State object with properties { x, v, t }
     * @param {Function} forceFunc - Acceleration function: (x, v, t) => acceleration
     * @param {number} dt - Time step size
     */
    eulerCromer(state, forceFunc, dt) {
        const a = forceFunc(state.x, state.v, state.t);
        state.v += a * dt;
        state.x += state.v * dt;
        state.t += dt;
    },

    /**
     * Velocity Verlet Integrator (Time-Reversible, Symplectic, Energy-preserving)
     * @param {Object} state - State object with properties { x, v, t }
     * @param {Function} forceFunc - Acceleration function: (x, v, t) => acceleration
     * @param {number} dt - Time step size
     */
    velocityVerlet(state, forceFunc, dt) {
        const a = forceFunc(state.x, state.v, state.t);
        state.x += state.v * dt + 0.5 * a * dt * dt;

        // Predictor step for velocity (needed for velocity-dependent forces like damping)
        const vPredict = state.v + a * dt;

        // Evaluate acceleration at new position and predicted velocity
        const aNext = forceFunc(state.x, vPredict, state.t + dt);

        // Corrector step for velocity
        state.v += 0.5 * (a + aNext) * dt;
        state.t += dt;
    },

    /**
     * Runge-Kutta 4th Order Integrator (General High-Accuracy)
     * @param {Object} state - State object with properties { x, v, t }
     * @param {Function} forceFunc - Acceleration function: (x, v, t) => acceleration
     * @param {number} dt - Time step size
     */
    rk4(state, forceFunc, dt) {
        const x = state.x;
        const v = state.v;
        const t = state.t;

        const dx1 = v;
        const dv1 = forceFunc(x, v, t);

        const dx2 = v + 0.5 * dt * dv1;
        const dv2 = forceFunc(x + 0.5 * dt * dx1, v + 0.5 * dt * dv1, t + 0.5 * dt);

        const dx3 = v + 0.5 * dt * dv2;
        const dv3 = forceFunc(x + 0.5 * dt * dx2, v + 0.5 * dt * dv2, t + 0.5 * dt);

        const dx4 = v + dt * dv3;
        const dv4 = forceFunc(x + dt * dx3, v + dt * dv3, t + dt);

        state.x += (dt / 6) * (dx1 + 2 * dx2 + 2 * dx3 + dx4);
        state.v += (dt / 6) * (dv1 + 2 * dv2 + 2 * dv3 + dv4);
        state.t += dt;
    }
};
