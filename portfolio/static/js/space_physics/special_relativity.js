/**
 * JonsLane Space Physics: Special Relativity Interactive Lab Engine
 * Consolidated JavaScript Engine managing 8 chapters of interactive scrollytelling.
 * Integrates:
 * - Second-order Trapezoidal proper-time integration
 * - Catastrophic cancellation avoidance in gamma - 1
 * - Clamped atanh() speed-dial mapping
 * - High-DPI layout width anchoring
 * - Centralized lifecycle coordination with off-screen intersection observers
 */

(function () {
    // --- Constants ---
    const BETA_LIMIT = 0.99999;
    const C_REAL = 299792458;

    // --- Math & Physics Helpers ---
    function clampBeta(beta) {
        return Math.max(-BETA_LIMIT, Math.min(BETA_LIMIT, beta));
    }

    function getGamma(beta) {
        const b = clampBeta(beta);
        return 1 / Math.sqrt(1 - b * b);
    }

    // Avoids catastrophic cancellation near beta -> 0
    function getGammaMinusOne(beta) {
        const b = clampBeta(beta);
        const bSq = b * b;
        const sqrtTerm = Math.sqrt(1 - bSq);
        return bSq / (sqrtTerm * (1 + sqrtTerm));
    }

    function getGammaMinusOneFromU(u) {
        const uSq = u * u;
        return uSq / (Math.sqrt(1 + uSq) + 1);
    }

    function lorentzForward(x, t, beta) {
        const b = clampBeta(beta);
        const gamma = getGamma(b);
        return {
            xPrime: gamma * (x - b * t),
            tPrime: gamma * (t - b * x),
            gamma: gamma
        };
    }

    function lorentzInverse(xp, tp, beta) {
        const b = clampBeta(beta);
        const gamma = getGamma(b);
        return {
            x: gamma * (xp + b * tp),
            t: gamma * (tp + b * xp),
            gamma: gamma
        };
    }

    function velocityAdd(uPrime, v) {
        const up = clampBeta(uPrime);
        const vel = clampBeta(v);
        return (up + vel) / (1 + up * vel);
    }

    function aberratedAngle(theta, beta) {
        const b = clampBeta(beta);
        const cosTheta = Math.cos(theta);
        const cosThetaPrime = (cosTheta - b) / (1 - b * cosTheta);
        const thetaPrime = Math.acos(Math.max(-1, Math.min(1, cosThetaPrime)));
        // Preserve original quadrant/sign of the angle (since acos returns [0, PI])
        return (Math.sin(theta) < 0) ? (Math.PI * 2 - thetaPrime) : thetaPrime;
    }

    // Map wavelength (380nm - 700nm) to RGB
    function wavelengthToRGB(lambda_nm) {
        let r = 0, g = 0, b = 0;
        if (lambda_nm < 380) {
            r = 0.6; g = 0.0; b = 0.5;
        } else if (lambda_nm < 440) {
            r = (440 - lambda_nm) / 60; g = 0; b = 1;
        } else if (lambda_nm < 490) {
            r = 0; g = (lambda_nm - 440) / 50; b = 1;
        } else if (lambda_nm < 510) {
            r = 0; g = 1; b = (510 - lambda_nm) / 20;
        } else if (lambda_nm < 580) {
            r = (lambda_nm - 510) / 70; g = 1; b = 0;
        } else if (lambda_nm < 645) {
            r = 1; g = (645 - lambda_nm) / 65; b = 0;
        } else if (lambda_nm <= 700) {
            r = 1; g = 0; b = 0;
        } else {
            r = 0.5; g = 0; b = 0;
        }

        let factor = (lambda_nm < 380 || lambda_nm > 700) ? 0.1
                   : (lambda_nm < 420) ? 0.3 + 0.7 * (lambda_nm - 380) / 40
                   : (lambda_nm > 680) ? 0.3 + 0.7 * (700 - lambda_nm) / 20
                   : 1.0;

        return {
            r: Math.round(255 * Math.pow(r * factor, 0.8)),
            g: Math.round(255 * Math.pow(g * factor, 0.8)),
            b: Math.round(255 * Math.pow(b * factor, 0.8))
        };
    }

    // --- Interactive Canvas Helpers ---
    function setupCanvas(canvas) {
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();

        // Backing store buffer size
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;

        // CSS display size (anchors correct layout on High-DPI Retina)
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';

        const ctx = canvas.getContext('2d');
        ctx.resetTransform();
        ctx.scale(dpr, dpr);
        return ctx;
    }

    // --- Speed Dial Control Canvas ---
    class SpeedDial {
        constructor(canvasId, onChange) {
            this.canvas = document.getElementById(canvasId);
            if (!this.canvas) return;
            this.ctx = this.canvas.getContext('2d');
            this.onChange = onChange;

            this.betaMax = 0.99; // Display limit
            this.thetaMax = Math.PI * 0.75; // 270 degrees total span
            this.beta = 0.0;
            this.isDragging = false;

            this.width = this.canvas.width / (window.devicePixelRatio || 1);
            this.height = this.canvas.height / (window.devicePixelRatio || 1);
            this.centerX = this.width / 2;
            this.centerY = this.height / 2;
            this.radius = Math.min(this.centerX, this.centerY) - 14;

            this.bindEvents();
            this.draw();
        }

        bindEvents() {
            const handleStart = (clientX, clientY) => {
                const rect = this.canvas.getBoundingClientRect();
                const x = clientX - rect.left - this.centerX;
                const y = clientY - rect.top - this.centerY;
                const dist = Math.sqrt(x*x + y*y);
                if (dist > this.radius - 20 && dist < this.radius + 20) {
                    this.isDragging = true;
                    handleMove(clientX, clientY);
                }
            };

            const handleMove = (clientX, clientY) => {
                if (!this.isDragging) return;
                const rect = this.canvas.getBoundingClientRect();
                const x = clientX - rect.left - this.centerX;
                const y = clientY - rect.top - this.centerY;

                // Get angle relative to bottom vertical (+Y is down in canvas)
                let angle = Math.atan2(x, -y); // 0 is straight up, increases clockwise

                // Rotate coordinate by 180 deg to center zero at bottom vertical
                angle = Math.atan2(-x, y);

                // Clamping angle to thetaMax
                angle = Math.max(-this.thetaMax, Math.min(this.thetaMax, angle));

                // Map angle to beta via tanh
                const k = Math.atanh(this.betaMax);
                this.beta = Math.tanh((angle / this.thetaMax) * k);

                this.onChange(this.beta);
                this.draw();
            };

            this.canvas.addEventListener('mousedown', (e) => handleStart(e.clientX, e.clientY));
            window.addEventListener('mousemove', (e) => {
                if (this.isDragging) handleMove(e.clientX, e.clientY);
            });
            window.addEventListener('mouseup', () => {
                this.isDragging = false;
            });

            // Touch support
            this.canvas.addEventListener('touchstart', (e) => {
                if (e.touches.length === 1) handleStart(e.touches[0].clientX, e.touches[0].clientY);
                e.preventDefault();
            }, { passive: false });
            window.addEventListener('touchmove', (e) => {
                if (this.isDragging && e.touches.length === 1) handleMove(e.touches[0].clientX, e.touches[0].clientY);
            }, { passive: false });
            window.addEventListener('touchend', () => {
                this.isDragging = false;
            });
        }

        setBeta(beta) {
            this.beta = Math.max(-this.betaMax, Math.min(this.betaMax, beta));
            this.draw();
        }

        draw() {
            const ctx = setupCanvas(this.canvas);
            ctx.clearRect(0, 0, this.width, this.height);

            // Draw track background dial arc
            ctx.beginPath();
            ctx.arc(this.centerX, this.centerY, this.radius, Math.PI * 0.5 - this.thetaMax, Math.PI * 0.5 + this.thetaMax);
            ctx.strokeStyle = '#18192d';
            ctx.lineWidth = 6;
            ctx.stroke();

            // Draw active fill arc
            const k = Math.atanh(this.betaMax);
            const currentAngle = (Math.atanh(this.beta) / k) * this.thetaMax;

            ctx.beginPath();
            ctx.arc(this.centerX, this.centerY, this.radius, Math.PI * 0.5, Math.PI * 0.5 + currentAngle, this.beta < 0);
            ctx.strokeStyle = varColor(this.beta >= 0 ? '--neon-cyan' : '--neon-magenta');
            ctx.lineWidth = 6;
            ctx.stroke();

            // Draw knob center
            const knobAngle = Math.PI * 0.5 + currentAngle;
            const knobX = this.centerX + this.radius * Math.cos(knobAngle);
            const knobY = this.centerY + this.radius * Math.sin(knobAngle);

            ctx.beginPath();
            ctx.arc(knobX, knobY, 9, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.shadowBlur = 8;
            ctx.shadowColor = varColor('--neon-cyan-glow');
            ctx.fill();
            ctx.shadowBlur = 0; // reset

            // Text in the center
            ctx.fillStyle = '#ffffff';
            ctx.font = "bold 13px 'JetBrains Mono', monospace";
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(this.beta.toFixed(3), this.centerX, this.centerY - 5);

            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.font = "9px sans-serif";
            ctx.fillText("SPEED (β)", this.centerX, this.centerY + 10);
        }
    }

    function varColor(varName) {
        return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || '#00f2fe';
    }

    // --- Interactive Ruler Tool ---
    class RulerTool {
        constructor(canvas, onMeasure) {
            this.canvas = canvas;
            this.onMeasure = onMeasure;
            this.startPt = null;
            this.currentPt = null;
            this.isDragging = false;
            this.scale = 40; // Pixels per light-second

            this.bindEvents();
        }

        bindEvents() {
            const getPos = (clientX, clientY) => {
                const rect = this.canvas.getBoundingClientRect();
                return {
                    x: clientX - rect.left,
                    y: clientY - rect.top
                };
            };

            this.canvas.addEventListener('mousedown', (e) => {
                this.startPt = getPos(e.clientX, e.clientY);
                this.currentPt = { ...this.startPt };
                this.isDragging = true;
            });

            window.addEventListener('mousemove', (e) => {
                if (!this.isDragging) return;
                this.currentPt = getPos(e.clientX, e.clientY);
            });

            window.addEventListener('mouseup', () => {
                if (!this.isDragging) return;
                this.isDragging = false;
                if (this.startPt && this.currentPt) {
                    const dx = this.currentPt.x - this.startPt.x;
                    const dy = this.currentPt.y - this.startPt.y;
                    const lengthPx = Math.sqrt(dx*dx + dy*dy);
                    this.onMeasure(lengthPx / this.scale);
                }
            });
        }

        draw(ctx) {
            if (!this.startPt || !this.currentPt) return;

            ctx.save();
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 4]);

            // Draw line
            ctx.beginPath();
            ctx.moveTo(this.startPt.x, this.startPt.y);
            ctx.lineTo(this.currentPt.x, this.currentPt.y);
            ctx.stroke();

            // Draw endpoints
            ctx.setLineDash([]);
            ctx.fillStyle = '#f59e0b';
            ctx.beginPath();
            ctx.arc(this.startPt.x, this.startPt.y, 4, 0, Math.PI*2);
            ctx.arc(this.currentPt.x, this.currentPt.y, 4, 0, Math.PI*2);
            ctx.fill();

            // Draw tooltip box
            const mx = (this.startPt.x + this.currentPt.x) / 2;
            const my = (this.startPt.y + this.currentPt.y) / 2;
            const dx = this.currentPt.x - this.startPt.x;
            const dy = this.currentPt.y - this.startPt.y;
            const lengthLs = Math.sqrt(dx*dx + dy*dy) / this.scale;

            ctx.fillStyle = 'rgba(10, 11, 20, 0.85)';
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 1;

            const txt = `${lengthLs.toFixed(2)} ls`;
            ctx.font = "11px 'JetBrains Mono', monospace";
            const width = ctx.measureText(txt).width + 12;

            ctx.beginPath();
            ctx.roundRect(mx - width/2, my - 22, width, 18, 4);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.fillText(txt, mx, my - 9);

            ctx.restore();
        }

        clear() {
            this.startPt = null;
            this.currentPt = null;
        }
    }

    // --- Clock Renderer helper ---
    function drawClockFace(ctx, cx, cy, radius, tau, label, speedFraction) {
        // Outer face
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI*2);
        ctx.fillStyle = '#06060f';
        ctx.fill();
        ctx.strokeStyle = '#312e81';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Ticks
        ctx.strokeStyle = '#4338ca';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2 - Math.PI/2;
            const length = (i % 3 === 0) ? radius * 0.18 : radius * 0.08;
            ctx.beginPath();
            ctx.moveTo(cx + (radius - 3) * Math.cos(angle), cy + (radius - 3) * Math.sin(angle));
            ctx.lineTo(cx + (radius - 3 - length) * Math.cos(angle), cy + (radius - 3 - length) * Math.sin(angle));
            ctx.stroke();
        }

        // Draw Hands (driven by proper time tau)
        // Let period of clock face be 10 seconds for visual clarity
        const period = 10.0;
        const handAngle = ((tau % period) / period) * Math.PI * 2 - Math.PI / 2;

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + radius * 0.75 * Math.cos(handAngle), cy + radius * 0.75 * Math.sin(handAngle));
        ctx.strokeStyle = '#00f2fe';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Center hub dot
        ctx.beginPath();
        ctx.arc(cx, cy, 4, 0, Math.PI*2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        // Labels
        ctx.fillStyle = '#ffffff';
        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = 'center';
        ctx.fillText(label, cx, cy + radius + 18);

        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = "9px 'JetBrains Mono', monospace";
        ctx.fillText(`rate: ${speedFraction.toFixed(4)}`, cx, cy + radius + 30);
    }

    // --- Central Lifecycle Coordinator ---
    class RelativisticLabController {
        constructor() {
            this.chapters = {};
            this.observers = {};
            this.animationFrameIds = {};
            this.activeChapterId = null;
            this.globalState = {
                beta: 0.0,
                gamma: 1.0
            };
            this.initIntersectionObserver();
        }

        registerChapter(id, chapterInstance) {
            this.chapters[id] = chapterInstance;
        }

        initIntersectionObserver() {
            const observerOptions = {
                root: null,
                threshold: 0.15
            };

            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    const chId = entry.target.getAttribute('data-chapter');
                    if (entry.isIntersecting) {
                        this.activateChapter(chId);
                    } else {
                        if (this.activeChapterId === chId) {
                            this.deactivateChapter(chId);
                        }
                    }
                });
            }, observerOptions);

            document.querySelectorAll('.scrolly-chapter').forEach(el => {
                observer.observe(el);
            });
        }

        activateChapter(id) {
            // Clean up previous chapter if active
            if (this.activeChapterId && this.activeChapterId !== id) {
                this.deactivateChapter(this.activeChapterId);
            }

            this.activeChapterId = id;
            const chapter = this.chapters[id];
            if (!chapter) return;

            const canvas = document.getElementById(`canvas-ch${id}`);
            if (canvas) {
                chapter.init(this.globalState);

                const loop = (timestamp) => {
                    chapter.tick(timestamp);
                    chapter.draw();
                    this.animationFrameIds[id] = requestAnimationFrame(loop);
                };
                this.animationFrameIds[id] = requestAnimationFrame(loop);
            }
        }

        deactivateChapter(id) {
            if (this.animationFrameIds[id]) {
                cancelAnimationFrame(this.animationFrameIds[id]);
                delete this.animationFrameIds[id];
            }
            const chapter = this.chapters[id];
            if (chapter) {
                chapter.cleanup();
            }
            if (this.activeChapterId === id) {
                this.activeChapterId = null;
            }
        }
    }

    const controller = new RelativisticLabController();

    // --- Quiz submission handling ---
    function setupQuiz(chNum, correctAns, feedbackTxt) {
        const btn = document.getElementById(`btn-submit-q-ch${chNum}`);
        const feedback = document.getElementById(`feedback-ch${chNum}`);
        if (!btn || !feedback) return;

        btn.addEventListener('click', () => {
            const selected = document.querySelector(`input[name="ch${chNum}-quiz"]:checked`);
            if (!selected) {
                feedback.textContent = "Please select an option first.";
                feedback.className = "feedback-banner error";
                feedback.style.display = "block";
                return;
            }

            // Remove highlighted states
            document.querySelectorAll(`#quiz-form-ch${chNum} .lab-question-option`).forEach(el => {
                el.classList.remove('correct', 'incorrect');
            });

            const val = selected.value;
            const optEl = selected.parentElement;

            if (val === correctAns) {
                optEl.classList.add('correct');
                feedback.innerHTML = `<strong>Correct!</strong> ${feedbackTxt}`;
                feedback.className = "feedback-banner success";
            } else {
                optEl.classList.add('incorrect');

                // Find correct one to highlight as well
                const correctEl = document.querySelector(`input[name="ch${chNum}-quiz"][value="${correctAns}"]`).parentElement;
                correctEl.classList.add('correct');

                feedback.innerHTML = `<strong>Incorrect.</strong> ${feedbackTxt}`;
                feedback.className = "feedback-banner error";
            }
            feedback.style.display = "block";
        });
    }

    // Initialize Quizzes
    setupQuiz(1, "B", "The speed of light is completely invariant in all frames of reference. Galilean velocity addition fails at these scales.");
    setupQuiz(2, "B", "Subtracting signal delays corrects for what Bob sees visually, but the underlying coordinate emission events remain non-simultaneous. Moving frames have a real, physical shift in coordinate time.");
    setupQuiz(3, "A", "Because the front of the ruler is measured first and the back later in the ruler's frame, the flashes occur at different times. Length contraction is a physical consequence of this endpoint measurement discrepancy.");
    setupQuiz(4, "B", "Time dilation is not a mechanical failure of the clock gears. Moving clocks trace a geometrically shorter path through the four-dimensional geometry of spacetime.");
    setupQuiz(5, "B", "Perpendicular light rays still undergo redshift. Unlike classical physics, the transverse Doppler effect is a direct result of time dilation.");
    setupQuiz(6, "B", "Bob is younger because he travelled along a shorter, non-geodesic path in spacetime. Acceleration was required to turn around, but proper time is accumulated along the cruise path segments.");
    setupQuiz(7, "B", "Spacelike separation ($s^2 < 0$) is causally disconnected. Because $s^2$ is invariant, no frame can connect them. However, they can reverse temporal order depending on frame boosts.");
    setupQuiz(8, "B", "Coordinate acceleration drops because the accelerating force is suppressed by $\gamma^3$. As $v \\to c$, it takes infinite energy to produce any further coordinate speed increase.");

    // ==========================================================================
    // CHAPTER 1 IMPLEMENTATION: Speed of light is constant
    // ==========================================================================
    controller.registerChapter('1', {
        init(state) {
            this.canvas = document.getElementById('canvas-ch1');
            this.state = state;
            this.dial = new SpeedDial('dial-ch1', (beta) => {
                this.state.beta = beta;
                this.state.gamma = getGamma(beta);
                document.getElementById('val-ch1-beta').textContent = `${this.state.beta.toFixed(4)} c`;
                document.getElementById('val-ch1-gamma').textContent = this.state.gamma.toFixed(4);

                // Newtonian wrong prediction readout
                const newtonVal = 1.0 + Math.abs(this.state.beta);
                document.getElementById('val-ch1-newton-pulse').textContent = `${newtonVal.toFixed(3)} c`;
            });
            this.dial.setBeta(this.state.beta);

            // Simulation state
            this.pulseActive = false;
            this.time = 0.0;
            this.universeMode = 'relativistic'; // 'relativistic' or 'newtonian'

            this.fireBtn = document.getElementById('btn-ch1-fire');
            this.fireHandler = () => {
                this.pulseActive = true;
                this.time = 0.0;
                document.getElementById('val-ch1-alice-pulse').textContent = "Measuring...";
                document.getElementById('val-ch1-bob-pulse').textContent = "Measuring...";
            };
            this.fireBtn.addEventListener('click', this.fireHandler);

            this.modeBtn = document.getElementById('btn-ch1-mode');
            this.modeHandler = () => {
                if (this.universeMode === 'relativistic') {
                    this.universeMode = 'newtonian';
                    this.modeBtn.textContent = 'Universe: Newtonian (Classical)';
                    this.modeBtn.style.borderColor = 'var(--neon-amber)';
                } else {
                    this.universeMode = 'relativistic';
                    this.modeBtn.textContent = 'Universe: Relativistic (Reality)';
                    this.modeBtn.style.borderColor = 'var(--neon-cyan)';
                }
                // Reset simulation when mode changes to keep it clean
                this.pulseActive = false;
                this.time = 0.0;
                document.getElementById('val-ch1-alice-pulse').textContent = "1.000 c";
                document.getElementById('val-ch1-bob-pulse').textContent = "1.000 c";
            };
            this.modeBtn.addEventListener('click', this.modeHandler);
        },
        tick() {
            if (this.pulseActive) {
                const dt = 0.016; // 60fps equivalent step
                this.time += dt;

                const baseSpeed = 160; // pixels per second
                const startX = 60;

                this.canvas = document.getElementById('canvas-ch1');
                const w = this.canvas.width / (window.devicePixelRatio || 1);
                const finishX = w - 60;

                const alicePulseX = startX + baseSpeed * this.time;

                // Stop simulation when Alice's pulse crosses the finish line
                if (alicePulseX >= finishX) {
                    this.pulseActive = false;
                    document.getElementById('val-ch1-alice-pulse').textContent = "1.000 c";
                    if (this.universeMode === 'relativistic') {
                        document.getElementById('val-ch1-bob-pulse').textContent = "1.000 c";
                    } else {
                        const newtonVal = 1.0 + Math.abs(this.state.beta);
                        document.getElementById('val-ch1-bob-pulse').textContent = `${newtonVal.toFixed(3)} c`;
                    }
                }
            }
        },
        draw() {
            const ctx = setupCanvas(this.canvas);
            const w = this.canvas.width / (window.devicePixelRatio || 1);
            const h = this.canvas.height / (window.devicePixelRatio || 1);

            ctx.clearRect(0, 0, w, h);

            const cy = h / 2;
            const startX = 60;
            const finishX = w - 60;
            const baseSpeed = 160;

            // Draw track guide lines
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(30, cy - 30);
            ctx.lineTo(w - 30, cy - 30);
            ctx.moveTo(30, cy + 30);
            ctx.lineTo(w - 30, cy + 30);
            ctx.stroke();

            // Draw Start and Finish lines
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(startX, 15);
            ctx.lineTo(startX, h - 15);
            ctx.moveTo(finishX, 15);
            ctx.lineTo(finishX, h - 15);
            ctx.stroke();
            ctx.setLineDash([]);

            // Draw Start & Finish text
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.font = '9px monospace';
            ctx.fillText('START', startX - 14, 12);
            ctx.fillText('FINISH', finishX - 16, 12);

            // Compute positions
            let alicePulseX = startX;
            let rocketX = startX;
            let bobPulseX = startX;

            if (this.pulseActive || this.time > 0) {
                alicePulseX = startX + baseSpeed * this.time;
                rocketX = startX + Math.abs(this.state.beta) * baseSpeed * this.time;
                if (this.universeMode === 'relativistic') {
                    bobPulseX = startX + baseSpeed * this.time;
                } else {
                    bobPulseX = startX + (1.0 + Math.abs(this.state.beta)) * baseSpeed * this.time;
                }
            }

            // Draw Track labels
            ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
            ctx.fillText("Track A: Post (Rest Frame)", 30, cy - 45);
            ctx.fillText("Track B: Rocket (Moving Frame)", 30, cy + 15);

            // Draw Alice's Stationary Post
            ctx.fillStyle = '#00f2fe';
            ctx.beginPath();
            ctx.arc(startX, cy - 30, 5, 0, Math.PI * 2);
            ctx.fill();
            // Pulse glow for post
            ctx.fillStyle = 'rgba(0, 242, 254, 0.15)';
            ctx.beginPath();
            ctx.arc(startX, cy - 30, 10, 0, Math.PI * 2);
            ctx.fill();

            // Draw Bob's Rocket
            // Body
            const rx = rocketX;
            const ry = cy + 30;
            ctx.fillStyle = '#ff00dd';
            ctx.beginPath();
            ctx.moveTo(rx - 15, ry - 7);
            ctx.lineTo(rx + 10, ry - 7);
            ctx.lineTo(rx + 18, ry);
            ctx.lineTo(rx + 10, ry + 7);
            ctx.lineTo(rx - 15, ry + 7);
            ctx.closePath();
            ctx.fill();
            // Engine fire glow
            if (this.pulseActive && Math.abs(this.state.beta) > 0.05) {
                const fireGrad = ctx.createLinearGradient(rx - 25, ry, rx - 15, ry);
                fireGrad.addColorStop(0, 'rgba(255, 165, 0, 0)');
                fireGrad.addColorStop(1, '#ffa500');
                ctx.fillStyle = fireGrad;
                ctx.fillRect(rx - 25, ry - 4, 10, 8);
            }

            // Draw Alice's Photon
            if (this.pulseActive || this.time > 0) {
                const px = alicePulseX;
                const py = cy - 30;
                const grad = ctx.createRadialGradient(px, py, 0, px, py, 14);
                grad.addColorStop(0, 'rgba(0, 242, 254, 1)');
                grad.addColorStop(0.4, 'rgba(0, 242, 254, 0.4)');
                grad.addColorStop(1, 'rgba(0, 242, 254, 0)');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(px, py, 14, 0, Math.PI * 2);
                ctx.fill();
            }

            // Draw Bob's Photon
            if (this.pulseActive || this.time > 0) {
                const px = bobPulseX;
                const py = cy + 30;
                const grad = ctx.createRadialGradient(px, py, 0, px, py, 14);
                grad.addColorStop(0, 'rgba(255, 0, 221, 1)');
                grad.addColorStop(0.4, 'rgba(255, 0, 221, 0.4)');
                grad.addColorStop(1, 'rgba(255, 0, 221, 0)');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(px, py, 14, 0, Math.PI * 2);
                ctx.fill();
            }
        },
        cleanup() {
            if (this.fireBtn && this.fireHandler) {
                this.fireBtn.removeEventListener('click', this.fireHandler);
            }
            if (this.modeBtn && this.modeHandler) {
                this.modeBtn.removeEventListener('click', this.modeHandler);
            }
        }
    });

    // ==========================================================================
    // CHAPTER 2 IMPLEMENTATION: Simultaneity breaks
    // ==========================================================================
    controller.registerChapter('2', {
        init(state) {
            this.canvas = document.getElementById('canvas-ch2');
            this.state = state;
            this.dial = new SpeedDial('dial-ch2', (beta) => {
                this.state.beta = beta;
                this.state.gamma = getGamma(beta);
                document.getElementById('val-ch2-beta').textContent = `${this.state.beta.toFixed(4)} c`;
                document.getElementById('val-ch2-gamma').textContent = this.state.gamma.toFixed(4);

                // Calculate time gap (Delta_t' = -gamma * beta * Delta_x)
                // Delta_x = 10 units (from -5 to +5)
                const gap = -this.state.gamma * this.state.beta * 10;
                document.getElementById('val-ch2-gap').textContent = `${gap.toFixed(2)} s`;
            });
            this.dial.setBeta(this.state.beta);

            // Simulation mode
            this.frame = 'alice'; // 'alice' or 'bob'
            this.simActive = false;
            this.t = 0.0;
            this.wavefronts = [];

            this.btnAlice = document.getElementById('btn-ch2-frame-alice');
            this.btnBob = document.getElementById('btn-ch2-frame-bob');
            this.fireBtn = document.getElementById('btn-ch2-fire');

            this.handlerAlice = () => {
                this.frame = 'alice';
                this.btnAlice.classList.add('active');
                this.btnBob.classList.remove('active');
                // Reset simulation
                this.simActive = false;
                this.t = 0.0;
                this.wavefronts = [];
            };
            this.handlerBob = () => {
                this.frame = 'bob';
                this.btnBob.classList.add('active');
                this.btnAlice.classList.remove('active');
                // Reset simulation
                this.simActive = false;
                this.t = 0.0;
                this.wavefronts = [];
            };
            this.handlerFire = () => {
                this.simActive = true;
                this.t = 0.0;
                this.wavefronts = [];
            };

            this.btnAlice.addEventListener('click', this.handlerAlice);
            this.btnBob.addEventListener('click', this.handlerBob);
            this.fireBtn.addEventListener('click', this.handlerFire);
        },
        tick() {
            if (this.simActive) {
                const dt = 0.05; // speed parameter
                this.t += dt;

                // Let's create the wavefronts
                if (this.wavefronts.length === 0) {
                    if (this.frame === 'alice') {
                        // Ground Frame (Alice): Both fire simultaneously at t = 0
                        this.wavefronts.push({ x: -5.0, tFire: 0.0, fired: true, color: '#00f2fe' });
                        this.wavefronts.push({ x: 5.0, tFire: 0.0, fired: true, color: '#f59e0b' });
                    } else {
                        // Spaceship Frame (Bob): Right fires first, left fires later
                        // The coordinate gap is delta_t' = 10 * gamma * beta
                        // Since beta > 0, right fires at t'=0, left fires at t'=gap
                        const gap = this.state.gamma * Math.abs(this.state.beta) * 10;
                        this.wavefronts.push({ x: 5.0 * this.state.gamma, tFire: 0.0, fired: true, color: '#f59e0b' });
                        this.wavefronts.push({ x: -5.0 * this.state.gamma, tFire: gap, fired: false, color: '#00f2fe' });
                    }
                }

                // Check pending fires for Bob's frame
                this.wavefronts.forEach(w => {
                    if (!w.fired && this.t >= w.tFire) {
                        w.fired = true;
                    }
                });

                if (this.t > 15) {
                    this.simActive = false;
                }
            }
        },
        draw() {
            const ctx = setupCanvas(this.canvas);
            const w = this.canvas.width / (window.devicePixelRatio || 1);
            const h = this.canvas.height / (window.devicePixelRatio || 1);

            ctx.clearRect(0, 0, w, h);

            const cx = w / 2;
            const cy = h / 2;
            const scale = 25; // pixels per light-second

            // Draw axis track
            ctx.strokeStyle = 'rgba(255,255,255,0.06)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(30, cy + 40);
            ctx.lineTo(w - 30, cy + 40);
            ctx.stroke();

            // Set up positions based on observer frame
            if (this.frame === 'alice') {
                // ALICE'S FRAME (Alice at rest, Bob moving)

                // Draw stationary post markers (at x = -5 and x = +5)
                const xl = cx - 5 * scale;
                const xr = cx + 5 * scale;

                ctx.fillStyle = '#4b5563';
                ctx.beginPath();
                ctx.arc(xl, cy + 40, 4, 0, Math.PI*2);
                ctx.arc(xr, cy + 40, 4, 0, Math.PI*2);
                ctx.fill();

                ctx.font = "10px monospace";
                ctx.fillStyle = 'rgba(255,255,255,0.4)';
                ctx.fillText("x=-5 (Post L)", xl - 25, cy + 56);
                ctx.fillText("x=+5 (Post R)", xr - 25, cy + 56);

                // Draw Bob in moving spaceship sliding right relative to ground
                let bobX = cx;
                if (this.simActive || this.t > 0) {
                    bobX = cx + (this.t * this.state.beta * scale);
                }

                ctx.fillStyle = '#ff00dd';
                ctx.beginPath();
                ctx.arc(bobX, cy + 40, 7, 0, Math.PI*2);
                ctx.fill();
                ctx.fillText("Bob (S')", bobX - 10, cy + 24);

                // Draw Alice (stationary at x = 0 midpoint)
                ctx.fillStyle = '#00f2fe';
                ctx.beginPath();
                ctx.arc(cx, cy + 40, 5, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillText("Alice (S)", cx - 12, cy + 12);

                // Draw wavefronts (expanding from fixed ground points xl and xr)
                this.wavefronts.forEach(wf => {
                    if (wf.fired) {
                        const radius = (this.t - wf.tFire) * scale;
                        const wx = cx + wf.x * scale;
                        ctx.strokeStyle = wf.color;
                        ctx.lineWidth = 1.5;
                        ctx.beginPath();
                        ctx.arc(wx, cy + 40, radius, 0, Math.PI*2);
                        ctx.stroke();

                        // Draw center flash
                        if (radius < 20) {
                            ctx.fillStyle = wf.color;
                            ctx.beginPath();
                            ctx.arc(wx, cy + 40, 6, 0, Math.PI*2);
                            ctx.fill();
                        }
                    }
                });

            } else {
                // BOB'S FRAME (Bob at rest in center, ground posts moving left)

                // Bob remains stationary at cx
                ctx.fillStyle = '#ff00dd';
                ctx.beginPath();
                ctx.arc(cx, cy + 40, 7, 0, Math.PI*2);
                ctx.fill();
                ctx.fillText("Bob (S')", cx - 10, cy + 24);

                // Posts L and R move to left at speed beta.
                // Their initial rest positions were -5 and +5, but in Bob's frame they are contracted (spacing is 10/gamma) and moving.
                // At Bob's time t', post coordinate is x'_post(t') = x'_emission - beta * t' ?
                // Let's compute post position relative to the center:
                const shift = this.t * this.state.beta * scale;
                // Position of L post relative to Bob: started at -5*gamma, moving left
                const xl = cx - (5.0 * this.state.gamma) * scale - shift;
                // Position of R post relative to Bob: started at 5*gamma, moving left
                const xr = cx + (5.0 * this.state.gamma) * scale - shift;

                ctx.fillStyle = '#4b5563';
                ctx.beginPath();
                ctx.arc(xl, cy + 40, 4, 0, Math.PI*2);
                ctx.arc(xr, cy + 40, 4, 0, Math.PI*2);
                ctx.fill();

                ctx.font = "10px monospace";
                ctx.fillStyle = 'rgba(255,255,255,0.4)';
                ctx.fillText("Post L", xl - 15, cy + 56);
                ctx.fillText("Post R", xr - 15, cy + 56);

                // Draw Alice (moving left with the ground posts, starts at center)
                const aliceX = cx - shift;
                ctx.fillStyle = '#00f2fe';
                ctx.beginPath();
                ctx.arc(aliceX, cy + 40, 5, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillText("Alice (S)", aliceX - 12, cy + 12);

                // Draw wavefronts
                // In Bob's frame, once light is emitted, it propagates in circular wavefronts
                // centered on the EMISSION POINT in Bob's frame, not the moving source!
                // For Right event: emitted at x' = 5*gamma at t'=0. Center wx = cx + 5*gamma*scale.
                // For Left event: emitted at x' = -5*gamma at t'=gap. Center wx = cx - 5*gamma*scale.
                this.wavefronts.forEach(wf => {
                    if (wf.fired) {
                        const radius = (this.t - wf.tFire) * scale;
                        const wx = cx + wf.x * scale; // centered at the point of emission in S'
                        ctx.strokeStyle = wf.color;
                        ctx.lineWidth = 1.5;
                        ctx.beginPath();
                        ctx.arc(wx, cy + 40, radius, 0, Math.PI*2);
                        ctx.stroke();

                        // Draw center flash
                        if (radius < 20) {
                            ctx.fillStyle = wf.color;
                            ctx.beginPath();
                            ctx.arc(wx, cy + 40, 6, 0, Math.PI*2);
                            ctx.fill();
                        }
                    }
                });
            }
        },
        cleanup() {
            if (this.btnAlice && this.handlerAlice) {
                this.btnAlice.removeEventListener('click', this.handlerAlice);
            }
            if (this.btnBob && this.handlerBob) {
                this.btnBob.removeEventListener('click', this.handlerBob);
            }
            if (this.fireBtn && this.handlerFire) {
                this.fireBtn.removeEventListener('click', this.handlerFire);
            }
        }
    });

// ==========================================================================
// CHAPTER 3 IMPLEMENTATION: Length Contraction & Train/Tunnel Paradox
// ==========================================================================
controller.registerChapter('3', {
    init(state) {
        this.canvas = document.getElementById('canvas-ch3');
        this.state = state;

        // FSM states: 1 = Rest, 2 = Platform Measure, 3 = Train View, 4 = Paradox
        this.step = 1;
        this.frame = 'platform'; // 'platform' or 'train'
        this.p = 0.5; // normalized scrubber progress [0, 1]

        // Speed parameters (L0 is 200m)
        this.L0 = 200;
        this.c = 300; // speed of light in m/us
        this.c_pixel = 150; // speed of light in pixels/us

        // Measurement status (whether the user has clicked "Measure" in Step 2)
        this.measured = false;

        // Bind UI elements
        this.speedSlider = document.getElementById('slider-ch3-beta');
        this.timeScrubber = document.getElementById('scrubber-ch3');
        this.prevBtn = document.getElementById('btn-ch3-prev');
        this.nextBtn = document.getElementById('btn-ch3-next');
        this.measureBtn = document.getElementById('btn-ch3-measure');
        this.framePlatformBtn = document.getElementById('btn-ch3-frame-platform');
        this.frameTrainBtn = document.getElementById('btn-ch3-frame-train');
        this.stepIndicators = document.querySelectorAll('.ch3-step-indicator');

        // Speed slider event
        this.handlerSpeed = (e) => {
            const beta = parseFloat(e.target.value);
            this.state.beta = beta;
            this.state.gamma = getGamma(beta);
            this.updateHUD();
            this.measured = false; // Reset measurement on speed change
        };
        this.speedSlider.addEventListener('input', this.handlerSpeed);

        // Time scrubber event
        this.handlerScrubber = (e) => {
            this.p = parseFloat(e.target.value);
            this.updateTimeLabel();
        };
        this.timeScrubber.addEventListener('input', this.handlerScrubber);

        // Stepper linear buttons
        this.handlerPrev = () => {
            if (this.step > 1) {
                this.changeStep(this.step - 1);
            }
        };
        this.handlerNext = () => {
            if (this.step < 4) {
                this.changeStep(this.step + 1);
            }
        };
        this.prevBtn.addEventListener('click', this.handlerPrev);
        this.nextBtn.addEventListener('click', this.handlerNext);

        // Frame toggle buttons
        this.handlerPlatformFrame = () => {
            this.setFrame('platform');
        };
        this.handlerTrainFrame = () => {
            this.setFrame('train');
        };
        this.framePlatformBtn.addEventListener('click', this.handlerPlatformFrame);
        this.frameTrainBtn.addEventListener('click', this.handlerTrainFrame);

        // Measure button
        this.handlerMeasure = () => {
            this.measured = true;
            // Set scrubber progress to 0.5 (the moment of simultaneous measurement)
            this.p = 0.5;
            this.timeScrubber.value = 0.5;
            this.updateTimeLabel();
        };
        this.measureBtn.addEventListener('click', this.handlerMeasure);

        // Stepper header indicator clicks
        this.stepIndicators.forEach(ind => {
            ind.addEventListener('click', (e) => {
                const s = parseInt(e.target.getAttribute('data-step'));
                this.changeStep(s);
            });
        });

        // Initialize state values
        this.state.beta = parseFloat(this.speedSlider.value);
        this.state.gamma = getGamma(this.state.beta);
        this.updateHUD();
        this.changeStep(1);
    },

    changeStep(s) {
        // Exit current step
        this.exitStep(this.step);

        // Enter new step
        this.step = s;
        this.enterStep(s);

        // Update indicator styles
        this.stepIndicators.forEach(ind => {
            const stepNum = parseInt(ind.getAttribute('data-step'));
            ind.classList.remove('active');
            if (stepNum === s) {
                ind.classList.add('active');
            }
            if (stepNum < s) {
                ind.classList.add('completed');
            } else {
                ind.classList.remove('completed');
            }
        });

        // Enable/disable linear controls
        this.prevBtn.disabled = (s === 1);
        this.nextBtn.disabled = (s === 4);

        // Show/hide prose cards
        for (let i = 1; i <= 4; i++) {
            const card = document.getElementById(`ch3-prose-step-${i}`);
            if (card) {
                card.style.display = (i === s) ? 'block' : 'none';
            }
        }

        // Show/hide quiz
        const quiz = document.getElementById('quiz-form-ch3');
        if (quiz) {
            quiz.style.display = (s === 3 || s === 4) ? 'block' : 'none';
        }

        this.updateHUD();
    },

    enterStep(s) {
        const speedContainer = document.getElementById('ch3-speed-slider-container');
        const scrubberContainer = document.getElementById('ch3-scrubber-container');
        const frameToggleRow = document.getElementById('ch3-frame-toggle-row');
        const measureBtnRow = document.getElementById('ch3-measure-btn-row');
        const calculationsDetails = document.getElementById('ch3-calculations-details');

        const titleEl = document.getElementById('ch3-diagram-title');

        if (s === 1) {
            titleEl.textContent = "Interactive Experiment: Train at Rest";
            speedContainer.style.display = 'none';
            scrubberContainer.style.display = 'none';
            frameToggleRow.style.display = 'none';
            measureBtnRow.style.display = 'none';
            calculationsDetails.style.display = 'none';
            this.frame = 'platform';
            this.p = 0.5;
        } else if (s === 2) {
            titleEl.textContent = "Interactive Experiment: Platform View (Simultaneous Measurement)";
            speedContainer.style.display = 'block';
            scrubberContainer.style.display = 'block';
            frameToggleRow.style.display = 'none';
            measureBtnRow.style.display = 'flex';
            calculationsDetails.style.display = 'block';
            this.frame = 'platform';
            this.p = 0.5; // Start centered
            this.timeScrubber.value = 0.5;
            this.measured = false;
        } else if (s === 3) {
            titleEl.textContent = "Interactive Experiment: Train View (Relativity of Simultaneity)";
            speedContainer.style.display = 'block';
            scrubberContainer.style.display = 'block';
            frameToggleRow.style.display = 'flex';
            measureBtnRow.style.display = 'none';
            calculationsDetails.style.display = 'block';
            // Show train frame by default for step 3 to emphasize the shift
            this.setFrame('train');
        } else if (s === 4) {
            titleEl.textContent = "Interactive Experiment: The Tunnel Paradox";
            speedContainer.style.display = 'block';
            scrubberContainer.style.display = 'block';
            frameToggleRow.style.display = 'flex';
            measureBtnRow.style.display = 'none';
            calculationsDetails.style.display = 'block';
            this.setFrame('platform');
        }

        this.updateTimeLabel();
    },

    exitStep(s) {
        // Cleanup when leaving a step if needed
    },

    setFrame(f) {
        this.frame = f;
        if (f === 'platform') {
            this.framePlatformBtn.classList.add('active');
            this.frameTrainBtn.classList.remove('active');
        } else {
            this.framePlatformBtn.classList.remove('active');
            this.frameTrainBtn.classList.add('active');
        }
        this.updateTimeLabel();
    },

    updateHUD() {
        const beta = this.state.beta || 0.794;
        const gamma = this.state.gamma || 1.644;

        // In step 4, the measured length refers to the tunnel or train depending on frame
        let measuredLenVal = 200 / gamma;

        const gammaEl = document.getElementById('val-ch3-gamma');
        const lenEl = document.getElementById('val-ch3-len');
        const gapEl = document.getElementById('val-ch3-gap');
        const sliderBetaVal = document.getElementById('val-ch3-slider-beta');

        if (gammaEl) gammaEl.textContent = gamma.toFixed(3);
        if (lenEl) lenEl.textContent = `${measuredLenVal.toFixed(1)} m`;
        if (sliderBetaVal) sliderBetaVal.textContent = `${beta.toFixed(3)} c`;

        // Calculations panel values
        const calcGamma = document.getElementById('calc-ch3-gamma');
        const calcLen = document.getElementById('calc-ch3-len');
        const calcGap = document.getElementById('calc-ch3-gap');

        if (calcGamma) calcGamma.textContent = gamma.toFixed(3);
        if (calcLen) calcLen.textContent = `${measuredLenVal.toFixed(1)} m`;

        // Show/hide specific rows in HUD based on step
        const rowGamma = document.getElementById('hud-row-gamma');
        const rowMeasured = document.getElementById('hud-row-measured');
        const rowGap = document.getElementById('hud-row-gap');

        if (rowGamma) rowGamma.style.display = (this.step > 1) ? 'flex' : 'none';
        if (rowMeasured) rowMeasured.style.display = (this.step > 1) ? 'flex' : 'none';

        if (this.step === 4) {
            // Tunnel paradox gap is delta_t' = gamma * beta * L0 / c
            const gap = (gamma * beta * this.L0) / this.c;
            if (gapEl) gapEl.textContent = `${gap.toFixed(2)} \u03bcs`;
            if (calcGap) calcGap.textContent = `${gap.toFixed(2)} \u03bcs`;
            if (rowGap) rowGap.style.display = 'flex';
        } else if (this.step === 3) {
            // Step 3 measurement gap is delta_t' = beta * L0 / c (measurement events spacing is L0/gamma)
            const gap = (beta * this.L0) / this.c;
            if (gapEl) gapEl.textContent = `${gap.toFixed(2)} \u03bcs`;
            if (calcGap) calcGap.textContent = `${gap.toFixed(2)} \u03bcs`;
            if (rowGap) rowGap.style.display = 'flex';
        } else {
            if (rowGap) rowGap.style.display = 'none';
        }

        // Inject calculations ticks
        this.updateTicks();
    },

    getMinMaxTime() {
        const beta = this.state.beta;
        const gamma = this.state.gamma;

        if (this.step === 4) {
            // Paradox step
            if (this.frame === 'platform') {
                return { min: -1.5, max: 1.5 };
            } else {
                // In train frame, events are at t'_front = -gamma * beta * L0 / c and t'_rear = 0
                const t_front = -(gamma * beta * this.L0) / this.c;
                return { min: t_front - 0.5, max: 0.5 };
            }
        } else {
            // Steps 2 and 3
            if (this.frame === 'platform') {
                return { min: -1.5, max: 1.5 };
            } else {
                // In train frame, events are at t'_front = -beta * L0 / c and t'_rear = 0
                const t_front = -(beta * this.L0) / this.c;
                return { min: t_front - 0.5, max: 0.5 };
            }
        }
    },

    updateTimeLabel() {
        const { min, max } = this.getMinMaxTime();
        const t = min + this.p * (max - min);

        const lbl = document.getElementById('lbl-ch3-time');
        const val = document.getElementById('val-ch3-time');

        if (lbl) {
            lbl.textContent = (this.frame === 'platform') ? "Platform Time (t)" : "Train Time (t')";
            lbl.style.color = (this.frame === 'platform') ? "var(--neon-cyan)" : "var(--neon-pink)";
        }
        if (val) {
            val.textContent = `${t.toFixed(2)} \u03bcs`;
            val.style.color = (this.frame === 'platform') ? "var(--neon-cyan)" : "var(--neon-pink)";
        }
    },

    updateTicks() {
        const ticksContainer = document.getElementById('ch3-ticks-container');
        if (!ticksContainer) return;
        ticksContainer.innerHTML = '';

        if (this.step === 1) return;

        const { min, max } = this.getMinMaxTime();
        const beta = this.state.beta;
        const gamma = this.state.gamma;

        if (this.frame === 'platform') {
            // Platform: both events happen at t = 0
            const pct = (0 - min) / (max - min) * 100;
            if (pct >= 0 && pct <= 100) {
                ticksContainer.appendChild(this.createTickElement(pct, "t = 0.00", "var(--neon-cyan)"));
            }
        } else {
            // Train Frame: events are split
            let t_rear = 0;
            let t_front = 0;

            if (this.step === 4) {
                t_front = -(gamma * beta * this.L0) / this.c;
            } else {
                t_front = -(beta * this.L0) / this.c;
            }

            const pctFront = (t_front - min) / (max - min) * 100;
            const pctRear = (t_rear - min) / (max - min) * 100;

            if (pctFront >= 0 && pctFront <= 100) {
                ticksContainer.appendChild(this.createTickElement(pctFront, `t' = ${t_front.toFixed(2)}`, "var(--neon-pink)"));
            }
            if (pctRear >= 0 && pctRear <= 100) {
                ticksContainer.appendChild(this.createTickElement(pctRear, "t' = 0.00", "var(--neon-pink)"));
            }
        }
    },

    createTickElement(pct, label, color) {
        const tick = document.createElement('div');
        tick.className = 'scrubber-tick';
        tick.style.left = `${pct}%`;
        tick.style.background = color;

        const lbl = document.createElement('div');
        lbl.className = 'scrubber-tick-label';
        lbl.style.left = `${pct}%`;
        lbl.style.color = color;
        lbl.textContent = label;

        const frag = document.createDocumentFragment();
        frag.appendChild(tick);
        frag.appendChild(lbl);
        return frag;
    },

    tick() {
        // Since we are using a time scrubber, we do not auto-advance time in tick()
    },

    draw() {
        const canvas = this.canvas;
        const ctx = setupCanvas(canvas);
        const W = canvas.width / (window.devicePixelRatio || 1);
        const H = canvas.height / (window.devicePixelRatio || 1);
        ctx.clearRect(0, 0, W, H);

        const beta = this.state.beta;
        const gamma = this.state.gamma;

        // Vertical coordinates
        const cy = H / 2 - 15;

        // Track visual helpers
        this.drawTrack(ctx, cy, W);

        if (this.step === 1) {
            // STEP 1: Train at Rest
            this.drawRuler(ctx, cy + 45, W);
            // Draw train centered at W/2 = 400
            // Train L0 is 200m, let's map to scale 1.2px/m -> 240px
            this._train(ctx, 400 - 100 * 1.2, 400 + 100 * 1.2, cy, 50, false);

        } else if (this.step === 2) {
            // STEP 2: Platform Frame (Simultaneous measurement of moving train)
            const { min, max } = this.getMinMaxTime();
            const t = min + this.p * (max - min);

            // Spacings and positions
            const L = 200 / gamma;
            const v = beta * this.c_pixel; // pixels/us

            // Train center at t=0 is 400. So train center at t is 400 + v*t
            const trainCenter = 400 + v * t;
            const trainLeft = trainCenter - (L / 2) * 1.2;
            const trainRight = trainCenter + (L / 2) * 1.2;

            // Detectors are at the positions of the train ends at t = 0
            const detLeft = 400 - (L / 2) * 1.2;
            const detRight = 400 + (L / 2) * 1.2;

            // Draw detectors
            this.drawDetector(ctx, detLeft, cy, 75, "Detector A (Rear)", "cyan");
            this.drawDetector(ctx, detRight, cy, 75, "Detector B (Front)", "orange");

            // Draw moving train (contracted)
            this._train(ctx, trainLeft, trainRight, cy, 50, true);

            // Measurement trigger (Flashes trigger at t = 0)
            const flashesActive = this.measured || (t >= 0);

            // Draw vertical flashes if triggered
            if (flashesActive) {
                // Flash A (Cyan)
                this.drawFlash(ctx, detLeft, cy, 75, "cyan", t);
                // Flash B (Orange)
                this.drawFlash(ctx, detRight, cy, 75, "orange", t);

                // Draw measured indicators
                ctx.fillStyle = '#ffffff';
                ctx.font = '10px monospace';
                ctx.fillText(`Measured Length L = ${L.toFixed(1)} m`, 400 - 65, cy - 65);
                ctx.strokeStyle = 'rgba(255,255,255,0.4)';
                ctx.beginPath();
                ctx.moveTo(detLeft, cy - 58);
                ctx.lineTo(detRight, cy - 58);
                ctx.stroke();

                // Arrow ticks
                ctx.beginPath();
                ctx.moveTo(detLeft, cy - 62); ctx.lineTo(detLeft, cy - 54);
                ctx.moveTo(detRight, cy - 62); ctx.lineTo(detRight, cy - 54);
                ctx.stroke();
            }

        } else if (this.step === 3) {
            // STEP 3: Train Frame View (Flashes are non-simultaneous)
            const { min, max } = this.getMinMaxTime();
            const tPrime = min + this.p * (max - min);

            const v = beta * this.c_pixel;
            const t_front = -(beta * this.L0) / this.c; // time of front flash

            // In train frame, train is stationary and centered
            const trainLeft = 400 - 100 * 1.2;
            const trainRight = 400 + 100 * 1.2;

            // Draw stationary train (full length)
            this._train(ctx, trainLeft, trainRight, cy, 50, false);

            if (this.frame === 'platform') {
                // Draw platform perspective (same as step 2)
                const t = tPrime;
                const L = 200 / gamma;
                const tc = 400 + v * t;
                const tl = tc - (L / 2) * 1.2;
                const tr = tc + (L / 2) * 1.2;
                const dl = 400 - (L / 2) * 1.2;
                const dr = 400 + (L / 2) * 1.2;

                ctx.clearRect(0, 0, W, H);
                this.drawTrack(ctx, cy, W);
                this.drawDetector(ctx, dl, cy, 75, "Detector A (Rear)", "cyan");
                this.drawDetector(ctx, dr, cy, 75, "Detector B (Front)", "orange");
                this._train(ctx, tl, tr, cy, 50, true);

                if (t >= 0) {
                    this.drawFlash(ctx, dl, cy, 75, "cyan", t);
                    this.drawFlash(ctx, dr, cy, 75, "orange", t);
                }
            } else {
                // Train frame: detectors/tracks move left
                // Detector A aligns with rear (300) at t' = 0
                const detLeft = (400 - 100 * 1.2) - v * tPrime;
                // Detector B aligns with front (500) at t' = t_front
                const detRight = (400 + 100 * 1.2) - v * (tPrime - t_front);

                // Draw moving detectors
                this.drawDetector(ctx, detLeft, cy, 75, "Detector A (Rear)", "cyan");
                this.drawDetector(ctx, detRight, cy, 75, "Detector B (Front)", "orange");

                // Flashes occur at their respective train coordinate times
                // Front detector B flashes first at t' >= t_front
                if (tPrime >= t_front) {
                    const dt = tPrime - t_front;
                    this.drawFlash(ctx, detRight, cy, 75, "orange", dt);
                }
                // Rear detector A flashes later at t' >= 0
                if (tPrime >= 0) {
                    const dt = tPrime;
                    this.drawFlash(ctx, detLeft, cy, 75, "cyan", dt);
                }

                // Narration overlay in canvas
                ctx.fillStyle = '#ffffff';
                ctx.font = '10px monospace';
                if (tPrime < t_front) {
                    ctx.fillText("Waiting for front flash...", 30, cy + 85);
                } else if (tPrime < 0) {
                    ctx.fillStyle = "var(--neon-pink)";
                    ctx.fillText("\u26a0 Front detector flashed first! Rear still open...", 30, cy + 85);
                } else {
                    ctx.fillStyle = "#a7f3d0";
                    ctx.fillText("\u2713 Rear detector has now flashed. Flashes were NOT simultaneous!", 30, cy + 85);
                }
            }

        } else if (this.step === 4) {
            // STEP 4: Tunnel Paradox
            const { min, max } = this.getMinMaxTime();
            const timeVal = min + this.p * (max - min);

            const v = beta * this.c_pixel;
            const L_train = 200 / gamma;
            const L_tunnel = 200;

            if (this.frame === 'platform') {
                // Platform Frame: Tunnel is stationary (centered at 400), train moves right
                const tunLeft = 400 - 100 * 1.2;
                const tunRight = 400 + 100 * 1.2;

                const tc = 400 + v * timeVal;
                const trLeft = tc - (L_train / 2) * 1.2;
                const trRight = tc + (L_train / 2) * 1.2;

                // Draw tunnel background (interior)
                this._drawTunnelInterior(ctx, tunLeft, tunRight, cy, 70);

                // Draw moving train (contracted, fits easily)
                this._train(ctx, trLeft, trRight, cy, 46, true);

                // Draw tunnel doors (both close simultaneously at t = 0)
                const doorsClosed = timeVal >= 0;
                this._drawTunnelDoors(ctx, tunLeft, tunRight, cy, 70, doorsClosed, doorsClosed);

                ctx.fillStyle = '#ffffff';
                ctx.font = '10px monospace';
                if (doorsClosed) {
                    ctx.fillStyle = "var(--neon-cyan)";
                    ctx.fillText("\u2713 Both doors closed simultaneously at t = 0. Train fits!", 30, cy + 85);
                } else {
                    ctx.fillText("Train (contracted) approaching tunnel doors...", 30, cy + 85);
                }
            } else {
                // Train Frame: Train is stationary, tunnel moves left
                const trainLeft = 400 - 100 * 1.2;
                const trainRight = 400 + 100 * 1.2;

                // Tunnel is contracted to 200/gamma
                const tunLen = 200 / gamma;

                // Rear door event: t' = 0. Front door event: t'_front = -gamma * beta * L0 / c
                const t_front = -(gamma * beta * this.L0) / this.c;

                // Tunnel rear door aligns with train rear (300) at t' = 0
                const tunLeft = 300 - v * timeVal;
                const tunRight = tunLeft + tunLen * 1.2;

                // Draw moving tunnel interior
                this._drawTunnelInterior(ctx, tunLeft, tunRight, cy, 70);

                // Draw stationary train (full length, sticks out)
                this._train(ctx, trainLeft, trainRight, cy, 46, false);

                // Front door closes at t'_front
                const frontClosed = timeVal >= t_front;
                // Rear door closes at t' = 0
                const rearClosed = timeVal >= 0;

                this._drawTunnelDoors(ctx, tunLeft, tunRight, cy, 70, rearClosed, frontClosed);

                ctx.fillStyle = '#ffffff';
                ctx.font = '10px monospace';
                if (timeVal < t_front) {
                    ctx.fillText("Tunnel rushing left toward train...", 30, cy + 85);
                } else if (timeVal < 0) {
                    ctx.fillStyle = "var(--neon-pink)";
                    ctx.fillText("\u26a0 Front door closes first (t' < 0) while train nose exits!", 30, cy + 85);
                } else {
                    ctx.fillStyle = "var(--neon-amber)";
                    ctx.fillText("\u26a0 Rear door closes later (t' = 0) before train tail enters!", 30, cy + 85);
                }
            }
        }

        // Draw measured lines helper
        this.drawLabels(ctx, W, H);
    },

    drawTrack(ctx, cy, W) {
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(10, cy + 32);
        ctx.lineTo(W - 10, cy + 32);
        ctx.stroke();

        for (let x = 20; x < W; x += 15) {
            ctx.fillStyle = 'rgba(255,255,255,0.04)';
            ctx.fillRect(x, cy + 32, 6, 3);
        }
    },

    drawRuler(ctx, y, W) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(400 - 150 * 1.2, y);
        ctx.lineTo(400 + 150 * 1.2, y);
        ctx.stroke();

        for (let m = -120; m <= 120; m += 20) {
            const px = 400 + m * 1.2;
            const h = (m % 100 === 0) ? 12 : ((m % 50 === 0) ? 8 : 5);
            ctx.beginPath();
            ctx.moveTo(px, y);
            ctx.lineTo(px, y - h);
            ctx.stroke();

            if (m % 100 === 0) {
                ctx.fillStyle = 'rgba(255,255,255,0.4)';
                ctx.font = '8px monospace';
                ctx.fillText(`${m}m`, px - 10, y + 10);
            }
        }
    },

    drawDetector(ctx, x, cy, h, label, colorHex) {
        const top = cy - h / 2;
        const bot = cy + h / 2;

        ctx.strokeStyle = `var(--neon-${colorHex})`;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.3;
        ctx.strokeRect(x - 6, top, 12, h);
        ctx.globalAlpha = 1;

        ctx.fillStyle = `var(--neon-${colorHex})`;
        ctx.fillRect(x - 3, top + 2, 6, 6);
        ctx.fillRect(x - 3, bot - 8, 6, 6);

        // Label
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = '8px monospace';
        ctx.fillText(label, x - 30, top - 6);
    },

    drawFlash(ctx, x, cy, h, colorHex, dt) {
        const top = cy - h / 2;
        const bot = cy + h / 2;

        // Pulse animation based on dt
        let opacity = 1;
        if (dt > 0) {
            opacity = Math.max(0, 1 - dt / 0.4); // Fades out over 0.4us
        }

        if (opacity <= 0) return;

        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.shadowBlur = 15;
        ctx.shadowColor = `var(--neon-${colorHex})`;
        ctx.strokeStyle = `var(--neon-${colorHex})`;
        ctx.lineWidth = 3;

        ctx.beginPath();
        ctx.moveTo(x, top - 10);
        ctx.lineTo(x, bot + 10);
        ctx.stroke();

        // Starburst flash center
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x, cy, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    },

    _train(ctx, left, right, cy, h, isContracted) {
        if (right <= left) return;
        const top = cy - h / 2;
        const w = right - left;

        // Sleek gunmetal train body
        ctx.fillStyle = '#2d3748';
        ctx.fillRect(left, top, w, h);

        // Accent stripe
        ctx.fillStyle = 'var(--neon-cyan)';
        ctx.fillRect(left, top + h - 5, w, 3);

        // Cabin windows
        const nCars = 6;
        const carW = w / nCars;
        ctx.fillStyle = '#0f172a';
        for (let i = 0; i < nCars; i++) {
            ctx.fillRect(left + i * carW + 4, top + 6, carW - 8, h / 2 - 4);
        }

        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1;
        ctx.strokeRect(left, top, w, h);

        // Nose slope (moving right)
        ctx.fillStyle = '#2d3748';
        ctx.beginPath();
        ctx.moveTo(right, top);
        ctx.lineTo(right + 12, cy);
        ctx.lineTo(right, top + h);
        ctx.fill();
        ctx.stroke();

        // Train label
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '8px monospace';
        const label = isContracted ? "TRAIN (contracted)" : "TRAIN (rest L0)";
        ctx.fillText(label, left + 4, top - 4);
    },

    _drawTunnelInterior(ctx, left, right, cy, h) {
        const top = cy - h / 2;
        const w = right - left;

        ctx.fillStyle = 'rgba(15, 17, 26, 0.9)';
        ctx.fillRect(left, top, w, h);

        // Hatching interior walls
        ctx.strokeStyle = 'rgba(255,255,255,0.03)';
        ctx.lineWidth = 1;
        for (let x = left + 10; x < right; x += 15) {
            ctx.beginPath();
            ctx.moveTo(x, top);
            ctx.lineTo(x + 5, top + h);
            ctx.stroke();
        }
    },

    _drawTunnelDoors(ctx, left, right, cy, h, rearClosed, frontClosed) {
        const top = cy - h / 2;
        const bot = cy + h / 2;

        // Draw arch border
        ctx.strokeStyle = '#4a5568';
        ctx.lineWidth = 3;
        ctx.strokeRect(left, top, right - left, h);

        // Rear gate (left)
        ctx.strokeStyle = rearClosed ? "var(--neon-cyan)" : "rgba(255,255,255,0.15)";
        ctx.lineWidth = rearClosed ? 4 : 1.5;
        ctx.beginPath();
        ctx.moveTo(left, top - 8);
        ctx.lineTo(left, bot + 8);
        ctx.stroke();
        if (rearClosed) {
            this.drawDoorGlow(ctx, left, top - 8, bot + 8, "cyan");
        }

        // Front gate (right)
        ctx.strokeStyle = frontClosed ? "var(--neon-orange)" : "rgba(255,255,255,0.15)";
        ctx.lineWidth = frontClosed ? 4 : 1.5;
        ctx.beginPath();
        ctx.moveTo(right, top - 8);
        ctx.lineTo(right, bot + 8);
        ctx.stroke();
        if (frontClosed) {
            this.drawDoorGlow(ctx, right, top - 8, bot + 8, "orange");
        }
    },

    drawDoorGlow(ctx, x, y1, y2, colorHex) {
        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = `var(--neon-${colorHex})`;
        ctx.strokeStyle = `var(--neon-${colorHex})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, y1);
        ctx.lineTo(x, y2);
        ctx.stroke();
        ctx.restore();
    },

    drawLabels(ctx, W, H) {
        // Overlay current frame label
        ctx.fillStyle = (this.frame === 'platform') ? "rgba(0, 242, 254, 0.8)" : "rgba(255, 0, 221, 0.8)";
        ctx.font = 'bold 11px monospace';
        const txt = (this.frame === 'platform') ? "\uD83D\uDC41 PLATFORM FRAME (Alice's View)" : "\uD83D\uDC41 TRAIN FRAME (Bob's View)";
        ctx.fillText(txt, 20, 24);
    },

    cleanup() {
        // Remove event listeners
        if (this.speedSlider) this.speedSlider.removeEventListener('input', this.handlerSpeed);
        if (this.timeScrubber) this.timeScrubber.removeEventListener('input', this.handlerScrubber);
        if (this.prevBtn) this.prevBtn.removeEventListener('click', this.handlerPrev);
        if (this.nextBtn) this.nextBtn.removeEventListener('click', this.handlerNext);
        if (this.framePlatformBtn) this.framePlatformBtn.removeEventListener('click', this.handlerPlatformFrame);
        if (this.frameTrainBtn) this.frameTrainBtn.removeEventListener('click', this.handlerTrainFrame);
        if (this.measureBtn) this.measureBtn.removeEventListener('click', this.handlerMeasure);
    }
});

        // ==========================================================================
    // CHAPTER 4 IMPLEMENTATION: Time dilation
    // ==========================================================================
    controller.registerChapter('4', {
        init(state) {
            this.canvas = document.getElementById('canvas-ch4');
            this.state = state;

            this.dial = new SpeedDial('dial-ch4', (beta) => {
                this.state.beta = beta;
                this.state.gamma = getGamma(beta);
                document.getElementById('val-ch4-beta').textContent = `${this.state.beta.toFixed(4)} c`;
                document.getElementById('val-ch4-gamma').textContent = this.state.gamma.toFixed(4);
            });
            this.dial.setBeta(this.state.beta);

            this.earthTime = 0.0;
            this.rocketTime = 0.0;
            this.isPlaying = false;
            this.lastFrameTime = null;

            this.playBtn = document.getElementById('btn-ch4-play');
            this.boostBtn = document.getElementById('btn-ch4-boost');
            this.resetBtn = document.getElementById('btn-ch4-reset');

            this.handlerPlay = () => {
                this.isPlaying = !this.isPlaying;
                this.playBtn.textContent = this.isPlaying ? "Pause" : "Play";
                this.lastFrameTime = performance.now();
            };
            this.handlerBoost = () => {
                // Animate boost to beta = 0.866
                this.state.beta = 0.866;
                this.state.gamma = getGamma(0.866);
                this.dial.setBeta(0.866);
                document.getElementById('val-ch4-beta').textContent = `${this.state.beta.toFixed(4)} c`;
                document.getElementById('val-ch4-gamma').textContent = this.state.gamma.toFixed(4);
            };
            this.handlerReset = () => {
                this.earthTime = 0.0;
                this.rocketTime = 0.0;
                this.isPlaying = false;
                this.playBtn.textContent = "Play";
                document.getElementById('val-ch4-earth-time').textContent = "0.000 s";
                document.getElementById('val-ch4-rocket-time').textContent = "0.000 s";
            };

            this.playBtn.addEventListener('click', this.handlerPlay);
            this.boostBtn.addEventListener('click', this.handlerBoost);
            this.resetBtn.addEventListener('click', this.handlerReset);
        },
        tick(timestamp) {
            if (this.isPlaying) {
                if (!this.lastFrameTime) this.lastFrameTime = timestamp;
                const dt = Math.min(0.05, (timestamp - this.lastFrameTime) / 1000.0) * 1.5; // multiplier
                this.lastFrameTime = timestamp;

                // Earth advances coordinate time at full rate
                this.earthTime += dt;

                // Rocket advances proper time at reduced rate (1 / gamma)
                this.rocketTime += dt / this.state.gamma;

                document.getElementById('val-ch4-earth-time').textContent = `${this.earthTime.toFixed(3)} s`;
                document.getElementById('val-ch4-rocket-time').textContent = `${this.rocketTime.toFixed(3)} s`;
            }
        },
        draw() {
            const ctx = setupCanvas(this.canvas);
            const w = this.canvas.width / (window.devicePixelRatio || 1);
            const h = this.canvas.height / (window.devicePixelRatio || 1);

            ctx.clearRect(0, 0, w, h);

            const cy = h / 2 - 10;
            const r = 50;

            // Draw Earth Clock
            drawClockFace(ctx, w / 4, cy, r, this.earthTime, "Earth Clock (Rest)", 1.0);

            // Draw Rocket Clock
            drawClockFace(ctx, (3 * w) / 4, cy, r, this.rocketTime, "Rocket Clock (Moving)", 1.0 / this.state.gamma);
        },
        cleanup() {
            if (this.playBtn) this.playBtn.removeEventListener('click', this.handlerPlay);
            if (this.boostBtn) this.boostBtn.removeEventListener('click', this.handlerBoost);
            if (this.resetBtn) this.resetBtn.removeEventListener('click', this.handlerReset);
        }
    });

    // ==========================================================================
    // CHAPTER 5 IMPLEMENTATION: Relativistic Doppler & Aberration
    // ==========================================================================
    controller.registerChapter('5', {
        init(state) {
            this.canvas = document.getElementById('canvas-ch5');
            this.state = state;
            this.transverseMode = false;

            this.dial = new SpeedDial('dial-ch5', (beta) => {
                this.state.beta = beta;
                this.state.gamma = getGamma(beta);
                document.getElementById('val-ch5-beta').textContent = `${this.state.beta.toFixed(4)} c`;

                // Relativistic Wavelength calculation
                // Approaching: lambda = lambda0 * sqrt((1-beta)/(1+beta))
                // Note: beta > 0 receding, beta < 0 approaching
                const lambda0 = 550; // green
                let lambdaObs = lambda0;

                if (this.transverseMode) {
                    lambdaObs = lambda0 * this.state.gamma; // purely redshifted by gamma
                } else {
                    lambdaObs = lambda0 * Math.sqrt((1 + this.state.beta) / (1 - this.state.beta));
                }

                document.getElementById('val-ch5-lambda').textContent = `${Math.round(lambdaObs)} nm`;
            });
            this.dial.setBeta(this.state.beta);

            // Generate starfield angles
            this.stars = [];
            for (let i = 0; i < 80; i++) {
                this.stars.push({
                    theta: Math.random() * Math.PI * 2,
                    r: Math.random() * 80 + 30
                });
            }

            this.transverseBtn = document.getElementById('btn-ch5-transverse');
            this.handlerTransverse = () => {
                this.transverseMode = !this.transverseMode;
                this.transverseBtn.classList.toggle('active', this.transverseMode);
                this.dial.onChange(this.state.beta);
            };
            this.transverseBtn.addEventListener('click', this.handlerTransverse);
        },
        tick() {
            // Static perspective, visual coordinates warp depending on beta dial instantly
        },
        draw() {
            const ctx = setupCanvas(this.canvas);
            const w = this.canvas.width / (window.devicePixelRatio || 1);
            const h = this.canvas.height / (window.devicePixelRatio || 1);

            ctx.clearRect(0, 0, w, h);

            const cx = w / 2;
            const cy = h / 2;

            // Draw radial star glow
            const lambda0 = 550;
            let lambdaObs = lambda0;
            if (this.transverseMode) {
                lambdaObs = lambda0 * this.state.gamma;
            } else {
                lambdaObs = lambda0 * Math.sqrt((1 + this.state.beta) / (1 - this.state.beta));
            }

            const { r, g, b } = wavelengthToRGB(lambdaObs);

            // Draw starfield with aberration warp
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            this.stars.forEach(star => {
                // Apply aberration
                // If beta > 0, we move away from front, stars compress to rear.
                // Symmetrical aberration check
                const thetaPrime = aberratedAngle(star.theta, this.state.beta);
                const sx = cx + star.r * Math.cos(thetaPrime);
                const sy = cy + star.r * Math.sin(thetaPrime);

                ctx.beginPath();
                ctx.arc(sx, sy, 1.2, 0, Math.PI*2);
                ctx.fill();
            });

            // Glowing central star representing source
            const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 32);
            grad.addColorStop(0, `rgb(${r},${g},${b})`);
            grad.addColorStop(0.4, `rgba(${r},${g},${b},0.6)`);
            grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(cx, cy, 32, 0, Math.PI*2);
            ctx.fill();

            // Spectrum Bar indicator at bottom
            const barY = h - 25;
            const barW = w - 60;
            const barX = 30;

            for (let x = 0; x < barW; x++) {
                const fraction = x / barW;
                const wl = 380 + fraction * 320; // 380nm to 700nm
                const cRGB = wavelengthToRGB(wl);
                ctx.fillStyle = `rgb(${cRGB.r},${cRGB.g},${cRGB.b})`;
                ctx.fillRect(barX + x, barY, 1, 10);
            }

            // Draw observed wavelength indicator arrow on spectrum bar
            if (lambdaObs >= 380 && lambdaObs <= 700) {
                const arrowX = barX + ((lambdaObs - 380) / 320) * barW;
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.moveTo(arrowX, barY - 2);
                ctx.lineTo(arrowX - 4, barY - 8);
                ctx.lineTo(arrowX + 4, barY - 8);
                ctx.fill();
            }
        },
        cleanup() {
            if (this.transverseBtn) this.transverseBtn.removeEventListener('click', this.handlerTransverse);
        }
    });

// ==========================================================================
// CHAPTER 6 IMPLEMENTATION: The Twin Paradox Overhaul
// ==========================================================================
controller.registerChapter('6', {
    init(state) {
        this.canvas = document.getElementById('canvas-ch6');
        this.state = state;

        // Sliders
        this.slideBeta1 = document.getElementById('slide-ch6-beta1');
        this.slideBeta2 = document.getElementById('slide-ch6-beta2');
        this.slideDur = document.getElementById('slide-ch6-dur');

        this.outboundBeta = parseFloat(this.slideBeta1.value);
        this.inboundBeta = parseFloat(this.slideBeta2.value);
        this.journeyTime = parseFloat(this.slideDur.value);

        this.simState = 'idle'; // 'idle', 'running', 'paused_turnaround', 'finished'
        this.t = 0.0;
        this.aliceAge = 0.0;
        this.bobAge = 0.0;
        this.lastFrameTime = null;
        this.freezeAtTurnaround = false;

        // Timer for turnaround banner overlay
        this.turnaroundFlashTimer = 0.0;

        // Pre-compute 40 static star coordinates for top panel background
        this.stars = [];
        for (let i = 0; i < 40; i++) {
            this.stars.push({
                x: Math.random(),
                y: Math.random() * 200 + 15,
                size: Math.random() * 0.8 + 0.4,
                alpha: Math.random() * 0.6 + 0.3
            });
        }

        this.handlerBeta1 = () => {
            this.outboundBeta = parseFloat(this.slideBeta1.value);
            document.getElementById('val-ch6-beta1').textContent = `${this.outboundBeta.toFixed(2)}c`;
            this.updateReadouts();
        };
        this.handlerBeta2 = () => {
            this.inboundBeta = parseFloat(this.slideBeta2.value);
            document.getElementById('val-ch6-beta2').textContent = `${this.inboundBeta.toFixed(2)}c`;
            this.updateReadouts();
        };
        this.handlerDur = () => {
            this.journeyTime = parseFloat(this.slideDur.value);
            document.getElementById('val-ch6-dur').textContent = `${this.journeyTime.toFixed(0)} yrs`;
            this.updateReadouts();
        };

        this.slideBeta1.addEventListener('input', this.handlerBeta1);
        this.slideBeta2.addEventListener('input', this.handlerBeta2);
        this.slideDur.addEventListener('input', this.handlerDur);

        this.launchBtn = document.getElementById('btn-ch6-launch');
        this.freezeBtn = document.getElementById('btn-ch6-freeze');
        this.resetBtn = document.getElementById('btn-ch6-reset');

        this.handlerLaunch = () => {
            if (this.simState === 'paused_turnaround') {
                this.simState = 'running';
                this.lastFrameTime = performance.now();
            } else {
                this.simState = 'running';
                this.t = 0.0;
                this.aliceAge = 0.0;
                this.bobAge = 0.0;
                this.turnaroundFlashTimer = 0.0;
                this.lastFrameTime = performance.now();
            }
        };
        this.handlerFreeze = () => {
            this.freezeAtTurnaround = !this.freezeAtTurnaround;
            this.freezeBtn.classList.toggle('active', this.freezeAtTurnaround);
        };
        this.handlerReset = () => {
            this.simState = 'idle';
            this.t = 0.0;
            this.aliceAge = 0.0;
            this.bobAge = 0.0;
            this.turnaroundFlashTimer = 0.0;
            this.updateReadouts();
        };

        this.launchBtn.addEventListener('click', this.handlerLaunch);
        this.freezeBtn.addEventListener('click', this.handlerFreeze);
        this.resetBtn.addEventListener('click', this.handlerReset);

        this.updateReadouts();
    },

    updateReadouts() {
        const T = this.journeyTime;
        const tAlice = T;
        const g1 = getGamma(this.outboundBeta);
        const g2 = getGamma(this.inboundBeta);
        const tBob = (T / 2) / g1 + (T / 2) / g2;

        document.getElementById('val-ch6-alice').textContent = `${tAlice.toFixed(1)} yrs`;
        document.getElementById('val-ch6-bob').textContent = `${tBob.toFixed(1)} yrs`;
        document.getElementById('val-ch6-diff').textContent = `${(tAlice - tBob).toFixed(1)} yrs`;
    },

    tick(timestamp) {
        if (this.simState === 'paused_turnaround') {
            if (!this.lastFrameTime) this.lastFrameTime = timestamp;
            const dt_real = (timestamp - this.lastFrameTime) / 1000.0;
            this.lastFrameTime = timestamp;

            if (this.turnaroundFlashTimer > 0) {
                this.turnaroundFlashTimer -= dt_real;
                if (this.turnaroundFlashTimer <= 0) {
                    this.turnaroundFlashTimer = 0;
                    this.simState = 'running';
                }
            }
        } else if (this.simState === 'running') {
            if (!this.lastFrameTime) this.lastFrameTime = timestamp;
            let dt = Math.min(0.05, (timestamp - this.lastFrameTime) / 1000.0) * 8.0; // Speed factor
            this.lastFrameTime = timestamp;

            const aliceAgeStart = this.aliceAge;
            const MAX_PHYSICS_STEP = 0.02;

            while (dt > 0) {
                const step = Math.min(dt, MAX_PHYSICS_STEP);
                this.aliceAge += step;

                const halfTime = this.journeyTime / 2;
                let currentBeta = (this.aliceAge < halfTime) ? this.outboundBeta : this.inboundBeta;
                const g = getGamma(currentBeta);
                this.bobAge += step / g;

                dt -= step;
            }

            const halfTime = this.journeyTime / 2;
            if (this.freezeAtTurnaround && aliceAgeStart < halfTime && this.aliceAge >= halfTime) {
                this.simState = 'paused_turnaround';
                this.aliceAge = halfTime;
                this.bobAge = halfTime / getGamma(this.outboundBeta);
                this.turnaroundFlashTimer = 1.0; // 1 second flash pause
            }

            if (this.aliceAge >= this.journeyTime) {
                this.simState = 'finished';
                this.aliceAge = this.journeyTime;
                const g1 = getGamma(this.outboundBeta);
                const g2 = getGamma(this.inboundBeta);
                this.bobAge = (this.journeyTime / 2) / g1 + (this.journeyTime / 2) / g2;
            }

            document.getElementById('val-ch6-alice').textContent = `${this.aliceAge.toFixed(1)} yrs`;
            document.getElementById('val-ch6-bob').textContent = `${this.bobAge.toFixed(1)} yrs`;
            document.getElementById('val-ch6-diff').textContent = `${(this.aliceAge - this.bobAge).toFixed(1)} yrs`;
        } else {
            this.lastFrameTime = timestamp;
        }
    },

    draw() {
        const ctx = setupCanvas(this.canvas);
        const w = this.canvas.width / (window.devicePixelRatio || 1);
        const h = this.canvas.height / (window.devicePixelRatio || 1);

        ctx.clearRect(0, 0, w, h);

        const topH = 280;
        const botH = 220;

        // Draw panels with clipping boxes
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, w, topH);
        ctx.clip();
        this.drawTopPanel(ctx, w, topH);
        ctx.restore();

        ctx.save();
        ctx.beginPath();
        ctx.rect(0, topH, w, botH);
        ctx.clip();
        this.drawBottomPanel(ctx, w, botH, topH);
        ctx.restore();

        // Draw dividing line between top and bottom panels
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, topH);
        ctx.lineTo(w, topH);
        ctx.stroke();
    },

    drawTopPanel(ctx, w, h) {
        // Deep space background
        ctx.fillStyle = '#020205';
        ctx.fillRect(0, 0, w, h);

        // Gradient Earth atmosphere on left
        const earthGrad = ctx.createLinearGradient(0, 0, 110, 0);
        earthGrad.addColorStop(0, '#0f172a');
        earthGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
        ctx.fillStyle = earthGrad;
        ctx.fillRect(0, 0, 110, h);

        // Pre-computed stars background
        ctx.fillStyle = '#ffffff';
        this.stars.forEach(star => {
            ctx.save();
            ctx.globalAlpha = star.alpha;
            ctx.beginPath();
            ctx.arc(star.x * w, star.y, star.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });

        const cy = h / 2 - 20;
        const earthX = 80;
        const halfTime = this.journeyTime / 2;

        // Calculate Bob's current spatial position aligned with Minkowski coordinate x
        const d = Math.max(0.1, this.outboundBeta * halfTime);
        const maxDrawWidth = w - 160;
        const scaleX = maxDrawWidth / d;

        let x_space = 0;
        if (this.aliceAge <= halfTime) {
            x_space = this.outboundBeta * this.aliceAge;
        } else {
            x_space = d - this.inboundBeta * (this.aliceAge - halfTime);
        }

        const bx = earthX + x_space * scaleX;
        const turnaroundX = earthX + d * scaleX;

        // Draw turnaround vertical indicator line
        ctx.strokeStyle = 'rgba(245,158,11,0.15)';
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(turnaroundX, 10);
        ctx.lineTo(turnaroundX, h - 10);
        ctx.stroke();
        ctx.setLineDash([]);

        // Label for Turnaround Line
        ctx.fillStyle = 'rgba(245,158,11,0.5)';
        ctx.font = '8px monospace';
        ctx.fillText(`Turnaround Star: ${d.toFixed(1)} ly`, turnaroundX - 45, 18);

        // Draw Earth silhouette
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(0, cy, 75, -Math.PI / 2, Math.PI / 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 242, 254, 0.2)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw Alice (Earth twin)
        this.drawAliceFigure(ctx, earthX, cy, this.aliceAge, this.journeyTime);

        // Draw Bob's Rocket
        const facingRight = (this.aliceAge <= halfTime);
        this.drawBobRocket(ctx, bx, cy, this.bobAge, this.journeyTime, facingRight, x_space);

        // Draw Turnaround Radial Burst Flash
        if (this.simState === 'paused_turnaround' && this.turnaroundFlashTimer > 0) {
            const radius = (1.0 - this.turnaroundFlashTimer) * 120 + 10;
            const alpha = this.turnaroundFlashTimer;
            ctx.save();
            ctx.globalAlpha = alpha;
            const radialGrad = ctx.createRadialGradient(bx, cy, 0, bx, cy, radius);
            radialGrad.addColorStop(0, '#ffffff');
            radialGrad.addColorStop(0.3, 'rgba(245, 158, 11, 0.8)');
            radialGrad.addColorStop(1, 'rgba(255, 0, 221, 0)');
            ctx.fillStyle = radialGrad;
            ctx.beginPath();
            ctx.arc(bx, cy, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // Overlay banner
            ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
            ctx.fillRect(w / 2 - 160, h - 35, 320, 25);
            ctx.strokeStyle = 'var(--neon-amber)';
            ctx.lineWidth = 1;
            ctx.strokeRect(w / 2 - 160, h - 35, 320, 25);

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 9px monospace';
            ctx.fillText("\u26a0 Bob switches frames \u2014 simultaneity shifts!", w / 2 - 128, h - 19);
        }

        // Overlay labels in top-left
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = 'bold 10px monospace';
        ctx.fillText("\uD83D\uDC41 PHYSICAL TIMELINE (Alice's Inertial Frame)", 20, 24);
    },

    drawBottomPanel(ctx, w, h, panelY) {
        ctx.fillStyle = '#050508';
        ctx.fillRect(0, panelY, w, h);

        const bottomMargin = 30;
        const topMargin = 20;
        const originX = 80;
        const originY = panelY + h - bottomMargin;
        const maxDiagramH = h - bottomMargin - topMargin;
        const halfTime = this.journeyTime / 2;

        const d = Math.max(0.1, this.outboundBeta * halfTime);
        const maxDrawWidth = w - 160;
        const scaleX = maxDrawWidth / d;
        const scaleY = maxDiagramH / this.journeyTime;

        // Draw Spacetime Grid lines
        ctx.strokeStyle = 'rgba(255,255,255,0.02)';
        ctx.lineWidth = 1;
        for (let x_val = 0; x_val <= d; x_val += d / 5) {
            const gridX = originX + x_val * scaleX;
            ctx.beginPath();
            ctx.moveTo(gridX, originY);
            ctx.lineTo(gridX, originY - maxDiagramH);
            ctx.stroke();
        }
        for (let t_val = 0; t_val <= this.journeyTime; t_val += this.journeyTime / 5) {
            const gridY = originY - t_val * scaleY;
            ctx.beginPath();
            ctx.moveTo(originX, gridY);
            ctx.lineTo(originX + maxDrawWidth, gridY);
            ctx.stroke();
        }

        // Draw Minkowski Axes
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1.5;
        // x-axis
        ctx.beginPath();
        ctx.moveTo(originX, originY);
        ctx.lineTo(w - 60, originY);
        ctx.stroke();
        // t-axis
        ctx.beginPath();
        ctx.moveTo(originX, originY);
        ctx.lineTo(originX, originY - maxDiagramH - 10);
        ctx.stroke();

        // Labels
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '8px monospace';
        ctx.fillText("x (light-years)", w - 50, originY + 12);
        ctx.fillText("t (years)", originX - 45, originY - maxDiagramH - 4);

        // Current Coordinate Time Sweep Line
        const sweepY = originY - this.aliceAge * scaleY;
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        ctx.moveTo(originX, sweepY);
        ctx.lineTo(originX + maxDrawWidth, sweepY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Label current coordinate time
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillText(`t = ${this.aliceAge.toFixed(1)} yrs`, w - 110, sweepY - 4);

        // Draw Alice's Worldline (Cyan, Vertical)
        ctx.strokeStyle = 'var(--neon-cyan)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(originX, originY);
        ctx.lineTo(originX, sweepY);
        ctx.stroke();

        // Draw Alice's Proper Time Tick Marks (every 5 years)
        ctx.fillStyle = '#020205';
        ctx.strokeStyle = 'var(--neon-cyan)';
        ctx.lineWidth = 1.5;
        for (let t_val = 5; t_val <= this.aliceAge; t_val += 5) {
            const ty = originY - t_val * scaleY;
            ctx.beginPath();
            ctx.arc(originX, ty, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.fillText(`${t_val}`, originX - 16, ty + 3);
            ctx.fillStyle = '#020205';
        }

        // Draw Bob's Worldline (Pink, V-shape)
        ctx.strokeStyle = 'var(--neon-pink)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(originX, originY);

        const turnT = halfTime;
        const turnY = originY - turnT * scaleY;
        const turnX = originX + d * scaleX;

        if (this.aliceAge <= turnT) {
            // Outbound only
            ctx.lineTo(originX + (this.outboundBeta * this.aliceAge) * scaleX, sweepY);
            ctx.stroke();
        } else {
            // Outbound + Inbound
            ctx.lineTo(turnX, turnY);
            const retX_space = d - this.inboundBeta * (this.aliceAge - turnT);
            ctx.lineTo(originX + retX_space * scaleX, sweepY);
            ctx.stroke();
        }

        // Draw Bob's Proper Time Ticks (spaced by 5 proper years along path)
        // Outbound proper time ticks
        ctx.lineWidth = 1.5;
        const g1 = getGamma(this.outboundBeta);
        const g2 = getGamma(this.inboundBeta);

        for (let tau_val = 5; tau_val <= this.bobAge; tau_val += 5) {
            let tickX = originX;
            let tickY = originY;

            // Check if tick falls on outbound or inbound leg
            const outboundMaxTau = turnT / g1;
            if (tau_val <= outboundMaxTau) {
                const coordT = tau_val * g1;
                const coordX = this.outboundBeta * coordT;
                tickX = originX + coordX * scaleX;
                tickY = originY - coordT * scaleY;
            } else {
                const inboundTau = tau_val - outboundMaxTau;
                const coordT = turnT + inboundTau * g2;
                const coordX = d - this.inboundBeta * (coordT - turnT);
                tickX = originX + coordX * scaleX;
                tickY = originY - coordT * scaleY;
            }

            if (tickY >= sweepY) {
                ctx.fillStyle = '#020205';
                ctx.strokeStyle = 'var(--neon-pink)';
                ctx.beginPath();
                ctx.arc(tickX, tickY, 3, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();

                ctx.fillStyle = 'rgba(255,255,255,0.4)';
                ctx.fillText(`\u03c4=${tau_val}`, tickX + 8, tickY + 3);
            }
        }

        // Simultaneously sweeps & unobserved gap bracket at Turnaround
        if (this.simState === 'paused_turnaround' || this.aliceAge > turnT) {
            // Draw planes of simultaneity
            const slopeOut = this.outboundBeta;
            const slopeIn = -this.inboundBeta;

            // Outbound simultaneity line passing through turnaround (turnX, turnY)
            // Intercept at x = 0 is t = T/2 - beta1 * d / c
            const t_out_int = turnT - slopeOut * d;
            const y_out_int = originY - t_out_int * scaleY;

            // Inbound simultaneity line passing through turnaround (turnX, turnY)
            // Intercept at x = 0 is t = T/2 + beta2 * d / c
            const t_in_int = turnT + slopeIn * d * (-1); // since return direction is negative
            const y_in_int = originY - t_in_int * scaleY;

            ctx.save();
            ctx.setLineDash([2, 2]);
            ctx.lineWidth = 1;

            // Outbound sweep line (yellow)
            ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
            ctx.beginPath();
            ctx.moveTo(turnX, turnY);
            ctx.lineTo(originX, y_out_int);
            ctx.stroke();

            // Inbound sweep line (pink)
            ctx.strokeStyle = 'rgba(255, 0, 221, 0.4)';
            ctx.beginPath();
            ctx.moveTo(turnX, turnY);
            ctx.lineTo(originX, y_in_int);
            ctx.stroke();

            // Draw yellow highlight bracket for the gap on Alice's y-axis
            ctx.restore();
            ctx.fillStyle = 'rgba(245, 158, 11, 0.1)';
            ctx.fillRect(originX - 4, y_in_int, 8, y_out_int - y_in_int);

            ctx.strokeStyle = 'var(--neon-amber)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(originX - 8, y_in_int);
            ctx.lineTo(originX - 5, y_in_int);
            ctx.lineTo(originX - 5, y_out_int);
            ctx.lineTo(originX - 8, y_out_int);
            ctx.stroke();

            ctx.fillStyle = 'var(--neon-amber)';
            ctx.font = '7.5px monospace';
            const gap = t_in_int - t_out_int;
            ctx.fillText(`Unseen by Bob: ${gap.toFixed(1)} yrs`, originX + 10, (y_out_int + y_in_int) / 2 + 3);
        }

        // Shaded region inside the loop at finished state
        if (this.simState === 'finished') {
            ctx.fillStyle = 'rgba(255, 0, 221, 0.03)';
            ctx.beginPath();
            ctx.moveTo(originX, originY);
            ctx.lineTo(turnX, turnY);
            ctx.lineTo(originX + (d - this.inboundBeta * (this.journeyTime - turnT)) * scaleX, originY - this.journeyTime * scaleY);
            ctx.lineTo(originX, originY - this.journeyTime * scaleY);
            ctx.closePath();
            ctx.fill();
        }

        // Overlay labels in bottom-left
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = 'bold 10px monospace';
        ctx.fillText("\uD83D\uDCC8 MINKOWSKI SPACETIME DIAGRAM (2D Grid)", 20, panelY + 24);
    },

    drawAnalogClock(ctx, cx, cy, r, tau, tauMax, colorHex) {
        ctx.save();

        // Glow effect
        ctx.shadowBlur = 8;
        ctx.shadowColor = `var(--neon-${colorHex})`;
        ctx.strokeStyle = `var(--neon-${colorHex})`;
        ctx.lineWidth = 2;

        // Clock Rim
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
        ctx.save();

        // Dark clock center
        ctx.fillStyle = '#050508';
        ctx.beginPath();
        ctx.arc(cx, cy, r - 2, 0, Math.PI * 2);
        ctx.fill();

        // Hour Hand
        const angle = (tau / tauMax) * Math.PI * 2 * 3 - Math.PI / 2; // Ticks faster for effect
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(angle) * (r - 7), cy + Math.sin(angle) * (r - 7));
        ctx.stroke();

        // Pin center
        ctx.fillStyle = `var(--neon-${colorHex})`;
        ctx.beginPath();
        ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    },

    drawAliceFigure(ctx, x, y, tau, tauMax) {
        ctx.save();
        ctx.strokeStyle = 'var(--neon-cyan)';
        ctx.lineWidth = 2;

        // Stick figure Alice
        // Head
        ctx.beginPath();
        ctx.arc(x, y - 20, 6, 0, Math.PI * 2);
        ctx.stroke();

        // Torso
        ctx.beginPath();
        ctx.moveTo(x, y - 14);
        ctx.lineTo(x, y);
        ctx.stroke();

        // Arms
        ctx.beginPath();
        ctx.moveTo(x - 12, y - 8);
        ctx.lineTo(x + 12, y - 8);
        ctx.stroke();

        // Legs
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 8, y + 12);
        ctx.moveTo(x, y);
        ctx.lineTo(x + 8, y + 12);
        ctx.stroke();

        ctx.restore();

        // Label
        ctx.fillStyle = '#ffffff';
        ctx.font = '9px monospace';
        ctx.fillText("Alice", x - 12, y - 32);

        // Analog Clock
        const clockY = y + 36;
        this.drawAnalogClock(ctx, x, clockY, 20, tau, tauMax, "cyan");

        // Digital counter
        ctx.fillStyle = 'var(--neon-cyan)';
        ctx.font = 'bold 8.5px monospace';
        ctx.fillText(`${tau.toFixed(1)} yrs`, x - 20, clockY + 34);
    },

    drawBobRocket(ctx, x, y, tau, tauMax, facingRight, x_space) {
        ctx.save();
        ctx.translate(x, y);

        // Flip rocket based on flight direction
        if (!facingRight) {
            ctx.scale(-1, 1);
        }

        ctx.strokeStyle = 'var(--neon-pink)';
        ctx.fillStyle = '#1e1b4b';
        ctx.lineWidth = 1.8;

        // Rocket body
        ctx.beginPath();
        ctx.moveTo(-16, -9);
        ctx.lineTo(8, -9);
        ctx.lineTo(18, 0);
        ctx.lineTo(8, 9);
        ctx.lineTo(-16, 9);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Rocket cabin window
        ctx.fillStyle = '#020205';
        ctx.strokeStyle = 'var(--neon-pink)';
        ctx.beginPath();
        ctx.arc(4, 0, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Rocket fins
        ctx.fillStyle = 'rgba(255, 0, 221, 0.2)';
        ctx.beginPath();
        ctx.moveTo(-16, -9);
        ctx.lineTo(-24, -15);
        ctx.lineTo(-16, -3);
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(-16, 9);
        ctx.lineTo(-24, 15);
        ctx.lineTo(-16, 3);
        ctx.fill();
        ctx.stroke();

        // Fire particle engine glow
        if (this.simState === 'running') {
            ctx.save();
            ctx.shadowBlur = 10;
            ctx.shadowColor = 'var(--neon-orange)';
            ctx.fillStyle = 'var(--neon-orange)';
            ctx.beginPath();
            ctx.moveTo(-18, -4);
            ctx.lineTo(-28 - Math.random() * 8, 0);
            ctx.lineTo(-18, 4);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }

        ctx.restore();

        // Label Bob
        ctx.fillStyle = '#ffffff';
        ctx.font = '9px monospace';
        ctx.fillText("Bob", x - 8, y - 32);

        // Space Position marker text
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '8px monospace';
        ctx.fillText(`x = ${x_space.toFixed(1)} ly`, x - 22, y - 20);

        // Analog Clock
        const clockY = y + 36;
        this.drawAnalogClock(ctx, x, clockY, 20, tau, tauMax, "pink");

        // Digital counter
        ctx.fillStyle = 'var(--neon-pink)';
        ctx.font = 'bold 8.5px monospace';
        ctx.fillText(`${tau.toFixed(1)} yrs`, x - 20, clockY + 34);
    },

    cleanup() {
        if (this.slideBeta1) this.slideBeta1.removeEventListener('input', this.handlerBeta1);
        if (this.slideBeta2) this.slideBeta2.removeEventListener('input', this.handlerBeta2);
        if (this.slideDur) this.slideDur.removeEventListener('input', this.handlerDur);
        if (this.launchBtn) this.launchBtn.removeEventListener('click', this.handlerLaunch);
        if (this.freezeBtn) this.freezeBtn.removeEventListener('click', this.handlerFreeze);
        if (this.resetBtn) this.resetBtn.removeEventListener('click', this.handlerReset);
    }
});

        // ==========================================================================
    // CHAPTER 7 IMPLEMENTATION: Spacetime Diagram (Minkowski)
    // ==========================================================================    controller.registerChapter('7', {
        init(state) {
            this.canvas = document.getElementById('canvas-ch7');
            this.state = state;

            this.slideBeta = document.getElementById('slide-ch7-beta');
            this.handlerBeta = () => {
                this.state.beta = parseFloat(this.slideBeta.value);
                this.state.gamma = getGamma(this.state.beta);
                document.getElementById('val-ch7-beta').textContent = `${this.state.beta.toFixed(2)}c`;

                // On first interaction, fade out and remove onboarding instructions
                const hint = document.getElementById('ch7-first-use-hint');
                if (hint) {
                    hint.style.opacity = '0';
                    setTimeout(() => hint.remove(), 1000);
                }

                this.updateInterval();
            };
            this.slideBeta.addEventListener('input', this.handlerBeta);

            // Pre-seed events A, B, C, D representing launch, cutoff, light arrives, and distant explosion
            this.events = [
                { x: 0, t: 0, id: 'A', label: 'Rocket launch' },
                { x: 0, t: 4, id: 'B', label: 'Engine cutoff' },
                { x: 2, t: 2, id: 'C', label: 'Light signal arrives' },
                { x: 4, t: 1, id: 'D', label: 'Distant explosion' }
            ];
            // Auto-select launch and cutoff on init
            this.selectedEvents = [this.events[0], this.events[1]];

            this.btnAddEvent = document.getElementById('btn-ch7-add-event');
            this.handlerAddEventClick = () => {
                const count = this.events.length;
                if (count >= 6) return;
                // Add new event at offset
                const x = (Math.random() * 6 - 3);
                const t = (Math.random() * 4 - 2);
                const newEv = { x, t, id: String.fromCharCode(65 + count) };
                this.events.push(newEv);
                if (this.selectedEvents.length >= 2) this.selectedEvents.shift();
                this.selectedEvents.push(newEv);
                this._tracePathsDirty = true;
                this.updateInterval();
            };
            this.btnAddEvent.addEventListener('click', this.handlerAddEventClick);

            this.btnClear = document.getElementById('btn-ch7-clear');
            this.handlerClear = () => {
                this.events = [
                    { x: 0, t: 0, id: 'A', label: 'Rocket launch' },
                    { x: 0, t: 4, id: 'B', label: 'Engine cutoff' },
                    { x: 2, t: 2, id: 'C', label: 'Light signal arrives' },
                    { x: 4, t: 1, id: 'D', label: 'Distant explosion' }
                ];
                this.selectedEvents = [this.events[0], this.events[1]];
                this._tracePathsDirty = true;
                this.updateInterval();
            };
            this.btnClear.addEventListener('click', this.handlerClear);

            this.scale = 30; // Pixels per light-second/second

            // Proximity-aware click and selection logic
            this.canvasHandler = (e) => {
                const rect = this.canvas.getBoundingClientRect();
                const px = e.clientX - rect.left;
                const py = e.clientY - rect.top;

                const w = this.canvas.width / (window.devicePixelRatio || 1);
                const h = this.canvas.height / (window.devicePixelRatio || 1);
                const cx = w / 2;
                const cy = h / 2;

                let clicked = null;
                for (let ev of this.events) {
                    const boosted = lorentzForward(ev.x, ev.t, this.state.beta);
                    const bpx = cx + boosted.xPrime * this.scale;
                    const bpy = cy - boosted.tPrime * this.scale;
                    const d = Math.sqrt((px - bpx)**2 + (py - bpy)**2);
                    if (d < 14) { // 14px hit detection Proximity
                         clicked = ev;
                         break;
                    }
                }

                if (clicked) {
                    const idx = this.selectedEvents.indexOf(clicked);
                    if (idx >= 0) {
                        this.selectedEvents.splice(idx, 1);
                    } else {
                        if (this.selectedEvents.length >= 2) {
                            this.selectedEvents.shift();
                        }
                        this.selectedEvents.push(clicked);
                    }
                    this._tracePathsDirty = true;
                    this.updateInterval();
                } else {
                    if (this.events.length < 6) {
                        const x = (px - cx) / this.scale;
                        const t = -(py - cy) / this.scale;
                        const newEv = { x, t, id: String.fromCharCode(65 + this.events.length) };
                        this.events.push(newEv);
                        if (this.selectedEvents.length >= 2) this.selectedEvents.shift();
                        this.selectedEvents.push(newEv);
                        this._tracePathsDirty = true;
                        this.updateInterval();
                    }
                }
            };
            this.canvas.addEventListener('mousedown', this.canvasHandler);

            // Touch events mapping to the canvas Handler
            this.touchHandler = (e) => {
                e.preventDefault();
                const touch = e.touches[0];
                this.canvasHandler({ clientX: touch.clientX, clientY: touch.clientY });
            };
            this.canvas.addEventListener('touchstart', this.touchHandler, { passive: false });

            // Hover ghost preview and cursor feedback (prevent memory leaks via named references)
            this.hoverPos = null;
            this.mouseMoveHandler = (e) => {
                const rect = this.canvas.getBoundingClientRect();
                const px = e.clientX - rect.left;
                const py = e.clientY - rect.top;

                const w = this.canvas.width / (window.devicePixelRatio || 1);
                const h = this.canvas.height / (window.devicePixelRatio || 1);
                const cx = w / 2;
                const cy = h / 2;

                let nearEvent = false;
                for (let ev of this.events) {
                    const boosted = lorentzForward(ev.x, ev.t, this.state.beta);
                    const bpx = cx + boosted.xPrime * this.scale;
                    const bpy = cy - boosted.tPrime * this.scale;
                    const d = Math.sqrt((px - bpx)**2 + (py - bpy)**2);
                    if (d < 14) {
                        nearEvent = true;
                        break;
                    }
                }

                this.canvas.style.cursor = nearEvent ? 'pointer' : 'crosshair';

                const x = (px - cx) / this.scale;
                const t = -(py - cy) / this.scale;
                this.hoverPos = { px, py, x, t };
            };
            this.canvas.addEventListener('mousemove', this.mouseMoveHandler);

            this.mouseLeaveHandler = () => {
                this.hoverPos = null;
            };
            this.canvas.addEventListener('mouseleave', this.mouseLeaveHandler);

            // Path2D cache variables
            this._tracePathsDirty = true;
            this._cachedTracePaths = [];

            this.updateInterval();
        },
        updateInterval() {
            const s2El = document.getElementById('val-ch7-s2');
            const invariantLabel = document.getElementById('val-ch7-invariant-label');
            const typeEl = document.getElementById('val-ch7-type');

            if (this.selectedEvents.length < 2) {
                document.getElementById('val-ch7-dx').textContent = '—';
                document.getElementById('val-ch7-dt').textContent = '—';
                s2El.textContent = '—';
                typeEl.textContent = '—';
                typeEl.style.color = '';
                typeEl.style.backgroundColor = '';
                typeEl.style.borderColor = '';
                typeEl.style.borderStyle = 'none';
                if (invariantLabel) invariantLabel.style.display = 'none';
                return;
            }

            const ev1 = this.selectedEvents[0];
            const ev2 = this.selectedEvents[1];

            const b1 = lorentzForward(ev1.x, ev1.t, this.state.beta);
            const b2 = lorentzForward(ev2.x, ev2.t, this.state.beta);

            const dx = b2.xPrime - b1.xPrime;
            const dt = b2.tPrime - b1.tPrime;

            // Invariant interval computed from rest coordinates
            const dx0 = ev2.x - ev1.x;
            const dt0 = ev2.t - ev1.t;
            const s2 = dt0*dt0 - dx0*dx0;

            document.getElementById('val-ch7-dx').textContent = `${dx.toFixed(2)} ls`;
            document.getElementById('val-ch7-dt').textContent = `${dt.toFixed(2)} s`;
            s2El.textContent = `${s2.toFixed(3)}`;
            if (invariantLabel) invariantLabel.style.display = 'inline';

            // Trigger HUD glow animation using forced reflow trick
            s2El.classList.remove('s2-pulse');
            void s2El.offsetWidth;
            s2El.classList.add('s2-pulse');

            let type = '';
            let color = '';
            let bgColor = '';
            if (s2 > 0.001) {
                type = 'Timelike (Causal)';
                color = varColor('--neon-emerald');
                bgColor = 'rgba(0, 255, 123, 0.1)';
            } else if (s2 < -0.001) {
                type = 'Spacelike (Disconnected)';
                color = varColor('--neon-magenta');
                bgColor = 'rgba(255, 0, 221, 0.1)';
            } else {
                type = 'Lightlike (Null)';
                color = varColor('--neon-amber');
                bgColor = 'rgba(255, 179, 0, 0.1)';
            }

            typeEl.textContent = type;
            typeEl.style.color = color;
            typeEl.style.backgroundColor = bgColor;
            typeEl.style.borderColor = color;
            typeEl.style.borderStyle = 'solid';
            typeEl.style.borderWidth = '1px';
        },
        tick() {
            // Coordinate boosts update instantly on dial drag
        },
        draw() {
            // setupCanvas size change check (prevent resizing GPU backbuffer every frame)
            const dpr = window.devicePixelRatio || 1;
            const rect = this.canvas.getBoundingClientRect();
            const needsW = Math.round(rect.width * dpr);
            const needsH = Math.round(rect.height * dpr);
            if (this.canvas.width !== needsW || this.canvas.height !== needsH) {
                this.canvas.width = needsW;
                this.canvas.height = needsH;
                this.canvas.style.width = rect.width + 'px';
                this.canvas.style.height = rect.height + 'px';
                this._tracePathsDirty = true; // Size change invalidates cached Path2D paths
            }
            const ctx = this.canvas.getContext('2d');
            ctx.resetTransform();
            ctx.scale(dpr, dpr);

            const w = rect.width;
            const h = rect.height;
            ctx.clearRect(0, 0, w, h);

            const cx = w / 2;
            const cy = h / 2;

            // Draw background invariant hyperbolas (s^2 = +1, -1, +4, -4, +9, -9)
            const drawHyperbola = (sVal) => {
                ctx.beginPath();
                if (sVal > 0) {
                    const s = Math.sqrt(sVal);
                    // Upper Branch
                    for (let x = -10; x <= 10; x += 0.2) {
                        const t = Math.sqrt(s*s + x*x);
                        const px = cx + x * this.scale;
                        const py = cy - t * this.scale;
                        if (x === -10) ctx.moveTo(px, py);
                        else ctx.lineTo(px, py);
                    }
                    ctx.stroke();

                    // Lower Branch
                    ctx.beginPath();
                    for (let x = -10; x <= 10; x += 0.2) {
                        const t = -Math.sqrt(s*s + x*x);
                        const px = cx + x * this.scale;
                        const py = cy - t * this.scale;
                        if (x === -10) ctx.moveTo(px, py);
                        else ctx.lineTo(px, py);
                    }
                    ctx.stroke();
                } else {
                    const s = Math.sqrt(-sVal);
                    // Right Branch
                    for (let t = -10; t <= 10; t += 0.2) {
                        const x = Math.sqrt(s*s + t*t);
                        const px = cx + x * this.scale;
                        const py = cy - t * this.scale;
                        if (t === -10) ctx.moveTo(px, py);
                        else ctx.lineTo(px, py);
                    }
                    ctx.stroke();

                    // Left Branch
                    ctx.beginPath();
                    for (let t = -10; t <= 10; t += 0.2) {
                        const x = -Math.sqrt(s*s + t*t);
                        const px = cx + x * this.scale;
                        const py = cy - t * this.scale;
                        if (t === -10) ctx.moveTo(px, py);
                        else ctx.lineTo(px, py);
                    }
                    ctx.stroke();
                }
            };

            ctx.save();
            ctx.lineWidth = 1;
            // Draw timelike background curves HSL-emerald
            ctx.strokeStyle = 'rgba(0, 255, 123, 0.18)';
            [1, 4, 9].forEach(sVal => drawHyperbola(sVal));

            // Draw spacelike background curves HSL-magenta
            ctx.strokeStyle = 'rgba(255, 0, 221, 0.15)';
            [-1, -4, -9].forEach(sVal => drawHyperbola(sVal));
            ctx.restore();

            // Draw background hyperbola vertex labels (live drawn, not Path2D cached)
            ctx.save();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
            ctx.font = "8px 'JetBrains Mono', monospace";
            ctx.textAlign = 'center';

            [1, 4, 9].forEach(sVal => {
                const s = Math.sqrt(sVal);
                ctx.fillText(`s²=+${sVal}`, cx, cy - s * this.scale - 4);
                ctx.fillText(`s²=+${sVal}`, cx, cy + s * this.scale + 10);
            });

            ctx.textAlign = 'left';
            [-1, -4, -9].forEach(sVal => {
                const s = Math.sqrt(-sVal);
                ctx.fillText(`s²=${sVal}`, cx + s * this.scale + 4, cy + 3);
                ctx.textAlign = 'right';
                ctx.fillText(`s²=${sVal}`, cx - s * this.scale - 4, cy + 3);
            });
            ctx.restore();

            // Build cached Path2D traces for selected events (only recomputed on selection or resize)
            if (this._tracePathsDirty) {
                this._cachedTracePaths = [];
                this.selectedEvents.forEach((ev) => {
                    const sEv = ev.t * ev.t - ev.x * ev.x;
                    if (Math.abs(sEv) < 0.001) {
                        this._cachedTracePaths.push(null);
                        return;
                    }

                    const path = new Path2D();
                    let first = true;
                    if (sEv > 0) {
                        const s = Math.sqrt(sEv);
                        const sign = ev.t >= 0 ? 1 : -1;
                        for (let x = -10; x <= 10; x += 0.1) {
                            const t = sign * Math.sqrt(s*s + x*x);
                            const px = cx + x * this.scale;
                            const py = cy - t * this.scale;
                            if (first) { path.moveTo(px, py); first = false; }
                            else path.lineTo(px, py);
                        }
                    } else {
                        const s = Math.sqrt(-sEv);
                        const sign = ev.x >= 0 ? 1 : -1;
                        for (let t = -10; t <= 10; t += 0.1) {
                            const x = sign * Math.sqrt(s*s + t*t);
                            const px = cx + x * this.scale;
                            const py = cy - t * this.scale;
                            if (first) { path.moveTo(px, py); first = false; }
                            else path.lineTo(px, py);
                        }
                    }
                    this._cachedTracePaths.push(path);
                });
                this._tracePathsDirty = false;
            }

            // Draw trace paths
            ctx.save();
            ctx.lineWidth = 2.5;
            ctx.shadowBlur = 10;
            this._cachedTracePaths.forEach((path, idx) => {
                if (!path) return;
                const color = idx === 0 ? varColor('--neon-cyan') : varColor('--neon-amber');
                const glow = idx === 0 ? varColor('--neon-cyan-glow') : varColor('--neon-amber-glow');
                ctx.strokeStyle = color;
                ctx.shadowColor = glow;
                ctx.stroke(path);
            });
            ctx.restore();

            // Draw Minkowski Coordinate Grid in S' (Boosted coordinates)
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
            ctx.lineWidth = 1;

            const b = this.state.beta;
            const gamma = this.state.gamma;

            for (let i = -8; i <= 8; i++) {
                if (i === 0) continue;
                // Boosted grid constant x'
                ctx.beginPath();
                ctx.moveTo(cx + i * this.scale / gamma - h * b, h);
                ctx.lineTo(cx + i * this.scale / gamma + h * b, 0);
                ctx.stroke();

                // Boosted grid constant t'
                ctx.beginPath();
                ctx.moveTo(0, cy - i * this.scale / gamma + w * b);
                ctx.lineTo(w, cy - i * this.scale / gamma - w * b);
                ctx.stroke();
            }

            // Draw Axes
            // Ground stationary axes (S)
            ctx.strokeStyle = 'rgba(255,255,255,0.15)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, cy); ctx.lineTo(w, cy); // X axis
            ctx.moveTo(cx, 0); ctx.lineTo(cx, h); // T axis
            ctx.stroke();

            // Boosted axes (S') - unified HSL colors
            ctx.strokeStyle = varColor('--neon-magenta'); // ct' axis
            ctx.beginPath();
            ctx.moveTo(cx - (h/2)*b, h);
            ctx.lineTo(cx + (h/2)*b, 0);
            ctx.stroke();

            ctx.strokeStyle = varColor('--neon-cyan'); // x' axis
            ctx.beginPath();
            ctx.moveTo(0, cy + (w/2)*b);
            ctx.lineTo(w, cy - (w/2)*b);
            ctx.stroke();

            // Labels for axes
            ctx.fillStyle = varColor('--neon-magenta');
            ctx.font = "9px 'JetBrains Mono', monospace";
            ctx.fillText("ct' axis", cx + (h/2)*b - 38, 20);
            ctx.fillStyle = varColor('--neon-cyan');
            ctx.fillText("x' axis", w - 48, cy - (w/2)*b - 8);

            // Draw 45 degree light cone lines
            ctx.strokeStyle = varColor('--neon-amber');
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(cx - cy, h); ctx.lineTo(cx + cy, 0);
            ctx.moveTo(cx + cy, h); ctx.lineTo(cx - cy, 0);
            ctx.stroke();
            ctx.setLineDash([]);

            // Draw dashed connector line between selected events
            if (this.selectedEvents.length === 2) {
                const [e1, e2] = this.selectedEvents;
                const b1 = lorentzForward(e1.x, e1.t, this.state.beta);
                const b2 = lorentzForward(e2.x, e2.t, this.state.beta);

                const p1x = cx + b1.xPrime * this.scale;
                const p1y = cy - b1.tPrime * this.scale;
                const p2x = cx + b2.xPrime * this.scale;
                const p2y = cy - b2.tPrime * this.scale;

                const dx0 = e2.x - e1.x;
                const dt0 = e2.t - e1.t;
                const s2Val = dt0*dt0 - dx0*dx0;

                let connectorColor = '';
                if (s2Val > 0.001) {
                    connectorColor = varColor('--neon-emerald');
                } else if (s2Val < -0.001) {
                    connectorColor = varColor('--neon-magenta');
                } else {
                    connectorColor = varColor('--neon-amber');
                }

                ctx.save();
                ctx.strokeStyle = connectorColor;
                ctx.lineWidth = 2;
                ctx.setLineDash([6, 3]);
                ctx.shadowBlur = 10;
                ctx.shadowColor = connectorColor;
                ctx.beginPath();
                ctx.moveTo(p1x, p1y);
                ctx.lineTo(p2x, p2y);
                ctx.stroke();
                ctx.restore();

                // Midpoint s² label centered with cleared background
                ctx.save();
                const midX = (p1x + p2x) / 2;
                const midY = (p1y + p2y) / 2;
                const s2Label = `s² = ${s2Val.toFixed(2)}`;
                ctx.font = "bold 10px 'JetBrains Mono', monospace";
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                const labelW = ctx.measureText(s2Label).width + 8;
                ctx.fillStyle = '#06060f'; // canvas background color
                ctx.fillRect(midX - labelW/2, midY - 7, labelW, 14);

                ctx.fillStyle = connectorColor;
                ctx.fillText(s2Label, midX, midY);
                ctx.restore();
            }

            // Draw canvas s² overlay pill in top-right corner
            if (this.selectedEvents.length === 2) {
                const [e1, e2] = this.selectedEvents;
                const dx0 = e2.x - e1.x;
                const dt0 = e2.t - e1.t;
                const s2Val = dt0*dt0 - dx0*dx0;

                let typeText = '';
                let pillColor = '';
                if (s2Val > 0.001) {
                    typeText = 'Timelike';
                    pillColor = varColor('--neon-emerald');
                } else if (s2Val < -0.001) {
                    typeText = 'Spacelike';
                    pillColor = varColor('--neon-magenta');
                } else {
                    typeText = 'Lightlike';
                    pillColor = varColor('--neon-amber');
                }

                ctx.save();
                const cardX = w - 160;
                const cardY = 15;
                const cardW = 145;
                const cardH = 34;

                ctx.fillStyle = 'rgba(10, 11, 20, 0.85)';
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.roundRect(cardX, cardY, cardW, cardH, 6);
                ctx.fill();
                ctx.stroke();

                ctx.fillStyle = '#ffffff';
                ctx.font = "8px 'JetBrains Mono', monospace";
                ctx.textAlign = 'left';
                ctx.fillText("INTERVAL", cardX + 10, cardY + 14);

                ctx.fillStyle = pillColor;
                ctx.font = "bold 11px 'JetBrains Mono', monospace";
                ctx.fillText(`s² = ${s2Val.toFixed(2)}`, cardX + 10, cardY + 26);

                ctx.font = "bold 7px sans-serif";
                ctx.textAlign = 'right';
                ctx.fillStyle = pillColor;
                ctx.fillText(typeText.toUpperCase(), cardX + cardW - 10, cardY + 20);
                ctx.restore();
            }

            // Draw β/γ indicators near bottom left
            ctx.save();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.font = "9px 'JetBrains Mono', monospace";
            ctx.textAlign = 'left';
            ctx.fillText(`β = ${this.state.beta.toFixed(2)}`, 15, h - 25);
            ctx.fillText(`γ = ${this.state.gamma.toFixed(3)}`, 15, h - 15);
            ctx.restore();

            // Sparse axis ticks (t=±4, ±2, x=±4, ±2)
            ctx.save();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
            ctx.font = "7px 'JetBrains Mono', monospace";
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            [-4, -2, 2, 4].forEach(tick => {
                const px = cx + tick * this.scale;
                ctx.fillText(`${tick}ls`, px, cy + 12);
                ctx.beginPath();
                ctx.moveTo(px, cy - 2);
                ctx.lineTo(px, cy + 2);
                ctx.strokeStyle = 'rgba(255,255,255,0.2)';
                ctx.stroke();
            });

            ctx.textAlign = 'right';
            [-4, -2, 2, 4].forEach(tick => {
                const py = cy - tick * this.scale;
                ctx.fillText(`${tick}s`, cx - 6, py);
                ctx.beginPath();
                ctx.moveTo(cx - 2, py);
                ctx.lineTo(cx + 2, py);
                ctx.strokeStyle = 'rgba(255,255,255,0.2)';
                ctx.stroke();
            });
            ctx.restore();

            // Hover ghost preview coordinate crosshairs
            if (this.hoverPos) {
                const { px, py, x, t } = this.hoverPos;
                ctx.save();
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
                ctx.lineWidth = 0.5;
                ctx.setLineDash([2, 2]);
                ctx.beginPath();
                ctx.moveTo(0, py); ctx.lineTo(w, py);
                ctx.moveTo(px, 0); ctx.lineTo(px, h);
                ctx.stroke();
                ctx.restore();

                ctx.save();
                ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
                ctx.beginPath();
                ctx.arc(px, py, 4, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
                ctx.font = "8px 'JetBrains Mono', monospace";
                ctx.textAlign = 'left';
                ctx.fillText(`(${x.toFixed(1)}, ${t.toFixed(1)})`, px + 8, py - 4);
                ctx.restore();
            }

            // Draw event dots & labels
            this.events.forEach(ev => {
                const boosted = lorentzForward(ev.x, ev.t, this.state.beta);
                const px = cx + boosted.xPrime * this.scale;
                const py = cy - boosted.tPrime * this.scale;

                const isSelected = this.selectedEvents.includes(ev);
                if (isSelected) {
                    ctx.strokeStyle = varColor('--neon-amber');
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(px, py, 9, 0, Math.PI*2);
                    ctx.stroke();
                }

                ctx.fillStyle = isSelected ? varColor('--neon-amber') : varColor('--neon-cyan');
                ctx.beginPath();
                ctx.arc(px, py, 5, 0, Math.PI*2);
                ctx.fill();

                ctx.fillStyle = '#ffffff';
                ctx.font = "bold 10px sans-serif";
                ctx.fillText(ev.id, px + 8, py - 4);
            });
        },
        cleanup() {
            if (this.slideBeta) this.slideBeta.removeEventListener('input', this.handlerBeta);
            if (this.btnAddEvent) this.btnAddEvent.removeEventListener('click', this.handlerAddEventClick);
            if (this.btnClear) this.btnClear.removeEventListener('click', this.handlerClear);
            this.canvas.removeEventListener('mousedown', this.canvasHandler);
            this.canvas.removeEventListener('touchstart', this.touchHandler);
            this.canvas.removeEventListener('mousemove', this.mouseMoveHandler);
            this.canvas.removeEventListener('mouseleave', this.mouseLeaveHandler);
            this.canvas.style.cursor = '';
        }
    });

    // ==========================================================================
    // CHAPTER 8 IMPLEMENTATION: The Speed Limit
    // ==========================================================================
    controller.registerChapter('8', {
        init(state) {
            this.canvas = document.getElementById('canvas-ch8');
            this.state = state;

            this.t = 0.0;
            this.beta = 0.0;
            this.properAccel = 0.3; // proper acceleration (g units equivalent)
            this.isThrusting = false;
            this.history = []; // tracks v, a, and KE history coordinates

            this.thrustBtn = document.getElementById('btn-ch8-thrust');
            this.resetBtn = document.getElementById('btn-ch8-reset');

            this.handlerThrustStart = () => {
                this.isThrusting = true;
                this.thrustBtn.classList.add('active');
            };
            this.handlerThrustEnd = () => {
                this.isThrusting = false;
                this.thrustBtn.classList.remove('active');
            };
            this.handlerReset = () => {
                this.t = 0.0;
                this.beta = 0.0;
                this.history = [];
                this.isThrusting = false;
                this.updateReadouts();
            };

            this.thrustBtn.addEventListener('mousedown', this.handlerThrustStart);
            this.thrustBtn.addEventListener('mouseup', this.handlerThrustEnd);
            this.thrustBtn.addEventListener('mouseleave', this.handlerThrustEnd);

            // Touch Support
            this.thrustBtn.addEventListener('touchstart', (e) => {
                this.handlerThrustStart();
                e.preventDefault();
            }, { passive: false });
            this.thrustBtn.addEventListener('touchend', () => {
                this.handlerThrustEnd();
            });

            this.resetBtn.addEventListener('click', this.handlerReset);

            this.updateReadouts();
        },
        updateReadouts() {
            document.getElementById('val-ch8-time').textContent = `${this.t.toFixed(2)} yrs`;
            document.getElementById('val-ch8-v').textContent = `${this.beta.toFixed(3)} c`;

            const gamma = getGamma(this.beta);
            const aCoord = this.properAccel / (gamma * gamma * gamma);
            document.getElementById('val-ch8-a').textContent = `${aCoord.toFixed(3)}g`;

            // Avoid catastrophic cancellation for KE calculation
            const ke = getGammaMinusOne(this.beta);
            document.getElementById('val-ch8-ke').textContent = `${ke.toFixed(4)} mc²`;
        },
        tick() {
            if (this.isThrusting) {
                // In natural units, proper acceleration alpha increases rapidity linearly:
                // rapidity phi = alpha * t
                // beta = tanh(phi)
                const dt = 0.08;
                this.t += dt;

                const phi = this.properAccel * this.t;
                this.beta = Math.tanh(phi);

                // Store plotting coordinates
                const gamma = getGamma(this.beta);
                const aCoord = this.properAccel / (gamma * gamma * gamma);
                const ke = getGammaMinusOne(this.beta);

                // Add to history list
                this.history.push({ t: this.t, v: this.beta, a: aCoord, ke: ke });
                if (this.history.length > 500) {
                    this.history.shift(); // remove oldest point smoothly
                }

                this.updateReadouts();
            }
        },
        draw() {
            const ctx = setupCanvas(this.canvas);
            const w = this.canvas.width / (window.devicePixelRatio || 1);
            const h = this.canvas.height / (window.devicePixelRatio || 1);

            ctx.clearRect(0, 0, w, h);

            // Stacked Subplots design:
            // Subplot 1: Velocity v vs t (top half)
            // Subplot 2: Kinetic Energy K vs t (bottom half, log-scale)
            const margin = 25;
            const subH = (h - 3 * margin) / 2;

            // --- Subplot 1: Velocity ---
            ctx.fillStyle = '#06060f';
            ctx.fillRect(margin, margin, w - 2*margin, subH);
            ctx.strokeStyle = 'rgba(255,255,255,0.06)';
            ctx.lineWidth = 1;
            ctx.strokeRect(margin, margin, w - 2*margin, subH);

            // Draw asymptote speed of light c line
            ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(margin, margin); ctx.lineTo(w - margin, margin);
            ctx.stroke();
            ctx.setLineDash([]);

            // Draw labels
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.font = "9px monospace";
            ctx.fillText("v = 1.00c limit", margin + 10, margin + 12);
            ctx.fillText("Velocity (v) vs Time (t)", margin + 10, margin + subH - 8);

            // --- Subplot 2: Kinetic Energy (Log Clamped Scale) ---
            const sub2Y = 2 * margin + subH;
            ctx.fillStyle = '#06060f';
            ctx.fillRect(margin, sub2Y, w - 2*margin, subH);
            ctx.strokeStyle = 'rgba(255,255,255,0.06)';
            ctx.strokeRect(margin, sub2Y, w - 2*margin, subH);

            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.fillText("Log(K) vs Time (t)", margin + 10, sub2Y + subH - 8);

            // Helper to map t to pixel coordinates
            const maxT = Math.max(15, this.t);
            const getX = (timeVal) => margin + (timeVal / maxT) * (w - 2 * margin);

            const getY_V = (vVal) => margin + subH - (vVal * subH);

            // Pseudo-log plotting for KE to resolve log(0) at rest
            const LOG_K_MIN = -4; // K = 10^-4 mc^2
            const LOG_K_MAX = 2;  // K = 10^2 mc^2

            const getY_KE = (keVal) => {
                const logK = (keVal <= 1e-4) ? LOG_K_MIN : Math.log10(keVal);
                const clampedLog = Math.max(LOG_K_MIN, Math.min(LOG_K_MAX, logK));
                const pct = (clampedLog - LOG_K_MIN) / (LOG_K_MAX - LOG_K_MIN);
                return sub2Y + subH - pct * subH;
            };

            // Plot curves
            if (this.history.length > 1) {
                // Velocity curve
                ctx.strokeStyle = '#00f2fe';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(getX(this.history[0].t), getY_V(this.history[0].v));
                for (let i = 1; i < this.history.length; i++) {
                    ctx.lineTo(getX(this.history[i].t), getY_V(this.history[i].v));
                }
                ctx.stroke();

                // Kinetic Energy curve
                ctx.strokeStyle = '#ff00dd';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(getX(this.history[0].t), getY_KE(this.history[0].ke));
                for (let i = 1; i < this.history.length; i++) {
                    ctx.lineTo(getX(this.history[i].t), getY_KE(this.history[i].ke));
                }
                ctx.stroke();
            }
        },
        cleanup() {
            if (this.thrustBtn) {
                this.thrustBtn.removeEventListener('mousedown', this.handlerThrustStart);
                this.thrustBtn.removeEventListener('mouseup', this.handlerThrustEnd);
                this.thrustBtn.removeEventListener('mouseleave', this.handlerThrustEnd);
            }
            if (this.resetBtn) this.resetBtn.removeEventListener('click', this.handlerReset);
        }
    });

})();
