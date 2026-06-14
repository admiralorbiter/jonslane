# Count Me In | Research Bibliography & Citations

This document compiles the academic publications, MIR research, and professional DJ workflow documentations that ground the design and future developments of the "Count Me In" BPM ear-trainer.

---

## 1. Core Academic Research (Tempo Judgment & Memory)

### [1] Foster, N. E. V., Beffa, L., & Lehmann, A. (2021). Accuracy of Tempo Judgments in Disk Jockeys Compared to Musicians and Untrained Individuals. *Frontiers in Psychology*.
*   **Summary:** Compares the accuracy of professional DJs (10+ years experience, mixing by ear without sync software), percussionists, melodic musicians, and untrained controls on metronome tempo estimation (80–160 BPM).
*   **Count Me In Application:** Grounded the "House Crate" (118–132 BPM range) as the "DJ working range," showing DJs achieved a low ~3.10% error in the 120–139 BPM range compared to 7.91% for untrained individuals. This also justifies the **3.0% "DJ-Ready" scoring threshold** as a realistic expert standard.
*   **Follow-up Keywords:** Auditory imagery, tempo discrimination, sensorimotor synchronization, expertise-dependent plasticity.

### [2] Levitin, D. J., & Cook, P. R. (1996). Memory for musical tempo: Additional evidence that auditory memory is absolute. *Cognitive Psychology / Perception & Psychophysics*.
*   **Summary:** Classic tempo-memory experiment demonstrating that absolute tempo features of familiar popular songs are preserved in long-term memory. 72% of participant singing trials fell within 8% of the song's actual reference tempo.
*   **Count Me In Application:** Justifies the **8.0% "Getting There" scoring threshold** as the boundary of absolute human tempo memory. Supports the creation of an **Anchor Training mode** where players learn stable absolute reference tempos.
*   **Follow-up Keywords:** Absolute tempo memory, auditory representation, Levitin effect, pitch memory.

### [3] Vigl, J., Koehler, F., & Henning, H. (2024). Exploring the accuracy of musical tempo memory: The effects of reproduction method, reference tempo, and musical expertise. *Memory & Cognition*.
*   **Summary:** Large-scale study ($N=403$) exploring tempo memory across different reproduction methods (tapping vs. tempo-adjustment) and reference tempos. Found that musical expertise increases accuracy, tempo-adjustment is more precise than tapping, and reproduction is most accurate around 120 BPM.
*   **Count Me In Application:** Informs the V2 Tap-Tempo input mode and tempo-adjustment (nudge) features, and handles metrical level mismatch (eighth vs. quarter note perception).
*   **Follow-up Keywords:** Tempo reproduction, tempo adjustment, motor execution, beat rate perception.

### [4] Moelants, D. (2003). Dance Music, Movement and Tempo Preferences. *Proceedings of the 5th Triennial ESCOM Conference*.
*   **Summary:** Analyzes large DJ-oriented BPM databases. Identifies a dominant dance-music tempo peak around 128 BPM (with 57.2% of track tempos falling between 120 and 140 BPM) and a secondary hip-hop/R&B peak around 95 BPM.
*   **Count Me In Application:** Confirms that the House and Beginner crate boundaries represent standard physical and cultural preferences for rhythmic synchronization.
*   **Follow-up Keywords:** Preferred tempo, tactus, dance music statistics, physical synchronization.

### [5] Repp, B. H., & Su, Y.-H. (2013). Sensorimotor synchronization: A review of recent research (2006–2012). *Psychonomic Bulletin & Review*.
*   **Summary:** Comprehensive review of sensorimotor synchronization (SMS) research, covering finger-tapping tasks, timing consistency, auditory-motor integration, and metrical subdivisions.
*   **Count Me In Application:** Provides the theoretical backing for evaluating "tap stability" (standard deviation of tap intervals) in the V2 Tap-Tempo mode.
*   **Follow-up Keywords:** Sensorimotor synchronization, phase correction, period correction, micro-timing.

---

## 2. Music Information Retrieval (MIR) & Beat Tracking

### [6] Ellis, D. P. W. (2007). Beat Tracking by Dynamic Programming. *Journal of New Music Research*.
*   **Summary:** Describes a robust beat tracker that measures onset strength, estimates global tempo using autocorrelation, and uses dynamic programming to pick beat locations that align with transients while maintaining a regular interval.
*   **Count Me In Application:** Formulates the basis of the V3 "Algorithm Ghost" comparison.
*   **Follow-up Keywords:** Dynamic programming, onset detection, transition cost, beat induction.

