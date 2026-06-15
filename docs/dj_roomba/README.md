# DJ Roomba — Transition Intelligence Scout

DJ Roomba is a Spotify-integrated DJ transition scout. It allows logged-in DJs to connect their Spotify accounts, select a playlist, and automatically enrich all tracks with BPM, Camelot keys, and energy levels using Librosa analysis. Once a playlist is imported, DJs can click any track to find the best ranked transition candidates grouped into visual category buckets with plain-English explanations.

## Key Features
- **Spotify OAuth Integration**: Completely hidden from non-connected users; re-authentication is automatically triggered for missing playlist read scopes.
- **Librosa Music Analysis**: Computes BPM and Camelot key signatures in a background worker thread using the iTunes audio preview clips.
- **Transition Scoring Engine**: Evaluates BPM (tempo), Camelot Wheel key relationships (harmonic), and energy levels (energy).
- **Simultaneous Previews**: Side-by-side iTunes preview players with volume sliders and a crossfade control slider, allowing DJs to hear how the two songs blend.
- **Camelot Wheel Picker**: Interactive SVG modal picker with compatible key highlights for quick manual key corrections.
- **Pulsing Friend Cell**: Prominent entry point in the Top 8 friends grid of the main music page (`/music`), replacing the "Vinyl" cell with a pulsing neon portal glow.
