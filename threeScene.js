/**
 * threeScene.js
 * Three.js module voor de 3D grillworstje-game.
 */

import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

const CONFIG = {
  colors: {
    lava: 0xff4500,
    lavaBright: 0xffa500,
    platform: 0x1e88e5,
    platformHover: 0x42a5f5,
    platformCorrect: 0x4caf50,
    platformWrong: 0xf44336,
    platformSelected: 0xffeb3b,
    grillworst: 0x8b4513,
    text: 0xffffff,
    background: 0x87ceeb
  },
  geometry: {
    platformWidth: 3.0,
    platformHeight: 0.8,
    platformDepth: 2.5,
    platformGap: 4.0,
    lavaWidth: 60,
    lavaDepth: 40,
    worstRadius: 0.6,
    worstHeight: 1.6
  },
  animation: {
    jumpDuration: 0.5,
    sinkDuration: 1.0,
    bounceDuration: 0.4,
    lavaPulseSpeed: 2.0,
    idleBobSpeed: 2.5,
    idleBobAmount: 0.06,
    idleRotateSpeed: 1.0
  },
  labels: ['A', 'B', 'C', 'D']
};

let scene, camera, renderer, raycaster, pointer;
let platforms = [];
let grillworstje;
let lava;
let platformLabels = [];
let confettiParticles = [];
let clock;
let isAnimating = false;
let hoveredPlatform = -1;
let callbacks = {};
let containerElement = null;

// ============================================================================
// INITIALISATIE
// ============================================================================

export function initThreeScene(container, callbackHandlers) {
  callbacks = callbackHandlers;
  containerElement = container;
  
  // Scene setup
  scene = new THREE.Scene();
  scene.background = new THREE.Color(CONFIG.colors.background);
  scene.fog = new THREE.Fog(CONFIG.colors.background, 30, 80);

  clock = new THREE.Clock();

  // Camera setup - MOET voor renderer worden aangemaakt
  const aspect = container.clientWidth / container.clientHeight;
  const d = 22;
  camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 1, 1000);
  camera.position.set(22, 24, 22);
  camera.lookAt(0, 0, 0);
  scene.add(camera);

  // Renderer setup
  renderer = new THREE.WebGLRenderer({ 
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance'
  });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  // Raycaster voor interactie
  raycaster = new THREE.Raycaster();
  pointer = new THREE.Vector2();

  // Licht setup
  setupLights();

  // Scene elementen maken
  createLava();
  createPlatforms();
  createGrillworstje();

  // Event listeners
  setupEventListeners(container);

  // Start render loop
  animate();

  // Handle resize
  window.addEventListener('resize', () => onWindowResize(container));
}

export function updateCamera() {
  if (!camera || !containerElement) return;
  
  const aspect = containerElement.clientWidth / containerElement.clientHeight;
  const isMobile = containerElement.clientWidth < 768;
  const distance = isMobile ? 26 : 22;
  const d = distance;
  
  camera.left = -d * aspect;
  camera.right = d * aspect;
  camera.top = d;
  camera.bottom = -d;
  camera.updateProjectionMatrix();
}

export function disposeThreeScene() {
  clearConfetti();
  
  if (renderer) {
    renderer.dispose();
    if (renderer.domElement && renderer.domElement.parentNode) {
      renderer.domElement.parentNode.removeChild(renderer.domElement);
    }
  }
  platforms = [];
  platformLabels = [];
  containerElement = null;
}

function setupLights() {
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
  directionalLight.position.set(15, 30, 15);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 1024;
  directionalLight.shadow.mapSize.height = 1024;
  directionalLight.shadow.camera.near = 0.5;
  directionalLight.shadow.camera.far = 70;
  directionalLight.shadow.camera.left = -30;
  directionalLight.shadow.camera.right = 30;
  directionalLight.shadow.camera.top = 30;
  directionalLight.shadow.camera.bottom = -30;
  scene.add(directionalLight);

  const lavaLight = new THREE.PointLight(CONFIG.colors.lava, 0.5, 50);
  lavaLight.position.set(0, -10, 0);
  scene.add(lavaLight);
}

function createLava() {
  const geometry = new THREE.PlaneGeometry(CONFIG.geometry.lavaWidth, CONFIG.geometry.lavaDepth);
  const lavaMaterial = new THREE.MeshStandardMaterial({
    color: CONFIG.colors.lava,
    emissive: CONFIG.colors.lava,
    emissiveIntensity: 0.3,
    roughness: 0.9,
    metalness: 0.0
  });
  lava = new THREE.Mesh(geometry, lavaMaterial);
  lava.rotation.x = -Math.PI / 2;
  lava.position.y = -4;
  lava.receiveShadow = true;
  scene.add(lava);
}

