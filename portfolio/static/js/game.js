// game.js - Count Me In Gameplay Orchestrator

document.addEventListener("DOMContentLoaded", () => {
    const playBtn = document.getElementById("play-btn");
    const stopBtn = document.getElementById("stop-btn");
    const vinylRecord = document.getElementById("vinyl-record");
    const guessInput = document.getElementById("guess-input");
    const submitBtn = document.getElementById("submit-btn");
    const canvas = document.getElementById("visualizer");
    const clueBadges = document.querySelectorAll(".clue-badge");

    // Result elements
    const resultOverlay = document.getElementById("result-overlay");
    const resultRating = document.getElementById("result-rating");
    const trueBpmVal = document.getElementById("true-bpm-val");
    const guessedBpmVal = document.getElementById("guessed-bpm-val");
    const errorVal = document.getElementById("error-val");
    const errorPctVal = document.getElementById("error-pct-val");
    const scoreVal = document.getElementById("score-val");
    const streakVal = document.getElementById("streak-val");

    // Tap Tempo elements
    const tabKeyboard = document.getElementById("tab-keyboard");
    const tabTap = document.getElementById("tab-tap");
    const keyboardInputContainer = document.getElementById("keyboard-input-container");
    const tapInputContainer = document.getElementById("tap-input-container");
    const tapPad = document.getElementById("tap-pad");
    const tapCountVal = document.getElementById("tap-count-val");
    const tapBpmVal = document.getElementById("tap-bpm-val");
    const tapStabilityVal = document.getElementById("tap-stability-val");
    const resetTapsBtn = document.getElementById("reset-taps-btn");

    const resultStabilityRow = document.getElementById("result-stability-row");
    const resultStabilityVal = document.getElementById("result-stability-val");

    let recipe = null;
    let visualizerFrameId = null;
    let currentClueLevel = 4; // Default to full beat
    let isBraking = false;
    let isSubmitting = false;
    let isVisualizerActive = false;
    let anchorState = "idle"; // idle, calibrating, transitioning, testing

    // Tap Tempo state
    let tapTimes = [];
    let currentTapStability = null;
    const MAX_TAPS = 12;

    // Outer visualizer state
    let cachedWidth = 0;
    let cachedHeight = 80;
    let cachedGradient = null;

    // Read recipe data embedded in the page
    const recipeMeta = document.getElementById("recipe-meta");
    if (recipeMeta) {
        recipe = JSON.parse(recipeMeta.getAttribute("data-recipe"));
    }

    // Fetch iTunes audio preview for active track if defined
    if (window.CMI_CONFIG && window.CMI_CONFIG.activeTrack && window.CMI_CONFIG.activeTrack.title) {
        const activeTrack = window.CMI_CONFIG.activeTrack;
        const loaderIndicator = document.getElementById("audio-loading-indicator");
        if (loaderIndicator) loaderIndicator.style.display = "block";

        const query = `${activeTrack.artist} ${activeTrack.title}`;
        const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&limit=1&media=music`;

        fetch(url)
            .then(res => res.json())
            .then(data => {
                if (data.results && data.results.length > 0) {
                    recipe.previewUrl = data.results[0].previewUrl;
                    console.log("iTunes preview URL resolved:", recipe.previewUrl);
                } else {
                    console.warn("No iTunes results found for:", query);
                }
            })
            .catch(err => {
                console.error("Error fetching iTunes preview:", err);
            })
            .finally(() => {
                if (loaderIndicator) loaderIndicator.style.display = "none";
            });
    }

    // Toggle reference tracks drawer click handlers
    const referenceDrawer = document.getElementById("reference-drawer");
    const toggleDrawerBtn = document.getElementById("toggle-drawer-btn");
    const closeDrawerBtn = document.getElementById("close-drawer-btn");

    function toggleDrawer() {
        if (referenceDrawer) {
            referenceDrawer.classList.toggle("active");
            announceStatus(referenceDrawer.classList.contains("active") ? "Reference tracks drawer opened." : "Reference tracks drawer closed.");
        }
    }

    if (toggleDrawerBtn) {
        toggleDrawerBtn.addEventListener("click", toggleDrawer);
    }
    if (closeDrawerBtn) {
        closeDrawerBtn.addEventListener("click", toggleDrawer);
    }

    // Keyboard hotkey [H] to toggle drawer
    window.addEventListener("keydown", (e) => {
        if (document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") {
            if (e.key.toLowerCase() === "h") {
                e.preventDefault();
                toggleDrawer();
            }
        }
    });

    // Highlight closest reference track in drawer when user types a guess
    function highlightClosestReference(guessVal) {
        const guessBpm = parseFloat(guessVal);
        if (isNaN(guessBpm) || !referenceDrawer) return;

        const trackItems = referenceDrawer.querySelectorAll(".drawer-track-item");
        let closestItem = null;
        let minDiff = Infinity;

        trackItems.forEach(item => {
            item.classList.remove("highlighted-song");
            const bpm = parseFloat(item.getAttribute("data-bpm"));
            if (!isNaN(bpm)) {
                const diff = Math.abs(bpm - guessBpm);
                if (diff < minDiff) {
                    minDiff = diff;
                    closestItem = item;
                }
            }
        });

        if (closestItem && minDiff <= 10) {
            closestItem.classList.add("highlighted-song");
            closestItem.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
    }

    if (guessInput) {
        guessInput.addEventListener("input", (e) => {
            highlightClosestReference(e.target.value);
        });
    }

    // Initialize play button
    if (playBtn) {
        playBtn.addEventListener("click", startPlayback);
    }

    // Initialize stop button
    if (stopBtn) {
        stopBtn.addEventListener("click", () => stopPlayback(false));
    }

    // Clue buttons
    clueBadges.forEach(badge => {
        badge.addEventListener("click", () => {
            if (isSubmitting) return;
            const level = parseInt(badge.getAttribute("data-level"));
            setClueLevel(level);
        });
    });

    // Submit Guess Action
    if (submitBtn) {
        submitBtn.addEventListener("click", submitGuess);
    }
    if (guessInput) {
        guessInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                submitGuess();
            }
        });
    }

    // Tab Switching
    if (tabKeyboard && tabTap) {
        tabKeyboard.addEventListener("click", () => {
            if (isSubmitting) return;
            tabKeyboard.classList.add("active");
            tabTap.classList.remove("active");
            keyboardInputContainer.classList.add("active");
            keyboardInputContainer.style.display = "block";
            tapInputContainer.classList.remove("active");
            tapInputContainer.style.display = "none";
            if (guessInput) guessInput.focus();
        });

        tabTap.addEventListener("click", () => {
            if (isSubmitting) return;
            tabTap.classList.add("active");
            tabKeyboard.classList.remove("active");
            tapInputContainer.classList.add("active");
            tapInputContainer.style.display = "block";
            keyboardInputContainer.classList.remove("active");
            keyboardInputContainer.style.display = "none";
            if (guessInput) guessInput.blur();
        });
    }

    // Tap Tempo Engine functions
    function handleTapRegistration() {
        const now = performance.now();
        const N = tapTimes.length;

        // Visual feedback on pad
        if (tapPad) {
            tapPad.classList.add("active");
            setTimeout(() => {
                tapPad.classList.remove("active");
            }, 80);
        }

        // Debounce check: discard tap if < 150 ms since previous tap
        if (N > 0 && now - tapTimes[N - 1] < 150) {
            return;
        }

        // Reset check: if pause > 3000 ms, start a new sequence but retain current tap
        if (N > 0 && now - tapTimes[N - 1] > 3000) {
            tapTimes = [];
        }

        tapTimes.push(now);
        if (tapTimes.length > MAX_TAPS) {
            tapTimes.shift();
        }

        const currentCount = tapTimes.length;
        if (tapCountVal) tapCountVal.textContent = currentCount;

        if (currentCount < 2) {
            if (tapBpmVal) tapBpmVal.textContent = "--";
            if (tapStabilityVal) tapStabilityVal.textContent = "--";
            currentTapStability = null;
            return;
        }

        const intervals = [];
        for (let i = 0; i < currentCount - 1; i++) {
            intervals.push(tapTimes[i + 1] - tapTimes[i]);
        }

        const M = intervals.length;
        const sum = intervals.reduce((acc, val) => acc + val, 0);
        const meanInterval = sum / M;
        const bpm = 60000 / meanInterval;

        // Populate guess value starting at 4 taps
        if (currentCount >= 4) {
            const bpmRounded = parseFloat(bpm.toFixed(1));
            if (tapBpmVal) tapBpmVal.textContent = `${bpmRounded} BPM`;
            if (guessInput) {
                guessInput.value = bpmRounded;
                guessInput.dispatchEvent(new Event("input"));
            }
        } else {
            if (tapBpmVal) tapBpmVal.textContent = "Estimating...";
        }

        // Calculate Sample Standard Deviation (Bessel's Correction) for N >= 3
        if (currentCount >= 3) {
            const variance = intervals.reduce((acc, val) => acc + Math.pow(val - meanInterval, 2), 0) / (M - 1);
            const stdDev = Math.sqrt(variance);
            currentTapStability = parseFloat(stdDev.toFixed(2));
            if (tapStabilityVal) tapStabilityVal.textContent = `±${stdDev.toFixed(1)} ms`;
        } else {
            if (tapStabilityVal) tapStabilityVal.textContent = "--";
            currentTapStability = null;
        }
    }

    function resetTaps() {
        tapTimes = [];
        currentTapStability = null;
        if (tapCountVal) tapCountVal.textContent = "0";
        if (tapBpmVal) tapBpmVal.textContent = "--";
        if (tapStabilityVal) tapStabilityVal.textContent = "--";
        if (guessInput) {
            guessInput.value = "";
            guessInput.dispatchEvent(new Event("input"));
        }
    }

    if (resetTapsBtn) {
        resetTapsBtn.addEventListener("click", resetTaps);
    }

    if (tapPad) {
        tapPad.addEventListener("pointerdown", (e) => {
            e.preventDefault();
            if (isSubmitting) return;
            if (!window.audioEngine.playing) {
                startPlayback();
            }
            handleTapRegistration();
        });
    }

    // Keyboard Hotkeys
    document.addEventListener("keydown", (e) => {
        // Skip hotkeys if user is currently typing in the guess input field or submitting
        if (document.activeElement === guessInput || isSubmitting) return;

        if (anchorState === "calibrating") {
            if (e.code === "Space" || e.key === "Enter") {
                e.preventDefault();
                endCalibration(true);
                return;
            }
        }

        if (e.key === "Escape") {
            e.preventDefault();
            stopPlayback(false);
            return;
        }

        if (e.key.toLowerCase() === "k") {
            e.preventDefault();
            if (tabKeyboard && !tabKeyboard.classList.contains("disabled")) tabKeyboard.click();
            return;
        }
        if (e.key.toLowerCase() === "m") {
            e.preventDefault();
            if (tabTap && !tabTap.classList.contains("disabled")) tabTap.click();
            return;
        }
        if (e.key.toLowerCase() === "r") {
            e.preventDefault();
            resetTaps();
            return;
        }

        const isTapActive = tabTap && tabTap.classList.contains("active");

        if (isTapActive) {
            if (e.code === "Space" || e.key.toLowerCase() === "t") {
                e.preventDefault();
                if (e.code === "Space" && !window.audioEngine.playing) {
                    startPlayback();
                    return;
                }
                handleTapRegistration();
                return;
            }
        } else {
            if (e.code === "Space") {
                e.preventDefault();
                if (window.audioEngine.playing) {
                    stopPlayback(false);
                } else {
                    startPlayback();
                }
                return;
            }
        }

        if (e.key >= "1" && e.key <= "4" && anchorState !== "calibrating") {
            const level = parseInt(e.key);
            setClueLevel(level);
        }
    });

    // Tab visibility changes (Save energy / pause on background tab)
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden" && window.audioEngine.playing) {
            stopPlayback(false);
        }
    });

    // Handle back-forward cache lifecycle events
    window.addEventListener("pageshow", () => {
        // Reset states cleanly on page show
        stopPlayback(false);
    });
    window.addEventListener("pagehide", () => {
        // Dispose active synths when navigating away
        window.audioEngine.dispose();
    });

    function announceStatus(text) {
        const announcer = document.getElementById("game-status-announcer");
        if (announcer) {
            announcer.textContent = text;
        }
    }

    let calibrationInterval = null;

    function startCalibration() {
        anchorState = "calibrating";
        announceStatus(`Calibration phase active. Reference BPM is ${window.CMI_CONFIG.anchorBpm}. Timer counting down.`);

        const glassMask = document.getElementById("glass-mask");
        if (glassMask) {
            glassMask.classList.remove("hidden-state");
        }

        // Setup visual aids for level
        if (window.CMI_CONFIG.anchorLevel === 2) {
            if (canvas) canvas.style.filter = "blur(10px)";
        } else {
            if (canvas) canvas.style.filter = "none";
        }

        // Start audio engine locked to anchor BPM
        const calibrationRecipe = {
            ...recipe,
            bpm: window.CMI_CONFIG.anchorBpm,
            clueLevel: 4
        };
        window.audioEngine.start(calibrationRecipe);

        // Start spinning vinyl record
        vinylRecord.classList.add("spinning");
        vinylRecord.classList.remove("braking", "transition-backspin", "transition-spinup");
        const rotationTime = 60 / window.CMI_CONFIG.anchorBpm;
        vinylRecord.style.animationDuration = `${rotationTime}s`;

        startVisualizer();

        let timeLeft = window.CMI_CONFIG.anchorLevel === 1 ? 15 : 5;
        const timerDisplay = document.getElementById("calibration-timer-display");
        if (timerDisplay) {
            timerDisplay.textContent = `${timeLeft}s`;
        }

        if (calibrationInterval) clearInterval(calibrationInterval);
        calibrationInterval = setInterval(() => {
            timeLeft--;
            if (timerDisplay) {
                timerDisplay.textContent = `${timeLeft}s`;
            }
            if (timeLeft <= 0) {
                clearInterval(calibrationInterval);
                endCalibration(false);
            }
        }, 1000);

        if (playBtn) playBtn.style.display = "none";
        if (stopBtn) stopBtn.style.display = "flex";
    }

    function endCalibration(skipped = false) {
        if (calibrationInterval) {
            clearInterval(calibrationInterval);
            calibrationInterval = null;
        }

        anchorState = "transitioning";
        announceStatus("Calibration complete. Cleansing memory.");

        // CSS Backspin
        vinylRecord.classList.remove("spinning");
        vinylRecord.classList.add("transition-backspin");

        // CSS Flash
        document.body.classList.add("flash-effect");
        setTimeout(() => {
            document.body.classList.remove("flash-effect");
        }, 300);

        // Web Audio palate cleanser & transition
        window.audioEngine.transitionToTest(recipe.bpm, () => {
            anchorState = "testing";
            announceStatus("Entering test phase. Input your estimate relative to the anchor.");

            document.body.classList.add("anchor-test-phase");

            const glassMask = document.getElementById("glass-mask");
            if (glassMask) {
                glassMask.classList.add("hidden-state");
            }

            // Reset inputs
            if (guessInput) {
                guessInput.disabled = false;
                if (tabKeyboard && tabKeyboard.classList.contains("active")) {
                    guessInput.focus();
                }
            }
            clueBadges.forEach(btn => btn.disabled = false);
            if (tabKeyboard) tabKeyboard.classList.remove("disabled");
            if (tabTap) tabTap.classList.remove("disabled");

            vinylRecord.classList.remove("transition-backspin");
            vinylRecord.classList.add("spinning");
            const rotationTime = 60 / recipe.bpm;
            vinylRecord.style.animationDuration = `${rotationTime}s`;
        });
    }

    function startStandardPlayback() {
        recipe.clueLevel = currentClueLevel;
        window.audioEngine.start(recipe);

        vinylRecord.classList.add("spinning");
        vinylRecord.classList.remove("braking", "transition-backspin", "transition-spinup");
        const rotationTime = 60 / recipe.bpm;
        vinylRecord.style.animationDuration = `${rotationTime}s`;

        startVisualizer();

        if (playBtn) playBtn.style.display = "none";
        if (stopBtn) stopBtn.style.display = "flex";
    }

    async function startPlayback() {
        if (!recipe || isBraking || isSubmitting) return;

        // Initialize and resume Tone context on user interaction
        await window.audioEngine.init();
        if (Tone.context.state !== "running") {
            await Tone.context.resume();
        }

        if (window.CMI_CONFIG.isAnchor && (window.CMI_CONFIG.anchorLevel === 1 || window.CMI_CONFIG.anchorLevel === 2)) {
            startCalibration();
        } else {
            startStandardPlayback();
        }
    }

    function stopPlayback(withBrake = false) {
        if (calibrationInterval) {
            clearInterval(calibrationInterval);
            calibrationInterval = null;
        }
        anchorState = "idle";
        document.body.classList.remove("anchor-test-phase");

        const glassMask = document.getElementById("glass-mask");
        if (glassMask && window.CMI_CONFIG.isAnchor && (window.CMI_CONFIG.anchorLevel === 1 || window.CMI_CONFIG.anchorLevel === 2)) {
            glassMask.classList.add("hidden-state");
            const timerDisplay = document.getElementById("calibration-timer-display");
            if (timerDisplay) {
                timerDisplay.textContent = window.CMI_CONFIG.anchorLevel === 1 ? "15s" : "5s";
            }
            if (guessInput) guessInput.disabled = true;
            clueBadges.forEach(btn => btn.disabled = true);
            if (tabKeyboard) tabKeyboard.classList.add("disabled");
            if (tabTap) tabTap.classList.add("disabled");
        }

        if (withBrake) {
            isBraking = true;
            window.audioEngine.stop(true); // Ramp BPM down
            vinylRecord.classList.add("braking");

            // Slow down animation matching braking interval (0.5s)
            vinylRecord.style.animationDuration = "0.5s";

            setTimeout(() => {
                vinylRecord.classList.remove("spinning", "braking", "transition-backspin", "transition-spinup");
                cancelVisualizer();
                isBraking = false;
            }, 450);
        } else {
            window.audioEngine.stop(false);
            vinylRecord.classList.remove("spinning", "braking", "transition-backspin", "transition-spinup");
            cancelVisualizer();
        }

        if (playBtn) playBtn.style.display = "flex";
        if (stopBtn) stopBtn.style.display = "none";
    }

    function cancelVisualizer() {
        isVisualizerActive = false;
        if (visualizerFrameId) {
            cancelAnimationFrame(visualizerFrameId);
            visualizerFrameId = null;
        }
        clearCanvas();
    }

    function setClueLevel(level) {
        currentClueLevel = level;

        // Update UI active state
        clueBadges.forEach(b => {
            const badgeLvl = parseInt(b.getAttribute("data-level"));
            if (badgeLvl === level) {
                b.classList.add("active");
            } else {
                b.classList.remove("active");
            }
        });

        // Update running engine dynamically
        if (window.audioEngine) {
            window.audioEngine.clueLevel = level;
        }

        // Update potential points HUD
        const maxPayoutVal = document.getElementById("max-payout-val");
        if (maxPayoutVal) {
            const multipliers = { 1: 0.5, 2: 0.6, 3: 0.75, 4: 1.0 };
            const mult = multipliers[level] || 1.0;
            maxPayoutVal.textContent = Math.round(100 * mult);
        }
    }

    // --- SUBMIT GUESS ---

    function submitGuess() {
        if (isSubmitting) return;

        const guessVal = parseFloat(guessInput.value);
        if (isNaN(guessVal) || guessVal <= 0) {
            alert("Please enter a valid numeric BPM guess.");
            return;
        }

        if (!recipe || isBraking) return;

        // LOCK IMMEDIATELY FOR BOTH GUEST AND AUTHENTICATED PATHS
        isSubmitting = true;
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = "Submitting...";
        }
        if (guessInput) guessInput.disabled = true;
        clueBadges.forEach(btn => btn.disabled = true);

        // Stop playback immediately for responsive UX
        stopPlayback(true);

        // Generate attempt UUID
        const attemptUuid = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

        // Fetch auth metadata
        const userMeta = document.getElementById("user-meta");
        const isAuthenticated = userMeta && userMeta.getAttribute("data-authenticated") === "true";
        const challengeToken = userMeta ? userMeta.getAttribute("data-challenge-token") : "";
        const crateName = userMeta ? userMeta.getAttribute("data-crate-name") : "Unknown Crate";

        if (isAuthenticated) {
            // AUTHENTICATED PATH - Saves directly to SQLite via API, bypasses localStorage
            const payload = {
                guess: Number(guessVal.toFixed(1)),
                challenge_token: challengeToken,
                clue_level: currentClueLevel,
                client_uuid: attemptUuid,
                tap_stability: currentTapStability
            };

            fetch("/game/api/attempt", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            })
            .then(async response => {
                if (!response.ok) {
                    const errData = await response.json().catch(() => ({}));
                    throw new Error(errData.error || (response.status === 401 ? "Unauthorized" : "Server Error"));
                }
                return response.json();
            })
            .then(data => {
                isSubmitting = false;
                submitBtn.disabled = false;
                submitBtn.textContent = "Submit Guess";
                guessInput.disabled = false;
                clueBadges.forEach(btn => btn.disabled = false);

                // Play chime
                const isSuccess = ["Tempo Wizard", "DJ-Ready", "Solid Ear", "Metrical Match"].includes(data.rating);
                window.audioEngine.playChime(isSuccess);

                // Show results
                showResults(data, data.streak);
            })
            .catch(err => {
                isSubmitting = false;
                submitBtn.disabled = false;
                submitBtn.textContent = "Submit Guess";
                guessInput.disabled = false;
                clueBadges.forEach(btn => btn.disabled = false);

                console.error("Submission failed:", err);
                alert(err.message === "Unauthorized"
                    ? "Your session has expired. Please log in again to save your score."
                    : `Submission failed: ${err.message}`);
            });

        } else {
            // GUEST PATH - Saves in browser localStorage
            const trueBpm = recipe.bpm;
            let bpmError = guessVal - trueBpm;
            const absError = Math.abs(bpmError);
            let percentError = (absError / trueBpm) * 100;

            const multipliers = { 1: 0.5, 2: 0.6, 3: 0.75, 4: 1.0 };
            const multiplier = multipliers[currentClueLevel] || 1.0;

            let baseScore = 10;
            let rating = "Needs Practice";
            let isSuccess = false;
            let metricalMultiplier = 1.0;

            // Symmetric metrical deviations relative to target rates
            const halfTimeErr = (Math.abs(guessVal - (trueBpm / 2.0)) / (trueBpm / 2.0)) * 100;
            const doubleTimeErr = (Math.abs(guessVal - (trueBpm * 2.0)) / (trueBpm * 2.0)) * 100;

            if (percentError < 1.0) {
                rating = "Tempo Wizard";
                baseScore = 100;
                isSuccess = true;
            } else if (percentError <= 3.0) {
                rating = "DJ-Ready";
                baseScore = 75;
                isSuccess = true;
            } else if (percentError <= 5.0) {
                rating = "Solid Ear";
                baseScore = 50;
                isSuccess = true;
            } else if (halfTimeErr <= 3.0) {
                rating = "Metrical Match";
                baseScore = 50;
                isSuccess = true;
                percentError = halfTimeErr;
                bpmError = guessVal - (trueBpm / 2.0);
                metricalMultiplier = 0.5;
            } else if (doubleTimeErr <= 3.0) {
                rating = "Metrical Match";
                baseScore = 50;
                isSuccess = true;
                percentError = doubleTimeErr;
                bpmError = guessVal - (trueBpm * 2.0);
                metricalMultiplier = 2.0;
            } else if (percentError <= 8.0) {
                rating = "Getting There";
                baseScore = 25;
            }

            const finalScore = Math.round(baseScore * multiplier);

            // Retrieve local streak metrics
            let currentStreak = parseInt(localStorage.getItem("count_me_in_streak")) || 0;
            let maxStreak = parseInt(localStorage.getItem("count_me_in_max_streak")) || 0;

            if (isSuccess) {
                currentStreak += 1;
                if (currentStreak > maxStreak) {
                    maxStreak = currentStreak;
                }
            } else {
                currentStreak = 0;
            }

            // Save back local streaks
            localStorage.setItem("count_me_in_streak", currentStreak.toString());
            localStorage.setItem("count_me_in_max_streak", maxStreak.toString());

            const attempts = JSON.parse(localStorage.getItem("count_me_in_attempts")) || [];
            const newAttempt = {
                client_uuid: attemptUuid,
                guessed_bpm: Number(guessVal.toFixed(1)),
                true_bpm: trueBpm,
                bpm_error: Number(bpmError.toFixed(1)),
                percent_error: Number(percentError.toFixed(2)),
                score: finalScore,
                rating: rating,
                crate_name: crateName,
                clue_level: currentClueLevel,
                metrical_multiplier: metricalMultiplier,
                tap_stability: currentTapStability,
                is_anchor: window.CMI_CONFIG.isAnchor,
                anchor_bpm: window.CMI_CONFIG.anchorBpm,
                anchor_level: window.CMI_CONFIG.anchorLevel,
                created_at: new Date().toISOString()
            };

            attempts.push(newAttempt);

            if (attempts.length > 1000) {
                attempts.shift();
            }

            try {
                localStorage.setItem("count_me_in_attempts", JSON.stringify(attempts));
            } catch (e) {
                if (e.name === "QuotaExceededError") {
                    localStorage.setItem("count_me_in_attempts", JSON.stringify(attempts.slice(-200)));
                }
            }

            // Trigger positive/negative chimes (stopPlayback(true) already called above)
            window.audioEngine.playChime(isSuccess);

            // Pop up the results
            showResults(newAttempt, currentStreak);

            // Trigger immediate data sync if user is logged in
            syncLocalAttempts();
        }
    }

    function showResults(attempt, currentStreak) {
        trueBpmVal.textContent = `${attempt.true_bpm} BPM`;
        guessedBpmVal.textContent = `${attempt.guessed_bpm} BPM`;

        const sign = attempt.bpm_error >= 0 ? "+" : "";
        errorVal.textContent = `${sign}${attempt.bpm_error} BPM`;
        errorPctVal.textContent = `${attempt.percent_error}%`;
        scoreVal.textContent = attempt.score;
        streakVal.textContent = currentStreak;

        // Display Tap Consistency if available
        if (resultStabilityRow && resultStabilityVal) {
            if (attempt.tap_stability !== undefined && attempt.tap_stability !== null) {
                resultStabilityVal.textContent = `±${attempt.tap_stability} ms`;
                resultStabilityRow.style.display = "block";
            } else {
                resultStabilityRow.style.display = "none";
            }
        }

        // Apply rating CSS class and text
        resultRating.className = "result-rating";
        resultRating.textContent = attempt.rating;

        if (attempt.rating === "Tempo Wizard") {
            resultRating.classList.add("rating-wizard");
        } else if (attempt.rating === "DJ-Ready") {
            resultRating.classList.add("rating-ready");
        } else if (attempt.rating === "Solid Ear") {
            resultRating.classList.add("rating-solid");
        } else if (attempt.rating === "Metrical Match") {
            resultRating.classList.add("rating-metrical");
        } else if (attempt.rating === "Getting There") {
            resultRating.classList.add("rating-getting");
        } else {
            resultRating.classList.add("rating-needs");
        }

        // Update research tip in the results modal overlay
        const tipEl = document.getElementById("result-research-tip");
        if (tipEl) {
            let tipHtml = "";
            if (attempt.rating === "Metrical Match") {
                tipHtml = "<strong>Metrical Level Ambiguity</strong><br>Psychomusicology research shows that listeners often perceive tempo at different hierarchical levels (half-time or double-time). In trap and hip-hop, this ambiguity is a core rhythmic feature (McKinney & Moelants, 2006).";
            } else if (attempt.percent_error <= 3.0) {
                tipHtml = "<strong>DJ-Ready Precision</strong><br>Superb ear! Studies in music perception show that professional DJs and trained listeners have a tempo discrimination threshold (Just Noticeable Difference) of 1% to 3% (Madison & Merker, 2004).";
            } else if (attempt.percent_error <= 8.0) {
                tipHtml = "<strong>Absolute Tempo Memory</strong><br>Great job! Cognitive research shows that humans possess stable mental representations of familiar tempos (Absolute Tempo Memory), typically accurate within 8% (Levitin, 1996).";
            } else {
                const generalTips = [
                    "<strong>Periodic Entrainment</strong><br>Humans naturally synchronize movement to audio pulses. Your brain is dynamically predicting beat intervals rather than just reacting to them (London, 2012).",
                    "<strong>Slowing the Mind</strong><br>Research suggests humans prefer tempos around 120 BPM (2 Hz tactus) because it aligns with normal walking gates and biological rhythms (Moelants, 2002).",
                    "<strong>Crate-Specific Anchors</strong><br>Training your ear with specific genre crates helps build 'anchor tracks' in your memory, which you can use as reference points (Levitin, 1996).",
                    "<strong>Micro-timing Deviations</strong><br>In live music, micro-timing variations (expressive deviations) add groove and feel, making BPM estimation slightly different than rigid electronic grids (Keil, 1995)."
                ];
                const index = Math.floor(Math.abs(attempt.guessed_bpm) % generalTips.length);
                tipHtml = generalTips[index];
            }
            tipEl.innerHTML = tipHtml;
            tipEl.style.display = "block";
        }

        // Show/hide guest registration nudge conditionally
        const guestNudge = document.getElementById("guest-nudge");
        if (guestNudge) {
            const isGoodRating = ["Tempo Wizard", "DJ-Ready"].includes(attempt.rating);
            if (window.CMI_CONFIG.isAuthenticated === false && isGoodRating) {
                guestNudge.style.display = "block";
            } else {
                guestNudge.style.display = "none";
            }
        }

        // Open Overlay Modal
        resultOverlay.style.display = "flex";
        setTimeout(() => {
            resultOverlay.classList.add("active");
        }, 10);
    }

    // --- VISUALIZER DRAW LOOP (HIGH-DPI & OPTIMIZED GRADIENTS) ---

    // Responsive High-DPI resizing
    const resizeCanvas = () => {
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        const rect = canvas.parentElement.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;

        canvas.width = rect.width * dpr;
        canvas.height = 80 * dpr;
        ctx.scale(dpr, dpr);

        canvas.style.width = `${rect.width}px`;
        canvas.style.height = "80px";

        cachedWidth = rect.width;
        cachedHeight = 80;

        // Pre-compile Visualizer Gradient outside of the requestAnimationFrame loop
        cachedGradient = ctx.createLinearGradient(0, 80, 0, 0);
        cachedGradient.addColorStop(0, "#00f0ff"); // Neon Cyan
        cachedGradient.addColorStop(1, "#ff0055"); // Neon Pink
    };

    if (canvas) {
        resizeCanvas();
        let resizeTimeout;
        window.addEventListener("resize", () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(resizeCanvas, 150);
        });
    }

    function startVisualizer() {
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        const analyser = window.audioEngine.analyser;
        if (!analyser) return;

        isVisualizerActive = true;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            if (!isVisualizerActive) return;
            visualizerFrameId = requestAnimationFrame(draw);

            analyser.getByteFrequencyData(dataArray);

            const w = cachedWidth;
            const h = cachedHeight;

            ctx.fillStyle = "rgba(13, 15, 18, 0.2)"; // Motion trailing blur
            ctx.fillRect(0, 0, w, h);

            const barWidth = (w / bufferLength) * 1.5;
            let barHeight;
            let x = 0;

            // Draw frequency bars
            ctx.fillStyle = cachedGradient || "#00f0ff";
            for (let i = 0; i < bufferLength; i++) {
                if (x >= w) break; // Optimization: don't render off-screen columns
                barHeight = dataArray[i];
                const heightVal = (barHeight / 255) * h * 0.8;
                ctx.fillRect(x, h - heightVal, barWidth - 2, heightVal);
                x += barWidth;
            }
        };

        visualizerFrameId = requestAnimationFrame(draw);
    }

    function clearCanvas() {
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = "#0d0f12";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
    }

    // --- TRANSACTIONAL LOCAL STORAGE SYNC ---

    async function syncLocalAttempts() {
        const isAuthenticated = document.body.getAttribute("data-authenticated") === "true";
        if (!isAuthenticated) return;

        const attempts = JSON.parse(localStorage.getItem("count_me_in_attempts")) || [];
        if (attempts.length === 0) return;

        const attemptsToSync = [...attempts];

        try {
            const response = await fetch("/game/api/sync", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ attempts: attemptsToSync })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    // Filter out matching synced attempts from local storage
                    const syncedUuids = new Set(attemptsToSync.map(a => a.client_uuid));
                    const currentLocalAttempts = JSON.parse(localStorage.getItem("count_me_in_attempts")) || [];
                    const remainingAttempts = currentLocalAttempts.filter(a => !syncedUuids.has(a.client_uuid));

                    localStorage.setItem("count_me_in_attempts", JSON.stringify(remainingAttempts));

                    // Overwrite local streaks with server calculated values
                    localStorage.setItem("count_me_in_streak", data.current_streak.toString());
                    localStorage.setItem("count_me_in_max_streak", data.max_streak.toString());

                    console.log(`Synced ${data.synced_count} attempts successfully.`);
                }
            } else {
                console.error("Failed to sync attempts to server.", response.statusText);
            }
        } catch (error) {
            console.error("Network error during sync:", error);
        }
    }

    // Skip calibration button click listener
    const skipCalibrationBtn = document.getElementById("skip-calibration-btn");
    if (skipCalibrationBtn) {
        skipCalibrationBtn.addEventListener("click", () => {
            if (anchorState === "calibrating") {
                endCalibration(true);
            }
        });
    }

    // Initialize page state for Anchor challenge calibration
    if (window.CMI_CONFIG.isAnchor && (window.CMI_CONFIG.anchorLevel === 1 || window.CMI_CONFIG.anchorLevel === 2)) {
        const glassMask = document.getElementById("glass-mask");
        if (glassMask) {
            glassMask.classList.add("hidden-state");
        }
        if (guessInput) guessInput.disabled = true;
        clueBadges.forEach(btn => btn.disabled = true);
        if (tabKeyboard) tabKeyboard.classList.add("disabled");
        if (tabTap) tabTap.classList.add("disabled");
    }

    // Trigger sync on page load if authenticated
    syncLocalAttempts();
});
