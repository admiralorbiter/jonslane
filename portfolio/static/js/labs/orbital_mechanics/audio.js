/**
 * Orbital Mechanics Sandbox Procedural Sound Synth (Web Audio API)
 * Provides:
 *  1. Ambient space background pad (modulating low-pass noise & resonance)
 *  2. Engine thruster rumble (Low sawtooth oscillator + sweep LPF filter)
 *  3. SOI boundary transition chime (high arpeggiated sweep)
 *  4. Warning clicks & warning pitch slide (near collision warning)
 *  5. Success major chord fanfare
 *  6. Failure dissonant slide
 */

const OrbitAudio = (function () {
    let ctx = null;
    let isMuted = false;

    // Ambient space background nodes
    let ambientOsc1 = null;
    let ambientOsc2 = null;
    let ambientGain = null;

    // Engine thruster nodes
    let engineOsc = null;
    let engineFilter = null;
    let engineGain = null;

    /**
     * Initializes the Web Audio Context after a user gesture.
     */
    function initContext() {
        if (ctx) return;
        try {
            ctx = new (window.AudioContext || window.webkitAudioContext)();
            startSpaceAmbience();
        } catch (e) {
            console.error("Web Audio API not supported:", e);
        }
    }

    /**
     * Starts a subtle low-frequency background hum.
     */
    function startSpaceAmbience() {
        if (!ctx || isMuted) return;

        // Base carrier oscillator (55Hz drone)
        ambientOsc1 = ctx.createOscillator();
        ambientOsc1.type = "sine";
        ambientOsc1.frequency.setValueAtTime(55, ctx.currentTime);

        // Slow frequency modulator LFO
        ambientOsc2 = ctx.createOscillator();
        ambientOsc2.type = "triangle";
        ambientOsc2.frequency.setValueAtTime(0.08, ctx.currentTime); // very slow 

        const lfoGain = ctx.createGain();
        lfoGain.gain.setValueAtTime(1.5, ctx.currentTime); // modulation depth

        ambientGain = ctx.createGain();
        ambientGain.gain.setValueAtTime(0.015, ctx.currentTime); // very quiet

        // LFO modulates carrier frequency
        ambientOsc2.connect(lfoGain);
        lfoGain.connect(ambientOsc1.frequency);

        ambientOsc1.connect(ambientGain);
        ambientGain.connect(ctx.destination);

        ambientOsc1.start();
        ambientOsc2.start();
    }

    function stopSpaceAmbience() {
        if (ambientOsc1) {
            try { ambientOsc1.stop(); } catch(e){}
            ambientOsc1 = null;
        }
        if (ambientOsc2) {
            try { ambientOsc2.stop(); } catch(e){}
            ambientOsc2 = null;
        }
    }

    /**
     * Plays the thruster engine rumble.
     */
    function startThruster() {
        initContext();
        if (!ctx || isMuted) return;
        if (engineOsc) return; // already firing

        engineOsc = ctx.createOscillator();
        engineOsc.type = "sawtooth";
        engineOsc.frequency.setValueAtTime(65, ctx.currentTime); // low rumble

        engineFilter = ctx.createBiquadFilter();
        engineFilter.type = "lowpass";
        engineFilter.frequency.setValueAtTime(120, ctx.currentTime);
        engineFilter.Q.setValueAtTime(4.0, ctx.currentTime);

        engineGain = ctx.createGain();
        engineGain.gain.setValueAtTime(0.0, ctx.currentTime);
        
        // Connect
        engineOsc.connect(engineFilter);
        engineFilter.connect(engineGain);
        engineGain.connect(ctx.destination);

        engineOsc.start();

        // Ramp volume up quickly to avoid clicking sound
        engineGain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.1);
        // Sweep filter slightly for texture
        engineFilter.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.5);
    }

    /**
     * Dampens and terminates thruster sound.
     */
    function stopThruster() {
        if (!ctx || !engineOsc) return;

        const currentGain = engineGain.gain.value;
        engineGain.gain.cancelScheduledValues(ctx.currentTime);
        engineGain.gain.setValueAtTime(currentGain, ctx.currentTime);
        engineGain.gain.linearRampToValueAtTime(0.0, ctx.currentTime + 0.15);

        const oscToStop = engineOsc;
        engineOsc = null;

        setTimeout(() => {
            try { oscToStop.stop(); } catch(e){}
        }, 200);
    }

    /**
     * Synthesizes a high-frequency chime to notify SOI crossing.
     */
    function playSOICrossing() {
        initContext();
        if (!ctx || isMuted) return;

        const now = ctx.currentTime;
        
        // Fast major arpeggio
        const notes = [440, 554, 659, 880]; // A major
        notes.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = "sine";
            osc.frequency.setValueAtTime(freq, now + idx * 0.08);

            gain.gain.setValueAtTime(0, now);
            gain.gain.setValueAtTime(0.08, now + idx * 0.08);
            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.4);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now + idx * 0.08);
            osc.stop(now + idx * 0.08 + 0.5);
        });
    }

    /**
     * Short high beep for navigation checks or collision warnings.
     */
    function playWarningClick() {
        initContext();
        if (!ctx || isMuted) return;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(980, ctx.currentTime); // High pitch alert

        gain.gain.setValueAtTime(0.06, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.1);
    }

    /**
     * Triumphant major arpeggio fanfare for quest success.
     */
    function playSuccessFanfare() {
        initContext();
        if (!ctx || isMuted) return;

        const now = ctx.currentTime;
        const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50]; // C Major arpeggio
        
        notes.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = "triangle";
            osc.frequency.setValueAtTime(freq, now + idx * 0.12);

            gain.gain.setValueAtTime(0, now);
            gain.gain.setValueAtTime(0.12, now + idx * 0.12);
            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.6);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now + idx * 0.12);
            osc.stop(now + idx * 0.12 + 0.8);
        });
    }

    /**
     * Low descending slide representing crash or navigation failure.
     */
    function playFailureBuzz() {
        initContext();
        if (!ctx || isMuted) return;

        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.linearRampToValueAtTime(45, now + 1.2); // slide down

        gain.gain.setValueAtTime(0.16, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 1.2);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(now + 1.3);
    }

    /**
     * Toggles global mute state.
     */
    function toggleMute() {
        isMuted = !isMuted;
        if (isMuted) {
            stopSpaceAmbience();
            stopThruster();
        } else {
            if (ctx) {
                startSpaceAmbience();
            }
        }
        return isMuted;
    }

    // Public API
    return {
        init: initContext,
        startThruster,
        stopThruster,
        playSOICrossing,
        playWarningClick,
        playSuccessFanfare,
        playFailureBuzz,
        toggleMute
    };
})();
