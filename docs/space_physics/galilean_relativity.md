# Galilean Relativity | Technical Specification

This document details the mathematical formulations and simulation mechanics behind the dedicated **Galilean Relativity: Whose State?** explorable explanation page.

---

## 1. Kinematic Formulations & Trajectory Shapes

### Chapter 1: Observer Coordinate Shifting
An observer $S$ (stationary) and an observer $S'$ (moving at velocity $u$) measure the position of a particle.
*   Lab frame coordinates: $x, t$
*   Moving frame coordinates: $x', t'$
*   Galilean coordinate transformations:
    $$x' = x - u t, \quad t' = t$$

### Chapter 2: The Ball in the Train
A ball is thrown vertically from a train car traveling horizontally at speed $u$. Let $t$ be the time elapsed since the throw.
*   **Train Frame $S'$:**
    The train observer travels with the train and sees only vertical motion:
    $$x'(t) = 0$$
    $$y'(t) = v_{\text{throw}} t - \frac{1}{2} g t^2$$
    *Shape:* A vertical line up and down.
*   **Ground Frame $S$:**
    The ground observer sees both horizontal and vertical motion:
    $$x(t) = u t$$
    $$y(t) = v_{\text{throw}} t - \frac{1}{2} g t^2$$
    *Shape:* A parabolic curve.
*   **Invariance of Acceleration:**
    In both frames, gravity is identical:
    $$a_y = a_y' = -g$$

---

## 2. Dynamic Systems & Symmetry

### Chapter 4: Harmonic Oscillator Frame Boosts
A particle attached to a spring oscillates about the origin.
*   **In the Spring Frame $S$:**
    The equation of motion is:
    $$m \frac{d^2x}{dt^2} = -k x$$
*   **In the Moving Frame $S'$:**
    Substituting $x = x' + u t$ (where $u$ is constant):
    $$\frac{d^2x}{dt^2} = \frac{d^2}{dt^2}(x' + ut) = \frac{d^2x'}{dt^2}$$
    Thus:
    $$m \frac{d^2x'}{dt^2} = -k (x' + u t) - F_{\text{inertial}}$$
    Wait, in an inertial frame, $F_{\text{inertial}} = 0$. The spring's physical anchor shifts at speed $-u$ relative to $S'$. The physical distance from the anchor to the mass is still $(x' - x'_{\text{anchor}}) = (x' - (-ut)) = x' + ut = x$.
    Therefore, the spring force remains $F = -k x$. The acceleration is invariant:
    $$a' = a$$

---

## 3. Relative Velocity Navigation (Game Mode)

### Chapter 5: Asteroid Chase
A rocket chases an asteroid in deep space.
*   Velocity of Asteroid in Earth frame: $v_A$
*   Velocity of Rocket in Earth frame: $v_R$
*   **In the Rocket Frame $S'$:**
    The rocket is stationary ($v'_R = 0$). The relative velocity of the asteroid is:
    $$v_{\text{rel}} = v_A - v_R$$
*   **Interactive Challenge:**
    The user can toggle frames to view the approach. They must input the correct $v_{\text{rel}}$ value to solve the challenge.

---

## 4. Galilean vs. Special Relativity

### Chapter 6: High-Speed Relativistic Divergence
When velocities approach the speed of light $c$, Galilean velocity addition fails. We model a scaled speed of light $c = 100\,\text{m/s}$ for interactive visibility.
*   **Galilean Velocity Addition:**
    $$v_{\text{Galilean}} = u + v'$$
*   **Lorentz Velocity Addition:**
    $$v_{\text{Lorentz}} = \frac{u + v'}{1 + \frac{u v'}{c^2}}$$
*   **Visual comparison (Race Tracks):**
    The page renders a side-by-side comparison of two universe models (Galilean vs. Einsteinian) using two racing tracks. Each track displays a moving train (moving at frame speed $u$) and a runner moving inside the train (speed $v'$ relative to the train). 
    *   In the **Galilean Universe**, the runner's ground speed is simply $u + v'$. If this exceeds the toy speed of light ($100\,\text{m/s}$), a warning overlay is shown.
    *   In the **Einsteinian Universe**, the runner's speed asymptotes to $c$ and can never exceed $100\,\text{m/s}$, illustrating the relativistic speed limit.