function createPlatforms() {
  const platformGeometry = new THREE.BoxGeometry(
    CONFIG.geometry.platformWidth,
    CONFIG.geometry.platformHeight,
    CONFIG.geometry.platformDepth
  );

  const xPositions = [
    -CONFIG.geometry.platformGap * 1.5,
    -CONFIG.geometry.platformGap * 0.5,
    CONFIG.geometry.platformGap * 0.5,
    CONFIG.geometry.platformGap * 1.5
  ];

  for (let i = 0; i < 4; i++) {
    const platformMaterial = new THREE.MeshStandardMaterial({
      color: CONFIG.colors.platform,
      roughness: 0.5,
      metalness: 0.1
    });

    const platform = new THREE.Mesh(platformGeometry, platformMaterial);
    platform.position.set(xPositions[i], 0, 0);
    platform.castShadow = true;
    platform.receiveShadow = true;
    platform.userData = { index: i, originalY: 0, originalColor: CONFIG.colors.platform };
    
    scene.add(platform);
    platforms.push(platform);

    const label = createLabelSprite(CONFIG.labels[i]);
    label.position.set(xPositions[i], CONFIG.geometry.platformHeight / 2 + 0.8, 0);
    scene.add(label);
    platformLabels.push(label);
  }
}

function createLabelSprite(letter) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = 256;
  canvas.height = 256;

  context.fillStyle = '#ffffff';
  context.beginPath();
  context.arc(128, 128, 110, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = '#333333';
  context.lineWidth = 10;
  context.beginPath();
  context.arc(128, 128, 110, 0, Math.PI * 2);
  context.stroke();

  context.fillStyle = '#333333';
  context.font = 'bold 150px Arial';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(letter, 128, 128);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;

  const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.scale.set(1.8, 1.8, 1);

  return sprite;
}

function createGrillworstje() {
  const group = new THREE.Group();

  const worstGeometry = new THREE.CapsuleGeometry(
    CONFIG.geometry.worstRadius,
    CONFIG.geometry.worstHeight,
    4,
    8
  );
  const worstMaterial = new THREE.MeshStandardMaterial({
    color: CONFIG.colors.grillworst,
    roughness: 0.5,
    metalness: 0.1
  });
  const worst = new THREE.Mesh(worstGeometry, worstMaterial);
  worst.position.y = CONFIG.geometry.worstHeight / 2 + CONFIG.geometry.worstRadius;
  worst.castShadow = true;
  group.add(worst);

  const faceGroup = new THREE.Group();
  faceGroup.position.set(0, CONFIG.geometry.worstHeight - 0.2, CONFIG.geometry.worstRadius - 0.1);
  faceGroup.rotation.y = Math.PI;

  const eyeGeometry = new THREE.SphereGeometry(0.15, 12, 12);
  const eyeWhiteMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const eyeBlackMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });

  const leftEyeWhite = new THREE.Mesh(eyeGeometry, eyeWhiteMaterial);
  leftEyeWhite.position.set(-0.22, 0.18, 0);
  faceGroup.add(leftEyeWhite);
  const leftEyeBlack = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), eyeBlackMaterial);
  leftEyeBlack.position.set(-0.22, 0.18, 0.12);
  faceGroup.add(leftEyeBlack);

  const rightEyeWhite = new THREE.Mesh(eyeGeometry, eyeWhiteMaterial);
  rightEyeWhite.position.set(0.22, 0.18, 0);
  faceGroup.add(rightEyeWhite);
  const rightEyeBlack = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), eyeBlackMaterial);
  rightEyeBlack.position.set(0.22, 0.18, 0.12);
  faceGroup.add(rightEyeBlack);

  const mouthShape = new THREE.Shape();
  mouthShape.absarc(0, -0.1, 0.3, 0.15 * Math.PI, 0.85 * Math.PI, false);
  const mouthGeometry = new THREE.ShapeGeometry(mouthShape);
  const mouthMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide });
  const mouth = new THREE.Mesh(mouthGeometry, mouthMaterial);
  mouth.position.set(0, -0.18, 0.05);
  faceGroup.add(mouth);

  const cheekGeometry = new THREE.SphereGeometry(0.1, 8, 8);
  const cheekMaterial = new THREE.MeshBasicMaterial({ color: 0xffb6c1 });
  const leftCheek = new THREE.Mesh(cheekGeometry, cheekMaterial);
  leftCheek.position.set(-0.4, -0.1, 0.05);
  faceGroup.add(leftCheek);
  const rightCheek = new THREE.Mesh(cheekGeometry, cheekMaterial);
  rightCheek.position.set(0.4, -0.1, 0.05);
  faceGroup.add(rightCheek);

  group.add(faceGroup);

  group.position.set(0, CONFIG.geometry.platformHeight / 2 + CONFIG.geometry.worstRadius, -6);
  grillworstje = group;
  scene.add(grillworstje);
}

