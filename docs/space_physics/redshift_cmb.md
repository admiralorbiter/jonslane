# Redshift & CMB Cosmology | Technical Specification

This document details the mathematical models, cosmological integrals, and physics equations implemented in the **Redshift & CMB** explorable explanation page (`redshift_cmb.html`).

---

## 1. Spectral Lines & Shift Definitions

Spectral lines correspond to quantum energy transitions in atoms. In the lab frame, hydrogen has a known rest wavelength $\lambda_0$.

### Redshift Parameter $z$
$$z \equiv \frac{\lambda_{\text{obs}} - \lambda_0}{\lambda_0}$$

*   $z = 0$: No shift.
*   $z > 0$: Redshifted (stretched to longer wavelengths).
*   $z < 0$: Blueshifted (compressed to shorter wavelengths).

### Radial Relativistic Doppler Shift
For a source moving locally through space relative to an observer with a peculiar velocity $v$ along the line of sight:
$$1 + z = \sqrt{\frac{1 + \beta}{1 - \beta}} \qquad \text{where } \beta = \frac{v}{c}$$

At low velocity ($v \ll c$), this reduces to the non-relativistic approximation:
$$z \approx \frac{v}{c}$$

### Multiplicative Redshift Combination
For real astronomical observations, different redshift mechanisms combine approximately multiplicatively:
$$1 + z_{\text{observed}} = (1 + z_{\text{cos}})(1 + z_{\text{pec}})(1 + z_{\text{grav}})$$
where $z_{\text{cos}}$ is the cosmological redshift, $z_{\text{pec}}$ is the peculiar Doppler shift, and $z_{\text{grav}}$ is the gravitational redshift.

---

## 2. Cosmological Redshift & Lookback Time

For light traveling across cosmological distances, successive comoving observers measure the photon's wavelength to increase as the scale factor grows during its journey. The cosmological component of redshift relates the observed and emitted scale factors through:
$$a_{\text{emitted}} = \frac{a_0}{1 + z_{\text{cos}}} \qquad \text{where } a_0 \text{ is the scale factor today}$$

With the normalization $a_0 = 1$ today, this simplifies to:
$$a_{\text{emitted}} = \frac{1}{1 + z_{\text{cos}}}$$

### The Friedmann Integrals
To calculate lookback time $t_L$ and comoving distance $\chi(z)$, we integrate the Hubble parameter $H(z)$:
$$H(z) = H_0 \sqrt{\Omega_m(1+z)^3 + \Omega_r(1+z)^4 + \Omega_{\Lambda}}$$

1.  **Lookback Time $t_L(z)$:**
    $$t_L(z) = \int_0^z \frac{dz'}{(1+z') H(z')}$$
2.  **Comoving Distance $\chi(z)$:**
    $$\chi(z) = \int_0^z \frac{c \, dz'}{H(z')}$$

### Numerical Precomputation
To avoid performance issues, a precomputed lookup table is constructed at load time using log-spaced steps in $u = \ln(1+z)$ from $z=0$ to $z=1100$.
*   **Cosmological Parameters (Planck 2018):**
    *   $H_0 = 67.4\,\text{km/s/Mpc}$
    *   $\Omega_m = 0.315$
    *   $\Omega_{\Lambda} = 0.685$
    *   $\Omega_r = 9.24 \times 10^{-5}$

---

## 3. Surface of Last Scattering & Recombination

The early universe was a hot, ionized plasma where free electrons scatter photons via Thomson scattering with cross-section:
$$\sigma_T \approx 6.65 \times 10^{-29}\,\text{m}^2$$

### Recombination Transition
As the temperature cooled below $T \approx 3000\,\text{K}$ ($z \approx 1089$), the fraction of free electrons fell rapidly as electrons became bound in neutral hydrogen atoms. The photon mean free path increased, and radiation decoupled from matter over a finite period (spanning $\Delta z \approx 80$, ~70,000 years) rather than at one sharp moment. The universe became increasingly transparent, allowing photons to begin free-streaming over cosmological distances. The scatter probability drops according to a sigmoidal transition:
$$\text{scatterProb}(T) = \frac{1}{1 + e^{-(T - 3000)/\Delta T}} \qquad (\Delta T \approx 200\,\text{K})$$

---

## 4. Blackbody Radiation & CMB

A thermalized photon-baryon plasma behaves as a blackbody. The spectral radiance is given by Planck's law:
$$B_{\nu}(T) = \frac{2h\nu^3}{c^2} \frac{1}{e^{h\nu/k_B T} - 1}$$

### Temperature Stretching
As the wavelength stretches ($\lambda \propto a(t)$), Wien's displacement law ($\lambda_{\text{peak}} \propto 1/T$) dictates that the temperature cools:
$$T(t) = \frac{T_0}{a(t)} \qquad (T_0 \approx 2.7255\,\text{K})$$

At decoupling ($a \approx 1/1090$), the temperature was $T \approx 3000\,\text{K}$. Today, it is redshifted to $2.7255\,\text{K}$ in the microwave band.

---

## 5. Standardizable Candles & Luminosity Distance

Type Ia supernovae are **standardizable candles**: observations of their light curves and colors allow astronomers to infer a corrected, standardized intrinsic luminosity $L$. The observed apparent flux $F$ relates to distance via:
$$F = \frac{L}{4\pi D_L^2}$$
where $D_L$ is the **luminosity distance**. In a flat universe:
$$D_L(z) = (1+z) \chi(z)$$

Measuring the apparent flux of Type Ia supernovae at various redshifts allows us to map $D_L(z)$ and discover the acceleration of cosmic expansion ($\ddot{a} > 0$). Distant supernovae are unresolved point sources; astronomers estimate their distances from changes in flux (apparent magnitude) and signal-to-noise ratio rather than angular size.

---

## 6. Cosmic Horizons

Three key distance metrics define cosmic boundaries:

1.  **Hubble Radius ($d_H$):**
    $$d_H(t) \equiv \frac{c}{H(t)} \approx 14.4\,\text{Gly today}$$
2.  **Particle Horizon ($d_{\text{PH}}$) - Limit of Visibility:**
    $$d_{\text{PH}}(t) = a(t) \int_0^t \frac{c \, dt'}{a(t')} \approx 46.5\,\text{Gly today}$$
3.  **Event Horizon ($d_{\text{EH}}$) - Limit of Reachability:**
    $$d_{\text{EH}}(t) = a(t) \int_t^{\infty} \frac{c \, dt'}{a(t')} \approx 16.5\,\text{Gly today in } \Lambda\text{CDM}$$

*Note: Much of the currently observable universe lies beyond the region that signals sent today could ever reach in the standard $\Lambda$CDM model. The exact fraction of observable galaxies is not captured by simply comparing horizon radii.*

*The event horizon exists only in universes that accelerate eternally. In a flat matter-only universe, $d_{\text{EH}} \to \infty$ (no event horizon).*
