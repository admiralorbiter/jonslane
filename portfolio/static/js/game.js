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

    let recipe = null;
    let visualizerFrameId = null;
    let currentClueLevel = 4; // Default to full beat
    let cachedGradient = null;
    let isBraking = false;

    // Read recipe data embedded in the page
    const recipeMeta = document.getElementById("recipe-meta");
    if (recipeMeta) {
        recipe = JSON.parse(recipeMeta.getAttribute("data-recipe"));
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

    // Keyboard Hotkeys
    document.addEventListener("keydown", (e) => {
        // Skip hotkeys if user is currently typing in the guess input field
        if (document.activeElement === guessInput) return;

        if (e.code === "Space") {
            e.preventDefault();
            if (window.audioEngine.playing) {
                stopPlayback(false);
            } else {
                startPlayback();
            }
        } else if (e.key >= "1" && e.key <= "4") {
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

    async function startPlayback() {
        if (!recipe || isBraking) return;

        // Initialize and resume Tone context on user interaction
        await window.audioEngine.init();
        if (Tone.context.state !== "running") {
            await Tone.context.resume();
        }

        // Set current clue level on engine
        recipe.clueLevel = currentClueLevel;

        // Start audio engine
        window.audioEngine.start(recipe);

        // Start spinning vinyl record
        vinylRecord.classList.add("spinning");
        vinylRecord.classList.remove("braking");
        const rotationTime = 60 / recipe.bpm;
        vinylRecord.style.animationDuration = `${rotationTime}s`;

        // Start visualizer loop
        startVisualizer();

        // Toggle active button states
        if (playBtn) playBtn.style.display = "none";
        if (stopBtn) stopBtn.style.display = "flex";
    }

    function stopPlayback(withBrake = false) {
        if (withBrake) {
            isBraking = true;
            window.audioEngine.stop(true); // Ramp BPM down
            vinylRecord.classList.add("braking");

            // Slow down animation matching braking interval (0.5s)
            vinylRecord.style.animationDuration = "0.5s";

            setTimeout(() => {
                vinylRecord.classList.remove("spinning");
                vinylRecord.classList.remove("braking");
                cancelVisualizer();
                isBraking = false;
            }, 450);
        } else {
            window.audioEngine.stop(false);
            vinylRecord.classList.remove("spinning");
            vinylRecord.classList.remove("braking");
            cancelVisualizer();
        }

        if (playBtn) playBtn.style.display = "flex";
        if (stopBtn) stopBtn.style.display = "none";
    }

    function cancelVisualizer() {
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

    // --- CLIENT SIDE LOCAL STORAGE SCORING ---

    function submitGuess() {
        const guessVal = parseFloat(guessInput.value);
        if (isNaN(guessVal) || guessVal <= 0) {
            alert("Please enter a valid numeric BPM guess.");
            return;
        }

        if (!recipe || isBraking) return;

        const trueBpm = recipe.bpm;
        const bpmError = guessVal - trueBpm;
        const absError = Math.abs(bpmError);
        const percentError = (absError / trueBpm) * 100;

        // Clue multipliers
        // 1 = Kick only (0.5x), 2 = Kick+Snare (0.6x), 3 = Kick+Snare+Hat (0.75x), 4 = Full (1.0x)
        const multipliers = { 1: 0.5, 2: 0.6, 3: 0.75, 4: 1.0 };
        const multiplier = multipliers[currentClueLevel] || 1.0;

        // Scoring & Rating
        let baseScore = 10;
        let rating = "Needs Practice";
        let isSuccess = false;

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

        // Save Attempt to localStorage history (Capped at 1,000 entries)
        const attempts = JSON.parse(localStorage.getItem("count_me_in_attempts")) || [];

        // Generate UUID placeholder
        const attemptUuid = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        const crateName = document.querySelector(".cyber-title").textContent.trim();

        const newAttempt = {
            client_uuid: attemptUuid,
            guessed_bpm: Number(guessVal.toFixed(1)),
            true_bpm: trueBpm,
            bpm_error: Number(bpmError.toFixed(1)),
            percent_error: Number(percentError.toFixed(2)),
            score: finalScore,
            rating: rating,
            crate_name: crateName,
            created_at: new Date().toISOString()
        };

        attempts.push(newAttempt);

        // Limit window to 1,000 attempts to prevent main-thread blockage
        if (attempts.length > 1000) {
            attempts.shift(); // Remove oldest
        }

        try {
            localStorage.setItem("count_me_in_attempts", JSON.stringify(attempts));
        } catch (e) {
            if (e.name === "QuotaExceededError") {
                console.warn("LocalStorage quota exceeded! Slicing logs down to last 200 items.");
                localStorage.setItem("count_me_in_attempts", JSON.stringify(attempts.slice(-200)));
            }
        }

        // Trigger vinyl deceleration stop and positive/negative chimes
        stopPlayback(true);
        window.audioEngine.playChime(isSuccess);

        // Pop up the results
        showResults(newAttempt, currentStreak);

        // Trigger immediate data sync if user is logged in
        syncLocalAttempts();
    }

    function showResults(attempt, currentStreak) {
        trueBpmVal.textContent = `${attempt.true_bpm} BPM`;
        guessedBpmVal.textContent = `${attempt.guessed_bpm} BPM`;

        const sign = attempt.bpm_error >= 0 ? "+" : "";
        errorVal.textContent = `${sign}${attempt.bpm_error} BPM`;
        errorPctVal.textContent = `${attempt.percent_error}%`;
        scoreVal.textContent = attempt.score;
        streakVal.textContent = currentStreak;

        // Apply rating CSS class and text
        resultRating.className = "result-rating";
        resultRating.textContent = attempt.rating;

        if (attempt.rating === "Tempo Wizard") {
            resultRating.classList.add("rating-wizard");
        } else if (attempt.rating === "DJ-Ready") {
            resultRating.classList.add("rating-ready");
        } else if (attempt.rating === "Solid Ear") {
            resultRating.classList.add("rating-solid");
        } else if (attempt.rating === "Getting There") {
            resultRating.classList.add("rating-getting");
        } else {
            resultRating.classList.add("rating-needs");
        }

        // Open Overlay Modal
        resultOverlay.style.display = "flex";
        setTimeout(() => {
            resultOverlay.classList.add("active");
        }, 10);
    }

    // --- VISUALIZER DRAW LOOP (HIGH-DPI & OPTIMIZED GRADIENTS) ---

    function startVisualizer() {
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        const analyser = window.audioEngine.analyser;
        if (!analyser) return;

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        let cachedWidth = 0;
        let cachedHeight = 80;

        // Responsive High-DPI resizing
        const resizeCanvas = () => {
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
        resizeCanvas();

        // Bind debounced window resize
        let resizeTimeout;
        const onResize = () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                resizeCanvas();
            }, 150);
        };
        window.addEventListener("resize", onResize);

        const draw = () => {
            if (!visualizerFrameId && visualizerFrameId !== 0) return;
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
        const w = canvas.width / (window.devicePixelRatio || 1);
        const h = 80;
        ctx.fillStyle = "#0d0f12";
        ctx.fillRect(0, 0, w, h);
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

    // Trigger sync on page load if authenticated
    syncLocalAttempts();
});
