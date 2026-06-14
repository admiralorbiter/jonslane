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
The error percentage is calculated relative to the **hypothesized metrical target** (tactus rate) rather than the original true BPM ($T$), justified by tempo perception JND research and the evaluation methodology established in mir_eval [10]:
* **Half-time target ($T/2$):** $E_{\text{half}} = \frac{|G - T/2|}{T/2} \times 100$
* **Double-time target ($2T$):** $E_{\text{double}} = \frac{|G - 2T|}{2T} \times 100$

This prevents the asymmetric difficulty bias where double-tempo guesses are mathematically four times harder than half-tempo guesses if calculated relative to the true BPM.

### 5.2 Database Consistency
To preserve mathematical logic in SQL auditing ($bpm\_error = guessed - true$), the database stores:
* `metrical_multiplier`: `0.5` (half-time match), `2.0` (double-time match), or `1.0` (normal match).
* `bpm_error` & `percent_error`: Computed using the **effective true BPM** ($T \times \text{metrical\_multiplier}$).
This keeps statistics like average percent error clean, preventing metrical matches from skewing user metrics.

### 5.3 Anchor Recall Index (ARI) & Level Thresholds
The Anchor Recall Index (ARI) evaluates absolute tempo memory for a specific anchor tempo:
\[\text{ARI} = \max(0.0, 100.0 - (\text{average percent error} \times 10.0))\]
computed over the last 10 attempts.

The ARI and consecutive performance history drive level progression for each anchor:
* **Level 1 (Entry):** Default starting level.
* **Level 2 (unlocked):** Unlocks when a user achieves $\ge 3$ consecutive attempts with $\le 3.0\%$ error on Level 1.
* **Level 3 (unlocked):** Unlocks when a user achieves $\ge 3$ consecutive attempts with $\le 3.0\%$ error on Level 2, OR achieves an $\text{ARI} \ge 85.0$ on the anchor.
* **Level 4 (unlocked):** Unlocks when a user achieves $\ge 5$ consecutive attempts with $\le 3.0\%$ error on Level 3, OR achieves an $\text{ARI} \ge 85.0$ on the anchor.

---

## 6. Planned: Diagnostic Feedback Engine (`utils/diagnostics.py`)

To be added in V3, the diagnostic engine returns a plain-English explanation alongside every scored attempt — turning each submission into a micro-lesson.

### 6.1 Feedback Decision Logic

The function signature will be:

```python
def generate_attempt_feedback(
    guess: float,
    true_bpm: float,
    percent_error: float,
    metrical_multiplier: float,
    tap_stability: float | None,
    anchor_bpm: int | None,
    anchor_level: int | None,
) -> str:
```

Priority-ordered feedback cases:

1. **Metrical half-time** (`metrical_multiplier == 0.5`): "You heard the half-time pulse — a valid metrical layer, but the tactus is twice as fast."
2. **Metrical double-time** (`metrical_multiplier == 2.0`): "You heard the double-time layer — typical in trap/dubstep hi-hats."
3. **Tap drift** (`tap_stability > 30ms` and method == "tap"): "Individual taps were close, but you drifted. Focus on locking beats 5–8."
4. **Running fast** (`guess > true_bpm`, `percent_error < 8`): "You ran a little fast. Let the kick settle before committing."
5. **Running slow** (`guess < true_bpm`, `percent_error < 8`): "You ran a little slow. The groove may have felt heavier than the actual tempo."
6. **Anchor proximity** (guess within 8% of a known anchor): "You were near the 120 BPM anchor — your memory is working. Fine-tune the feel."
7. **Default success**: "Strong read. Tempo locked."
8. **Default miss**: "Try isolating the kick only (Clue Level 1) and counting out loud."

### 6.2 Session-Level Diagnostic Pattern Memory (M11)

To provide metacognitive scaffolding for systematic bias (such as a learner who consistently rushes or drags across attempts), the diagnostic engine supports session-level checks:
* Before generating attempt-specific feedback, the engine queries the last 5 attempts by the user for the current crate/anchor.
* **Directional Bias Detection:** If $\ge 4$ of the last 5 attempts have a positive `bpm_error` (running fast), the engine prefixes the feedback with a session warning: *"⚠️ Diagnostic notice: You've been rushing in 4 of your last 5 attempts. Try to relax your tapping rate and wait for the downbeats."*
* Likewise, if $\ge 4$ of the last 5 attempts have a negative `bpm_error` (running slow), it prefixes: *"⚠️ Diagnostic notice: You've been dragging in 4 of your last 5 attempts. Focus on pushing the pulse slightly forward."*

