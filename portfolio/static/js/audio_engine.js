// audio_engine.js - Count Me In Tone.js Synthesizer & Sequencer

class BpmAudioEngine {
    constructor() {
        this.initialized = false;
        this.playing = false;
        this.bpm = 120;
        this.genre = "beginner";
        this.clueLevel = 4; // 1 = Kick only, 2 = Kick + Snare, 3 = Kick + Snare + Hat, 4 = Full (Bass included)

        // Synthesizers
        this.kick = null;
        this.snare = null;
        this.snareFilter = null;
        this.hat = null;
        this.hatFilter = null;
        this.bass = null;
        this.chimeSynth = null;
        this.noiseGenerator = null;
        this.transitionFilter = null;

        // Real Audio Preview player & filter
        this.songPlayer = null;
        this.clueFilter = null;
        this.previewUrl = null;
        this.originalBpm = null;

        // Loop IDs for scheduling
        this.loopIds = [];
        this.analyser = null;
        this.rampRequestId = null;
        this.playbackSessionId = 0;
    }

    async init() {
        if (this.initialized) return;
        if (this._initPromise) return this._initPromise;

        this._initPromise = (async () => {
            // Start the Tone audio context if suspended
            await Tone.start();

            // Set up transition sweep generator
            this.transitionFilter = new Tone.Filter({
                type: "highpass",
                frequency: 100,
                Q: 1.5
            }).toDestination();

            this.noiseGenerator = new Tone.Noise({
                type: "white",
                volume: -Infinity
            }).connect(this.transitionFilter);

            // 1. Kick: Membrane Synth for deep punchy sub-heavy kick
            this.kick = new Tone.MembraneSynth({
                envelope: {
                    attack: 0.001,
                    decay: 0.35,
                    sustain: 0,
                    release: 0.2
                },
                octaves: 6,
                pitchDecay: 0.05
            }).toDestination();

            // 2. Snare / Clap: Short white noise decay through a bandpass filter
            this.snareFilter = new Tone.Filter({
                type: "bandpass",
                frequency: 1000,
                Q: 2
            }).toDestination();

            this.snare = new Tone.NoiseSynth({
                noise: {
                    type: "pink"
                },
                envelope: {
                    attack: 0.005,
                    decay: 0.1,
                    sustain: 0
                }
            }).connect(this.snareFilter);

            // 3. Closed Hi-hat: Very short metallic-like noise peak
            this.hatFilter = new Tone.Filter({
                type: "highpass",
                frequency: 7000
            }).toDestination();

            this.hat = new Tone.NoiseSynth({
                noise: {
                    type: "white"
                },
                envelope: {
                    attack: 0.001,
                    decay: 0.03,
                    sustain: 0
                }
            }).connect(this.hatFilter);

            // 4. Bassline: Monophonic FM Synth for deep round bass tones
            this.bass = new Tone.MonoSynth({
                oscillator: {
                    type: "triangle"
                },
                filter: {
                    Q: 1,
                    type: "lowpass",
                    frequency: 200
                },
                envelope: {
                    attack: 0.02,
                    decay: 0.2,
                    sustain: 0.8,
                    release: 0.3
                },
                filterEnvelope: {
                    attack: 0.01,
                    decay: 0.1,
                    sustain: 0.5,
                    baseFrequency: 100,
                    octaves: 1.2
                }
            }).toDestination();

            // 5. Chime/SFX: Polyphonic synth for success/failure feedback
            this.chimeSynth = new Tone.PolySynth(Tone.Synth, {
                oscillator: {
                    type: "sine"
                },
                envelope: {
                    attack: 0.01,
                    decay: 0.2,
                    sustain: 0.3,
                    release: 0.8
                }
            }).toDestination();

            // 6. Real Song Preview Player & EQ Filters
            this.clueFilter = new Tone.Filter({
                type: "lowpass",
                frequency: 20000
            }).toDestination();

            this.songPlayer = new Tone.Player({
                autostart: false
            }).connect(this.clueFilter);

            // Set up analyzer for audio visualization
            this.analyser = new Tone.Analyser("fft", 256);
            Tone.Destination.connect(this.analyser);

            this.initialized = true;
            this._initPromise = null;
        })();

        return this._initPromise;
    }

