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