// ============================================================================
// CONFETTI SYSTEM
// ============================================================================

export function spawnConfetti() {
  const colors = [0xff6b6b, 0x4ecdc4, 0xffe66d, 0x95e1d3, 0xf38181, 0xaa96da, 0xfcbad3];
  const particleCount = 80;
  
  for (let i = 0; i < particleCount; i++) {
    const geometry = new THREE.PlaneGeometry(0.3, 0.3);
    const material = new THREE.MeshBasicMaterial({
      color: colors[Math.floor(Math.random() * colors.length)],
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 1
    });
    const particle = new THREE.Mesh(geometry, material);
    
    particle.position.set(
      (Math.random() - 0.5) * 10,
      5 + Math.random() * 5,
      (Math.random() - 0.5) * 5
    );
    
    particle.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI
    );
    
    particle.userData = {
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 0.3,
        Math.random() * 0.2 + 0.1,
        (Math.random() - 0.5) * 0.2
      ),
      rotationSpeed: new THREE.Vector3(
        (Math.random() - 0.5) * 0.2,
        (Math.random() - 0.5) * 0.2,
        (Math.random() - 0.5) * 0.2
      ),
      life: 1.0,
      decay: 0.008 + Math.random() * 0.008
    };
    
    scene.add(particle);
    confettiParticles.push(particle);
  }
}

function updateConfetti() {
  for (let i = confettiParticles.length - 1; i >= 0; i--) {
    const particle = confettiParticles[i];
    const data = particle.userData;
    
    particle.position.add(data.velocity);
    data.velocity.y -= 0.008;
    
    particle.rotation.x += data.rotationSpeed.x;
    particle.rotation.y += data.rotationSpeed.y;
    particle.rotation.z += data.rotationSpeed.z;
    
    data.life -= data.decay;
    particle.material.opacity = data.life;
    
    if (data.life <= 0 || particle.position.y < -10) {
      scene.remove(particle);
      particle.geometry.dispose();
      particle.material.dispose();
      confettiParticles.splice(i, 1);
    }
  }
}

export function clearConfetti() {
  confettiParticles.forEach(particle => {
    if (scene) {
      scene.remove(particle);
    }
    particle.geometry?.dispose();
    particle.material?.dispose();
  });
  confettiParticles = [];
}

// ============================================================================
// UPDATE FUNCTIES
// ============================================================================

export function highlightPlatform(index) {
  platforms.forEach((platform, i) => {
    if (i === index) {
      platform.material.color.setHex(CONFIG.colors.platformSelected);
      platform.scale.setScalar(1.15);
    } else {
      platform.material.color.setHex(platform.userData.originalColor);
      platform.scale.setScalar(1);
    }
  });
}

export function resetPlatforms() {
  platforms.forEach((platform) => {
    platform.material.color.setHex(platform.userData.originalColor);
    platform.position.y = platform.userData.originalY;
    platform.scale.setScalar(1);
  });
}

export function resetGrillworstje() {
  if (grillworstje) {
    grillworstje.position.set(0, CONFIG.geometry.platformHeight / 2 + CONFIG.geometry.worstRadius, -6);
    grillworstje.rotation.set(0, 0, 0);
    grillworstje.scale.set(1, 1, 1);
  }
}

// ============================================================================
// ANIMATIES
// ============================================================================

export function animateJump(platformIndex, onComplete) {
  if (!grillworstje || isAnimating) return;
  
  isAnimating = true;
  const targetPlatform = platforms[platformIndex];
  const startPos = grillworstje.position.clone();
  const endPos = targetPlatform.position.clone();
  endPos.y = CONFIG.geometry.platformHeight / 2 + CONFIG.geometry.worstHeight + 0.5;
  endPos.z = 0;

  let startTime = null;
  const duration = CONFIG.animation.jumpDuration * 1000;

  function animate(currentTime) {
    if (!startTime) startTime = currentTime;
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    const easeProgress = progress < 0.5 
      ? 2 * progress * progress 
      : 1 - Math.pow(-2 * progress + 2, 2) / 2;

    const height = Math.sin(progress * Math.PI) * 3;
    
    grillworstje.position.lerpVectors(startPos, endPos, easeProgress);
    grillworstje.position.y += height;
    grillworstje.rotation.y = progress * Math.PI;

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      grillworstje.position.copy(endPos);
      grillworstje.rotation.set(0, 0, 0);
      isAnimating = false;
      if (onComplete) onComplete();
    }
  }

  requestAnimationFrame(animate);
}