    start(recipe) {
        if (!this.initialized) {
            console.error("Audio engine not initialized");
            return;
        }

        if (this.rampRequestId) {
            cancelAnimationFrame(this.rampRequestId);
            this.rampRequestId = null;
        }

        this.stop(false, true); // Clean any active schedules immediately and synchronously

        this.playbackSessionId++;
        const currentSession = this.playbackSessionId;
        this.playing = true;

        this.bpm = recipe.bpm || 120;
        this.genre = recipe.genre || "beginner";
        this.clueLevel = recipe.clueLevel !== undefined ? recipe.clueLevel : 4;
        this.previewUrl = recipe.previewUrl || null;
        this.originalBpm = recipe.originalBpm || null;

        // Ensure Tone.js Transport BPM is reset
        Tone.Transport.bpm.value = this.bpm;

        if (this.previewUrl && this.songPlayer) {
            // Real audio preview mode
            const rate = this.bpm / (this.originalBpm || 120);
            this.songPlayer.playbackRate = rate;

            // Apply lowpass clue filtering (simulates muting stems dynamically)
            let cutoff = 20000;
            if (this.clueLevel === 1) cutoff = 150;       // Sub-bass only
            else if (this.clueLevel === 2) cutoff = 1000;  // Rhythm/vocal body
            else if (this.clueLevel === 3) cutoff = 5000;  // Removes high cymbals

            this.clueFilter.frequency.value = cutoff;

            // Load and play the preview URL
            this.songPlayer.load(this.previewUrl).then(() => {
                if (currentSession !== this.playbackSessionId || !this.playing) {
                    return;
                }
                const now = Tone.now();
                Tone.Destination.volume.setValueAtTime(-40, now);
                Tone.Destination.volume.linearRampToValueAtTime(0, now + 0.05);

                this.songPlayer.start();
            }).catch(err => {
                if (currentSession !== this.playbackSessionId || !this.playing) {
                    return;
                }
                console.warn("Failed to load audio preview, falling back to synth loops:", err);
                this.startSynthSequencer();
            });
        } else {
            // Synth loop mode
            this.startSynthSequencer();
        }
    }

    startSynthSequencer() {
        // Schedule sequencer based on genre
        if (this.genre === "house" || this.genre === "dance-pop") {
            this.scheduleHouse();
        } else if (this.genre === "trap") {
            this.scheduleTrap();
        } else if (this.genre === "pop-punk") {
            this.schedulePopPunk();
        } else {
            this.scheduleBeginner();
        }

        // Fade in master volume to prevent clicks
        const now = Tone.now();
        Tone.Destination.volume.setValueAtTime(-40, now);
        Tone.Destination.volume.linearRampToValueAtTime(0, now + 0.05);

        // Start the Transport timeline loop
        Tone.Transport.start();
        this.playing = true;
    }

