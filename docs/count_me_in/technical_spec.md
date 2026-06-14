# Count Me In | Technical Specification

This document details the engineering specifications of the "Count Me In" BPM ear-trainer, covering the client-side Web Audio engine, high-DPI canvas visualizer, data synchronization pipeline, and backend security.

---

## 1. Client-Side Web Audio Engine (`audio_engine.js`)

The synthesizer orchestration and streaming engine are built on top of **Tone.js (v14)**.

### 1.1 Audio Node Lifecycle & Preview Streaming
1. **Autoplay Compliance**: The Web Audio context is initialized/resumed only after an explicit user interaction (clicking "Play Groove", triggering `[Space]`, or keyboard hotkeys).
2. **iTunes Preview Streaming**: The engine queries the public iTunes API using the reference track's artist and title to fetch a 30-second audio preview.
3. **Pitch-Shifted BPM Matching**: The streamed audio is matched to the target BPM by adjusting its playback speed:
   $$\text{playbackRate} = \frac{\text{target BPM}}{\text{original BPM}}$$
   Since Tone.js `Player.playbackRate` is a primitive numeric property (rather than an AudioParam/Signal), it is set directly.
4. **Turntable slowing/spinning animations**: Vinyl brake and spin-up effects are simulated using high-frequency `requestAnimationFrame` loops to step `playbackRate` smoothly over 300ms/450ms.
5. **Clue EQ Filters**: Instead of muting stems, the preview track is routed through a `Tone.Filter` with cutoff frequencies based on the clue level:
   * Level 1: $150\text{ Hz}$ lowpass (deep sub-bass/pocket kick only)
   * Level 2: $1000\text{ Hz}$ lowpass (rhythm section and vocal body)
   * Level 3: $5000\text{ Hz}$ lowpass (removes top-end hi-hats and air)
   * Level 4: $20000\text{ Hz}$ lowpass (unfiltered, full track)
6. **Local Synth Fallback**: If the preview URL fails to resolve, load, or decode, the engine automatically falls back to local Tone.js synthesized sequencers (House, Trap, Pop-Punk, or Beginner).
7. **Visibility & Background Throttling**: Tab changes (`visibilitychange` listener) automatically suspend audio playback to conserve CPU and device battery.

---

## 2. High-DPI Canvas Visualizer (`game.js`)

The visualizer draws real-time frequency analysis data using Web Audio `AnalyserNode`.

### Drawing Optimizations
* **High-DPI Support**: Resolves blurry canvas columns by scaling the canvas bitmap size by `window.devicePixelRatio` and scaling coordinates back in the context.
* **Pre-compiled Gradients**: Gradients are cached outside the frame rendering loop and recalculated only on screen resize.
* **Off-Screen Draw Break**: The draw loop stops rendering as soon as the cursor coordinates `x` exceed the container's width `w`, preventing CPU waste on high-frequency bins.
* **High-DPI Context Clearing**: Clears context cleanly by saving states, resetting transform matrix to `(1,0,0,1,0,0)`, executing `fillRect`, and restoring the scaling.
* **Plugged Memory Leak**: Window resize event listeners are registered exactly once during page initialization instead of on every audio play cycle.

---

## 3. Data Pipelines: Guest vs. Authenticated

```
                     [User Gameplay Action]
                               │
                Is user authenticated?
                /                    \
              YES                     NO
              /                         \
     [Direct API Mode]           [Guest Mode]
            │                           │
  • Bypass localStorage       • Save to localStorage
  • POST /game/api/attempt    • Capped at 1,000 attempts
  • Signed Token Auth         • Syncs later when logging in
  • Server-computed scores    • Local client scores
```

### 3.1 Authenticated Mode
* **API Endpoint**: `POST /game/api/attempt`
* **Workflow**:
  1. Frontend submits guess, client UUID, and the signed `challenge_token`.
  2. The server verifies the token signature and verifies it is less than 10 minutes old.
  3. The server computes the score, rating, and streak in a single SQLite database transaction.
  4. Returns the result JSON to populate the results modal.

### 3.2 Guest Mode
* **Workflow**:
  1. Frontend calculates error, score, and rating locally in javascript.
  2. Attempt object is written to browser `localStorage` under `count_me_in_attempts`.
  3. If the user later registers or logs in, the page-load sync script reads the `localStorage` payload, POSTs it in batch to `/game/api/sync` (which writes them to SQLite), and deletes them locally.

---

## 4. Backend Cryptographic Security

To ensure absolute integrity of user leaderboards and scores, guess submissions are protected against DOM/Payload tampering:

### Challenge Signing
1. When `/game/play/<id>` is rendered, the server randomizes a `true_bpm`.
2. It compiles a challenge token:
   ```python
   challenge_token = serializer.dumps({
       "true_bpm": true_bpm,
       "crate_name": crate.name,
       "timestamp": time.time()
   })
   ```
3. The token is cryptographically signed using Flask's `SECRET_KEY` and passes to the template.
4. The client cannot decrypt or alter this token without breaking the signature, making score spoofing impossible.

---

## 5. Metrical Ambiguity Handling & DB Consistency

When a user guesses a tempo that is exactly half or double the true BPM (e.g. guessing 140 for 70 BPM), the system identifies a **Metrical Match**.

### 5.1 Symmetric Error Calculation
The error percentage is calculated relative to the **hypothesized metrical target** (tactus rate) rather than the original true BPM ($T$), complying with the Weber-Fechner Law of timing perception:
* **Half-time target ($T/2$):** $E_{\text{half}} = \frac{|G - T/2|}{T/2} \times 100$
* **Double-time target ($2T$):** $E_{\text{double}} = \frac{|G - 2T|}{2T} \times 100$

This prevents the asymmetric difficulty bias where double-tempo guesses are mathematically four times harder than half-tempo guesses if calculated relative to the true BPM.

### 5.2 Database Consistency
To preserve mathematical logic in SQL auditing ($bpm\_error = guessed - true$), the database stores:
* `metrical_multiplier`: `0.5` (half-time match), `2.0` (double-time match), or `1.0` (normal match).
* `bpm_error` & `percent_error`: Computed using the **effective true BPM** ($T \times \text{metrical\_multiplier}$).
This keeps statistics like average percent error clean, preventing metrical matches from skewing user metrics.