### [7] McFee, B., et al. (2015). librosa: Audio and Music Signal Analysis in Python. *Proceedings of the 14th Python in Science Conference*.
*   **Summary:** Explains Librosa's beat tracking module (`librosa.beat.beat_track`), which uses Ellis-style onset estimation and tempo correlation.
*   **Count Me In Application:** Practical python tool for prototyping V3 backend machine estimation.
*   **Follow-up Keywords:** Onset envelope, tempogram, dynamic beat tracking.

### [8] Klapuri, A. P., Eronen, A. J., & Astola, J. (2006). Analysis of the meter of acoustic musical signals. *IEEE Transactions on Audio, Speech and Language Processing*.
*   **Summary:** Seminal work on meter analysis that tracks rhythm across three distinct levels: tatum (shortest intervals), tactus (beat/tempo rate), and measure (bar level).
*   **Count Me In Application:** Justifies the "Metrical Match" rating. Explains why half-time and double-time guesses are not failures, but rather valid selections of alternative metrical tiers (tactus vs. measure rate).
*   **Follow-up Keywords:** Tatum, tactus, measure, metrical hierarchy, accentuation.

### [9] Gouyon, F., et al. (2006). An experimental comparison of audio tempo induction algorithms. *IEEE Transactions on Audio, Speech and Language Processing*.
*   **Summary:** Large-scale evaluation of 12 tempo induction algorithms. Discusses why algorithms frequently make "octave errors" (doubling or halving the tempo) due to rhythmic accentuation patterns.
*   **Count Me In Application:** Highlights that metrical ambiguity is a shared challenge between human listeners and software.
*   **Follow-up Keywords:** Tempo induction, periodicity detection, comb filter bank, autocorrelation.

### [10] Raffel, C., et al. (2014). mir_eval: A Transparent Implementation of Common MIR Metrics. *Proceedings of the 15th ISMIR*.
*   **Summary:** Evaluates the `mir_eval.tempo` metric, which uses two reference tempos (allowing half/double matches) and a standard tolerance threshold of 8% to evaluate estimation accuracy.
*   **Count Me In Application:** Provides academic justification for our 8% scoring window and for awarding partial credit to metrical matches.
*   **Follow-up Keywords:** MIR evaluation, evaluation metrics, tempo tolerance, double-BPM evaluation.

### [11] Essentia / Percival, S., & Tzanetakis, G. (2014). Radar: A System for Real-time Beat Tracking.
*   **Summary:** Documents Essentia's `RhythmExtractor2013` and `PercivalBpmEstimator` algorithms, which use pulse correlation and autocorrelation to estimate global tempo and confidence.
*   **Count Me In Application:** High-performance technical resource for V3 comparison.
*   **Follow-up Keywords:** Autocorrelation, beat interval, confidence scoring.

### [12] Böck, S., et al. (2016). madmom: a new Python Audio and Music Signal Processing Library. *Proceedings of the 24th ACM Multimedia Conference*.
*   **Summary:** Introduces a library specialized in neural-network-based onset, beat, downbeat, and tempo estimation.
*   **Count Me In Application:** Provides tools for advanced downbeat estimation, supporting the V3 beatgrid alignment minigames.
*   **Follow-up Keywords:** Recurrent Neural Network, downbeat tracking, DBN (Dynamic Bayesian Network).

### [13] Davies, M. E. P., Böck, S., & Fuentes, M. (2021). *Tempo, Beat, and Downbeat Estimation*. ISMIR Tutorial.
*   **Summary:** Complete reference tutorial reviewing signal-processing, deep learning, evaluation datasets, and common failure states in automatic tempo estimation.
*   **Count Me In Application:** Comprehensive reference guide for understanding metrical and downbeat structures.
*   **Follow-up Keywords:** Beat tracking history, deep learning temporal models, dynamic programming.

---

## 3. Professional DJ Workflows & Software Documentation

### [14] Serato DJ Pro. BPM Analysis Ranges.
*   **Summary:** Serato's user documentation explaining that setting the correct target BPM range (e.g. 58–115 or 98–195) is required during file ingestion to prevent the analyzer from halving or doubling the BPM.
*   **Count Me In Application:** Connects our Metrical Match check directly to real-world DJ tools.
*   **Follow-up Keywords:** Serato BPM analysis, half-BPM grid, double-BPM grid.

### [15] Serato Support. Beatgrids in Serato DJ Pro.
*   **Summary:** Explains that beatgrids are essential for syncing and loops, and highlights that software can lock onto the wrong transient (such as a sweep or snare) instead of the downbeat (beat 1).
*   **Count Me In Application:** Supports the V3 Beatgrid Correction minigame concept.
*   **Follow-up Keywords:** Downbeat marker, grid contraction, transient detection.