    stop(withBrake = false, forceSync = false) {
        if (this.rampRequestId) {
            cancelAnimationFrame(this.rampRequestId);
            this.rampRequestId = null;
        }

        const now = Tone.now();
        if (withBrake && this.playing) {
            const originalBpm = this.bpm;

            // Decelerate (vinyl slowdown)
            if (this.previewUrl && this.songPlayer) {
                const startRate = this.songPlayer.playbackRate;
                const targetRate = 20 / (this.originalBpm || 120);
                const duration = 450; // ms
                const startTime = performance.now();
                const animateRamp = (nowTime) => {
                    const elapsed = nowTime - startTime;
                    if (elapsed < duration) {
                        const progress = elapsed / duration;
                        this.songPlayer.playbackRate = startRate + (targetRate - startRate) * progress;
                        this.rampRequestId = requestAnimationFrame(animateRamp);
                    } else {
                        this.songPlayer.playbackRate = targetRate;
                    }
                };
                this.rampRequestId = requestAnimationFrame(animateRamp);
            } else {
                Tone.Transport.bpm.rampTo(20, 0.45);
            }

            // Fade out master volume
            Tone.Destination.volume.setValueAtTime(Tone.Destination.volume.value, now);
            Tone.Destination.volume.linearRampToValueAtTime(-40, now + 0.45);

            const stopAction = () => {
                if (this.songPlayer) {
                    this.songPlayer.stop();
                    this.songPlayer.playbackRate = 1.0;
                }
                Tone.Transport.stop();
                Tone.Transport.cancel();

                // Clear all loops
                this.loopIds.forEach(id => Tone.Transport.clear(id));
                this.loopIds = [];

                // Reset volume and BPM for next session
                Tone.Destination.volume.value = 0;
                Tone.Transport.bpm.value = originalBpm;
                this.playing = false;
            };

            if (forceSync) {
                stopAction();
            } else {
                setTimeout(stopAction, 450);
            }
        } else {
            const stopAction = () => {
                if (this.songPlayer) {
                    this.songPlayer.stop();
                    this.songPlayer.playbackRate = 1.0;
                }
                Tone.Transport.stop();
                Tone.Transport.cancel();

                // Clear all loops
                this.loopIds.forEach(id => Tone.Transport.clear(id));
                this.loopIds = [];

                Tone.Destination.volume.value = 0;
                this.playing = false;
            };

            if (forceSync) {
                stopAction();
            } else {
                // Instant stop - fade out over 50ms first to prevent click
                Tone.Destination.volume.setValueAtTime(Tone.Destination.volume.value, now);
                Tone.Destination.volume.linearRampToValueAtTime(-40, now + 0.05);

                setTimeout(stopAction, 50);
            }
        }
    }

    playTransitionSFX(callback) {
        const now = Tone.now();

        // Start white noise generator
        this.noiseGenerator.start(now);
        this.noiseGenerator.volume.setValueAtTime(-60, now);
        this.noiseGenerator.volume.exponentialRampToValueAtTime(-15, now + 0.15);
        this.transitionFilter.frequency.setValueAtTime(100, now);
        this.transitionFilter.frequency.exponentialRampToValueAtTime(8000, now + 0.3);

        // Decay noise to absolute silence
        this.noiseGenerator.volume.linearRampToValueAtTime(-80, now + 0.4);

        setTimeout(() => {
            this.noiseGenerator.stop();
            // Trigger callback after 400ms of absolute silence (acoustic palate cleanser)
            if (callback) callback();
        }, 800);
    }

