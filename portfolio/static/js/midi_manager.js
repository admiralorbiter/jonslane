/**
 * PrecisionAudioSync translates a DOMHighResTimeStamp (e.g. from event.timeStamp)
 * to AudioContext time in seconds, accounting for output latency without double compensation.
 */
class PrecisionAudioSync {
    constructor(audioContext) {
        this.context = audioContext;
    }

    /**
     * Translates a performance.now() timestamp (in ms) to AudioContext time (in seconds).
     * @param {number} performanceTimeMs - DOMHighResTimeStamp from event.timeStamp
     * @returns {number} AudioContext time in seconds
     */
    perfToAudioTime(performanceTimeMs) {
        const rawCtx = this.context.rawContext || this.context;
        const timestamp = rawCtx.getOutputTimestamp ? rawCtx.getOutputTimestamp() : null;

        if (timestamp && timestamp.performanceTime !== null && timestamp.contextTime !== null) {
            // High-precision path using hardware clock pairing
            // performanceTime already includes output latency, so no additional offset is needed
            const clockOffset = timestamp.performanceTime - (timestamp.contextTime * 1000);
            return (performanceTimeMs - clockOffset) / 1000;
        } else {
            // Fallback path
            const clockOffset = performance.now() - (this.context.currentTime * 1000);
            const outputLatency = (rawCtx.outputLatency || 0) * 1000;
            // Since manual clockOffset has no output latency component, we must subtract it
            // because the user heard the beat outputLatencyMs later than context time.
            return (performanceTimeMs - clockOffset - outputLatency) / 1000;
        }
    }
}

/**
 * MidiDeviceManager handles connection, port mapping, status filtering,
 * chord debouncing/clustering, and sustain pedal (CC 64) mapping.
 */
class MidiDeviceManager {
    constructor() {
        this.access = null;
        this.inputs = [];
        this.onStrokeCallback = null; // Clusters chords into a single rhythmic strike
        this.clusterWindowMs = 25; // 25ms window to group notes
        this.currentStroke = null;
        this.sustainPedalActive = false;
        this.pendingNoteOffs = new Set(); // Notes waiting to be released when sustain pedal is released
        this.activeKeys = new Set(); // Currently physically pressed notes

        // Custom note-on and note-off callbacks for synthesizing live audio
        this.onNoteOnCallback = null;
        this.onNoteOffCallback = null;

        // Custom change callback for UI updates
        this.onStateChangeCallback = null;
    }

    /**
     * Request access to Web MIDI API.
     */
    async requestAccess() {
        if (!navigator.requestMIDIAccess) {
            throw new Error("Web MIDI API is not supported in this browser.");
        }
        try {
            this.access = await navigator.requestMIDIAccess();
            this.access.onstatechange = (e) => this.handleStateChange(e);
            this.updateInputs();
            return this.access;
        } catch (err) {
            throw new Error("MIDI access request denied: " + err.message);
        }
    }

    updateInputs() {
        this.inputs = Array.from(this.access.inputs.values());
        this.inputs.forEach(input => {
            this.registerInput(input);
        });
        if (this.onStateChangeCallback) {
            this.onStateChangeCallback();
        }
    }

    handleStateChange(event) {
        this.updateInputs();
    }

    registerInput(inputDevice) {
        inputDevice.onmidimessage = (event) => {
            if (!event.data || event.data.length === 0) return;

            const statusByte = event.data[0];
            if (statusByte >= 0xF8) return; // Discard clock/active sensing

            const command = statusByte & 0xF0;
            const data1 = event.data[1]; // Note Number or CC Number
            const data2 = event.data[2]; // Velocity or CC Value
            const timestamp = event.timeStamp; // performance.now() domain

            // 1. Process Sustain Pedal (CC 64)
            if (command === 0xB0 && data1 === 64) {
                this.sustainPedalActive = data2 >= 64;
                if (!this.sustainPedalActive) {
                    // Release all pending note offs
                    this.pendingNoteOffs.forEach(note => {
                        this.triggerRelease(note);
                    });
                    this.pendingNoteOffs.clear();
                }
                return;
            }

            // Filter out any MIDI CC/Pitchbend messages that aren't NoteOn/NoteOff
            if (command !== 0x90 && command !== 0x80) return;

            const isNoteOn = command === 0x90 && data2 > 0;
            const isNoteOff = command === 0x80 || (command === 0x90 && data2 === 0);

            if (isNoteOn) {
                this.activeKeys.add(data1);
                this.triggerAttack(data1, data2);
                this.queueStrokeEvent(data1, timestamp);
            } else if (isNoteOff) {
                this.activeKeys.delete(data1);
                if (this.sustainPedalActive) {
                    this.pendingNoteOffs.add(data1);
                } else {
                    this.triggerRelease(data1);
                }
            }
        };
    }

    triggerAttack(note, velocity) {
        if (this.onNoteOnCallback) {
            this.onNoteOnCallback(note, velocity);
        }
    }

    triggerRelease(note) {
        if (this.onNoteOffCallback) {
            this.onNoteOffCallback(note);
        }
    }

    queueStrokeEvent(note, timestamp) {
        if (!this.currentStroke) {
            this.currentStroke = {
                notes: [note],
                timestamp: timestamp
            };
            setTimeout(() => {
                if (this.onStrokeCallback && this.currentStroke) {
                    this.onStrokeCallback(this.currentStroke);
                }
                this.currentStroke = null;
            }, this.clusterWindowMs);
        } else {
            this.currentStroke.notes.push(note);
        }
    }

    /**
     * Clean up event listeners and references to prevent memory leaks.
     */
    dispose() {
        if (this.access) {
            this.access.onstatechange = null;
        }
        if (this.inputs) {
            this.inputs.forEach(input => {
                input.onmidimessage = null;
            });
        }
        this.inputs = [];
        this.onStrokeCallback = null;
        this.onNoteOnCallback = null;
        this.onNoteOffCallback = null;
        this.onStateChangeCallback = null;
        this.pendingNoteOffs.clear();
        this.activeKeys.clear();
    }
}

// Attach to global window scope for integration
window.PrecisionAudioSync = PrecisionAudioSync;
window.MidiDeviceManager = MidiDeviceManager;
