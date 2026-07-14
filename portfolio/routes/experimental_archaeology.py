"""Experimental Archaeology Blueprint — /experimental-archaeology routes.

Computational reconstruction of historical scientific theories.
Each case study is an interactive executable model of a superseded theory,
evaluated on its own terms before being compared against its successors.
"""

from flask import Blueprint, abort, redirect, render_template, url_for

experimental_archaeology_bp = Blueprint(
    "experimental_archaeology",
    __name__,
    url_prefix="/experimental-archaeology",
    template_folder="../templates",
)

# Centralized metadata for all case studies.
# status: "planned"     — card shown as locked/upcoming on the timeline
#         "in-progress" — card shown as active but incomplete
#         "live"        — fully interactive reconstruction available
CASE_STUDIES = [
    {
        "slug": "ptolemy-copernicus-kepler",
        "title": "Ptolemy, Copernicus & Kepler",
        "subtitle": "Deferents, Epicycles & Ellipses",
        "period": "150 - 1619 CE",
        "period_year": 150,  # Used to position on timeline
        "field": "Planetary Astronomy",
        "field_icon": "🪐",
        "central_question": (
            "How accurately did each model predict Mars, "
            "and which specific observations forced the decision?"
        ),
        "teaser": (
            "Ptolemy's system was not a naive collection of circles. "
            "It was a precision instrument that worked for fifteen centuries. "
            "What exactly did it take to break it?"
        ),
        "status": "live",
        "doc": "case_studies/ptolemy_copernicus_kepler.md",
    },
    {
        "slug": "caloric-theory",
        "title": "Caloric Theory & Carnot",
        "subtitle": "Heat as a Conserved Fluid",
        "period": "1789 - 1850",
        "period_year": 1789,
        "field": "Thermodynamics",
        "field_icon": "🔥",
        "central_question": (
            "How could an incorrect theory of what heat is "
            "produce a correct result about what heat engines can do?"
        ),
        "teaser": (
            "Carnot derived the fundamental efficiency limit of heat engines "
            "using caloric theory — a theory Joule would soon disprove. "
            "His mathematics survived. His physics did not."
        ),
        "status": "planned",
        "doc": "case_studies/caloric_theory.md",
    },
    {
        "slug": "corpuscular-vs-wave-light",
        "title": "Corpuscles vs. Waves",
        "subtitle": "Newton Against Huygens on the Nature of Light",
        "period": "1690 - 1850",
        "period_year": 1690,
        "field": "Optics",
        "field_icon": "🌊",
        "central_question": (
            "Both models explained reflection. "
            "Which experiments actually forced the decision?"
        ),
        "teaser": (
            "The corpuscular and wave models agreed on many observations "
            "for 150 years. They made opposite predictions about the speed "
            "of light in dense media. One prediction was right."
        ),
        "status": "planned",
        "doc": "case_studies/corpuscular_vs_wave_light.md",
    },
    {
        "slug": "cartesian-vortices",
        "title": "Cartesian Vortex Cosmology",
        "subtitle": "Planets Carried by Swirling Matter",
        "period": "1644 - 1700",
        "period_year": 1644,
        "field": "Celestial Mechanics",
        "field_icon": "🌀",
        "central_question": (
            "Can a fluid vortex generate stable, approximately Keplerian orbits? "
            "What fluid properties would be required?"
        ),
        "teaser": (
            "Descartes found Newton's gravity philosophically unacceptable — "
            "action at a distance with no mechanism. His alternative was vortices "
            "in a pervasive material medium. A fluid simulation can test it directly."
        ),
        "status": "planned",
        "doc": "case_studies/cartesian_vortices.md",
    },
    {
        "slug": "luminiferous-ether",
        "title": "The Luminiferous Ether",
        "subtitle": "A Family Tree of Modifications",
        "period": "1818 - 1905",
        "period_year": 1818,
        "field": "Electrodynamics",
        "field_icon": "⚡",
        "central_question": (
            "At each branch of the ether family tree, "
            "what experiment ruled out that version — and was any version truly ruled out?"
        ),
        "teaser": (
            "The ether was not a single theory. It was a sequence of modified theories, "
            "each adapting to new experimental pressure. Lorentz ether theory is still "
            "empirically equivalent to special relativity."
        ),
        "status": "planned",
        "doc": "case_studies/luminiferous_ether.md",
    },
    {
        "slug": "le-sage-gravity",
        "title": "Le Sage Mechanical Gravity",
        "subtitle": "Push Gravity from Particle Bombardment",
        "period": "1748 - 1900",
        "period_year": 1748,
        "field": "Gravitational Theory",
        "field_icon": "⚫",
        "central_question": (
            "A particle bombardment model can generate an inverse-square force. "
            "What unobserved consequences does it also predict?"
        ),
        "teaser": (
            "Le Sage gravity offers a tangible mechanism where Newton offers a law. "
            "The mechanism works. But it also predicts orbital drag, "
            "gravitational heating, and shielding — none of which are observed."
        ),
        "status": "planned",
        "doc": "case_studies/le_sage_gravity.md",
    },
]


@experimental_archaeology_bp.route("/")
def index():
    """Render the Experimental Archaeology landing page with the chronological timeline."""
    # Sort by period_year for timeline ordering
    ordered = sorted(CASE_STUDIES, key=lambda cs: cs["period_year"])
    return render_template(
        "experimental_archaeology/index.html",
        case_studies=ordered,
    )


@experimental_archaeology_bp.route("/about")
def about():
    """Render the concept and methodology description page."""
    return render_template("experimental_archaeology/about.html")


# Slug-based lookup for the case_study route
CASE_STUDY_BY_SLUG = {cs["slug"]: cs for cs in CASE_STUDIES}


@experimental_archaeology_bp.route("/<slug>/")
@experimental_archaeology_bp.route("/<slug>")
def case_study(slug):
    """Render an individual case study reconstruction.

    Planned studies redirect to the landing page index until their
    full implementation is complete. Unknown slugs return 404.
    """
    cs = CASE_STUDY_BY_SLUG.get(slug)
    if cs is None:
        abort(404)
    if cs["status"] == "planned":
        return redirect(url_for("experimental_archaeology.index"))
    return render_template(
        "experimental_archaeology/case_study.html",
        case_study=cs,
    )