    transitionToTest(targetBpm, callback) {
        if (!this.playing) return;

        if (this.rampRequestId) {
            cancelAnimationFrame(this.rampRequestId);
            this.rampRequestId = null;
        }

        // Turntable deceleration brake ramp
        const now = Tone.now();
        if (this.previewUrl && this.songPlayer) {
            const startRate = this.songPlayer.playbackRate;
            const targetRate = 20 / (this.originalBpm || 120);
            const duration = 300; // ms
            const startTime = performance.now();
            const animateRamp = (nowTime) => {
                const elapsed = nowTime - startTime;
                if (elapsed < duration) {
                    const progress = elapsed / duration;
                    this.songPlayer.playbackRate = startRate + (targetRate - startRate) * progress;
                    this.rampRequestId = requestAnimationFrame(animateRamp);
                } else {
                    this.songPlayer.playbackRate = targetRate;
                }
            };
            this.rampRequestId = requestAnimationFrame(animateRamp);
        } else {
            Tone.Transport.bpm.rampTo(20, 0.3);
        }

        // Fade out master volume
        Tone.Destination.volume.setValueAtTime(Tone.Destination.volume.value, now);
        Tone.Destination.volume.linearRampToValueAtTime(-40, now + 0.3);

        setTimeout(() => {
            if (this.songPlayer) {
                this.songPlayer.stop();
                this.songPlayer.playbackRate = 1.0;
            }
            Tone.Transport.stop();
            Tone.Transport.cancel();
            this.loopIds.forEach(id => Tone.Transport.clear(id));
            this.loopIds = [];

            // Reset master volume for transition SFX
            Tone.Destination.volume.value = 0;

            // Play the acoustic cleanser sweep
            this.playTransitionSFX(() => {
                this.bpm = targetBpm;

                if (this.previewUrl && this.songPlayer) {
                    const rate = targetBpm / (this.originalBpm || 120);
                    this.songPlayer.playbackRate = rate;

                    // Clue filter level
                    let cutoff = 20000;
                    if (this.clueLevel === 1) cutoff = 150;
                    else if (this.clueLevel === 2) cutoff = 1000;
                    else if (this.clueLevel === 3) cutoff = 5000;
                    this.clueFilter.frequency.value = cutoff;

                    // Fade in master volume during spin up
                    const nowSpin = Tone.now();
                    Tone.Destination.volume.setValueAtTime(-40, nowSpin);
                    Tone.Destination.volume.linearRampToValueAtTime(0, nowSpin + 0.45);

                    this.songPlayer.start();
                    // optional: ramp the playback rate up from low speed to mimic spin-up
                    if (this.rampRequestId) {
                        cancelAnimationFrame(this.rampRequestId);
                        this.rampRequestId = null;
                    }
                    const startSpinRate = 40 / (this.originalBpm || 120);
                    const durationSpin = 450; // ms
                    const startTimeSpin = performance.now();
                    const animateSpin = (nowTime) => {
                        const elapsed = nowTime - startTimeSpin;
                        if (elapsed < durationSpin) {
                            const progress = elapsed / durationSpin;
                            this.songPlayer.playbackRate = startSpinRate + (rate - startSpinRate) * progress;
                            this.rampRequestId = requestAnimationFrame(animateSpin);
                        } else {
                            this.songPlayer.playbackRate = rate;
                        }
                    };
                    this.rampRequestId = requestAnimationFrame(animateSpin);
                } else {
                    Tone.Transport.bpm.value = 40; // start low

                    if (this.genre === "house" || this.genre === "dance-pop") this.scheduleHouse();
                    else if (this.genre === "trap") this.scheduleTrap();
                    else if (this.genre === "pop-punk") this.schedulePopPunk();
                    else this.scheduleBeginner();

                    // Fade in master volume during spin up
                    const nowSpin = Tone.now();
                    Tone.Destination.volume.setValueAtTime(-40, nowSpin);
                    Tone.Destination.volume.linearRampToValueAtTime(0, nowSpin + 0.45);

                    Tone.Transport.start();
                    Tone.Transport.bpm.rampTo(targetBpm, 0.45);
                }

                if (callback) callback();
            });
        }, 300);
    }

    playChime(isSuccess) {
        if (!this.initialized || !this.chimeSynth) return;

        const now = Tone.now();
        if (isSuccess) {
            // Bright major triad arpeggio
            this.chimeSynth.triggerAttackRelease("C5", "16n", now);
            this.chimeSynth.triggerAttackRelease("E5", "16n", now + 0.08);
            this.chimeSynth.triggerAttackRelease("G5", "16n", now + 0.16);
            this.chimeSynth.triggerAttackRelease("C6", "4n", now + 0.24);
        } else {
            // Low minor chord sweep
            this.chimeSynth.triggerAttackRelease("C3", "16n", now);
            this.chimeSynth.triggerAttackRelease("D#3", "16n", now + 0.1);
            this.chimeSynth.triggerAttackRelease("G3", "2n", now + 0.2);
        }
    }

