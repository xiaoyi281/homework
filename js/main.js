import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { FilesetResolver, HandLandmarker } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.17";
import { SCENE_NAMES, SCENE_COUNT, buildScenes } from "./shapes.js";

const PARTICLE_COUNT = 52000;

const vertexShader = /* glsl */ `
attribute float aSeed;
attribute vec3 aJitter;
attribute vec3 a0;
attribute vec3 a1;
attribute vec3 a2;
attribute vec3 a3;
attribute vec3 a4;
attribute vec3 a5;
attribute vec3 a6;
attribute vec3 a7;
uniform float uTime;
uniform float uScene;
uniform float uScatter;
uniform float uFlow;
uniform float uVortex;
uniform float uRise;
uniform float uPointScale;
varying float vSeed;
varying float vTw;

vec3 sceneAt(float index) {
  float i = mod(index, 8.0);
  if (i < 0.5) return a0;
  if (i < 1.5) return a1;
  if (i < 2.5) return a2;
  if (i < 3.5) return a3;
  if (i < 4.5) return a4;
  if (i < 5.5) return a5;
  if (i < 6.5) return a6;
  return a7;
}

void main() {
  float wrapped = mod(uScene, 8.0);
  float base = floor(wrapped);
  float frac = fract(wrapped);
  vec3 formed = mix(sceneAt(base), sceneAt(base + 1.0), smoothstep(0.0, 1.0, frac));

  float spin = aSeed * 6.2831853 + uTime * 0.18;
  vec3 scattered = formed + aJitter * (7.0 + aSeed * 12.0);
  scattered += vec3(cos(spin), sin(spin * 0.73), sin(spin)) * uScatter * 1.8;

  float t = fract(aSeed * 0.37 + uTime * 0.11);
  float lane = (aSeed - 0.5) * 7.0;
  vec3 flow = vec3(
    (t - 0.5) * 48.0,
    sin(aSeed * 40.0 + uTime * 2.4) * 1.3 + lane * 0.35,
    cos(aSeed * 28.0 + t * 6.2831853) * 2.4
  );

  float ang = uTime * (1.4 + aSeed * 0.8) + aSeed * 6.2831853;
  float radius = 2.2 + aSeed * 10.0;
  vec3 vortex = vec3(
    cos(ang) * radius,
    sin(aSeed * 18.0 + uTime * 1.6) * 3.2 + (aSeed - 0.5) * 6.0,
    sin(ang) * radius
  );

  float riseT = fract(aSeed * 0.51 + uTime * 0.22);
  vec3 rise = vec3(
    (aSeed - 0.5) * 14.0 + sin(uTime * 1.8 + aSeed * 20.0) * 1.4,
    (riseT - 0.15) * 18.0,
    cos(aSeed * 30.0 + uTime) * 3.5
  );

  vec3 pos = formed;
  pos = mix(pos, scattered, uScatter);
  pos = mix(pos, flow, uFlow);
  pos = mix(pos, vortex, uVortex);
  pos = mix(pos, rise, uRise);

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  gl_PointSize = clamp(uPointScale * (190.0 / max(1.0, -mvPosition.z)), 1.0, 6.5);
  vSeed = aSeed;
  vTw = 0.72 + 0.28 * sin(uTime * 2.6 + aSeed * 48.0);
}
`;

const fragmentShader = /* glsl */ `
precision highp float;
varying float vSeed;
varying float vTw;
uniform float uFlow;
uniform float uVortex;
uniform float uRise;
void main() {
  vec2 uv = gl_PointCoord - vec2(0.5);
  float d = length(uv);
  if (d > 0.5) discard;
  float glow = smoothstep(0.5, 0.05, d);
  vec3 gold = vec3(1.0, 0.74, 0.28);
  gold += vec3(0.08, 0.04, 0.0) * (vSeed - 0.5);
  vec3 stream = vec3(0.55, 1.0, 0.72);
  vec3 swirl = vec3(0.72, 0.82, 1.0);
  vec3 lift = vec3(1.0, 0.58, 0.42);
  vec3 tint = gold;
  tint = mix(tint, stream, uFlow);
  tint = mix(tint, swirl, uVortex);
  tint = mix(tint, lift, uRise);
  gl_FragColor = vec4(tint * glow * vTw, glow * 0.85);
}
`;

const rows = {
  open: document.querySelector('[data-gesture="open"]'),
  fist: document.querySelector('[data-gesture="fist"]'),
  point: document.querySelector('[data-gesture="point"]'),
  peace: document.querySelector('[data-gesture="peace"]'),
  three: document.querySelector('[data-gesture="three"]'),
  thumb: document.querySelector('[data-gesture="thumb"]'),
};
const sceneLabel = document.querySelector("#scene-label");
const cameraState = document.querySelector("#camera-state");
const video = document.querySelector("#webcam");

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(23, 11, 30);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 2.4, 0);
controls.minDistance = 8;
controls.maxDistance = 70;
controls.maxPolarAngle = Math.PI * 0.92;

const data = buildScenes(PARTICLE_COUNT);
const geometry = new THREE.BufferGeometry();
geometry.setAttribute("position", new THREE.BufferAttribute(data.scenes[0], 3));
data.scenes.forEach((buf, index) => {
  geometry.setAttribute(`a${index}`, new THREE.BufferAttribute(buf, 3));
});
geometry.setAttribute("aJitter", new THREE.BufferAttribute(data.jitter, 3));
geometry.setAttribute("aSeed", new THREE.BufferAttribute(data.seed, 1));