### 6.3 Integration

The diagnostic string is added to the existing `/game/api/attempt` JSON response as `"feedback": "..."`. No new endpoint or schema change needed. The results modal displays it beneath the score.

---

## 7. Spaced Repetition System (`utils/srs.py` + `AnchorSchedule` model)

To be added in V4 (Academy), the SRS system schedules anchor tempo reviews at expanding intervals.

### 7.1 SM-2 Algorithm Adaptation

Quality score mapping from CMI ratings:

| CMI Rating | Quality (0–5) |
|---|---|
| Tempo Wizard | 5 |
| DJ-Ready | 4 |
| Solid Ear | 3 |
| Metrical Match | 3 |
| Getting There | 2 |
| Needs Practice | 1 |

Standard SM-2 interval formula:
* If quality < 3: reset `interval = 1`, `repetitions = 0`
* If quality ≥ 3: `interval = interval × ease_factor`, `ease_factor = max(1.3, ease_factor + 0.1 - (5 - quality) × 0.08)`

### 7.2 Database Schema

```python
class AnchorSchedule(db.Model):
    __bind_key__ = "count_me_in"
    __tablename__ = "anchor_schedules"

    id              = db.Column(db.Integer, primary_key=True)
    user_id         = db.Column(db.Integer, nullable=False, index=True)
    anchor_bpm      = db.Column(db.Integer, nullable=False)
    ease_factor     = db.Column(db.Float, default=2.5)
    interval_days   = db.Column(db.Integer, default=1)
    repetitions     = db.Column(db.Integer, default=0)
    next_review_at  = db.Column(db.DateTime, nullable=True)
    last_reviewed_at= db.Column(db.DateTime, nullable=True)

    __table_args__ = (
        db.UniqueConstraint("user_id", "anchor_bpm"),
    )
```

### 7.3 Key Functions

```python
def get_due_anchors(user_id: int) -> list[dict]:
    """Return list of {anchor_bpm, days_overdue} for reviews due today."""

def update_schedule_after_attempt(user_id: int, anchor_bpm: int, rating: str) -> None:
    """Run SM-2 update and persist next_review_at."""
```

### 7.4 Calendar Day Interval Rule (Single-Session Mitigation)

To prevent block-practice inflation (where drilling the same anchor multiple times in a single session artificially expands the review interval), SM-2 scheduler updates will only execute on the **first anchor attempt per calendar day** for that specific tempo. Subsequent reviews within the same calendar day will log the attempt but will not modify the ease factor, repetitions count, or interval in the `AnchorSchedule` table.

### 7.5 Metrical-Match Interval Capping

A "Metrical Match" (octave error like hearing 70 BPM for a 140 BPM loop) is rated as a quality 3, which allows standard SM-2 interval growth. To prevent a user from expanding their recall interval indefinitely without demonstrating true-tempo recall, the system tracks metrical matches:
* The `AnchorSchedule` will track a `metrical_match_streak` integer column.
* If a review is a Metrical Match, the streak increments. If it is a true-tempo success (quality 4 or 5), the streak resets.
* If `metrical_match_streak >= 3`, the scheduler caps the next interval growth to `interval = min(interval, 7)` days and caps the ease factor. Interval growth only resumes once a true-tempo recall is logged.

---

## 8. MIDI Device Manager (`midi_manager.js`)

To be added in V5 (Piano Lab), the MIDI Device Manager wraps the Web MIDI API and provides a unified event source for any lab that currently uses keyboard input.

### 8.1 Design Contract

```javascript
class MidiDeviceManager {
    async init()                        // navigator.requestMIDIAccess()
    onNoteOn(callback)                  // callback(note, velocity, timestamp)
    onNoteOff(callback)                 // callback(note, velocity, timestamp)
    getConnectedDevices()               // returns Array<{id, name, manufacturer}>
    selectDevice(deviceId)             // choose active input port
    dispose()                           // remove all listeners
}
```

### 8.2 Tap System Integration

The existing tap-tempo system uses `performance.now()` timestamps from `keydown` events. MIDI note-on messages provide `MIDIMessageEvent.timeStamp`, which is compatible with `performance.now()`. The tap pipeline can accept either source transparently:

