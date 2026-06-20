/**
 * DJ Roomba — SPA Logic and Visuals
 */

(function () {
    // State management
    const state = {
        currentPlaylistId: null,
        currentPlaylistData: null,
        sourceTrack: null,
        selectedCandidate: null,
        pollInterval: null,
        audioA: new Audio(),
        audioB: new Audio(),
        animationA: null,
        animationB: null,
        tempOverrideKey: null,
        editingTrackId: null
    };

    // DOM Elements
    const el = {
        btnUseNowPlaying: document.getElementById('btn-use-currently-playing'),
        btnShowPlaylists: document.getElementById('btn-show-playlists'),
        btnStartSelect: document.getElementById('btn-start-select'),
        modalPlaylists: document.getElementById('modal-playlists'),
        playlistsGrid: document.getElementById('playlists-grid'),
        playlistsLoading: document.getElementById('playlists-loading'),
        screenWelcome: document.getElementById('screen-welcome'),
        screenImporting: document.getElementById('screen-importing'),
        screenConsole: document.getElementById('screen-console'),
        trackSearch: document.getElementById('track-search'),
        trackSort: document.getElementById('track-sort'),
        djStyle: document.getElementById('dj-style'),
        tracksTableBody: document.getElementById('tracks-table-body'),
        trackCountBadge: document.getElementById('track-count-badge'),
        currentPlaylistTitle: document.getElementById('current-playlist-title'),

        // Scout Panel
        scoutEmptyState: document.getElementById('scout-empty-state'),
        scoutWorkspace: document.getElementById('scout-workspace'),
        sourceTrackArt: document.getElementById('source-track-art'),
        sourceTrackTitle: document.getElementById('source-track-title'),
        sourceTrackArtist: document.getElementById('source-track-artist'),
        sourceTrackBpm: document.getElementById('source-track-bpm'),
        sourceTrackKey: document.getElementById('source-track-key'),
        sourceTrackEnergy: document.getElementById('source-track-energy'),

        candidatesLoading: document.getElementById('candidates-loading'),
        candidatesEmpty: document.getElementById('candidates-empty'),
        candidatesBuckets: document.getElementById('candidates-buckets'),

        // Detail Panel
        detailPanel: document.getElementById('transition-detail-panel'),
        detailTotalScore: document.getElementById('detail-total-score'),
        detailBarTempo: document.getElementById('detail-bar-tempo'),
        detailValTempo: document.getElementById('detail-val-tempo'),
        detailBarHarmonic: document.getElementById('detail-bar-harmonic'),
        detailValHarmonic: document.getElementById('detail-val-harmonic'),
        detailBarEnergy: document.getElementById('detail-bar-energy'),
        detailValEnergy: document.getElementById('detail-val-energy'),
        detailWhy: document.getElementById('detail-why'),
        detailWatchOut: document.getElementById('detail-watch-out'),
        detailTry: document.getElementById('detail-try'),
        btnCloseDetail: document.getElementById('btn-close-detail'),

        // Players
        playerTitleA: document.getElementById('player-title-a'),
        playerMetaA: document.getElementById('player-meta-a'),
        btnPlayMaster: document.getElementById('btn-play-master'),
        btnSkipA: document.getElementById('btn-skip-a'),
        volA: document.getElementById('vol-a'),
        canvasA: document.getElementById('canvas-a'),

        playerTitleB: document.getElementById('player-title-b'),
        playerMetaB: document.getElementById('player-meta-b'),
        btnSkipB: document.getElementById('btn-skip-b'),
        volB: document.getElementById('vol-b'),
        canvasB: document.getElementById('canvas-b'),

        crossfadeSlider: document.getElementById('crossfade-slider'),

        // Modals
        modalKeyPicker: document.getElementById('modal-key-picker'),
        modalKeyTrackTitle: document.getElementById('modal-key-track-title'),
        modalKeyCurrentLabel: document.getElementById('modal-key-current-label'),
        btnSaveKey: document.getElementById('btn-save-key'),
        autosaveToast: document.getElementById('autosave-toast'),
        toastText: document.querySelector('#autosave-toast .toast-text'),
        toastSpinner: document.querySelector('#autosave-toast .toast-spinner')
    };

    // Camelot key metadata colors
    const camelotColors = {
        '1A': '#a1c4fd', '1B': '#c2e9fb', '2A': '#8fd3f4', '2B': '#f5f7fa',
        '3A': '#cfd9df', '3B': '#e2ebf0', '4A': '#fbc2eb', '4B': '#a6c1ee',
        '5A': '#fed6e3', '5B': '#a8edea', '6A': '#f5f7fa', '6B': '#c3cfe2',
        '7A': '#e0c3fc', '7B': '#8ec5fc', '8A': '#fddb92', '8B': '#d4fc79',
        '9A': '#f093fb', '9B': '#f5576c', '10A': '#4facfe', '10B': '#00f2fe',
        '11A': '#fa709a', '11B': '#fee140', '12A': '#30cfd0', '12B': '#330867'
    };

    // Initialize SPA
    function init() {
        setupEventListeners();
        setupAudioEngine();
        drawCamelotWheel();

        // Check if there is an active playlist in url hash or session
        const hashId = window.location.hash.substring(1);
        if (hashId && !isNaN(hashId)) {
            loadPlaylist(parseInt(hashId));
        }
    }

    // Event Listeners setup
    function setupEventListeners() {
        // Playlists trigger
        el.btnShowPlaylists.addEventListener('click', openPlaylistsModal);
        el.btnStartSelect.addEventListener('click', openPlaylistsModal);

        document.querySelectorAll('.btn-close-modal').forEach(btn => {
            btn.addEventListener('click', closeModals);
        });

        // Closing modals when clicking backdrop
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay')) {
                closeModals();
            }
        });

        // Search & Filter
        el.trackSearch.addEventListener('input', renderTracklist);
        el.trackSort.addEventListener('change', renderTracklist);
        el.djStyle.addEventListener('change', () => {
            if (state.sourceTrack) {
                fetchTransitions(state.sourceTrack.id);
            }
        });

        // Previews close detail
        el.btnCloseDetail.addEventListener('click', () => {
            el.detailPanel.style.display = 'none';
            stopAllPlayers();
        });

        // Use currently playing Spotify track shortcut
        el.btnUseNowPlaying.addEventListener('click', useCurrentlyPlayingTrack);

        // Keyboard accessibility for modals
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeModals();
            }
        });

        // Save key override
        el.btnSaveKey.addEventListener('click', saveKeyOverride);
    }

    // Audio Players setup
    function setupAudioEngine() {
        state.audioA.loop = true;
        state.audioB.loop = true;

        el.btnPlayMaster.addEventListener('click', togglePlayMaster);

        el.btnSkipA.addEventListener('click', () => { state.audioA.currentTime = Math.max(0, state.audioA.currentTime - 10); });
        el.btnSkipB.addEventListener('click', () => { state.audioB.currentTime = Math.max(0, state.audioB.currentTime - 10); });

        el.volA.addEventListener('input', (e) => { updateVolumes(); });
        el.volB.addEventListener('input', (e) => { updateVolumes(); });
        el.crossfadeSlider.addEventListener('input', (e) => { updateVolumes(); });

        // Auto-detect currently playing on Spotify status
        fetch('/spotify/api/now-playing')
            .then(r => {
                if (r.status === 200) el.btnUseNowPlaying.style.display = 'inline-flex';
            })
            .catch(() => {});
    }

    // Volume crossfader controller
    function updateVolumes() {
        const x = parseFloat(el.crossfadeSlider.value);
        const volA = parseFloat(el.volA.value);
        const volB = parseFloat(el.volB.value);

        // Constant power crossfade curve
        state.audioA.volume = volA * Math.cos((x * Math.PI) / 2);
        state.audioB.volume = volB * Math.sin((x * Math.PI) / 2);
    }

    function togglePlayMaster() {
        const audioA = state.audioA;
        const audioB = state.audioB;
        const btn = el.btnPlayMaster;

        const hasA = audioA.src && !audioA.src.endsWith('undefined') && audioA.src !== '';
        const hasB = audioB.src && !audioB.src.endsWith('undefined') && audioB.src !== '';

        if (!hasA && !hasB) {
            showToast("No iTunes preview clips available for either song", true);
            return;
        }

        const playingA = !audioA.paused;
        const playingB = !audioB.paused;

        if (playingA || playingB) {
            audioA.pause();
            audioB.pause();
            btn.textContent = '▶ Play Transition Previews';
            stopWaveform('A');
            stopWaveform('B');
        } else {
            btn.textContent = '⏸ Pause Previews';
            if (hasA) {
                audioA.play().then(() => {
                    startWaveform('A', el.canvasA);
                }).catch(err => {
                    console.warn("Could not play track A preview", err);
                });
            }
            if (hasB) {
                audioB.play().then(() => {
                    startWaveform('B', el.canvasB);
                }).catch(err => {
                    console.warn("Could not play track B preview", err);
                });
            }
        }
    }

    function stopAllPlayers() {
        state.audioA.pause();
        state.audioB.pause();
        if (el.btnPlayMaster) {
            el.btnPlayMaster.textContent = '▶ Play Transition Previews';
        }
        stopWaveform('A');
        stopWaveform('B');
    }

    // Simulated visualization waveform
    function startWaveform(player, canvas) {
        const ctx = canvas.getContext('2d');
        let offset = 0;

        function draw() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.beginPath();
            ctx.strokeStyle = player === 'A' ? '#00f3ff' : '#ff00a0';
            ctx.lineWidth = 2;

            const amplitude = 8;
            const frequency = 0.08;

            for (let i = 0; i < canvas.width; i++) {
                const y = canvas.height / 2 + Math.sin(i * frequency + offset) * amplitude * (Math.random() * 0.4 + 0.8);
                if (i === 0) ctx.moveTo(i, y);
                else ctx.lineTo(i, y);
            }
            ctx.stroke();

            offset += 0.15;
            if (player === 'A') {
                state.animationA = requestAnimationFrame(draw);
            } else {
                state.animationB = requestAnimationFrame(draw);
            }
        }

        stopWaveform(player);
        draw();
    }

    function stopWaveform(player) {
        if (player === 'A' && state.animationA) {
            cancelAnimationFrame(state.animationA);
            state.animationA = null;
            clearCanvas(el.canvasA);
        } else if (player === 'B' && state.animationB) {
            cancelAnimationFrame(state.animationB);
            state.animationB = null;
            clearCanvas(el.canvasB);
        }
    }

    function clearCanvas(canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.beginPath();
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 1;
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
    }

    // Modal Operations
    function openPlaylistsModal() {
        el.modalPlaylists.classList.add('active');
        el.playlistsLoading.style.display = 'flex';
        el.playlistsGrid.innerHTML = '';

        fetch('/music/roomba/api/roomba/playlists')
            .then(res => {
                if (res.status === 403) {
                    // Requires login / re-auth
                    el.playlistsLoading.style.display = 'none';
                    el.playlistsGrid.innerHTML = `
                        <div class="text-center p-3">
                            <p class="text-secondary">Spotify access scopes are missing or expired.</p>
                            <a href="/spotify/connect" class="btn btn-primary mt-2">Connect Spotify</a>
                        </div>
                    `;
                    return null;
                }
                return res.json();
            })
            .then(data => {
                if (!data) return;
                el.playlistsLoading.style.display = 'none';

                const items = data.items || [];
                if (items.length === 0) {
                    el.playlistsGrid.innerHTML = '<p class="text-secondary text-center">No playlists found in your Spotify account.</p>';
                    return;
                }

                items.forEach(item => {
                    if (!item) return;
                    const card = document.createElement('div');
                    card.className = 'playlist-card';

                    const imgUrl = item.images && item.images.length > 0 ? item.images[0].url : '/static/img/default_playlist.png';

                    card.innerHTML = `
                        <img class="playlist-img" src="${imgUrl}" alt="${item.name}">
                        <div class="playlist-info">
                            <h4>${escapeHtml(item.name)}</h4>
                            <p>${item.tracks.total} tracks</p>
                        </div>
                    `;

                    card.addEventListener('click', () => {
                        closeModals();
                        importPlaylist(item.id, item.name);
                    });

                    el.playlistsGrid.appendChild(card);
                });
            })
            .catch(err => {
                el.playlistsLoading.style.display = 'none';
                el.playlistsGrid.innerHTML = '<p class="text-danger text-center">Failed to load playlists.</p>';
            });
    }

    function closeModals() {
        el.modalPlaylists.classList.remove('active');
        el.modalKeyPicker.classList.remove('active');
    }

    // Playlist importing
    function importPlaylist(playlistId, name) {
        el.screenWelcome.classList.remove('active');
        el.screenConsole.classList.remove('active');
        el.screenImporting.classList.add('active');

        // Progress text simulation
        updateImportStatus("Submitting import job to background queue...");

        fetch('/music/roomba/api/roomba/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playlist_id: playlistId, playlist_name: name })
        })
        .then(res => {
            if (res.status === 202) {
                return res.json();
            } else if (res.status === 429) {
                throw new Error("This playlist was recently imported. Loading current database copy...");
            } else if (res.status === 422) {
                throw new Error("Playlist exceeds the 200-track limit.");
            } else {
                throw new Error("Failed to start playlist import.");
            }
        })
        .then(data => {
            state.currentPlaylistId = data.playlist_import_id;
            window.location.hash = data.playlist_import_id;
            startPolling(data.playlist_import_id);
        })
        .catch(err => {
            showToast(err.message, true);
            // If it already existed or failed, check if we can fall back to loading the active imports
            if (err.message.includes("recently imported")) {
                // Fetch the ID from a playlist list or let it complete
                // Let's list imports to find matching ID or wait
                // We'll search for it
                searchExistingImport(playlistId);
            } else {
                el.screenImporting.classList.remove('active');
                el.screenWelcome.classList.add('active');
            }
        });
    }

    function searchExistingImport(spotifyPlaylistId) {
        // Query to match existing imports
        updateImportStatus("Fetching existing records...");
        // Since we don't have a direct query lists, we'll try to find active matching database import
        // If not found, redirect to welcome
        el.screenImporting.classList.remove('active');
        el.screenWelcome.classList.add('active');
        openPlaylistsModal();
    }

    function updateImportStatus(text) {
        document.querySelector('#screen-importing .progress-status').textContent = text;
    }

    function startPolling(importId) {
        if (state.pollInterval) clearInterval(state.pollInterval);

        // Setup direct button on importing screen to skip and view tracks
        el.screenImporting.querySelector('#btn-view-anyway').onclick = () => {
            clearInterval(state.pollInterval);
            loadPlaylistConsole(importId);
        };

        state.pollInterval = setInterval(() => {
            fetch(`/music/roomba/api/roomba/playlist/${importId}`)
                .then(r => r.json())
                .then(data => {
                    if (data.status === 'complete') {
                        clearInterval(state.pollInterval);
                        loadPlaylistConsole(importId);
                    } else {
                        // Calculate real progress based on analyzed tracks
                        const tracks = data.tracks || [];
                        const total = tracks.length;
                        const analyzed = tracks.filter(t => t.features && t.features.bpm).length;
                        const pct = total > 0 ? Math.round((analyzed / total) * 100) : 0;

                        // Enforce a minimum display of 5% so the bar starts visibly
                        const displayPct = Math.max(5, pct);

                        document.querySelector('#screen-importing .progress-bar-fill').style.width = `${displayPct}%`;
                        updateImportStatus(`Analyzing tracks... (${analyzed}/${total} resolved — ${pct}% complete)`);
                    }
                })
                .catch(() => {
                    clearInterval(state.pollInterval);
                });
        }, 2000);
    }

    function loadPlaylist(importId) {
        state.currentPlaylistId = importId;
        el.screenWelcome.classList.remove('active');
        el.screenImporting.classList.remove('active');
        loadPlaylistConsole(importId);
    }

    function loadPlaylistConsole(importId) {
        fetch(`/music/roomba/api/roomba/playlist/${importId}`)
            .then(r => r.json())
            .then(data => {
                state.currentPlaylistData = data;
                el.currentPlaylistTitle.textContent = data.playlist_name;
                el.trackCountBadge.textContent = `${data.tracks.length} Tracks`;

                el.screenConsole.classList.add('active');
                renderTracklist();

                // If console was active, check if we need to select source track
                if (state.sourceTrack) {
                    const match = data.tracks.find(t => t.id === state.sourceTrack.id);
                    if (match) {
                        selectSourceTrack(match);
                    }
                }
            });
    }

    // Render tracklist table
    function renderTracklist() {
        if (!state.currentPlaylistData) return;

        const filterText = el.trackSearch.value.toLowerCase();
        const sortBy = el.trackSort.value;
        let tracks = [...state.currentPlaylistData.tracks];

        // Filtering
        if (filterText) {
            tracks = tracks.filter(t =>
                t.title.toLowerCase().includes(filterText) ||
                t.artist.toLowerCase().includes(filterText)
            );
        }

        // Sorting
        tracks.sort((a, b) => {
            if (sortBy === 'position') {
                return a.position - b.position;
            } else if (sortBy === 'bpm') {
                const bpmA = a.features.bpm || 0;
                const bpmB = b.features.bpm || 0;
                return bpmA - bpmB;
            } else if (sortBy === 'key') {
                const keyA = a.features.camelot_key || '';
                const keyB = b.features.camelot_key || '';
                return keyA.localeCompare(keyB);
            } else if (sortBy === 'title') {
                return a.title.localeCompare(b.title);
            }
            return 0;
        });

        el.tracksTableBody.innerHTML = '';

        tracks.forEach(t => {
            const tr = document.createElement('tr');
            tr.dataset.id = t.id;
            if (state.sourceTrack && state.sourceTrack.id === t.id) {
                tr.className = 'active';
            }

            // BPM Confidence formatting
            let confClass = 'conf-unknown';
            let bpmLabel = '—';
            if (t.features.bpm) {
                bpmLabel = Math.round(t.features.bpm);
                if (t.features.bpm_confidence === 'verified') confClass = 'conf-verified';
                else if (t.features.bpm_confidence === 'machine_high') confClass = 'conf-auto';
                else confClass = 'conf-autolow';
            }

            // Key label
            const keyLabel = t.features.camelot_key || '—';

            // Energy badge
            let energyText = '—';
            if (t.features.energy_tag) {
                const numDots = { 'low': 1, 'medium': 2, 'high': 3, 'very_high': 4 }[t.features.energy_tag] || 2;
                energyText = '⚡'.repeat(numDots);
            }

            tr.innerHTML = `
                <td class="text-muted" style="font-family: var(--font-mono);">${t.position + 1}</td>
                <td>
                    <div class="track-meta-cell">
                        <span class="track-title">${escapeHtml(t.title)}</span>
                        <span class="track-artist">${escapeHtml(t.artist)}</span>
                    </div>
                </td>
                <td class="bpm-cell ${confClass}">${bpmLabel}</td>
                <td class="key-cell">${keyLabel} <span class="edit-btn" style="opacity:0.3;">✎</span></td>
                <td class="energy-cell">${energyText}</td>
                <td><a href="https://open.spotify.com/track/${t.spotify_track_id}" target="_blank" onclick="event.stopPropagation();">↗</a></td>
            `;

            // Select row
            tr.addEventListener('click', (e) => {
                // If they clicked the key column, open key modal override
                if (e.target.closest('.key-cell')) {
                    openKeyOverrideModal(t);
                } else {
                    selectSourceTrack(t);
                }
            });

            el.tracksTableBody.appendChild(tr);
        });
    }

    // Select Source Track
    function selectSourceTrack(track) {
        state.sourceTrack = track;

        // Highlight in table
        document.querySelectorAll('#tracks-table-body tr').forEach(row => {
            row.classList.remove('active');
            if (parseInt(row.dataset.id) === track.id) {
                row.classList.add('active');
            }
        });

        // Update Workspace Banner
        el.scoutEmptyState.style.display = 'none';
        el.scoutWorkspace.style.display = 'flex';

        el.sourceTrackArt.src = track.album_art_url || '/static/img/default_art.png';
        el.sourceTrackTitle.textContent = track.title;
        el.sourceTrackArtist.textContent = track.artist;
        el.sourceTrackBpm.textContent = track.features.bpm ? `${Math.round(track.features.bpm)} BPM` : '— BPM';
        el.sourceTrackKey.textContent = track.features.camelot_key || '— Key';

        const dots = { 'low': 1, 'medium': 2, 'high': 3, 'very_high': 4 }[track.features.energy_tag] || 2;
        el.sourceTrackEnergy.textContent = '⚡'.repeat(dots) + ` (${track.features.energy_tag || 'medium'})`;

        fetchTransitions(track.id);
    }

    // Fetch ranked transition candidates
    function fetchTransitions(trackId) {
        el.candidatesLoading.style.display = 'flex';
        el.candidatesEmpty.style.display = 'none';
        el.candidatesBuckets.style.display = 'none';

        const preset = el.djStyle.value;

        fetch(`/music/roomba/api/roomba/transitions/${state.currentPlaylistId}/${trackId}?preset=${preset}`)
            .then(r => r.json())
            .then(data => {
                el.candidatesLoading.style.display = 'none';
                el.candidatesBuckets.style.display = 'flex';

                renderBuckets(data);
            })
            .catch(() => {
                el.candidatesLoading.style.display = 'none';
                el.candidatesEmpty.style.display = 'flex';
            });
    }

    // Render candidate buckets
    function renderBuckets(data) {
        let totalCandidates = 0;

        const bucketKeys = ['best_safe_blends', 'energy_lifts', 'energy_resets', 'harmonic_tension', 'metrical_match', 'probably_reject'];

        bucketKeys.forEach(key => {
            const bucketData = data[key] || [];
            totalCandidates += bucketData.length;

            const group = document.querySelector(`.bucket-group[data-bucket="${key}"]`);
            const badge = group.querySelector('.count-badge');
            const content = group.querySelector('.bucket-content');

            badge.textContent = bucketData.length;
            content.innerHTML = '';

            if (bucketData.length === 0) {
                content.innerHTML = '<p class="text-muted text-center p-2" style="font-size:0.85rem;">No matches in this category</p>';
                return;
            }

            bucketData.forEach(c => {
                const item = document.createElement('div');
                item.className = 'candidate-item';
                item.dataset.id = c.track.id;

                const bpmLabel = c.track.features.bpm ? Math.round(c.track.features.bpm) : '—';
                const keyLabel = c.track.features.camelot_key || '—';

                item.innerHTML = `
                    <div class="cand-meta">
                        <span class="cand-title">${escapeHtml(c.track.title)}</span>
                        <span class="cand-artist">${escapeHtml(c.track.artist)}</span>
                    </div>
                    <div class="cand-stats">
                        <span class="cand-stat-badge">${bpmLabel} BPM</span>
                        <span class="cand-stat-badge" style="color:var(--neon-yellow);">${keyLabel}</span>
                        <span class="cand-score">${Math.round(c.score_data.total_score)}</span>
                    </div>
                `;

                // Clicking transition candidate opens detail panel
                item.addEventListener('click', () => {
                    document.querySelectorAll('.candidate-item').forEach(el => el.classList.remove('active'));
                    item.classList.add('active');
                    openTransitionDetail(c);
                });

                content.appendChild(item);
            });
        });

        // Setup toggles
        document.querySelectorAll('.bucket-header').forEach(hdr => {
            hdr.onclick = () => {
                const grp = hdr.closest('.bucket-group');
                const content = grp.querySelector('.bucket-content');
                const toggle = grp.querySelector('.bucket-toggle');

                if (grp.classList.contains('collapsed')) {
                    grp.classList.remove('collapsed');
                    content.classList.add('expanded');
                    content.classList.remove('collapsed');
                    toggle.innerHTML = '&blacktriangledown;';
                } else {
                    grp.classList.add('collapsed');
                    content.classList.remove('expanded');
                    content.classList.add('collapsed');
                    toggle.innerHTML = '&blacktriangleup;';
                }
            };
        });
    }

    // Open detailed transition window
    function openTransitionDetail(candidate) {
        state.selectedCandidate = candidate;

        el.detailPanel.style.display = 'flex';

        // Scores
        el.detailTotalScore.textContent = Math.round(candidate.score_data.total_score);

        el.detailBarTempo.style.width = `${candidate.score_data.tempo_score}%`;
        el.detailValTempo.textContent = `${Math.round(candidate.score_data.tempo_score)}%`;

        el.detailBarHarmonic.style.width = `${candidate.score_data.harmonic_score}%`;
        el.detailValHarmonic.textContent = `${Math.round(candidate.score_data.harmonic_score)}%`;

        el.detailBarEnergy.style.width = `${candidate.score_data.energy_score}%`;
        el.detailValEnergy.textContent = `${Math.round(candidate.score_data.energy_score)}%`;

        // Explanations
        const exp = candidate.score_data.explanation;
        el.detailWhy.textContent = exp.why_it_works;
        el.detailTry.textContent = exp.suggested_experiment || "Start mixing B during the outro of A.";

        el.detailWatchOut.innerHTML = '';
        const watchOuts = exp.watch_out || [];
        watchOuts.forEach(w => {
            const li = document.createElement('li');
            li.textContent = w;
            el.detailWatchOut.appendChild(li);
        });

        // Setup crossfade previews
        el.playerTitleA.textContent = state.sourceTrack.title;
        el.playerMetaA.textContent = `${Math.round(state.sourceTrack.features.bpm || 0)} BPM · ${state.sourceTrack.features.camelot_key || '—'}`;

        el.playerTitleB.textContent = candidate.track.title;
        el.playerMetaB.textContent = `${Math.round(candidate.track.features.bpm || 0)} BPM · ${candidate.track.features.camelot_key || '—'}`;

        stopAllPlayers();

        // Resolve preview URLs dynamically from iTunes Search API client-side
        // for both tracks simultaneously
        resolvePreviewUrl(state.sourceTrack, (urlA) => {
            state.audioA.src = urlA;
            clearCanvas(el.canvasA);
        });

        resolvePreviewUrl(candidate.track, (urlB) => {
            state.audioB.src = urlB;
            clearCanvas(el.canvasB);
        });

        updateVolumes();

        // Smooth scroll to detail
        el.detailPanel.scrollIntoView({ behavior: 'smooth' });
    }

    // Dynamic iTunes Search helper
    function resolvePreviewUrl(track, callback) {
        const query = `${track.artist} ${track.title.replace(/\(.*?\)|\[.*?\]/g, "")}`;
        fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=1`)
            .then(res => res.json())
            .then(data => {
                if (data.results && data.results.length > 0 && data.results[0].previewUrl) {
                    callback(data.results[0].previewUrl);
                } else {
                    callback(undefined);
                }
            })
            .catch(() => {
                callback(undefined);
            });
    }

    // "Use Currently Playing" shortcut
    function useCurrentlyPlayingTrack() {
        fetch('/spotify/api/now-playing')
            .then(r => {
                if (r.status === 204) {
                    showToast("No active track playing on Spotify.", true);
                    return;
                }
                return r.json();
            })
            .then(data => {
                if (!data || !data.track) return;
                const spotifyTrackId = data.track.spotify_track_id;

                // Check if current playlist contains this track
                if (state.currentPlaylistData) {
                    const match = state.currentPlaylistData.tracks.find(t => t.spotify_track_id === spotifyTrackId);
                    if (match) {
                        selectSourceTrack(match);
                        showToast(`Selected: ${match.title}`);
                    } else {
                        showToast("Currently playing track is not in this imported playlist.", true);
                    }
                }
            });
    }

    // Key overrides modal open
    function openKeyOverrideModal(track) {
        state.editingTrackId = track.id;
        el.modalKeyTrackTitle.textContent = track.title;

        const curKey = track.features.camelot_key || '—';
        el.modalKeyCurrentLabel.textContent = curKey;
        el.modalKeyCurrentLabel.className = 'badge';
        if (curKey !== '—') {
            el.modalKeyCurrentLabel.style.backgroundColor = camelotColors[curKey] || '#222';
            el.modalKeyCurrentLabel.style.color = '#000';
        }

        state.tempOverrideKey = track.features.camelot_key;
        el.modalKeyPicker.classList.add('active');
        highlightCompatibleKeys(state.tempOverrideKey);
    }

    // Render Camelot Wheel segments inside SVG
    function drawCamelotWheel() {
        const svg = el.modalKeyPicker.querySelector('#wheel-segments');
        svg.innerHTML = '';

        const cx = 200;
        const cy = 200;

        // Slices labels arrangement: standard Camelot wheel layout
        // Slices start from top (12) clockwise
        const order = ['12', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'];
        const sliceAngle = 360 / 12;

        // Outer ring (Minor - A)
        const rOuterStart = 135;
        const rOuterEnd = 195;

        // Inner ring (Major - B)
        const rInnerStart = 75;
        const rInnerEnd = 135;

        // Draw slices
        for (let i = 0; i < 12; i++) {
            const startAngle = i * sliceAngle - 90 - (sliceAngle / 2);
            const endAngle = startAngle + sliceAngle;

            const num = order[i];

            // Draw Minor (A)
            const pathA = drawSlicePath(cx, cy, rOuterStart, rOuterEnd, startAngle, endAngle);
            const elA = document.createElementNS("http://www.w3.org/2000/svg", "path");
            elA.setAttribute("d", pathA);
            elA.setAttribute("fill", camelotColors[`${num}A`]);
            elA.setAttribute("fill-opacity", "0.2");
            elA.setAttribute("stroke", "#111");
            elA.setAttribute("stroke-width", "1");
            elA.dataset.key = `${num}A`;
            setupSliceHover(elA);
            svg.appendChild(elA);

            // Draw Major (B)
            const pathB = drawSlicePath(cx, cy, rInnerStart, rInnerEnd, startAngle, endAngle);
            const elB = document.createElementNS("http://www.w3.org/2000/svg", "path");
            elB.setAttribute("d", pathB);
            elB.setAttribute("fill", camelotColors[`${num}B`]);
            elB.setAttribute("fill-opacity", "0.2");
            elB.setAttribute("stroke", "#111");
            elB.setAttribute("stroke-width", "1");
            elB.dataset.key = `${num}B`;
            setupSliceHover(elB);
            svg.appendChild(elB);

            // Labels
            const labelAngle = startAngle + (sliceAngle / 2);
            const rad = (labelAngle * Math.PI) / 180;

            // Outer label
            const xA = cx + (rOuterStart + 30) * Math.cos(rad);
            const yA = cy + (rOuterStart + 30) * Math.sin(rad);
            const txtA = document.createElementNS("http://www.w3.org/2000/svg", "text");
            txtA.setAttribute("x", xA);
            txtA.setAttribute("y", yA + 5);
            txtA.setAttribute("text-anchor", "middle");
            txtA.setAttribute("fill", "#bbb");
            txtA.setAttribute("font-size", "11");
            txtA.setAttribute("pointer-events", "none");
            txtA.textContent = `${num}A`;
            svg.appendChild(txtA);

            // Inner label
            const xB = cx + (rInnerStart + 30) * Math.cos(rad);
            const yB = cy + (rInnerStart + 30) * Math.sin(rad);
            const txtB = document.createElementNS("http://www.w3.org/2000/svg", "text");
            txtB.setAttribute("x", xB);
            txtB.setAttribute("y", yB + 5);
            txtB.setAttribute("text-anchor", "middle");
            txtB.setAttribute("fill", "#bbb");
            txtB.setAttribute("font-size", "11");
            txtB.setAttribute("pointer-events", "none");
            txtB.textContent = `${num}B`;
            svg.appendChild(txtB);
        }
    }

    function drawSlicePath(cx, cy, rIn, rOut, startAngle, endAngle) {
        const rad1 = (startAngle * Math.PI) / 180;
        const rad2 = (endAngle * Math.PI) / 180;

        const x1_in = cx + rIn * Math.cos(rad1);
        const y1_in = cy + rIn * Math.sin(rad1);
        const x1_out = cx + rOut * Math.cos(rad1);
        const y1_out = cy + rOut * Math.sin(rad1);

        const x2_in = cx + rIn * Math.cos(rad2);
        const y2_in = cy + rIn * Math.sin(rad2);
        const x2_out = cx + rOut * Math.cos(rad2);
        const y2_out = cy + rOut * Math.sin(rad2);

        return `
            M ${x1_in} ${y1_in}
            L ${x1_out} ${y1_out}
            A ${rOut} ${rOut} 0 0 1 ${x2_out} ${y2_out}
            L ${x2_in} ${y2_in}
            A ${rIn} ${rIn} 0 0 0 ${x1_in} ${y1_in}
            Z
        `;
    }

    function setupSliceHover(sliceElement) {
        sliceElement.addEventListener('mouseenter', () => {
            const key = sliceElement.dataset.key;
            highlightCompatibleKeys(key);
            document.getElementById('wheel-selected-label').textContent = key;
        });

        sliceElement.addEventListener('mouseleave', () => {
            highlightCompatibleKeys(state.tempOverrideKey);
            document.getElementById('wheel-selected-label').textContent = state.tempOverrideKey || '—';
        });

        sliceElement.addEventListener('click', () => {
            state.tempOverrideKey = sliceElement.dataset.key;
            highlightCompatibleKeys(state.tempOverrideKey);
            document.getElementById('wheel-selected-label').textContent = state.tempOverrideKey;
        });
    }

    function highlightCompatibleKeys(activeKey) {
        // Clear highlights
        const paths = document.querySelectorAll('#wheel-segments path');
        paths.forEach(p => {
            p.classList.remove('compatible');
            p.classList.remove('selected');
            p.setAttribute("fill-opacity", "0.25");
        });

        if (!activeKey) return;

        const num = parseInt(activeKey.slice(0, -1));
        const mode = activeKey.slice(-1);

        // Define compatible set
        const compatible = new Set();
        compatible.add(activeKey); // Same key
        compatible.add(`${num}${mode === 'A' ? 'B' : 'A'}`); // Relative mode
        compatible.add(`${num === 12 ? 1 : num + 1}${mode}`); // adjacent up
        compatible.add(`${num === 1 ? 12 : num - 1}${mode}`); // adjacent down

        // Diagonal mediants: ±1 mod 12 with opposite letter
        compatible.add(`${num === 12 ? 1 : num + 1}${mode === 'A' ? 'B' : 'A'}`);
        compatible.add(`${num === 1 ? 12 : num - 1}${mode === 'A' ? 'B' : 'A'}`);

        paths.forEach(p => {
            const key = p.dataset.key;
            if (key === activeKey) {
                p.classList.add('selected');
                p.setAttribute("fill-opacity", "0.95");
            } else if (compatible.has(key)) {
                p.classList.add('compatible');
                p.setAttribute("fill-opacity", "0.65");
            }
        });
    }

    // Save key override
    function saveKeyOverride() {
        if (!state.editingTrackId || !state.tempOverrideKey) return;

        closeModals();

        showToast("Saving key override...", false, true);

        fetch(`/music/roomba/api/roomba/track/${state.editingTrackId}/features`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ camelot_key: state.tempOverrideKey })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showToast("Key override saved ✓");
                // Reload playlist data to refresh track list and trigger re-scoring
                loadPlaylistConsole(state.currentPlaylistId);
            } else {
                showToast("Failed to save key override", true);
            }
        })
        .catch(() => {
            showToast("Failed to save key override", true);
        });
    }

    // Toast notices
    function showToast(text, isError = false, keepOpen = false) {
        el.autosaveToast.classList.remove('active');

        if (isError) {
            el.toastSpinner.style.display = 'none';
            el.toastText.innerHTML = `<span class="text-danger">⚠️ ${escapeHtml(text)}</span>`;
        } else if (keepOpen) {
            el.toastSpinner.style.display = 'inline-block';
            el.toastText.textContent = text;
        } else {
            el.toastSpinner.style.display = 'none';
            el.toastText.innerHTML = `<span class="toast-success-icon">✓</span> ${escapeHtml(text)}`;
        }

        el.autosaveToast.classList.add('active');

        if (!keepOpen) {
            setTimeout(() => {
                el.autosaveToast.classList.remove('active');
            }, 3000);
        }
    }

    // Utilities
    function escapeHtml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // DOM Boot
    document.addEventListener('DOMContentLoaded', init);

})();
