/**
 * Space & Physics: N-Body Galaxy Gravity Simulator
 * Renders an interactive 2D canvas with orbital mechanics.
 */

class GalaxySimulation {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');

        // Physics Constants (Adjustable via HUD)
        this.G = 0.5;
        this.centralMass = 5000;
        this.timeStep = 0.8;
        this.starCount = 1200;
        this.paletteName = 'cosmic'; // cosmic, rainbow, mono
        this.isPaused = false;
        this.showOrbitLines = false;
        this.showSpacetimeGrid = false;

        // Simulator State
        this.stars = [];
        this.planets = [];
        this.centralBody = {
            x: 0,
            y: 0,
            mass: this.centralMass,
            radius: 12
        };

        // User Interaction State (Slingshot launch)
        this.dragStart = null;
        this.dragCurrent = null;
        this.isDragging = false;

        // Viewport scale and offset
        this.scale = 1.0;
        this.offsetX = 0;
        this.offsetY = 0;

        // Initialize
        this.resize();
        this.initGalaxy();
        this.bindEvents();
        
        // Start animation loop
        this.animate();
    }

    resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.centralBody.x = this.canvas.width / 2;
        this.centralBody.y = this.canvas.height / 2;
    }

    initGalaxy() {
        this.stars = [];
        const armCount = 3;
        const armAngleOffset = (Math.PI * 2) / armCount;
        const galaxyRadius = Math.min(this.canvas.width, this.canvas.height) * 0.45;

        for (let i = 0; i < this.starCount; i++) {
            // Distribute radius: denser near the center
            const r = Math.pow(Math.random(), 1.5) * galaxyRadius + 15;
            
            // Assign to spiral arms
            const arm = i % armCount;
            // Spiral formula: angle = spiralFactor * radius + arm offset + small scatter
            const spiralTightness = 0.015;
            const angle = r * spiralTightness + arm * armAngleOffset + (Math.random() - 0.5) * 0.28;

            const x = this.centralBody.x + r * Math.cos(angle);
            const y = this.centralBody.y + r * Math.sin(angle);

            // Compute circular orbit velocity: v = sqrt(G * M / r)
            const vOrbital = Math.sqrt((this.G * this.centralMass) / r);
            
            // Velocity direction is perpendicular to radius vector (tangential)
            const vx = -vOrbital * Math.sin(angle) + (Math.random() - 0.5) * (vOrbital * 0.15);
            const vy = vOrbital * Math.cos(angle) + (Math.random() - 0.5) * (vOrbital * 0.15);

            // Coloring based on radius (gradient from hot center to cool edges)
            const colorRatio = r / galaxyRadius;
            
            this.stars.push({
                x: x,
                y: y,
                vx: vx,
                vy: vy,
                size: Math.random() * 1.2 + 0.3,
                opacity: Math.random() * 0.6 + 0.4,
                colorRatio: colorRatio
            });
        }
    }

    bindEvents() {
        window.addEventListener('resize', () => this.resize());

        // Mouse Drag to Launch Planets
        this.canvas.addEventListener('mousedown', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.dragStart = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
            this.dragCurrent = { ...this.dragStart };
            this.isDragging = true;
        });

        this.canvas.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            const rect = this.canvas.getBoundingClientRect();
            this.dragCurrent = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
        });

        this.canvas.addEventListener('mouseup', (e) => {
            if (!this.isDragging) return;
            this.isDragging = false;

            // Spawn Planet with slingshot velocity vector
            // Vector points from current mouse release toward original click (slingshot pullback)
            const dx = this.dragStart.x - this.dragCurrent.x;
            const dy = this.dragStart.y - this.dragCurrent.y;
            
            // Velocity multiplier
            const velocityScale = 0.06; 
            const vx = dx * velocityScale;
            const vy = dy * velocityScale;

            this.spawnPlanet(this.dragStart.x, this.dragStart.y, vx, vy);
            
            this.dragStart = null;
            this.dragCurrent = null;
        });

        // Touch support for mobile
        this.canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length !== 1) return;
            const rect = this.canvas.getBoundingClientRect();
            this.dragStart = {
                x: e.touches[0].clientX - rect.left,
                y: e.touches[0].clientY - rect.top
            };
            this.dragCurrent = { ...this.dragStart };
            this.isDragging = true;
            e.preventDefault();
        }, { passive: false });

        this.canvas.addEventListener('touchmove', (e) => {
            if (!this.isDragging) return;
            const rect = this.canvas.getBoundingClientRect();
            this.dragCurrent = {
                x: e.touches[0].clientX - rect.left,
                y: e.touches[0].clientY - rect.top
            };
            e.preventDefault();
        }, { passive: false });

        this.canvas.addEventListener('touchend', (e) => {
            if (!this.isDragging) return;
            this.isDragging = false;
            const dx = this.dragStart.x - this.dragCurrent.x;
            const dy = this.dragStart.y - this.dragCurrent.y;
            const velocityScale = 0.06;
            this.spawnPlanet(this.dragStart.x, this.dragStart.y, dx * velocityScale, dy * velocityScale);
            this.dragStart = null;
            this.dragCurrent = null;
        });
    }

    spawnPlanet(x, y, vx, vy) {
        // High density planet
        const colors = ['#00ffaa', '#00e1ff', '#f000ff', '#ffb300'];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        
        this.planets.push({
            x: x,
            y: y,
            vx: vx,
            vy: vy,
            mass: 250, // Planets pull stars!
            radius: 6,
            color: randomColor,
            trail: []
        });
    }

    clearPlanets() {
        this.planets = [];
    }

    getStarColor(ratio, velocitySq) {
        // Dynamic palettes
        if (this.paletteName === 'cosmic') {
            // Nebulous colors (neon indigo -> violet -> hot pink -> white)
            if (ratio < 0.2) return `rgba(255, 255, 255, 0.9)`; // Center star clusters
            if (ratio < 0.5) return `rgba(255, 0, 221, ${0.4 + (velocitySq * 0.02)})`; // Magenta
            if (ratio < 0.8) return `rgba(139, 92, 246, 0.8)`; // Violet
            return `rgba(99, 102, 241, 0.7)`; // Blue/Indigo outer ring
        } else if (this.paletteName === 'rainbow') {
            const hue = (ratio * 360 + Date.now() * 0.02) % 360;
            return `hsla(${hue}, 85%, 65%, 0.85)`;
        } else {
            // Monochromatic stellar teal
            return `rgba(0, 255, 213, ${0.4 + ratio * 0.5})`;
        }
    }

    updatePhysics() {
        const dt = this.timeStep;

        // 1. Update Planets (full mutual gravity with black hole)
        for (let i = 0; i < this.planets.length; i++) {
            const p = this.planets[i];
            
            // Pull from central black hole
            const dx = this.centralBody.x - p.x;
            const dy = this.centralBody.y - p.y;
            const distSq = dx * dx + dy * dy + 100; // soft factor
            const dist = Math.sqrt(distSq);

            // F = G * M * m / r^2 => a = G * M / r^2
            const acc = (this.G * this.centralBody.mass) / distSq;
            p.vx += (dx / dist) * acc * dt;
            p.vy += (dy / dist) * acc * dt;

            // Pull from other planets (mutual gravity)
            for (let j = 0; j < this.planets.length; j++) {
                if (i === j) continue;
                const other = this.planets[j];
                const pdx = other.x - p.x;
                const pdy = other.y - p.y;
                const pdistSq = pdx * pdx + pdy * pdy + 200;
                const pdist = Math.sqrt(pdistSq);
                
                const pacc = (this.G * other.mass) / pdistSq;
                p.vx += (pdx / pdist) * pacc * dt;
                p.vy += (pdy / pdist) * pacc * dt;
            }

            // Update planet position
            p.x += p.vx * dt;
            p.y += p.vy * dt;

            // Store trails
            p.trail.push({ x: p.x, y: p.y });
            if (p.trail.length > 60) p.trail.shift();
        }

        // 2. Update Stars (pulled by central hole + active planets)
        for (let i = 0; i < this.stars.length; i++) {
            const s = this.stars[i];
            
            // Pull from black hole
            const dx = this.centralBody.x - s.x;
            const dy = this.centralBody.y - s.y;
            const distSq = dx * dx + dy * dy + 400; // Soft factor to avoid infinite forces
            const dist = Math.sqrt(distSq);

            const acc = (this.G * this.centralBody.mass) / distSq;
            s.vx += (dx / dist) * acc * dt;
            s.vy += (dy / dist) * acc * dt;

            // Pull from planets
            for (let j = 0; j < this.planets.length; j++) {
                const p = this.planets[j];
                const pdx = p.x - s.x;
                const pdy = p.y - s.y;
                const pdistSq = pdx * pdx + pdy * pdy + 200;
                const pdist = Math.sqrt(pdistSq);

                if (pdist < 15) {
                    // Accretion / Collision: Star gets absorbed or speed-boosted
                    s.vx += (pdx / pdist) * 0.8 * dt;
                    s.vy += (pdy / pdist) * 0.8 * dt;
                } else {
                    const pacc = (this.G * p.mass) / pdistSq;
                    s.vx += (pdx / pdist) * pacc * dt;
                    s.vy += (pdy / pdist) * pacc * dt;
                }
            }

            // Friction / Drag (miniscule cosmic drag to stabilize orbits)
            s.vx *= 0.9995;
            s.vy *= 0.9995;

            // Update star position
            s.x += s.vx * dt;
            s.y += s.vy * dt;
        }
    }

    drawSpacetimeGrid() {
        const spacing = 50;
        this.ctx.strokeStyle = 'rgba(99, 102, 241, 0.05)';
        this.ctx.lineWidth = 1;

        // Draw horizontal grid lines deformed by gravity
        for (let y = spacing; y < this.canvas.height; y += spacing) {
            this.ctx.beginPath();
            for (let x = 0; x <= this.canvas.width; x += 10) {
                let dx = this.centralBody.x - x;
                let dy = this.centralBody.y - y;
                let dist = Math.sqrt(dx * dx + dy * dy) + 1;
                
                // Deformation proportional to mass / dist
                let deform = (this.centralMass * 30) / (dist + 50);
                let newY = y + (dy / dist) * deform;
                let newX = x + (dx / dist) * deform;

                if (x === 0) this.ctx.moveTo(newX, newY);
                else this.ctx.lineTo(newX, newY);
            }
            this.ctx.stroke();
        }

        // Draw vertical grid lines
        for (let x = spacing; x < this.canvas.width; x += spacing) {
            this.ctx.beginPath();
            for (let y = 0; y <= this.canvas.height; y += 10) {
                let dx = this.centralBody.x - x;
                let dy = this.centralBody.y - y;
                let dist = Math.sqrt(dx * dx + dy * dy) + 1;
                
                let deform = (this.centralMass * 30) / (dist + 50);
                let newY = y + (dy / dist) * deform;
                let newX = x + (dx / dist) * deform;

                if (y === 0) this.ctx.moveTo(newX, newY);
                else this.ctx.lineTo(newX, newY);
            }
            this.ctx.stroke();
        }
    }

    draw() {
        // Clear screen with trails (semi-opaque cosmic dark)
        this.ctx.fillStyle = 'rgba(3, 3, 8, 0.15)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw coordinate grid if active
        if (this.showSpacetimeGrid) {
            this.drawSpacetimeGrid();
        }

        // Draw Central Black Hole
        this.ctx.shadowBlur = 20;
        this.ctx.shadowColor = 'rgba(124, 58, 237, 0.5)';
        
        // Event Horizon Outer Glow
        const bhGrad = this.ctx.createRadialGradient(
            this.centralBody.x, this.centralBody.y, 2,
            this.centralBody.x, this.centralBody.y, this.centralBody.radius * 2.2
        );
        bhGrad.addColorStop(0, '#000');
        bhGrad.addColorStop(0.35, '#0c021f');
        bhGrad.addColorStop(0.7, '#ff0077');
        bhGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        this.ctx.fillStyle = bhGrad;
        this.ctx.beginPath();
        this.ctx.arc(this.centralBody.x, this.centralBody.y, this.centralBody.radius * 2.2, 0, Math.PI * 2);
        this.ctx.fill();

        // Singularity Center
        this.ctx.fillStyle = '#000';
        this.ctx.beginPath();
        this.ctx.arc(this.centralBody.x, this.centralBody.y, this.centralBody.radius, 0, Math.PI * 2);
        this.ctx.fill();

        // Reset shadow
        this.ctx.shadowBlur = 0;

        // Draw Orbit previews for active planets
        if (this.showOrbitLines) {
            this.ctx.lineWidth = 1;
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
            this.planets.forEach(p => {
                // Circle approximation of distance
                const dx = p.x - this.centralBody.x;
                const dy = p.y - this.centralBody.y;
                const radius = Math.sqrt(dx * dx + dy * dy);
                this.ctx.beginPath();
                this.ctx.arc(this.centralBody.x, this.centralBody.y, radius, 0, Math.PI * 2);
                this.ctx.stroke();
            });
        }

        // Draw Stars
        this.stars.forEach(s => {
            const vSq = s.vx * s.vx + s.vy * s.vy;
            this.ctx.fillStyle = this.getStarColor(s.colorRatio, vSq);
            
            // Fast rendering with fillRect or arc
            this.ctx.fillRect(s.x, s.y, s.size, s.size);
        });

        // Draw Planets
        this.planets.forEach(p => {
            // Draw trails
            if (p.trail.length > 1) {
                this.ctx.beginPath();
                this.ctx.moveTo(p.trail[0].x, p.trail[0].y);
                for (let i = 1; i < p.trail.length; i++) {
                    this.ctx.lineTo(p.trail[i].x, p.trail[i].y);
                }
                this.ctx.strokeStyle = p.color + '33'; // transparent trail
                this.ctx.lineWidth = 3;
                this.ctx.stroke();
            }

            // Draw body
            this.ctx.fillStyle = p.color;
            this.ctx.shadowBlur = 10;
            this.ctx.shadowColor = p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.shadowBlur = 0;
        });

        // Draw Launch Vector Preview
        if (this.isDragging && this.dragStart && this.dragCurrent) {
            // Slingshot vector preview
            this.ctx.beginPath();
            this.ctx.moveTo(this.dragStart.x, this.dragStart.y);
            this.ctx.lineTo(this.dragCurrent.x, this.dragCurrent.y);
            this.ctx.strokeStyle = '#00ffaa';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();

            // Draw dots showing slingshot trajectory prediction
            const dx = this.dragStart.x - this.dragCurrent.x;
            const dy = this.dragStart.y - this.dragCurrent.y;
            const vx = dx * 0.06;
            const vy = dy * 0.06;

            this.ctx.fillStyle = '#00ffaa66';
            let px = this.dragStart.x;
            let py = this.dragStart.y;
            let pvx = vx;
            let pvy = vy;

            for (let step = 0; step < 15; step++) {
                // gravity step
                const bhdx = this.centralBody.x - px;
                const bhdy = this.centralBody.y - py;
                const bhdistSq = bhdx * bhdx + bhdy * bhdy + 100;
                const bhdist = Math.sqrt(bhdistSq);
                const bhacc = (this.G * this.centralBody.mass) / bhdistSq;
                
                pvx += (bhdx / bhdist) * bhacc * this.timeStep;
                pvy += (bhdy / bhdist) * bhacc * this.timeStep;

                px += pvx * this.timeStep;
                py += pvy * this.timeStep;

                if (step % 2 === 0) {
                    this.ctx.beginPath();
                    this.ctx.arc(px, py, 2, 0, Math.PI * 2);
                    this.ctx.fill();
                }
            }
        }
    }

    animate() {
        if (!this.isPaused) {
            this.updatePhysics();
        }
        this.draw();
        requestAnimationFrame(() => this.animate());
    }
}
