// threeScene.js
// Handles the Three.js 3D scene for the grillworst game.
// Optimized for iPad PWA.

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.module.js';

class ThreeScene {
    constructor(containerElement, callbacks) {
        this.container = containerElement;
        this.callbacks = callbacks;

        // Scene elements
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        // Objects
        this.ground = null;
        this.platforms = [];
        this.grillworst = null;
        this.platformLabels = [];

        // In de constructor
        this.bubbles = [];

        // Animation management
        this.animations = [];
        this.clock = new THREE.Clock();
        this.running = true; // Control flag for render loop

        // Victory mode
        this.victoryMode = false;
        this.victoryStartTime = 0;
        this.lastVictoryConfettiTick = -1;

        // Random camera tracking
        this.lastCameraIndex = -1;

        // State
        this.isAnimating = false;
        this.grillworstPosition = new THREE.Vector3(0, 1, 5); // Starting position

        this.init();
        this.setupEventListeners();
    }

    init() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87ceeb); // Sky blue

        // Camera - Perspective with isometric-like view
        const aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);
        this.camera.position.set(8, 6, 8);
        this.camera.lookAt(0, 0, 0);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // Limit for performance
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);


        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 10, 5);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 1024;
        directionalLight.shadow.mapSize.height = 1024;
        this.scene.add(directionalLight);

        // Ground - Lava plane
        this.createGround();

        // Platforms
        this.createPlatforms();

        // Grillworst
        this.createGrillworst();

        // Start render loop
        this.animate();
    }

    createGround() {
            // Gebruik meer segmenten (32, 32) zodat we eventueel golven kunnen toevoegen
            const geometry = new THREE.PlaneGeometry(30, 30, 32, 32);
            const material = new THREE.ShaderMaterial({
                uniforms: {
                    time: { value: 0 },
                    color1: { value: new THREE.Color(0xff2200) }, // Diep rood/oranje
                    color2: { value: new THREE.Color(0xffaa00) }  // Helder geel/oranje
                },
                vertexShader: `
                    varying vec2 vUv;
                    uniform float time;
                    void main() {
                        vUv = uv;
                        // Voeg een subtiele golvende beweging toe aan de vertexen
                        vec3 pos = position;
                        pos.z += sin(pos.x * 0.5 + time) * 0.1;
                        pos.z += cos(pos.y * 0.5 + time) * 0.1;
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
                    }
                `,
                fragmentShader: `
                    uniform float time;
                    uniform vec3 color1;
                    uniform vec3 color2;
                    varying vec2 vUv;

                    // Simpele noise functie voor bubbel-vlekken
                    float noise(vec2 p) {
                        return sin(p.x * 10.0 + time) * sin(p.y * 10.0 + time * 0.5);
                    }

                    void main() {
                        float n = noise(vUv);
                        // Mix kleuren op basis van tijd en positie
                        float pattern = sin(vUv.x * 5.0 + time * 0.5) * cos(vUv.y * 5.0 - time * 0.2);
                        vec3 color = mix(color1, color2, pattern * 0.5 + 0.5);
                        
                        // Voeg "hot spots" toe
                        if(n > 0.95) color += 0.2;
                        
                        gl_FragColor = vec4(color, 1.0);
                    }
                `
            });
            this.ground = new THREE.Mesh(geometry, material);
            this.ground.rotation.x = -Math.PI / 2;
            this.ground.position.y = -0.55; // Iets lager om z-fighting te voorkomen
            this.scene.add(this.ground);
            
            // Start het bubbel systeem
            this.initBubbles();
        }

    createPlatforms() {
        const positions = [
            new THREE.Vector3(-3, 0.5, -2),
            new THREE.Vector3(3, 0.5, -2),
            new THREE.Vector3(-3, 0.5, 2),
            new THREE.Vector3(3, 0.5, 2)
        ];

        positions.forEach((pos, index) => {
            const geometry = new THREE.BoxGeometry(1.5, 0.5, 1.5, 4, 4, 4); // Low poly
            const material = new THREE.MeshLambertMaterial({ color: 0x4a90e2 }); // Blue
            const platform = new THREE.Mesh(geometry, material);
            platform.position.copy(pos);
            platform.userData.index = index;
            platform.castShadow = true;
            platform.receiveShadow = true;
            this.platforms.push(platform);
            this.scene.add(platform);

            // Label sprite
            const label = this.createTextSprite('');
            label.position.set(pos.x, pos.y + 0.8, pos.z);
            this.platformLabels.push(label);
            this.scene.add(label);
        });
    }

    createTextSprite(text) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 128;

        // Clear canvas first
        context.clearRect(0, 0, canvas.width, canvas.height);
        
        context.font = 'Bold 40px Arial';
        context.fillStyle = 'white';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, 128, 64);

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        const material = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(2, 1, 1);
        return sprite;
    }

    createGrillworst() {
        this.grillworst = new THREE.Group();
        this.grillworst.position.copy(this.grillworstPosition);
        this.scene.add(this.grillworst);

        // 1. Body - Capsule met de nieuwe kleur: #ca531d
        const bodyGeometry = new THREE.CapsuleGeometry(0.35, 0.7, 12, 24);
        const bodyMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xca531d, 
            roughness: 0.5 
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.castShadow = true;
        this.grillworst.add(body);

        // 2. Grillstrepen (Haren) - Kleur: #aa3b0d
        // De hoogte is verlaagd (Y van 0.65 naar 0.55) en de y-offset berekening is gecorrigeerd
        const stripeGeometry = new THREE.BoxGeometry(0.04, 0.04, 0.25); 
        const stripeMaterial = new THREE.MeshStandardMaterial({ color: 0xaa3b0d });
        
        for (let i = 0; i < 5; i++) {
            const stripe = new THREE.Mesh(stripeGeometry, stripeMaterial);
            // Verdeel over de breedte
            const xOffset = -0.15 + (i * 0.075);
            
            // De basis Y is nu 0.35 (het begin van de bovenste halve bol van de capsule)
            // De wortel-berekening zorgt dat ze de bolling van de bovenkant volgen
            const yBase = 0.35;
            const sphereRadius = 0.35;
            const yOffset = Math.sqrt(Math.max(0, Math.pow(sphereRadius, 2) - Math.pow(xOffset, 2)));
            
            // We trekken er een heel klein beetje vanaf (0.02) zodat ze minder "zweven"
            stripe.position.set(xOffset, yBase + yOffset - 0.02, 0); 
            
            // Laat de strepen meekantelen met de ronding van het hoofd
            stripe.rotation.z = -xOffset * 2; 
            
            body.add(stripe);
        }

        // 3. Ogen
        const createEye = (xPos) => {
            const eyeGroup = new THREE.Group();
            const white = new THREE.Mesh(
                new THREE.SphereGeometry(0.1, 16, 16),
                new THREE.MeshBasicMaterial({ color: 0xffffff })
            );
            const pupil = new THREE.Mesh(
                new THREE.SphereGeometry(0.04, 8, 8),
                new THREE.MeshBasicMaterial({ color: 0x000000 })
            );
            pupil.position.z = 0.08;
            eyeGroup.add(white, pupil);
            eyeGroup.position.set(xPos, 0.25, 0.32);
            return eyeGroup;
        };

        this.grillworst.add(createEye(-0.15));
        this.grillworst.add(createEye(0.15));

        // 4. De Mond - Nu ook in de kleur van de grillstrepen voor eenheid
        const mouthGeo = new THREE.TorusGeometry(0.1, 0.025, 8, 16, Math.PI);
        const mouthMat = new THREE.MeshBasicMaterial({ color: 0xaa3b0d });
        const mouth = new THREE.Mesh(mouthGeo, mouthMat);
        
        mouth.position.set(0, 0.05, 0.35); 
        mouth.rotation.set(0, 0, Math.PI); 
        this.grillworst.add(mouth);
    }

    setupEventListeners() {
        const canvas = this.renderer.domElement;

        const onPointerDown = (event) => {
            if (this.isAnimating) return;

            const rect = canvas.getBoundingClientRect();
            this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

            this.raycaster.setFromCamera(this.mouse, this.camera);

            const intersects = this.raycaster.intersectObjects(this.platforms);
            if (intersects.length > 0) {
                const platform = intersects[0].object;
                const index = platform.userData.index;
                this.callbacks.onOptionSelected(index);
            }
        };

        canvas.addEventListener('pointerdown', onPointerDown);
        canvas.addEventListener('touchstart', (event) => {
            event.preventDefault();
            const touch = event.touches[0];
            onPointerDown({ clientX: touch.clientX, clientY: touch.clientY });
        });
    }

    updateQuestion(options) {
        options.forEach((option, index) => {
            this.updateTextSprite(this.platformLabels[index], option);
        });
    }

    updateTextSprite(sprite, text) {
        const canvas = sprite.material.map.image;
        const context = canvas.getContext('2d');
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.font = 'Bold 40px Arial';
        context.fillStyle = 'white';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, 128, 64);
        
        // Ensure texture is properly updated
        if (sprite.material.map) {
            sprite.material.map.needsUpdate = true;
        }
        if (sprite.material) {
            sprite.material.needsUpdate = true;
        }
    }

    animateCorrectChoice(platformIndex) {
        if (platformIndex < 0 || platformIndex >= this.platforms.length) {
            console.error('Invalid platform index:', platformIndex);
            return;
        }
        
        this.isAnimating = true;
        const platform = this.platforms[platformIndex];
        const targetPos = platform.position.clone().add(new THREE.Vector3(0, 1, 0));

        // Jump animation
        this.animateJump(this.grillworstPosition, targetPos, () => {
            // Bounce
            this.animateBounce(this.grillworst, () => {
                // Glow platform green
                platform.material.emissive.setHex(0x00ff00);
                
                // Create confetti effect
                this.spawnConfetti();
                
                setTimeout(() => {
                    platform.material.emissive.setHex(0x000000);
                    this.isAnimating = false;
                }, 500);
            });
        });
    }

    animateWrongChoice(platformIndex) {
        if (platformIndex < 0 || platformIndex >= this.platforms.length) {
            console.error('Invalid platform index:', platformIndex);
            return;
        }
        
        this.isAnimating = true;
        const platform = this.platforms[platformIndex];

        // Jump to platform
        const targetPos = platform.position.clone().add(new THREE.Vector3(0, 1, 0));
        this.animateJump(this.grillworstPosition, targetPos, () => {
            // Sink platform
            this.animateSink(platform, () => {
                // Fall into lava
                this.animateFall(this.grillworst, () => {
                    this.isAnimating = false;
                    // Reset grillworst position
                    this.grillworst.position.copy(this.grillworstPosition);
                });
            });
        });
    }

    // Simple confetti effect - minimal performance impact
    spawnConfetti() {
        const confettiCount = 80;
        const confettiColors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff];

        for (let i = 0; i < confettiCount; i++) {
            const geometry = new THREE.BoxGeometry(0.12, 0.06, 0.02);
            const color = confettiColors[Math.floor(Math.random() * confettiColors.length)];
            const material = new THREE.MeshBasicMaterial({ color });

            const confetti = new THREE.Mesh(geometry, material);

            // Startpositie: willekeurig boven de "lava-vlakte", in camera-view
            confetti.position.set(
                (Math.random() - 0.5) * 10,  // x
                Math.random() * 4 + 3,       // y (hoog in beeld)
                (Math.random() - 0.5) * 10   // z
            );

            this.scene.add(confetti);

            // Voeg animatie toe
            this.animations.push({
                type: 'confetti',
                object: confetti,
                velocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 1.5,
                    -(Math.random() * 1.5 + 0.5),
                    (Math.random() - 0.5) * 1.5
                ),
                elapsed: 0,
                duration: 1.2,
                geometry,
                material
            });
        }
    }

    animateJumpToPlatform(platformIndex, callback) {
        if (platformIndex < 0 || platformIndex >= this.platforms.length) {
            console.error('Invalid platform index:', platformIndex);
            if (callback) callback();
            return;
        }
        
        const platform = this.platforms[platformIndex];
        const startPos = this.grillworstPosition.clone(); // Use the stored position
        const endPos = platform.position.clone().add(new THREE.Vector3(0, 1, 0));
        
        this.isAnimating = true;
        this.animateJump(startPos, endPos, () => {
            this.isAnimating = false;
            if (callback) callback();
        });
    }

    animateJump(startPos, endPos, callback) {
        // Add animation to the central animation system
        this.animations.push({
            type: 'jump',
            object: this.grillworst,
            startPos: startPos.clone(),
            endPos: endPos.clone(),
            elapsed: 0,
            duration: 0.3,
            callback: () => {
                this.grillworstPosition.copy(endPos);
                if (callback) callback();
            }
        });
    }

    animateBounce(object, callback) {
        const originalScale = object.scale.clone();
        const squishScale = originalScale.clone().multiplyScalar(1.2);
        squishScale.y *= 0.8;

        this.animations.push({
            type: 'bounce',
            object,
            originalScale,
            squishScale,
            elapsed: 0,
            duration: 0.2,
            callback
        });
    }

    animateSink(platform, callback) {
        // Add animation to the central animation system
        this.animations.push({
            type: 'sink',
            object: platform,
            startY: platform.position.y,
            elapsed: 0,
            duration: 1,
            callback: callback
        });
    }

    animateFall(object, callback) {
        // Add animation to the central animation system
        this.animations.push({
            type: 'fall',
            object: object,
            startY: object.position.y,
            elapsed: 0,
            duration: 0.5,
            callback: callback
        });
    }

    // VOEG DIT HIER TOE:
    smoothLookAt(object, targetPosition, duration = 0.8) {
        const startQuaternion = object.quaternion.clone();

        // Gebruik een Object3D in plaats van .clone() voor betere performance
        const dummy = new THREE.Object3D();
        dummy.position.copy(object.position);
        
        const flatTarget = targetPosition.clone();
        flatTarget.y = object.position.y;
        dummy.lookAt(flatTarget);
        const targetQuaternion = dummy.quaternion.clone();

        this.animations.push({
            type: 'rotate',
            object: object,
            startQuaternion: startQuaternion,
            targetQuaternion: targetQuaternion,
            elapsed: 0,
            duration: duration
        });
    }

    initBubbles() {
        const bubbleCount = 15;
        const geometry = new THREE.SphereGeometry(0.2, 8, 8);
        const material = new THREE.MeshLambertMaterial({ 
            color: 0xff4500,
            emissive: 0xff2200,
            transparent: true,
            opacity: 0.8
        });

        for (let i = 0; i < bubbleCount; i++) {
            const bubble = new THREE.Mesh(geometry, material.clone());
            this.resetBubble(bubble);
            // Verspreid starttijden
            bubble.userData.offset = Math.random() * 10;
            this.scene.add(bubble);
            this.bubbles.push(bubble);
        }
    }

    resetBubble(bubble) {
        bubble.position.set(
            (Math.random() - 0.5) * 20,
            -0.6, // Start onder het oppervlak
            (Math.random() - 0.5) * 20
        );
        bubble.scale.setScalar(Math.random() * 0.5 + 0.2);
        bubble.userData.speed = Math.random() * 0.02 + 0.01;
        bubble.userData.life = 0;
    }

    updateBubbles(delta) {
        this.bubbles.forEach(bubble => {
            bubble.userData.life += delta;
            
            // Laat bubbel langzaam stijgen
            bubble.position.y += bubble.userData.speed;
            
            // Schaal-effect: "opzwelgen" en dan knappen
            const s = Math.sin(bubble.userData.life * 2);
            bubble.scale.setScalar(bubble.scale.x + s * 0.001);

            // Als de bubbel te hoog komt of te oud is, reset
            if (bubble.position.y > 0 || bubble.userData.life > 4) {
                // "Splash" effect bij knappen (optioneel: je zou hier een kleinschalige explosie kunnen doen)
                this.resetBubble(bubble);
            }
        });
    }

    easeOutQuad(t) {
        return t * (2 - t);
    }

    easeOutBounce(t) {
        if (t < 1 / 2.75) {
            return 7.5625 * t * t;
        } else if (t < 2 / 2.75) {
            return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
        } else if (t < 2.5 / 2.75) {
            return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
        } else {
            return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
        }
    }

    easeInQuad(t) {
        return t * t;
    }

    // Central animation management - processes all animations in single loop
    updateActiveAnimations(delta) {
        for (let i = this.animations.length - 1; i >= 0; i--) {
            const anim = this.animations[i];
            anim.elapsed += delta;
            const t = Math.min(anim.elapsed / anim.duration, 1);

            if (anim.type === 'jump') {
                const easedT = this.easeOutQuad(t);
                const currentX = anim.startPos.x + (anim.endPos.x - anim.startPos.x) * easedT;
                const currentZ = anim.startPos.z + (anim.endPos.z - anim.startPos.z) * easedT;
                const startY = anim.startPos.y;
                const endY = anim.endPos.y;
                const midY = Math.max(startY, endY) + 1.5;
                const currentY = startY + (endY - startY) * easedT + Math.sin(t * Math.PI) * (midY - startY);
                anim.object.position.set(currentX, currentY, currentZ);
                
                if (t >= 1) {
                    this.grillworstPosition.copy(anim.endPos);
                }
            }
            else if (anim.type === 'bounce') {
                const easedT = this.easeOutBounce(t);
                // Interpoleer tussen squish en original t.o.v. opgeslagen waarden
                anim.object.scale.lerpVectors(anim.squishScale, anim.originalScale, easedT);

                if (t >= 1) {
                    anim.object.scale.copy(anim.originalScale);
                }
            }
            else if (anim.type === 'sink') {
                const startY = anim.startY;
                const endY = -1;
                const easedT = this.easeInQuad(t);
                anim.object.position.y = startY + (endY - startY) * easedT;
            }
            else if (anim.type === 'fall') {
                const startY = anim.startY;
                const endY = -2;
                const easedT = this.easeInQuad(t);
                anim.object.position.y = startY + (endY - startY) * easedT;
            }
            else if (anim.type === 'confetti') {
                // simpele zwaartekracht / beweging
                anim.object.position.addScaledVector(anim.velocity, delta);
                anim.velocity.y -= 3 * delta; // zwaartekracht

                // lichte rotatie voor "fladderend" effect
                anim.object.rotation.x += 4 * delta;
                anim.object.rotation.y += 6 * delta;

                if (t >= 1) {
                    this.scene.remove(anim.object);
                    if (anim.geometry) anim.geometry.dispose();
                    if (anim.material) anim.material.dispose();
                }
            }
            else if (anim.type === 'camera-pan') {
                const easedT = this.easeOutQuad(t);
                // Smooth interpolation between start and target positions
                this.camera.position.lerpVectors(anim.startPosition, anim.targetPosition, easedT);
                // Smooth look at interpolation
                const currentLookAt = new THREE.Vector3().lerpVectors(anim.startLookAt, anim.targetLookAt, easedT);
                this.camera.lookAt(currentLookAt);
            } 
            else if (anim.type === 'rotate') {
                const easedT = this.easeOutQuad(t);
                // Vloeiende interpolatie tussen de start- en doelrotatie (Quaternion)
                anim.object.quaternion.slerpQuaternions(anim.startQuaternion, anim.targetQuaternion, easedT);
            }

            // Remove completed animations and call callbacks
            if (t >= 1) {
                if (anim.callback) anim.callback();
                this.animations.splice(i, 1);
            }
        }
        
        // Update isAnimating state
        this.isAnimating = this.animations.length > 0;
    }

    // Camera position presets - now random selection
    getCameraPositionForIndex(index) {
        const cameraPositions = [
            new THREE.Vector3(8, 6, 8),      // Front view
            new THREE.Vector3(-8, 6, 8),     // Left view
            new THREE.Vector3(8, 6, -8),     // Right view
            new THREE.Vector3(-8, 6, -8),    // Back view
            new THREE.Vector3(12, 8, 0),     // Top-right view
            new THREE.Vector3(-12, 8, 0),    // Top-left view
            new THREE.Vector3(0, 10, 12),    // High front view
            new THREE.Vector3(0, 10, -12)    // High back view
        ];

        // Pick random index, avoiding the same as last time
        let randomIndex;
        do {
            randomIndex = Math.floor(Math.random() * cameraPositions.length);
        } while (cameraPositions.length > 1 && randomIndex === this.lastCameraIndex);

        this.lastCameraIndex = randomIndex;
        return cameraPositions[randomIndex];
    }

    // Update camera position with smooth panning
    updateCameraPosition(index) {
        const targetPosition = this.getCameraPositionForIndex(index);
        
        // Start de camera pan
        this.panCameraToPosition(targetPosition, 1.5);
        
        // Start direct de vloeiende draai van de worst naar de NIEUWE camerapositie
        if (this.grillworst) {
            this.smoothLookAt(this.grillworst, targetPosition, 1.2);
        }
    }

    // Camera panning animation
    panCameraToPosition(targetPosition, duration = 1.5, callback) {
        // Add animation to the central animation system
        this.animations.push({
            type: 'camera-pan',
            startPosition: this.camera.position.clone(),
            targetPosition: targetPosition.clone(),
            startLookAt: this.camera.getWorldDirection(new THREE.Vector3()).clone(),
            targetLookAt: new THREE.Vector3(0, 0, 0), // Look at center
            elapsed: 0,
            duration: duration,
            callback: callback
        });
    }

    // Victory mode methods
    startVictoryMode() {
        this.victoryMode = true;
        this.victoryStartTime = this.clock.getElapsedTime();
        this.lastVictoryConfettiTick = -1;
    }

    stopVictoryMode() {
        this.victoryMode = false;
    }

    animate() {
        if (!this.running) return;

        requestAnimationFrame(() => this.animate());

        const delta = this.clock.getDelta();

        // Update ground shader
        if (this.ground && this.ground.material && this.ground.material.uniforms) {
            this.ground.material.uniforms.time.value += delta;
        }
        
        // knal bubbles in de lava!
        this.updateBubbles(delta);

        // Update animaties
        this.updateActiveAnimations(delta);

        // Victory-party mode: camera orbit + draaiende grillworst + confetti
        if (this.victoryMode) {
            const t = this.clock.getElapsedTime() - this.victoryStartTime;
            const radius = 10;

            const camX = Math.cos(t * 0.4) * radius;
            const camZ = Math.sin(t * 0.4) * radius;
            this.camera.position.set(camX, 7, camZ);
            this.camera.lookAt(0, 0.5, 0);

            if (this.grillworst) {
                this.grillworst.rotation.y += delta * 2.5;
            }

            // Confetti every 0.5 seconds
            const tick = Math.floor(t / 0.5);
            if (tick !== this.lastVictoryConfettiTick) {
                this.lastVictoryConfettiTick = tick;
                this.spawnConfetti();
            }
        } else {
            // Idle bobbing als we NIET in victory mode zijn en er geen animaties lopen
            if (!this.isAnimating && this.animations.length === 0 && this.grillworst) {
                this.grillworst.position.y =
                    this.grillworstPosition.y + Math.sin(performance.now() * 0.003) * 0.05;
            }
        }

        this.renderer.render(this.scene, this.camera);
    }

    onResize() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    dispose() {
        // Stop de renderloop
        this.running = false;

        // Canvas uit de DOM halen (beëindigt ook pointer-events)
        if (this.renderer && this.renderer.domElement && this.renderer.domElement.parentNode) {
            this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
        }

        // Geheugen opruimen
        if (this.scene) {
            this.scene.traverse((object) => {
                if (object.geometry) object.geometry.dispose();
                if (object.material) {
                    if (Array.isArray(object.material)) {
                        object.material.forEach(mat => mat.dispose());
                    } else {
                        object.material.dispose();
                    }
                }
            });
        }

        if (this.renderer) {
            this.renderer.dispose();
        }

        // Animaties leegmaken
        this.animations = [];
    }
}