### [16] Native Instruments. How to Set Beatgrids in TRAKTOR.
*   **Summary:** Details the manual grid-setting panel, downbeat alignment, metronome verification, and the use of `/2` and `x2` buttons to resolve octave errors.
*   **Count Me In Application:** Direct design inspiration for V3 beatgrid shifting and division correction.
*   **Follow-up Keywords:** Traktor grid marker, tempo edit, metronome click.

### [17] Native Instruments. Traktor BPM Analysis Errors.
*   **Summary:** Traktor support article confirming that half-time and double-time errors (e.g. detecting 65 instead of 130 BPM) are common analysis anomalies.
*   **Count Me In Application:** Explains why half/double errors are musical ambiguities, not generic errors.
*   **Follow-up Keywords:** Grid division, double tempo sync.

### [18] AlphaTheta / rekordbox. rekordbox 7 Instruction Manual.
*   **Summary:** rekordbox manual detailing the "Beat/BPM Sync" options, grid shifting, widening/narrowing spacing, and tap-tempo entry.
*   **Count Me In Application:** Outlines pro-DJ standards for tempo-matching grids.
*   **Follow-up Keywords:** Tap BPM, grid stretch, Rekordbox sync.

---

## 4. Advanced Music Perception & AI

### [19] Luck, G. (2023). AI and Tempo Estimation: A Review.
*   **Summary:** Surveys machine learning models for tempo estimation, discussing whether deep neural networks replicate human tempo perception idiosyncrasies.
*   **Count Me In Application:** Useful reference for explaining why some syncopations confuse software.
*   **Follow-up Keywords:** CNN tempo estimation, human vs machine perception.

### [20] Souza, M. S. de O. de, et al. (2021). Music Tempo Estimation via Neural Networks.
*   **Summary:** Compares neural-network tempo estimators across datasets. Notes that performance is highest on percussion-only signals.
*   **Count Me In Application:** Validates our "Clue Layers" (Kick/Snare/Hat-only) as a way to simplify tempo estimation for both humans and AI.
*   **Follow-up Keywords:** Rhythm-only analysis, network accuracy, transient salience.

### [21] Di Giorgi, B., Mauch, M., & Levy, M. (2021). Downbeat Tracking with Tempo-Invariant Convolutional Neural Networks.
*   **Summary:** Describes a tempo-invariant CNN model designed to detect the first beat of a bar (the downbeat) across a wide range of tempos.
*   **Count Me In Application:** Contextual framework for designing V3 downbeat-detection trainers.
*   **Follow-up Keywords:** Downbeat tracking, convolutional neural networks, tempo invariance.

---

## 5. Rhythm Pedagogy & Embodied Learning (Academy & Piano Lab)

### [22] Gordon, E. E. (2007). *Learning Sequences in Music: A Contemporary Music Learning Theory*. GIA Publications.
*   **Summary:** Gordon's Music Learning Theory introduces "audiation" — the ability to hear and comprehend music internally, even in the absence of sound. Argues that rhythm should be felt and imagined before it is labeled or notated. Identifies rhythm patterns (macrobeats, microbeats, divisions) as the building blocks of musical understanding.
*   **Academy Application:** Grounds the "Hear → Move → Count → Name" pedagogy sequence. Justifies the invisible metronome lab (the user must audiate the beat when the click is muted). Supports anchor recall exercises where users recall a tempo from memory rather than listening to a reference.
*   **Follow-up Keywords:** Audiation, music aptitude, rhythm pattern, tonal pattern, inner hearing.

### [23] Jaques-Dalcroze, É. (1921). *Rhythm, Music and Education*. Translated by Harold F. Rubinstein. Dalcroze Society.
*   **Summary:** Foundational text introducing Dalcroze Eurhythmics, a system of musical education where movement (walking, clapping, stepping, gesturing) precedes notation and abstract theory. Argues that rhythm is a bodily phenomenon first, and that a lack of physical coordination with rhythm is the root of most musical timing problems.
*   **Academy Application:** Justifies the "Body Before Brain" mode at Level 0. Supports designing labs where users walk, clap on 2/4, and tap with two limbs before engaging with any BPM numbers or notation. Also supports the Piano Lab's LH/RH independence exercises.
*   **Follow-up Keywords:** Eurhythmics, embodied cognition, rhythmic movement, solfège, plastique animée.