export function animateCorrect(platformIndex, onComplete) {
  const platform = platforms[platformIndex];
  platform.material.color.setHex(CONFIG.colors.platformCorrect);

  let startTime = null;
  const duration = CONFIG.animation.bounceDuration * 1000;
  const startY = grillworstje.position.y;

  function animate(currentTime) {
    if (!startTime) startTime = currentTime;
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    const bounce = Math.sin(progress * Math.PI * 2) * 0.25;
    grillworstje.position.y = startY + bounce;
    grillworstje.scale.y = 1 + bounce;
    grillworstje.scale.x = 1 - bounce * 0.5;
    grillworstje.scale.z = 1 - bounce * 0.5;

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      grillworstje.position.y = startY;
      grillworstje.scale.set(1, 1, 1);
      if (onComplete) onComplete();
    }
  }

  requestAnimationFrame(animate);
}

export function animateWrong(platformIndex, onComplete) {
  const platform = platforms[platformIndex];
  platform.material.color.setHex(CONFIG.colors.platformWrong);
  
  let startTime = null;
  const sinkDuration = CONFIG.animation.sinkDuration * 1000;

  function animate(currentTime) {
    if (!startTime) startTime = currentTime;
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / sinkDuration, 1);

    platform.position.y = platform.userData.originalY - progress * 5;
    grillworstje.position.y = CONFIG.geometry.platformHeight / 2 + CONFIG.geometry.worstHeight + 0.5 - progress * 5;
    grillworstje.rotation.z += 0.1;
    grillworstje.rotation.x += 0.06;
    grillworstje.scale.multiplyScalar(0.96);

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      if (onComplete) onComplete();
    }
  }

  requestAnimationFrame(animate);
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

function setupEventListeners(container) {
  const canvas = renderer.domElement;
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerleave', onPointerLeave);
}

function onPointerDown(event) {
  handleInteraction(event.clientX, event.clientY);
}

function onPointerMove(event) {
  handleHover(event.clientX, event.clientY);
}

function onPointerLeave() {
  if (hoveredPlatform !== -1 && platforms[hoveredPlatform]) {
    platforms[hoveredPlatform].material.color.setHex(platforms[hoveredPlatform].userData.originalColor);
    hoveredPlatform = -1;
  }
}

function handleHover(clientX, clientY) {
  if (isAnimating || !camera) return;

  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);
  const intersects = raycaster.intersectObjects(platforms);

  if (hoveredPlatform !== -1 && platforms[hoveredPlatform]) {
    platforms[hoveredPlatform].material.color.setHex(platforms[hoveredPlatform].userData.originalColor);
  }
  hoveredPlatform = -1;

  if (intersects.length > 0) {
    const platform = intersects[0].object;
    const index = platform.userData.index;
    platform.material.color.setHex(CONFIG.colors.platformHover);
    hoveredPlatform = index;
  }
}

function handleInteraction(clientX, clientY) {
  if (isAnimating || !camera) return;

  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);
  const intersects = raycaster.intersectObjects(platforms);

  if (intersects.length > 0) {
    const clickedPlatform = intersects[0].object;
    const index = clickedPlatform.userData.index;
    
    if (callbacks.onOptionSelected) {
      callbacks.onOptionSelected(index);
    }
  }
}

function onWindowResize(container) {
  if (!container || !camera) return;
  
  updateCamera();
  renderer.setSize(container.clientWidth, container.clientHeight);
}

// ============================================================================
// ANIMATION LOOP
// ============================================================================

function animate() {
  requestAnimationFrame(animate);

  // Check of scene en camera zijn geïnitialiseerd
  if (!scene || !camera) return;

  const delta = clock.getDelta();
  const time = clock.getElapsedTime();

  if (lava) {
    const pulse = (Math.sin(time * CONFIG.animation.lavaPulseSpeed) + 1) / 2;
    lava.material.emissiveIntensity = 0.2 + pulse * 0.3;
  }

  if (grillworstje && !isAnimating) {
    const bob = Math.sin(time * CONFIG.animation.idleBobSpeed) * CONFIG.animation.idleBobAmount;
    grillworstje.position.y += bob * 0.003;
    const rot = Math.sin(time * CONFIG.animation.idleRotateSpeed) * 0.04;
    grillworstje.rotation.z = rot;
    grillworstje.rotation.x = rot * 0.5;
  }

  updateConfetti();

  renderer.render(scene, camera);
}

export { CONFIG, scene, camera, renderer, platforms, grillworstje };
