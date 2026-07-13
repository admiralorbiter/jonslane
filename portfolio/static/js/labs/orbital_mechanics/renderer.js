/**
 * Orbital Mechanics Sandbox 3D WebGL Renderer (Three.js)
 * Implements:
 *  1. WebGL Scene, perspective camera, OrbitControls
 *  2. Procedural celestial spheres & ring meshes
 *  3. Fading trajectory trails (ring buffer + vertex shaders)
 *  4. Keplerian prediction arcs & ghost orbit overlays
 *  5. Sphere of Influence (SOI) transparent boundary spheres
 *  6. Camera shake feedback during burns
 */

const OrbitRenderer = (function () {
    let container = null;
    let scene = null;
    let camera = null;
    let webglRenderer = null;
    let controls = null;

    // Mesh maps
    let meshes = {};
    let soiMeshes = {};
    let orbitsGroup = null;

    // Trajectory trails
    let shipTrailLine = null;
    let shipTrailGeom = null;
    let shipTrailPositions = null;
    let shipTrailAlphas = null;
    const TRAIL_MAX = 2048;
    let trailHead = 0;
    let trailCount = 0;

    // Ghost trail
    let ghostLine = null;
    let ghostGeom = null;

    // Predicted path
    let predictionLine = null;
    let predictionGeom = null;
    let plannedPredictionLine = null;
    let plannedPredictionGeom = null;

    // Scene scaling factors (Three.js units vs SI meters)
    // We adjust scale depending on active parent body to keep visualization in view
    let activeScale = 1.0; 
    let parentOffsets = {}; // Position of planets in world space

    // Camera shake intensity
    let shakeIntensity = 0.0;
    let cameraLockMode = "follow"; // 'follow' or 'free'

    // Thruster Particle System
    const PARTICLE_COUNT = 128;
    let particlePositions = null;
    let particleAlphas = null;
    let particleGeom = null;
    let particleMesh = null;
    let particleVelocities = [];
    let particleAges = [];
    let particleMaxAge = [];
    let particleWriteHead = 0;

    // Post-processing
    let composer = null;
    let bloomPass = null;

    /**
     * Initializes the Three.js WebGL context inside the targeted HTML wrapper.
     */
    function init(domElementId) {
        container = document.getElementById(domElementId);
        if (!container) return;

        // Create Scene & group
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x010103);
        orbitsGroup = new THREE.Group();
        scene.add(orbitsGroup);

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.25);
        scene.add(ambientLight);

        const sunLight = new THREE.PointLight(0xffffff, 1.6, 0, 0); // infinite range
        sunLight.position.set(0, 0, 0);
        scene.add(sunLight);

        // Camera
        const width = container.clientWidth || 800;
        const height = container.clientHeight || 500;
        camera = new THREE.PerspectiveCamera(50, width / height, 0.05, 5000);
        camera.position.set(0, 0, 15);

        // WebGL Renderer
        webglRenderer = new THREE.WebGLRenderer({ antialias: true });
        webglRenderer.setSize(width, height);
        webglRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(webglRenderer.domElement);

        // Controls
        controls = new THREE.OrbitControls(camera, webglRenderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.maxDistance = 1500;
        controls.minDistance = 0.1;

        // Bind mouse click listener on the canvas for node placement
        webglRenderer.domElement.addEventListener("click", onCanvasClick);

        // Build Space objects meshes
        createCelestialMeshes();
        createStarfield();

        // Build trails
        initTrajectoryTrails();
        initPredictionLines();
        initThrusterParticles();
        initPostProcessing();

        // Handle resizing
        window.addEventListener("resize", onWindowResize);

        // Initial render trigger
        animate();
    }

    /**
     * Raycasts mouse clicks onto the z=0 orbital plane to select/place planned burn nodes.
     * Snaps clicks to the nearest visual prediction line point.
     */
    function onCanvasClick(e) {
        if (!webglRenderer || !OrbitCampaign) return;

        const rect = webglRenderer.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2(
            ((e.clientX - rect.left) / rect.width) * 2 - 1,
            -((e.clientY - rect.top) / rect.height) * 2 + 1
        );

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, camera);

        // Intersect with orbital plane (z=0)
        const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
        const intersection = new THREE.Vector3();
        if (raycaster.ray.intersectPlane(plane, intersection)) {
            // Find the closest point in the visual Three.js prediction line
            if (!predictionGeom) return;
            const predPositions = predictionGeom.attributes.position.array;
            const count = 512;
            let minThreeDistance = Infinity;
            let closestIndex = 0;

            for (let i = 0; i < count; i++) {
                const px = predPositions[i * 3];
                const py = predPositions[i * 3 + 1];
                const pz = predPositions[i * 3 + 2];
                
                const dist = Math.sqrt(
                    Math.pow(px - intersection.x, 2) +
                    Math.pow(py - intersection.y, 2)
                );
                if (dist < minThreeDistance) {
                    minThreeDistance = dist;
                    closestIndex = i;
                }
            }

            // Only snap and place node if click is visually close to the trajectory line (within threshold)
            if (minThreeDistance < 0.45) {
                OrbitCampaign.handleCanvasSnapClick(closestIndex);
            }
        }
    }

    /**
     * Creates procedural planet shapes, colors, and Saturn's rings.
     */
    function createCelestialMeshes() {
        const bodyKeys = Object.keys(PhysicsSolver.BODIES);
        
        bodyKeys.forEach(key => {
            const body = PhysicsSolver.BODIES[key];
            let geom, mat;

            if (key === "sun") {
                geom = new THREE.SphereGeometry(1.0, 32, 32);
                mat = new THREE.MeshBasicMaterial({ color: body.color });
            } else if (key === "earth") {
                geom = new THREE.SphereGeometry(0.4, 32, 32);
                mat = new THREE.ShaderMaterial({
                    uniforms: {
                        uTime:       { value: 0.0 },
                        uOceanColor: { value: new THREE.Color(0x0a3d6b) },
                        uLandColor:  { value: new THREE.Color(0x2d5a27) },
                        uIceColor:   { value: new THREE.Color(0xeef5f9) },
                        uCloudColor: { value: new THREE.Color(0xffffff) },
                        uSunDir:     { value: new THREE.Vector3(1.0, 0.5, 1.0).normalize() }
                    },
                    vertexShader: `
                        varying vec2 vUv;
                        varying vec3 vNormal;
                        varying vec3 vWorldPos;
                        void main() {
                            vUv = uv;
                            vNormal = normalize(mat3(modelMatrix) * normal);
                            vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
                            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                        }
                    `,
                    fragmentShader: `
                        uniform float uTime;
                        uniform vec3  uOceanColor;
                        uniform vec3  uLandColor;
                        uniform vec3  uIceColor;
                        uniform vec3  uCloudColor;
                        uniform vec3  uSunDir;
                        varying vec2  vUv;
                        varying vec3  vNormal;
                        varying vec3  vWorldPos;

                        float hash(vec2 p) {
                            p = fract(p * vec2(127.1, 311.7));
                            p += dot(p, p + 19.19);
                            return fract(p.x * p.y);
                        }

                        float valueNoise(vec2 p) {
                            vec2 i = floor(p);
                            vec2 f = fract(p);
                            vec2 u = f * f * (3.0 - 2.0 * f);
                            return mix(
                                mix(hash(i),           hash(i + vec2(1.0,0.0)), u.x),
                                mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x),
                                u.y
                            );
                        }

                        float fbm(vec2 p) {
                            float v = 0.0;
                            float amp = 0.5;
                            for (int i = 0; i < 4; i++) {
                                v += amp * valueNoise(p);
                                p  *= 2.0;
                                amp *= 0.5;
                            }
                            return v;
                        }

                        void main() {
                            float terrain = fbm(vUv * 5.0 + vec2(0.3, 0.7));
                            vec3 surfaceColor;
                            if (terrain > 0.58) {
                                float poleFactor = smoothstep(0.35, 0.05, abs(vUv.y - 0.5));
                                surfaceColor = mix(uLandColor, uIceColor, poleFactor + 0.3);
                            } else if (terrain > 0.44) {
                                surfaceColor = uLandColor;
                            } else {
                                surfaceColor = uOceanColor;
                            }

                            // cloud layer
                            vec2 cloudUV = vUv + vec2(uTime * 0.005, 0.0);
                            float warpX = valueNoise(cloudUV * 3.0 + vec2(1.7, 9.2));
                            float warpY = valueNoise(cloudUV * 3.0 + vec2(8.3, 2.8));
                            vec2 warpedUV = cloudUV * 4.0 + vec2(warpX, warpY) * 0.4;
                            float clouds = smoothstep(0.55, 0.75, fbm(warpedUV));
                            surfaceColor = mix(surfaceColor, uCloudColor, clouds * 0.85);

                            // sun lighting
                            float diff = max(0.0, dot(normalize(vNormal), normalize(uSunDir)));
                            float ambient = 0.25;
                            float light = ambient + (1.0 - ambient) * diff;

                            gl_FragColor = vec4(surfaceColor * light, 1.0);
                        }
                    `
                });
            } else {
                geom = new THREE.SphereGeometry(0.4, 32, 32);
                mat = new THREE.MeshStandardMaterial({
                    color: body.color,
                    roughness: 0.8,
                    metalness: 0.1
                });
            }

            const mesh = new THREE.Mesh(geom, mat);
            scene.add(mesh);
            meshes[key] = mesh;

            // Sun corona glow shells
            if (key === "sun") {
                const coronaColor = 0xffaa00;
                for (let i = 1.05; i <= 1.35; i += 0.08) {
                    const coronaGeom = new THREE.SphereGeometry(1.0, 32, 32);
                    const coronaMat = new THREE.MeshBasicMaterial({
                        color: coronaColor,
                        transparent: true,
                        opacity: 0.12 / i,
                        blending: THREE.AdditiveBlending,
                        depthWrite: false
                    });
                    const coronaMesh = new THREE.Mesh(coronaGeom, coronaMat);
                    coronaMesh.scale.set(i, i, i);
                    mesh.add(coronaMesh);
                }
            }

            // Earth & Mars Atmosphere Limb Glow Shaders
            if (key === "earth" || key === "mars") {
                const atmosColor = key === "earth" ? 0x4fc3f7 : 0xff7043;
                const atmosGeom = new THREE.SphereGeometry(0.4, 32, 32);
                const atmosMat = new THREE.ShaderMaterial({
                    transparent: true,
                    side: THREE.BackSide,
                    depthWrite: false,
                    uniforms: {
                        uAtmosColor: { value: new THREE.Color(atmosColor) },
                        uRimPower:   { value: 3.5 },
                        uOpacity:    { value: 0.65 }
                    },
                    vertexShader: `
                        varying vec3 vWorldNormal;
                        varying vec3 vWorldPos;
                        void main() {
                            vWorldNormal = normalize(mat3(modelMatrix) * normal);
                            vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
                            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                        }
                    `,
                    fragmentShader: `
                        uniform vec3  uAtmosColor;
                        uniform float uRimPower;
                        uniform float uOpacity;
                        varying vec3  vWorldNormal;
                        varying vec3  vWorldPos;
                        void main() {
                            vec3 viewDir = normalize(cameraPosition - vWorldPos);
                            float rim = 1.0 - max(0.0, dot(vWorldNormal, viewDir));
                            float atmos = pow(rim, uRimPower);
                            gl_FragColor = vec4(uAtmosColor, atmos * uOpacity);
                        }
                    `
                });
                const atmosMesh = new THREE.Mesh(atmosGeom, atmosMat);
                atmosMesh.scale.set(1.08, 1.08, 1.08);
                mesh.add(atmosMesh);
            }

            // Saturn's rings
            if (key === "saturn") {
                const ringGeom = new THREE.RingGeometry(0.55, 0.9, 32);
                const ringMat = new THREE.MeshBasicMaterial({
                    color: 0xe0cda9,
                    side: THREE.DoubleSide,
                    transparent: true,
                    opacity: 0.6
                });
                const ringMesh = new THREE.Mesh(ringGeom, ringMat);
                ringMesh.rotation.x = Math.PI / 2.3; // inclined slightly
                mesh.add(ringMesh);
            }

            // Create SOI boundary overlay shells
            if (body.soi) {
                const soiGeom = new THREE.SphereGeometry(1.0, 24, 24);
                const soiMat = new THREE.MeshBasicMaterial({
                    color: 0x4488ff,
                    transparent: true,
                    opacity: 0.04,
                    depthWrite: false,
                    wireframe: false
                });
                const soiMesh = new THREE.Mesh(soiGeom, soiMat);
                scene.add(soiMesh);
                soiMeshes[key] = soiMesh;
            }
        });

        // Spacecraft mesh (cone pointing upward in local coords)
        const shipGeom = new THREE.ConeGeometry(0.06, 0.16, 4);
        shipGeom.rotateX(Math.PI / 2); // align with heading rotation plane
        const shipMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc });
        const shipMesh = new THREE.Mesh(shipGeom, shipMat);
        scene.add(shipMesh);
        meshes.ship = shipMesh;

        // Thrust flame mesh (orange cone pointing backward relative to heading)
        const flameGeom = new THREE.ConeGeometry(0.03, 0.12, 4);
        flameGeom.rotateX(Math.PI / 2);
        flameGeom.translate(0, -0.14, 0); // mount at rocket's base nozzle
        const flameMat = new THREE.MeshBasicMaterial({ color: 0xff4400 });
        const flameMesh = new THREE.Mesh(flameGeom, flameMat);
        flameMesh.visible = false;
        shipMesh.add(flameMesh);
        meshes.flame = flameMesh;

        // Visual Maneuver Node marker mesh (purple glowing sphere)
        const nodeGeom = new THREE.SphereGeometry(0.06, 16, 16);
        const nodeMat = new THREE.MeshBasicMaterial({ color: 0xff00ff });
        const nodeMarker = new THREE.Mesh(nodeGeom, nodeMat);
        nodeMarker.visible = false;
        scene.add(nodeMarker);
        meshes.nodeMarker = nodeMarker;
    }

    /**
     * Initializes the custom shader line-trail geometry.
     */
    function initTrajectoryTrails() {
        shipTrailPositions = new Float32Array(TRAIL_MAX * 3);
        shipTrailAlphas = new Float32Array(TRAIL_MAX);

        // Prepopulate alphas
        for (let i = 0; i < TRAIL_MAX; i++) {
            shipTrailAlphas[i] = 0.0;
        }

        shipTrailGeom = new THREE.BufferGeometry();
        shipTrailGeom.setAttribute("position", new THREE.BufferAttribute(shipTrailPositions, 3));
        shipTrailGeom.setAttribute("aAlpha", new THREE.BufferAttribute(shipTrailAlphas, 1));

        // Vertex & Fragment Shaders for alpha fading
        const trailMat = new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            vertexShader: `
                attribute float aAlpha;
                varying float vAlpha;
                void main() {
                    vAlpha = aAlpha;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 uColor;
                varying float vAlpha;
                void main() {
                    gl_FragColor = vec4(uColor, vAlpha);
                }
            `,
            uniforms: {
                uColor: { value: new THREE.Color(0x00ff88) }
            }
        });

        shipTrailLine = new THREE.Line(shipTrailGeom, trailMat);
        orbitsGroup.add(shipTrailLine);
    }

    /**
     * Set up prediction and ghost trajectory buffers.
     */
    function initPredictionLines() {
        // Dynamic buffer geometries
        predictionGeom = new THREE.BufferGeometry();
        const predPositions = new Float32Array(512 * 3);
        predictionGeom.setAttribute("position", new THREE.BufferAttribute(predPositions, 3));
        
        const predMat = new THREE.LineDashedMaterial({
            color: 0x00f2fe,
            dashSize: 0.15,
            gapSize: 0.1,
            transparent: true,
            opacity: 0.55
        });
        
        predictionLine = new THREE.Line(predictionGeom, predMat);
        orbitsGroup.add(predictionLine);

        // Planned prediction line (Gold/Orange dashed line)
        plannedPredictionGeom = new THREE.BufferGeometry();
        const plannedPositions = new Float32Array(512 * 3);
        plannedPredictionGeom.setAttribute("position", new THREE.BufferAttribute(plannedPositions, 3));

        const plannedMat = new THREE.LineDashedMaterial({
            color: 0xffaa00,
            dashSize: 0.15,
            gapSize: 0.1,
            transparent: true,
            opacity: 0.75
        });
        plannedPredictionLine = new THREE.Line(plannedPredictionGeom, plannedMat);
        plannedPredictionLine.visible = false;
        orbitsGroup.add(plannedPredictionLine);

        // Ghost trail
        ghostGeom = new THREE.BufferGeometry();
        const ghostPositions = new Float32Array(TRAIL_MAX * 3);
        ghostGeom.setAttribute("position", new THREE.BufferAttribute(ghostPositions, 3));

        const ghostMat = new THREE.LineBasicMaterial({
            color: 0x555566,
            transparent: true,
            opacity: 0.25
        });
        ghostLine = new THREE.Line(ghostGeom, ghostMat);
        orbitsGroup.add(ghostLine);
    }

    /**
     * Dynamically sets scales depending on active parent body reference frame.
     */
    function updateCoordinateScales(parentKey) {
        if (parentKey === "sun") {
            // Solar System Scale: 1 AU = 20 Three.js units
            activeScale = 20 / PhysicsSolver.BODIES.earth.orbitalRadius;
        } else if (parentKey === "earth" || parentKey === "moon") {
            // Earth System Scale: Earth radius = 1.0 Three.js units
            activeScale = 1.0 / PhysicsSolver.BODIES.earth.radius;
        } else {
            // Fallback
            activeScale = 1.0 / PhysicsSolver.BODIES[parentKey].radius;
        }
    }

    /**
     * Translates local parent frame coordinate to World Three.js coordinate.
     */
    function toRenderCoordinates(posLocal, parentKey, bodiesWorld) {
        const offset = parentOffsets[parentKey] || { x: 0, y: 0, z: 0 };
        return {
            x: (posLocal.x + offset.x) * activeScale,
            y: (posLocal.y + offset.y) * activeScale,
            z: (posLocal.z + offset.z) * activeScale
        };
    }

    /**
     * Pushes a new position to the fading trajectory trail.
     */
    function pushTrailPoint(posWorld) {
        const idx = trailHead * 3;
        shipTrailPositions[idx] = posWorld.x * activeScale;
        shipTrailPositions[idx + 1] = posWorld.y * activeScale;
        shipTrailPositions[idx + 2] = posWorld.z * activeScale;

        trailHead = (trailHead + 1) % TRAIL_MAX;
        trailCount = Math.min(trailCount + 1, TRAIL_MAX);

        // Recalculate fading alphas back from head index
        for (let i = 0; i < TRAIL_MAX; i++) {
            let relativeIdx = (trailHead - 1 - i + TRAIL_MAX) % TRAIL_MAX;
            if (i < trailCount) {
                // Exponential decay along the ring buffer
                shipTrailAlphas[relativeIdx] = 0.8 * Math.pow(1.0 - i / trailCount, 1.6);
            } else {
                shipTrailAlphas[relativeIdx] = 0.0;
            }
        }

        shipTrailGeom.attributes.position.needsUpdate = true;
        shipTrailGeom.attributes.aAlpha.needsUpdate = true;
    }

    /**
     * Wipes active trail.
     */
    function clearTrail() {
        trailHead = 0;
        trailCount = 0;
        for (let i = 0; i < TRAIL_MAX; i++) {
            shipTrailAlphas[i] = 0.0;
            shipTrailPositions[i*3] = 0;
            shipTrailPositions[i*3+1] = 0;
            shipTrailPositions[i*3+2] = 0;
        }
        shipTrailGeom.attributes.position.needsUpdate = true;
        shipTrailGeom.attributes.aAlpha.needsUpdate = true;
    }

    /**
     * Captures a snapshot of the current trail as a Ghost line.
     */
    function saveGhostTrail() {
        const ghostPositions = ghostGeom.attributes.position.array;
        
        // Copy positions exactly as they are currently displayed
        for (let i = 0; i < TRAIL_MAX * 3; i++) {
            ghostPositions[i] = shipTrailPositions[i];
        }
        ghostGeom.attributes.position.needsUpdate = true;
    }

    /**
     * Wipes ghost trail.
     */
    function clearGhostTrail() {
        const ghostPositions = ghostGeom.attributes.position.array;
        for (let i = 0; i < TRAIL_MAX * 3; i++) {
            ghostPositions[i] = 0;
        }
        ghostGeom.attributes.position.needsUpdate = true;
    }

    /**
     * Renders predicted Keplerian trajectory lines.
     */
    function drawPrediction(predPointsLocal, parentKey, bodiesWorld, elements) {
        const predPositions = predictionGeom.attributes.position.array;
        const maxPoints = 512;

        let ptCount = Math.min(predPointsLocal.length, maxPoints);

        for (let i = 0; i < maxPoints; i++) {
            const idx = i * 3;
            if (i < ptCount) {
                const ptRender = toRenderCoordinates(predPointsLocal[i], parentKey, bodiesWorld);
                predPositions[idx] = ptRender.x;
                predPositions[idx + 1] = ptRender.y;
                predPositions[idx + 2] = ptRender.z;
            } else {
                // Collapse extra points to final valid coordinate
                const lastPt = toRenderCoordinates(predPointsLocal[ptCount - 1] || {x:0, y:0, z:0}, parentKey, bodiesWorld);
                predPositions[idx] = lastPt.x;
                predPositions[idx + 1] = lastPt.y;
                predPositions[idx + 2] = lastPt.z;
            }
        }

        // Color coding prediction line based on eccentricity and atmosphere limits
        if (elements && predictionLine && predictionLine.material) {
            const ecc = elements.eccentricity;
            const parentBody = PhysicsSolver.BODIES[parentKey];
            
            if (parentBody.atmosphereLimit && elements.periapsisAltitude < parentBody.atmosphereLimit) {
                // Decaying / atmosphere-crossing orbit
                predictionLine.material.color.setHex(0xff007f); // Neon Magenta/Pink
            } else if (ecc >= 1.0) {
                // Escape / Hyperbolic
                predictionLine.material.color.setHex(0xef4444); // Neon Red
            } else if (ecc > 0.01) {
                // Elliptical
                predictionLine.material.color.setHex(0xf59e0b); // Neon Amber
            } else {
                // Circular
                predictionLine.material.color.setHex(0x10b981); // Neon Emerald Green
            }
        }

        predictionGeom.attributes.position.needsUpdate = true;
        if (predictionLine.computeLineDistances) {
            predictionLine.computeLineDistances(); // required for dashed line
        }
    }

    /**
     * Renders predicted planned trajectory lines for maneuver nodes.
     */
    function drawPlannedPrediction(plannedPointsLocal, parentKey, bodiesWorld) {
        if (!plannedPredictionLine) return;
        plannedPredictionLine.visible = true;

        const plannedPredPositions = plannedPredictionGeom.attributes.position.array;
        const maxPoints = 512;

        let ptCount = Math.min(plannedPointsLocal.length, maxPoints);

        for (let i = 0; i < maxPoints; i++) {
            const idx = i * 3;
            if (i < ptCount) {
                const ptRender = toRenderCoordinates(plannedPointsLocal[i], parentKey, bodiesWorld);
                plannedPredPositions[idx] = ptRender.x;
                plannedPredPositions[idx + 1] = ptRender.y;
                plannedPredPositions[idx + 2] = ptRender.z;
            } else {
                const lastPt = toRenderCoordinates(plannedPointsLocal[ptCount - 1] || {x:0, y:0, z:0}, parentKey, bodiesWorld);
                plannedPredPositions[idx] = lastPt.x;
                plannedPredPositions[idx + 1] = lastPt.y;
                plannedPredPositions[idx + 2] = lastPt.z;
            }
        }

        plannedPredictionGeom.attributes.position.needsUpdate = true;
        if (plannedPredictionLine.computeLineDistances) {
            plannedPredictionLine.computeLineDistances();
        }
    }

    /**
     * Hides the planned prediction line.
     */
    function hidePlannedPrediction() {
        if (plannedPredictionLine) {
            plannedPredictionLine.visible = false;
        }
    }

    /**
     * Triggers screen shakes during thust/collision events.
     */
    function triggerCameraShake(intensity) {
        shakeIntensity = Math.min(shakeIntensity + intensity, 0.45);
    }

    /**
     * Updates positions of celestial sphere meshes and camera.
     */
    function update(bodiesWorld, shipState, showSOI, frameToggleState) {
        if (!scene) return;

        // 1. Calculate parents offsets relative to active frame
        const currentParentKey = shipState.parentKey;
        updateCoordinateScales(currentParentKey);

        parentOffsets = {};
        const keys = Object.keys(PhysicsSolver.BODIES);
        
        keys.forEach(key => {
            if (frameToggleState === "world" || key === "sun") {
                // Standard heliocentric coordinates
                parentOffsets[key] = { ...bodiesWorld[key].pos };
            } else {
                // Translate everything relative to active planet frame (locked at center)
                const centerPos = bodiesWorld[frameToggleState].pos;
                parentOffsets[key] = {
                    x: bodiesWorld[key].pos.x - centerPos.x,
                    y: bodiesWorld[key].pos.y - centerPos.y,
                    z: bodiesWorld[key].pos.z - centerPos.z
                };
            }
        });

        // Special override: parentOffset of parent is 0 if locked
        if (frameToggleState !== "world") {
            parentOffsets[frameToggleState] = { x: 0, y: 0, z: 0 };
        }

        // 2. Position celestial spheres
        keys.forEach(key => {
            const mesh = meshes[key];
            const soiMesh = soiMeshes[key];
            const body = PhysicsSolver.BODIES[key];

            const renderPos = toRenderCoordinates({x:0, y:0, z:0}, key, bodiesWorld);
            mesh.position.set(renderPos.x, renderPos.y, renderPos.z);
            
            // Re-scale mesh to match display scale
            const displayScale = body.radius * activeScale;
            mesh.scale.set(displayScale, displayScale, displayScale);

            // Position & scale SOI bubbles
            if (soiMesh) {
                soiMesh.position.set(renderPos.x, renderPos.y, renderPos.z);
                const soiDisplayScale = body.soi * activeScale;
                soiMesh.scale.set(soiDisplayScale, soiDisplayScale, soiDisplayScale);
                soiMesh.visible = showSOI;
            }
        });

        // 3. Position Spacecraft Cone & Orient pointing along ship heading
        const shipLocalPos = shipState.pos;
        const shipRenderPos = toRenderCoordinates(shipLocalPos, currentParentKey, bodiesWorld);
        
        meshes.ship.position.set(shipRenderPos.x, shipRenderPos.y, shipRenderPos.z);

        // Align ship quaternion pointing along heading angle
        const headingAngle = shipState.heading !== undefined ? shipState.heading : 0;
        const dir = new THREE.Vector3(Math.cos(headingAngle), Math.sin(headingAngle), 0).normalize();
        const up = new THREE.Vector3(0, 0, 1);
        const quaternion = new THREE.Quaternion().setFromUnitVectors(up, dir);
        meshes.ship.quaternion.copy(quaternion);

        // Animate thrust flame glow
        if (meshes.flame) {
            meshes.flame.visible = !!shipState.isThrusting;
            if (shipState.isThrusting) {
                // Animate flame flicker
                meshes.flame.scale.set(1, 1 + Math.random() * 0.5, 1);
            }
        }

        // Animate engine exhaust particles
        updateThrusterParticles(shipRenderPos, headingAngle, shipState.isThrusting);

        // Handle atmospheric entry ionization glow on ship mesh
        if (meshes.ship && meshes.ship.material) {
            const parentBody = PhysicsSolver.BODIES[currentParentKey];
            const shipAltKM = (Math.sqrt(shipState.pos.x*shipState.pos.x + shipState.pos.y*shipState.pos.y) - parentBody.radius) / 1000;
            if (parentBody.atmosphereLimit && shipAltKM * 1000 < parentBody.atmosphereLimit) {
                // Glow red-orange when descending into atmosphere
                const depth = 1.0 - (shipAltKM * 1000 / parentBody.atmosphereLimit);
                meshes.ship.material.color.setRGB(1.0, 1.0 - depth * 0.7, 1.0 - depth);
            } else {
                // Restore nominal ship color (cyan)
                meshes.ship.material.color.setHex(0x00ffcc);
            }
        }

        // 3.5 Position visual Maneuver Node marker if active
        if (shipState.activeNodePos) {
            const nodeRenderPos = toRenderCoordinates(shipState.activeNodePos, currentParentKey, bodiesWorld);
            meshes.nodeMarker.position.set(nodeRenderPos.x, nodeRenderPos.y, nodeRenderPos.z);
            meshes.nodeMarker.visible = true;
        } else {
            if (meshes.nodeMarker) {
                meshes.nodeMarker.visible = false;
            }
        }

        // 4. Push point to trail
        pushTrailPoint(shipState.posWorld);

        // 5. Camera follow tracking lock
        if (cameraLockMode === "follow" && controls) {
            controls.target.set(shipRenderPos.x, shipRenderPos.y, shipRenderPos.z);
        }
    }

    /**
     * Main animation loop.
     */
    function animate() {
        if (!webglRenderer) return;

        requestAnimationFrame(animate);

        // Update controls
        if (controls) {
            controls.update();
        }

        // Apply camera shake if firing engine
        if (shakeIntensity > 0.005) {
            const dx = (Math.random() - 0.5) * shakeIntensity;
            const dy = (Math.random() - 0.5) * shakeIntensity;
            const dz = (Math.random() - 0.5) * shakeIntensity;
            camera.position.add(new THREE.Vector3(dx, dy, dz));
            shakeIntensity *= 0.90; // dampening
        }

        // Increment procedural Earth shader time uniform
        if (meshes.earth && meshes.earth.material && meshes.earth.material.uniforms && meshes.earth.material.uniforms.uTime) {
            meshes.earth.material.uniforms.uTime.value += 0.016;
        }

        // Render scene
        if (composer) {
            composer.render();
        } else {
            webglRenderer.render(scene, camera);
        }
    }

    /**
     * Creates a large-scale parallax WebGL starfield.
     */
    function createStarfield() {
        const STAR_COUNT = 3000;
        const positions = new Float32Array(STAR_COUNT * 3);
        const colors    = new Float32Array(STAR_COUNT * 3);
        const sizes     = new Float32Array(STAR_COUNT);

        for (let i = 0; i < STAR_COUNT; i++) {
            const i3 = i * 3;

            // Generate points on a sphere shell
            let x, y, z, r;
            do {
                x = (Math.random() - 0.5) * 2;
                y = (Math.random() - 0.5) * 2;
                z = (Math.random() - 0.5) * 2;
                r = Math.sqrt(x*x + y*y + z*z);
            } while (r > 1.0 || r < 0.3);

            const RADIUS = 1200;
            positions[i3]     = (x / r) * RADIUS;
            positions[i3 + 1] = (y / r) * RADIUS;
            positions[i3 + 2] = (z / r) * RADIUS - 800; // bias background Z

            // Color variation: mostly white, some blue-white/yellow-white
            const colorRoll = Math.random();
            if (colorRoll < 0.6) {
                colors[i3] = 0.95 + Math.random() * 0.05;
                colors[i3+1] = 0.95 + Math.random() * 0.05;
                colors[i3+2] = 0.95 + Math.random() * 0.05;
            } else if (colorRoll < 0.8) {
                colors[i3] = 0.75; colors[i3+1] = 0.88; colors[i3+2] = 1.0;
            } else {
                colors[i3] = 1.0; colors[i3+1] = 0.88; colors[i3+2] = 0.65;
            }

            sizes[i] = Math.random() < 0.05 ? 2.5 : (0.5 + Math.random() * 1.5);
        }

        const starGeom = new THREE.BufferGeometry();
        starGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        starGeom.setAttribute('color',    new THREE.BufferAttribute(colors, 3));
        starGeom.setAttribute('size',     new THREE.BufferAttribute(sizes, 1));

        const starMat = new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            vertexColors: true,
            uniforms: {
                uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) }
            },
            vertexShader: `
                attribute float size;
                varying vec3 vColor;
                uniform float uPixelRatio;
                void main() {
                    vColor = color;
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = size * uPixelRatio * (300.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                varying vec3 vColor;
                void main() {
                    vec2 uv = gl_PointCoord - 0.5;
                    float dist = length(uv);
                    if (dist > 0.5) discard;
                    float alpha = 1.0 - smoothstep(0.3, 0.5, dist);
                    gl_FragColor = vec4(vColor, alpha);
                }
            `
        });

        const stars = new THREE.Points(starGeom, starMat);
        scene.add(stars);
        meshes.starfield = stars;
    }

    /**
     * Initializes post-processing and full-screen bloom composer.
     */
    function initPostProcessing() {
        if (!webglRenderer || !scene || !camera) return;

        const renderPass = new THREE.RenderPass(scene, camera);
        
        bloomPass = new THREE.UnrealBloomPass(
            new THREE.Vector2(container.clientWidth, container.clientHeight),
            0.6,  // strength
            0.3,  // radius
            0.15  // threshold
        );

        composer = new THREE.EffectComposer(webglRenderer);
        composer.addPass(renderPass);
        composer.addPass(bloomPass);
    }

    /**
     * Resizes renderer boundaries to match flex wrapper.
     */
    function onWindowResize() {
        if (!container || !camera || !webglRenderer) return;
        const width = container.clientWidth;
        const height = container.clientHeight;

        camera.aspect = width / height;
        camera.updateProjectionMatrix();

        webglRenderer.setSize(width, height);
        if (composer) {
            composer.setSize(width, height);
        }
        if (bloomPass) {
            bloomPass.setSize(width, height);
        }
    }

    /**
     * Initializes the GPU-friendly circular pool of thruster particles.
     */
    function initThrusterParticles() {
        particlePositions = new Float32Array(PARTICLE_COUNT * 3);
        particleAlphas    = new Float32Array(PARTICLE_COUNT);

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            particleVelocities.push({ x: 0, y: 0, z: 0 });
            particleAges.push(999); // start as dead
            particleMaxAge.push(1.0);
        }

        particleGeom = new THREE.BufferGeometry();
        particleGeom.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
        particleGeom.setAttribute('aAlpha',   new THREE.BufferAttribute(particleAlphas, 1));

        const particleMat = new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            uniforms: {
                uColor1: { value: new THREE.Color(0xff6600) },  // hot orange
                uColor2: { value: new THREE.Color(0xffff00) },  // bright yellow core
                uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) }
            },
            vertexShader: `
                attribute float aAlpha;
                varying float vAlpha;
                uniform float uPixelRatio;
                void main() {
                    vAlpha = aAlpha;
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = max(1.0, 7.0 * aAlpha) * uPixelRatio;
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                uniform vec3 uColor1;
                uniform vec3 uColor2;
                varying float vAlpha;
                void main() {
                    vec2 uv = gl_PointCoord - 0.5;
                    float dist = length(uv);
                    if (dist > 0.5) discard;
                    float alpha = (1.0 - dist * 2.0) * vAlpha;
                    vec3 color = mix(uColor1, uColor2, 1.0 - dist * 2.0);
                    gl_FragColor = vec4(color, alpha);
                }
            `
        });

        particleMesh = new THREE.Points(particleGeom, particleMat);
        orbitsGroup.add(particleMesh);
    }

    /**
     * Updates and animates thruster particles.
     */
    function updateThrusterParticles(shipRenderPos, headingAngle, isThrusting) {
        const PARTICLE_DT = 1/60;

        if (isThrusting) {
            const SPAWN_PER_FRAME = 3;
            for (let s = 0; s < SPAWN_PER_FRAME; s++) {
                const idx = particleWriteHead % PARTICLE_COUNT;
                particleWriteHead++;

                const nozzleAngle = headingAngle + Math.PI; // opposite to heading
                const spread = (Math.random() - 0.5) * 0.35; // +/- 10 degrees
                const speed = 0.05 + Math.random() * 0.06;

                particleVelocities[idx] = {
                    x: Math.cos(nozzleAngle + spread) * speed,
                    y: Math.sin(nozzleAngle + spread) * speed,
                    z: (Math.random() - 0.5) * 0.005
                };

                const i3 = idx * 3;
                const offsetDistance = 0.08;
                particlePositions[i3]     = shipRenderPos.x + Math.cos(nozzleAngle) * offsetDistance;
                particlePositions[i3 + 1] = shipRenderPos.y + Math.sin(nozzleAngle) * offsetDistance;
                particlePositions[i3 + 2] = shipRenderPos.z;

                particleAges[idx] = 0.0;
                particleMaxAge[idx] = 0.3 + Math.random() * 0.3; // 0.3-0.6s lifetime
            }
        }

        // Update all alive/dead particles
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            particleAges[i] += PARTICLE_DT;
            const i3 = i * 3;

            if (particleAges[i] >= particleMaxAge[i]) {
                // Dead
                particlePositions[i3] = shipRenderPos.x;
                particlePositions[i3 + 1] = shipRenderPos.y;
                particlePositions[i3 + 2] = shipRenderPos.z;
                particleAlphas[i] = 0.0;
            } else {
                particlePositions[i3]     += particleVelocities[i].x;
                particlePositions[i3 + 1]     += particleVelocities[i].y;
                particlePositions[i3 + 2]     += particleVelocities[i].z;

                const life = particleAges[i] / particleMaxAge[i];
                particleAlphas[i] = (1.0 - life) * (isThrusting ? 0.9 : 0.6);
            }
        }

        particleGeom.attributes.position.needsUpdate = true;
        particleGeom.attributes.aAlpha.needsUpdate = true;
    }

    /**
     * Converts a 3D Three.js coordinate to screen pixel coordinates relative to canvas wrapper.
     */
    function projectCoordinates(posLocal, parentKey, bodiesWorld) {
        if (!camera || !container) return null;

        const ptRender = toRenderCoordinates(posLocal, parentKey, bodiesWorld);
        const tempV = new THREE.Vector3(ptRender.x, ptRender.y, ptRender.z);
        tempV.project(camera);

        if (tempV.z > 1.0) return null; // Behind camera

        const rect = webglRenderer.domElement.getBoundingClientRect();
        return {
            x: ((tempV.x * 0.5 + 0.5) * rect.width),
            y: ((-tempV.y * 0.5 + 0.5) * rect.height)
        };
    }

    function setCameraLockMode(mode) {
        cameraLockMode = mode;
        if (mode === "follow" && meshes.ship && controls) {
            controls.target.copy(meshes.ship.position);
        }
    }

    function getCameraLockMode() {
        return cameraLockMode;
    }

    /**
     * Spawns a high-velocity particle ring at the spacecraft location to celebrate victory.
     */
    function triggerVictoryBurst() {
        if (!meshes.ship) return;
        const shipPos = meshes.ship.position.clone();

        const BURST_COUNT = 60;
        for (let i = 0; i < BURST_COUNT; i++) {
            const idx = particleWriteHead % PARTICLE_COUNT;
            particleWriteHead++;

            const angle = (i / BURST_COUNT) * Math.PI * 2;
            const speed = 0.08 + Math.random() * 0.1;

            particleVelocities[idx] = {
                x: Math.cos(angle) * speed,
                y: Math.sin(angle) * speed,
                z: (Math.random() - 0.5) * 0.02
            };

            const i3 = idx * 3;
            particlePositions[i3]     = shipPos.x;
            particlePositions[i3 + 1] = shipPos.y;
            particlePositions[i3 + 2] = shipPos.z;

            particleAges[idx] = 0.0;
            particleMaxAge[idx] = 0.8 + Math.random() * 0.4;
        }
    }

    // Public API
    return {
        init,
        update,
        clearTrail,
        saveGhostTrail,
        clearGhostTrail,
        drawPrediction,
        drawPlannedPrediction,
        hidePlannedPrediction,
        triggerCameraShake,
        toRenderCoordinates,
        setCameraLockMode,
        getCameraLockMode,
        projectCoordinates,
        triggerVictoryBurst
    };
})();
