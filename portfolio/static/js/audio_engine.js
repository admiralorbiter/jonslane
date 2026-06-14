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
        this.hat = null;
        this.bass = null;
        this.chimeSynth = null;
        this.noiseGenerator = null;
        this.transitionFilter = null;

        // Loop IDs for scheduling
        this.loopIds = [];
        this.analyser = null;
    }

    async init() {
        if (this.initialized) return;

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
        const snareFilter = new Tone.Filter({
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
        }).connect(snareFilter);

        // 3. Closed Hi-hat: Very short metallic-like noise peak
        const hatFilter = new Tone.Filter({
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
        }).connect(hatFilter);

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

        // Set up analyzer for audio visualization
        this.analyser = new Tone.Analyser("fft", 256);
        Tone.Destination.connect(this.analyser);

        this.initialized = true;
    }

    start(recipe) {
        if (!this.initialized) {
            console.error("Audio engine not initialized");
            return;
        }

        this.stop(false, true); // Clean any active schedules immediately and synchronously

        this.bpm = recipe.bpm || 120;
        this.genre = recipe.genre || "beginner";
        this.clueLevel = recipe.clueLevel !== undefined ? recipe.clueLevel : 4;

        // Ensure Tone.js Transport BPM is reset
        Tone.Transport.bpm.value = this.bpm;

        // Schedule sequencer based on genre
        if (this.genre === "house") {
            this.scheduleHouse();
        } else if (this.genre === "trap") {
            this.scheduleTrap();
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
        const now = Tone.now();
        if (withBrake && this.playing) {
            const originalBpm = this.bpm;

            // Decelerate turntable to 20 BPM over 0.45 seconds
            Tone.Transport.bpm.rampTo(20, 0.45);
            // Fade out master volume
            Tone.Destination.volume.setValueAtTime(Tone.Destination.volume.value, now);
            Tone.Destination.volume.linearRampToValueAtTime(-40, now + 0.45);

            const stopAction = () => {
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
        this.noiseGenerator.volume.exponentialRampToValueAtTime(-Infinity, now + 0.4);
        
        setTimeout(() => {
            this.noiseGenerator.stop();
            // Trigger callback after 400ms of absolute silence (acoustic palate cleanser)
            if (callback) callback();
        }, 800);
    }

    transitionToTest(targetBpm, callback) {
        if (!this.playing) return;

        // Turntable deceleration brake ramp
        Tone.Transport.bpm.rampTo(20, 0.3);

        // Fade out master volume
        const now = Tone.now();
        Tone.Destination.volume.setValueAtTime(Tone.Destination.volume.value, now);
        Tone.Destination.volume.linearRampToValueAtTime(-40, now + 0.3);

        setTimeout(() => {
            Tone.Transport.stop();
            Tone.Transport.cancel();
            this.loopIds.forEach(id => Tone.Transport.clear(id));
            this.loopIds = [];

            // Reset master volume for transition SFX
            Tone.Destination.volume.value = 0;

            // Play the acoustic cleanser sweep
            this.playTransitionSFX(() => {
                this.bpm = targetBpm;
                Tone.Transport.bpm.value = 40; // start low
                
                if (this.genre === "house") this.scheduleHouse();
                else if (this.genre === "trap") this.scheduleTrap();
                else this.scheduleBeginner();

                // Fade in master volume during spin up
                const nowSpin = Tone.now();
                Tone.Destination.volume.setValueAtTime(-40, nowSpin);
                Tone.Destination.volume.linearRampToValueAtTime(0, nowSpin + 0.45);

                Tone.Transport.start();
                Tone.Transport.bpm.rampTo(targetBpm, 0.45);
                
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
        if (this.kick) this.kick.dispose();
        if (this.snare) this.snare.dispose();
        if (this.hat) this.hat.dispose();
        if (this.bass) this.bass.dispose();
        if (this.chimeSynth) this.chimeSynth.dispose();
        if (this.noiseGenerator) this.noiseGenerator.dispose();
        if (this.transitionFilter) this.transitionFilter.dispose();
        this.initialized = false;
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
}

// Instantiate and bind to window global
window.audioEngine = new BpmAudioEngine();
