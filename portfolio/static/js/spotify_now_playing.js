/**
 * spotify_now_playing.js
 * 
 * Manages the global Now Playing bar and BPM Guess modal.
 * 
 * Architecture:
 *   - Polls /spotify/api/now-playing every 8 seconds
 *   - On track change, animates the bar in/out
 *   - Guess modal handles: numeric input, tap-tempo, metrical toggle, confidence, submit
 *   - Immediate result reveal after submit
 * 
 * Policy note: We use Spotify only for track identity/context.
 * BPM is determined by the server's BPM resolver, not Spotify API.
 */

(function () {
    'use strict';

    // -----------------------------------------------------------------------
    // Config
    // -----------------------------------------------------------------------
    const POLL_INTERVAL_MS = 8000;
    const TAP_TIMEOUT_MS = 2500; // Reset tap chain after this silence
    const MIN_TAPS = 3;

    // -----------------------------------------------------------------------
    // State
    // -----------------------------------------------------------------------
    let currentTrack = null;      // Current TrackIdentity-shaped object from API
    let currentAnnotation = null; // Current BPM annotation from API
    let pollTimer = null;
    let tapTimes = [];            // Timestamps of tap events
    let tapResetTimer = null;
    let isModalOpen = false;
    let lastGuessSubmitted = false;
    let lastGradeData = null;      // Response from guess API

    // BPM detection state — prevents running the detector more than once per track
    let detectionInProgress = false;
    let detectedTrackId = null;   // spotify_track_id of the last track we attempted detection on

    // -----------------------------------------------------------------------
    // DOM References (created dynamically, injected into body)
    // -----------------------------------------------------------------------
    function buildBar() {
        const bar = document.createElement('div');
        bar.id = 'now-playing-bar';
        bar.setAttribute('role', 'complementary');
        bar.setAttribute('aria-label', 'Now Playing');
        bar.innerHTML = `
            <div class="now-playing-progress">
                <div class="now-playing-progress-fill" id="np-progress-fill" style="width:0%"></div>
            </div>
            <div class="now-playing-inner" id="np-inner">
                <div class="now-playing-art-wrap">
                    <img class="now-playing-art" id="np-art" src="" alt="Album art" style="display:none">
                    <div class="now-playing-art-placeholder" id="np-art-placeholder">🎵</div>
                    <div class="now-playing-spin-ring" id="np-spin-ring"></div>
                </div>
                <div class="now-playing-info">
                    <div class="now-playing-track" id="np-track">—</div>
                    <div class="now-playing-artist" id="np-artist">—</div>
                </div>
                <div class="now-playing-bpm" id="np-bpm-display">
                    <span class="bpm-unknown" id="np-bpm-prompt">?'s<br>BPM</span>
                </div>
                <div class="now-playing-guess-wrap" id="np-guess-wrap">
                    <input
                        type="number"
                        id="np-quick-input"
                        class="now-playing-quick-input"
                        placeholder="BPM"
                        min="40"
                        max="300"
                        step="0.5"
                        autocomplete="off"
                    >
                    <button class="now-playing-guess-btn" id="np-guess-btn" aria-haspopup="dialog">
                        Guess
                    </button>
                </div>
                <div class="now-playing-spotify-mark" aria-hidden="true">
                    <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16">
                        <path d="M8 0C3.6 0 0 3.6 0 8s3.6 8 8 8 8-3.6 8-8-3.6-8-8-8zm3.68 11.56c-.16.24-.44.32-.68.16-1.88-1.16-4.24-1.4-7.04-.76-.28.08-.52-.12-.6-.36-.08-.28.12-.52.36-.6 3.04-.68 5.68-.4 7.76.88.28.12.32.44.2.68zm.96-2.2c-.2.28-.56.4-.84.2-2.16-1.32-5.44-1.72-7.96-.92-.32.08-.68-.08-.76-.4-.08-.32.08-.68.4-.76 2.92-.88 6.52-.44 8.96 1.08.24.12.36.52.2.8zm.08-2.24C10.16 5.6 5.88 5.44 3.44 6.2c-.4.12-.8-.12-.92-.48-.12-.4.12-.8.48-.92 2.84-.84 7.52-.68 10.48 1.08.36.2.48.68.28 1.04-.2.28-.68.4-1.04.2z"/>
                    </svg>
                </div>
            </div>`;
        document.body.appendChild(bar);
        return bar;
    }

    function buildModal() {
        const modal = document.createElement('div');
        modal.id = 'bpm-guess-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-label', 'Guess the BPM');
        modal.innerHTML = `
            <div class="modal-backdrop" id="modal-backdrop"></div>
            <div class="modal-sheet" role="document">
                <div class="modal-drag-handle" aria-hidden="true"></div>
                
                <!-- Track header -->
                <div class="modal-track-header">
                    <img class="modal-art" id="modal-art" src="" alt="Album art" style="display:none">
                    <div class="modal-art-placeholder" id="modal-art-placeholder">🎵</div>
                    <div>
                        <p class="modal-track-name" id="modal-track-name">Loading...</p>
                        <p class="modal-artist-name" id="modal-artist-name"></p>
                    </div>
                </div>

                <!-- BPM Input -->
                <label class="modal-section-label" for="modal-bpm-input">Your BPM guess</label>
                <div class="modal-bpm-section">
                    <div class="bpm-input-row">
                        <input
                            type="number"
                            id="modal-bpm-input"
                            class="bpm-number-input"
                            placeholder="BPM"
                            min="40"
                            max="300"
                            step="0.5"
                            autocomplete="off"
                        >
                        <button class="tap-bpm-btn" id="modal-tap-btn" aria-label="Tap to estimate BPM">
                            <span>TAP</span>
                            <span class="tap-count-label" id="tap-count-label">tap the beat</span>
                        </button>
                    </div>
                </div>

                <!-- Metrical Level -->
                <label class="modal-section-label">Metrical interpretation</label>
                <div class="metrical-toggle" role="group" aria-label="Metrical interpretation">
                    <button class="metrical-btn" data-mult="0.5" id="metrical-half">½ Half-time</button>
                    <button class="metrical-btn active" data-mult="1.0" id="metrical-normal">Normal</button>
                    <button class="metrical-btn" data-mult="2.0" id="metrical-double">2× Double</button>
                </div>

                <!-- Confidence -->
                <label class="modal-section-label">Confidence</label>
                <div class="confidence-row" role="group" aria-label="Confidence level">
                    <button class="confidence-btn active" data-conf="guess" id="conf-guess">Guess</button>
                    <button class="confidence-btn" data-conf="pretty_sure" id="conf-pretty-sure">Pretty sure</button>
                    <button class="confidence-btn" data-conf="locked_in" id="conf-locked-in">Locked in 🎯</button>
                </div>

                <!-- Note -->
                <textarea
                    class="modal-note-input"
                    id="modal-note-input"
                    rows="2"
                    maxlength="200"
                    placeholder='Optional note — e.g. "feels like half-time trap"'
                ></textarea>

                <!-- Submit -->
                <button class="modal-submit-btn" id="modal-submit-btn">
                    Submit Guess
                </button>

                <!-- Result (revealed immediately after submit) -->
                <div class="modal-result-panel" id="modal-result-panel"></div>
            </div>`;
        document.body.appendChild(modal);
        return modal;
    }

    // -----------------------------------------------------------------------
    // Polling
    // -----------------------------------------------------------------------
    async function fetchNowPlaying() {
        try {
            const resp = await fetch('/spotify/api/now-playing', {
                headers: { 'Accept': 'application/json' },
                signal: AbortSignal.timeout(7000),
            });
            if (!resp.ok) return;
            const data = await resp.json();
            handleNowPlayingUpdate(data);
        } catch (e) {
            // Network error or timeout — silent fail, bar stays as-is
        }
    }

    function startPolling() {
        fetchNowPlaying();
        pollTimer = setInterval(fetchNowPlaying, POLL_INTERVAL_MS);
    }

    // -----------------------------------------------------------------------
    // Bar Update
    // -----------------------------------------------------------------------
    function handleNowPlayingUpdate(data) {
        const bar = document.getElementById('now-playing-bar');
        if (!bar) return;

        if (!data.spotify_connected || !data.is_playing || !data.track) {
            hideBar();
            return;
        }

        const track = data.track;
        const annotation = data.bpm_annotation;
        const itunesQuery = data.itunes_query || null;

        // Detect track change
        const trackChanged = !currentTrack || currentTrack.spotify_track_id !== track.spotify_track_id;
        currentTrack = track;
        currentAnnotation = annotation;

        if (trackChanged) {
            // Reset modal and detection state on new track
            lastGuessSubmitted = false;
            lastGradeData = null;
            detectionInProgress = false;
            updateGuessControls(null);
        }

        // Restore guess state if user has guessed this track in a previous session
        if (data.last_guess) {
            lastGuessSubmitted = true;
            lastGradeData = {
                success: true,
                was_gradable: data.last_guess.was_gradable,
                grade: data.last_guess.grade,
                bpm_annotation: data.bpm_annotation,
                guessed_bpm: data.last_guess.guessed_bpm,
                metrical_multiplier: data.last_guess.metrical_multiplier,
            };
        }

        updateBarContent(track, annotation, data.is_playing);
        updateGuessControls(lastGradeData);
        showBar(data.is_playing);

        // Update progress fill
        if (track.duration_ms && track.progress_ms != null) {
            const pct = Math.min(100, (track.progress_ms / track.duration_ms) * 100);
            const fill = document.getElementById('np-progress-fill');
            if (fill) fill.style.width = pct + '%';
        }

        // Trigger iTunes beat detection if:
        //   - no annotation from server yet
        //   - server gave us a query hint
        //   - BpmDetector is loaded
        //   - we haven't already tried this track
        //   - detection isn't already in progress
        if (
            !annotation &&
            itunesQuery &&
            typeof BpmDetector !== 'undefined' &&
            !detectionInProgress &&
            detectedTrackId !== track.spotify_track_id
        ) {
            detectedTrackId = track.spotify_track_id;
            detectionInProgress = true;
            showBpmDetecting();

            BpmDetector.detectAndSubmit(itunesQuery, track.track_identity_id)
                .then(annotation => {
                    detectionInProgress = false;
                    if (annotation) {
                        currentAnnotation = annotation;
                        updateBpmDisplay(annotation);
                    } else {
                        // Detection returned nothing — show unknown
                        updateBpmDisplay(null);
                    }
                })
                .catch(() => {
                    detectionInProgress = false;
                    updateBpmDisplay(null);
                });
        }
    }

    function updateBarContent(track, annotation, isPlaying) {
        // Art
        const art = document.getElementById('np-art');
        const artPh = document.getElementById('np-art-placeholder');
        if (art && artPh) {
            if (track.album_art_url) {
                art.src = track.album_art_url;
                art.style.display = 'block';
                artPh.style.display = 'none';
            } else {
                art.style.display = 'none';
                artPh.style.display = 'flex';
            }
        }

        // Text
        const trackEl = document.getElementById('np-track');
        const artistEl = document.getElementById('np-artist');
        if (trackEl) trackEl.textContent = track.title || '—';
        if (artistEl) artistEl.textContent = track.artist || '—';

        // Playing indicator
        const inner = document.getElementById('np-inner');
        if (inner) {
            inner.classList.toggle('is-playing', isPlaying);
        }

        // BPM display
        updateBpmDisplay(annotation);
    }

    function updateBpmDisplay(annotation) {
        const bpmDisplay = document.getElementById('np-bpm-display');
        if (!bpmDisplay) return;

        if (lastGuessSubmitted) {
            if (annotation) {
                bpmDisplay.innerHTML = `
                    <span class="bpm-value">${Math.round(annotation.canonical_bpm)}</span>
                    <span class="bpm-label">BPM</span>
                `;
            } else {
                bpmDisplay.innerHTML = `
                    <span class="bpm-value">—</span>
                    <span class="bpm-label">BPM</span>
                `;
            }
        } else if (detectionInProgress) {
            bpmDisplay.innerHTML = `<span class="bpm-unknown" style="animation: pulse-dot 1s ease infinite; color: rgba(29,185,84,0.6);">listen<br>ing…</span>`;
        } else {
            bpmDisplay.innerHTML = `<span class="bpm-unknown" id="np-bpm-prompt">?\'s<br>BPM</span>`;
        }
    }

    function updateGuessControls(gradeData) {
        const wrap = document.getElementById('np-guess-wrap');
        if (!wrap) return;

        if (lastGuessSubmitted && gradeData) {
            let badgeClass = 'ungraded';
            let badgeText = 'Logged ✓';
            
            if (gradeData.was_gradable && gradeData.grade) {
                const g = gradeData.grade;
                badgeClass = g.rating; // e.g., Perfect, Excellent, Good, Fair, Miss
                badgeText = `${g.rating}!`;
                if (g.percent_error !== null) {
                    badgeText += ` (${g.percent_error.toFixed(1)}%)`;
                }
            }
            
            wrap.innerHTML = `
                <span class="now-playing-feedback ${badgeClass}">${badgeText}</span>
                <button class="now-playing-details-btn" id="np-details-btn">
                    Details
                </button>
            `;
        } else {
            wrap.innerHTML = `
                <input
                    type="number"
                    id="np-quick-input"
                    class="now-playing-quick-input"
                    placeholder="BPM"
                    min="40"
                    max="300"
                    step="0.5"
                    autocomplete="off"
                >
                <button class="now-playing-guess-btn" id="np-guess-btn" aria-haspopup="dialog">
                    Guess
                </button>
            `;
        }
    }

    async function submitQuickGuess(guessedBpm) {
        if (!currentTrack) return;

        if (!guessedBpm || guessedBpm < 40 || guessedBpm > 300) {
            const input = document.getElementById('np-quick-input');
            if (input) {
                input.style.borderColor = 'rgba(239, 68, 68, 0.6)';
                setTimeout(() => { input.style.borderColor = ''; }, 1200);
            }
            return;
        }

        const input = document.getElementById('np-quick-input');
        if (input) {
            input.disabled = true;
        }
        const btn = document.getElementById('np-guess-btn');
        if (btn) {
            btn.disabled = true;
            btn.textContent = '...';
        }

        try {
            const resp = await fetch('/spotify/api/guess', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    track_identity_id: currentTrack.track_identity_id || null,
                    guessed_bpm: guessedBpm,
                    tap_estimated_bpm: null,
                    tap_stability_ms: null,
                    input_method: 'numeric',
                    confidence: 'guess',
                    metrical_multiplier: 1.0,
                    half_double_flag: 'normal',
                    user_note: null,
                    playback_progress_ms: currentTrack.progress_ms || null,
                    listening_context: 'unknown',
                }),
            });

            const data = await resp.json();
            if (data.success) {
                lastGuessSubmitted = true;
                lastGradeData = data;
                lastGradeData.guessed_bpm = guessedBpm;
                lastGradeData.metrical_multiplier = 1.0;
                if (data.bpm_annotation) {
                    currentAnnotation = data.bpm_annotation;
                }
                
                showResult(data, guessedBpm, 1.0);
                updateBpmDisplay(currentAnnotation);
                updateGuessControls(lastGradeData);
            } else {
                if (input) input.disabled = false;
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = 'Guess';
                }
            }
        } catch (e) {
            if (input) input.disabled = false;
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Guess';
            }
            console.error('Quick guess submission error:', e);
        }
    }

    function showBpmDetecting() {
        // While detection is running, show a subtle detecting indicator
        // still without revealing any actual value
        const bpmDisplay = document.getElementById('np-bpm-display');
        if (!bpmDisplay) return;
        bpmDisplay.innerHTML = `<span class="bpm-unknown" style="animation: pulse-dot 1s ease infinite; color: rgba(29,185,84,0.6);">listen<br>ing…</span>`;
    }

    function showBar(isPlaying) {
        const bar = document.getElementById('now-playing-bar');
        if (bar) {
            bar.classList.add('bar-visible');
        }
    }

    function hideBar() {
        const bar = document.getElementById('now-playing-bar');
        if (bar) {
            bar.classList.remove('bar-visible');
        }
        // Hide modal too
        if (isModalOpen) closeModal();
    }

    // -----------------------------------------------------------------------
    // Modal
    // -----------------------------------------------------------------------
    function openModal() {
        if (!currentTrack) return;
        const modal = document.getElementById('bpm-guess-modal');
        if (!modal) return;

        // Populate track info
        populateModalTrack(currentTrack);

        // Reset form state
        resetModalForm();

        // Pre-populate with quick input value if present and we haven't submitted a guess yet
        if (!lastGuessSubmitted) {
            const quickInput = document.getElementById('np-quick-input');
            if (quickInput && quickInput.value) {
                const modalInput = document.getElementById('modal-bpm-input');
                if (modalInput) modalInput.value = quickInput.value;
            }
        } else if (lastGradeData) {
            // Restore previous guess values in modal
            const modalInput = document.getElementById('modal-bpm-input');
            if (modalInput && lastGradeData.guessed_bpm) {
                modalInput.value = lastGradeData.guessed_bpm;
            }
            showResult(lastGradeData, lastGradeData.guessed_bpm || 0, lastGradeData.metrical_multiplier || 1.0);
            const submitBtn = document.getElementById('modal-submit-btn');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Logged ✓';
            }
        }

        modal.classList.add('modal-open');
        isModalOpen = true;

        // Focus BPM input
        setTimeout(() => {
            const input = document.getElementById('modal-bpm-input');
            if (input) input.focus();
        }, 350);
    }

    function closeModal() {
        const modal = document.getElementById('bpm-guess-modal');
        if (modal) modal.classList.remove('modal-open');
        isModalOpen = false;
    }

    function populateModalTrack(track) {
        const art = document.getElementById('modal-art');
        const artPh = document.getElementById('modal-art-placeholder');
        if (art && artPh) {
            if (track.album_art_url) {
                art.src = track.album_art_url;
                art.style.display = 'block';
                artPh.style.display = 'none';
            } else {
                art.style.display = 'none';
                artPh.style.display = 'flex';
            }
        }
        const tn = document.getElementById('modal-track-name');
        const an = document.getElementById('modal-artist-name');
        if (tn) tn.textContent = track.title || '—';
        if (an) an.textContent = track.artist || '—';
    }

    function resetModalForm() {
        const input = document.getElementById('modal-bpm-input');
        const note = document.getElementById('modal-note-input');
        const result = document.getElementById('modal-result-panel');
        const submitBtn = document.getElementById('modal-submit-btn');

        if (input) input.value = '';
        if (note) note.value = '';
        if (result) { result.classList.remove('show'); result.innerHTML = ''; }
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Submit Guess'; }

        // Reset metrical to normal
        document.querySelectorAll('.metrical-btn').forEach(b => b.classList.remove('active'));
        const normalBtn = document.getElementById('metrical-normal');
        if (normalBtn) normalBtn.classList.add('active');

        // Reset confidence to guess
        document.querySelectorAll('.confidence-btn').forEach(b => b.classList.remove('active'));
        const guessBtn = document.getElementById('conf-guess');
        if (guessBtn) guessBtn.classList.add('active');

        // Reset tap state
        tapTimes = [];
        updateTapLabel(0);
    }

    // -----------------------------------------------------------------------
    // Tap Tempo
    // -----------------------------------------------------------------------
    function handleTap() {
        const now = performance.now();

        if (tapResetTimer) clearTimeout(tapResetTimer);

        // Reset tap chain if too long a gap
        if (tapTimes.length > 0 && now - tapTimes[tapTimes.length - 1] > TAP_TIMEOUT_MS) {
            tapTimes = [];
        }

        tapTimes.push(now);

        // Need at least MIN_TAPS to compute BPM
        if (tapTimes.length >= MIN_TAPS) {
            const intervals = [];
            for (let i = 1; i < tapTimes.length; i++) {
                intervals.push(tapTimes[i] - tapTimes[i - 1]);
            }
            const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
            const bpm = Math.round(60000 / avgInterval);

            const input = document.getElementById('modal-bpm-input');
            if (input) input.value = bpm;

            // Visual feedback on tap button
            const tapBtn = document.getElementById('modal-tap-btn');
            if (tapBtn) tapBtn.classList.add('tapping');
        }

        updateTapLabel(tapTimes.length);

        // Auto-reset after silence
        tapResetTimer = setTimeout(() => {
            const tapBtn = document.getElementById('modal-tap-btn');
            if (tapBtn) tapBtn.classList.remove('tapping');
        }, TAP_TIMEOUT_MS);
    }

    function updateTapLabel(count) {
        const label = document.getElementById('tap-count-label');
        if (!label) return;
        if (count === 0) {
            label.textContent = 'tap the beat';
        } else if (count < MIN_TAPS) {
            label.textContent = `${MIN_TAPS - count} more tap${MIN_TAPS - count > 1 ? 's' : ''}…`;
        } else {
            label.textContent = `${count} taps`;
        }
    }

    // Compute tap stability (std dev of intervals in ms)
    function computeTapStability() {
        if (tapTimes.length < 2) return null;
        const intervals = [];
        for (let i = 1; i < tapTimes.length; i++) {
            intervals.push(tapTimes[i] - tapTimes[i - 1]);
        }
        const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const variance = intervals.reduce((sum, v) => sum + (v - mean) ** 2, 0) / intervals.length;
        return Math.sqrt(variance);
    }

    // -----------------------------------------------------------------------
    // Submit
    // -----------------------------------------------------------------------
    async function submitGuess() {
        if (!currentTrack) return;

        const input = document.getElementById('modal-bpm-input');
        const note = document.getElementById('modal-note-input');
        const submitBtn = document.getElementById('modal-submit-btn');

        const guessedBpm = input ? parseFloat(input.value) : null;
        const tapBpm = tapTimes.length >= MIN_TAPS
            ? parseFloat(document.getElementById('modal-bpm-input')?.value || '') || null
            : null;

        // Require at least one BPM value
        if (!guessedBpm || guessedBpm < 40 || guessedBpm > 300) {
            if (input) {
                input.style.borderColor = 'rgba(239, 68, 68, 0.6)';
                setTimeout(() => { input.style.borderColor = ''; }, 1200);
            }
            return;
        }

        // Collect form state
        const activeMetrical = document.querySelector('.metrical-btn.active');
        const metricalMultiplier = activeMetrical ? parseFloat(activeMetrical.dataset.mult) : 1.0;
        const halfDoubleFlag = activeMetrical ? activeMetrical.dataset.mult === '0.5' ? 'half'
            : activeMetrical.dataset.mult === '2.0' ? 'double' : 'normal' : 'normal';

        const activeConf = document.querySelector('.confidence-btn.active');
        const confidence = activeConf ? activeConf.dataset.conf : 'guess';

        const tapStability = computeTapStability();
        const inputMethod = tapTimes.length >= MIN_TAPS
            ? (guessedBpm !== null ? 'both' : 'tap')
            : 'numeric';

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Logging…';
        }

        try {
            const resp = await fetch('/spotify/api/guess', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    track_identity_id: currentTrack.track_identity_id || null,
                    guessed_bpm: guessedBpm,
                    tap_estimated_bpm: tapBpm,
                    tap_stability_ms: tapStability,
                    input_method: inputMethod,
                    confidence: confidence,
                    metrical_multiplier: metricalMultiplier,
                    half_double_flag: halfDoubleFlag,
                    user_note: note ? note.value.trim() || null : null,
                    playback_progress_ms: currentTrack.progress_ms || null,
                    listening_context: 'unknown',
                }),
            });

            const data = await resp.json();
            if (data.success) {
                lastGuessSubmitted = true;
                lastGradeData = data;
                lastGradeData.guessed_bpm = guessedBpm;
                lastGradeData.metrical_multiplier = metricalMultiplier;
                if (data.bpm_annotation) {
                    currentAnnotation = data.bpm_annotation;
                }
                showResult(data, guessedBpm, metricalMultiplier);
                if (submitBtn) {
                    submitBtn.textContent = 'Logged ✓';
                }
                updateBpmDisplay(currentAnnotation);
                updateGuessControls(lastGradeData);
            } else {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Submit Guess';
                }
            }
        } catch (e) {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Submit Guess';
            }
            console.error('Guess submission error:', e);
        }
    }

    function showResult(data, guessedBpm, metricalMultiplier) {
        const panel = document.getElementById('modal-result-panel');
        if (!panel) return;

        let html = '';

        if (data.was_gradable && data.grade) {
            const g = data.grade;
            const ann = data.bpm_annotation;

            html += `<p class="result-rating ${g.rating}">${g.feedback_label}</p>`;
            html += `<p class="result-feedback">${g.rating} — ${g.percent_error.toFixed(1)}% error</p>`;

            html += `<div class="result-bpm-reveal">`;
            html += `<div class="result-bpm-item">Your guess: <strong>${guessedBpm} BPM</strong></div>`;
            if (ann) {
                const displayBpm = metricalMultiplier !== 1.0
                    ? `${ann.canonical_bpm} × ${metricalMultiplier} = ${g.effective_bpm}`
                    : `${ann.canonical_bpm}`;
                html += `<div class="result-bpm-item">Track BPM: <strong>${displayBpm}</strong></div>`;
            }
            html += `</div>`;

            if (g.is_anchor_adjacent) {
                html += `<div class="result-anchor-note">
                    🎯 Anchor zone detected: near ${g.anchor_bpm_near} BPM
                </div>`;
            }
        } else {
            html += `<p class="result-ungraded">
                ✅ Guess logged — BPM is not yet verified for this track.
                Your guess will be compared once we annotate it.
            </p>`;
        }

        panel.innerHTML = html;
        panel.classList.add('show');
    }

    // -----------------------------------------------------------------------
    // Event Binding
    // -----------------------------------------------------------------------
    function bindEvents() {
        // Guess button on bar
        document.addEventListener('click', function (e) {
            if (e.target.closest('#np-guess-btn')) {
                openModal();
            }
        });

        // Details button on bar
        document.addEventListener('click', function (e) {
            if (e.target.closest('#np-details-btn') || e.target.closest('.now-playing-feedback')) {
                openModal();
            }
        });

        // Enter key in quick input
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && e.target.id === 'np-quick-input') {
                e.preventDefault();
                const val = parseFloat(e.target.value);
                submitQuickGuess(val);
            }
        });

        // Modal backdrop close
        document.addEventListener('click', function (e) {
            if (e.target.id === 'modal-backdrop') {
                closeModal();
            }
        });

        // Metrical buttons
        document.addEventListener('click', function (e) {
            const btn = e.target.closest('.metrical-btn');
            if (btn) {
                document.querySelectorAll('.metrical-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            }
        });

        // Confidence buttons
        document.addEventListener('click', function (e) {
            const btn = e.target.closest('.confidence-btn');
            if (btn) {
                document.querySelectorAll('.confidence-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            }
        });

        // Tap button
        document.addEventListener('click', function (e) {
            if (e.target.closest('#modal-tap-btn')) {
                handleTap();
            }
        });

        // Spacebar tap (when modal open and not in input)
        document.addEventListener('keydown', function (e) {
            if (!isModalOpen) return;
            const tag = document.activeElement?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;
            if (e.code === 'Space') {
                e.preventDefault();
                handleTap();
            }
            if (e.key === 'Escape') closeModal();
        });

        // Submit button
        document.addEventListener('click', function (e) {
            if (e.target.closest('#modal-submit-btn') && !e.target.closest('#modal-submit-btn').disabled) {
                submitGuess();
            }
        });

        // Enter key in BPM input
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && document.activeElement?.id === 'modal-bpm-input') {
                submitGuess();
            }
        });
    }

    // -----------------------------------------------------------------------
    // Init
    // -----------------------------------------------------------------------
    function init() {
        // Only run if user is authenticated (data attr on body set by base.html)
        if (document.body.dataset.authenticated !== 'true') return;

        buildBar();
        buildModal();
        bindEvents();
        startPolling();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