### [24] London, J. (2012). *Hearing in Time: Psychological Aspects of Musical Meter* (2nd ed.). Oxford University Press.
*   **Summary:** Develops a theory of meter as the entrainment of attention and action to rhythmic structure. Argues that meter is not just a notated signature but a dynamic cognitive and physical process of anticipation and synchronization. Discusses multiple valid pulse layers (tactus, measure, subdivision) and how listeners choose a preferred metrical level.
*   **Academy Application:** Theoretical foundation for Level 3 (Meter & Downbeat) and Level 6 (Phrasing). Explains why the downbeat is a convergence point of multiple rhythmic expectations — not just the first beat of a bar. Supports teaching why 70 BPM and 140 BPM are both valid perceptual responses to the same piece.
*   **Follow-up Keywords:** Meter, entrainment, tactus, metrical hierarchy, rhythmic expectation, polyrhythm.

### [25] Gullings, K., et al. (2021). *Open Music Theory* (Version 2). Milne Open Textbooks.
*   **Summary:** Open-access music theory textbook covering rhythm, meter, beat, subdivision, simple meter, compound meter, syncopation, and form. Written at an accessible level for beginners while maintaining theoretical rigor. Explicitly covers duple/triple/quadruple organization, the distinction between beat and subdivision, and rhythmic notation.
*   **Academy Application:** Source material for Level 2 (Subdivide the Beat) and Level 3 (Meter & Downbeat) curriculum content. Definitions of quarter note, eighth note, sixteenth note, beat vs. subdivision, and 4/4 structure. Also covers pop rhythm patterns (tresillo, backbeat, syncopation) useful for Level 5 (Groove & Syncopation).
*   **Follow-up Keywords:** Simple meter, compound meter, subdivision, beat, bar, syncopation, tresillo.

---

## 6. Learning Science (Spaced Repetition, Interleaving & Metacognition)

### [26] Carpenter, S. K., Cepeda, N. J., Rohrer, D., Kang, S. H. K., & Pashler, H. (2012). Using Spacing to Enhance Diverse Forms of Learning: Review of Recent Research and Implications for Instruction. *Educational Psychology Review*, 24(3), 369–378.
*   **Summary:** Comprehensive review finding that distributing practice over time (spaced practice) consistently produces better long-term retention than massed practice, across a wide range of domains including music. Combines spacing with retrieval practice ("desirable difficulties") to maximize memory consolidation.
*   **Academy Application:** Core justification for the `AnchorSchedule` spaced repetition system. Specifically supports scheduling anchor recalls at expanding intervals (3 → 7 → 14 → 30 days) rather than drilling one anchor repeatedly in a single session. Provides the empirical case for making the review queue a first-class UI feature.
*   **Follow-up Keywords:** Spaced practice, distributed practice, retrieval practice, desirable difficulties, memory consolidation.

### [27] Kornell, N., & Bjork, R. A. (2008). Learning Concepts and Categories: Is Spacing the "Enemy of Induction"? *Psychological Science*, 19(6), 585–592.
*   **Summary:** Demonstrates that interleaved practice (mixing different problem types or stimuli) produces better long-term learning and transfer than blocked practice (drilling one type until mastered), even though it feels harder during training. The "interleaving effect" is particularly strong for classification and discrimination tasks.
*   **Academy Application:** Justifies mixing BPM ranges, genre crates, and input modes (numeric, tap, slider) within a session rather than grinding one crate. Supports the Academy design decision to include multiple skill types per session rather than letting users over-specialize. Explains why the game's cross-crate leaderboard and mixed-drill sessions improve learning even when they feel harder.
*   **Follow-up Keywords:** Interleaved practice, blocked practice, discrimination learning, transfer, contextual interference.

### [28] Hallam, S. (2001). The development of metacognition in musicians: Implications for education. *British Journal of Music Education*, 18(1), 27–39.
*   **Summary:** Studies how expert musicians develop metacognitive awareness — the ability to monitor their own understanding, identify weaknesses, and regulate their practice strategies. Finds that metacognitive skill distinguishes expert-level practice from mere repetition, and that music education can and should explicitly develop it.
*   **Academy Application:** Justifies reflection prompts ("What did you hear?", "What confused you?", "What will you try next?") as a formal part of each Academy session. Grounds the "Why Was I Wrong?" Diagnostic Engine as a metacognitive scaffold, not just feedback. Supports designing a practice journal or session log feature.
*   **Follow-up Keywords:** Metacognition, self-regulated learning, expert practice, music education, monitoring.

---

## 7. MIDI, Instrument Interface & Motor Learning (Piano Lab)