// Global instance for exports
globalThis.threeSceneInstance = null;

// Export functions that work with the global instance
export function initThreeScene(container, callbacks) {
    globalThis.threeSceneInstance = new ThreeScene(container, callbacks);
    return globalThis.threeSceneInstance;
}

export function disposeThreeScene() {
    if (globalThis.threeSceneInstance) {
        globalThis.threeSceneInstance.dispose();
        globalThis.threeSceneInstance = null;
    }
}

export function updateCameraPosition(index) {
    if (globalThis.threeSceneInstance) {
        globalThis.threeSceneInstance.updateCameraPosition(index);
    }
}

export function startVictoryAnimation() {
    if (globalThis.threeSceneInstance) {
        globalThis.threeSceneInstance.startVictoryMode();
    }
}

export function stopVictoryAnimation() {
    if (globalThis.threeSceneInstance) {
        globalThis.threeSceneInstance.stopVictoryMode();
    }
}

export function highlightPlatform(index) {
    if (globalThis.threeSceneInstance) {
        // Placeholder for highlighting platform
        console.log('Platform highlighted:', index);
    }
}

export function spawnConfetti() {
    if (globalThis.threeSceneInstance) {
        // Placeholder for confetti
        console.log('Confetti spawned');
    }
}

export function animateJump(platformIndex, callback) {
    if (globalThis.threeSceneInstance) {
        globalThis.threeSceneInstance.animateJumpToPlatform(platformIndex, callback);
    } else {
        console.error('ThreeScene instance not available for jumping');
        if (callback) callback();
    }
}

export function animateCorrect(platformIndex, callback) {
    if (globalThis.threeSceneInstance) {
        globalThis.threeSceneInstance.animateCorrectChoice(platformIndex);
        if (callback) callback();
    }
}

export function animateWrong(platformIndex, callback) {
    if (globalThis.threeSceneInstance) {
        globalThis.threeSceneInstance.animateWrongChoice(platformIndex);
        if (callback) callback();
    }
}

export function resetGrillworstje() {
    if (globalThis.threeSceneInstance) {
        // Reset grillworst position
        globalThis.threeSceneInstance.grillworst.position.copy(globalThis.threeSceneInstance.grillworstPosition);
    }
}

export function resetPlatforms() {
    if (globalThis.threeSceneInstance) {
        // Reset platforms
        globalThis.threeSceneInstance.platforms.forEach(platform => {
            platform.position.y = 0.5;
            platform.material.emissive.setHex(0x000000);
        });
    }
}

export { ThreeScene };
