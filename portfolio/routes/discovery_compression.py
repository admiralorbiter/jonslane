"""Discovery Compression Blueprint — /discovery-compression routes.

Counterfactual investigation of the earliest possible dates for scientific
discoveries. For each modern theory T, the project seeks the discovery
horizon y*(T): the earliest year when a historically available experiment
could have compelled belief in at least one structural claim of the theory.
"""

from flask import Blueprint, abort, redirect, render_template, url_for

discovery_compression_bp = Blueprint(
    "discovery_compression",
    __name__,
    url_prefix="/discovery-compression",
    template_folder="../templates",
)

# Centralized metadata for all studies.
# status: "planned"     — card shown as locked/upcoming on the timeline
#         "in-progress" — card shown as active but incomplete
#         "live"        — fully interactive study available
#
# min_hint_level: the minimum Level (0-6) required to compel the discovery.
# horizon:        the estimated earliest testable year (string, displayed on card).
STUDIES = [
    {
        "slug": "discrete-inheritance",
        "title": "Discrete Inheritance",
        "subtitle": "Mendelian Genetics Before Mendel",
        "horizon": "~500 BCE",
        "horizon_year": -500,  # Used for timeline ordering
        "field": "Heredity & Genetics",
        "field_icon": "🫘",
        "min_hint_level": 2,
        "central_question": (
            "Could a Mediterranean-era researcher, with access to crop plants "
            "and sufficient experimental scale, have discovered that hereditary "
            "factors behave as discrete combinatorial units?"
        ),
        "teaser": (
            "Mendel's experiments required peas, counting, and three growing seasons. "
            "All were available in 300 BCE. The 2,000-year delay was not instrumental "
            "— it was a question that was never asked."
        ),
        "status": "live",
        "doc": "studies/discrete_inheritance.md",
        "compression_gap": "~2,000 years",
    },
    {
        "slug": "transmissible-infection",
        "title": "Transmissible Infection",
        "subtitle": "Germ Theory Without Microscopes",
        "horizon": "~1000 CE",
        "horizon_year": 1000,
        "field": "Epidemiology & Medicine",
        "field_icon": "🔬",
        "min_hint_level": 1,
        "central_question": (
            "Could a medieval investigator, without microscopy, have established "
            "by controlled observation that an invisible transmissible agent causes "
            "specific diseases — and that disrupting the transmission prevents it?"
        ),
        "teaser": (
            "Semmelweis proved hand-washing prevents infection in 1847 using no "
            "microscopy at all — only two hospital wards and a count. Medieval "
            "hospitals had both. What stopped the experiment for 800 years?"
        ),
        "status": "planned",
        "doc": "studies/transmissible_infection.md",
        "compression_gap": "~400–900 years",
    },
    {
        "slug": "greenhouse-warming",
        "title": "Greenhouse Warming",
        "subtitle": "Radiative Forcing Before Tyndall",
        "horizon": "~1750 CE",
        "horizon_year": 1750,
        "field": "Atmospheric Physics",
        "field_icon": "🌡️",
        "min_hint_level": 2,
        "central_question": (
            "Could an 18th-century natural philosopher, using existing thermometers "
            "and sealed chambers, have demonstrated that CO₂-enriched air absorbs "
            "more thermal radiation — 100 years before Tyndall?"
        ),
        "teaser": (
            "CO₂ was identified in 1754. Mercury thermometers were precise enough "
            "by 1750. The Herschel near-miss of 1800 came within one experiment "
            "of the answer — and then turned away for 59 years."
        ),
        "status": "planned",
        "doc": "studies/greenhouse_warming.md",
        "compression_gap": "~75–150 years",
    },
    {
        "slug": "molecular-motion",
        "title": "Molecular Motion",
        "subtitle": "Brownian Statistics Before Brown",
        "horizon": "~1700 CE",
        "horizon_year": 1700,
        "field": "Kinetic Theory & Statistical Physics",
        "field_icon": "⚗️",
        "min_hint_level": 3,
        "central_question": (
            "Could an early 18th-century microscopist, observing particles in still fluid, "
            "have recognized that the irregular motion encodes the temperature and size of "
            "underlying molecules — 127 years before Brown described it?"
        ),
        "teaser": (
            "Every microscopist since Leeuwenhoek (1670) observed Brownian motion. "
            "It was classified as instrument vibration, biological activity, or noise. "
            "The signal was in the residuals. No one characterized the residuals."
        ),
        "status": "planned",
        "doc": "studies/molecular_motion.md",
        "compression_gap": "~120–200 years",
    },
    {
        "slug": "continental-motion",
        "title": "Continental Motion",
        "subtitle": "Plate Tectonics Before Wegener",
        "horizon": "~1780 CE",
        "horizon_year": 1780,
        "field": "Geophysics & Earth Science",
        "field_icon": "🗺️",
        "min_hint_level": 1,
        "central_question": (
            "Could a late 18th-century cartographer, using existing maps and fossil "
            "records, have built a scientifically compelling case for continental fit "
            "— 130 years before Wegener's 1912 paper?"
        ),
        "teaser": (
            "Francis Bacon noticed the Atlantic fit in 1620. Accurate maps existed "
            "by 1780. Matching fossils were documented on both continents. The data "
            "was in the libraries. The synthesis required scissors and an atlas."
        ),
        "status": "planned",
        "doc": "studies/continental_motion.md",
        "compression_gap": "~65–130 years",
    },
    {
        "slug": "relativistic-invariance",
        "title": "Relativistic Invariance",
        "subtitle": "Special Relativity After Michelson-Morley",
        "horizon": "~1887 CE",
        "horizon_year": 1887,
        "field": "Electrodynamics & Spacetime",
        "field_icon": "⚡",
        "min_hint_level": 5,
        "central_question": (
            "Why did the null result of the Michelson-Morley experiment (1887) take "
            "18 years to produce special relativity (1905) — given that Lorentz had "
            "the correct transformation equations by 1895?"
        ),
        "teaser": (
            "Lorentz had the equations. Poincaré had the principle. The mathematics "
            "was complete. The delay was a single ontological assumption: that "
            "simultaneity is absolute. Releasing it takes one sentence."
        ),
        "status": "planned",
        "doc": "studies/relativistic_invariance.md",
        "compression_gap": "~18 years",
    },
]


@discovery_compression_bp.route("/")
def index():
    """Render the Discovery Compression landing page with the study timeline."""
    ordered = sorted(STUDIES, key=lambda s: s["horizon_year"])
    return render_template(
        "discovery_compression/index.html",
        studies=ordered,
    )


@discovery_compression_bp.route("/about")
def about():
    """Render the concept and methodology description page."""
    return render_template("discovery_compression/about.html")


# Slug-based lookup
STUDY_BY_SLUG = {s["slug"]: s for s in STUDIES}


@discovery_compression_bp.route("/<slug>/")
@discovery_compression_bp.route("/<slug>")
def study(slug):
    """Render an individual study.

    Planned studies redirect to the index until implementation is complete.
    Unknown slugs return 404.
    """
    s = STUDY_BY_SLUG.get(slug)
    if s is None:
        abort(404)
    if s["status"] == "planned":
        return redirect(url_for("discovery_compression.index"))
    return render_template(
        f"discovery_compression/studies/{slug}.html",
        study=s,
    )

