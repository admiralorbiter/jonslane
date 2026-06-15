/**
 * bpm_detector.js — iTunes Preview + Web Audio Onset Autocorrelation
 *
 * How it works:
 *   1. Given a search query (artist + title), hit the iTunes Search API (free, no key).
 *   2. Get the 30-second preview URL for the best result.
 *   3. Fetch and decode the audio using Web Audio API AudioContext.
 *   4. Compute an onset strength envelope (energy-based half-wave rectified diff).
 *   5. Run autocorrelation across candidate tempo lags (60–200 BPM range).
 *   6. Find the peak lag, compute BPM and a confidence score.
 *   7. Check for octave errors (half/double) and pick the most musically likely value.
 *   8. POST the result to /spotify/api/submit-bpm.
 *
 * Confidence score:
 *   The ratio of the best autocorrelation peak to the mean of all candidates.
 *   A ratio > 3.0 typically means a clear, strong beat (machine_high).
 *   A ratio 1.5–3.0 is moderate (machine_low).
 *   Below 1.5 we don't submit (too noisy to be useful).
 *
 * Limitations:
 *   - Variable-tempo tracks, live recordings, and songs with no consistent kick
 *     will produce low confidence scores and may not be submitted.
 *   - iTunes preview may be a different version (live, radio edit) of the track.
 *   - Half-time/double-time octave errors are checked but not always resolved.
 *
 * Policy note:
 *   We analyze audio from iTunes preview URLs (publicly served by Apple for
 *   app use). We never analyze the Spotify audio stream.
 */

