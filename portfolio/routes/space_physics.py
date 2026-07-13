"""Space & Physics Blueprint — /space-physics and subtopics."""

import re

from flask import Blueprint, abort, current_app, render_template
from jinja2 import TemplateNotFound

# Main blueprint for the section
space_physics_bp = Blueprint(
    "space_physics",
    __name__,
    url_prefix="/space-physics",
    template_folder="../templates",
)

# Centralized metadata for space & physics subtopics
PHYSICS_METADATA = {
    "particle-1d": {
        "title": "A Particle in 1D",
        "category": "Classical Mechanics",
        "description": "What information do we need to predict the future state of a one-dimensional particle?",
        "icon": "⚛",
        "status": "active",
    },
    "galilean-relativity": {
        "title": "Galilean Relativity",
        "category": "Classical Mechanics",
        "description": "How coordinate systems shift for moving observers, and why physical laws are invariant.",
        "icon": "🚄",
        "status": "active",
    },
    "special-relativity": {
        "title": "Special Relativity",
        "category": "Relativity",
        "description": "How the speed of light breaks classical physics, warps space and time, and bends the geometry of spacetime.",
        "icon": "⚡",
        "status": "active",
    },
    "expanding-universe": {
        "title": "Expanding Universe",
        "category": "Cosmology",
        "description": "What quantity changes when the universe expands? Visualize scale factors, Hubble flow, and comoving space.",
        "icon": "🌌",
        "status": "active",
    },
    "redshift-cmb": {
        "title": "Redshift & CMB",
        "category": "Cosmology",
        "description": "How does light propagate through expanding space? Discover cosmological redshift, recombination, and the Cosmic Microwave Background.",
        "icon": "📡",
        "status": "active",
    },
    "spacetime-fabric": {
        "title": "Fabric of Spacetime",
        "category": "Relativity",
        "description": "How mass warps the coordinate system of space and time, and why light bends around stars.",
        "icon": "🪐",
        "status": "draft",
    },
    "quantum-wavefunction": {
        "title": "Quantum Wavefunction",
        "category": "Quantum Physics",
        "description": "Step into the quantum sandbox. Draw potential wells, observe tunneling, compute energy levels, and collapse superpositions in this interactive quest lab.",
        "icon": "Δ",
        "status": "active",
    },
    "orbital-mechanics": {
        "title": "Orbital Mechanics",
        "category": "Space Physics",
        "description": "Pilot a spacecraft using gravitational assists, Hohmann transfers, and patched conics in this 3D orbit simulator.",
        "icon": "⟲",
        "status": "active",
    },
}

# Allowlist for valid URL path segments
_SLUG_RE = re.compile(r"^[a-zA-Z0-9_-]+$")


@space_physics_bp.route("/")
def index():
    """Render the Space & Physics landing page with the interactive galaxy."""
    return render_template("space_physics/index.html", topics=PHYSICS_METADATA)


@space_physics_bp.route("/<path:page_path>")
def render_page(page_path):
    """Dynamically route to subpage template files.

    URL slug convention: dashes in URL segments map to underscores in template
    filenames (e.g. 'particle-1d' → 'particle_1d.html').
    """
    clean_path = page_path.strip("/")
    parts = clean_path.split("/")

    # Security: block traversal and enforce slug contract.
    if any(not _SLUG_RE.match(p) for p in parts):
        abort(404)

    # Convert dashes to underscores for template filename convention
    safe_parts = [p.replace("-", "_") for p in parts]
    resolved_path = "/".join(safe_parts)

    template_path = f"space_physics/pages/{resolved_path}.html"

    try:
        current_app.jinja_env.get_template(template_path)
        selected_template = template_path
    except TemplateNotFound:
        abort(404)

    # Find key metadata for this subtopic to pass to the template
    slug = parts[-1]
    metadata = PHYSICS_METADATA.get(
        slug,
        {
            "title": slug.replace("-", " ").title(),
            "category": "Space & Physics",
            "description": "",
            "icon": "☄",
            "status": "active",
        },
    )

    return render_template(selected_template, metadata=metadata)
