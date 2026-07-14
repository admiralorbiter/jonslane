import json
import math
import os

# Keplerian elements and rates for J2000 (from JPL approximate positions)
# T is in Julian centuries since J2000.0 (JD 2451545.0)
# We use standard Keplerian formulas to back-project planetary locations.
ELEMENTS = {
    "earth": {
        "a": (1.00000261, 0.0),
        "e": (0.01671123, -0.00003804),
        "i": (-0.00001531, -0.01294668),
        "L": (100.46457166, 35999.37244981),
        "long_peri": (102.93768193, 0.32327364),
        "long_node": (0.0, 0.0),
    },
    "mars": {
        "a": (1.52371034, 0.0),
        "e": (0.09339410, 0.00007882),
        "i": (1.84969142, -0.00081059),
        "L": (355.44656795, 19140.30268499),
        "long_peri": (336.05637041, 0.44385754),
        "long_node": (49.55953891, -0.29257343),
    }
}

def solve_kepler(m_val, e_val):
    """Solve Kepler's equation M = E - e sin E using Newton-Raphson."""
    # M must be in radians
    e_anomaly = m_val
    for _ in range(15):
        delta = e_anomaly - e_val * math.sin(e_anomaly) - m_val
        e_anomaly -= delta / (1.0 - e_val * math.cos(e_anomaly))
    return e_anomaly

def get_position(body, t_cent):
    """Calculate the 3D heliocentric coordinates of a body at century T."""
    el = ELEMENTS[body]

    # Calculate parameters at time T
    a = el["a"][0] + el["a"][1] * t_cent
    e = el["e"][0] + el["e"][1] * t_cent
    i = math.radians(el["i"][0] + el["i"][1] * t_cent)
    l_val = math.radians(el["L"][0] + el["L"][1] * t_cent)
    long_peri = math.radians(el["long_peri"][0] + el["long_peri"][1] * t_cent)
    long_node = math.radians(el["long_node"][0] + el["long_node"][1] * t_cent)

    # Argument of perihelion (omega) and longitude of ascending node (Omega)
    omega = long_peri - long_node
    omega_node = long_node

    # Mean anomaly
    m_val = l_val - long_peri
    # Normalize M to [0, 2*pi]
    m_val = m_val % (2.0 * math.pi)

    # Solve Kepler's equation
    e_anomaly = solve_kepler(m_val, e)

    # Coordinates in orbital plane
    x_orbit = a * (math.cos(e_anomaly) - e)
    y_orbit = a * math.sqrt(1.0 - e*e) * math.sin(e_anomaly)

    # Rotate to 3D ecliptic coordinates
    cos_o = math.cos(omega_node)
    sin_o = math.sin(omega_node)
    cos_w = math.cos(omega)
    sin_w = math.sin(omega)
    cos_i = math.cos(i)
    sin_i = math.sin(i)

    # Rotation matrix elements
    r11 = cos_o * cos_w - sin_o * sin_w * cos_i
    r12 = -cos_o * sin_w - sin_o * cos_w * cos_i
    r21 = sin_o * cos_w + cos_o * sin_w * cos_i
    r22 = -sin_o * sin_w + cos_o * cos_w * cos_i
    r31 = sin_w * sin_i
    r32 = cos_w * sin_i

    x = r11 * x_orbit + r12 * y_orbit
    y = r21 * x_orbit + r22 * y_orbit
    z = r31 * x_orbit + r32 * y_orbit

    return x, y, z

def generate_dataset():
    start_year = 1580.0
    end_year = 1600.0
    days_step = 5.0

    records = []

    # J2000 Julian date = 2451545.0
    # Let's map years to days since J2000.0 assuming 365.25 days per year
    total_days = (end_year - start_year) * 365.25
    steps = int(total_days / days_step)

    for step in range(steps + 1):
        days_offset = step * days_step
        fractional_year = start_year + (days_offset / 365.25)

        # Calculate centuries T since J2000.0
        # Year 2000 is T = 0
        t_cent = (fractional_year - 2000.0) / 100.0

        # Earth & Mars heliocentric positions
        xe, ye, ze = get_position("earth", t_cent)
        xm, ym, zm = get_position("mars", t_cent)

        # Geocentric coordinates
        xg = xm - xe
        yg = ym - ye
        zg = zm - ze

        # Geocentric ecliptic longitude (0 to 360 deg)
        lon = math.degrees(math.atan2(yg, xg)) % 360.0
        # Geocentric ecliptic latitude
        dist_2d = math.sqrt(xg*xg + yg*yg)
        lat = math.degrees(math.atan2(zg, dist_2d))

        # Heliocentric longitudes for orbit visualization
        lon_e_helio = math.degrees(math.atan2(ye, xe)) % 360.0
        lon_m_helio = math.degrees(math.atan2(ym, xm)) % 360.0

        # Orbital radii
        r_e = math.sqrt(xe*xe + ye*ye + ze*ze)
        r_m = math.sqrt(xm*xm + ym*ym + zm*zm)

        records.append({
            "step": step,
            "year": round(fractional_year, 4),
            "days_offset": days_offset,
            # Apparent geocentric coords (observables)
            "lon": round(lon, 4),
            "lat": round(lat, 4),
            # Helio positions (for rendering orrery)
            "earth_helio": {
                "x": round(xe, 6),
                "y": round(ye, 6),
                "z": round(ze, 6),
                "lon": round(lon_e_helio, 4),
                "r": round(r_e, 6)
            },
            "mars_helio": {
                "x": round(xm, 6),
                "y": round(ym, 6),
                "z": round(zm, 6),
                "lon": round(lon_m_helio, 4),
                "r": round(r_m, 6)
            }
        })

    # Save the output file
    target_dir = os.path.join("portfolio", "static", "data", "experimental_archaeology")
    os.makedirs(target_dir, exist_ok=True)
    target_file = os.path.join(target_dir, "mars_1580_1600.json")

    with open(target_file, "w") as f:
        json.dump(records, f, indent=2)

    print(f"Generated {len(records)} data points. Saved to {target_file}")

if __name__ == "__main__":
    generate_dataset()