(function (global) {
    'use strict';

    // -----------------------------------------------------------------------
    // Constants
    // -----------------------------------------------------------------------
    const ITUNES_SEARCH_BASE = 'https://itunes.apple.com/search';
    const SUBMIT_BPM_URL = '/spotify/api/submit-bpm';

    // Beat detection parameters
    const FRAME_SIZE = 1024;       // samples per analysis frame
    const HOP_SIZE = 512;          // hop between frames
    const MIN_BPM = 60;
    const MAX_BPM = 200;
    const MIN_CONFIDENCE_RATIO = 1.5; // below this we don't submit
    const PREFERRED_BPM_RANGE = [70, 180]; // tighter preference for "common" music

    // -----------------------------------------------------------------------
    // iTunes Search
    // -----------------------------------------------------------------------

    /**
     * Search iTunes for a track by query string.
     * Returns the best result object or null.
     */
    async function searchItunes(query) {
        const url = `${ITUNES_SEARCH_BASE}?term=${encodeURIComponent(query)}&limit=3&media=music&entity=song`;
        try {
            const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
            if (!resp.ok) return null;
            const data = await resp.json();
            if (!data.results || data.results.length === 0) return null;

            // Prefer results with a previewUrl
            const withPreview = data.results.filter(r => r.previewUrl);
            return withPreview.length > 0 ? withPreview[0] : null;
        } catch (e) {
            console.warn('[BpmDetector] iTunes search failed:', e.message);
            return null;
        }
    }

    // -----------------------------------------------------------------------
    // Audio fetching + decoding
    // -----------------------------------------------------------------------

    /**
     * Fetch a URL and decode it as an AudioBuffer.
     * Returns null on error.
     */
    async function fetchAndDecodeAudio(url) {
        try {
            const resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
            if (!resp.ok) return null;
            const arrayBuffer = await resp.arrayBuffer();
            // Offline context at 22050 Hz is enough for beat tracking
            // and avoids touching the user's main AudioContext
            const offlineCtx = new OfflineAudioContext(1, 1, 22050);
            const audioBuffer = await offlineCtx.decodeAudioData(arrayBuffer);
            return audioBuffer;
        } catch (e) {
            console.warn('[BpmDetector] Audio decode failed:', e.message);
            return null;
        }
    }

    // -----------------------------------------------------------------------
    // Onset strength envelope
    // -----------------------------------------------------------------------

    /**
     * Compute a per-frame onset strength signal from a mono audio buffer.
     *
     * Method: half-wave rectified energy difference between consecutive frames.
     * This correlates strongly with kick drums, snare hits, and note onsets —
     * the same events that define tempo.
     *
     * Returns a Float32Array of onset strength values, one per hop.
     */
    function computeOnsetEnvelope(channelData, sampleRate) {
        const numFrames = Math.floor((channelData.length - FRAME_SIZE) / HOP_SIZE);
        const envelope = new Float32Array(numFrames);

        let prevRms = 0;

        for (let i = 0; i < numFrames; i++) {
            const start = i * HOP_SIZE;
            let sumSq = 0;
            for (let j = 0; j < FRAME_SIZE; j++) {
                const s = channelData[start + j];
                sumSq += s * s;
            }
            const rms = Math.sqrt(sumSq / FRAME_SIZE);

            // Half-wave rectified difference: only positive energy increases
            envelope[i] = Math.max(0, rms - prevRms);
            prevRms = rms;
        }

        return envelope;
    }

    // -----------------------------------------------------------------------
    // Autocorrelation-based tempo estimation
    // -----------------------------------------------------------------------

    /**
     * Run autocorrelation on the onset envelope over the BPM lag range.
     *
     * For each candidate BPM, we compute how well the onset signal
     * correlates with a copy of itself shifted by that lag.
     *
     * Returns an array of { bpm, lag, correlation } objects, sorted by
     * correlation descending.
     */
    function autocorrelate(envelope, hopDurationSec) {
        const minLag = Math.max(1, Math.floor(60 / (MAX_BPM * hopDurationSec)));
        const maxLag = Math.ceil(60 / (MIN_BPM * hopDurationSec));
        const n = envelope.length;

        const candidates = [];

        for (let lag = minLag; lag <= maxLag; lag++) {
            let corr = 0;
            for (let i = 0; i < n - lag; i++) {
                corr += envelope[i] * envelope[i + lag];
            }
            // Normalize by the number of contributing pairs
            corr /= (n - lag);

            const bpm = 60 / (lag * hopDurationSec);
            candidates.push({ bpm, lag, correlation: corr });
        }

        // Sort by correlation descending
        candidates.sort((a, b) => b.correlation - a.correlation);
        return candidates;
    }

    /**
     * Given an array of correlation candidates, pick the best musically
     * plausible BPM and compute a confidence score.
     *
     * Handles the most common octave error: if the best candidate is near
     * double a common BPM, check whether the half-tempo candidate has a
     * decent correlation too.
     *
     * Returns { bpm, confidence, allCandidates }.
     */
    function pickBestTempo(candidates) {
        if (candidates.length === 0) return null;

        // Compute mean correlation for confidence ratio
        const meanCorr = candidates.reduce((s, c) => s + c.correlation, 0) / candidates.length;
        if (meanCorr === 0) return null;

        // Filter to musically preferred range first
        const preferred = candidates.filter(
            c => c.bpm >= PREFERRED_BPM_RANGE[0] && c.bpm <= PREFERRED_BPM_RANGE[1]
        );
        const pool = preferred.length > 0 ? preferred : candidates;

        const best = pool[0];
        const confidenceRatio = best.correlation / meanCorr;

        // Check if the half-tempo of our best candidate also has strong correlation.
        // If so, the "true" BPM might be half — common with trap / half-time grooves.
        // We only switch if the half-tempo is in a common music range.
        const halfBpm = best.bpm / 2;
        if (halfBpm >= MIN_BPM) {
            const halfCandidate = candidates.find(
                c => Math.abs(c.bpm - halfBpm) <= 2.0
            );
            if (halfCandidate && halfCandidate.correlation > best.correlation * 0.7) {
                // The half-tempo has a strong signal too — flag this as ambiguous
                // but still report the best candidate (user's half/double toggle handles it)
                console.info(
                    `[BpmDetector] Possible half-time ambiguity: ${best.bpm.toFixed(1)} vs ${halfBpm.toFixed(1)} BPM`
                );
            }
        }

        return {
            bpm: Math.round(best.bpm * 2) / 2, // Round to nearest 0.5
            confidence: Math.min(1.0, confidenceRatio / 5.0), // Normalize to 0–1
            confidenceRatio,
            allCandidates: candidates.slice(0, 5), // Top 5 for debugging
        };
    }

    // -----------------------------------------------------------------------
    // Main detection pipeline
    // -----------------------------------------------------------------------

    /**
     * Run the full iTunes + Web Audio BPM detection pipeline for a query.
     *
     * @param {string} query - "Artist Title" search string
     * @returns {Promise<{bpm, confidence, itunesTrackId, itunesPreviewUrl} | null>}
     */
    async function detectBpmForQuery(query) {
        // 1. Search iTunes
        const itunesResult = await searchItunes(query);
        if (!itunesResult || !itunesResult.previewUrl) {
            console.info('[BpmDetector] No iTunes preview found for:', query);
            return null;
        }

        const itunesPreviewUrl = itunesResult.previewUrl;
        const itunesTrackId = String(itunesResult.trackId || '');

        console.info('[BpmDetector] Preview found:', itunesResult.trackName, '|', itunesPreviewUrl);

        // 2. Fetch and decode audio
        const audioBuffer = await fetchAndDecodeAudio(itunesPreviewUrl);
        if (!audioBuffer) {
            console.warn('[BpmDetector] Could not decode audio from:', itunesPreviewUrl);
            return null;
        }

        const sampleRate = audioBuffer.sampleRate;
        const channelData = audioBuffer.getChannelData(0);
        const hopDurationSec = HOP_SIZE / sampleRate;

        // 3. Compute onset envelope
        const envelope = computeOnsetEnvelope(channelData, sampleRate);

        // 4. Autocorrelation
        const candidates = autocorrelate(envelope, hopDurationSec);

        // 5. Pick best tempo
        const result = pickBestTempo(candidates);
        if (!result) {
            console.warn('[BpmDetector] Could not determine tempo from audio');
            return null;
        }

        console.info(
            `[BpmDetector] Estimated: ${result.bpm} BPM | confidence ratio: ${result.confidenceRatio.toFixed(2)} | score: ${result.confidence.toFixed(3)}`
        );

        // 6. Don't submit if confidence is too low to be useful
        if (result.confidenceRatio < MIN_CONFIDENCE_RATIO) {
            console.info('[BpmDetector] Confidence too low to submit:', result.confidenceRatio.toFixed(2));
            return null;
        }

        return {
            bpm: result.bpm,
            confidence: result.confidence,
            confidenceRatio: result.confidenceRatio,
            itunesTrackId,
            itunesPreviewUrl,
        };
    }

    /**
     * Detect BPM and submit the result to the server.
     *
     * @param {string} query - "Artist Title" search string
     * @param {number} trackIdentityId - DB id from /spotify/api/now-playing
     * @returns {Promise<{annotation} | null>} The stored annotation from the server, or null
     */
    async function detectAndSubmit(query, trackIdentityId) {
        let detected;
        try {
            detected = await detectBpmForQuery(query);
        } catch (e) {
            console.error('[BpmDetector] Detection pipeline error:', e);
            return null;
        }

        if (!detected) return null;

        try {
            const resp = await fetch(SUBMIT_BPM_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    track_identity_id: trackIdentityId,
                    estimated_bpm: detected.bpm,
                    confidence_score: detected.confidence,
                    itunes_track_id: detected.itunesTrackId || null,
                    itunes_preview_url: detected.itunesPreviewUrl || null,
                }),
                signal: AbortSignal.timeout(8000),
            });

            if (!resp.ok) {
                console.warn('[BpmDetector] submit-bpm rejected:', resp.status);
                return null;
            }

            const data = await resp.json();
            if (data.success) {
                console.info('[BpmDetector] Stored annotation:', data.annotation);
                return data.annotation;
            }
        } catch (e) {
            console.warn('[BpmDetector] submit-bpm network error:', e.message);
        }

        return null;
    }

    // -----------------------------------------------------------------------
    // Public API
    // -----------------------------------------------------------------------
    global.BpmDetector = {
        detectAndSubmit,
        detectBpmForQuery, // Exposed for debugging in console
    };

})(window);
