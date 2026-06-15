# DJ Roomba — Technical Specification

## Data Models

Four new models are added:
- `PlaylistImport`: Represents a user's imported playlist and analysis status.
- `PlaylistTrack`: Connects imported playlists and tracks.
- `TrackFeatureAnnotation`: Flat typed features (keys, manual energy tags/scores, notes) for a track.
- `TransitionCandidate`: Stores computed transition scores, explanations, and risk flags on demand.

The existing `TrackTempoAnnotation` model is extended with:
- `musical_key`: `0–11` (pitch classes: C=0, C#=1, etc.)
- `key_mode`: `0` for minor, `1` for major
- `camelot_key`: string like `"8A"`, `"11B"`
- `key_confidence`: `0.0–1.0` proxy based on template correlation

## Scoring Math

Base Score:
\[S_{\text{base}} = W_{\text{tempo}} \cdot S_{\text{tempo}} + W_{\text{harmonic}} \cdot S_{\text{harmonic}} + W_{\text{energy}} \cdot S_{\text{energy}}\]

Final Score:
\[S_{\text{final}} = \max(0.0, \min(100.0, S_{\text{base}} - \text{Penalties}))\]

### Presets
- **Beatmatcher**: Tempo 45%, Harmonic 35%, Energy 20%
- **Harmonic Mixer**: Tempo 25%, Harmonic 55%, Energy 20%
- **Open Format**: Tempo 35%, Harmonic 25%, Energy 40%

### Risk Penalties
- **Two bad dimensions**: \(-10\) if tempo score < 40 and energy score < 40.
- **Harmonic + tempo conflict**: \(-8\) if harmonic score > 80 and tempo score < 50.
- **Both keys unknown**: \(-5\) if both keys are null.
- **BPM unknown**: \(-15\) if either track has unknown BPM.
