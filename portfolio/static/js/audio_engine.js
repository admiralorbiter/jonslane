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

        // Loop IDs for scheduling
        this.loopIds = [];
        this.analyser = null;
    }

    async init() {
        if (this.initialized) return;

        // Start the Tone audio context if suspended
        await Tone.start();

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
                attack: 0.001,
                decay: 0.15,
                sustain: 0,
                release: 0.1
            }
        }).connect(snareFilter);

        // 3. Hi-hat: High frequency metal/noise synth for closed/open hats
        const hatFilter = new Tone.Filter({
            type: "highpass",
            frequency: 7000,
            Q: 1
        }).toDestination();

        this.hat = new Tone.NoiseSynth({
            noise: {
                type: "white"
            },
            envelope: {
                attack: 0.001,
                decay: 0.05,
                sustain: 0,
                release: 0.05
            }
        }).connect(hatFilter);

        // 4. Bass: Monophonic synth with lowpass filter for deep sub bassline
        const bassFilter = new Tone.Filter({
            type: "lowpass",
            frequency: 300,
            Q: 1
        }).toDestination();

        this.bass = new Tone.MonoSynth({
            oscillator: {
                type: "triangle"
            },
            envelope: {
                attack: 0.05,
                decay: 0.2,
                sustain: 0.4,
                release: 0.2
            },
            filterEnvelope: {
                attack: 0.01,
                decay: 0.1,
                sustain: 0.5,
                release: 0.2,
                baseFrequency: 200,
                octaves: 2
            }
        }).connect(bassFilter);

        // 5. Chime: PolySynth for feedback chord sweeps
        this.chimeSynth = new Tone.PolySynth(Tone.Synth, {
            oscillator: {
                type: "triangle"
            },
            envelope: {
                attack: 0.01,
                decay: 0.6,
                sustain: 0.1,
                release: 0.6
            }
        }).toDestination();
        this.chimeSynth.volume.value = -8; // Keep feedback chimes comfortable

        // Limit maximum volume to prevent ear blowout
        Tone.Destination.volume.value = -6; // -6dB standard volume limit

        // Create Web Audio Analyser node for the live visualization
        this.analyser = Tone.context.createAnalyser();
        this.analyser.fftSize = 128;
        Tone.Destination.connect(this.analyser);

        this.initialized = true;
    }

    start(recipe) {
        if (!this.initialized) {
            console.error("Audio engine not initialized");
            return;
        }

        this.stop(false); // Clean any active schedules immediately without braking

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

        // Start the Transport timeline loop
        Tone.Transport.start();
        this.playing = true;
    }

    stop(withBrake = false) {
        if (withBrake && this.playing) {
            const originalBpm = this.bpm;

            // Decelerate turntable to 20 BPM over 0.5 seconds
            Tone.Transport.bpm.rampTo(20, 0.45);

            setTimeout(() => {
                Tone.Transport.stop();
                Tone.Transport.cancel();

                // Clear all loops
                this.loopIds.forEach(id => Tone.Transport.clear(id));
                this.loopIds = [];

                // Reset BPM to original for next session
                Tone.Transport.bpm.value = originalBpm;
                this.playing = false;
            }, 450);
        } else {
            // Instant stop
            Tone.Transport.stop();
            Tone.Transport.cancel();

            // Clear all loops
            this.loopIds.forEach(id => Tone.Transport.clear(id));
            this.loopIds = [];

            this.playing = false;
        }
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
        this.stop(false);
        if (this.kick) this.kick.dispose();
        if (this.snare) this.snare.dispose();
        if (this.hat) this.hat.dispose();
        if (this.bass) this.bass.dispose();
        if (this.chimeSynth) this.chimeSynth.dispose();
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