    dispose() {
        this.stop(false, true);
        if (this.analyser) {
            try {
                Tone.Destination.disconnect(this.analyser);
            } catch (e) {
                console.warn("Error disconnecting visualizer analyser:", e);
            }
            this.analyser = null;
        }
        if (this.kick) { this.kick.dispose(); this.kick = null; }
        if (this.snare) { this.snare.dispose(); this.snare = null; }
        if (this.snareFilter) { this.snareFilter.dispose(); this.snareFilter = null; }
        if (this.hat) { this.hat.dispose(); this.hat = null; }
        if (this.hatFilter) { this.hatFilter.dispose(); this.hatFilter = null; }
        if (this.bass) { this.bass.dispose(); this.bass = null; }
        if (this.chimeSynth) { this.chimeSynth.dispose(); this.chimeSynth = null; }
        if (this.noiseGenerator) { this.noiseGenerator.dispose(); this.noiseGenerator = null; }
        if (this.transitionFilter) { this.transitionFilter.dispose(); this.transitionFilter = null; }
        if (this.songPlayer) { this.songPlayer.dispose(); this.songPlayer = null; }
        if (this.clueFilter) { this.clueFilter.dispose(); this.clueFilter = null; }
        this.initialized = false;
        this._initPromise = null;
    }

    // --- GENRE PATTERNS ---

    scheduleBeginner() {
        // Kick on 1 and 3 (quarter note beat)
        const kickLoop = new Tone.Loop(time => {
            this.kick.triggerAttackRelease("C1", "8n", time);
        }, "2n");

        // Snare on 2 and 4
        const snareLoop = new Tone.Loop(time => {
            if (this.clueLevel >= 2) {
                this.snare.triggerAttackRelease("16n", time);
            }
        }, "2n");

        // Hihat on every 8th note
        const hatLoop = new Tone.Loop(time => {
            if (this.clueLevel >= 3) {
                this.hat.triggerAttackRelease("16n", time);
            }
        }, "8n");

        kickLoop.start("0:0:0");
        snareLoop.start("0:1:0"); // delayed by 1 quarter note
        hatLoop.start("0:0:0");

        this.loopIds.push(kickLoop.id, snareLoop.id, hatLoop.id);
    }

    scheduleHouse() {
        // 4-to-the-floor kick (kick on 1, 2, 3, 4)
        const kickLoop = new Tone.Loop(time => {
            this.kick.triggerAttackRelease("C1", "8n", time);
        }, "4n");

        // Snare on 2 and 4
        const snareLoop = new Tone.Loop(time => {
            if (this.clueLevel >= 2) {
                this.snare.triggerAttackRelease("16n", time);
            }
        }, "2n");

        // Offbeat Open Hihats
        const hatLoop = new Tone.Loop(time => {
            if (this.clueLevel >= 3) {
                this.hat.envelope.decay = 0.15;
                this.hat.triggerAttackRelease("16n", time);
            }
        }, "4n");

        // Bassline rhythm
        let bassStep = 0;
        const bassNotes = ["C1", "D#1", "G1", "A#1"];
        const bassLoop = new Tone.Loop(time => {
            if (this.clueLevel >= 4 && bassStep % 2 === 1) {
                const note = bassNotes[Math.floor(bassStep / 2) % bassNotes.length];
                this.bass.triggerAttackRelease(note, "8n", time);
            }
            bassStep = (bassStep + 1) % 8;
        }, "8n");

        kickLoop.start("0:0:0");
        snareLoop.start("0:1:0");
        hatLoop.start("0:0:2"); // Offset by an eighth note
        bassLoop.start("0:0:0");

        this.loopIds.push(kickLoop.id, snareLoop.id, hatLoop.id, bassLoop.id);
    }

    scheduleTrap() {
        // Kick pattern sequence inside 1 measure
        const kickPattern = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0];
        let kickStep = 0;
        const kickLoop = new Tone.Loop(time => {
            if (kickPattern[kickStep]) {
                this.kick.triggerAttackRelease("B0", "4n", time);
            }
            kickStep = (kickStep + 1) % 16;
        }, "16n");