const uniforms = {
  uTime: { value: 0 },
  uScene: { value: 0 },
  uScatter: { value: 0 },
  uFlow: { value: 0 },
  uVortex: { value: 0 },
  uRise: { value: 0 },
  uPointScale: { value: 1.55 },
};

const points = new THREE.Points(
  geometry,
  new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
);
scene.add(points);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.42,
  0.28,
  0.32
);
composer.addPass(bloom);

let gesture = "fist";
let scatter = 0;
let flow = 0;
let vortex = 0;
let rise = 0;
let sceneValue = 0;
let sceneGoal = 0;
let stable = "fist";
let stableFrames = 0;

const GESTURE_SCENE = {
  point: 1,
  peace: 4,
  three: 3,
};

function setGesture(next) {
  if (next === "fist" && gesture !== "fist") sceneGoal += 1;
  if (next === "thumb" && gesture !== "thumb") sceneGoal -= 1;
  if (GESTURE_SCENE[next] != null && gesture !== next) sceneGoal = GESTURE_SCENE[next];
  if (next === gesture) return;
  gesture = next;
  Object.entries(rows).forEach(([key, el]) => {
    if (el) el.classList.toggle("active", key === next);
  });
}

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = (a.z || 0) - (b.z || 0);
  return Math.hypot(dx, dy, dz);
}

function classifyHand(landmarks) {
  const wrist = landmarks[0];
  const tips = [8, 12, 16, 20];
  const pips = [6, 10, 14, 18];
  const extended = tips.map((tip, index) => {
    const tipD = distance(landmarks[tip], wrist);
    const pipD = distance(landmarks[pips[index]], wrist);
    return tipD > pipD * 1.18;
  });
  const thumbTip = landmarks[4];
  const thumbIp = landmarks[3];
  const indexMcp = landmarks[5];
  const thumbOut = distance(thumbTip, wrist) > distance(thumbIp, wrist) * 1.12;
  const thumbSide = Math.abs(thumbTip.x - indexMcp.x) > 0.06;
  const thumbUp = thumbOut && thumbSide && !extended[0] && !extended[1] && !extended[2] && !extended[3];

  const count = extended.filter(Boolean).length;
  if (thumbUp) return "thumb";
  if (count >= 4) return "open";
  if (count === 3 && extended[0] && extended[1] && extended[2]) return "three";
  if (count === 2 && extended[0] && extended[1]) return "peace";
  if (count === 1 && extended[0]) return "point";
  if (count === 0) return "fist";
  return null;
}

function observe(raw, handPresent) {
  if (!handPresent) {
    stableFrames = 0;
    return;
  }
  if (!raw) return;
  if (raw === stable) stableFrames += 1;
  else {
    stable = raw;
    stableFrames = 1;
  }
  if (stableFrames >= 6) setGesture(stable);
}

let handLandmarker;
async function startCamera() {
  cameraState.textContent = "正在打开摄像头…";
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: 640, height: 480 },
      audio: false,
    });
    video.srcObject = stream;
    await video.play();
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.17/wasm"
    );
    try {
      handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "./vendor/hand_landmarker.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numHands: 1,
      });
    } catch {
      handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "./vendor/hand_landmarker.task",
          delegate: "CPU",
        },
        runningMode: "VIDEO",
        numHands: 1,
      });
    }
    cameraState.textContent = "请对手势控制";
  } catch (error) {
    cameraState.textContent = "需要摄像头权限才能用手势控制";
    console.warn(error);
  }
}

let lastVideoTime = -1;
function readHand() {
  if (!handLandmarker || video.readyState < 2) return;
  if (video.currentTime === lastVideoTime) return;
  lastVideoTime = video.currentTime;
  const result = handLandmarker.detectForVideo(video, performance.now());
  const landmarks = result.landmarks && result.landmarks[0];
  observe(landmarks ? classifyHand(landmarks) : null, Boolean(landmarks));
}

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  readHand();

  const scatterTarget = gesture === "open" ? 1 : 0;
  scatter += (scatterTarget - scatter) * (1 - Math.exp(-dt * 2.4));
  flow += (0 - flow) * (1 - Math.exp(-dt * 3.2));
  vortex += (0 - vortex) * (1 - Math.exp(-dt * 3.2));
  rise += (0 - rise) * (1 - Math.exp(-dt * 3.2));
  sceneValue += (sceneGoal - sceneValue) * (1 - Math.exp(-dt * 1.35));

  uniforms.uTime.value += dt;
  uniforms.uScatter.value = scatter;
  uniforms.uFlow.value = flow;
  uniforms.uVortex.value = vortex;
  uniforms.uRise.value = rise;
  uniforms.uScene.value = sceneValue;
  const idx = ((Math.round(sceneGoal) % SCENE_COUNT) + SCENE_COUNT) % SCENE_COUNT;
  sceneLabel.textContent = SCENE_NAMES[idx];

  controls.update();
  composer.render();
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  bloom.setSize(window.innerWidth, window.innerHeight);
});

document.querySelector("#boot").remove();
const cover = document.querySelector("#cover");
const coverStart = document.querySelector("#cover-start");
cover.hidden = false;
animate();

coverStart.addEventListener("click", () => {
  cover.hidden = true;
  document.body.classList.remove("cover-open");
  startCamera();
});