```javascript
// Existing tap handler (simplified)
function handleTap(timestamp = performance.now()) {
    tapTimes.push(timestamp);
    // ... existing logic unchanged
}

// MIDI note-on becomes a tap
midiManager.onNoteOn((note, velocity, timestamp) => {
    handleTap(timestamp);
});
```

### 8.3 Browser Compatibility & Lifecycle Details

Web MIDI API requires:
* Chrome 43+ or Edge 79+ (native, no plugin)
* HTTPS or `localhost` context
* Explicit user permission prompt

**Permission Isolation Rule (H7):**
To avoid breaking the user-gesture chain required for Web Audio `AudioContext.resume()`, the call to `navigator.requestMIDIAccess()` MUST be triggered by a separate, dedicated "Connect MIDI Device" button gesture. It should never be chained under the playback play/start button, as the async permission dialog will interrupt the gesture token in Chrome, causing audio resume failures.

**Event Listener Garbage Collection (M10):**
The `MIDIAccess.onstatechange` handler property must be explicitly set to `null` inside `MidiDeviceManager.dispose()`. Since `onstatechange` is a direct event handler attribute, failing to nullify it prevents the garbage collector from reclaiming the `MidiDeviceManager` instance, resulting in a persistent memory leak across page transitions.

---

## 9. Attempt Model Extension

To support multiple modules (Count Me In, Piano Lab) and new lab types, the `Attempt` table will be extended with additive columns via Alembic migration:

```python
# New columns (all nullable to preserve backward compatibility)
module           = db.Column(db.String(50), nullable=False, server_default="count_me_in")
# "count_me_in" | "piano_lab" | "subdivision_trainer" | "invisible_metronome"

skill_tag        = db.Column(db.String(50), nullable=True)
# "pulse" | "anchor" | "subdivision" | "meter" | "phrasing" | "beatmatch"

input_method     = db.Column(db.String(20), nullable=True)
# "numeric" | "tap" | "slider" | "midi"

phase_error_ms   = db.Column(db.Float, nullable=True)
# Phase alignment error (ms) for invisible metronome / drift labs

hand             = db.Column(db.String(10), nullable=True)
# "left" | "right" | "both" — for Piano Lab hand independence drills

phrase_length    = db.Column(db.Integer, nullable=True)
# Number of bars counted in phrase labs
```

Existing analytics queries remain unaffected because they filter on `is_anchor = False` and do not reference these new optional columns.

---

## 10. Blueprint Authentication Gating Pattern

To protect the future Academy blueprint routes globally and avoid manual checks in every route, a `before_request` hook will be registered on the blueprint using the session-based authentication check:

```python
from flask import session, abort
from portfolio.routes.academy import academy_bp

@academy_bp.before_request
def require_login():
    if not session.get("user_id"):
        abort(403)
```

This guarantees that all routes registered under `/academy` are automatically gated behind authentication by default.

---

## 11. Academy Discovery & Post-Login Transition

To preserve guest UX while ensuring immediate onboarding value for registered users:
*   **Nav Injection:** The Academy entry point is completely hidden from guests (no grayed out link). `base.html` conditionally registers the `/academy` link based on user auth status.
*   **Retroactive Migration:** Registration triggers local-storage history synchronization. The sync endpoint computes scores/ARI on the fly and seeds the database.
*   **Redirect Welcome Hook:** On the first access of a newly authenticated user, the server redirects them to `/academy/welcome` where a retroactive skill graph is generated on the fly from the newly synced attempts, establishing their starting Academy level.

---

## 12. On-Demand Skill Profile Calculation (No Denormalization)

To support multiple domains (music, piano, future topics) without constant database migrations, the user skill profile (`UserSkillProfile`) is computed entirely **on-demand** from the `Attempt` table:
*   **Aggregation Query:** Group attempts by `module` and `skill_tag` to aggregate stats:
    ```sql
    SELECT module, skill_tag, AVG(percent_error) AS avg_error, COUNT(id) AS attempt_count
    FROM attempts
    WHERE user_id = :user_id
    GROUP BY module, skill_tag;
    ```
*   **Mastery Computation:** Translate average error into a 0-100 mastery scale.
*   **Benefits:** Completely avoids cache invalidation issues, simplifies data synchronization, and accommodates future curriculum modules dynamically without schema updates.