        // Snare on beat 3
        let snareStep = 0;
        const snareLoop = new Tone.Loop(time => {
            if (snareStep === 8 && this.clueLevel >= 2) {
                this.snare.envelope.decay = 0.2;
                this.snare.triggerAttackRelease("8n", time);
            }
            snareStep = (snareStep + 1) % 16;
        }, "16n");

        // Hi-hat rolls
        let hatStep = 0;
        const hatLoop = new Tone.Loop(time => {
            if (this.clueLevel >= 3) {
                let playHat = false;

                if (hatStep % 4 === 0) {
                    playHat = true;
                    this.hat.envelope.decay = 0.06;
                } else if (hatStep >= 8 && hatStep < 12 && hatStep % 2 === 0) {
                    playHat = true;
                    this.hat.envelope.decay = 0.03;
                } else if (hatStep === 14 || hatStep === 15) {
                    playHat = true;
                    this.hat.envelope.decay = 0.02;
                }

                if (playHat) {
                    this.hat.triggerAttackRelease("16n", time);
                }
            }
            hatStep = (hatStep + 1) % 16;
        }, "16n");

        kickLoop.start("0:0:0");
        snareLoop.start("0:0:0");
        hatLoop.start("0:0:0");

        this.loopIds.push(kickLoop.id, snareLoop.id, hatLoop.id);
    }

    schedulePopPunk() {
        // Syncopated rock kick
        const kickPattern = [1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0];
        let kickStep = 0;
        const kickLoop = new Tone.Loop(time => {
            if (kickPattern[kickStep]) {
                this.kick.triggerAttackRelease("C1", "8n", time);
            }
            kickStep = (kickStep + 1) % 16;
        }, "16n");

        // Snare drum on 2 and 4
        let snareStep = 0;
        const snareLoop = new Tone.Loop(time => {
            if ((snareStep === 4 || snareStep === 12) && this.clueLevel >= 2) {
                this.snare.triggerAttackRelease("16n", time);
            }
            snareStep = (snareStep + 1) % 16;
        }, "16n");

        // Driving 8th-note Hi-hats
        let hatStep = 0;
        const hatLoop = new Tone.Loop(time => {
            if (hatStep % 2 === 0 && this.clueLevel >= 3) {
                this.hat.triggerAttackRelease("16n", time);
            }
            hatStep = (hatStep + 1) % 16;
        }, "16n");

        // Driving Pop-Punk Bassline (C - G - Am - F progression in C major)
        let bassStep = 0;
        const bassNotes = ["C1", "C1", "G1", "G1", "A1", "A1", "F1", "F1"];
        const bassLoop = new Tone.Loop(time => {
            if (this.clueLevel >= 4 && bassStep % 2 === 0) {
                const note = bassNotes[Math.floor(bassStep / 2) % bassNotes.length];
                this.bass.triggerAttackRelease(note, "8n", time);
            }
            bassStep = (bassStep + 1) % 16;
        }, "16n");

        kickLoop.start("0:0:0");
        snareLoop.start("0:0:0");
        hatLoop.start("0:0:0");
        bassLoop.start("0:0:0");

        this.loopIds.push(kickLoop.id, snareLoop.id, hatLoop.id, bassLoop.id);
    }
}

// Instantiate and bind to window global
window.audioEngine = new BpmAudioEngine();

class InvisibleMetronomeController {
    constructor(bpm, startAudioTime, audioContext = Tone.context) {
        this.bpm = bpm;
        this.startAudioTime = startAudioTime; // AudioContext currentTime when metronome starts (seconds)
        this.beatIntervalMs = (60 / bpm) * 1000;
        this.audioContext = audioContext;
    }