### [29] W3C Web MIDI API Specification. (2015, updated 2023). *Web MIDI API*. World Wide Web Consortium.
*   **Summary:** W3C specification defining `navigator.requestMIDIAccess()`, MIDI input/output port enumeration, note-on/note-off message parsing, and timing guarantees for browser-based MIDI communication. Supported natively in Chrome and Edge; requires permission prompt and HTTPS context.
*   **Piano Lab Application:** Technical grounding for the `MidiDeviceManager` JS module. Defines the API surface for detecting connected MIDI devices, selecting input ports, and converting note-on events (with high-resolution timestamp) to tap events for use in any existing lab. The MIDI timestamp (from `MIDIMessageEvent.timeStamp`) is directly comparable to `performance.now()` used in the existing tap-tempo system.
*   **Follow-up Keywords:** Web MIDI, MIDIAccess, MIDIInput, note-on, MIDI timestamp, browser music.

### [30] Bangert, M., & Altenmüller, E. O. (2003). Mapping perception to action in piano practice: A longitudinal DC-EEG study. *BMC Neuroscience*, 4(1), 26.
*   **Summary:** Longitudinal neuroimaging study of adult piano learners showing that piano practice rapidly develops audio-motor co-representations — neural structures that link heard sounds with the motor actions that produce them. Even brief piano training (20 minutes of practice) produces measurable changes in how the brain processes music. The motor cortex becomes active when the musician simply listens to music they have practiced.
*   **Piano Lab Application:** Justifies why MIDI piano input (real key presses) trains rhythm differently and potentially more effectively than keyboard or touchscreen tapping. Real instrument interaction engages audio-motor coupling, making tempo internalization more durable. Supports prioritizing MIDI input over keyboard simulation for all Piano Lab drills.
*   **Follow-up Keywords:** Audio-motor integration, sensorimotor learning, piano neuroplasticity, co-representation, timing training.

---

## 8. Additions (Perceptual Learning, Motor Learning, Assessment & Practice)

### [31] Goldstone, R. L. (1998). Perceptual Learning. *Annual Review of Psychology*, 49(1), 585-612.
*   **Summary:** Reviews how experience shapes the way we perceive sensory inputs, describing processes like differentiation (distinguishing once-similar inputs) and unitization (treating complex patterns as single units).
*   **Academy Application:** Grounding for the trainability of absolute tempo memory. Confirms that focused, structured perceptual practice (like identifying anchor tempos) enhances the resolution of auditory categories and discrimination thresholds.
*   **Follow-up Keywords:** Perceptual learning, categorization, sensory tuning, auditory differentiation.

### [32] Shea, J. B., & Morgan, R. L. (1979). Contextual interference effects on the acquisition, retention, and transfer of a motor skill. *Journal of Motor Behavior*, 11(3), 179-190.
*   **Summary:** Seminal study establishing the "contextual interference effect," demonstrating that practicing motor tasks in a random or interleaved order leads to better long-term retention and transfer than practicing in a blocked order, despite causing slower initial acquisition.
*   **Academy Application:** Motor learning support for interleaving practice drills and input methods (tapping vs keyboard) in the learning path. Complements cognitive category interleaving models.
*   **Follow-up Keywords:** Contextual interference, motor learning, random practice, retention, motor schema.

### [33] Black, P., & Wiliam, D. (1998). Assessment and classroom learning. *Assessment in Education: Principles, Policy & Practice*, 5(1), 7-74.
*   **Summary:** Landmark meta-analysis demonstrating that high-quality formative assessment (providing descriptive, actionable diagnostic feedback rather than just grades or scores) significantly improves learning outcomes.
*   **Academy Application:** Sets the pedagogical standard for the "Why Was I Wrong?" Diagnostic Engine, ensuring feedback is descriptive and guides the learner's attention to specific cognitive errors (like half-time bias or drift).
*   **Follow-up Keywords:** Formative assessment, feedback loop, diagnostics, self-regulated learning.

### [34] Ericsson, K. A., Krampe, R. T., & Tesch-Römer, C. (1993). The role of deliberate practice in the acquisition of expert performance. *Psychological Review*, 100(3), 363-406.
*   **Summary:** Standard-setting framework showing that expert performance is the result of long-term "deliberate practice" — highly structured, effortful activity explicitly designed to improve specific weaknesses, accompanied by immediate feedback and repetition.
*   **Academy Application:** Rationale for the year-long curriculum structure. Provides the theoretical framework for identifying weaknesses, logging focused attempts, and engaging in deliberate, structured repetition.
*   **Follow-up Keywords:** Deliberate practice, expertise, domain-specific performance, skill acquisition.