    /**
     * Calculates signed phase error (ms) for a given tap.
     * Negative: Rushing (early).
     * Positive: Dragging (late).
     * @param {number} tapTimestamp - DOMHighResTimeStamp from event (performance.now() scale)
     */
    getPhaseError(tapTimestamp) {
        const perfNow = performance.now();
        const audioNow = this.audioContext.currentTime;

        // 1. Clock translation offset
        const clockOffset = perfNow - (audioNow * 1000);

        // 2. Hardware output latency compensation
        const outputLatencyMs = (this.audioContext.rawContext.outputLatency || 0) * 1000;

        // 3. Translate metronome start time to performance.now() domain
        const startPerfTime = (this.startAudioTime * 1000) + clockOffset + outputLatencyMs;

        // 4. Calculate time elapsed since metronome start
        const elapsed = tapTimestamp - startPerfTime;

        // 5. Determine closest target beat
        const closestBeatIndex = Math.round(elapsed / this.beatIntervalMs);
        const targetBeatPerfTime = startPerfTime + (closestBeatIndex * this.beatIntervalMs);

        // 6. Return signed error in milliseconds
        return tapTimestamp - targetBeatPerfTime;
    }
}

window.InvisibleMetronomeController = InvisibleMetronomeController;

class MidiDeviceManager {
    constructor() {
        this.access = null;
        this.inputs = [];
        this.onNoteOnCallback = null;
        this.onNoteOffCallback = null;
    }

    async init() {
        if (!navigator.requestMIDIAccess) {
            throw new Error("Web MIDI API not supported in this browser.");
        }
        try {
            this.access = await navigator.requestMIDIAccess();
            this.access.onstatechange = (e) => {
                this.updateInputs();
            };
            this.updateInputs();
        } catch (err) {
            throw new Error("MIDI access request failed: " + err.message);
        }
    }

    updateInputs() {
        if (!this.access) return;
        // Unbind from old inputs to prevent multiple listeners
        this.inputs.forEach(input => {
            input.onmidimessage = null;
        });
        this.inputs = [];

        const inputsIterator = this.access.inputs.values();
        for (let input = inputsIterator.next(); input && !input.done; input = inputsIterator.next()) {
            const dev = input.value;
            this.inputs.push(dev);
            this.registerInput(dev);
        }
    }

    registerInput(inputDevice) {
        inputDevice.onmidimessage = (event) => {
            const statusByte = event.data[0];

            // Discard system real-time messages (0xF8 - 0xFF) to prevent main thread choking
            // e.g. 0xF8 = MIDI Clock, 0xFE = Active Sensing
            if (statusByte >= 0xF8) {
                return;
            }

            const command = statusByte & 0xF0;
            const note = event.data[1];
            const velocity = event.data[2];
            const timestamp = event.timeStamp; // performance.now() domain timestamp

            if (command === 0x90 && velocity > 0) { // Note On
                if (this.onNoteOnCallback) {
                    this.onNoteOnCallback(note, velocity, timestamp);
                }
            } else if (command === 0x80 || (command === 0x90 && velocity === 0)) { // Note Off
                if (this.onNoteOffCallback) {
                    this.onNoteOffCallback(note, velocity, timestamp);
                }
            }
        };
    }

    onNoteOn(callback) {
        this.onNoteOnCallback = callback;
    }

    onNoteOff(callback) {
        this.onNoteOffCallback = callback;
    }

    getConnectedDevices() {
        return this.inputs.map(dev => ({
            id: dev.id,
            name: dev.name,
            manufacturer: dev.manufacturer
        }));
    }

    dispose() {
        // Nullify all connection handlers to avoid memory leaks (M10)
        if (this.access) {
            this.access.onstatechange = null;
            this.access = null;
        }
        this.inputs.forEach(input => {
            input.onmidimessage = null;
        });
        this.inputs = [];
        this.onNoteOnCallback = null;
        this.onNoteOffCallback = null;
    }
}

window.MidiDeviceManager = MidiDeviceManager;
